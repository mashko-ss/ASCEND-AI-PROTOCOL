/**
 * ASCEND AI PROTOCOL - Safety Validator Layer
 * Phase 20: Centralized validation for protocol quality and practical safety.
 * Deterministic, no medical claims, no diagnosis language.
 */

/** Thresholds */
const THRESHOLDS = {
    MIN_CALORIES_CRITICAL: 1200,
    MIN_CALORIES_WARN: 1400,
    MIN_PROTEIN_PER_KG: 1.0,
    MIN_PROTEIN_ABSOLUTE: 50,
    MAX_RESTRICTIONS: 5,
    FATIGUE_HIGH: 7,
    SLEEP_LOW: 5,
    MAX_OPTIONAL_SUPPLEMENTS: 6,
    MAX_OPTIONAL_SUPPLEMENTS_LOW_PILL: 3,
    MAX_MEAL_REPETITION_RATIO: 0.7,
    MIN_MEALS: 3,
    MIN_ESSENTIAL_SUPPLEMENTS: 1
};

/** Stimulant supplement names (lowercase) */
const STIMULANT_NAMES = ['caffeine', 'pre-workout', 'preworkout'];

/**
 * Extract calories from nutrition plan.
 * @param {Object} np
 * @returns {number}
 */
function getCalories(np) {
    if (!np) return 0;
    if (typeof np.calories === 'number') return np.calories;
    const str = String(np.daily_calories || np.calories || '0');
    return parseInt(str.replace(/\D/g, ''), 10) || 0;
}

/**
 * Extract protein grams from nutrition plan.
 * @param {Object} np
 * @returns {number}
 */
function getProteinGrams(np) {
    if (!np?.macros) return 0;
    const p = np.macros.protein;
    if (typeof p === 'number') return p;
    return parseInt(String(p || '0').replace(/\D/g, ''), 10) || 0;
}

/**
 * Check 1: Very low calories.
 */
function checkVeryLowCalories(np) {
    const cal = getCalories(np);
    if (cal <= 0) return { name: 'very_low_calories', passed: true };
    if (cal < THRESHOLDS.MIN_CALORIES_CRITICAL) {
        return { name: 'very_low_calories', passed: false, severity: 'high', detail: `Calorie intake very low (${cal} kcal)` };
    }
    if (cal < THRESHOLDS.MIN_CALORIES_WARN) {
        return { name: 'very_low_calories', passed: false, severity: 'medium', detail: `Calorie intake low (${cal} kcal)` };
    }
    return { name: 'very_low_calories', passed: true };
}

/**
 * Check 2: Very low protein.
 */
function checkVeryLowProtein(np, inputs) {
    const protein = getProteinGrams(np);
    if (protein <= 0) return { name: 'very_low_protein', passed: true };
    const weight = parseFloat(inputs?.weight || inputs?.weightKg || 70) || 70;
    const proteinPerKg = weight > 0 ? protein / weight : 0;
    if (protein < THRESHOLDS.MIN_PROTEIN_ABSOLUTE) {
        return { name: 'very_low_protein', passed: false, severity: 'high', detail: `Protein very low (${protein}g)` };
    }
    if (proteinPerKg < THRESHOLDS.MIN_PROTEIN_PER_KG) {
        return { name: 'very_low_protein', passed: false, severity: 'medium', detail: `Protein low relative to body weight (${protein}g, ~${proteinPerKg.toFixed(1)}g/kg)` };
    }
    return { name: 'very_low_protein', passed: true };
}

/**
 * Check 3: Too many restrictions.
 */
function checkTooManyRestrictions(inputs, supplementMemory) {
    const exclusions = (inputs?.allergies || inputs?.exclusions || '')
        .split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const dietRestrict = inputs?.diet && !['standard', 'omnivore', 'balanced'].includes(String(inputs.diet).toLowerCase()) ? 1 : 0;
    const injuries = Array.isArray(inputs?.injuries) ? inputs.injuries.length : 0;
    const progressInjuries = Array.isArray(inputs?.progressData?.injuries) ? inputs.progressData.injuries.length : 0;
    const dislikes = Array.isArray(inputs?.dislikes) ? inputs.dislikes.length : 0;
    const total = exclusions.length + dietRestrict + Math.max(injuries, progressInjuries) + dislikes;
    if (total >= THRESHOLDS.MAX_RESTRICTIONS) {
        return { name: 'too_many_restrictions', passed: false, severity: 'medium', detail: `Many restrictions (diet, allergies, injuries, dislikes) may limit adherence` };
    }
    return { name: 'too_many_restrictions', passed: true };
}

