/**
 * ASCEND AI PROTOCOL - AI Engine Classify User
 * Deterministic classification by goal, experience, schedule, recovery, equipment, plan complexity.
 */

import { selectSplitType } from './rules.js';

/**
 * Classify user from normalized input.
 * @param {Object} input - Normalized input from normalizeInput
 * @returns {Object} Classification object
 */
export function classifyUser(input) {
    if (!input || typeof input !== 'object') {
        return getDefaultClassification();
    }

    const goal = input.goal || 'recomposition';
    const experienceLevel = input.experienceLevel || 'beginner';
    const equipmentAccess = input.equipmentAccess || 'home_basic';
    const trainingDaysPerWeek = input.trainingDaysPerWeek ?? 3;
    const sessionDurationMin = input.sessionDurationMin ?? 60;
    const activity = input.activity || 'moderate';
    const limitations = input.limitations || 'none';

    const scheduleProfile = getScheduleProfile(trainingDaysPerWeek, sessionDurationMin);
    const recoveryProfile = getRecoveryProfile(activity, limitations, experienceLevel);
    const splitType = selectSplitType(trainingDaysPerWeek, experienceLevel, goal);
    const planComplexity = getPlanComplexity(experienceLevel, trainingDaysPerWeek, goal);

    const notes = [];
    if (limitations !== 'none') {
        notes.push(`Considerations for ${limitations} limitations.`);
    }
    if (sessionDurationMin <= 45) {
        notes.push('Short sessions: focus on compound movements and efficiency.');
    }
    if (experienceLevel === 'beginner') {
        notes.push('Beginner-friendly volume and progression.');
    }

    const classificationLabel = [
        experienceLevel.charAt(0).toUpperCase() + experienceLevel.slice(1),
        goal.replace('_', ' '),
        `${trainingDaysPerWeek}x/week`
    ].join(' · ');

    return {
        goal,
        experienceLevel,
        scheduleProfile,
        recoveryProfile,
        equipmentAccess,
        planComplexity,
        splitType,
        classificationLabel,
        limitations,
        notes
    };
}

function getScheduleProfile(days, durationMin) {
    const totalMin = days * durationMin;
    if (totalMin <= 180 || (days <= 3 && durationMin <= 45)) return 'tight';
    if (totalMin >= 360 || days >= 5) return 'flexible';
    return 'standard';
}

function getRecoveryProfile(activity, limitations, experienceLevel) {
    if (limitations !== 'none') return 'low';
    if (activity === 'highly' || activity === 'moderate') return 'moderate';
    if (experienceLevel === 'beginner') return 'low';
    if (activity === 'sedentary') return 'high';
    return 'moderate';
}

function getPlanComplexity(experienceLevel, daysPerWeek, goal) {
    if (experienceLevel === 'beginner') return 'simple';
    if (experienceLevel === 'advanced' && daysPerWeek >= 5) return 'advanced';
    return 'moderate';
}

function getDefaultClassification() {
    return {
        goal: 'recomposition',
        experienceLevel: 'beginner',
        scheduleProfile: 'standard',
        recoveryProfile: 'moderate',
        equipmentAccess: 'home_basic',
        planComplexity: 'simple',
        splitType: 'full_body',
        classificationLabel: 'Beginner · Recomposition · 3x/week',
        limitations: 'none',
        notes: ['Default conservative plan.']
    };
}
