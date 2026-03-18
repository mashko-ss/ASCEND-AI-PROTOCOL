/**
 * ⚠️ CORE FILE – DO NOT MODIFY LIGHTLY
 * This file is used across the entire system.
 * Only exports are allowed.
 * No logic, no side effects.
 *
 * ASCEND AI PROTOCOL - AI Engine Public Interface
 * Phase 1: Rule-based system. Prepared for future OpenAI integration.
 */

// ===== IMPORTS =====
import { normalizeInput } from './normalizeInput.js';
import { classifyUser } from './classifyUser.js';
import { generatePlan, generateRulePlan } from './generatePlan.js';
import { validatePlan } from './validatePlan.js';
import { generateFallbackPlan } from './fallbackPlan.js';
import { savePlanResult } from './savePlanResult.js';
import { generateNutritionPlan } from './generateNutritionPlan.js';
import { evaluateProgress, evaluateProgressWithLog } from './adaptiveEngine.js';
import { getLatestProgress, getProgressHistory, saveProgressEntry, validateProgressEntry, clearProgressHistory } from './progressTracker.js';
import { generateRecommendations } from './recommendationEngine.js';
import { createProtocol, getActiveProtocol, getCurrentUserId, saveActiveProtocol, saveNewProtocol, advanceProtocolWeek, addProtocolSnapshot, completeProtocol, getProtocolHistory, isDeloadWeek, getNextDeloadWeek } from './protocolEngine.js';
import { regenerateNextWeekProtocol, buildNextWeekSnapshot, applyAdaptiveAdjustmentsToPlan, applyAdaptiveAdjustmentsToNutrition } from './regenerationEngine.js';
import { adjustPlanForInjuries, normalizeInjuries, getInjuryWarnings } from './injuryAdjustmentEngine.js';
import { getInjuryState, saveInjuryState, evaluateInjuryRecovery, buildReintroductionAdjustments, restoreTowardBaseProtocol, isInjuryCleared, processProgressForRecovery, advanceRecoveryWeek } from './injuryRecoveryEngine.js';
import { createPeriodizationBlock, getWeekPhase, applyPhaseToPlan, getPhaseAdjustments } from './periodizationEngine.js';

/**
 * Main entry: run the full AI engine pipeline on raw form data.
 * @param {Object} rawInput - Raw assessment form data (e.g. wizardModule.data)
 * @returns {Promise<Object>} { success, plan, normalizedInput, classification, validation, saveResult, error }
 */
export async function runEngine(rawInput) {
    try {
        const normalizedInput = normalizeInput(rawInput);
        const classification = classifyUser(normalizedInput);
        let plan = await generatePlan(normalizedInput);

        // Phase 9: Injury adjustment when limitations exist
        const injuries = normalizeInjuries(normalizedInput.limitations, []);
        if (injuries.length > 0) {
            const injuryResult = adjustPlanForInjuries(plan, injuries);
            if (injuryResult.adjustedPlan) {
                plan = injuryResult.adjustedPlan;
                if (injuryResult.warnings?.length) {
                    plan.warnings = [...(plan.warnings || []), ...injuryResult.warnings];
                }
            }
        }

        const validation = validatePlan(plan);

        if (!validation.valid) {
            plan = generateFallbackPlan();
            const fallbackValidation = validatePlan(plan);
            const saveResult = savePlanResult({
                input: normalizedInput,
                classification,
                plan,
                validation: { ...fallbackValidation, fallbackUsed: true },
                source: 'fallback'
            });
            return {
                success: true,
                plan,
                normalizedInput,
                classification,
                validation: fallbackValidation,
                saveResult,
                fallbackUsed: true
            };
        }

        const saveResult = savePlanResult({
            input: normalizedInput,
            classification,
            plan: validation.sanitizedPlan || plan,
            validation,
            source: 'rule_based'
        });

        return {
            success: true,
            plan: validation.sanitizedPlan || plan,
            normalizedInput,
            classification,
            validation,
            saveResult,
            fallbackUsed: false
        };
    } catch (err) {
        const fallbackPlan = generateFallbackPlan();
        return {
            success: false,
            plan: fallbackPlan,
            normalizedInput: null,
            classification: null,
            validation: null,
            saveResult: null,
            fallbackUsed: true,
            error: err && err.message ? err.message : String(err)
        };
    }
}

