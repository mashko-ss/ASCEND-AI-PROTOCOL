/**
 * ASCEND AI PROTOCOL - Nutrition Plan Generator
 * Phase 3: Deterministic nutrition generation. No OpenAI required.
 */

import {
    calculateBMR,
    estimateTDEE,
    getTargetCalories,
    getProteinGrams,
    getMacros,
    getMealsPerDay,
    getHydrationLiters
} from './nutritionRules.js';

/** Map raw goal strings to internal keys */
const GOAL_MAP = {
    fat_loss: 'fat_loss',
    muscle_gain: 'muscle_gain',
    recomp: 'recomposition',
    recomposition: 'recomposition',
    endurance: 'endurance',
    strength: 'strength'
};

/** Example meal templates by purpose */
const MEAL_TEMPLATES = {
    breakfast: [
        { purpose: 'Energy and protein to start the day', exampleFoods: ['Oats, eggs, Greek yogurt, berries, whole-grain toast'] },
        { purpose: 'Sustained energy and muscle support', exampleFoods: ['Oatmeal with nuts, scrambled eggs, banana'] }
    ],
    pre_workout: [
        { purpose: 'Fuel for training', exampleFoods: ['Banana, rice cakes, whey shake, light carbs'] },
        { purpose: 'Pre-training energy', exampleFoods: ['Oats + banana, toast + honey, light meal 60–90 min before'] }
    ],
    post_workout: [
        { purpose: 'Recovery and muscle repair', exampleFoods: ['Chicken + rice + vegetables, whey + banana, salmon + sweet potato'] },
        { purpose: 'Protein and carbs for recovery', exampleFoods: ['Grilled chicken, rice, broccoli; or protein shake + oats'] }
    ],
    lunch: [
        { purpose: 'Balanced midday nutrition', exampleFoods: ['Lean meat, quinoa, salad, olive oil'] },
        { purpose: 'Protein and fiber', exampleFoods: ['Chicken salad, turkey wrap, lentils, vegetables'] }
    ],
    dinner: [
        { purpose: 'Evening satiety and recovery', exampleFoods: ['Fish, vegetables, rice or potato'] },
        { purpose: 'Complete protein and veggies', exampleFoods: ['Salmon, broccoli, brown rice; or lean beef, greens'] }
    ],
    snack: [
        { purpose: 'Between-meal protein and satiety', exampleFoods: ['Greek yogurt, nuts, protein bar, fruit'] },
        { purpose: 'Bridge to next meal', exampleFoods: ['Cottage cheese, almonds, apple with peanut butter'] }
    ]
};

/**
 * Normalize input for nutrition generator.
 * @param {Object} raw - Raw form or API input
 * @returns {Object}
 */
function normalizeNutritionInput(raw) {
    if (!raw || typeof raw !== 'object') raw = {};
    const age = Math.max(13, Math.min(120, parseInt(raw.age, 10) || 30));
    const weight = Math.max(30, Math.min(300, parseFloat(raw.weight) || parseFloat(raw.weightKg) || 80));
    const height = Math.max(100, Math.min(250, parseFloat(raw.height) || parseFloat(raw.heightCm) || 175));
    const sex = (raw.sex || raw.gender || 'male').toLowerCase();
    const goalRaw = (raw.primary_goal || raw.goal || 'recomp').toLowerCase().replace(/\s/g, '_');
    const goal = GOAL_MAP[goalRaw] || 'recomposition';
    const activity = raw.activity || 'moderate';
    const trainingDays = Math.max(2, Math.min(6, parseInt(raw.days, 10) || parseInt(raw.trainingDaysPerWeek, 10) || 3));
    const experience = raw.experience || raw.experienceLevel || 'beginner';
    const diet = raw.diet || 'standard';
    return { age, weight, height, sex, goal, activity, trainingDays, experience, diet };
}

/**
 * Build meal plan array for given meals per day and goal.
 * @param {number} mealsPerDay
 * @param {string} goal
 * @param {number} trainingDays
 * @returns {Array<{ mealName: string, purpose: string, exampleFoods: string }>}
 */
