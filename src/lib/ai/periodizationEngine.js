/**
 * ASCEND AI PROTOCOL - Periodization Engine
 * Phase 10: Structure training programs across multiple weeks with
 * intelligent training phases and deload cycles.
 * Vanilla JS, modular. No UI changes.
 */

/** Supported phases */
const PHASES = ['hypertrophy', 'strength', 'conditioning', 'fat_loss', 'recovery', 'deload'];

/** Phase behavior definitions */
const PHASE_BEHAVIOR = {
    hypertrophy: {
        reps: '8-12',
        volume: 'high',
        intensity: 'medium',
        volumeMult: 1.0,
        intensityMult: 1.0,
        restSecMult: 1.0,
        circuitsAllowed: false,
        supersetsAllowed: false,
        mobilityEmphasis: false
    },
    strength: {
        reps: '3-6',
        volume: 'medium',
        intensity: 'high',
        volumeMult: 0.85,
        intensityMult: 1.1,
        restSecMult: 1.2,
        circuitsAllowed: false,
        supersetsAllowed: false,
        mobilityEmphasis: false
    },
    conditioning: {
        reps: '10-15',
        volume: 'medium',
        intensity: 'medium',
        volumeMult: 0.9,
        intensityMult: 0.95,
        restSecMult: 0.7,
        circuitsAllowed: true,
        supersetsAllowed: true,
        mobilityEmphasis: false
    },
    fat_loss: {
        reps: '8-12',
        volume: 'high',
        intensity: 'medium',
        volumeMult: 1.0,
        intensityMult: 0.95,
        restSecMult: 0.75,
        circuitsAllowed: true,
        supersetsAllowed: true,
        mobilityEmphasis: false
    },
    recovery: {
        reps: '8-15',
        volume: 'low',
        intensity: 'low',
        volumeMult: 0.6,
        intensityMult: 0.7,
        restSecMult: 1.0,
        circuitsAllowed: false,
        supersetsAllowed: false,
        mobilityEmphasis: true
    },
    deload: {
        reps: '6-10',
        volume: 'low',
        intensity: 'medium-low',
        volumeMult: 0.6,
        intensityMult: 0.8,
        restSecMult: 1.0,
        circuitsAllowed: false,
        supersetsAllowed: false,
        mobilityEmphasis: true
    }
};

/** Deload cycle: every N weeks (aligned with protocolEngine) */
const DELOAD_INTERVAL = { short: 4, long: 5 };

/** Deload volume reduction (~40%) */
const DELOAD_VOLUME_FACTOR = 0.6;

/** Deload intensity reduction (~20%) */
const DELOAD_INTENSITY_FACTOR = 0.8;

/** Fatigue threshold (1-10): >= 7 = consider deload */
const FATIGUE_DELOAD_THRESHOLD = 7;

/** Strength regression: <= -1 = consider deload */
const STRENGTH_REGRESSION_THRESHOLD = -1;

/** Default duration by goal (weeks) */
const DURATION_BY_GOAL = {
    fat_loss: 8,
    muscle_gain: 12,
    recomp: 8,
    longevity: 8,
    endurance: 6
};

/**
 * Compute deload weeks for protocol duration.
 * Every 4th week for short (8-week), every 5th for long (12-week).
 * @param {number} durationWeeks
 * @returns {number[]}
 */
function computeDeloadWeeks(durationWeeks) {
    const deloads = [];
    const interval = durationWeeks <= 8 ? DELOAD_INTERVAL.short : DELOAD_INTERVAL.long;
    for (let w = interval; w < durationWeeks; w += interval) {
        deloads.push(w);
    }
    return deloads;
}

/**
 * Create a periodization block for a goal.
 * @param {string} goal - fat_loss | muscle_gain | recomp | longevity | endurance
 * @returns {{ phaseSequence: string[], deloadWeeks: number[], durationWeeks: number, phaseMap: Object }}
 */
export function createPeriodizationBlock(goal) {
    const g = goal || 'recomp';
    const durationWeeks = DURATION_BY_GOAL[g] ?? 8;
    const deloadWeeks = computeDeloadWeeks(durationWeeks);

    const phaseMap = {};
    let week = 1;
    while (week <= durationWeeks) {
        phaseMap[week] = getWeekPhase(g, week, deloadWeeks);
        week++;
    }

    const phaseSequence = [...new Set(Object.values(phaseMap))];

    return {
        phaseSequence,
        deloadWeeks,
        durationWeeks,
        phaseMap
    };
}

/**
 * Get the training phase for a given week.
 * @param {string} goal - fat_loss | muscle_gain | recomp | longevity | endurance
 * @param {number} weekNumber - 1-based week index
 * @param {number[]} deloadWeeks - Optional; computed if not provided
 * @returns {string} Phase name
 */
