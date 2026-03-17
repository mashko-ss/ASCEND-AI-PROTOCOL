/**
 * ASCEND AI PROTOCOL - Nutrition Adaptation Memory
 * Phase 14C: Memory structure for meal plan evolution based on repetition,
 * boredom signals, dislikes, and replacement history.
 * Persists per user (structure only; storage implementation is caller's responsibility).
 */

/** Max recent meals to track */
const RECENT_MEALS_CAP = 24;

/** Max replacement history entries */
const REPLACEMENT_HISTORY_CAP = 20;

/**
 * Create empty nutrition memory structure.
 * @returns {Object}
 */
export function createEmptyMemory() {
    return {
        recentMeals: [],
        repetitionMap: {},
        dislikedMeals: [],
        dislikedIngredients: [],
        boredomSignals: {},
        replacementHistory: []
    };
}

/**
 * Get stable meal key for identification.
 * @param {Object} meal - { mealName, exampleFoods, ... }
 * @returns {string}
 */
export function mealKey(meal) {
    if (!meal) return '';
    const ex = Array.isArray(meal.exampleFoods)
        ? meal.exampleFoods.join(' ')
        : String(meal.exampleFoods || '');
    return `${String(meal.mealName || '').toLowerCase()}|${ex.toLowerCase().trim()}`.trim();
}

/**
 * Compute meal score for ranking candidates.
 * score = compatibilityScore + macroFitScore + noveltyScore - repetitionPenalty - boredomPenalty - dislikePenalty
 * @param {Object} meal - Candidate meal
 * @param {Object} context - { currentMeal, slot, constraints, memory }
 * @returns {number}
 */
export function scoreMeal(meal, context) {
    const { currentMeal, slot, constraints, memory } = context;
    const mem = memory || createEmptyMemory();
    const key = mealKey(meal);

    let compatibilityScore = 10; // Base: passes constraints
    let macroFitScore = 0;
    let noveltyScore = 0;
    let repetitionPenalty = 0;
    let boredomPenalty = 0;
    let dislikePenalty = 0;

    // Macro fit (0–5): closer to current meal = higher
    if (currentMeal) {
        const currCal = currentMeal.estimatedCalories ?? 400;
        const currPro = currentMeal.estimatedProtein ?? 20;
        const mealCal = meal.estimatedCalories ?? 400;
        const mealPro = meal.estimatedProtein ?? 20;
        const calDiff = Math.abs(mealCal - currCal) / Math.max(currCal, 1);
        const proDiff = Math.abs(mealPro - currPro) / Math.max(currPro, 1);
        const fit = 1 - (calDiff * 0.5 + proDiff * 0.5);
        macroFitScore = Math.max(0, Math.min(5, fit * 5));
    } else {
        macroFitScore = 3;
    }

    // Novelty (0–5): unseen or rarely used = higher
    const repCount = mem.repetitionMap[key] || 0;
    const recentIdx = mem.recentMeals.indexOf(key);
    if (recentIdx === -1 && repCount === 0) {
        noveltyScore = 5;
    } else if (repCount <= 1) {
        noveltyScore = 3;
    } else if (repCount <= 3) {
        noveltyScore = 1;
    }
    // else noveltyScore stays 0

    // Repetition penalty (0–8): used recently = higher penalty
    if (recentIdx >= 0) {
        repetitionPenalty = 4 + (RECENT_MEALS_CAP - recentIdx) * 0.5;
    } else if (repCount > 0) {
        repetitionPenalty = Math.min(6, repCount * 1.5);
    }

    // Boredom penalty (0–6): flagged before = penalty
    const boredomCount = mem.boredomSignals[key] || 0;
    boredomPenalty = Math.min(6, boredomCount * 2);

    // Dislike penalty: strong negative
    const mealText = [meal.exampleFoods, meal.purpose].filter(Boolean).join(' ').toLowerCase();
    for (const d of mem.dislikedMeals) {
        if (d && mealText.includes(String(d).toLowerCase())) {
            dislikePenalty += 15;
        }
    }
    for (const ing of mem.dislikedIngredients) {
        if (ing && mealText.includes(String(ing).toLowerCase())) {
            dislikePenalty += 12;
        }
    }

    return compatibilityScore + macroFitScore + noveltyScore - repetitionPenalty - boredomPenalty - dislikePenalty;
}

