/**
 * ASCEND AI PROTOCOL - Meal Rotation / Swap Engine
 * Phase 14A: Swap meals within type (breakfast↔breakfast, lunch↔lunch) while
 * preserving calories, macros, dietary restrictions, and simplicity.
 * Phase 14C: Memory-aware replacement - avoid recent/disliked, prefer novelty.
 */

import { validateMealPlan, checkMealAgainstConstraints, getMealPoolForSlot } from './nutritionConstraintEngine.js';
import { createEmptyMemory, mealKey, pickBestMealFromPool, updateMemoryAfterPlan } from './nutritionAdaptationMemory.js';

/**
 * Infer slot from meal name.
 * @param {string} mealName
 * @returns {string}
 */
function inferSlot(mealName) {
    const n = String(mealName || '').toLowerCase();
    if (n.includes('breakfast')) return 'breakfast';
    if (n.includes('pre-workout') || n.includes('pre workout')) return 'pre_workout';
    if (n.includes('post-workout') || n.includes('post workout')) return 'post_workout';
    if (n.includes('lunch')) return 'lunch';
    if (n.includes('dinner')) return 'dinner';
    return 'snack';
}

/** Calorie tolerance for swap (within ±15%) */
const CALORIE_TOLERANCE_PCT = 0.15;

/** Protein tolerance (grams) */
const PROTEIN_TOLERANCE = 10;

/**
 * Check if a replacement meal is within acceptable calorie/macro range.
 * @param {Object} current - Current meal with estimatedCalories, estimatedProtein
 * @param {Object} replacement - Replacement meal
 * @returns {boolean}
 */
function withinMacroRange(current, replacement) {
    const currCal = current?.estimatedCalories ?? 400;
    const replCal = replacement?.estimatedCalories ?? 400;
    const calOk = Math.abs(replCal - currCal) <= currCal * CALORIE_TOLERANCE_PCT;
    const currPro = current?.estimatedProtein ?? 20;
    const replPro = replacement?.estimatedProtein ?? 20;
    const proOk = Math.abs(replPro - currPro) <= PROTEIN_TOLERANCE;
    return calOk && proOk;
}

/**
 * Replace a single meal in the plan.
 * Phase 14C: Uses memory to avoid recently used/disliked meals, prefer novelty.
 * @param {Array} mealPlan - Full meal plan
 * @param {number} index - Index of meal to replace
 * @param {Object} constraints - From parseNutritionConstraints
 * @param {Object} [options]
 * @param {string} [options.reason] - "bored", "replace", "variety", "rotate"
 * @param {Object} [options.nutritionMemory] - Optional adaptation memory
 * @returns {{ success: boolean, mealPlan: Array, replacement?: Object, nutritionMemory?: Object, adaptationNotes?: string[], error?: string }}
 */
export function replaceMeal(mealPlan, index, constraints, options = {}) {
    if (!Array.isArray(mealPlan) || index < 0 || index >= mealPlan.length) {
        return { success: false, mealPlan, error: 'Invalid meal plan or index' };
    }

    const meal = mealPlan[index];
    const slot = inferSlot(meal.mealName);
    const dietType = constraints?.dietType || 'omnivore';
    const exclusions = constraints?.exclusions || [];
    const nutritionMemory = options.nutritionMemory || createEmptyMemory();

    const pool = getMealPoolForSlot(dietType, slot, exclusions);
    if (!pool.length) {
        return { success: false, mealPlan, error: `No compatible ${slot} options for your diet` };
    }

    const candidates = pool.filter(m => {
        if (!mealPassesExclusions(m, exclusions)) return false;
        const { valid } = checkMealAgainstConstraints(
            [m.exampleFoods, m.purpose].join(' '),
            constraints
        );
        if (!valid) return false;
        return withinMacroRange(meal, m);
    });

    if (!candidates.length) {
        const fallback = pool.find(m => mealPassesExclusions(m, exclusions));
        if (!fallback) return { success: false, mealPlan, error: 'No compatible replacement found' };
        const newPlan = [...mealPlan];
        newPlan[index] = { ...fallback };
        if (!options.skipMemoryUpdate) {
            updateMemoryAfterPlan(nutritionMemory, newPlan, { replacement: { from: meal, to: fallback, index } });
        }
        return {
            success: true,
            mealPlan: newPlan,
            replacement: fallback,
            nutritionMemory,
            adaptationNotes: ['Replaced with fallback due to macro constraints.']
        };
    }

    const replacement = pickBestMealFromPool(candidates, {
        currentMeal: meal,
        slot,
        constraints,
        memory: nutritionMemory
    }) || candidates[Math.floor(Math.random() * candidates.length)];

    const newPlan = [...mealPlan];
    newPlan[index] = { ...replacement };

    if (!options.skipMemoryUpdate) {
        updateMemoryAfterPlan(nutritionMemory, newPlan, { replacement: { from: meal, to: replacement, index } });
    }

    const adaptationNotes = [];
    if (options.reason === 'bored') adaptationNotes.push('Swapped bored meal for variety.');
    else if (options.reason === 'rotate') adaptationNotes.push('Rotated for weekly variety.');
    else adaptationNotes.push('Meal replaced; avoided recent and disliked options.');

    return {
        success: true,
        mealPlan: newPlan,
        replacement,
        nutritionMemory,
        adaptationNotes
    };
}

