/**
 * ASCEND AI PROTOCOL - Workout Generator Engine
 * Phase 12: Safe data-layer workout generation. Produces structured workout output
 * based on user profile. Does NOT modify UI. Respects Phase 11 injury constraints.
 */

import { buildWeeklyPlanFromInput } from './generatePlan.js';
import { normalizeInput } from './normalizeInput.js';
import { normalizeInjuries, adjustExerciseForInjury } from './injuryAdjustmentEngine.js';
import { getInjuryState } from './injuryRecoveryEngine.js';
import { getLatestProgress } from './progressTracker.js';

/**
 * Format internal exercise to output structure.
 * @param {Object} ex - { name, sets, reps, restSec?, intensity?, notes }
 * @returns {{ name: string, sets: number, reps: string, rest: string, notes: string }}
 */
function toOutputExercise(ex) {
    if (!ex || !ex.name) return null;
    const restSec = ex.restSec ?? 90;
    return {
        name: String(ex.name),
        sets: Math.max(1, parseInt(ex.sets, 10) || 3),
        reps: String(ex.reps || '8-12'),
        rest: restSec > 0 ? `${restSec}s` : '',
        notes: String(ex.notes || '')
    };
}

/**
 * Apply injury adjustments to an exercise and return output format.
 * @param {Object} ex
 * @param {string[]} injuries
 * @returns {{ name: string, sets: number, reps: string, rest: string, notes: string }}
 */
function applyInjuryAndFormat(ex, injuries) {
    if (!ex) return null;
    const { adjusted } = adjustExerciseForInjury(ex, injuries);
    return toOutputExercise(adjusted);
}

/**
 * Categorize exercises into main (compound), accessory (isolation), finisher.
 * Plan templates order compound first, then isolation; core/conditioning last.
 * @param {Object[]} exercises - Raw exercises from plan
 * @param {string[]} injuries - Normalized injury categories
 * @returns {{ main: Array, accessory: Array, finisher: Array }}
 */
function categorizeExercises(exercises, injuries) {
    const main = [];
    const accessory = [];
    const finisher = [];

    const finisherKeywords = ['plank', 'core', 'conditioning', 'burpee', 'jump', 'mountain climber', 'stretch', 'mobility', 'cardio'];
    const formatted = exercises
        .map(ex => applyInjuryAndFormat(ex, injuries))
        .filter(Boolean);

    for (let i = 0; i < formatted.length; i++) {
        const ex = formatted[i];
        const nameLower = (ex.name || '').toLowerCase();
        const isFinisherType = finisherKeywords.some(k => nameLower.includes(k));

        if (isFinisherType && i >= formatted.length - 2) {
            finisher.push(ex);
        } else if (main.length < 4) {
            main.push(ex);
        } else {
            accessory.push(ex);
        }
    }

    return { main, accessory, finisher };
}

/**
 * Build warmup array for output.
 * @param {Object} day - Day from weeklyPlan
 * @returns {Array}
 */
function buildWarmup(day) {
    const warmupBlock = day.warmup || [];
    const first = warmupBlock[0];
    const name = first?.name || 'Light cardio + dynamic stretches';
    const dur = first?.durationMin ?? 5;
    return [{
        name: String(name),
        sets: 1,
        reps: `${dur} min`,
        rest: '',
        notes: "For the muscles you'll train today"
    }];
}

/**
 * Build cooldown array for output.
 * @param {Object} day - Day from weeklyPlan
 * @returns {Array}
 */
function buildCooldown(day) {
    const cooldownBlock = day.cooldown || [];
    const first = cooldownBlock[0];
    const name = first?.name || 'Static stretching + breathing';
    const dur = first?.durationMin ?? 5;
    return [{
        name: String(name),
        sets: 1,
        reps: `${dur} min`,
        rest: '',
        notes: ''
    }];
}

/**
 * Map focus string to dayType for output.
 * @param {string} focus
 * @returns {string}
 */
function focusToDayType(focus) {
    if (!focus) return 'Full Body';
    const f = String(focus).toLowerCase();
    if (f.includes('upper body')) return 'Upper Body';
    if (f.includes('lower body')) return 'Lower Body';
    if (f.includes('push') && (f.includes('chest') || f.includes('tricep'))) return 'Push (Chest, Shoulders, Triceps)';
    if (f.includes('pull') && (f.includes('back') || f.includes('bicep'))) return 'Pull (Back, Biceps)';
    if (f.includes('legs')) return 'Legs';
    if (f.includes('chest') && f.includes('tricep')) return 'Chest & Triceps';
    if (f.includes('back') && f.includes('bicep')) return 'Back & Biceps';
    if (f.includes('shoulder') && f.includes('core')) return 'Shoulders & Core';
    if (f.includes('strength')) return 'Strength Focus';
    if (f.includes('hypertrophy')) return 'Hypertrophy Focus';
    if (f.includes('conditioning')) return 'Conditioning';
    if (f.includes('recovery') || f.includes('mobility')) return 'Recovery / Mobility';
    return focus;
}

