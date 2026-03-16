/**
 * ASCEND AI PROTOCOL - AI Engine Validate Plan
 * Validate plan structure and business rules.
 */

import { toSafeArray } from './utils.js';
import { GOALS, EXPERIENCE_LEVELS, SPLIT_TYPES, EQUIPMENT_ACCESS, SESSION_TYPES } from './schemas.js';
import { getEquipmentCompatibleTypes } from './rules.js';

/**
 * Validate a generated plan.
 * @param {Object} plan - Generated plan from generatePlan()
 * @returns {{ valid: boolean, errors: string[], warnings: string[], sanitizedPlan: Object|null }}
 */
export function validatePlan(plan) {
    const errors = [];
    const warnings = [];
    let sanitizedPlan = null;

    if (!plan || typeof plan !== 'object') {
        return { valid: false, errors: ['Plan is missing or invalid.'], warnings: [], sanitizedPlan: null };
    }

    // Required keys
    const requiredKeys = ['planMeta', 'userSummary', 'weeklyPlan', 'progressionRules', 'recoveryGuidance', 'warnings'];
    for (const key of requiredKeys) {
        if (!(key in plan)) {
            errors.push(`Missing required key: ${key}`);
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors, warnings, sanitizedPlan: null };
    }

    // Validate planMeta
    const meta = plan.planMeta;
    if (meta) {
        if (!GOALS.includes(meta.goal)) {
            errors.push(`Unsupported goal: ${meta.goal}`);
        }
        if (!EXPERIENCE_LEVELS.includes(meta.experienceLevel)) {
            errors.push(`Unsupported experienceLevel: ${meta.experienceLevel}`);
        }
        if (!SPLIT_TYPES.includes(meta.splitType)) {
            errors.push(`Unsupported splitType: ${meta.splitType}`);
        }
        if (!EQUIPMENT_ACCESS.includes(meta.equipmentAccess)) {
            errors.push(`Unsupported equipmentAccess: ${meta.equipmentAccess}`);
        }
        const days = meta.trainingDaysPerWeek;
        if (typeof days !== 'number' || days < 2 || days > 6) {
            errors.push('trainingDaysPerWeek must be 2-6');
        }
        const dur = meta.sessionDurationMin;
        if (typeof dur !== 'number' || ![30, 45, 60, 90].includes(dur)) {
            errors.push('sessionDurationMin must be 30, 45, 60, or 90');
        }
    }

    // Validate weeklyPlan
    const weeklyPlan = toSafeArray(plan.weeklyPlan);
    if (weeklyPlan.length === 0) {
        errors.push('weeklyPlan cannot be empty');
    }

    const seenDayIndices = new Set();
    for (const day of weeklyPlan) {
        if (typeof day.dayIndex !== 'number') {
            errors.push('Each day must have a numeric dayIndex');
        } else if (seenDayIndices.has(day.dayIndex)) {
            errors.push(`Duplicate dayIndex: ${day.dayIndex}`);
        } else {
            seenDayIndices.add(day.dayIndex);
        }

        const dur = day.durationMin;
        if (typeof dur === 'number' && (dur < 15 || dur > 180)) {
            errors.push(`Impossible duration for day ${day.dayIndex}: ${dur} min`);
        }

        const mainBlocks = toSafeArray(day.mainBlocks);
        let totalExercises = 0;
        for (const block of mainBlocks) {
            totalExercises += toSafeArray(block.exercises).length;
        }
        const maxForDuration = getMaxExercisesForDuration(day.durationMin || 60);
        if (totalExercises > maxForDuration + 2) {
            warnings.push(`Day ${day.dayIndex} may have too many exercises for ${day.durationMin} min session`);
        }
    }

    // Equipment compatibility
    if (meta && meta.equipmentAccess) {
        const allowed = getEquipmentCompatibleTypes(meta.equipmentAccess);
        for (const day of weeklyPlan) {
            for (const block of toSafeArray(day.mainBlocks)) {
                const exType = block.exerciseType;
                if (exType && allowed.length > 0 && !allowed.includes(exType)) {
                    warnings.push(`Exercise type ${exType} may not match equipment ${meta.equipmentAccess}`);
                }
            }
        }
    }

    // Beginner volume check
    if (meta && meta.experienceLevel === 'beginner' && weeklyPlan.length > 0) {
        let totalSets = 0;
        for (const day of weeklyPlan) {
            for (const block of toSafeArray(day.mainBlocks)) {
                for (const ex of toSafeArray(block.exercises)) {
                    totalSets += typeof ex.sets === 'number' ? ex.sets : 3;
                }
            }
        }
        if (totalSets > weeklyPlan.length * 25) {
            warnings.push('Beginner plan may have excessive volume');
        }
    }

    if (errors.length > 0) {
        return { valid: false, errors, warnings, sanitizedPlan: null };
    }

    // Build sanitized plan (deep copy, ensure JSON-safe)
    sanitizedPlan = JSON.parse(JSON.stringify({
        planMeta: plan.planMeta,
        userSummary: plan.userSummary,
        weeklyPlan: plan.weeklyPlan,
        progressionRules: plan.progressionRules,
        recoveryGuidance: plan.recoveryGuidance,
        warnings: toSafeArray(plan.warnings)
    }));

    return { valid: true, errors: [], warnings, sanitizedPlan };
}

function getMaxExercisesForDuration(durationMin) {
    if (durationMin <= 30) return 4;
    if (durationMin <= 45) return 6;
    if (durationMin <= 60) return 8;
    return 12;
}