/**
 * Check 4: High fatigue + high intensity.
 */
function checkHighFatigueHighIntensity(protocol, progressData, adaptationSummary) {
    const fatigue = parseFloat(progressData?.fatigueLevel) ?? parseFloat(progressData?.fatigue) ?? 0;
    const sleep = parseFloat(progressData?.sleepScore) ?? parseFloat(progressData?.sleep) ?? 10;
    if (fatigue < THRESHOLDS.FATIGUE_HIGH && sleep >= THRESHOLDS.SLEEP_LOW) {
        return { name: 'high_fatigue_high_intensity', passed: true };
    }
    const hasHighFatigue = fatigue >= THRESHOLDS.FATIGUE_HIGH;
    const hasPoorSleep = sleep < THRESHOLDS.SLEEP_LOW;
    const reasons = adaptationSummary?.reasons || [];
    const hasVolumeReduction = reasons.some(r => typeof r === 'string' && (r.toLowerCase().includes('volume') || r.toLowerCase().includes('deload')));
    const trainingAdj = adaptationSummary?.trainingAdjustments || [];
    const hasReduction = trainingAdj.some(a => (a.type === 'volume_reduced' || a.type === 'deload_triggered'));
    if ((hasHighFatigue || hasPoorSleep) && !hasVolumeReduction && !hasReduction) {
        return { name: 'high_fatigue_high_intensity', passed: false, severity: 'medium', detail: 'High fatigue or poor sleep without training reduction' };
    }
    return { name: 'high_fatigue_high_intensity', passed: true };
}

/**
 * Check 5: Too many supplement recommendations.
 */
function checkTooManySupplements(supplementOutput, inputs, supplementMemory) {
    const essentials = supplementOutput?.essentials?.length ?? 0;
    const optional = supplementOutput?.optional?.length ?? 0;
    const total = essentials + optional;
    const lowPill = supplementMemory?.preferenceSignals?.lowPillBurden || inputs?.lowPillBurden;
    const budgetSensitive = supplementMemory?.preferenceSignals?.budgetSensitive || inputs?.budgetSensitive;
    const maxOptional = lowPill ? THRESHOLDS.MAX_OPTIONAL_SUPPLEMENTS_LOW_PILL : THRESHOLDS.MAX_OPTIONAL_SUPPLEMENTS;
    if (optional > maxOptional) {
        return { name: 'too_many_supplements', passed: false, severity: 'medium', detail: `Optional supplement stack large (${optional}); consider reducing for ${lowPill ? 'low pill burden' : 'simplicity'}` };
    }
    if ((lowPill || budgetSensitive) && optional > 2) {
        return { name: 'too_many_supplements', passed: false, severity: 'low', detail: `User prefers fewer supplements; ${optional} optional items recommended` };
    }
    return { name: 'too_many_supplements', passed: true };
}

/**
 * Check 6: Stimulant conflict.
 */
function checkStimulantConflict(supplementOutput, supplementMemory, inputs) {
    const avoidStimulants = supplementMemory?.preferenceSignals?.avoidStimulants ||
        ['low', 'sensitive'].includes(String(inputs?.caffeineTolerance || '').toLowerCase());
    if (!avoidStimulants) return { name: 'stimulant_conflict', passed: true };
    const all = [...(supplementOutput?.essentials || []), ...(supplementOutput?.optional || [])];
    const hasStimulant = all.some(s => {
        const n = (s.name || '').toLowerCase();
        return STIMULANT_NAMES.some(st => n.includes(st));
    });
    if (hasStimulant) {
        return { name: 'stimulant_conflict', passed: false, severity: 'high', detail: 'Stimulant suggested despite avoid-stimulants preference' };
    }
    return { name: 'stimulant_conflict', passed: true };
}

/**
 * Check 7: Poor meal variety.
 */
function checkPoorMealVariety(nutritionPlan, nutritionMemory) {
    const mealPlan = nutritionPlan?.mealPlan || nutritionPlan?.meal_plan || [];
    if (!Array.isArray(mealPlan) || mealPlan.length < THRESHOLDS.MIN_MEALS) {
        return { name: 'poor_meal_variety', passed: true };
    }
    const keys = mealPlan.map(m => `${(m.mealName || '').toLowerCase()}|${String(m.exampleFoods || '').toLowerCase()}`).filter(Boolean);
    const unique = new Set(keys);
    const ratio = keys.length > 0 ? unique.size / keys.length : 1;
    if (ratio < THRESHOLDS.MAX_MEAL_REPETITION_RATIO) {
        return { name: 'poor_meal_variety', passed: false, severity: 'low', detail: `Meal repetition high (${unique.size}/${keys.length} unique)` };
    }
    const boredomCount = Object.keys(nutritionMemory?.boredomSignals || {}).length;
    if (boredomCount > 0 && ratio < 0.9) {
        return { name: 'poor_meal_variety', passed: false, severity: 'low', detail: 'Previously flagged boredom; variety could be improved' };
    }
    return { name: 'poor_meal_variety', passed: true };
}

