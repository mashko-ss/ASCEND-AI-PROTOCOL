/**
 * ASCEND AI PROTOCOL - Adaptive Progression Engine
 * Phase 4: Evaluate progress signals and return adaptation recommendations.
 * Phase 9: Integrates injury warnings when injuries exist.
 * Deterministic rules. No OpenAI required.
 */

import { getInjuryWarnings, normalizeInjuries } from './injuryAdjustmentEngine.js';
import { shouldTriggerDeload as periodizationShouldTriggerDeload } from './periodizationEngine.js';

/** Strength change thresholds: positive = improving, 0 = plateau, negative = regression */
const STRENGTH_INCREASING = 1;
const STRENGTH_PLATEAU_MAX = 0;
const STRENGTH_REGRESSION = -1;

/** Load progression when strength increasing (%) */
const LOAD_PROGRESSION_INCREASE = { min: 2, max: 5 };

/** Fat loss: weight change per week (kg) - too fast = > 1, too slow = < 0.2 */
const WEIGHT_LOSS_TOO_FAST = 1.0;
const WEIGHT_LOSS_TOO_SLOW = 0.2;

/** Fatigue threshold (1-10 scale, 10 = very fatigued) - above this reduce volume */
const FATIGUE_HIGH_THRESHOLD = 7;

/** Sleep threshold (1-10 scale, 10 = great sleep) - below this reduce intensity */
const SLEEP_POOR_THRESHOLD = 5;

/** Deload cycle: every N weeks */
const DELOAD_WEEK_INTERVAL = { min: 4, max: 6 };

/** Calorie adjustment steps (kcal) */
const CALORIE_STEP = 100;
const CALORIE_STEP_LARGE = 200;

/** Volume change: sets or sessions adjustment */
const VOLUME_REDUCE_PCT = 0.2;
const VOLUME_INCREASE_PCT = 0.1;

/** Cardio minutes change */
const CARDIO_MINUTES_STEP = 10;

/**
 * Normalize progress input.
 * @param {Object} progressData
 * @returns {Object}
 */
function normalizeProgressInput(progressData) {
    if (!progressData || typeof progressData !== 'object') return {};
    return {
        bodyWeight: parseFloat(progressData.bodyWeight) || null,
        baselineWeight: parseFloat(progressData.baselineWeight) ?? parseFloat(progressData.bodyWeight) ?? null,
        strengthChange: parseFloat(progressData.strengthChange) ?? 0,
        fatigueLevel: Math.max(1, Math.min(10, parseFloat(progressData.fatigueLevel) || 5)),
        adherence: Math.max(0, Math.min(100, parseFloat(progressData.adherence) || 100)),
        sleepScore: Math.max(1, Math.min(10, parseFloat(progressData.sleepScore) || 7)),
        injuries: Array.isArray(progressData.injuries) ? progressData.injuries : (progressData.injuries ? [String(progressData.injuries)] : []),
        weeksSinceStart: Math.max(0, parseInt(progressData.weeksSinceStart, 10) || 0)
    };
}

/**
 * Evaluate strength progress and return training adjustments.
 * @param {number} strengthChange - positive = improving, 0 = plateau, negative = regression
 * @returns {{ volumeChange: number, intensityChange: number, loadProgression: number }}
 */
function evaluateStrengthProgress(strengthChange) {
    let volumeChange = 0;
    let intensityChange = 0;
    let loadProgression = 0;

    if (strengthChange > STRENGTH_INCREASING) {
        loadProgression = (LOAD_PROGRESSION_INCREASE.min + LOAD_PROGRESSION_INCREASE.max) / 2;
    } else if (strengthChange <= STRENGTH_PLATEAU_MAX && strengthChange > STRENGTH_REGRESSION) {
        volumeChange = VOLUME_INCREASE_PCT;
    } else if (strengthChange <= STRENGTH_REGRESSION) {
        volumeChange = -VOLUME_REDUCE_PCT;
        loadProgression = -2;
    }

    return { volumeChange, intensityChange, loadProgression };
}

