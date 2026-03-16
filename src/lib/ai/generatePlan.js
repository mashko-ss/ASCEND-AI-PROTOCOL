/**
 * ASCEND AI PROTOCOL - AI Engine Generate Plan
 * Rule-based weekly training plan generation. No AI/OpenAI calls.
 */

import { toSafeArray } from './utils.js';
import { getMaxExercisesForDuration, getEquipmentCompatibleTypes } from './rules.js';
import { classifyUser } from './classifyUser.js';

const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Generate a structured weekly training plan from normalized input.
 * @param {Object} normalizedInput - From normalizeInput()
 * @returns {Object} Generated plan (planMeta, userSummary, weeklyPlan, progressionRules, recoveryGuidance, warnings)
 */
export function generatePlan(normalizedInput) {
    const input = normalizedInput || {};
    const classification = classifyUser(input);

    const goal = classification.goal || 'recomposition';
    const experienceLevel = classification.experienceLevel || 'beginner';
    const splitType = classification.splitType || 'full_body';
    const trainingDaysPerWeek = input.trainingDaysPerWeek ?? 3;
    const sessionDurationMin = input.sessionDurationMin ?? 60;
    const equipmentAccess = input.equipmentAccess || 'home_basic';
    const recoveryProfile = classification.recoveryProfile || 'moderate';
    const scheduleProfile = classification.scheduleProfile || 'standard';

    const difficulty = experienceLevel === 'beginner' ? 'low' : (experienceLevel === 'advanced' ? 'high' : 'moderate');
    const maxExercises = getMaxExercisesForDuration(sessionDurationMin);
    const allowedTypes = getEquipmentCompatibleTypes(equipmentAccess);

    const planMeta = {
        goal,
        experienceLevel,
        splitType,
        trainingDaysPerWeek,
        sessionDurationMin,
        equipmentAccess,
        difficulty
    };

    const userSummary = {
        classificationLabel: classification.classificationLabel || 'User',
        recoveryProfile,
        scheduleProfile,
        notes: toSafeArray(classification.notes)
    };

    const weeklyPlan = buildWeeklyPlan({
        splitType,
        trainingDaysPerWeek,
        sessionDurationMin,
        goal,
        experienceLevel,
        maxExercises,
        allowedTypes,
        equipmentAccess
    });

    const progressionRules = getProgressionRules(goal, experienceLevel);
    const recoveryGuidance = getRecoveryGuidance(trainingDaysPerWeek, recoveryProfile);
    const warnings = buildWarnings(input, classification);

    return {
        planMeta,
        userSummary,
        weeklyPlan,
        progressionRules,
        recoveryGuidance,
        warnings
    };
}

function buildWeeklyPlan(opts) {
    const { splitType, trainingDaysPerWeek, sessionDurationMin, goal, experienceLevel, maxExercises, allowedTypes } = opts;
    const plan = [];
    const dayFocusMap = getDayFocusMap(splitType, trainingDaysPerWeek, goal);

    for (let i = 0; i < trainingDaysPerWeek; i++) {
        const focus = dayFocusMap[i] || 'Full Body';
        const sessionType = getSessionTypeForDay(i, trainingDaysPerWeek, goal);
        const exercises = getExercisesForFocus(focus, sessionType, maxExercises, experienceLevel, allowedTypes);

        const warmup = [
            { name: 'Light cardio + dynamic stretches', durationMin: 5 }
        ];
        const cooldown = [
            { name: 'Static stretching + breathing', durationMin: 5 }
        ];

        const mainBlocks = [
            {
                blockName: focus,
                exerciseType: sessionType === 'conditioning' ? 'circuit' : 'compound',
                exercises
            }
        ];

        plan.push({
            dayIndex: i + 1,
            dayName: DAY_NAMES_EN[i] || `Day ${i + 1}`,
            focus,
            sessionType,
            durationMin: sessionDurationMin,
            warmup,
            mainBlocks,
            cooldown
        });
    }

    return plan;
}

function getDayFocusMap(splitType, days, goal) {
    const map = [];
    switch (splitType) {
        case 'full_body':
            for (let i = 0; i < days; i++) map.push('Full Body');
            break;
        case 'upper_lower':
            for (let i = 0; i < days; i++) map.push(i % 2 === 0 ? 'Upper Body' : 'Lower Body');
            break;
        case 'push_pull_legs':
            const ppl = ['Push (Chest, Shoulders, Triceps)', 'Pull (Back, Biceps)', 'Legs'];
            for (let i = 0; i < days; i++) map.push(ppl[i % 3]);
            break;
        case 'bodypart_split':
            const bp = ['Chest & Triceps', 'Back & Biceps', 'Legs', 'Shoulders & Core', 'Full Body'];
            for (let i = 0; i < days; i++) map.push(bp[i % 5]);
            break;
        case 'hybrid':
            const hy = ['Strength Focus', 'Hypertrophy Focus', 'Conditioning', 'Recovery / Mobility'];
            for (let i = 0; i < days; i++) map.push(hy[i % 4]);
            break;
        default:
            for (let i = 0; i < days; i++) map.push('Full Body');
    }
    return map;
}

