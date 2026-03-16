/**
 * ASCEND AI PROTOCOL - AI Engine Generate Plan
 * Phase 2: Tries OpenAI first when available; rule engine always fallback.
 */

import { toSafeArray } from './utils.js';
import { getMaxExercisesForDuration, getEquipmentCompatibleTypes } from './rules.js';
import { classifyUser } from './classifyUser.js';
import { createResponse, isOpenAIAvailable } from '../openai/client.js';
import { buildPlanPrompt } from '../openai/promptBuilder.js';
import { validatePlan } from './validatePlan.js';

const DAY_NAMES_EN = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Parse AI response text into plan object. Never trust raw output.
 * @param {string} text
 * @returns {Object|null}
 */
function parseAIResponse(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, trimmed];
    const jsonStr = (jsonMatch[1] || trimmed).trim();
    try {
        const parsed = JSON.parse(jsonStr);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Ensure each day has unique exercises. If AI returns duplicate day structures,
 * replace with rule-engine templates by focus.
 * @param {Object} plan - Plan with weeklyPlan
 * @param {Object} normalizedInput
 * @returns {Object} Plan with unique day exercises
 */
export function ensureUniqueDayExercises(plan, normalizedInput) {
    if (!plan?.weeklyPlan || !Array.isArray(plan.weeklyPlan)) return plan;
    const input = normalizedInput || {};
    const classification = classifyUser(input);
    const goal = classification.goal || 'recomposition';
    const experienceLevel = classification.experienceLevel || 'beginner';
    const maxExercises = getMaxExercisesForDuration(input.sessionDurationMin ?? 60);
    const allowedTypes = getEquipmentCompatibleTypes(input.equipmentAccess || 'home_basic');
    const dayFocusMap = getDayFocusMap(classification.splitType || 'full_body', plan.weeklyPlan.length, goal);

    const signatures = new Map();
    let hasDuplicates = false;
    for (let i = 0; i < plan.weeklyPlan.length; i++) {
        const day = plan.weeklyPlan[i];
        const exNames = (day.mainBlocks || []).flatMap((b) => (b.exercises || []).map((e) => e?.name)).filter(Boolean).join('|');
        if (signatures.has(exNames) && exNames) {
            hasDuplicates = true;
            break;
        }
        signatures.set(exNames, i);
    }

    if (!hasDuplicates) return plan;

    const weeklyPlan = plan.weeklyPlan.map((day, i) => {
        const focus = dayFocusMap[i] || day.focus || 'Full Body';
        const sessionType = day.sessionType || getSessionTypeForDay(i, plan.weeklyPlan.length, goal);
        const exercises = getExercisesForFocus(focus, sessionType, maxExercises, experienceLevel, allowedTypes);
        return {
            ...day,
            mainBlocks: [{
                blockName: focus,
                exerciseType: sessionType === 'conditioning' ? 'circuit' : 'compound',
                exercises: exercises.map((e) => ({ ...e }))
            }]
        };
    });
    return { ...plan, weeklyPlan };
}

/**
 * Generate a structured weekly training plan from normalized input.
 * If OpenAI available: tries AI first; falls back to rule engine on failure.
 * @param {Object} normalizedInput - From normalizeInput()
 * @returns {Promise<Object>} Generated plan (planMeta, userSummary, weeklyPlan, progressionRules, recoveryGuidance, warnings)
 */
export async function generatePlan(normalizedInput) {
    if (isOpenAIAvailable()) {
        try {
            const classification = classifyUser(normalizedInput);
            const { system, user } = buildPlanPrompt(normalizedInput, classification);
            const result = await createResponse({ prompt: user, instructions: system });
            if (result.success && result.text) {
                const rawPlan = parseAIResponse(result.text);
                if (rawPlan) {
                    const validation = validatePlan(rawPlan);
                    if (validation.valid && validation.sanitizedPlan) {
                        return validation.sanitizedPlan;
                    }
                }
            }
        } catch {
            /* fall through to rule engine */
        }
    }
    return generateRulePlan(normalizedInput);
}

/**
 * Rule-based plan generation. Always available as fallback.
 * @param {Object} normalizedInput - From normalizeInput()
 * @returns {Object} Generated plan
 */
export function generateRulePlan(normalizedInput) {
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

        plan.push({
            dayIndex: i + 1,
            dayName: DAY_NAMES_EN[i] || `Day ${i + 1}`,
            focus,
            sessionType,
            durationMin: sessionDurationMin,
            warmup: [{ name: 'Light cardio + dynamic stretches', durationMin: 5 }],
            mainBlocks: [{
                blockName: focus,
                exerciseType: sessionType === 'conditioning' ? 'circuit' : 'compound',
                exercises: exercises.map((e) => ({ ...e }))
            }],
            cooldown: [{ name: 'Static stretching + breathing', durationMin: 5 }]
        });
    }

    return plan;
}

