/**
 * ASCEND AI PROTOCOL - Generate Plan API Route
 * POST /api/ai/generate-plan
 * Flow: normalize → classify → OpenAI → validate → fallback if needed
 * Never exposes OpenAI key. Never trusts raw AI output. Always validates.
 */

import { normalizeInput } from '../../lib/ai/normalizeInput.js';
import { classifyUser } from '../../lib/ai/classifyUser.js';
import { validatePlan } from '../../lib/ai/validatePlan.js';
import { generateRulePlan, ensureUniqueDayExercises } from '../../lib/ai/generatePlan.js';
import { generateFallbackPlan } from '../../lib/ai/fallbackPlan.js';
import { adjustPlanForInjuries, normalizeInjuries } from '../../lib/ai/injuryAdjustmentEngine.js';
import { createResponse, isOpenAIAvailable } from '../../lib/openai/client.js';
import { buildPlanPrompt } from '../../lib/openai/promptBuilder.js';

/**
 * Parse AI response text into plan object. Never trust raw output.
 * @param {string} text
 * @returns {Object|null}
 */
function parseAIResponse(text) {
    if (!text || typeof text !== 'string') return null;
    const trimmed = text.trim();
    // Strip markdown code blocks if present
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
 * Try AI generation. Returns plan if valid, null otherwise.
 * @param {Object} normalizedInput
 * @param {Object} classification
 * @returns {Promise<{ plan: Object|null, source: 'ai', debugStage?: string, debugMessage?: string }>}
 */
async function tryAIGeneration(normalizedInput, classification) {
    if (!isOpenAIAvailable()) {
        return { plan: null, source: 'ai', debugStage: 'missing_key', debugMessage: 'OPENAI_API_KEY not set or empty' };
    }

    const { system, user } = buildPlanPrompt(normalizedInput, classification);
    const result = await createResponse({
        prompt: user,
        instructions: system
    });

    if (!result.success) {
        const errMsg = result.error || 'Unknown error';
        let stage = 'request_failed';
        if (errMsg.includes('not available')) stage = 'request_not_sent';
        else if (errMsg.includes('model') || errMsg.includes('404')) stage = 'invalid_model';
        return { plan: null, source: 'ai', debugStage: stage, debugMessage: errMsg };
    }

    if (!result.text) {
        return { plan: null, source: 'ai', debugStage: 'invalid_response', debugMessage: 'Empty response from OpenAI' };
    }

    const rawPlan = parseAIResponse(result.text);
    if (!rawPlan) {
        return { plan: null, source: 'ai', debugStage: 'parse_failed', debugMessage: 'Could not parse AI output as JSON' };
    }

    const validation = validatePlan(rawPlan);
    if (!validation.valid || !validation.sanitizedPlan) {
        const errList = validation.errors?.length ? validation.errors.join('; ') : 'Validation failed';
        return { plan: null, source: 'ai', debugStage: 'validation_failed', debugMessage: errList };
    }

    return { plan: validation.sanitizedPlan, source: 'ai', debugStage: 'ai_success' };
}

/**
 * Vercel serverless handler.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed', debugStage: null, debugMessage: null, plan: null });
        return;
    }

    let rawInput = {};
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const up = body.userProfile || body;
        const src = typeof up === 'object' && up !== null ? up : body;
        if (src.sex !== undefined || src.heightCm !== undefined || src.weightKg !== undefined) {
            rawInput = {
                gender: src.sex ?? src.gender,
                age: src.age,
                height: src.heightCm ?? src.height,
                weight: src.weightKg ?? src.weight,
                primary_goal: src.goal ?? src.primary_goal,
                activity: src.preferences?.activity ?? src.activity,
                target_focus: src.preferences?.target_focus ?? src.target_focus,
                experience: src.experienceLevel ?? src.experience,
                equipment: src.equipmentAccess === 'gym' ? 'gym' : (src.equipmentAccess || 'home'),
                days: src.trainingDaysPerWeek ?? src.days,
                duration: src.sessionDurationMin ?? src.duration,
                limitations: src.injuriesOrLimitations ?? src.limitations,
                diet: src.preferences?.diet ?? src.diet,
                allergies: src.preferences?.allergies ?? src.allergies
            };
        } else {
            rawInput = src;
        }
    } catch {
        res.status(400).json({ success: false, error: 'Invalid JSON body', debugStage: null, debugMessage: null, plan: null });
        return;
    }

    const normalizedInput = normalizeInput(rawInput);
    const classification = classifyUser(normalizedInput);

    // Try OpenAI first
    const aiResult = await tryAIGeneration(normalizedInput, classification);

    if (aiResult.plan) {
        let plan = ensureUniqueDayExercises(aiResult.plan, normalizedInput);
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
        res.status(200).json({
            success: true,
            source: 'ai',
            debugStage: 'ai_success',
            debugMessage: null,
            plan
        });
        return;
    }

    // Fallback: rule engine
    let plan = generateRulePlan(normalizedInput);
    const validation = validatePlan(plan);

    if (!validation.valid) {
        plan = generateFallbackPlan(normalizedInput);
    } else if (validation.sanitizedPlan) {
        plan = validation.sanitizedPlan;
    }

    plan = ensureUniqueDayExercises(plan, normalizedInput);

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

    res.status(200).json({
        success: true,
        source: 'fallback',
        debugStage: 'fallback_used',
        debugMessage: aiResult.debugMessage ?? aiResult.debugStage ?? null,
        plan
    });
}
