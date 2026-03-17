/**
 * ASCEND AI PROTOCOL - Unified Adaptation Summary Engine
 * Phase 17: Aggregates adaptive decisions across training, injury recovery,
 * nutrition, and supplements. Returns structured, explainable summary.
 * Logic-only. No UI, no DOM, no localStorage.
 */

/** Risk thresholds */
const RISK = {
    MIN_CALORIES: 1200,
    LOW_CALORIES: 1400,
    FATIGUE_HIGH: 7,
    SLEEP_LOW: 5,
    MAX_RESTRICTIONS: 5,
    SUPPLEMENTS_REMOVED_MANY: 4
};

/**
 * Detect training adjustments from adaptation output and protocol comparison.
 * @param {Object} adaptation - From evaluateProgress
 * @param {Object} protocol - Current protocol
 * @param {Object} previousProtocol - Previous protocol (optional)
 * @param {Object} outputs - { regenerationResult?, injuryResult? }
 * @returns {Array<{ type: string, detail: string }>}
 */
function detectTrainingAdjustments(adaptation, protocol, previousProtocol, outputs) {
    const adjustments = [];

    if (adaptation?.trainingAdjustments) {
        const t = adaptation.trainingAdjustments;
        const vol = t.volumeChange ?? 0;
        const intensity = t.intensityChange ?? 0;
        const load = t.loadProgression ?? 0;

        if (vol < -0.1) {
            adjustments.push({ type: 'volume_reduced', detail: `Volume reduced by ${Math.round(Math.abs(vol) * 100)}%` });
        } else if (vol > 0.05) {
            adjustments.push({ type: 'volume_increased', detail: `Volume increased by ${Math.round(vol * 100)}%` });
        }
        if (intensity < -0.05) {
            adjustments.push({ type: 'intensity_reduced', detail: 'Intensity reduced' });
        } else if (intensity > 0.05) {
            adjustments.push({ type: 'intensity_increased', detail: 'Intensity increased' });
        }
        if (load > 0) {
            adjustments.push({ type: 'load_progression', detail: `Load progression +${load}%` });
        } else if (load < 0) {
            adjustments.push({ type: 'load_regression', detail: 'Load progression reduced' });
        }
    }

    if (adaptation?.triggerDeload) {
        adjustments.push({ type: 'deload_triggered', detail: 'Deload week applied' });
    }

    if (adaptation?.cardioAdjustments?.cardioMinutesChange) {
        const delta = adaptation.cardioAdjustments.cardioMinutesChange;
        if (delta > 0) {
            adjustments.push({ type: 'cardio_increased', detail: `Cardio +${delta} min/week` });
        } else if (delta < 0) {
            adjustments.push({ type: 'cardio_reduced', detail: `Cardio ${delta} min/week` });
        }
    }

    const regen = outputs?.regenerationResult;
    if (regen?.isDeload) {
        adjustments.push({ type: 'deload_week', detail: 'Scheduled deload week' });
    }
    if (regen?.phase) {
        adjustments.push({ type: 'phase_change', detail: `Phase: ${regen.phase}` });
    }

    const injuryResult = outputs?.injuryResult;
    if (injuryResult?.replacements?.length) {
        const count = injuryResult.replacements.length;
        adjustments.push({ type: 'exercise_replacements', detail: `${count} exercise(s) replaced for injury safety` });
    }

    return adjustments;
}

/**
 * Detect injury adjustments from injury result and recovery state.
 * @param {Object} outputs - { injuryResult?, injuryRecoveryState? }
 * @param {Object} inputs - User inputs
 * @returns {Array<{ type: string, detail: string }>}
 */
function detectInjuryAdjustments(outputs, inputs) {
    const adjustments = [];
    const injuryResult = outputs?.injuryResult;
    const recoveryState = outputs?.injuryRecoveryState;

    if (injuryResult?.replacements?.length) {
        const areas = [...new Set(injuryResult.replacements.map(r => r.reason?.match(/for (\w+)/)?.[1] || 'injury'))];
        adjustments.push({ type: 'restricted_movements', detail: `Restricted: ${areas.join(', ')}` });
    }
    if (injuryResult?.warnings?.length) {
        injuryResult.warnings.forEach(w => {
            adjustments.push({ type: 'injury_modification', detail: w });
        });
    }

    if (recoveryState?.injuryState === 'reintroduction') {
        adjustments.push({ type: 'reintroduction_phase', detail: 'Gradual reintroduction to full training' });
    }
    if (recoveryState?.returnToBaseWeek > 0) {
        adjustments.push({ type: 'reduced_load', detail: `Return-to-base week ${recoveryState.returnToBaseWeek}` });
    }

    const limitations = inputs?.limitations || inputs?.assessmentLimitation;
    if (limitations && limitations !== 'none') {
        adjustments.push({ type: 'assessment_limitation', detail: `Limitation: ${String(limitations).replace(/_/g, ' ')}` });
    }

    return adjustments;
}

