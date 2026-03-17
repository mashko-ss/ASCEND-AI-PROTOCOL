/**
 * ASCEND AI PROTOCOL - Nutrition Constraint Engine
 * Phase 14A: Strict validation of meal plans against dietary answers.
 * Vegan never gets animal products. Vegetarian never gets meat/fish.
 * Excluded foods never appear. Post-generation validation + auto-swap.
 */

/** Diet types supported */
export const DIET_TYPES = ['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'gluten_free', 'keto'];

/** Exclusion categories (allergies, intolerances, preferences) */
export const EXCLUSION_CATEGORIES = ['dairy', 'eggs', 'gluten', 'nuts', 'shellfish', 'soy'];

/** Forbidden ingredient patterns by diet type. Match against meal text (lowercase). */
const DIET_FORBIDDEN_PATTERNS = {
    vegan: [
        'chicken', 'beef', 'pork', 'lamb', 'turkey', 'meat', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster',
        'egg', 'eggs', 'dairy', 'milk', 'cheese', 'yogurt', 'whey', 'honey', 'gelatin', 'bacon', 'ham'
    ],
    vegetarian: [
        'chicken', 'beef', 'pork', 'lamb', 'turkey', 'meat', 'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster',
        'bacon', 'ham', 'gelatin'
    ],
    pescatarian: [
        'chicken', 'beef', 'pork', 'lamb', 'turkey', 'meat', 'bacon', 'ham', 'gelatin'
    ],
    gluten_free: [
        'wheat', 'barley', 'rye', 'bread', 'pasta', 'couscous', 'bulgur', 'seitan', 'malt'
    ],
    keto: [] // keto restricts carbs by macro, not by ingredient; handled separately
};

/** Forbidden patterns by exclusion category */
const EXCLUSION_FORBIDDEN_PATTERNS = {
    dairy: ['milk', 'cheese', 'yogurt', 'cream', 'butter', 'whey', 'cottage cheese', 'greek yogurt'],
    eggs: ['egg', 'eggs'],
    gluten: ['wheat', 'barley', 'rye', 'bread', 'pasta', 'couscous', 'bulgur', 'seitan', 'malt', 'flour'],
    nuts: ['almond', 'walnut', 'cashew', 'peanut', 'pecan', 'pistachio', 'nut butter', 'peanut butter'],
    shellfish: ['shrimp', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster'],
    soy: ['soy', 'tofu', 'tempeh', 'edamame', 'soy milk']
};

/** Map UI diet values to engine diet types */
const DIET_MAP = {
    standard: 'omnivore',
    balanced: 'omnivore',
    omnivore: 'omnivore',
    vegan: 'vegan',
    vegetarian: 'vegetarian',
    pescatarian: 'pescatarian',
    gluten_free: 'gluten_free',
    keto: 'keto'
};

/**
 * Parse nutrition constraints from raw input.
 * @param {Object} raw - Raw form/assessment data
 * @returns {Object} { dietType, exclusions, dislikes, mealCountPreference, budgetSensitive, simpleMeals }
 */
export function parseNutritionConstraints(raw) {
    if (!raw || typeof raw !== 'object') raw = {};

    const dietRaw = String(raw.diet || raw.dietType || 'standard').toLowerCase().trim();
    const dietType = DIET_MAP[dietRaw] || 'omnivore';

    let exclusions = new Set();
    const allergiesRaw = String(raw.allergies || raw.exclusions || 'none').toLowerCase();
    if (allergiesRaw && allergiesRaw !== 'none') {
        allergiesRaw.split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(x => {
            if (EXCLUSION_CATEGORIES.includes(x)) exclusions.add(x);
        });
    }

    const dislikes = Array.isArray(raw.dislikes) ? raw.dislikes : [];
    const mealCountPreference = raw.mealCountPreference ?? raw.meals_per_day ?? raw.mealsPerDay ?? null;
    const budgetSensitive = raw.budgetSensitive ?? raw.budget_sensitive ?? false;
    const simpleMeals = raw.simpleMeals ?? raw.simple_meals ?? raw.lowCookingComplexity ?? false;
    const repetitionTolerance = raw.repetitionTolerance ?? raw.repetition_tolerance ?? 'moderate';

    return {
        dietType,
        exclusions: Array.from(exclusions),
        dislikes,
        mealCountPreference,
        budgetSensitive,
        simpleMeals,
        repetitionTolerance
    };
}

/**
 * Check if a food/ingredient string violates constraints.
 * @param {string} text - Meal or ingredient text
 * @param {Object} constraints - From parseNutritionConstraints
 * @returns {{ valid: boolean, violations: string[] }}
 */
export function checkMealAgainstConstraints(text, constraints) {
    const violations = [];
    if (!text || typeof text !== 'string') return { valid: true, violations };

    const lower = text.toLowerCase();

    const dietType = constraints?.dietType || 'omnivore';
    const forbiddenByDiet = DIET_FORBIDDEN_PATTERNS[dietType] || [];
    for (const pattern of forbiddenByDiet) {
        if (lower.includes(pattern)) {
            violations.push(`Diet (${dietType}): contains ${pattern}`);
        }
    }

    const exclusions = constraints?.exclusions || [];
    for (const cat of exclusions) {
        const patterns = EXCLUSION_FORBIDDEN_PATTERNS[cat] || [];
        for (const pattern of patterns) {
            if (lower.includes(pattern)) {
                violations.push(`Exclusion (${cat}): contains ${pattern}`);
            }
        }
    }

    const dislikes = constraints?.dislikes || [];
    for (const d of dislikes) {
        if (d && lower.includes(String(d).toLowerCase())) {
            violations.push(`Dislike: contains ${d}`);
        }
    }

    return {
        valid: violations.length === 0,
        violations
    };
}

/**
 * Validate a full meal plan against constraints.
 * @param {Array} mealPlan - Array of { mealName, purpose, exampleFoods }
 * @param {Object} constraints
 * @returns {{ valid: boolean, invalidMeals: Array<{ index: number, meal: Object, violations: string[] }> }}
 */
export function validateMealPlan(mealPlan, constraints) {
    const invalidMeals = [];

    if (!Array.isArray(mealPlan)) return { valid: true, invalidMeals };

    for (let i = 0; i < mealPlan.length; i++) {
        const meal = mealPlan[i];
        const text = [
            meal.mealName,
            meal.purpose,
            meal.exampleFoods,
            Array.isArray(meal.exampleFoods) ? meal.exampleFoods.join(' ') : ''
        ].filter(Boolean).join(' ');

        const { valid, violations } = checkMealAgainstConstraints(text, constraints);
        if (!valid && violations.length > 0) {
            invalidMeals.push({ index: i, meal, violations });
        }
    }

    return {
        valid: invalidMeals.length === 0,
        invalidMeals
    };
}

/**
 * Get diet-appropriate meal templates by meal type.
 * Each template has: mealName, purpose, exampleFoods (string or array), estimatedCalories, estimatedProtein.
 */
const DIET_MEAL_POOLS = {
    omnivore: {
        breakfast: [
            { mealName: 'Breakfast', purpose: 'Energy and protein to start the day', exampleFoods: 'Oats, eggs, Greek yogurt, berries, whole-grain toast', estimatedCalories: 450, estimatedProtein: 25 },
            { mealName: 'Breakfast', purpose: 'Sustained energy', exampleFoods: 'Oatmeal with nuts, scrambled eggs, banana', estimatedCalories: 420, estimatedProtein: 22 },
            { mealName: 'Breakfast', purpose: 'High-protein start', exampleFoods: 'Eggs, avocado, whole-grain bread, fruit', estimatedCalories: 480, estimatedProtein: 28 }
        ],
        lunch: [
            { mealName: 'Lunch', purpose: 'Balanced midday nutrition', exampleFoods: 'Lean chicken, quinoa, salad, olive oil', estimatedCalories: 520, estimatedProtein: 35 },
            { mealName: 'Lunch', purpose: 'Protein and fiber', exampleFoods: 'Turkey wrap, lentils, vegetables', estimatedCalories: 480, estimatedProtein: 32 },
            { mealName: 'Lunch', purpose: 'Light and filling', exampleFoods: 'Grilled chicken salad, rice, vegetables', estimatedCalories: 500, estimatedProtein: 38 }
        ],
        dinner: [
            { mealName: 'Dinner', purpose: 'Evening satiety and recovery', exampleFoods: 'Salmon, vegetables, rice or potato', estimatedCalories: 550, estimatedProtein: 40 },
            { mealName: 'Dinner', purpose: 'Complete protein and veggies', exampleFoods: 'Lean beef, broccoli, brown rice', estimatedCalories: 560, estimatedProtein: 42 },
            { mealName: 'Dinner', purpose: 'Balanced evening meal', exampleFoods: 'Chicken, sweet potato, greens', estimatedCalories: 520, estimatedProtein: 38 }
        ],
        snack: [
            { mealName: 'Snack', purpose: 'Between-meal protein', exampleFoods: 'Greek yogurt, nuts, protein bar, fruit', estimatedCalories: 200, estimatedProtein: 15 },
            { mealName: 'Snack', purpose: 'Bridge to next meal', exampleFoods: 'Cottage cheese, almonds, apple with peanut butter', estimatedCalories: 220, estimatedProtein: 18 }
        ],
        pre_workout: [
            { mealName: 'Pre-Workout', purpose: 'Fuel for training', exampleFoods: 'Banana, rice cakes, whey shake, light carbs', estimatedCalories: 250, estimatedProtein: 15 },
            { mealName: 'Pre-Workout', purpose: 'Pre-training energy', exampleFoods: 'Oats + banana, toast + honey, 60–90 min before', estimatedCalories: 280, estimatedProtein: 12 }
        ],
        post_workout: [
            { mealName: 'Post-Workout', purpose: 'Recovery and muscle repair', exampleFoods: 'Chicken + rice + vegetables, whey + banana', estimatedCalories: 520, estimatedProtein: 40 },
            { mealName: 'Post-Workout', purpose: 'Protein and carbs for recovery', exampleFoods: 'Grilled chicken, rice, broccoli; or protein shake + oats', estimatedCalories: 500, estimatedProtein: 38 }
        ]
    },
    vegan: {
        breakfast: [
            { mealName: 'Breakfast', purpose: 'Plant-based energy', exampleFoods: 'Oatmeal with berries, chia seeds, plant milk', estimatedCalories: 380, estimatedProtein: 12 },
            { mealName: 'Breakfast', purpose: 'Sustained energy', exampleFoods: 'Tofu scramble, avocado, whole-grain toast', estimatedCalories: 420, estimatedProtein: 18 },
            { mealName: 'Breakfast', purpose: 'High-fiber start', exampleFoods: 'Smoothie with plant protein, banana, spinach, oats', estimatedCalories: 350, estimatedProtein: 20 }
        ],
        lunch: [
            { mealName: 'Lunch', purpose: 'Balanced plant-based midday', exampleFoods: 'Lentil salad, quinoa, vegetables, tahini', estimatedCalories: 480, estimatedProtein: 22 },
            { mealName: 'Lunch', purpose: 'Protein and fiber', exampleFoods: 'Chickpea wrap, hummus, greens', estimatedCalories: 450, estimatedProtein: 18 },
            { mealName: 'Lunch', purpose: 'Light and filling', exampleFoods: 'Tempeh bowl, brown rice, roasted vegetables', estimatedCalories: 500, estimatedProtein: 25 }
        ],
        dinner: [
            { mealName: 'Dinner', purpose: 'Evening satiety', exampleFoods: 'Lentil curry, rice, vegetables', estimatedCalories: 520, estimatedProtein: 24 },
            { mealName: 'Dinner', purpose: 'Complete plant protein', exampleFoods: 'Black bean tacos, avocado, salsa', estimatedCalories: 480, estimatedProtein: 22 },
            { mealName: 'Dinner', purpose: 'Balanced evening', exampleFoods: 'Tofu stir-fry, rice, broccoli', estimatedCalories: 500, estimatedProtein: 28 }
        ],
        snack: [
            { mealName: 'Snack', purpose: 'Plant-based protein', exampleFoods: 'Hummus, vegetables, rice cakes', estimatedCalories: 180, estimatedProtein: 8 },
            { mealName: 'Snack', purpose: 'Bridge to next meal', exampleFoods: 'Fruit, plant protein shake, nuts (if not excluded)', estimatedCalories: 200, estimatedProtein: 15 }
        ],
        pre_workout: [
            { mealName: 'Pre-Workout', purpose: 'Plant-based fuel', exampleFoods: 'Banana, rice cakes, plant protein shake', estimatedCalories: 250, estimatedProtein: 15 },
            { mealName: 'Pre-Workout', purpose: 'Pre-training energy', exampleFoods: 'Oats + banana, dates, 60–90 min before', estimatedCalories: 280, estimatedProtein: 8 }
        ],
        post_workout: [
            { mealName: 'Post-Workout', purpose: 'Plant-based recovery', exampleFoods: 'Lentils + rice + vegetables, plant protein + banana', estimatedCalories: 500, estimatedProtein: 30 },
            { mealName: 'Post-Workout', purpose: 'Protein and carbs', exampleFoods: 'Tofu, quinoa, broccoli; or plant shake + oats', estimatedCalories: 520, estimatedProtein: 32 }
        ]
    },
    vegetarian: {
        breakfast: [
            { mealName: 'Breakfast', purpose: 'Energy and protein', exampleFoods: 'Oats, eggs, Greek yogurt, berries, toast', estimatedCalories: 450, estimatedProtein: 25 },
            { mealName: 'Breakfast', purpose: 'Sustained energy', exampleFoods: 'Oatmeal, scrambled eggs, banana', estimatedCalories: 420, estimatedProtein: 22 },
            { mealName: 'Breakfast', purpose: 'High-protein start', exampleFoods: 'Eggs, avocado, whole-grain bread, fruit', estimatedCalories: 480, estimatedProtein: 28 }
        ],
        lunch: [
            { mealName: 'Lunch', purpose: 'Balanced midday', exampleFoods: 'Lentil soup, quinoa, salad, olive oil', estimatedCalories: 480, estimatedProtein: 24 },
            { mealName: 'Lunch', purpose: 'Protein and fiber', exampleFoods: 'Chickpea salad, vegetables, cheese (if allowed)', estimatedCalories: 450, estimatedProtein: 20 },
            { mealName: 'Lunch', purpose: 'Light and filling', exampleFoods: 'Vegetarian wrap, lentils, vegetables', estimatedCalories: 460, estimatedProtein: 22 }
        ],
        dinner: [
            { mealName: 'Dinner', purpose: 'Evening satiety', exampleFoods: 'Paneer curry, rice, vegetables', estimatedCalories: 520, estimatedProtein: 28 },
            { mealName: 'Dinner', purpose: 'Complete protein', exampleFoods: 'Lentil dal, rice, greens', estimatedCalories: 500, estimatedProtein: 24 },
            { mealName: 'Dinner', purpose: 'Balanced evening', exampleFoods: 'Egg curry, rice, vegetables', estimatedCalories: 510, estimatedProtein: 26 }
        ],
        snack: [
            { mealName: 'Snack', purpose: 'Between-meal protein', exampleFoods: 'Greek yogurt, nuts, fruit', estimatedCalories: 200, estimatedProtein: 15 },
            { mealName: 'Snack', purpose: 'Bridge to next meal', exampleFoods: 'Cottage cheese, almonds, apple', estimatedCalories: 220, estimatedProtein: 18 }
        ],
        pre_workout: [
            { mealName: 'Pre-Workout', purpose: 'Fuel for training', exampleFoods: 'Banana, rice cakes, whey or plant protein', estimatedCalories: 250, estimatedProtein: 15 },
            { mealName: 'Pre-Workout', purpose: 'Pre-training energy', exampleFoods: 'Oats + banana, toast + honey', estimatedCalories: 280, estimatedProtein: 12 }
        ],
        post_workout: [
            { mealName: 'Post-Workout', purpose: 'Recovery', exampleFoods: 'Lentils + rice + vegetables, protein shake + banana', estimatedCalories: 520, estimatedProtein: 35 },
            { mealName: 'Post-Workout', purpose: 'Protein and carbs', exampleFoods: 'Eggs, quinoa, broccoli; or shake + oats', estimatedCalories: 500, estimatedProtein: 32 }
        ]
    },
    pescatarian: {
        breakfast: [
            { mealName: 'Breakfast', purpose: 'Energy and protein', exampleFoods: 'Oats, eggs, Greek yogurt, berries, toast', estimatedCalories: 450, estimatedProtein: 25 },
            { mealName: 'Breakfast', purpose: 'Sustained energy', exampleFoods: 'Oatmeal, scrambled eggs, banana', estimatedCalories: 420, estimatedProtein: 22 }
        ],
        lunch: [
            { mealName: 'Lunch', purpose: 'Balanced midday', exampleFoods: 'Tuna salad, quinoa, vegetables', estimatedCalories: 480, estimatedProtein: 35 },
            { mealName: 'Lunch', purpose: 'Protein and fiber', exampleFoods: 'Salmon wrap, lentils, greens', estimatedCalories: 500, estimatedProtein: 38 }
        ],
        dinner: [
            { mealName: 'Dinner', purpose: 'Evening satiety', exampleFoods: 'Salmon, vegetables, rice or potato', estimatedCalories: 550, estimatedProtein: 40 },
            { mealName: 'Dinner', purpose: 'Complete protein', exampleFoods: 'Grilled fish, broccoli, quinoa', estimatedCalories: 520, estimatedProtein: 38 }
        ],
        snack: [
            { mealName: 'Snack', purpose: 'Between-meal protein', exampleFoods: 'Greek yogurt, nuts, fruit', estimatedCalories: 200, estimatedProtein: 15 }
        ],
        pre_workout: [
            { mealName: 'Pre-Workout', purpose: 'Fuel for training', exampleFoods: 'Banana, rice cakes, light carbs', estimatedCalories: 250, estimatedProtein: 10 }
        ],
        post_workout: [
            { mealName: 'Post-Workout', purpose: 'Recovery', exampleFoods: 'Salmon + rice + vegetables, or protein shake + banana', estimatedCalories: 520, estimatedProtein: 40 }
        ]
    },
    gluten_free: {
        breakfast: [
            { mealName: 'Breakfast', purpose: 'Energy and protein', exampleFoods: 'Oats (certified GF), eggs, yogurt, berries', estimatedCalories: 420, estimatedProtein: 24 },
            { mealName: 'Breakfast', purpose: 'Sustained energy', exampleFoods: 'Scrambled eggs, avocado, fruit', estimatedCalories: 400, estimatedProtein: 22 }
        ],
        lunch: [
            { mealName: 'Lunch', purpose: 'Balanced midday', exampleFoods: 'Chicken, quinoa, salad, olive oil', estimatedCalories: 500, estimatedProtein: 35 },
            { mealName: 'Lunch', purpose: 'Protein and fiber', exampleFoods: 'Turkey, rice, vegetables', estimatedCalories: 480, estimatedProtein: 32 }
        ],
        dinner: [
            { mealName: 'Dinner', purpose: 'Evening satiety', exampleFoods: 'Fish, vegetables, rice or potato', estimatedCalories: 520, estimatedProtein: 38 },
            { mealName: 'Dinner', purpose: 'Complete protein', exampleFoods: 'Lean meat, broccoli, quinoa', estimatedCalories: 530, estimatedProtein: 40 }
        ],
        snack: [
            { mealName: 'Snack', purpose: 'Between-meal protein', exampleFoods: 'Greek yogurt, nuts, fruit, rice cakes', estimatedCalories: 200, estimatedProtein: 15 }
        ],
        pre_workout: [
            { mealName: 'Pre-Workout', purpose: 'Fuel for training', exampleFoods: 'Banana, rice cakes (GF), light carbs', estimatedCalories: 250, estimatedProtein: 10 }
        ],
        post_workout: [
            { mealName: 'Post-Workout', purpose: 'Recovery', exampleFoods: 'Chicken + rice + vegetables, or shake + banana', estimatedCalories: 510, estimatedProtein: 38 }
        ]
    },
    keto: {
        breakfast: [
            { mealName: 'Breakfast', purpose: 'High-fat, low-carb start', exampleFoods: 'Eggs, avocado, bacon, spinach', estimatedCalories: 450, estimatedProtein: 28 },
            { mealName: 'Breakfast', purpose: 'Keto energy', exampleFoods: 'Omelet with cheese, mushrooms, olive oil', estimatedCalories: 480, estimatedProtein: 30 }
        ],
        lunch: [
            { mealName: 'Lunch', purpose: 'Low-carb midday', exampleFoods: 'Chicken salad, olive oil, avocado', estimatedCalories: 520, estimatedProtein: 40 },
            { mealName: 'Lunch', purpose: 'Protein and fat', exampleFoods: 'Salmon, leafy greens, butter', estimatedCalories: 500, estimatedProtein: 38 }
        ],
        dinner: [
            { mealName: 'Dinner', purpose: 'Evening satiety', exampleFoods: 'Steak, broccoli, butter', estimatedCalories: 560, estimatedProtein: 45 },
            { mealName: 'Dinner', purpose: 'Complete protein', exampleFoods: 'Chicken thighs, cauliflower, olive oil', estimatedCalories: 540, estimatedProtein: 42 }
        ],
        snack: [
            { mealName: 'Snack', purpose: 'Keto-friendly', exampleFoods: 'Cheese, olives, nuts, beef jerky', estimatedCalories: 200, estimatedProtein: 15 }
        ],
        pre_workout: [
            { mealName: 'Pre-Workout', purpose: 'Minimal carbs', exampleFoods: 'Black coffee, MCT oil, or small portion of nuts', estimatedCalories: 150, estimatedProtein: 5 }
        ],
        post_workout: [
            { mealName: 'Post-Workout', purpose: 'Recovery', exampleFoods: 'Chicken, leafy greens, avocado, olive oil', estimatedCalories: 520, estimatedProtein: 42 }
        ]
    }
};

/**
 * Filter a meal template by exclusions (dairy-free, egg-free, etc.).
 * @param {Object} meal
 * @param {string[]} exclusions
 * @returns {boolean} true if meal is compatible
 */
function mealPassesExclusions(meal, exclusions) {
    if (!exclusions?.length) return true;
    const text = [meal.exampleFoods, meal.purpose].filter(Boolean).join(' ').toLowerCase();
    for (const cat of exclusions) {
        const patterns = EXCLUSION_FORBIDDEN_PATTERNS[cat] || [];
        for (const p of patterns) {
            if (text.includes(p)) return false;
        }
    }
    return true;
}

/**
 * Get diet-appropriate meal pool for a slot, filtered by exclusions.
 * @param {string} dietType
 * @param {string} slot - breakfast, lunch, dinner, snack, pre_workout, post_workout
 * @param {string[]} exclusions
 * @returns {Array}
 */
export function getMealPoolForSlot(dietType, slot, exclusions = []) {
    const pool = DIET_MEAL_POOLS[dietType] || DIET_MEAL_POOLS.omnivore;
    const slotPool = pool[slot] || pool.snack;
    return slotPool.filter(m => mealPassesExclusions(m, exclusions));
}