/**
 * Check if meal contains any disliked ingredients.
 * @param {Object} meal
 * @param {string[]} dislikedIngredients
 * @returns {boolean}
 */
function mealContainsDisliked(meal, dislikedIngredients) {
    if (!dislikedIngredients?.length) return false;
    const mealText = [meal.exampleFoods, meal.purpose].filter(Boolean).join(' ').toLowerCase();
    return dislikedIngredients.some(ing => ing && mealText.includes(String(ing).toLowerCase()));
}

/**
 * Rank and pick best meal from pool using memory-aware scoring.
 * Prefers pool without disliked ingredients when available.
 * @param {Array} pool - Candidate meals
 * @param {Object} context - { currentMeal, slot, constraints, memory }
 * @returns {Object|null} Best meal or null
 */
export function pickBestMealFromPool(pool, context) {
    if (!pool?.length) return null;
    const mem = context?.memory || createEmptyMemory();
    const disliked = mem.dislikedIngredients || [];
    const poolToUse = disliked.length > 0
        ? pool.filter(m => !mealContainsDisliked(m, disliked))
        : pool;
    const effectivePool = poolToUse.length > 0 ? poolToUse : pool;
    const scored = effectivePool.map(m => ({ meal: m, score: scoreMeal(m, context) }));
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (best && best.score > -5) return best.meal;
    return effectivePool[0];
}

/**
 * Update memory after plan generation or meal operations.
 * @param {Object} memory - Existing memory (mutated)
 * @param {Array} mealPlan - Final meal plan
 * @param {Object} [options]
 * @param {Object} [options.replacement] - { from, to, index } for single replacement
 * @param {number} [options.replacedCount] - Number of rotations
 */
export function updateMemoryAfterPlan(memory, mealPlan, options = {}) {
    if (!memory || typeof memory !== 'object') return;

    const keys = (mealPlan || []).map(m => mealKey(m)).filter(Boolean);

    for (const key of keys) {
        memory.recentMeals = memory.recentMeals.filter(k => k !== key);
        memory.recentMeals.unshift(key);
        memory.repetitionMap[key] = (memory.repetitionMap[key] || 0) + 1;
    }
    if (memory.recentMeals.length > RECENT_MEALS_CAP) {
        memory.recentMeals = memory.recentMeals.slice(0, RECENT_MEALS_CAP);
    }

    if (options.replacement) {
        const { from, to, index } = options.replacement;
        memory.replacementHistory.unshift({
            from: mealKey(from),
            to: mealKey(to),
            index,
            ts: Date.now()
        });
        if (memory.replacementHistory.length > REPLACEMENT_HISTORY_CAP) {
            memory.replacementHistory = memory.replacementHistory.slice(0, REPLACEMENT_HISTORY_CAP);
        }
    }
}

/**
 * Apply structured feedback to memory.
 * @param {Object} memory - Memory to update (mutated)
 * @param {Object} feedback - { type, meal?, ingredient? }
 */
export function applyFeedback(memory, feedback) {
    if (!memory || !feedback?.type) return;

    switch (feedback.type) {
        case 'meal_boredom': {
            const meal = feedback.meal;
            if (meal) {
                const key = typeof meal === 'string' ? meal.toLowerCase() : mealKey(meal);
                memory.boredomSignals[key] = (memory.boredomSignals[key] || 0) + 1;
            }
            break;
        }
        case 'ingredient_dislike': {
            const ing = feedback.ingredient;
            if (ing && !memory.dislikedIngredients.includes(String(ing).toLowerCase())) {
                memory.dislikedIngredients.push(String(ing).toLowerCase());
            }
            break;
        }
        case 'meal_dislike': {
            const m = feedback.meal;
            if (m && !memory.dislikedMeals.includes(String(m).toLowerCase())) {
                memory.dislikedMeals.push(String(m).toLowerCase());
            }
            break;
        }
        case 'variety_request':
            // Could clear some boredom signals or boost novelty preference
            // For now, no direct mutation; scoring will prefer novelty
            break;
        default:
            break;
    }
}
