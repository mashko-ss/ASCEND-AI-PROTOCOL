/**
 * ASCEND AI PROTOCOL - Plan Regeneration Engine
 * Phase 8: Generate updated weekly protocol snapshots based on progress, adaptation, and recommendations.
 */

import { evaluateProgress } from './adaptiveEngine.js';
import { generateRecommendations } from './recommendationEngine.js';
import { getLatestProgress, getProgressHistory } from './progressTracker.js';
import { getActiveProtocol, advanceProtocolWeek } from './protocolEngine.js';
import { adjustPlanForInjuries, normalizeInjuries } from './injuryAdjustmentEngine.js';

/** Deload: volume and intensity reduction factors */
const DELOAD_VOLUME_FACTOR = 0.5;
const DELOAD_INTENSITY_FACTOR = 0.85;

/**
 * Check if a given week number is a deload week.
 * @param {Object} protocol
 * @param {number} weekNumber
 * @returns {boolean}
 */
export function isDeloadWeek(protocol, weekNumber) {
    if (!protocol?.deloadWeeks) return false;
    return protocol.deloadWeeks.includes(weekNumber);
}

/**
 * Apply adaptive adjustments to training plan (volume, intensity).
 * Mutates a deep copy; returns the adjusted plan.
 * @param {Object} plan - apiPlan with weeklyPlan, mainBlocks, exercises
 * @param {Object} adaptation - { trainingAdjustments: { volumeChange, intensityChange }, cardioAdjustments }
 * @param {boolean} forceDeload - If true, apply deload reductions
 * @returns {Object} Adjusted plan (deep copy)
 */
export function applyAdaptiveAdjustmentsToPlan(plan, adaptation, forceDeload = false) {
    if (!plan) return plan;
    const planCopy = JSON.parse(JSON.stringify(plan));

    let volumeMult = 1;
    let intensityMult = 1;
    let cardioDelta = 0;

    if (forceDeload) {
        volumeMult = DELOAD_VOLUME_FACTOR;
        intensityMult = DELOAD_INTENSITY_FACTOR;
    } else if (adaptation?.trainingAdjustments) {
        const t = adaptation.trainingAdjustments;
        volumeMult = 1 + (t.volumeChange ?? 0);
        intensityMult = 1 + (t.intensityChange ?? 0);
    }
    if (adaptation?.cardioAdjustments?.cardioMinutesChange) {
        cardioDelta = adaptation.cardioAdjustments.cardioMinutesChange;
    }

    const weeklyPlan = planCopy.weeklyPlan || [];
    for (const day of weeklyPlan) {
        const blocks = day.mainBlocks || [];
        for (const block of blocks) {
            const exercises = block.exercises || [];
            for (const ex of exercises) {
                const sets = parseInt(ex.sets, 10) || 3;
                ex.sets = Math.max(1, Math.round(sets * volumeMult));
                if (ex.rpe != null && ex.rpe !== '') {
                    const rpe = parseFloat(ex.rpe) || 7;
                    ex.rpe = String(Math.max(5, Math.min(10, Math.round(rpe * intensityMult * 10) / 10)));
                }
            }
        }
    }

    if (cardioDelta !== 0 && planCopy.planMeta) {
        planCopy.planMeta = { ...planCopy.planMeta };
        const currentCardio = parseInt(planCopy.planMeta.cardioMinutesPerWeek, 10) || 0;
        planCopy.planMeta.cardioMinutesPerWeek = Math.max(0, currentCardio + cardioDelta);
    }

    return planCopy;
}

/**
 * Apply adaptive adjustments to nutrition plan (calories, macros).
 * @param {Object} nutritionPlan - { calories, macros, daily_calories, ... }
 * @param {Object} adaptation - { nutritionAdjustments: { calorieChange } }
 * @param {Object} rawInput - Raw user data for generateNutritionPlan fallback
 * @returns {Object} Adjusted nutrition plan
 */