/**
 * Evaluate fat loss progress (weight change) and return nutrition/cardio adjustments.
 * @param {number} weightChangePerWeek - kg per week (negative = loss)
 * @param {string} goal
 * @returns {{ calorieChange: number, cardioMinutesChange: number }}
 */
function evaluateFatLossProgress(weightChangePerWeek, goal) {
    if (goal !== 'fat_loss') return { calorieChange: 0, cardioMinutesChange: 0 };

    let calorieChange = 0;
    let cardioMinutesChange = 0;
    const lossRate = -weightChangePerWeek;

    if (lossRate > WEIGHT_LOSS_TOO_FAST) {
        calorieChange = CALORIE_STEP_LARGE;
    } else if (lossRate < WEIGHT_LOSS_TOO_SLOW && lossRate >= 0) {
        calorieChange = -CALORIE_STEP;
        cardioMinutesChange = CARDIO_MINUTES_STEP;
    }

    return { calorieChange, cardioMinutesChange };
}

/**
 * Evaluate fatigue and sleep for recovery adjustments.
 * @param {number} fatigueLevel - 1-10, 10 = very fatigued
 * @param {number} sleepScore - 1-10, 10 = great sleep
 * @returns {{ volumeChange: number, intensityChange: number, recoveryRecommendations: string[] }}
 */
function evaluateFatigueAndSleep(fatigueLevel, sleepScore) {
    let volumeChange = 0;
    let intensityChange = 0;
    const recoveryRecommendations = [];

    if (fatigueLevel >= FATIGUE_HIGH_THRESHOLD) {
        volumeChange -= VOLUME_REDUCE_PCT;
        recoveryRecommendations.push('Reduce training volume by 20% this week.');
    }
    if (sleepScore < SLEEP_POOR_THRESHOLD) {
        intensityChange -= 0.1;
        recoveryRecommendations.push('Prioritize sleep; consider reducing intensity until sleep improves.');
    }
    if (fatigueLevel >= FATIGUE_HIGH_THRESHOLD && sleepScore < SLEEP_POOR_THRESHOLD) {
        recoveryRecommendations.push('Consider a deload week to recover.');
    }

    return { volumeChange, intensityChange, recoveryRecommendations };
}

/**
 * Check if deload week should be triggered.
 * Phase 10: Delegates to periodization engine for unified logic.
 * @param {number} weeksSinceStart
 * @param {Object} progressData
 * @returns {boolean}
 */
function shouldTriggerDeload(weeksSinceStart, progressData) {
    if (weeksSinceStart <= 0) return false;
    return periodizationShouldTriggerDeload({ ...progressData, weeksSinceStart });
}

/**
 * Build recovery recommendations from injuries.
 * Phase 9: Uses injury adjustment engine for specific warnings.
 * @param {string[]} injuries - Raw injury strings from progress
 * @param {string} assessmentLimitation - From assessment (e.g. 'shoulders', 'lower_back')
 * @returns {string[]}
 */
function getInjuryRecommendations(injuries, assessmentLimitation = 'none') {
    if (!injuries?.length && (!assessmentLimitation || assessmentLimitation === 'none')) return [];
    const normalized = normalizeInjuries(assessmentLimitation, injuries);
    if (normalized.length === 0) return ['Modify or avoid exercises that aggravate reported areas. Consider extra mobility work.'];
    return getInjuryWarnings(normalized);
}

/**
 * Main entry: evaluate progress and return adaptation object.
 * @param {Object} userProfile - Normalized user (weight, goal, activity, etc.)
 * @param {Object} currentPlan - Plan with planMeta, weeklyPlan, progressionRules
 * @param {Object} progressData - { bodyWeight, strengthChange, fatigueLevel, adherence, sleepScore, injuries, baselineWeight?, weeksSinceStart? }
 * @returns {Object} Adaptation object
 */
