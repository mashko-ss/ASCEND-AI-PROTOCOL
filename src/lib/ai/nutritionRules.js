/**
 * ASCEND AI PROTOCOL - Nutrition Rules
 * Deterministic calorie estimation, macro calculation, meal count, hydration.
 * No OpenAI required. Fully offline.
 */

/** Activity multipliers for TDEE (Total Daily Energy Expenditure) */
const ACTIVITY_MULTIPLIERS = {
    sedentary: 1.2,
    lightly: 1.375,
    moderate: 1.55,
    highly: 1.725
};

/** Goal-specific calorie adjustments (added to TDEE) */
const CALORIE_ADJUSTMENTS = {
    fat_loss: -500,
    muscle_gain: 300,
    recomposition: 0,
    endurance: 100,
    strength: 200
};

/** Protein per kg bodyweight by goal */
const PROTEIN_PER_KG = {
    fat_loss: 2.2,
    muscle_gain: 2.0,
    recomposition: 2.0,
    endurance: 1.6,
    strength: 2.0
};

/** Fat % of total calories by goal */
const FAT_PERCENT = {
    fat_loss: 0.25,
    muscle_gain: 0.25,
    recomposition: 0.28,
    endurance: 0.25,
    strength: 0.25
};

/** Meals per day by goal and training days */
const MEALS_PER_DAY = {
    fat_loss: { min: 3, max: 5, default: 4 },
    muscle_gain: { min: 4, max: 6, default: 5 },
    recomposition: { min: 3, max: 5, default: 4 },
    endurance: { min: 4, max: 6, default: 5 },
    strength: { min: 4, max: 5, default: 4 }
};

/** Hydration: liters per kg bodyweight (base) */
const HYDRATION_L_PER_KG = 0.033;

/** Min/max hydration in liters */
const HYDRATION_LIMITS = { min: 2.0, max: 4.5 };

/**
 * Mifflin-St Jeor BMR formula.
 * @param {number} weightKg
 * @param {number} heightCm
 * @param {number} age
 * @param {string} sex - 'male' | 'female'
 * @returns {number} BMR in kcal
 */
export function calculateBMR(weightKg, heightCm, age, sex) {
    const w = Math.max(30, Math.min(300, weightKg));
    const h = Math.max(100, Math.min(250, heightCm));
    const a = Math.max(13, Math.min(120, age));
    if (sex === 'female') {
        return 10 * w + 6.25 * h - 5 * a - 161;
    }
    return 10 * w + 6.25 * h - 5 * a + 5;
}

/**
 * Estimate TDEE from BMR and activity.
 * @param {number} bmr
 * @param {string} activity - sedentary | lightly | moderate | highly
 * @returns {number} TDEE in kcal
 */
export function estimateTDEE(bmr, activity) {
    const mult = ACTIVITY_MULTIPLIERS[activity] ?? ACTIVITY_MULTIPLIERS.moderate;
    return Math.round(bmr * mult);
}

/**
 * Get target calories for goal.
 * @param {number} tdee
 * @param {string} goal - fat_loss | muscle_gain | recomposition | endurance | strength
 * @returns {number}
 */
export function getTargetCalories(tdee, goal) {
    const adj = CALORIE_ADJUSTMENTS[goal] ?? CALORIE_ADJUSTMENTS.recomposition;
    const raw = tdee + adj;
    return Math.max(1200, Math.min(4500, raw));
}

/**
 * Calculate protein grams from weight and goal.
 * @param {number} weightKg
 * @param {string} goal
 * @returns {number}
 */
export function getProteinGrams(weightKg, goal) {
    const perKg = PROTEIN_PER_KG[goal] ?? PROTEIN_PER_KG.recomposition;
    return Math.round(Math.max(80, Math.min(300, weightKg * perKg)));
}

/**
 * Calculate macros from calories, protein, and goal.
 * @param {number} calories
 * @param {number} proteinGrams
 * @param {string} goal
 * @returns {{ protein: number, carbs: number, fats: number }}
 */
export function getMacros(calories, proteinGrams, goal) {
    const protein = proteinGrams;
    const proteinCals = protein * 4;
    const fatPct = FAT_PERCENT[goal] ?? FAT_PERCENT.recomposition;
    const fatCals = Math.round(calories * fatPct);
    const fatGrams = Math.round(fatCals / 9);
    const remainingCals = calories - proteinCals - fatCals;
    const carbGrams = Math.max(0, Math.round(remainingCals / 4));
    return {
        protein,
        carbs: carbGrams,
        fats: fatGrams
    };
}

/**
 * Get recommended meals per day.
 * @param {string} goal
 * @param {number} trainingDaysPerWeek
 * @returns {number}
 */
export function getMealsPerDay(goal, trainingDaysPerWeek) {
    const cfg = MEALS_PER_DAY[goal] ?? MEALS_PER_DAY.recomposition;
    if (trainingDaysPerWeek >= 5) return Math.min(cfg.max, cfg.default + 1);
    return cfg.default;
}

/**
 * Get hydration target in liters.
 * @param {number} weightKg
 * @param {number} trainingDaysPerWeek
 * @returns {number}
 */
export function getHydrationLiters(weightKg, trainingDaysPerWeek) {
    const base = weightKg * HYDRATION_L_PER_KG;
    const extra = trainingDaysPerWeek >= 4 ? 0.3 : 0;
    const total = base + extra;
    return Math.round(Math.max(HYDRATION_LIMITS.min, Math.min(HYDRATION_LIMITS.max, total)) * 10) / 10;
}
