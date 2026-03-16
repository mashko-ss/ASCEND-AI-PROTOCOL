/**
 * ASCEND AI PROTOCOL - AI Engine Rules
 * Core training rules: goals, levels, days, duration, split selection, safety limits, volume, equipment.
 */

import { GOALS, EXPERIENCE_LEVELS, SPLIT_TYPES, EQUIPMENT_ACCESS } from './schemas.js';

/** Supported goals */
export const SUPPORTED_GOALS = [...GOALS];

/** Supported experience levels */
export const SUPPORTED_LEVELS = [...EXPERIENCE_LEVELS];

/** Days per week limits: [min, max] */
export const DAYS_PER_WEEK_LIMITS = [2, 6];

/** Session duration limits in minutes */
export const SESSION_DURATION_OPTIONS = [30, 45, 60, 90];

/** Beginner max sets per muscle group per week (conservative) */
export const BEGINNER_MAX_SETS_PER_MG = 10;

/** Intermediate max sets per muscle group per week */
export const INTERMEDIATE_MAX_SETS_PER_MG = 16;

/** Advanced max sets per muscle group per week */
export const ADVANCED_MAX_SETS_PER_MG = 22;

/** Max exercises per 30-min session */
export const MAX_EXERCISES_30_MIN = 4;

/** Max exercises per 45-min session */
export const MAX_EXERCISES_45_MIN = 6;

/** Max exercises per 60-min session */
export const MAX_EXERCISES_60_MIN = 8;

/** Max exercises per 90-min session */
export const MAX_EXERCISES_90_MIN = 12;

/**
 * Get max exercises for session duration.
 * @param {number} durationMin
 * @returns {number}
 */
export function getMaxExercisesForDuration(durationMin) {
    if (durationMin <= 30) return MAX_EXERCISES_30_MIN;
    if (durationMin <= 45) return MAX_EXERCISES_45_MIN;
    if (durationMin <= 60) return MAX_EXERCISES_60_MIN;
    return MAX_EXERCISES_90_MIN;
}

/**
 * Split selection logic: which split type for given days and experience.
 * @param {number} daysPerWeek
 * @param {string} experienceLevel
 * @param {string} goal
 * @returns {string} splitType
 */
export function selectSplitType(daysPerWeek, experienceLevel, goal) {
    if (daysPerWeek <= 2) return 'full_body';
    if (daysPerWeek === 3) {
        if (experienceLevel === 'beginner') return 'full_body';
        return 'upper_lower';
    }
    if (daysPerWeek === 4) {
        if (experienceLevel === 'beginner') return 'upper_lower';
        if (goal === 'strength' || goal === 'endurance') return 'upper_lower';
        return 'push_pull_legs';
    }
    if (daysPerWeek >= 5) {
        if (experienceLevel === 'beginner') return 'upper_lower';
        if (experienceLevel === 'advanced') return 'bodypart_split';
        return 'push_pull_legs';
    }
    return 'full_body';
}

/**
 * Equipment compatibility: which exercise types are allowed.
 * @param {string} equipmentAccess
 * @returns {string[]} allowed exercise types
 */
export function getEquipmentCompatibleTypes(equipmentAccess) {
    switch (equipmentAccess) {
        case 'gym':
            return ['compound', 'isolation', 'cardio', 'mobility', 'core', 'circuit'];
        case 'home_basic':
            return ['compound', 'isolation', 'cardio', 'mobility', 'core', 'circuit'];
        case 'bodyweight':
            return ['compound', 'cardio', 'mobility', 'core', 'circuit'];
        case 'mixed':
            return ['compound', 'isolation', 'cardio', 'mobility', 'core', 'circuit'];
        default:
            return ['compound', 'mobility', 'core'];
    }
}

/**
 * Map equipment form value to schema value.
 * @param {string} raw
 * @returns {string}
 */
export function mapEquipment(raw) {
    const m = { gym: 'gym', home: 'home_basic' };
    return m[String(raw || '').toLowerCase()] || 'home_basic';
}

/**
 * Map goal form value to schema value.
 * primary_goal: fat_loss, muscle_gain, recomp, longevity
 * @param {string} raw
 * @returns {string}
 */
export function mapGoal(raw) {
    const m = {
        fat_loss: 'fat_loss',
        muscle_gain: 'muscle_gain',
        recomp: 'recomposition',
        longevity: 'endurance',
        strength: 'strength',
        endurance: 'endurance',
        recomposition: 'recomposition'
    };
    return m[String(raw || '').toLowerCase()] || 'recomposition';
}
