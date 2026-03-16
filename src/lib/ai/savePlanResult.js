/**
 * ASCEND AI PROTOCOL - AI Engine Save Plan Result
 * Build a save-ready result object for persistence.
 */

import { generatePlanId } from './utils.js';

const ENGINE_VERSION = '1.0.0';

/**
 * Build a save-ready result object.
 * @param {Object} params
 * @param {Object} params.input - Normalized input
 * @param {Object} params.classification - From classifyUser
 * @param {Object} params.plan - Generated plan (validated/sanitized)
 * @param {Object} params.validation - From validatePlan { valid, errors, warnings }
 * @param {string} [params.source='rule_based'] - Source of the plan
 * @returns {Object} Save-ready result
 */
export function savePlanResult({ input, classification, plan, validation, source = 'rule_based' }) {
    const planId = generatePlanId();
    const createdAt = new Date().toISOString();

    return {
        planId,
        source,
        input: input || {},
        classification: classification || {},
        plan: plan || {},
        validation: validation || { valid: false, errors: [], warnings: [] },
        createdAt,
        version: ENGINE_VERSION
    };
}