/**
 * Convert AI engine plan format to dashboard-compatible format (workout_plan + nutrition_plan).
 * Phase 14D: Loads nutritionMemory from existing protocol, passes to generateNutritionPlan, returns it for persistence.
 * @param {Object} plan - Plan from generatePlan (or runEngine)
 * @param {Object} rawInput - Raw form data for nutrition/calories
 * @param {Object} [existingProtocol] - Optional; if omitted, loads from getActiveProtocol(getCurrentUserId())
 * @returns {{ workout_plan: Array, nutrition_plan: Object, nutritionMemory?: Object }}
 */
export function toDashboardFormat(plan, rawInput = {}, existingProtocol = null) {
    const workout_plan = (plan?.weeklyPlan && Array.isArray(plan.weeklyPlan))
        ? plan.weeklyPlan.map((day) => {
        const exercises = [];
        for (const block of day.mainBlocks || []) {
            for (const ex of block.exercises || []) {
                exercises.push({
                    name: ex.name,
                    sets: String(ex.sets || 3),
                    reps: ex.reps || '8-12',
                    rest: `${ex.restSec || 90}s`,
                    rpe: '7',
                    tempo: '3-1-X-1'
                });
            }
        }
        return {
            day: day.dayName,
            focus: day.focus,
            warmup: (day.warmup || [])[0]?.name || '5 min light cardio; dynamic stretches for the muscles you\'ll train today.',
            exercises
        };
    })
        : [];

    const np = generateNutritionPlan(rawInput);
    const goal = rawInput.primary_goal || plan.planMeta?.goal || 'recomp';
    const supplementStacks = {
        fat_loss: [
            { name: 'Caffeine', purpose: 'Performance and focus; supports fat oxidation.', dose: '3–5 mg/kg 30–45 min pre-workout.' },
            { name: 'Whey or Plant Protein', purpose: 'Preserve muscle while in deficit.', dose: '1–2 scoops as needed.' },
            { name: 'Vitamin D3', purpose: 'Immune and metabolic support.', dose: '2,000–4,000 IU daily with fat.' },
            { name: 'Omega-3 (EPA/DHA)', purpose: 'Recovery and body composition.', dose: '2–3 g EPA+DHA daily.' }
        ],
        muscle_gain: [
            { name: 'Creatine Monohydrate', purpose: 'Strength and lean mass; strong evidence.', dose: '5 g daily, any time.' },
            { name: 'Whey or Plant Protein', purpose: 'Hit daily protein targets.', dose: '1–2 scoops as needed.' },
            { name: 'Vitamin D3', purpose: 'Bone health, immunity.', dose: '2,000–4,000 IU daily.' },
            { name: 'Omega-3 (EPA/DHA)', purpose: 'Recovery and joint health.', dose: '2–3 g EPA+DHA daily.' }
        ],
        endurance: [
            { name: 'Electrolytes', purpose: 'Hydration and performance during long sessions.', dose: 'As needed during training.' },
            { name: 'Vitamin D3', purpose: 'Health and immunity.', dose: '2,000–4,000 IU daily.' },
            { name: 'Omega-3 (EPA/DHA)', purpose: 'Recovery.', dose: '2–3 g EPA+DHA daily.' },
            { name: 'Protein', purpose: 'Recovery and muscle maintenance.', dose: 'As needed.' }
        ]
    };
    const supplement_stack = supplementStacks[goal] || supplementStacks.muscle_gain;

    const nutrition_plan = {
        calories: np.calories,
        daily_calories: `${np.calories} kcal`,
        macros: {
            protein: `${np.macros.protein}g`,
            carbs: `${np.macros.carbs}g`,
            fats: `${np.macros.fats}g`
        },
        mealsPerDay: np.mealsPerDay,
        hydrationLiters: np.hydrationLiters,
        mealPlan: np.mealPlan,
        notes: np.notes,
        warnings: np.warnings,
        guidelines: np.notes,
        meal_timing: {
            pre_workout: '60–90 min before: 30–40g carbs + 15–20g protein (e.g. oats + banana + whey, or rice cakes + Greek yogurt). Caffeine optional 30–45 min pre (3–5 mg/kg).',
            post_workout: 'Within 1–2 hours: 40–60g carbs + 25–40g protein. Example: chicken + rice + vegetables, or whey + banana + toast. Prioritize whole foods when possible.'
        },
        supplement_stack
    };

    const result = { workout_plan, nutrition_plan };
    if (np.nutritionMemory) result.nutritionMemory = np.nutritionMemory;
    return result;
}

