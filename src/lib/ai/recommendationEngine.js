/**
 * ASCEND AI PROTOCOL - Recommendation Engine
 * Translates adaptive evaluation results into actionable coaching recommendations.
 * Phase 9: Adds injury-specific recovery notes when injuries exist.
 * Rule-based. No OpenAI required.
 */

import { getInjuryWarnings, normalizeInjuries } from './injuryAdjustmentEngine.js';

/** Weight loss rate threshold: > 1 kg/week = too fast (fat_loss goal) */
const WEIGHT_LOSS_TOO_FAST = 1.0;

/** Strength change: -1 = regression */
const STRENGTH_REGRESSION = -1;

/** Fatigue threshold (1-10): >= 7 = high fatigue */
const FATIGUE_HIGH_THRESHOLD = 7;

/** Sleep score threshold (1-10): <= 5 = poor sleep */
const SLEEP_POOR_THRESHOLD = 5;

/** Adherence threshold (%): < 70 = low adherence */
const ADHERENCE_LOW_THRESHOLD = 70;

/**
 * Generate coaching recommendations from adaptive engine output and progress data.
 * @param {Object} adaptation - Result from evaluateProgress (adaptiveEngine)
 * @param {Object} progressData - { bodyWeight, baselineWeight, strengthChange, fatigueLevel, adherence, sleepScore, injuries, weeksSinceStart }
 * @param {string} goal - User goal (fat_loss, muscle_gain, recomp, etc.)
 * @returns {Array<{ type: "training"|"nutrition"|"recovery", priority: "low"|"medium"|"high", message: string, action: string }>}
 */
export function generateRecommendations(adaptation, progressData, goal = 'recomposition') {
    const recs = [];
    if (!adaptation || !progressData) return recs;

    const weightChangePerWeek = adaptation.metadata?.weightChangePerWeek ?? 0;
    const weightLossRate = goal === 'fat_loss' ? -weightChangePerWeek : 0;
    const strengthChange = parseFloat(progressData.strengthChange) ?? 0;
    const fatigueLevel = parseFloat(progressData.fatigueLevel) ?? 5;
    const sleepScore = parseFloat(progressData.sleepScore) ?? 7;
    const adherence = parseFloat(progressData.adherence) ?? 100;

    // 1. Weight loss too fast
    if (goal === 'fat_loss' && weightLossRate > WEIGHT_LOSS_TOO_FAST) {
        recs.push({
            type: 'nutrition',
            priority: 'high',
            message: 'Weight loss rate exceeds 1 kg/week. Risk of muscle loss.',
            action: 'Increase calories by 200 kcal'
        });
    }

    // 2. Strength regression
    if (strengthChange <= STRENGTH_REGRESSION) {
        recs.push({
            type: 'training',
            priority: 'high',
            message: 'Strength regression detected. Recovery may be insufficient.',
            action: 'Deload week or reduce load by 10%'
        });
    }

    // 3. High fatigue
    if (fatigueLevel >= FATIGUE_HIGH_THRESHOLD) {
        recs.push({
            type: 'recovery',
            priority: 'high',
            message: 'Fatigue level is elevated. Overtraining risk.',
            action: 'Reduce training volume by 20%'
        });
    }

    // 4. Poor sleep
    if (sleepScore <= SLEEP_POOR_THRESHOLD) {
        recs.push({
            type: 'recovery',
            priority: 'high',
            message: 'Sleep quality is low. Recovery and performance are impacted.',
            action: 'Prioritize recovery and reduce intensity'
        });
    }

    // 5. Low adherence
    if (adherence < ADHERENCE_LOW_THRESHOLD) {
        recs.push({
            type: 'training',
            priority: 'medium',
            message: 'Program adherence is below target. Complexity may be a barrier.',
            action: 'Simplify program structure'
        });
    }

    // Derive from adaptation signals (nutrition calorie change)
    const calorieChange = adaptation.nutritionAdjustments?.calorieChange ?? 0;
    if (calorieChange > 0 && goal === 'fat_loss' && !recs.some(r => r.type === 'nutrition' && r.action.includes('Increase'))) {
        recs.push({
            type: 'nutrition',
            priority: 'medium',
            message: 'Adaptive engine suggests increasing intake.',
            action: `Increase calories by ${calorieChange} kcal`
        });
    }

    // Deload from adaptation
    if (adaptation.triggerDeload && !recs.some(r => r.action.includes('Deload'))) {
        recs.push({
            type: 'training',
            priority: 'high',
            message: 'Deload week recommended by adaptive engine.',
            action: 'Deload week: reduce volume and intensity by 40–50%'
        });
    }

    // Phase 9: Injury-specific recovery notes when injuries exist
    const injuries = progressData.injuries ?? [];
    const assessmentLimitation = progressData.limitations || 'none';
    const normalizedInjuries = normalizeInjuries(assessmentLimitation, injuries);
    if (normalizedInjuries.length > 0) {
        const injuryWarnings = getInjuryWarnings(normalizedInjuries);
        for (const msg of injuryWarnings) {
            if (!recs.some(r => r.message === msg)) {
                recs.push({
                    type: 'recovery',
                    priority: 'medium',
                    message: msg,
                    action: 'Follow modified exercise selections in your plan'
                });
            }
        }
    }

    // Sort: high first, then medium, then low; then by type order (recovery, training, nutrition)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const typeOrder = { recovery: 0, training: 1, nutrition: 2 };
    recs.sort((a, b) => {
        const p = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (p !== 0) return p;
        return typeOrder[a.type] - typeOrder[b.type];
    });

    return recs;
}
