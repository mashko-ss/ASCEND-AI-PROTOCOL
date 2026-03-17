/**
 * ASCEND AI PROTOCOL - Nutrition Plan Generator
 * Phase 3: Deterministic nutrition generation. No OpenAI required.
 * Phase 14A: Strict diet constraints, validation, diet-appropriate meal pools.
 * Phase 14C: Nutrition adaptation memory integration.
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
import { parseNutritionConstraints, getMealPoolForSlot, validateMealPlan } from './nutritionConstraintEngine.js';
import { replaceInvalidMeals } from './mealRotationEngine.js';
import { createEmptyMemory, mealKey, pickBestMealFromPool, updateMemoryAfterPlan } from './nutritionAdaptationMemory.js';

/** Map raw goal strings to internal keys */
const GOAL_MAP = {
    fat_loss: 'fat_loss',
    muscle_gain: 'muscle_gain',
    recomp: 'recomposition',
    recomposition: 'recomposition',
    endurance: 'endurance',
    strength: 'strength'
};

const MEAL_NAMES = {
    breakfast: 'Breakfast',
    pre_workout: 'Pre-Workout',
    post_workout: 'Post-Workout',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack'
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
    return { age, weight, height, sex, goal, activity, trainingDays, experience, diet, ...raw };
}

/**
 * Build meal plan using diet-appropriate pools. Phase 14A: strict constraints.
 * Phase 14C: Memory-aware ranking for variety and reduced repetition.
 * @param {number} mealsPerDay
 * @param {string} goal
 * @param {number} trainingDays
 * @param {Object} constraints - From parseNutritionConstraints
 * @param {Object} [nutritionMemory] - Optional adaptation memory
 * @returns {Array<{ mealName: string, purpose: string, exampleFoods: string }>}
 */
function buildMealPlan(mealsPerDay, goal, trainingDays, constraints, nutritionMemory) {
    const meals = [];
    const templates = {
        3: ['breakfast', 'lunch', 'dinner'],
        4: ['breakfast', 'lunch', 'dinner', 'snack'],
        5: ['breakfast', 'pre_workout', 'lunch', 'post_workout', 'dinner'],
        6: ['breakfast', 'snack', 'pre_workout', 'lunch', 'post_workout', 'dinner']
    };
    const slots = templates[mealsPerDay] || templates[4];
    const dietType = constraints?.dietType || 'omnivore';
    const exclusions = constraints?.exclusions || [];
    const memory = nutritionMemory || createEmptyMemory();

    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const pool = getMealPoolForSlot(dietType, slot, exclusions);
        const selectedKeys = meals.map(m => mealKey(m));
        const ctxMemory = { ...memory, recentMeals: [...memory.recentMeals, ...selectedKeys] };
        const t = pickBestMealFromPool(pool, {
            currentMeal: null,
            slot,
            constraints,
            memory: ctxMemory
        }) || (pool.length > 0 ? pool[i % pool.length] : null) || {
            mealName: MEAL_NAMES[slot] || slot,
            purpose: 'Balanced nutrition',
            exampleFoods: 'Whole foods, protein, vegetables',
            estimatedCalories: 400,
            estimatedProtein: 25
        };
        const exampleFoods = Array.isArray(t.exampleFoods) ? t.exampleFoods.join('; ') : String(t.exampleFoods || '');
        meals.push({
            mealName: t.mealName || MEAL_NAMES[slot] || slot,
            purpose: t.purpose,
            exampleFoods,
            estimatedCalories: t.estimatedCalories,
            estimatedProtein: t.estimatedProtein
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
 * Phase 14A: Strict diet constraints, post-generation validation, auto-swap invalid meals.
 * Phase 14C: Memory-aware meal selection for variety.

 * @param {Object} rawInput - Raw form/assessment data (age, sex, height, weight, goal, activity, days, diet, allergies, etc.)
 * @param {Object} [options] - Optional { nutritionMemory }
 * @returns {Object} Nutrition plan with mealPlan, nutritionMemory, adaptationNotes
 */
export function generateNutritionPlan(rawInput, options = {}) {
    const input = normalizeNutritionInput(rawInput);
    const { age, weight, height, sex, goal, activity, trainingDays } = input;

    const constraints = parseNutritionConstraints(rawInput);
    const nutritionMemory = options.nutritionMemory || rawInput.nutritionMemory || createEmptyMemory();

    const bmr = calculateBMR(weight, height, age, sex);
    const tdee = estimateTDEE(bmr, activity);
    const calories = getTargetCalories(tdee, goal);
    const proteinGrams = getProteinGrams(weight, goal);
    const macros = getMacros(calories, proteinGrams, goal);
    let mealsPerDay = getMealsPerDay(goal, trainingDays);
    if (constraints.mealCountPreference != null) {
        const pref = parseInt(constraints.mealCountPreference, 10);
        if (pref >= 3 && pref <= 6) mealsPerDay = pref;
    }
    const hydrationLiters = getHydrationLiters(weight, trainingDays);
    let mealPlan = buildMealPlan(mealsPerDay, goal, trainingDays, constraints, nutritionMemory);

    const adaptationNotes = [];
    const validation = validateMealPlan(mealPlan, constraints);
    if (!validation.valid) {
        const { mealPlan: fixed } = replaceInvalidMeals(mealPlan, constraints, { nutritionMemory });
        mealPlan = fixed;
        adaptationNotes.push('Some meals were swapped to meet dietary constraints.');
    }

    updateMemoryAfterPlan(nutritionMemory, mealPlan);
    if (nutritionMemory.dislikedMeals?.length || nutritionMemory.dislikedIngredients?.length) {
        adaptationNotes.push('Disliked items were avoided in meal selection.');
    }
    if (Object.keys(nutritionMemory.boredomSignals || {}).length > 0) {
        adaptationNotes.push('Previously flagged meals were deprioritized for variety.');
    }

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
        warnings,
        nutritionMemory,
        adaptationNotes
    };
}