/**
 * Check 8: Empty or weak output.
 */
function checkEmptyOrWeakOutput(nutritionPlan, supplementOutput) {
    const issues = [];
    const cal = getCalories(nutritionPlan);
    const protein = getProteinGrams(nutritionPlan);
    const mealPlan = nutritionPlan?.mealPlan || nutritionPlan?.meal_plan || [];
    const mealCount = Array.isArray(mealPlan) ? mealPlan.length : 0;
    const essentials = supplementOutput?.essentials?.length ?? 0;
    const optional = supplementOutput?.optional?.length ?? 0;

    if (mealCount < THRESHOLDS.MIN_MEALS && cal > 0) {
        issues.push('Meal plan has fewer than 3 meals');
    }
    if (essentials < THRESHOLDS.MIN_ESSENTIAL_SUPPLEMENTS && (essentials + optional) > 0) {
        issues.push('Supplement essentials list sparse');
    }
    if (cal > 0 && protein <= 0 && nutritionPlan?.macros) {
        issues.push('Protein not specified in macros');
    }
    if (issues.length > 0) {
        return { name: 'empty_weak_output', passed: false, severity: issues.some(i => i.includes('sparse') || i.includes('Protein')) ? 'medium' : 'low', detail: issues.join('; ') };
    }
    return { name: 'empty_weak_output', passed: true };
}

/**
 * Compute quality score (0–100).
 */
function computeQualityScore(checks) {
    if (!checks?.length) return 100;
    const failed = checks.filter(c => !c.passed);
    const high = failed.filter(c => c.severity === 'high').length;
    const medium = failed.filter(c => c.severity === 'medium').length;
    const low = failed.filter(c => c.severity === 'low').length;
    let score = 100;
    score -= high * 25;
    score -= medium * 10;
    score -= low * 5;
    return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Validate protocol safety.
 *
 * @param {Object} params
 * @param {Object} [params.protocol] - Active protocol
 * @param {Object} [params.nutritionPlan] - Nutrition plan (calories, macros, mealPlan)
 * @param {Object} [params.supplementOutput] - Supplement recommendations (essentials, optional)
 * @param {Object} [params.adaptationSummary] - Adaptation summary (reasons, trainingAdjustments)
 * @param {Object} [params.progressData] - Latest progress (fatigueLevel, sleepScore, injuries)
 * @param {Object} [params.inputs] - Raw inputs (diet, allergies, weight, dislikes, etc.)
 * @returns {Object} Validation result
 */
export function validateProtocolSafety({ protocol, nutritionPlan, supplementOutput, adaptationSummary, progressData, inputs } = {}) {
    const mergedInputs = { ...inputs, progressData };
    const supplementMemory = supplementOutput?.supplementMemory || protocol?.aiResult?.supplementMemory || {};
    const nutritionMemory = nutritionPlan?.nutritionMemory || protocol?.aiResult?.nutritionMemory || {};

    const checks = [
        checkVeryLowCalories(nutritionPlan),
        checkVeryLowProtein(nutritionPlan, mergedInputs),
        checkTooManyRestrictions(mergedInputs, supplementMemory),
        checkHighFatigueHighIntensity(protocol, progressData, adaptationSummary),
        checkTooManySupplements(supplementOutput, mergedInputs, supplementMemory),
        checkStimulantConflict(supplementOutput, supplementMemory, mergedInputs),
        checkPoorMealVariety(nutritionPlan, nutritionMemory),
        checkEmptyOrWeakOutput(nutritionPlan, supplementOutput)
    ];

    const failed = checks.filter(c => !c.passed);
    const criticalFlags = failed.filter(c => c.severity === 'high').map(c => ({
        flag: c.name,
        severity: c.severity,
        detail: c.detail
    }));
    const warnings = failed.filter(c => c.severity !== 'high').map(c => ({
        flag: c.name,
        severity: c.severity || 'low',
        detail: c.detail
    }));

    const qualityScore = computeQualityScore(checks);
    const valid = criticalFlags.length === 0;

    return {
        valid,
        warnings,
        criticalFlags,
        qualityScore,
        checks
    };
}
