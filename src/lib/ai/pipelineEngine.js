/**
 * ASCEND AI PROTOCOL - Unified Pipeline Engine
 * Phase 21: Orchestrates all AI modules into a single coherent flow.
 * Logic-only. No UI changes.
 */

import { normalizeInput } from './normalizeInput.js';
import { generatePlan } from './generatePlan.js';
import { validatePlan } from './validatePlan.js';
import { generateFallbackPlan } from './fallbackPlan.js';
import { evaluateProgress } from './adaptiveEngine.js';
import { adjustPlanForInjuries, normalizeInjuries } from './injuryAdjustmentEngine.js';
import { generateNutritionPlan } from './generateNutritionPlan.js';
import { createEmptyMemory } from './nutritionAdaptationMemory.js';
import { generateSupplementRecommendations, createSupplementMemory } from './supplementEngine.js';
import { generateAdaptationSummary } from './adaptationSummaryEngine.js';
import { validateProtocolSafety } from './safetyValidator.js';
import { applyAdaptiveAdjustmentsToPlan, applyAdaptiveAdjustmentsToNutrition } from './regenerationEngine.js';
import { getLatestProgress, getProgressHistory } from './progressTracker.js';
import { getCurrentUserId } from './protocolEngine.js';

/**
 * Build workout_plan array from plan.weeklyPlan.
 * @param {Object} plan
 * @returns {Array}
 */
function toWorkoutPlan(plan) {
    if (!plan?.weeklyPlan || !Array.isArray(plan.weeklyPlan)) return [];
    return plan.weeklyPlan.map((day) => {
        const exercises = [];
        for (const block of day.mainBlocks || []) {
            for (const ex of block.exercises || []) {
                exercises.push({
                    name: ex.name,
                    sets: String(ex.sets || 3),
                    reps: ex.reps || '8-12',
                    rest: `${ex.restSec || 90}s`,
                    rpe: ex.rpe ?? '7',
                    tempo: ex.tempo || '3-1-X-1'
                });
            }
        }
        return {
            day: day.dayName,
            focus: day.focus,
            warmup: (day.warmup || [])[0]?.name || '5 min light cardio; dynamic stretches for the muscles you\'ll train today.',
            exercises
        };
    });
}

/**
 * Build nutrition_plan object from generateNutritionPlan output + supplement stack.
 * @param {Object} np - From generateNutritionPlan
 * @param {Object} supplementOutput - From generateSupplementRecommendations
 * @param {string} goal
 * @returns {Object}
 */
function toNutritionPlan(np, supplementOutput, goal) {
    const essentials = supplementOutput?.essentials || [];
    const optional = supplementOutput?.optional || [];
    const supplement_stack = [...essentials, ...optional].map(s => ({
        name: s.name,
        purpose: s.purpose || '',
        dose: s.dose || ''
    }));

    return {
        calories: np?.calories ?? 2000,
        daily_calories: `${np?.calories ?? 2000} kcal`,
        macros: {
            protein: `${np?.macros?.protein ?? 150}g`,
            carbs: `${np?.macros?.carbs ?? 200}g`,
            fats: `${np?.macros?.fats ?? 65}g`
        },
        mealsPerDay: np?.mealsPerDay ?? 4,
        hydrationLiters: np?.hydrationLiters ?? 2.5,
        mealPlan: np?.mealPlan || [],
        notes: np?.notes || [],
        warnings: np?.warnings || [],
        guidelines: np?.notes || [],
        meal_timing: {
            pre_workout: '60–90 min before: 30–40g carbs + 15–20g protein. Caffeine optional 30–45 min pre (3–5 mg/kg).',
            post_workout: 'Within 1–2 hours: 40–60g carbs + 25–40g protein. Prioritize whole foods when possible.'
        },
        supplement_stack,
        nutritionMemory: np?.nutritionMemory
    };
}

/**
 * Build supplement_plan from supplement output.
 * @param {Object} supplementOutput
 * @returns {Object}
 */
function toSupplementPlan(supplementOutput) {
    const essentials = supplementOutput?.essentials || [];
    const optional = supplementOutput?.optional || [];
    return {
        essentials,
        optional,
        avoid_or_caution: supplementOutput?.avoid_or_caution || [],
        reasoning: supplementOutput?.reasoning || [],
        supplementMemory: supplementOutput?.supplementMemory,
        adaptationNotes: supplementOutput?.adaptationNotes || []
    };
}