/**
 * Build split-specific weekly plan from normalized input. Used by fallback when input is available.
 * @param {Object} normalizedInput
 * @returns {Array} weeklyPlan
 */
export function buildWeeklyPlanFromInput(normalizedInput) {
    const input = normalizedInput || {};
    const classification = classifyUser(input);
    const maxExercises = getMaxExercisesForDuration(input.sessionDurationMin ?? 60);
    const allowedTypes = getEquipmentCompatibleTypes(input.equipmentAccess || 'home_basic');
    return buildWeeklyPlan({
        splitType: classification.splitType || 'full_body',
        trainingDaysPerWeek: input.trainingDaysPerWeek ?? 3,
        sessionDurationMin: input.sessionDurationMin ?? 60,
        goal: classification.goal || 'recomposition',
        experienceLevel: classification.experienceLevel || 'beginner',
        maxExercises,
        allowedTypes,
        equipmentAccess: input.equipmentAccess || 'home_basic'
    });
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

const EXERCISE_TEMPLATES = {
    full_body: [
        { name: 'Squat or Leg Press', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Bench Press or Push-up', sets: 3, reps: '8-10', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Row or Pull-up', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Overhead Press', sets: 3, reps: '8-10', restSec: 60, intensity: 'moderate', notes: '' },
        { name: 'Romanian Deadlift', sets: 3, reps: '10-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Plank or Core', sets: 2, reps: '30-60s', restSec: 45, intensity: 'easy', notes: '' }
    ],
    upper_body: [
        { name: 'Bench Press or Push-up', sets: 3, reps: '8-10', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Row or Pull-up', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Overhead Press', sets: 3, reps: '8-10', restSec: 60, intensity: 'moderate', notes: '' },
        { name: 'Bicep Curl', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Tricep Extension', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' }
    ],
    lower_body: [
        { name: 'Squat or Leg Press', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Romanian Deadlift', sets: 3, reps: '10-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Lunges or Step-up', sets: 3, reps: '10 per leg', restSec: 60, intensity: 'moderate', notes: '' },
        { name: 'Leg Curl or Nordic', sets: 3, reps: '10-12', restSec: 60, intensity: 'moderate', notes: '' },
        { name: 'Plank or Core', sets: 2, reps: '30-60s', restSec: 45, intensity: 'easy', notes: '' }
    ],
    push: [
        { name: 'Bench Press or Push-up', sets: 3, reps: '8-10', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Overhead Press', sets: 3, reps: '8-10', restSec: 60, intensity: 'moderate', notes: '' },
        { name: 'Incline DB Press or Dips', sets: 3, reps: '8-12', restSec: 75, intensity: 'moderate', notes: '' },
        { name: 'Tricep Extension', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Lateral Raise', sets: 2, reps: '12-15', restSec: 45, intensity: 'easy', notes: '' }
    ],
    pull: [
        { name: 'Row or Pull-up', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Lat Pulldown or Chin-up', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Face Pull or Reverse Fly', sets: 2, reps: '12-15', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Bicep Curl', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Hammer Curl', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' }
    ],
    legs: [
        { name: 'Squat or Leg Press', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Romanian Deadlift', sets: 3, reps: '10-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Lunges or Step-up', sets: 3, reps: '10 per leg', restSec: 60, intensity: 'moderate', notes: '' },
        { name: 'Leg Curl', sets: 3, reps: '10-12', restSec: 60, intensity: 'moderate', notes: '' },
        { name: 'Calf Raise', sets: 2, reps: '15-20', restSec: 45, intensity: 'easy', notes: '' }
    ],
    chest_triceps: [
        { name: 'Bench Press or Push-up', sets: 3, reps: '8-10', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Incline DB Press', sets: 3, reps: '8-12', restSec: 75, intensity: 'moderate', notes: '' },
        { name: 'Cable Fly or Push-up', sets: 2, reps: '12-15', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Tricep Pushdown', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Tricep Extension', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' }
    ],
    back_biceps: [
        { name: 'Deadlift or Rack Pull', sets: 3, reps: '6-8', restSec: 120, intensity: 'hard', notes: '' },
        { name: 'Row or Pull-up', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Lat Pulldown', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Bicep Curl', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Hammer Curl', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: '' }
    ],
    shoulders_core: [
        { name: 'Overhead Press', sets: 3, reps: '8-10', restSec: 60, intensity: 'moderate', notes: '' },
        { name: 'Lateral Raise', sets: 3, reps: '12-15', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Face Pull', sets: 2, reps: '12-15', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Plank', sets: 2, reps: '45-60s', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Dead Bug or Bird Dog', sets: 2, reps: '10 per side', restSec: 45, intensity: 'easy', notes: '' }
    ],
    strength_focus: [
        { name: 'Squat or Leg Press', sets: 4, reps: '5-6', restSec: 120, intensity: 'hard', notes: '' },
        { name: 'Bench Press', sets: 4, reps: '5-6', restSec: 120, intensity: 'hard', notes: '' },
        { name: 'Row or Pull-up', sets: 4, reps: '5-8', restSec: 120, intensity: 'hard', notes: '' },
        { name: 'Overhead Press', sets: 3, reps: '6-8', restSec: 90, intensity: 'hard', notes: '' }
    ],
    hypertrophy_focus: [
        { name: 'Squat or Leg Press', sets: 3, reps: '10-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Bench Press or Push-up', sets: 3, reps: '10-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Row or Pull-up', sets: 3, reps: '10-12', restSec: 90, intensity: 'moderate', notes: '' },
        { name: 'Romanian Deadlift', sets: 3, reps: '12-15', restSec: 75, intensity: 'moderate', notes: '' },
        { name: 'Bicep Curl', sets: 2, reps: '12-15', restSec: 45, intensity: 'easy', notes: '' },
        { name: 'Tricep Extension', sets: 2, reps: '12-15', restSec: 45, intensity: 'easy', notes: '' }
    ],
    conditioning: [
        { name: 'Jump Rope or High Knees', sets: 3, reps: '30-60s', restSec: 30, intensity: 'hard', notes: '' },
        { name: 'Burpees', sets: 3, reps: '8-12', restSec: 45, intensity: 'hard', notes: '' },
        { name: 'Mountain Climbers', sets: 3, reps: '20 per side', restSec: 30, intensity: 'moderate', notes: '' },
        { name: 'Plank', sets: 2, reps: '45-60s', restSec: 30, intensity: 'moderate', notes: '' }
    ],
    recovery: [
        { name: 'Light cardio (bike/walk)', sets: 1, reps: '15-20 min', restSec: 0, intensity: 'easy', notes: '' },
        { name: 'Hip mobility flow', sets: 2, reps: '8 per side', restSec: 30, intensity: 'easy', notes: '' },
        { name: 'Shoulder dislocates', sets: 2, reps: '10-15', restSec: 30, intensity: 'easy', notes: '' },
        { name: 'Cat-cow stretch', sets: 2, reps: '10', restSec: 30, intensity: 'easy', notes: '' }
    ]
};

function mapFocusToTemplateKey(focus) {
    const f = String(focus || '').toLowerCase();
    if (f.includes('push') && (f.includes('chest') || f.includes('tricep'))) return 'push';
    if (f.includes('pull') && (f.includes('back') || f.includes('bicep'))) return 'pull';
    if (f.includes('chest') && f.includes('tricep')) return 'chest_triceps';
    if (f.includes('back') && f.includes('bicep')) return 'back_biceps';
    if (f.includes('shoulder') && f.includes('core')) return 'shoulders_core';
    if (f.includes('upper body')) return 'upper_body';
    if (f.includes('lower body')) return 'lower_body';
    if (f.includes('legs')) return 'legs';
    if (f.includes('strength focus')) return 'strength_focus';
    if (f.includes('hypertrophy focus')) return 'hypertrophy_focus';
    if (f.includes('conditioning')) return 'conditioning';
    if (f.includes('recovery') || f.includes('mobility')) return 'recovery';
    if (f.includes('full body')) return 'full_body';
    return 'full_body';
}

function getExerciseTemplates(focus, sessionType) {
    if (sessionType === 'conditioning') {
        return EXERCISE_TEMPLATES.conditioning.map((t) => ({ ...t }));
    }
    if (sessionType === 'recovery') {
        return EXERCISE_TEMPLATES.recovery.map((t) => ({ ...t }));
    }
    const key = mapFocusToTemplateKey(focus);
    const templates = EXERCISE_TEMPLATES[key] || EXERCISE_TEMPLATES.full_body;
    return templates.map((t) => ({ ...t }));
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
