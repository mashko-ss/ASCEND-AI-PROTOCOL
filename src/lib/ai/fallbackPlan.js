/**
 * ASCEND AI PROTOCOL - AI Engine Fallback Plan
 * Generate a minimal safe fallback plan when generation fails.
 */

import { buildWeeklyPlanFromInput } from './generatePlan.js';
import { classifyUser } from './classifyUser.js';

/**
 * Generate a minimal safe fallback plan.
 * When normalizedInput is provided, uses split-specific day templates (chest_triceps, back_biceps, legs, etc.).
 * @param {Object} [normalizedInput] - Optional; when provided, builds split-specific unique days
 * @returns {Object} Fallback plan in the standard output shape
 */
export function generateFallbackPlan(normalizedInput) {
    const hasInput = normalizedInput && typeof normalizedInput === 'object';
    const weeklyPlan = hasInput
        ? buildWeeklyPlanFromInput(normalizedInput)
        : getDefaultWeeklyPlan();

    const classification = hasInput ? classifyUser(normalizedInput) : null;
    const splitType = hasInput ? (classification?.splitType || normalizedInput?.splitType || 'full_body') : 'full_body';
    const days = weeklyPlan.length;
    const sessionDurationMin = hasInput ? (normalizedInput.sessionDurationMin ?? 60) : 60;
    const equipmentAccess = hasInput ? (normalizedInput.equipmentAccess || 'home_basic') : 'home_basic';
    const experienceLevel = hasInput ? (classification?.experienceLevel || 'beginner') : 'beginner';
    const goal = hasInput ? (classification?.goal || 'recomposition') : 'recomposition';

    return {
        planMeta: {
            goal,
            experienceLevel,
            splitType,
            trainingDaysPerWeek: days,
            sessionDurationMin,
            equipmentAccess,
            difficulty: experienceLevel === 'beginner' ? 'low' : (experienceLevel === 'advanced' ? 'high' : 'moderate')
        },
        userSummary: {
            classificationLabel: hasInput ? `Fallback · ${experienceLevel} · ${days}x/week` : 'Fallback · Beginner · 3x/week',
            recoveryProfile: 'moderate',
            scheduleProfile: 'standard',
            notes: ['This is a safe fallback plan. Consider retaking the assessment for a personalized plan.']
        },
        weeklyPlan,
        progressionRules: {
            method: 'Linear: add weight or reps each week',
            weeklyAdjustment: 'Add 1-2 reps or 2.5% weight when all sets completed',
            deloadTrigger: 'Every 4th week'
        },
        recoveryGuidance: {
            restDayCount: 4,
            sleepTargetHours: '7-9',
            hydrationGuidance: '2.5-3.5 L water daily.'
        },
        warnings: ['This is a fallback plan. Retake the assessment for a personalized plan.']
    };
}

/** Default 3-day full-body plan when no input is available. */
function getDefaultWeeklyPlan() {
    return [
        {
            dayIndex: 1,
            dayName: 'Monday',
            focus: 'Full Body',
            sessionType: 'strength',
            durationMin: 60,
            warmup: [{ name: 'Light cardio + dynamic stretches', durationMin: 5 }],
            mainBlocks: [{
                blockName: 'Main Workout',
                exerciseType: 'compound',
                exercises: [
                    { name: 'Squat or Leg Press', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
                    { name: 'Push-up or Bench Press', sets: 3, reps: '8-10', restSec: 90, intensity: 'moderate', notes: '' },
                    { name: 'Row or Pull-up', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
                    { name: 'Plank', sets: 2, reps: '30-60s', restSec: 45, intensity: 'easy', notes: '' }
                ]
            }],
            cooldown: [{ name: 'Static stretching', durationMin: 5 }]
        },
        {
            dayIndex: 2,
            dayName: 'Wednesday',
            focus: 'Full Body',
            sessionType: 'hypertrophy',
            durationMin: 60,
            warmup: [{ name: 'Light cardio + dynamic stretches', durationMin: 5 }],
            mainBlocks: [{
                blockName: 'Main Workout',
                exerciseType: 'compound',
                exercises: [
                    { name: 'Romanian Deadlift', sets: 3, reps: '10-12', restSec: 90, intensity: 'moderate', notes: '' },
                    { name: 'Overhead Press', sets: 3, reps: '8-10', restSec: 60, intensity: 'moderate', notes: '' },
                    { name: 'Lunges', sets: 3, reps: '10 per leg', restSec: 60, intensity: 'moderate', notes: '' },
                    { name: 'Core work', sets: 2, reps: '30-60s', restSec: 45, intensity: 'easy', notes: '' }
                ]
            }],
            cooldown: [{ name: 'Static stretching', durationMin: 5 }]
        },
        {
            dayIndex: 3,
            dayName: 'Friday',
            focus: 'Full Body',
            sessionType: 'mixed',
            durationMin: 60,
            warmup: [{ name: 'Light cardio + dynamic stretches', durationMin: 5 }],
            mainBlocks: [{
                blockName: 'Main Workout',
                exerciseType: 'compound',
                exercises: [
                    { name: 'Squat or Leg Press', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
                    { name: 'Row or Pull-up', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
                    { name: 'Push-up or Bench Press', sets: 3, reps: '8-10', restSec: 90, intensity: 'moderate', notes: '' },
                    { name: 'Plank', sets: 2, reps: '30-60s', restSec: 45, intensity: 'easy', notes: '' }
                ]
            }],
            cooldown: [{ name: 'Static stretching', durationMin: 5 }]
        }
    ];
}