function getSessionTypeForDay(dayIndex, totalDays, goal) {
    if (goal === 'endurance') return dayIndex === totalDays - 1 ? 'conditioning' : 'mixed';
    if (goal === 'fat_loss' && dayIndex === totalDays - 1) return 'conditioning';
    if (dayIndex === totalDays - 1 && totalDays >= 4) return 'recovery';
    return goal === 'strength' ? 'strength' : 'hypertrophy';
}

function getExercisesForFocus(focus, sessionType, maxExercises, experienceLevel, allowedTypes) {
    const count = Math.min(maxExercises, experienceLevel === 'beginner' ? 5 : maxExercises);
    const exercises = [];
    const templates = getExerciseTemplates(focus, sessionType);

    for (let i = 0; i < count && i < templates.length; i++) {
        const t = templates[i];
        exercises.push({
            name: t.name,
            sets: t.sets,
            reps: t.reps,
            restSec: t.restSec,
            intensity: t.intensity,
            notes: t.notes || ''
        });
    }

    return exercises;
}

function getExerciseTemplates(focus, sessionType) {
    const base = [
        { name: 'Squat or Leg Press', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Bench Press or Push-up', sets: 3, reps: '8-10', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Row or Pull-up', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Overhead Press', sets: 3, reps: '8-10', restSec: 60, intensity: 'moderate', notes: '' },
        { name: 'Romanian Deadlift', sets: 3, reps: '10-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Plank or Core', sets: 2, reps: '30-60s', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Lunges or Step-up', sets: 3, reps: '10 per leg', restSec: 60, intensity: 'moderate', notes: '' },
        { name: 'Bicep Curl', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Tricep Extension', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' }
    ];

    if (sessionType === 'conditioning') {
        return [
            { name: 'Jump Rope or High Knees', sets: 3, reps: '30-60s', restSec: 30, intensity: 'hard', notes: '' },
            { name: 'Burpees', sets: 3, reps: '8-12', restSec: 45, intensity: 'hard', notes: '' },
            { name: 'Mountain Climbers', sets: 3, reps: '20 per side', restSec: 30, intensity: 'moderate', notes: '' },
            { name: 'Plank', sets: 2, reps: '45-60s', restSec: 30, intensity: 'moderate', notes: '' }
        ];
    }

    if (sessionType === 'recovery') {
        return [
            { name: 'Light cardio (bike/walk)', sets: 1, reps: '15-20 min', restSec: 0, intensity: 'easy', notes: '' },
            { name: 'Hip mobility flow', sets: 2, reps: '8 per side', restSec: 30, intensity: 'easy', notes: '' },
            { name: 'Shoulder dislocates', sets: 2, reps: '10-15', restSec: 30, intensity: 'easy', notes: '' },
            { name: 'Cat-cow stretch', sets: 2, reps: '10', restSec: 30, intensity: 'easy', notes: '' }
        ];
    }

    return base;
}

function getProgressionRules(goal, experienceLevel) {
    const method = experienceLevel === 'beginner' ? 'Linear: add weight or reps each week' : 'Double progression: weight and reps';
    const weeklyAdjustment = experienceLevel === 'beginner' ? 'Add 1-2 reps or 2.5% weight when all sets completed' : 'Add volume or intensity when RPE allows';
    const deloadTrigger = experienceLevel === 'beginner' ? 'Every 4th week' : 'When performance drops or fatigue is high';
    return { method, weeklyAdjustment, deloadTrigger };
}

function getRecoveryGuidance(trainingDaysPerWeek, recoveryProfile) {
    const restDayCount = 7 - trainingDaysPerWeek;
    const sleepTarget = recoveryProfile === 'low' ? '7-9' : '7-9';
    const hydrationGuidance = '2.5-3.5 L water daily; more on training days.';
    return { restDayCount, sleepTargetHours: sleepTarget, hydrationGuidance };
}

function buildWarnings(input, classification) {
    const w = [];
    if ((input.sessionDurationMin || 60) <= 45 && (input.trainingDaysPerWeek || 3) >= 5) {
        w.push('Short sessions with high frequency: prioritize recovery and sleep.');
    }
    const limitations = input.limitations || classification.limitations;
    if (limitations && limitations !== 'none') {
        w.push('Modify exercises as needed for your limitations.');
    }
    if (classification.experienceLevel === 'beginner' && input.trainingDaysPerWeek >= 5) {
        w.push('Consider starting with 3-4 days to build consistency.');
    }
    return w;
}