export function applyAdaptiveAdjustmentsToNutrition(nutritionPlan, adaptation, rawInput = {}) {
    if (!nutritionPlan) return nutritionPlan;
    const npCopy = JSON.parse(JSON.stringify(nutritionPlan));

    let calorieChange = 0;
    if (adaptation?.nutritionAdjustments?.calorieChange) {
        calorieChange = adaptation.nutritionAdjustments.calorieChange;
    }

    const baseCalories = typeof npCopy.calories === 'number' ? npCopy.calories : parseInt(String(npCopy.calories || npCopy.daily_calories || 0).replace(/\D/g, ''), 10) || 2000;
    const newCalories = Math.max(1200, baseCalories + calorieChange);

    npCopy.calories = newCalories;
    npCopy.daily_calories = `${newCalories} kcal`;

    if (npCopy.macros && baseCalories > 0) {
        const ratio = newCalories / baseCalories;
        const parseG = (v) => parseInt(String(v || 0).replace(/\D/g, ''), 10) || 0;
        const pro = parseG(npCopy.macros.protein);
        const carbs = parseG(npCopy.macros.carbs);
        const fats = parseG(npCopy.macros.fats);
        npCopy.macros = {
            protein: `${Math.round(pro * ratio)}g`,
            carbs: `${Math.round(carbs * ratio)}g`,
            fats: `${Math.round(fats * ratio)}g`
        };
    }

    return npCopy;
}

/**
 * Build next week snapshot with optional adaptive adjustments.
 * Phase 9: Injury adjustment applied when injuries/limitations exist.
 * @param {Object} protocol - Active protocol
 * @param {number} weekNumber - Week being completed
 * @param {Object} progressData - Latest progress or null
 * @param {Object} adaptation - Adaptive evaluation or null
 * @param {Array} recommendations - Recommendation array
 * @param {Object} userProfile - { goal, weight, ... }
 * @param {Object} rawInput - Raw form data for nutrition
 * @returns {{ week, date, trainingPlan, nutritionPlan, adaptation, recommendations, isDeload, regenerationResult }}
 */
export function buildNextWeekSnapshot(protocol, weekNumber, progressData, adaptation, recommendations, userProfile = {}, rawInput = {}) {
    const nextWeek = weekNumber + 1;
    const isDeload = isDeloadWeek(protocol, nextWeek);
    const currentPlan = protocol.apiPlan;
    const currentNutrition = protocol.aiResult?.nutrition_plan || protocol.nutrition;

    let trainingPlan = currentPlan ? JSON.parse(JSON.stringify(currentPlan)) : null;
    let nutritionPlan = currentNutrition ? JSON.parse(JSON.stringify(currentNutrition)) : null;

    const regenerationResult = {
        week: nextWeek,
        isDeload,
        volumeChange: 0,
        intensityChange: 0,
        calorieChange: 0,
        cardioChange: 0
    };

    if (isDeload) {
        trainingPlan = applyAdaptiveAdjustmentsToPlan(currentPlan, null, true);
        regenerationResult.volumeChange = (DELOAD_VOLUME_FACTOR - 1) * 100;
        regenerationResult.intensityChange = (DELOAD_INTENSITY_FACTOR - 1) * 100;
    } else if (adaptation) {
        trainingPlan = applyAdaptiveAdjustmentsToPlan(currentPlan, adaptation, false);
        nutritionPlan = applyAdaptiveAdjustmentsToNutrition(currentNutrition, adaptation, rawInput);

        const t = adaptation.trainingAdjustments || {};
        const n = adaptation.nutritionAdjustments || {};
        const c = adaptation.cardioAdjustments || {};
        regenerationResult.volumeChange = (t.volumeChange ?? 0) * 100;
        regenerationResult.intensityChange = (t.intensityChange ?? 0) * 100;
        regenerationResult.calorieChange = n.calorieChange ?? 0;
        regenerationResult.cardioChange = c.cardioMinutesChange ?? 0;
    }

    // Phase 9: Injury adjustment when injuries/limitations exist
    const assessmentLimitation = protocol.meta?.limitations || rawInput.limitations || 'none';
    const progressInjuries = progressData?.injuries ?? [];
    const injuries = normalizeInjuries(assessmentLimitation, progressInjuries);
    const hasFatigue = (progressData?.fatigueLevel ?? 5) >= 7;
    if (injuries.length > 0 && trainingPlan) {
        const injuryResult = adjustPlanForInjuries(trainingPlan, injuries, {
            reduceVolumeOnFatigue: hasFatigue || injuries.includes('general_fatigue')
        });
        if (injuryResult.adjustedPlan) {
            trainingPlan = injuryResult.adjustedPlan;
            if (injuryResult.warnings?.length) {
                trainingPlan.warnings = [...(trainingPlan.warnings || []), ...injuryResult.warnings];
            }
        }
    }

    return {
        week: weekNumber,
        date: new Date().toISOString().slice(0, 10),
        trainingPlan: trainingPlan || currentPlan,
        nutritionPlan: nutritionPlan || currentNutrition,
        adaptation: adaptation ?? null,
        recommendations: recommendations ?? [],
        isDeload,
        regenerationResult
    };
}