/**
 * Run full protocol pipeline. Orchestrates training, injury, nutrition, supplements,
 * adaptation summary, and safety validation.
 *
 * @param {Object} input - Raw assessment/form data
 * @param {Object} [options]
 * @param {Object} [options.existingProtocol] - For nutritionMemory, supplementMemory
 * @param {string} [options.userId] - For progress lookup; defaults to getCurrentUserId()
 * @param {Object} [options.progressData] - Override progress; if omitted, loads from progressTracker
 * @returns {Promise<Object>} Pipeline result
 */
export async function runFullProtocolPipeline(input, options = {}) {
    const rawInput = input || {};
    const existingProtocol = options?.existingProtocol || null;
    const userId = options?.userId ?? getCurrentUserId();

    const nutritionMemory = existingProtocol?.aiResult?.nutritionMemory || createEmptyMemory();
    const supplementMemory = existingProtocol?.aiResult?.supplementMemory || createSupplementMemory();

    const normalizedInput = normalizeInput(rawInput);
    const goal = rawInput?.primary_goal || rawInput?.goal || normalizedInput?.goal || 'recomp';

    let plan = await generatePlan(normalizedInput);
    let injuryResult = null;

    const injuries = normalizeInjuries(normalizedInput?.limitations || rawInput?.limitations, []);
    if (injuries.length > 0) {
        injuryResult = adjustPlanForInjuries(plan, injuries);
        if (injuryResult?.adjustedPlan) {
            plan = injuryResult.adjustedPlan;
        }
    }

    const validation = validatePlan(plan);
    if (!validation.valid) {
        plan = generateFallbackPlan();
    }

    let progressData = options?.progressData;
    if (progressData == null && userId) {
        const latest = getLatestProgress(userId);
        if (latest) {
            const history = getProgressHistory(userId);
            const baseline = history.length > 1 ? history[history.length - 1] : latest;
            progressData = {
                bodyWeight: latest.bodyWeight,
                baselineWeight: baseline?.bodyWeight ?? latest.bodyWeight,
                strengthChange: latest.strengthChange ?? 0,
                fatigueLevel: latest.fatigueLevel ?? 5,
                adherence: latest.adherence ?? 100,
                sleepScore: latest.sleepScore ?? 7,
                injuries: latest.injuries ?? [],
                weeksSinceStart: history.length
            };
        }
    }

    let adaptation = null;
    if (progressData && Object.keys(progressData).length > 0) {
        const userProfile = {
            goal: rawInput?.primary_goal || rawInput?.goal || goal,
            weight: rawInput?.weight || rawInput?.weightKg || 80,
            limitations: rawInput?.limitations || normalizedInput?.limitations || 'none'
        };
        adaptation = evaluateProgress(userProfile, plan, progressData);
        plan = applyAdaptiveAdjustmentsToPlan(plan, adaptation, adaptation?.triggerDeload || false) || plan;
    }

    const nutritionPlanRaw = generateNutritionPlan(rawInput, { nutritionMemory });
    let nutritionPlan = adaptation?.nutritionAdjustments?.calorieChange
        ? applyAdaptiveAdjustmentsToNutrition(nutritionPlanRaw, adaptation, rawInput)
        : nutritionPlanRaw;
    nutritionPlan = { ...nutritionPlanRaw, ...nutritionPlan, nutritionMemory: nutritionPlanRaw.nutritionMemory };

    const supplementOutput = generateSupplementRecommendations(rawInput, supplementMemory);

    const protocolStub = {
        apiPlan: plan,
        meta: { goal, limitations: rawInput?.limitations || 'none' },
        aiResult: {
            nutrition_plan: nutritionPlan,
            nutritionMemory,
            supplementMemory: supplementOutput?.supplementMemory || supplementMemory
        }
    };

    const adaptationSummary = generateAdaptationSummary({
        protocol: protocolStub,
        inputs: rawInput,
        outputs: {
            adaptation,
            injuryResult,
            nutritionPlan,
            supplementOutput,
            progressData,
            regenerationResult: null
        }
    });

    const safety = validateProtocolSafety({
        protocol: protocolStub,
        nutritionPlan,
        supplementOutput,
        adaptationSummary,
        progressData,
        inputs: rawInput
    });

    const workout_plan = toWorkoutPlan(plan);
    const nutrition_plan = toNutritionPlan(nutritionPlan, supplementOutput, goal);
    const supplement_plan = toSupplementPlan(supplementOutput);

    return {
        workout_plan,
        nutrition_plan,
        supplement_plan,
        adaptationSummary,
        safety: {
            valid: safety.valid,
            warnings: safety.warnings,
            criticalFlags: safety.criticalFlags,
            qualityScore: safety.qualityScore
        },
        plan,
        nutritionMemory: nutritionPlan.nutritionMemory || nutritionMemory,
        supplementMemory: supplementOutput?.supplementMemory || supplementMemory
    };
}