/**
 * Detect nutrition adjustments from nutrition plan, memory, and adaptation.
 * @param {Object} nutritionPlan - From generateNutritionPlan
 * @param {Object} previousProtocol - Previous protocol (optional)
 * @param {Object} adaptation - From evaluateProgress (for calorieChange)
 * @param {Object} inputs - User inputs (for dietType)
 * @returns {Array<{ type: string, detail: string }>}
 */
function detectNutritionAdjustments(nutritionPlan, previousProtocol, adaptation, inputs) {
    const adjustments = [];
    const notes = nutritionPlan?.adaptationNotes || [];
    const memory = nutritionPlan?.nutritionMemory;

    let hasMealReplace = false, hasDisliked = false, hasVariety = false;
    for (const note of notes) {
        if (!hasMealReplace && (note.includes('swapped') || note.includes('replaced'))) {
            adjustments.push({ type: 'meal_replacements', detail: 'Meals swapped to meet constraints' });
            hasMealReplace = true;
        }
        if (!hasDisliked && note.includes('Disliked')) {
            adjustments.push({ type: 'removed_ingredients', detail: 'Disliked ingredients avoided' });
            hasDisliked = true;
        }
        if (!hasVariety && (note.includes('deprioritized') || note.includes('variety'))) {
            adjustments.push({ type: 'reduced_repetition', detail: 'Reduced meal repetition for variety' });
            hasVariety = true;
        }
    }

    if (memory?.dislikedIngredients?.length) {
        adjustments.push({ type: 'dislikes_applied', detail: `Avoiding: ${memory.dislikedIngredients.slice(0, 3).join(', ')}` });
    }
    if (memory?.dislikedMeals?.length) {
        adjustments.push({ type: 'disliked_meals', detail: 'Specific meals avoided' });
    }

    const dietRaw = (inputs?.diet || inputs?.dietType || 'standard').toLowerCase();
    const dietMap = { standard: 'omnivore', balanced: 'omnivore', vegan: 'vegan', vegetarian: 'vegetarian', pescatarian: 'pescatarian' };
    const dietType = dietMap[dietRaw] || dietRaw;
    if (dietType && dietType !== 'omnivore') {
        adjustments.push({ type: 'diet_enforcement', detail: `Diet: ${dietType}` });
    }

    const calorieChange = adaptation?.nutritionAdjustments?.calorieChange ?? 0;
    if (calorieChange < 0) {
        adjustments.push({ type: 'calories_reduced', detail: `Calories reduced by ${Math.abs(calorieChange)} kcal` });
    } else if (calorieChange > 0) {
        adjustments.push({ type: 'calories_increased', detail: `Calories increased by ${calorieChange} kcal` });
    }

    return adjustments;
}

/**
 * Detect supplement adjustments from supplement output.
 * @param {Object} supplementOutput - From generateSupplementRecommendations
 * @param {Object} previousSupplementOutput - Previous output (optional)
 * @returns {Array<{ type: string, detail: string }>}
 */
function detectSupplementAdjustments(supplementOutput, previousSupplementOutput) {
    const adjustments = [];
    const notes = supplementOutput?.adaptationNotes || [];
    const memory = supplementOutput?.supplementMemory;

    let hasStim = false, hasEssentials = false, hasPill = false;
    for (const note of notes) {
        if (!hasStim && (note.includes('Stimulant') || note.includes('caffeine'))) {
            adjustments.push({ type: 'stimulants_removed', detail: 'Stimulants removed per preference' });
            hasStim = true;
        }
        if (!hasEssentials && note.includes('Essentials-only')) {
            adjustments.push({ type: 'essentials_only', detail: 'Essentials-only stack applied' });
            hasEssentials = true;
        }
        if (!hasPill && (note.includes('pill burden') || note.includes('fewer'))) {
            adjustments.push({ type: 'reduced_stack', detail: 'Supplement count reduced' });
            hasPill = true;
        }
    }

    if (memory?.rejectedSupplements?.length) {
        adjustments.push({ type: 'rejected_supplements', detail: `Excluded: ${memory.rejectedSupplements.join(', ')}` });
    }
    if (memory?.acceptedSupplements?.length) {
        adjustments.push({ type: 'accepted_supplements', detail: `Kept: ${memory.acceptedSupplements.join(', ')}` });
    }

    const essentials = supplementOutput?.essentials?.length ?? 0;
    const optional = supplementOutput?.optional?.length ?? 0;
    const prevEssentials = previousSupplementOutput?.essentials?.length ?? essentials;
    const prevOptional = previousSupplementOutput?.optional?.length ?? optional;
    const totalPrev = prevEssentials + prevOptional;
    const totalNow = essentials + optional;
    if (totalPrev > 0 && totalNow < totalPrev - 2) {
        adjustments.push({ type: 'stack_reduced', detail: `Stack reduced from ${totalPrev} to ${totalNow} items` });
    }

    return adjustments;
}

