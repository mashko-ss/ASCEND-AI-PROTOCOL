/**
 * ASCEND AI PROTOCOL - Generate Plan API Route
 * POST /api/ai/generate-plan
 * Flow: normalize → classify → OpenAI → validate → fallback if needed
 * Never exposes OpenAI key. Never trusts raw AI output. Always validates.
 */

import { normalizeInput } from '../../lib/ai/normalizeInput.js';
import { classifyUser } from '../../lib/ai/classifyUser.js';
import { validatePlan } from '../../lib/ai/validatePlan.js';
import { generateRulePlan } from '../../lib/ai/generatePlan.js';
import { generateFallbackPlan } from '../../lib/ai/fallbackPlan.js';
import { createChatCompletion, isOpenAIAvailable } from '../../lib/openai/client.js';
import { buildPlanMessages } from '../../lib/openai/promptBuilder.js';

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
 * @returns {Promise<{ plan: Object|null, source: 'ai' }>}
 */
async function tryAIGeneration(normalizedInput, classification) {
    if (!isOpenAIAvailable()) {
        return { plan: null, source: 'ai' };
    }

    const messages = buildPlanMessages(normalizedInput, classification);
    const result = await createChatCompletion({ messages });

    if (!result.success || !result.text) {
        return { plan: null, source: 'ai' };
    }

    const rawPlan = parseAIResponse(result.text);
    if (!rawPlan) {
        return { plan: null, source: 'ai' };
    }

    const validation = validatePlan(rawPlan);
    if (!validation.valid || !validation.sanitizedPlan) {
        return { plan: null, source: 'ai' };
    }

    return { plan: validation.sanitizedPlan, source: 'ai' };
}

/**
 * Vercel serverless handler.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        res.status(405).json({ success: false, error: 'Method not allowed', plan: null });
        return;
    }

    let rawInput = {};
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        rawInput = body;
    } catch {
        res.status(400).json({ success: false, error: 'Invalid JSON body', plan: null });
        return;
    }

    const normalizedInput = normalizeInput(rawInput);
    const classification = classifyUser(normalizedInput);

    // Try OpenAI first
    const aiResult = await tryAIGeneration(normalizedInput, classification);

    if (aiResult.plan) {
        res.status(200).json({
            success: true,
            source: 'ai',
            plan: aiResult.plan
        });
        return;
    }

    // Fallback: rule engine
    let plan = generateRulePlan(normalizedInput);
    const validation = validatePlan(plan);

    if (!validation.valid) {
        plan = generateFallbackPlan();
    } else if (validation.sanitizedPlan) {
        plan = validation.sanitizedPlan;
    }

    res.status(200).json({
        success: true,
        source: 'fallback',
        plan
    });
}