function mealPassesExclusions(meal, exclusions) {
    if (!exclusions?.length) return true;
    const text = [meal.exampleFoods, meal.purpose].filter(Boolean).join(' ').toLowerCase();
    const forbidden = {
        dairy: ['milk', 'cheese', 'yogurt', 'cream', 'butter', 'whey', 'cottage cheese', 'greek yogurt'],
        eggs: ['egg', 'eggs'],
        gluten: ['wheat', 'barley', 'rye', 'bread', 'pasta'],
        nuts: ['almond', 'walnut', 'cashew', 'peanut', 'pecan', 'pistachio', 'nut butter', 'peanut butter'],
        shellfish: ['shrimp', 'crab', 'lobster', 'scallop', 'mussel', 'clam', 'oyster'],
        soy: ['soy', 'tofu', 'tempeh', 'edamame', 'soy milk']
    };
    for (const cat of exclusions) {
        const patterns = forbidden[cat] || [];
        for (const p of patterns) {
            if (text.includes(p)) return false;
        }
    }
    return true;
}

/**
 * Rotate all meals in the plan for variety.
 * Phase 14C: Memory-aware - considers repetition and boredom when rotating.
 * @param {Array} mealPlan
 * @param {Object} constraints
 * @param {Object} [options]
 * @param {boolean} [options.preserveSimplicity] - Prefer simple meals if user chose simple
 * @param {Object} [options.nutritionMemory] - Optional adaptation memory
 * @returns {{ success: boolean, mealPlan: Array, rotations: number, nutritionMemory?: Object, adaptationNotes?: string[] }}
 */
export function rotateMeals(mealPlan, constraints, options = {}) {
    if (!Array.isArray(mealPlan) || mealPlan.length === 0) {
        return { success: false, mealPlan: mealPlan || [], rotations: 0 };
    }

    let newPlan = [...mealPlan];
    let rotations = 0;
    let nutritionMemory = options.nutritionMemory || createEmptyMemory();
    const adaptationNotes = [];

    for (let i = 0; i < newPlan.length; i++) {
        const result = replaceMeal(newPlan, i, constraints, {
            reason: 'rotate',
            nutritionMemory
        });
        if (result.success && result.replacement) {
            newPlan = result.mealPlan;
            nutritionMemory = result.nutritionMemory || nutritionMemory;
            if (result.adaptationNotes?.length) {
                adaptationNotes.push(...result.adaptationNotes);
            }
            rotations++;
        }
    }

    if (rotations > 0) {
        adaptationNotes.unshift(`Rotated ${rotations} meal(s) for variety; avoided recent and disliked options.`);
    }

    return {
        success: true,
        mealPlan: newPlan,
        rotations,
        nutritionMemory,
        adaptationNotes: [...new Set(adaptationNotes)]
    };
}

/**
 * Replace invalid meals in a plan with valid alternatives.
 * Phase 14C: Passes nutritionMemory when provided for memory-aware swaps.
 * @param {Array} mealPlan
 * @param {Object} constraints
 * @param {Object} [options]
 * @param {Object} [options.nutritionMemory] - Optional adaptation memory
 * @returns {{ mealPlan: Array, replaced: number, invalidIndices: number[], nutritionMemory?: Object }}
 */
export function replaceInvalidMeals(mealPlan, constraints, options = {}) {
    const validation = validateMealPlan(mealPlan, constraints);
    if (validation.valid) return { mealPlan, replaced: 0, invalidIndices: [] };

    let newPlan = [...mealPlan];
    const invalidIndices = validation.invalidMeals.map(m => m.index).sort((a, b) => b - a);
    let nutritionMemory = options.nutritionMemory || createEmptyMemory();

    for (const idx of invalidIndices) {
        const result = replaceMeal(newPlan, idx, constraints, {
            reason: 'invalid',
            nutritionMemory,
            skipMemoryUpdate: true
        });
        if (result.success) {
            newPlan = result.mealPlan;
            nutritionMemory = result.nutritionMemory || nutritionMemory;
        }
    }

    return {
        mealPlan: newPlan,
        replaced: invalidIndices.length,
        invalidIndices,
        nutritionMemory
    };
}