/**
 * Generate human-readable reasons from adjustments.
 * @param {Object} summary - Partial summary with adjustment arrays
 * @returns {string[]}
 */
function generateReasons(summary) {
    const reasons = [];
    const { trainingAdjustments, injuryAdjustments, nutritionAdjustments, supplementAdjustments } = summary;

    const reasonMap = {
        volume_reduced: 'Volume reduced due to fatigue signals',
        volume_increased: 'Volume increased for progression',
        intensity_reduced: 'Intensity reduced for recovery',
        intensity_increased: 'Intensity increased',
        load_progression: 'Load progression applied',
        load_regression: 'Load reduced due to strength regression',
        deload_triggered: 'Deload week triggered for recovery',
        deload_week: 'Scheduled deload week',
        cardio_increased: 'Cardio increased for fat loss support',
        exercise_replacements: 'Exercises modified for injury safety',
        restricted_movements: 'Restricted movements due to injury',
        reintroduction_phase: 'Gradual reintroduction after injury',
        reduced_load: 'Reduced load during return-to-base',
        meal_replacements: 'Meals adjusted to meet dietary constraints',
        removed_ingredients: 'Meals adjusted to avoid disliked ingredients',
        reduced_repetition: 'Meal variety increased to reduce repetition',
        diet_enforcement: 'Protein sources adjusted to match diet type',
        calories_reduced: 'Calories reduced for fat loss adjustment',
        calories_increased: 'Calories increased for recovery or muscle gain',
        dislikes_applied: 'Meals adjusted to avoid disliked ingredients',
        stimulants_removed: 'Stimulants removed due to user preference',
        essentials_only: 'Essentials-only supplement stack applied',
        reduced_stack: 'Supplement stack simplified',
        rejected_supplements: 'Excluded supplements per user preference',
        stack_reduced: 'Supplement count reduced'
    };

    for (const adj of [...(trainingAdjustments || []), ...(injuryAdjustments || []), ...(nutritionAdjustments || []), ...(supplementAdjustments || [])]) {
        const reason = reasonMap[adj.type] || adj.detail;
        if (reason && !reasons.includes(reason)) {
            reasons.push(reason);
        }
    }

    return reasons;
}

/**
 * Generate forward-looking watch-next signals.
 * @param {Object} summary - Full summary
 * @param {Object} inputs - User inputs
 * @returns {string[]}
 */
function generateWatchNext(summary, inputs) {
    const watch = [];
    const { trainingAdjustments, injuryAdjustments, nutritionAdjustments, supplementAdjustments } = summary;

    const hasVolumeReduction = (trainingAdjustments || []).some(a => a.type === 'volume_reduced' || a.type === 'deload_triggered');
    const hasInjury = (injuryAdjustments || []).length > 0;
    const hasNutritionChange = (nutritionAdjustments || []).length > 0;
    const hasSupplementChange = (supplementAdjustments || []).some(a => a.type === 'stimulants_removed' || a.type === 'stack_reduced');

    if (hasVolumeReduction || hasInjury) {
        watch.push('Monitor recovery over next 7 days');
    }
    if (hasNutritionChange) {
        watch.push('Check adherence to new meal plan');
    }
    if ((supplementAdjustments || []).some(a => a.type === 'stimulants_removed')) {
        watch.push('Evaluate energy levels without stimulants');
    }
    if ((nutritionAdjustments || []).some(a => a.type === 'diet_enforcement' || a.type === 'calories_increased')) {
        watch.push('Track response to nutrition changes');
    }
    if ((injuryAdjustments || []).some(a => a.type === 'reintroduction_phase')) {
        watch.push('Monitor pain/discomfort during reintroduction');
    }
    if ((trainingAdjustments || []).some(a => a.type === 'load_progression')) {
        watch.push('Track strength progression');
    }

    if (watch.length === 0) {
        watch.push('Continue current protocol; reassess at next check-in');
    }

    return [...new Set(watch)];
}

/**
 * Detect risk flags from inputs and outputs.
 * @param {Object} inputs - User inputs
 * @param {Object} outputs - All outputs
 * @returns {Array<{ flag: string, severity: string, detail: string }>}
 */