/**
 * Evaluate progress using latest stored entry. Feeds progressTracker data into adaptive engine.
 * @param {string} userId - Current user id/email
 * @param {Object} userProfile - { goal, weight, ... }
 * @param {Object} currentPlan - Plan with planMeta, weeklyPlan
 * @returns {Object|null} Adaptation result or null if no progress data
 */
export function evaluateProgressFromLatest(userId, userProfile, currentPlan) {
    const latest = getLatestProgress(userId);
    if (!latest) return null;
    const history = getProgressHistory(userId);
    const baseline = history.length > 1 ? history[history.length - 1] : latest;
    const progressData = {
        bodyWeight: latest.bodyWeight,
        baselineWeight: baseline?.bodyWeight ?? latest.bodyWeight,
        strengthChange: latest.strengthChange ?? 0,
        fatigueLevel: latest.fatigueLevel ?? 5,
        adherence: latest.adherence ?? 100,
        sleepScore: latest.sleepScore ?? 7,
        injuries: latest.injuries ?? [],
        weeksSinceStart: history.length
    };
    return evaluateProgress(userProfile, currentPlan, progressData);
}

/**
 * Evaluate progress from latest entry and generate coaching recommendations.
 * Integrates adaptive engine with recommendation engine.
 * @param {string} userId - Current user id/email
 * @param {Object} userProfile - { goal, weight, ... }
 * @param {Object} currentPlan - Plan with planMeta, weeklyPlan
 * @returns {{ adaptation: Object, recommendations: Array }|null} Or null if no progress data
 */
export function getRecommendationsFromLatest(userId, userProfile, currentPlan) {
    const adaptation = evaluateProgressFromLatest(userId, userProfile, currentPlan);
    if (!adaptation) return null;
    const latest = getLatestProgress(userId);
    if (!latest) return { adaptation, recommendations: [] };
    const history = getProgressHistory(userId);
    const baseline = history.length > 1 ? history[history.length - 1] : latest;
    const progressData = {
        bodyWeight: latest.bodyWeight,
        baselineWeight: baseline?.bodyWeight ?? latest.bodyWeight,
        strengthChange: latest.strengthChange ?? 0,
        fatigueLevel: latest.fatigueLevel ?? 5,
        adherence: latest.adherence ?? 100,
        sleepScore: latest.sleepScore ?? 7,
        injuries: latest.injuries ?? [],
        weeksSinceStart: history.length,
        limitations: userProfile?.limitations || currentPlan?.planMeta?.limitations || 'none'
    };
    const goal = userProfile?.goal || userProfile?.primary_goal || currentPlan?.planMeta?.goal || 'recomposition';
    const recommendations = generateRecommendations(adaptation, progressData, goal);
    return { adaptation, recommendations };
}

// ===== RE-EXPORTS =====
// Training / Plan
export { normalizeInput, classifyUser, generatePlan, generateRulePlan, validatePlan, generateFallbackPlan, savePlanResult };
// Nutrition
export { generateNutritionPlan };
// Progress / Adaptive
export { evaluateProgress, evaluateProgressWithLog, getProgressHistory, getLatestProgress, saveProgressEntry, validateProgressEntry, clearProgressHistory, generateRecommendations };
// Protocol
export { createProtocol, getActiveProtocol, getCurrentUserId, saveActiveProtocol, saveNewProtocol, advanceProtocolWeek, addProtocolSnapshot, completeProtocol, getProtocolHistory, isDeloadWeek, getNextDeloadWeek };
// Regeneration
export { regenerateNextWeekProtocol, buildNextWeekSnapshot, applyAdaptiveAdjustmentsToPlan, applyAdaptiveAdjustmentsToNutrition };
// Injury
export { adjustPlanForInjuries, normalizeInjuries, getInjuryWarnings, getInjuryState, saveInjuryState, evaluateInjuryRecovery, buildReintroductionAdjustments, restoreTowardBaseProtocol, isInjuryCleared, processProgressForRecovery, advanceRecoveryWeek };
// Periodization
export { createPeriodizationBlock, getWeekPhase, applyPhaseToPlan, getPhaseAdjustments };