export function evaluateProgress(userProfile, currentPlan, progressData) {
    const profile = userProfile || {};
    const plan = currentPlan || {};
    const prog = normalizeProgressInput(progressData);

    const goal = profile.goal || profile.primary_goal || plan.planMeta?.goal || 'recomposition';
    const baselineWeight = prog.baselineWeight ?? profile.weight ?? 80;
    const currentWeight = prog.bodyWeight ?? baselineWeight;
    const weeksSinceStart = prog.weeksSinceStart || 1;
    const weightChangePerWeek = weeksSinceStart > 0 ? (currentWeight - baselineWeight) / weeksSinceStart : 0;

    const trainingAdjustments = { volumeChange: 0, intensityChange: 0, loadProgression: 0 };
    const cardioAdjustments = { cardioMinutesChange: 0 };
    const nutritionAdjustments = { calorieChange: 0 };
    const recoveryRecommendations = [];

    // Strength progress
    const strengthAdj = evaluateStrengthProgress(prog.strengthChange);
    trainingAdjustments.volumeChange += strengthAdj.volumeChange;
    trainingAdjustments.intensityChange += strengthAdj.intensityChange;
    trainingAdjustments.loadProgression += strengthAdj.loadProgression;

    // Fat loss progress
    const fatLossAdj = evaluateFatLossProgress(weightChangePerWeek, goal);
    nutritionAdjustments.calorieChange += fatLossAdj.calorieChange;
    cardioAdjustments.cardioMinutesChange += fatLossAdj.cardioMinutesChange;

    // Fatigue and sleep
    const fatigueAdj = evaluateFatigueAndSleep(prog.fatigueLevel, prog.sleepScore);
    trainingAdjustments.volumeChange += fatigueAdj.volumeChange;
    trainingAdjustments.intensityChange += fatigueAdj.intensityChange;
    recoveryRecommendations.push(...fatigueAdj.recoveryRecommendations);

    // Injury flags (Phase 9: uses injury engine for specific warnings)
    const assessmentLimitation = profile.limitations || plan.planMeta?.limitations || 'none';
    recoveryRecommendations.push(...getInjuryRecommendations(prog.injuries, assessmentLimitation));

    // Deload system
    const triggerDeload = shouldTriggerDeload(weeksSinceStart, prog);
    if (triggerDeload) {
        trainingAdjustments.volumeChange = Math.min(trainingAdjustments.volumeChange, -0.4);
        trainingAdjustments.intensityChange = Math.min(trainingAdjustments.intensityChange, -0.15);
        recoveryRecommendations.push('Deload week: reduce volume and intensity by 40–50% to recover.');
    }

    const adaptation = {
        trainingAdjustments: {
            volumeChange: Math.round(trainingAdjustments.volumeChange * 1000) / 1000,
            intensityChange: Math.round(trainingAdjustments.intensityChange * 1000) / 1000,
            loadProgression: trainingAdjustments.loadProgression
        },
        cardioAdjustments: {
            cardioMinutesChange: cardioAdjustments.cardioMinutesChange
        },
        nutritionAdjustments: {
            calorieChange: nutritionAdjustments.calorieChange
        },
        recoveryRecommendations: [...new Set(recoveryRecommendations)].filter(Boolean),
        triggerDeload,
        metadata: {
            goal,
            weightChangePerWeek: Math.round(weightChangePerWeek * 1000) / 1000,
            weeksSinceStart
        }
    };

    return adaptation;
}

/**
 * Evaluate progress and log result to console. Use when integrating with weekly check-in flow.
 * @param {Object} userProfile
 * @param {Object} currentPlan
 * @param {Object} progressData
 * @returns {Object} Adaptation object
 */
export function evaluateProgressWithLog(userProfile, currentPlan, progressData) {
    const adaptation = evaluateProgress(userProfile, currentPlan, progressData);
    if (typeof console !== 'undefined' && console.log) {
        console.log('[ASCEND Adaptive Engine] Progress evaluated:', adaptation);
    }
    return adaptation;
}