export function getWeekPhase(goal, weekNumber, deloadWeeks = null) {
    const g = goal || 'recomp';
    const w = Math.max(1, parseInt(weekNumber, 10) || 1);
    const duration = DURATION_BY_GOAL[g] ?? 8;
    const deloads = deloadWeeks ?? computeDeloadWeeks(duration);

    if (deloads.includes(w)) return 'deload';

    switch (g) {
        case 'fat_loss':
            return w % 2 === 0 ? 'conditioning' : 'fat_loss';
        case 'muscle_gain':
            return w % 3 === 0 ? 'strength' : 'hypertrophy';
        case 'endurance':
            return 'conditioning';
        case 'longevity':
            return w % 4 === 3 ? 'recovery' : 'hypertrophy';
        case 'recomp':
        default:
            return w % 4 === 3 ? 'strength' : 'hypertrophy';
    }
}

/**
 * Apply phase adjustments to a training plan.
 * @param {Object} trainingPlan - Plan with weeklyPlan, mainBlocks, exercises
 * @param {string} phase - Phase name
 * @returns {{ adjustedPlan: Object, adjustments: { intensity: number, volume: number, repRange: string } }}
 */
export function applyPhaseToPlan(trainingPlan, phase) {
    const result = {
        adjustedPlan: trainingPlan ? JSON.parse(JSON.stringify(trainingPlan)) : null,
        adjustments: {
            intensity: 1,
            volume: 1,
            repRange: '8-12'
        }
    };

    if (!result.adjustedPlan?.weeklyPlan || !PHASES.includes(phase)) {
        return result;
    }

    const behavior = PHASE_BEHAVIOR[phase] || PHASE_BEHAVIOR.hypertrophy;
    result.adjustments.intensity = behavior.intensityMult;
    result.adjustments.volume = behavior.volumeMult;
    result.adjustments.repRange = behavior.reps;

    const weeklyPlan = result.adjustedPlan.weeklyPlan;
    for (const day of weeklyPlan) {
        const blocks = day.mainBlocks || [];
        for (const block of blocks) {
            const exercises = block.exercises || [];
            for (const ex of exercises) {
                const sets = parseInt(ex.sets, 10) || 3;
                ex.sets = Math.max(1, Math.round(sets * behavior.volumeMult));
                ex.reps = behavior.reps;
                if (ex.restSec != null) {
                    ex.restSec = Math.max(30, Math.round(ex.restSec * behavior.restSecMult));
                }
                if (ex.rpe != null && ex.rpe !== '') {
                    const rpe = parseFloat(ex.rpe) || 7;
                    ex.rpe = String(Math.max(5, Math.min(10, Math.round(rpe * behavior.intensityMult * 10) / 10)));
                }
            }
        }
    }

    if (result.adjustedPlan.planMeta) {
        result.adjustedPlan.planMeta = { ...result.adjustedPlan.planMeta };
        result.adjustedPlan.planMeta.currentPhase = phase;
    }

    return result;
}

/**
 * Check if deload should be triggered based on progress data.
 * @param {Object} progressData - { fatigueLevel, strengthChange, weeksSinceStart, sleepScore, adherence }
 * @returns {boolean}
 */
export function shouldTriggerDeload(progressData) {
    if (!progressData || typeof progressData !== 'object') return false;

    const fatigue = parseFloat(progressData.fatigueLevel) ?? 5;
    const strengthChange = parseFloat(progressData.strengthChange) ?? 0;
    const weeksSinceStart = parseInt(progressData.weeksSinceStart, 10) || 0;
    const sleepScore = parseFloat(progressData.sleepScore) ?? 7;

    if (fatigue >= FATIGUE_DELOAD_THRESHOLD) return true;
    if (strengthChange <= STRENGTH_REGRESSION_THRESHOLD) return true;
    if (fatigue >= 6 && sleepScore < 5) return true;

    const cycleLength = 4;
    if (weeksSinceStart > 0 && weeksSinceStart % cycleLength === 0) return true;

    return false;
}

/**
 * Get phase adjustments for a given phase (for display or integration).
 * @param {string} phase
 * @returns {{ phase: string, adjustments: { intensity: number, volume: number, repRange: string } }}
 */
export function getPhaseAdjustments(phase) {
    const behavior = PHASE_BEHAVIOR[phase] || PHASE_BEHAVIOR.hypertrophy;
    return {
        phase,
        adjustments: {
            intensity: behavior.intensityMult,
            volume: behavior.volumeMult,
            repRange: behavior.reps
        }
    };
}
