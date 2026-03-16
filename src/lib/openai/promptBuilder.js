/**
 * ASCEND AI PROTOCOL - OpenAI Prompt Builder
 * Build prompts with system prompt, developer rules, user context, and JSON schema.
 * Enforces JSON output only.
 */

import { GOALS, EXPERIENCE_LEVELS, SPLIT_TYPES, EQUIPMENT_ACCESS, SESSION_TYPES } from '../ai/schemas.js';

const SYSTEM_PROMPT = `You are an expert fitness coach for the ASCEND AI PROTOCOL. Generate personalized weekly training plans.

DEVELOPER RULES (strict):
- Output ONLY valid JSON. No markdown, no code blocks, no explanation before or after.
- Use only these enums: goals=${GOALS.join('|')}, experienceLevels=${EXPERIENCE_LEVELS.join('|')}, splitTypes=${SPLIT_TYPES.join('|')}, equipment=${EQUIPMENT_ACCESS.join('|')}, sessionTypes=${SESSION_TYPES.join('|')}.
- trainingDaysPerWeek: 2-6. sessionDurationMin: 30, 45, 60, or 90.
- Each exercise: name, sets (number), reps (string e.g. "8-12"), restSec (number), intensity ("easy"|"moderate"|"hard"), notes (string).
- Respect equipment access: bodyweight users get no barbells/dumbbells; home_basic allows bands/resistance.
- Beginner plans: max 5 exercises per session, lower volume.
- Never suggest exercises contraindicated for stated limitations.`;

const PLAN_JSON_SCHEMA = `{
  "planMeta": {
    "goal": "string (from goals enum)",
    "experienceLevel": "string (from experienceLevels enum)",
    "splitType": "string (from splitTypes enum)",
    "trainingDaysPerWeek": "number 2-6",
    "sessionDurationMin": "number 30|45|60|90",
    "equipmentAccess": "string (from equipment enum)",
    "difficulty": "low|moderate|high"
  },
  "userSummary": {
    "classificationLabel": "string",
    "recoveryProfile": "low|moderate|high",
    "scheduleProfile": "tight|standard|flexible",
    "notes": ["string"]
  },
  "weeklyPlan": [
    {
      "dayIndex": "number 1-based",
      "dayName": "Monday|Tuesday|...",
      "focus": "string",
      "sessionType": "string (from sessionTypes enum)",
      "durationMin": "number",
      "warmup": [{"name": "string", "durationMin": "number"}],
      "mainBlocks": [{"blockName": "string", "exerciseType": "compound|isolation|cardio|mobility|core|circuit", "exercises": [{"name": "string", "sets": "number", "reps": "string", "restSec": "number", "intensity": "string", "notes": "string"}]}],
      "cooldown": [{"name": "string", "durationMin": "number"}]
    }
  ],
  "progressionRules": {
    "method": "string",
    "weeklyAdjustment": "string",
    "deloadTrigger": "string"
  },
  "recoveryGuidance": {
    "restDayCount": "number",
    "sleepTargetHours": "string",
    "hydrationGuidance": "string"
  },
  "warnings": ["string"]
}`;

/**
 * Build the full prompt for plan generation.
 * @param {Object} normalizedInput - From normalizeInput()
 * @param {Object} classification - From classifyUser()
 * @returns {{ system: string, user: string }}
 */
export function buildPlanPrompt(normalizedInput, classification) {
    const input = normalizedInput || {};
    const cls = classification || {};

    const userContext = {
        goal: input.goal || cls.goal || 'recomposition',
        experienceLevel: input.experienceLevel || cls.experienceLevel || 'beginner',
        equipmentAccess: input.equipmentAccess || cls.equipmentAccess || 'home_basic',
        trainingDaysPerWeek: input.trainingDaysPerWeek ?? 3,
        sessionDurationMin: input.sessionDurationMin ?? 60,
        limitations: input.limitations || cls.limitations || 'none',
        age: input.age,
        gender: input.gender,
        activity: input.activity,
        targetFocus: input.targetFocus
    };

    const userPrompt = `Generate a weekly training plan as JSON only.

USER CONTEXT:
${JSON.stringify(userContext, null, 2)}

REQUIRED OUTPUT SCHEMA (output exactly this structure, valid JSON only):
${PLAN_JSON_SCHEMA}

Respond with ONLY the JSON object. No other text.`;

    return {
        system: SYSTEM_PROMPT,
        user: userPrompt
    };
}

/**
 * Build messages array for OpenAI chat API.
 * @param {Object} normalizedInput
 * @param {Object} classification
 * @returns {Array<{role:string,content:string}>}
 */
export function buildPlanMessages(normalizedInput, classification) {
    const { system, user } = buildPlanPrompt(normalizedInput, classification);
    return [
        { role: 'system', content: system },
        { role: 'user', content: user }
    ];
}
