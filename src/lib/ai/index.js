/**
 * ASCEND AI PROTOCOL - AI Engine Public Interface
 * Phase 1: Rule-based system. Prepared for future OpenAI integration.
 */

import { normalizeInput } from './normalizeInput.js';
import { classifyUser } from './classifyUser.js';
import { generatePlan } from './generatePlan.js';
import { validatePlan } from './validatePlan.js';
import { generateFallbackPlan } from './fallbackPlan.js';
import { savePlanResult } from './savePlanResult.js';

/**
 * Main entry: run the full AI engine pipeline on raw form data.
 * @param {Object} rawInput - Raw assessment form data (e.g. wizardModule.data)
 * @returns {Object} { success, plan, normalizedInput, classification, validation, saveResult, error }
 */
export function runEngine(rawInput) {
    try {
        const normalizedInput = normalizeInput(rawInput);
        const classification = classifyUser(normalizedInput);
        let plan = generatePlan(normalizedInput);
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
 * @param {Object} plan - Plan from generatePlan (or runEngine)
 * @param {Object} rawInput - Raw form data for nutrition/calories
 * @returns {{ workout_plan: Array, nutrition_plan: Object }}
 */
export function toDashboardFormat(plan, rawInput = {}) {
    if (!plan || !plan.weeklyPlan) {
        return { workout_plan: [], nutrition_plan: {} };
    }

    const workout_plan = plan.weeklyPlan.map((day) => {
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
    });

    const goal = rawInput.primary_goal || plan.planMeta?.goal || 'recomp';
    const weight = parseFloat(rawInput.weight) || 80;
    const activity = rawInput.activity || 'moderate';
    let tdee = 2000;
    if (activity === 'highly') tdee = 3000;
    else if (activity === 'moderate' || activity === 'lightly') tdee = 2500;
    else if (activity === 'sedentary') tdee = 2000;
    let calories = goal === 'fat_loss' ? tdee - 500 : (goal === 'muscle_gain' ? tdee + 300 : tdee);
    const protein = goal === 'fat_loss' ? 180 : 160;

    const nutrition_plan = {
        daily_calories: `${calories} kcal`,
        macros: {
            protein: `${protein}g`,
            carbs: `${Math.round((calories * 0.4) / 4)}g`,
            fats: `${Math.round((calories * 0.25) / 9)}g`
        },
        guidelines: [
            'Prioritize protein at every meal (aim for 25-40g per meal).',
            'Eat whole foods 80% of the time; allow flexibility for the rest.',
            'Stay hydrated: 2.5-3 L water daily, more on training days.',
            'Time carbs around training for energy and recovery.',
            'Include fiber-rich vegetables with lunch and dinner.'
        ],
        meal_timing: {
            pre_workout: '60–90 min before: 30–40g carbs + 15–20g protein (e.g. oats + banana + whey, or rice cakes + Greek yogurt). Caffeine optional 30–45 min pre (3–5 mg/kg).',
            post_workout: 'Within 1–2 hours: 40–60g carbs + 25–40g protein. Example: chicken + rice + vegetables, or whey + banana + toast. Prioritize whole foods when possible.'
        },
        supplement_stack: [
            { name: 'Creatine Monohydrate', purpose: 'Strength and lean mass; evidence-based for all goals.', dose: '5 g daily (any time).' },
            { name: 'Vitamin D3', purpose: 'Bone health, immunity, mood; especially if low sun exposure.', dose: '2,000–4,000 IU with a fat-containing meal.' },
            { name: 'Omega-3 (EPA/DHA)', purpose: 'Recovery, joint health, body composition.', dose: '2–3 g EPA+DHA combined daily.' },
            { name: 'Whey or Plant Protein', purpose: 'Convenient way to hit protein targets.', dose: '1–2 scoops as needed to meet daily protein.' }
        ]
    };

    return { workout_plan, nutrition_plan };
}

export { normalizeInput, classifyUser, generatePlan, validatePlan, generateFallbackPlan, savePlanResult };