function detectRiskFlags(inputs, outputs) {
    const flags = [];
    const progressData = outputs?.progressData || inputs?.progressData || {};
    const nutritionPlan = outputs?.nutritionPlan;
    const supplementOutput = outputs?.supplementOutput;

    const calories = typeof nutritionPlan?.calories === 'number'
        ? nutritionPlan.calories
        : parseInt(String(nutritionPlan?.calories || nutritionPlan?.daily_calories || 0).replace(/\D/g, ''), 10) || 0;

    if (calories > 0 && calories < RISK.MIN_CALORIES) {
        flags.push({ flag: 'very_low_calories', severity: 'high', detail: `Calorie intake very low (${calories} kcal)` });
    } else if (calories > 0 && calories < RISK.LOW_CALORIES) {
        flags.push({ flag: 'low_calories', severity: 'medium', detail: `Calorie intake low (${calories} kcal)` });
    }

    const exclusions = (inputs?.allergies || inputs?.exclusions || '')
        .split(/[,;]/).map(s => s.trim()).filter(Boolean);
    const dietRestriction = inputs?.diet && inputs.diet !== 'standard' && inputs.diet !== 'omnivore' ? 1 : 0;
    const totalRestrictions = exclusions.length + dietRestriction + (progressData?.injuries?.length || 0);
    if (totalRestrictions >= RISK.MAX_RESTRICTIONS) {
        flags.push({ flag: 'many_restrictions', severity: 'medium', detail: 'Multiple dietary and training restrictions active' });
    }

    const fatigue = parseFloat(progressData?.fatigueLevel) || 0;
    const sleep = parseFloat(progressData?.sleepScore) || 10;
    if (fatigue >= RISK.FATIGUE_HIGH && sleep < RISK.SLEEP_LOW) {
        flags.push({ flag: 'high_fatigue_low_sleep', severity: 'medium', detail: 'High fatigue with poor sleep; consider deload' });
    }

    const prevEssentials = outputs?.previousSupplementOutput?.essentials?.length ?? 0;
    const prevOptional = outputs?.previousSupplementOutput?.optional?.length ?? 0;
    const currEssentials = supplementOutput?.essentials?.length ?? 0;
    const currOptional = supplementOutput?.optional?.length ?? 0;
    const removed = (prevEssentials + prevOptional) - (currEssentials + currOptional);
    if (removed >= RISK.SUPPLEMENTS_REMOVED_MANY) {
        flags.push({ flag: 'many_supplements_removed', severity: 'low', detail: 'Several supplements removed; ensure nutrition gaps covered' });
    }

    return flags;
}

/**
 * Generate unified adaptation summary.
 * Accepts raw protocol + AI outputs. Returns pure structured data.
 *
 * @param {Object} params
 * @param {Object} [params.protocol] - Current protocol (apiPlan, nutrition, meta)
 * @param {Object} [params.previousProtocol] - Previous protocol for comparison
 * @param {Object} [params.inputs] - Raw user inputs (goal, diet, weight, limitations, etc.)
 * @param {Object} [params.outputs] - Pre-computed outputs from engines
 *   - adaptation: from evaluateProgress
 *   - injuryResult: from adjustPlanForInjuries
 *   - injuryRecoveryState: from getInjuryState (optional)
 *   - nutritionPlan: from generateNutritionPlan
 *   - supplementOutput: from generateSupplementRecommendations
 *   - regenerationResult: from buildNextWeekSnapshot
 *   - progressData: latest progress entry
 *   - previousSupplementOutput: for stack change detection
 * @returns {Object} Adaptation summary
 */
export function generateAdaptationSummary({ protocol, previousProtocol, inputs, outputs } = {}) {
    const protocolData = protocol || {};
    const prevProtocol = previousProtocol || {};
    const inputData = inputs || {};
    const outputData = outputs || {};

    const adaptation = outputData.adaptation;
    const nutritionPlan = outputData.nutritionPlan || protocolData.aiResult?.nutrition_plan || protocolData.nutrition;
    const supplementOutput = outputData.supplementOutput;

    const trainingAdjustments = detectTrainingAdjustments(
        adaptation,
        protocolData,
        prevProtocol,
        outputData
    );

    const injuryAdjustments = detectInjuryAdjustments(outputData, inputData);

    const nutritionAdjustments = detectNutritionAdjustments(nutritionPlan, prevProtocol, adaptation, inputData);

    const supplementAdjustments = detectSupplementAdjustments(
        supplementOutput,
        outputData.previousSupplementOutput
    );

    const reasons = generateReasons({
        trainingAdjustments,
        injuryAdjustments,
        nutritionAdjustments,
        supplementAdjustments
    });

    const watchNext = generateWatchNext(
        { trainingAdjustments, injuryAdjustments, nutritionAdjustments, supplementAdjustments },
        inputData
    );

    const riskFlags = detectRiskFlags(inputData, {
        ...outputData,
        nutritionPlan,
        supplementOutput
    });

    return {
        trainingAdjustments,
        injuryAdjustments,
        nutritionAdjustments,
        supplementAdjustments,
        reasons,
        watchNext,
        riskFlags
    };
}
