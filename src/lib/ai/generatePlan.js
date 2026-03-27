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
import { getWeekPhase, applyPhaseToPlan } from './periodizationEngine.js';

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
    const dayFocusMap = getDayFocusMap(classification.splitType || 'full_body', plan.weeklyPlan.length, goal, input.targetFocus || 'overall');

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
        const sessionType = day.sessionType || getSessionTypeForDay(i, plan.weeklyPlan.length, goal, focus);
        const exercises = getExercisesForFocus(focus, sessionType, maxExercises, experienceLevel, allowedTypes, {
            goal,
            experienceLevel,
            equipmentAccess: input.equipmentAccess || 'home_basic',
            targetFocus: input.targetFocus || 'overall',
            limitations: input.limitations || 'none',
            dayIndex: i,
            totalDays: plan.weeklyPlan.length,
            splitType: classification.splitType || 'full_body'
        });
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
                        const uniquePlan = ensureUniqueDayExercises(validation.sanitizedPlan, normalizedInput);
                        return applyPhaseForWeek1(uniquePlan, classification.goal || 'recomp');
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
 * Apply Phase 10 periodization for week 1.
 * @param {Object} plan
 * @param {string} goal
 * @returns {Object}
 */
function applyPhaseForWeek1(plan, goal) {
    const phase = getWeekPhase(goal, 1);
    const result = applyPhaseToPlan(plan, phase);
    return result.adjustedPlan || plan;
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
    const targetFocus = input.targetFocus || 'overall';
    const limitations = input.limitations || 'none';
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
        equipmentAccess,
        targetFocus,
        limitations
    });

    const progressionRules = getProgressionRules(goal, experienceLevel);
    const recoveryGuidance = getRecoveryGuidance(trainingDaysPerWeek, recoveryProfile);
    const warnings = buildWarnings(input, classification);

    let plan = {
        planMeta,
        userSummary,
        weeklyPlan,
        progressionRules,
        recoveryGuidance,
        warnings
    };

    // Phase 10: Apply periodization for week 1
    plan = applyPhaseForWeek1(plan, goal);

    return plan;
}