/**
 * Resolve injuries from profile and optional userId.
 * @param {Object} profile - User profile with limitations
 * @param {string} [userId] - Optional user id for progress-based injuries
 * @returns {string[]} Normalized injury categories
 */
function resolveInjuries(profile, userId) {
    const assessmentLimitation = profile?.limitations || profile?.limitation || 'none';
    let progressInjuries = [];

    if (userId) {
        const recoveryState = getInjuryState(userId);
        if (recoveryState?.activeInjuries?.length) {
            progressInjuries = recoveryState.activeInjuries;
        }
        const latest = getLatestProgress(userId);
        if (latest?.injuries?.length) {
            progressInjuries = [...progressInjuries, ...latest.injuries];
        }
    }

    return normalizeInjuries(assessmentLimitation, progressInjuries);
}

/**
 * Generate structured workout plan from user profile.
 * Pure data-layer: returns workout objects only. No UI side effects.
 *
 * @param {Object} profile - User profile. Supports:
 *   - goal, primary_goal
 *   - experience, experienceLevel
 *   - days, trainingDaysPerWeek
 *   - duration, sessionDurationMin
 *   - equipment, equipmentAccess
 *   - limitations, limitation (assessment)
 *   Raw assessment keys (age, weight, etc.) also accepted for normalizeInput.
 * @param {Object} [options]
 * @param {string} [options.userId] - User id for Phase 11 injury state (progress-based injuries)
 * @returns {Array<{ dayType: string, warmup: Array, main: Array, accessory: Array, finisher: Array, cooldown: Array }>}
 */
export function generateWorkouts(profile, options = {}) {
    const userId = options?.userId || null;

    const rawInput = profile && typeof profile === 'object' ? {
        primary_goal: profile.goal || profile.primary_goal,
        goal: profile.goal || profile.primary_goal,
        experience: profile.experience || profile.experienceLevel,
        experienceLevel: profile.experienceLevel || profile.experience,
        days: profile.days ?? profile.trainingDaysPerWeek,
        trainingDaysPerWeek: profile.trainingDaysPerWeek ?? profile.days,
        duration: profile.duration ?? profile.sessionDurationMin,
        sessionDurationMin: profile.sessionDurationMin ?? profile.duration,
        equipment: profile.equipment || profile.equipmentAccess,
        equipmentAccess: profile.equipmentAccess || profile.equipment,
        limitations: profile.limitations ?? profile.limitation,
        ...profile
    } : {};

    const normalizedInput = normalizeInput(rawInput);
    const injuries = resolveInjuries(normalizedInput, userId);

    let weeklyPlan;
    try {
        weeklyPlan = buildWeeklyPlanFromInput(normalizedInput);
    } catch (e) {
        weeklyPlan = buildWeeklyPlanFromInput({});
    }

    const result = [];

    for (const day of weeklyPlan || []) {
        const exercises = (day.mainBlocks || []).flatMap(b => b.exercises || []);
        const { main, accessory, finisher } = categorizeExercises(exercises, injuries);

        result.push({
            dayType: focusToDayType(day.focus),
            warmup: buildWarmup(day),
            main,
            accessory,
            finisher,
            cooldown: buildCooldown(day)
        });
    }

    return result;
}

/**
 * Convert generated workouts to flat exercise list format (compatible with existing dashboard).
 * Use when you need to merge with existing workout_plan display.
 *
 * @param {Array} workouts - From generateWorkouts()
 * @returns {Array<{ day: string, focus: string, warmup: string, exercises: Array }>}
 */
export function workoutsToDashboardFormat(workouts) {
    if (!Array.isArray(workouts)) return [];

    return workouts.map(w => {
        const allExercises = [...(w.main || []), ...(w.accessory || []), ...(w.finisher || [])];
        const warmupText = (w.warmup || [])[0]?.name || '5 min light cardio; dynamic stretches for the muscles you\'ll train today.';
        return {
            day: w.dayType,
            focus: w.dayType,
            warmup: warmupText,
            exercises: allExercises.map(e => ({
                name: e.name,
                sets: String(e.sets),
                reps: e.reps,
                rest: e.rest || '90s',
                rpe: '7',
                tempo: '3-1-X-1'
            }))
        };
    });
}