function buildMealPlan(mealsPerDay, goal, trainingDays) {
    const meals = [];
    const templates = {
        3: ['breakfast', 'lunch', 'dinner'],
        4: ['breakfast', 'lunch', 'dinner', 'snack'],
        5: ['breakfast', 'pre_workout', 'lunch', 'post_workout', 'dinner'],
        6: ['breakfast', 'snack', 'pre_workout', 'lunch', 'post_workout', 'dinner']
    };
    const slots = templates[mealsPerDay] || templates[4];
    const mealNames = {
        breakfast: 'Breakfast',
        pre_workout: 'Pre-Workout',
        post_workout: 'Post-Workout',
        lunch: 'Lunch',
        dinner: 'Dinner',
        snack: 'Snack'
    };
    for (const slot of slots) {
        const arr = MEAL_TEMPLATES[slot] || MEAL_TEMPLATES.snack;
        const t = arr[0] || { purpose: 'Balanced nutrition', exampleFoods: ['Whole foods, protein, vegetables'] };
        meals.push({
            mealName: mealNames[slot] || slot,
            purpose: t.purpose,
            exampleFoods: Array.isArray(t.exampleFoods) ? t.exampleFoods.join('; ') : String(t.exampleFoods || '')
        });
    }
    return meals;
}

/**
 * Build notes and warnings by goal and inputs.
 * @param {Object} input
 * @param {number} calories
 * @returns {{ notes: string[], warnings: string[] }}
 */
function buildNotesAndWarnings(input, calories) {
    const notes = [];
    const warnings = [];
    const { goal, diet, trainingDays } = input;

    notes.push('Prioritize protein at every meal (aim for 25–40g per meal).');
    notes.push('Eat whole foods 80% of the time; allow flexibility for the rest.');
    notes.push('Time carbs around training for energy and recovery.');
    notes.push('Include fiber-rich vegetables with lunch and dinner.');

    if (goal === 'fat_loss') {
        notes.push('Moderate deficit; avoid aggressive cuts to preserve muscle.');
        if (calories < 1500) warnings.push('Calories are low. Consider consulting a professional if you feel fatigued.');
    }
    if (goal === 'muscle_gain') {
        notes.push('Surplus supports muscle growth; monitor body fat to avoid excessive gain.');
    }
    if (goal === 'recomposition') {
        notes.push('Maintenance calories with adequate protein; progress may be slower but sustainable.');
    }
    if (diet === 'vegan' || diet === 'vegetarian') {
        notes.push('Ensure B12 and iron from fortified foods or supplements.');
    }
    if (diet === 'keto') {
        notes.push('Keep carbs under 50g; focus on fats and protein.');
    }
    if (trainingDays >= 5) {
        notes.push('Higher training volume: prioritize recovery nutrition and sleep.');
    }

    return { notes, warnings };
}

/**
 * Generate a structured nutrition plan.
 * @param {Object} rawInput - Raw form/assessment data (age, sex, height, weight, goal, activity, days, etc.)
 * @returns {Object} Nutrition plan
 */
export function generateNutritionPlan(rawInput) {
    const input = normalizeNutritionInput(rawInput);
    const { age, weight, height, sex, goal, activity, trainingDays } = input;

    const bmr = calculateBMR(weight, height, age, sex);
    const tdee = estimateTDEE(bmr, activity);
    const calories = getTargetCalories(tdee, goal);
    const proteinGrams = getProteinGrams(weight, goal);
    const macros = getMacros(calories, proteinGrams, goal);
    const mealsPerDay = getMealsPerDay(goal, trainingDays);
    const hydrationLiters = getHydrationLiters(weight, trainingDays);
    const mealPlan = buildMealPlan(mealsPerDay, goal, trainingDays);
    const { notes, warnings } = buildNotesAndWarnings(input, calories);

    return {
        calories,
        macros: {
            protein: macros.protein,
            carbs: macros.carbs,
            fats: macros.fats
        },
        mealsPerDay,
        hydrationLiters,
        mealPlan,
        notes,
        warnings
    };
}
