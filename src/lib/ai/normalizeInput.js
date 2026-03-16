/**
 * ASCEND AI PROTOCOL - AI Engine Normalize Input
 * Accept raw assessment/form data, sanitize, normalize enums, clamp values, apply safe defaults.
 */

import { clamp, toSafeInt, toSafeFloat, toEnum, toSafeArray } from './utils.js';
import { mapGoal, mapEquipment } from './rules.js';
import { GOALS, EXPERIENCE_LEVELS, EQUIPMENT_ACCESS } from './schemas.js';

const GENDERS = ['male', 'female'];
const ACTIVITIES = ['sedentary', 'lightly', 'moderate', 'highly'];
const TARGET_FOCUS = ['chest', 'legs', 'core', 'overall'];
const LIMITATIONS = ['none', 'lower_back', 'knees', 'shoulders', 'wrist_elbow', 'hips', 'ankles'];
const DIETS = ['standard', 'vegan', 'vegetarian', 'gluten_free', 'keto'];

/**
 * Sanitize string: trim, limit length, remove control chars.
 * @param {*} v
 * @param {number} maxLen
 * @returns {string}
 */
function sanitizeString(v, maxLen = 500) {
    if (v == null) return '';
    const s = String(v).replace(/[\x00-\x1F\x7F]/g, '').trim();
    return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Normalize raw assessment form data into a stable, safe object.
 * @param {Object} raw - Raw form data (e.g. wizardModule.data)
 * @returns {Object} Normalized input
 */
export function normalizeInput(raw) {
    if (!raw || typeof raw !== 'object') {
        raw = {};
    }

    const age = clamp(toSafeInt(raw.age, 30), 13, 120);
    const weight = clamp(toSafeFloat(raw.weight, 80), 30, 300);
    const height = clamp(toSafeFloat(raw.height, 175), 100, 250);

    const primaryGoal = sanitizeString(raw.primary_goal || raw.goal);
    const goal = mapGoal(primaryGoal || 'recomp');

    const equipmentRaw = sanitizeString(raw.equipment || 'home');
    const equipmentAccess = mapEquipment(equipmentRaw);

    const experienceRaw = sanitizeString(raw.experience || 'beginner');
    const experienceLevel = toEnum(experienceRaw, EXPERIENCE_LEVELS, 'beginner');

    const daysRaw = raw.days != null ? String(raw.days) : '3';
    const daysNum = toSafeInt(daysRaw, 3);
    const trainingDaysPerWeek = clamp(daysNum, 2, 6);

    const durationRaw = raw.duration != null ? String(raw.duration) : '60';
    const durationNum = toSafeInt(durationRaw, 60);
    const validDurations = [30, 45, 60, 90];
    const sessionDurationMin = validDurations.includes(durationNum)
        ? durationNum
        : (durationNum <= 45 ? 45 : 60);

    return {
        gender: toEnum(sanitizeString(raw.gender), GENDERS, 'male'),
        age,
        weight,
        height,
        activity: toEnum(sanitizeString(raw.activity), ACTIVITIES, 'moderate'),
        goal,
        targetFocus: toEnum(sanitizeString(raw.target_focus), TARGET_FOCUS, 'overall'),
        experienceLevel,
        equipmentAccess,
        trainingDaysPerWeek,
        sessionDurationMin,
        limitations: toEnum(sanitizeString(raw.limitations), LIMITATIONS, 'none'),
        diet: toEnum(sanitizeString(raw.diet), DIETS, 'standard'),
        allergies: sanitizeString(raw.allergies || 'none', 200)
    };
}