/**
 * Main entry: regenerate next week protocol and save.
 * @param {string} userId
 * @param {Object} userProfile - { goal, weight, primary_goal, ... }
 * @param {Object} currentProtocol - Active protocol (can be null, will be fetched)
 * @param {Object} currentPlan - apiPlan (can be null, will use protocol.apiPlan)
 * @returns {{ status: 'advanced'|'completed'|'no_protocol', protocol?: Object, snapshot?: Object, regenerationResult?: Object }}
 */
export function regenerateNextWeekProtocol(userId, userProfile, currentProtocol = null, currentPlan = null) {
    const protocol = currentProtocol ?? getActiveProtocol(userId);
    if (!protocol) return { status: 'no_protocol' };
    if (protocol.status === 'completed') return { status: 'completed' };

    const plan = currentPlan ?? protocol.apiPlan;
    const goal = userProfile?.goal || userProfile?.primary_goal || protocol.meta?.goal || protocol.goal || 'recomp';

    // Build progress data from latest entry
    const latest = getLatestProgress(userId);
    const history = getProgressHistory(userId);
    const baseline = history.length > 1 ? history[history.length - 1] : latest;
    const progressData = latest ? {
        bodyWeight: latest.bodyWeight,
        baselineWeight: baseline?.bodyWeight ?? latest.bodyWeight,
        strengthChange: latest.strengthChange ?? 0,
        fatigueLevel: latest.fatigueLevel ?? 5,
        adherence: latest.adherence ?? 100,
        sleepScore: latest.sleepScore ?? 7,
        injuries: latest.injuries ?? [],
        weeksSinceStart: history.length
    } : null;

    // Get adaptation and recommendations (pass limitations for injury-aware adaptation)
    let adaptation = null;
    let recommendations = [];
    const profileWithLimitations = { ...userProfile, limitations: protocol.meta?.limitations || 'none' };
    if (progressData) {
        adaptation = evaluateProgress(profileWithLimitations, plan, progressData);
        recommendations = generateRecommendations(adaptation, progressData, goal);
    }

    const weekNumber = protocol.currentWeek ?? 1;
    const rawInput = { ...userProfile, primary_goal: goal, weight: userProfile?.weight ?? 80, limitations: protocol.meta?.limitations || 'none' };

    const snapshot = buildNextWeekSnapshot(
        protocol,
        weekNumber,
        progressData,
        adaptation,
        recommendations,
        userProfile,
        rawInput
    );

    const result = advanceProtocolWeek(userId, {
        ...snapshot,
        regenerationResult: snapshot.regenerationResult
    });

    if (!result) return { status: 'no_protocol' };
    if (protocol.currentWeek !== undefined && (protocol.currentWeek + 1) > (protocol.durationWeeks ?? 8)) {
        return { status: 'completed', protocol: result, snapshot, regenerationResult: snapshot.regenerationResult };
    }

    return {
        status: 'advanced',
        protocol: result,
        snapshot,
        regenerationResult: snapshot.regenerationResult
    };
}