function buildWeeklyPlan(opts) {
    const { splitType, trainingDaysPerWeek, sessionDurationMin, goal, experienceLevel, maxExercises, allowedTypes, equipmentAccess, targetFocus = 'overall', limitations = 'none' } = opts;
    const plan = [];
    const dayFocusMap = getDayFocusMap(splitType, trainingDaysPerWeek, goal, targetFocus);

    for (let i = 0; i < trainingDaysPerWeek; i++) {
        const focus = dayFocusMap[i] || 'Full Body';
        const sessionType = getSessionTypeForDay(i, trainingDaysPerWeek, goal, focus);
        const exercises = getExercisesForFocus(focus, sessionType, maxExercises, experienceLevel, allowedTypes, {
            goal,
            experienceLevel,
            equipmentAccess,
            targetFocus,
            limitations,
            dayIndex: i,
            totalDays: trainingDaysPerWeek,
            splitType
        });

        plan.push({
            dayIndex: i + 1,
            dayName: DAY_NAMES_EN[i] || `Day ${i + 1}`,
            focus,
            sessionType,
            durationMin: sessionDurationMin,
            warmup: [{ name: buildWarmupForDay(focus, equipmentAccess, limitations), durationMin: 5 }],
            mainBlocks: [{
                blockName: focus,
                exerciseType: sessionType === 'conditioning' ? 'circuit' : 'compound',
                exercises: exercises.map((e) => ({ ...e }))
            }],
            cooldown: [{ name: buildCooldownForDay(sessionType, limitations), durationMin: 5 }]
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
        equipmentAccess: input.equipmentAccess || 'home_basic',
        targetFocus: input.targetFocus || 'overall',
        limitations: input.limitations || 'none'
    });
}

function getDayFocusMap(splitType, days, goal, targetFocus = 'overall') {
    const map = [];
    switch (splitType) {
        case 'full_body':
            for (let i = 0; i < days; i++) {
                if (targetFocus === 'chest') map.push('Full Body (Chest Emphasis)');
                else if (targetFocus === 'legs') map.push('Full Body (Leg Emphasis)');
                else if (targetFocus === 'core') map.push('Full Body + Core');
                else map.push('Full Body');
            }
            break;
        case 'upper_lower':
            for (let i = 0; i < days; i++) {
                if (targetFocus === 'core') map.push(i % 2 === 0 ? 'Upper Body + Core' : 'Lower Body + Core');
                else map.push(i % 2 === 0 ? 'Upper Body' : 'Lower Body');
            }
            break;
        case 'push_pull_legs':
            const ppl = targetFocus === 'core'
                ? ['Push + Core', 'Pull + Core', 'Legs + Core']
                : ['Push (Chest, Shoulders, Triceps)', 'Pull (Back, Biceps)', 'Legs'];
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

function getSessionTypeForDay(dayIndex, totalDays, goal, focus = '') {
    const focusKey = String(focus || '').toLowerCase();
    if (focusKey.includes('conditioning')) return 'conditioning';
    if (focusKey.includes('recovery') || focusKey.includes('mobility')) return 'recovery';
    if (goal === 'endurance') return dayIndex === totalDays - 1 ? 'conditioning' : 'mixed';
    if (goal === 'fat_loss' && totalDays >= 5 && dayIndex === totalDays - 1) return 'conditioning';
    if (dayIndex === totalDays - 1 && totalDays >= 6) return 'recovery';
    return goal === 'strength' ? 'strength' : 'hypertrophy';
}

function getExercisesForFocus(focus, sessionType, maxExercises, experienceLevel, allowedTypes, context = {}) {
    const count = Math.min(maxExercises, experienceLevel === 'beginner' ? 5 : maxExercises);
    const exercises = [];
    const templates = getExerciseTemplates(focus, sessionType, context);
    const usedNames = new Set();

    for (let i = 0; i < count && i < templates.length; i++) {
        const t = personalizeTemplate(templates[i], {
            ...context,
            focus,
            sessionType,
            allowedTypes
        }, i, usedNames);
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

function createVariant(name, tags = [], extra = {}) {
    return { name, tags, ...extra };
}

const EXERCISE_VARIANTS = {
    'Squat or Leg Press': {
        gym: [
            createVariant('Barbell Back Squat', ['legs', 'quads', 'strength']),
            createVariant('Leg Press', ['legs', 'quads', 'hypertrophy']),
            createVariant('Bulgarian Split Squat', ['legs', 'quads', 'glutes', 'hypertrophy'], { contraindications: ['knees'] }),
            createVariant('Goblet Squat', ['legs', 'quads', 'core'])
        ],
        home_basic: [
            createVariant('Goblet Squat', ['legs', 'quads', 'core']),
            createVariant('Bodyweight Squats', ['legs', 'quads', 'bodyweight']),
            createVariant('Reverse Lunge', ['legs', 'quads', 'glutes']),
            createVariant('Step-Up', ['legs', 'quads', 'glutes'])
        ],
        bodyweight: [
            createVariant('Bodyweight Squats', ['legs', 'quads', 'bodyweight']),
            createVariant('Reverse Lunge', ['legs', 'quads', 'glutes']),
            createVariant('Split Squat', ['legs', 'quads', 'glutes']),
            createVariant('Step-Up', ['legs', 'quads', 'glutes'])
        ]
    },
    'Bench Press or Push-up': {
        gym: [
            createVariant('Barbell Bench Press', ['push', 'chest', 'strength']),
            createVariant('Incline Barbell Bench Press', ['push', 'chest', 'upper_chest', 'strength']),
            createVariant('Dumbbell Incline Bench Press', ['push', 'chest', 'hypertrophy']),
            createVariant('Machine Chest Press', ['push', 'chest', 'hypertrophy'])
        ],
        home_basic: [
            createVariant('Push-Up', ['push', 'chest', 'bodyweight']),
            createVariant('Feet-Elevated Push-Up', ['push', 'chest', 'bodyweight', 'strength']),
            createVariant('Resistance Band Chest Press', ['push', 'chest', 'band']),
            createVariant('Backpack Floor Press', ['push', 'chest', 'strength'])
        ],
        bodyweight: [
            createVariant('Push-Up', ['push', 'chest', 'bodyweight']),
            createVariant('Feet-Elevated Push-Up', ['push', 'chest', 'bodyweight', 'strength']),
            createVariant('Decline Push-Up', ['push', 'chest', 'bodyweight', 'strength']),
            createVariant('Tempo Push-Up', ['push', 'chest', 'bodyweight', 'hypertrophy'])
        ]
    },
    'Row or Pull-up': {
        gym: [
            createVariant('Bent-Over Barbell Row', ['pull', 'back', 'strength']),
            createVariant('Cable Row', ['pull', 'back', 'hypertrophy']),
            createVariant('Seated Row Machine', ['pull', 'back', 'hypertrophy']),
            createVariant('Pull-Ups', ['pull', 'back', 'lats', 'strength'])
        ],
        home_basic: [
            createVariant('Resistance Band Row', ['pull', 'back', 'band']),
            createVariant('Inverted Row', ['pull', 'back', 'bodyweight']),
            createVariant('One-Arm Backpack Row', ['pull', 'back', 'strength']),
            createVariant('Doorway Towel Row', ['pull', 'back', 'bodyweight'])
        ],
        bodyweight: [
            createVariant('Inverted Row', ['pull', 'back', 'bodyweight']),
            createVariant('Doorway Towel Row', ['pull', 'back', 'bodyweight']),
            createVariant('Pull-Ups', ['pull', 'back', 'strength']),
            createVariant('Chin-Ups', ['pull', 'back', 'biceps', 'strength'])
        ]
    },
    'Overhead Press': {
        gym: [
            createVariant('Overhead Press', ['push', 'shoulders', 'strength'], { contraindications: ['shoulders'] }),
            createVariant('Seated Military Press', ['push', 'shoulders', 'hypertrophy'], { contraindications: ['shoulders'] }),
            createVariant('Overhead Dumbbell Press', ['push', 'shoulders', 'hypertrophy'], { contraindications: ['shoulders'] }),
            createVariant('Seated Dumbbell Shoulder Press', ['push', 'shoulders', 'hypertrophy'], { contraindications: ['shoulders'] })
        ],
        home_basic: [
            createVariant('Pike Push-Up', ['push', 'shoulders', 'bodyweight'], { contraindications: ['shoulders'] }),
            createVariant('Band Overhead Press', ['push', 'shoulders', 'band'], { contraindications: ['shoulders'] }),
            createVariant('Single-Arm Backpack Press', ['push', 'shoulders', 'strength'], { contraindications: ['shoulders'] })
        ],
        bodyweight: [
            createVariant('Pike Push-Up', ['push', 'shoulders', 'bodyweight'], { contraindications: ['shoulders'] }),
            createVariant('Wall Pike Press', ['push', 'shoulders', 'bodyweight'], { contraindications: ['shoulders'] }),
            createVariant('Handstand Hold', ['push', 'shoulders', 'bodyweight'], { contraindications: ['shoulders'] })
        ]
    },
    'Romanian Deadlift': {
        gym: [
            createVariant('Romanian Deadlift', ['legs', 'hamstrings', 'glutes', 'strength'], { contraindications: ['lower_back'] }),
            createVariant('Hip Thrusts', ['legs', 'glutes', 'hypertrophy']),
            createVariant('Conventional Deadlift', ['legs', 'back', 'strength'], { contraindications: ['lower_back'] }),
            createVariant('Single-Leg Romanian Deadlift', ['legs', 'hamstrings', 'glutes', 'balance'])
        ],
        home_basic: [
            createVariant('Single-Leg Romanian Deadlift', ['legs', 'hamstrings', 'glutes', 'balance']),
            createVariant('Hip Thrusts', ['legs', 'glutes', 'hypertrophy']),
            createVariant('Glute Bridge', ['legs', 'glutes', 'bodyweight']),
            createVariant('Backpack Romanian Deadlift', ['legs', 'hamstrings', 'glutes', 'strength'], { contraindications: ['lower_back'] })
        ],
        bodyweight: [
            createVariant('Single-Leg Romanian Deadlift', ['legs', 'hamstrings', 'glutes', 'balance']),
            createVariant('Glute Bridge', ['legs', 'glutes', 'bodyweight']),
            createVariant('Hamstring Walkout', ['legs', 'hamstrings', 'bodyweight']),
            createVariant('Hip Thrusts', ['legs', 'glutes', 'bodyweight'])
        ]
    },
    'Plank or Core': {
        gym: [
            createVariant('Hanging Leg Raises', ['core', 'abs']),
            createVariant('Cable Woodchoppers', ['core', 'obliques']),
            createVariant('Ab Wheel Rollout', ['core', 'abs', 'strength']),
            createVariant('Plank', ['core', 'abs'])
        ],
        home_basic: [
            createVariant('Dead Bug', ['core', 'abs']),
            createVariant('Side Plank', ['core', 'obliques']),
            createVariant('Hollow Body Hold', ['core', 'abs']),
            createVariant('Mountain Climbers', ['core', 'conditioning'])
        ],
        bodyweight: [
            createVariant('Dead Bug', ['core', 'abs']),
            createVariant('Side Plank', ['core', 'obliques']),
            createVariant('Hollow Body Hold', ['core', 'abs']),
            createVariant('Mountain Climbers', ['core', 'conditioning'])
        ]
    },
    'Bicep Curl': {
        gym: [
            createVariant('Barbell Curl', ['pull', 'biceps']),
            createVariant('Dumbbell Bicep Curl', ['pull', 'biceps']),
            createVariant('Hammer Curl', ['pull', 'biceps', 'forearms'])
        ],
        home_basic: [
            createVariant('Resistance Band Bicep Curl', ['pull', 'biceps', 'band']),
            createVariant('Backpack Curl', ['pull', 'biceps']),
            createVariant('Hammer Curl', ['pull', 'biceps', 'forearms'])
        ],
        bodyweight: [
            createVariant('Towel Bicep Curl Isometric', ['pull', 'biceps', 'bodyweight']),
            createVariant('Backpack Curl', ['pull', 'biceps'])
        ]
    },
    'Tricep Extension': {
        gym: [
            createVariant('Cable Tricep Pushdown', ['push', 'triceps']),
            createVariant('Tricep Extension', ['push', 'triceps']),
            createVariant('Dips', ['push', 'triceps', 'chest'], { contraindications: ['shoulders', 'wrist_elbow'] })
        ],
        home_basic: [
            createVariant('Resistance Band Tricep Pressdown', ['push', 'triceps', 'band']),
            createVariant('Overhead Band Tricep Extension', ['push', 'triceps', 'band'], { contraindications: ['shoulders'] }),
            createVariant('Bench Dips', ['push', 'triceps', 'bodyweight'], { contraindications: ['shoulders', 'wrist_elbow'] })
        ],
        bodyweight: [
            createVariant('Bench Dips', ['push', 'triceps', 'bodyweight'], { contraindications: ['shoulders', 'wrist_elbow'] }),
            createVariant('Diamond Push-Up', ['push', 'triceps', 'bodyweight'])
        ]
    },
    'Incline DB Press or Dips': {
        gym: [
            createVariant('Dumbbell Incline Bench Press', ['push', 'chest', 'upper_chest', 'hypertrophy']),
            createVariant('Incline Barbell Bench Press', ['push', 'chest', 'upper_chest', 'strength']),
            createVariant('Dips', ['push', 'triceps', 'chest'], { contraindications: ['shoulders', 'wrist_elbow'] })
        ],
        home_basic: [
            createVariant('Feet-Elevated Push-Up', ['push', 'chest', 'upper_chest', 'bodyweight']),
            createVariant('Backpack Floor Press', ['push', 'chest', 'strength']),
            createVariant('Resistance Band Chest Press', ['push', 'chest', 'band'])
        ],
        bodyweight: [
            createVariant('Feet-Elevated Push-Up', ['push', 'chest', 'upper_chest', 'bodyweight']),
            createVariant('Decline Push-Up', ['push', 'chest', 'bodyweight']),
            createVariant('Diamond Push-Up', ['push', 'triceps', 'bodyweight'])
        ]
    },
    'Lat Pulldown or Chin-up': {
        gym: [
            createVariant('Lat Pulldown', ['pull', 'back', 'lats']),
            createVariant('Pull-Ups', ['pull', 'back', 'lats', 'strength']),
            createVariant('Assisted Pull-up Machine', ['pull', 'back', 'lats'])
        ],
        home_basic: [
            createVariant('Resistance Band Lat Pulldown', ['pull', 'back', 'lats', 'band']),
            createVariant('Inverted Row', ['pull', 'back', 'bodyweight']),
            createVariant('Chin-Ups', ['pull', 'back', 'biceps', 'strength'])
        ],
        bodyweight: [
            createVariant('Pull-Ups', ['pull', 'back', 'lats', 'strength']),
            createVariant('Chin-Ups', ['pull', 'back', 'biceps', 'strength']),
            createVariant('Inverted Row', ['pull', 'back', 'bodyweight'])
        ]
    },
    'Face Pull or Reverse Fly': {
        gym: [
            createVariant('Cable Face Pulls', ['pull', 'rear_delts', 'shoulders']),
            createVariant('Face Pulls', ['pull', 'rear_delts', 'shoulders']),
            createVariant('Reverse Pec Deck', ['pull', 'rear_delts', 'shoulders'])
        ],
        home_basic: [
            createVariant('Resistance Band Face Pull', ['pull', 'rear_delts', 'shoulders', 'band']),
            createVariant('Bent-Over Rear Delt Raise', ['pull', 'rear_delts', 'shoulders'])
        ],
        bodyweight: [
            createVariant('Prone Y-T-W Raises', ['pull', 'rear_delts', 'shoulders', 'bodyweight']),
            createVariant('Scapular Wall Slides', ['pull', 'shoulders', 'mobility'])
        ]
    },
    'Lunges or Step-up': {
        gym: [
            createVariant('Walking Lunges', ['legs', 'quads', 'glutes']),
            createVariant('Bulgarian Split Squat', ['legs', 'quads', 'glutes'], { contraindications: ['knees'] }),
            createVariant('Step-Up', ['legs', 'quads', 'glutes']),
            createVariant('Jump Lunges', ['legs', 'conditioning'], { contraindications: ['knees'] })
        ],
        home_basic: [
            createVariant('Reverse Lunge', ['legs', 'quads', 'glutes']),
            createVariant('Walking Lunges', ['legs', 'quads', 'glutes']),
            createVariant('Step-Up', ['legs', 'quads', 'glutes'])
        ],
        bodyweight: [
            createVariant('Reverse Lunge', ['legs', 'quads', 'glutes']),
            createVariant('Walking Lunges', ['legs', 'quads', 'glutes']),
            createVariant('Step-Up', ['legs', 'quads', 'glutes'])
        ]
    },
    'Leg Curl or Nordic': {
        gym: [
            createVariant('Seated Leg Curls', ['legs', 'hamstrings']),
            createVariant('Leg Curl Machine', ['legs', 'hamstrings']),
            createVariant('Nordic Curl', ['legs', 'hamstrings', 'strength'])
        ],
        home_basic: [
            createVariant('Towel Hamstring Curl', ['legs', 'hamstrings', 'bodyweight']),
            createVariant('Nordic Curl', ['legs', 'hamstrings', 'strength']),
            createVariant('Hamstring Walkout', ['legs', 'hamstrings', 'bodyweight'])
        ],
        bodyweight: [
            createVariant('Nordic Curl', ['legs', 'hamstrings', 'strength']),
            createVariant('Towel Hamstring Curl', ['legs', 'hamstrings', 'bodyweight']),
            createVariant('Hamstring Walkout', ['legs', 'hamstrings', 'bodyweight'])
        ]
    },
    'Calf Raise': {
        gym: [
            createVariant('Standing Calf Raises', ['legs', 'calves']),
            createVariant('Seated Calf Raises', ['legs', 'calves'])
        ],
        home_basic: [
            createVariant('Standing Calf Raises', ['legs', 'calves']),
            createVariant('Single-Leg Calf Raise', ['legs', 'calves', 'bodyweight'])
        ],
        bodyweight: [
            createVariant('Standing Calf Raises', ['legs', 'calves']),
            createVariant('Single-Leg Calf Raise', ['legs', 'calves', 'bodyweight'])
        ]
    },
    'Cable Fly or Push-up': {
        gym: [
            createVariant('Cable Chest Fly', ['push', 'chest', 'hypertrophy']),
            createVariant('Push-Up', ['push', 'chest', 'bodyweight']),
            createVariant('Dumbbell Flyes', ['push', 'chest', 'hypertrophy'])
        ],
        home_basic: [
            createVariant('Push-Up', ['push', 'chest', 'bodyweight']),
            createVariant('Decline Push-Up', ['push', 'chest', 'bodyweight']),
            createVariant('Resistance Band Chest Fly', ['push', 'chest', 'band'])
        ],
        bodyweight: [
            createVariant('Push-Up', ['push', 'chest', 'bodyweight']),
            createVariant('Decline Push-Up', ['push', 'chest', 'bodyweight']),
            createVariant('Tempo Push-Up', ['push', 'chest', 'bodyweight'])
        ]
    },
    'Deadlift or Rack Pull': {
        gym: [
            createVariant('Barbell Deadlift', ['pull', 'back', 'hamstrings', 'strength'], { contraindications: ['lower_back'] }),
            createVariant('Conventional Deadlift', ['pull', 'back', 'hamstrings', 'strength'], { contraindications: ['lower_back'] }),
            createVariant('Romanian Deadlift', ['pull', 'hamstrings', 'glutes', 'strength'], { contraindications: ['lower_back'] })
        ],
        home_basic: [
            createVariant('Backpack Romanian Deadlift', ['pull', 'hamstrings', 'glutes', 'strength'], { contraindications: ['lower_back'] }),
            createVariant('Single-Leg Romanian Deadlift', ['pull', 'hamstrings', 'glutes'])
        ],
        bodyweight: [
            createVariant('Single-Leg Romanian Deadlift', ['pull', 'hamstrings', 'glutes']),
            createVariant('Hip Hinge Drill', ['pull', 'hamstrings', 'mobility'])
        ]
    },
    'Lat Pulldown': {
        gym: [
            createVariant('Lat Pulldown', ['pull', 'back', 'lats']),
            createVariant('Assisted Pull-up Machine', ['pull', 'back', 'lats']),
            createVariant('Pull-Ups', ['pull', 'back', 'lats', 'strength'])
        ],
        home_basic: [
            createVariant('Resistance Band Lat Pulldown', ['pull', 'back', 'lats', 'band']),
            createVariant('Inverted Row', ['pull', 'back', 'bodyweight'])
        ],
        bodyweight: [
            createVariant('Pull-Ups', ['pull', 'back', 'lats', 'strength']),
            createVariant('Inverted Row', ['pull', 'back', 'bodyweight'])
        ]
    },
    'Face Pull': {
        gym: [
            createVariant('Cable Face Pulls', ['pull', 'rear_delts', 'shoulders']),
            createVariant('Face Pulls', ['pull', 'rear_delts', 'shoulders'])
        ],
        home_basic: [
            createVariant('Resistance Band Face Pull', ['pull', 'rear_delts', 'shoulders', 'band'])
        ],
        bodyweight: [
            createVariant('Prone Y-T-W Raises', ['pull', 'rear_delts', 'shoulders', 'bodyweight'])
        ]
    },
    'Dead Bug or Bird Dog': {
        gym: [
            createVariant('Dead Bug', ['core', 'abs']),
            createVariant('Bird Dog', ['core', 'stability']),
            createVariant('Pallof Press', ['core', 'obliques'])
        ],
        home_basic: [
            createVariant('Dead Bug', ['core', 'abs']),
            createVariant('Bird Dog', ['core', 'stability']),
            createVariant('Pallof Press', ['core', 'obliques', 'band'])
        ],
        bodyweight: [
            createVariant('Dead Bug', ['core', 'abs']),
            createVariant('Bird Dog', ['core', 'stability']),
            createVariant('Side Plank', ['core', 'obliques'])
        ]
    },
    'Jump Rope or High Knees': {
        gym: [
            createVariant('Jump Rope', ['conditioning', 'cardio']),
            createVariant('Rowing Machine', ['conditioning', 'cardio']),
            createVariant('Stationary Bike Intervals', ['conditioning', 'cardio'])
        ],
        home_basic: [
            createVariant('Jump Rope', ['conditioning', 'cardio']),
            createVariant('High Knees', ['conditioning', 'cardio']),
            createVariant('Mountain Climbers', ['conditioning', 'cardio', 'core'])
        ],
        bodyweight: [
            createVariant('Jump Rope', ['conditioning', 'cardio']),
            createVariant('High Knees', ['conditioning', 'cardio']),
            createVariant('Mountain Climbers', ['conditioning', 'cardio', 'core'])
        ]
    },
    Burpees: {
        gym: [
            createVariant('Burpees', ['conditioning', 'cardio']),
            createVariant('Battle Ropes', ['conditioning', 'cardio']),
            createVariant('SkiErg Sprint', ['conditioning', 'cardio'])
        ],
        home_basic: [
            createVariant('Burpees', ['conditioning', 'cardio']),
            createVariant('Jump Squats', ['conditioning', 'cardio']),
            createVariant('Fast Mountain Climbers', ['conditioning', 'cardio', 'core'])
        ],
        bodyweight: [
            createVariant('Burpees', ['conditioning', 'cardio']),
            createVariant('Jump Squats', ['conditioning', 'cardio']),
            createVariant('Fast Mountain Climbers', ['conditioning', 'cardio', 'core'])
        ]
    },
    'Mountain Climbers': {
        gym: [
            createVariant('Mountain Climbers', ['conditioning', 'core']),
            createVariant('Assault Bike Sprint', ['conditioning', 'cardio']),
            createVariant('Sled Push', ['conditioning', 'legs'])
        ],
        home_basic: [
            createVariant('Mountain Climbers', ['conditioning', 'core']),
            createVariant('Bear Crawl', ['conditioning', 'core']),
            createVariant('Skater Hops', ['conditioning', 'legs'])
        ],
        bodyweight: [
            createVariant('Mountain Climbers', ['conditioning', 'core']),
            createVariant('Bear Crawl', ['conditioning', 'core']),
            createVariant('Skater Hops', ['conditioning', 'legs'])
        ]
    }
};

const EXERCISE_PATTERN_ALIASES = {
    'Bench Press': 'Bench Press or Push-up',
    'Incline DB Press': 'Incline DB Press or Dips',
    'Leg Curl': 'Leg Curl or Nordic',
    'Tricep Pushdown': 'Tricep Extension',
    'Face Pull': 'Face Pull or Reverse Fly'
};

function getEquipmentVariantKey(equipmentAccess) {
    if (equipmentAccess === 'gym' || equipmentAccess === 'mixed') return 'gym';
    if (equipmentAccess === 'bodyweight') return 'bodyweight';
    return 'home_basic';
}

function hashString(value) {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function inferFocusTags(focus, sessionType, targetFocus) {
    const text = String(focus || '').toLowerCase();
    const tags = new Set();
    if (text.includes('push') || text.includes('chest') || text.includes('tricep')) {
        tags.add('push');
        tags.add('chest');
        tags.add('triceps');
    }
    if (text.includes('pull') || text.includes('back') || text.includes('bicep')) {
        tags.add('pull');
        tags.add('back');
        tags.add('biceps');
        tags.add('lats');
    }
    if (text.includes('leg') || text.includes('lower')) {
        tags.add('legs');
        tags.add('quads');
        tags.add('hamstrings');
        tags.add('glutes');
        tags.add('calves');
    }
    if (text.includes('shoulder') || text.includes('upper')) {
        tags.add('shoulders');
    }
    if (text.includes('core')) {
        tags.add('core');
        tags.add('abs');
        tags.add('obliques');
    }
    if (text.includes('full body')) {
        tags.add('push');
        tags.add('pull');
        tags.add('legs');
    }
    if (sessionType === 'conditioning') tags.add('conditioning');
    if (targetFocus && targetFocus !== 'overall') {
        if (targetFocus === 'legs') {
            tags.add('legs');
            tags.add('quads');
            tags.add('hamstrings');
            tags.add('glutes');
        } else if (targetFocus === 'chest') {
            tags.add('chest');
            tags.add('push');
        } else if (targetFocus === 'core') {
            tags.add('core');
            tags.add('abs');
            tags.add('obliques');
        } else {
            tags.add(targetFocus);
        }
    }
    return tags;
}

function scoreVariant(variant, context, slotIndex, usedNames) {
    let score = 0;
    const tags = variant.tags || [];
    const focusTags = inferFocusTags(context.focus, context.sessionType, context.targetFocus);
    tags.forEach((tag) => {
        if (focusTags.has(tag)) score += 3;
    });
    if (context.goal === 'strength' && tags.includes('strength')) score += 3;
    if ((context.goal === 'muscle_gain' || context.goal === 'recomposition') && tags.includes('hypertrophy')) score += 3;
    if (context.goal === 'fat_loss' && tags.includes('conditioning')) score += 3;
    if (context.sessionType === 'conditioning' && tags.includes('conditioning')) score += 4;
    if (context.targetFocus === 'core' && tags.includes('core')) score += 5;
    if (context.targetFocus === 'chest' && tags.includes('chest')) score += 5;
    if (context.targetFocus === 'legs' && (tags.includes('legs') || tags.includes('quads') || tags.includes('hamstrings') || tags.includes('glutes'))) score += 5;
    if (context.experienceLevel === 'beginner' && tags.includes('strength')) score -= 1;
    if (usedNames.has(variant.name)) score -= 8;
    if (Array.isArray(variant.contraindications) && variant.contraindications.includes(context.limitations)) score -= 1000;
    score += (slotIndex % 2 === 0 && tags.includes('strength')) ? 1 : 0;
    return score;
}

function selectVariantName(patternName, context, slotIndex, usedNames) {
    const resolvedPattern = EXERCISE_PATTERN_ALIASES[patternName] || patternName;
    const variantGroups = EXERCISE_VARIANTS[resolvedPattern];
    if (!variantGroups) return patternName;

    const equipmentKey = getEquipmentVariantKey(context.equipmentAccess || 'home_basic');
    const pool = variantGroups[equipmentKey] || variantGroups.gym || variantGroups.home_basic || variantGroups.bodyweight;
    if (!Array.isArray(pool) || pool.length === 0) return patternName;

    const viable = pool
        .map((variant, index) => ({ variant, index, score: scoreVariant(variant, context, slotIndex, usedNames) }))
        .filter((entry) => entry.score > -500)
        .sort((a, b) => b.score - a.score || a.index - b.index);

    if (!viable.length) return patternName;

    const preferredPool = viable.filter((entry) => !usedNames.has(entry.variant.name));
    const candidatePool = preferredPool.length ? preferredPool : viable;
    const choiceWindow = candidatePool.slice(0, Math.min(3, candidatePool.length));
    const seed = hashString([
        resolvedPattern,
        context.goal,
        context.experienceLevel,
        context.equipmentAccess,
        context.targetFocus,
        context.focus,
        context.dayIndex,
        context.totalDays,
        context.splitType,
        context.limitations,
        slotIndex
    ].join('|'));
    return choiceWindow[seed % choiceWindow.length].variant.name;
}

function personalizeTemplate(template, context, slotIndex, usedNames) {
    const personalized = { ...template };
    personalized.name = selectVariantName(template.name, context, slotIndex, usedNames);
    usedNames.add(personalized.name);

    const name = personalized.name.toLowerCase();
    const isMainLift = /bench|press|squat|deadlift|row|pull-up|pullup|lat pulldown|hip thrust/.test(name);
    const isCore = /plank|dead bug|bird dog|twist|woodchopper|rollout|leg raise|pallof|mountain climber|hollow/.test(name);
    const isConditioning = context.sessionType === 'conditioning' || /jump|burpee|rope|bike|rowing|skierg|sled|high knees/.test(name);

    if (context.goal === 'strength' && isMainLift) {
        personalized.sets = Math.max(personalized.sets, context.experienceLevel === 'advanced' ? 5 : 4);
        personalized.reps = /deadlift/.test(name) ? '3-6' : '4-8';
        personalized.restSec = Math.max(personalized.restSec, 120);
        personalized.intensity = context.experienceLevel === 'beginner' ? 'moderate' : 'hard';
    } else if (context.goal === 'fat_loss' && !isConditioning) {
        personalized.reps = isMainLift ? '8-12' : (isCore ? '12-20' : '10-15');
        personalized.restSec = Math.min(personalized.restSec, isMainLift ? 90 : 60);
    } else if ((context.goal === 'muscle_gain' || context.goal === 'recomposition') && isMainLift) {
        personalized.reps = '6-10';
        personalized.restSec = Math.max(personalized.restSec, 75);
    }

    if (context.targetFocus === 'core' && isCore) {
        personalized.sets = Math.max(personalized.sets, 3);
        if (personalized.reps === '30-60s') personalized.reps = '40-60s';
    }

    if (context.experienceLevel === 'beginner' && personalized.intensity === 'hard') {
        personalized.intensity = 'moderate';
    }

    return personalized;
}

function prioritizeTemplates(templates, patternNames) {
    const priority = new Set(patternNames);
    return [...templates].sort((a, b) => {
        const aPriority = priority.has(a.name) ? 0 : 1;
        const bPriority = priority.has(b.name) ? 0 : 1;
        return aPriority - bPriority;
    });
}

function buildWarmupForDay(focus, equipmentAccess, limitations) {
    const key = String(focus || '').toLowerCase();
    if (key.includes('push') || key.includes('chest') || key.includes('shoulder')) {
        return equipmentAccess === 'gym'
            ? '5 min row; mobility for shoulders and upper back; 2 подготвителни серии за първото натискащо упражнение.'
            : '3-5 min brisk walk; arm circles; band pull-aparts; 2 леки подготвителни серии за първото натискащо движение.';
    }
    if (key.includes('pull') || key.includes('back') || key.includes('bicep')) {
        return equipmentAccess === 'gym'
            ? '5 min row or bike; shoulder blade activation; 2 леки подготвителни серии за първото гребащо движение.'
            : '3-5 min brisk walk; band rows; shoulder blade activation; 2 леки серии за първото гребащо движение.';
    }
    if (key.includes('leg') || key.includes('lower')) {
        return '5 min bike or treadmill walk; hip and ankle mobility; 2 леки подготвителни серии за първото упражнение за крака.';
    }
    if (key.includes('conditioning')) {
        return '5 min леко кардио; динамично раздвижване на цяло тяло; 1-2 по-леки подготвителни серии преди интервалите.';
    }
    if (limitations && limitations !== 'none') {
        return '5 min леко кардио; щадяща мобилност около чувствителната зона; започни плавно с първите 1-2 серии.';
    }
    return '5 min леко кардио + динамична мобилност за мускулите, които ще тренираш днес.';
}

function buildCooldownForDay(sessionType, limitations) {
    if (sessionType === 'conditioning') {
        return '3-5 min леко ходене; спокойно дишане и кратко разтягане на прасци, бедра и гърди.';
    }
    if (limitations && limitations !== 'none') {
        return '3-5 min спокойно дишане и леко разтягане, без да натоварваш чувствителната зона.';
    }
    return '3-5 min спокойно дишане и леко разтягане за основните мускули от тренировката.';
}

function mapFocusToTemplateKey(focus) {
    const f = String(focus || '').toLowerCase();
    if (f.includes('push')) return 'push';
    if (f.includes('pull')) return 'pull';
    if (f.includes('legs')) return 'legs';
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

function getExerciseTemplates(focus, sessionType, context = {}) {
    if (sessionType === 'conditioning') {
        return EXERCISE_TEMPLATES.conditioning.map((t) => ({ ...t }));
    }
    if (sessionType === 'recovery') {
        return EXERCISE_TEMPLATES.recovery.map((t) => ({ ...t }));
    }
    const key = mapFocusToTemplateKey(focus);
    let templates = (EXERCISE_TEMPLATES[key] || EXERCISE_TEMPLATES.full_body).map((t) => ({ ...t }));
    const focusKey = String(focus || '').toLowerCase();

    if (context.targetFocus === 'core' || focusKey.includes('core')) {
        const coreTemplate = { name: 'Plank or Core', sets: 3, reps: '10-15', restSec: 45, intensity: 'moderate', notes: '' };
        const hasCore = templates.some((template) => /plank|core|dead bug|bird dog/i.test(template.name));
        if (!hasCore) {
            if (templates.length >= 5) templates[templates.length - 1] = coreTemplate;
            else templates.push(coreTemplate);
        }
    }

    if (context.targetFocus === 'chest' && (focusKey.includes('push') || focusKey.includes('upper') || focusKey.includes('full body') || focusKey.includes('chest'))) {
        templates = prioritizeTemplates(templates, ['Bench Press or Push-up', 'Incline DB Press or Dips', 'Cable Fly or Push-up']);
    }

    if (context.targetFocus === 'legs' && (focusKey.includes('legs') || focusKey.includes('lower') || focusKey.includes('full body'))) {
        templates = prioritizeTemplates(templates, ['Squat or Leg Press', 'Romanian Deadlift', 'Lunges or Step-up', 'Leg Curl or Nordic']);
    }

    return templates;
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
