/**
 * ASCEND AI PROTOCOL - Progress Tracking Engine
 * Phase 5: Store and retrieve weekly progress for adaptive engine.
 * Uses storageAdapter so local and cloud flows stay aligned.
 */

import { getProgressEntries, saveProgressEntries } from '../data/storageAdapter.js';

/**
 * Validate a progress entry. Returns { valid: boolean, errors: string[] }.
 * @param {Object} entry
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateProgressEntry(entry) {
    const errors = [];
    if (!entry || typeof entry !== 'object') {
        return { valid: false, errors: ['Entry must be an object'] };
    }
    const w = parseFloat(entry.bodyWeight);
    if (isNaN(w) || w < 30 || w > 300) {
        errors.push('Body weight must be 30–300 kg');
    }
    const fatigue = parseFloat(entry.fatigueLevel);
    if (!isNaN(fatigue) && (fatigue < 1 || fatigue > 10)) {
        errors.push('Fatigue level must be 1–10');
    }
    const adherence = parseFloat(entry.adherence);
    if (!isNaN(adherence) && (adherence < 0 || adherence > 100)) {
        errors.push('Adherence must be 0–100');
    }
    const sleep = parseFloat(entry.sleepScore);
    if (!isNaN(sleep) && (sleep < 1 || sleep > 10)) {
        errors.push('Sleep score must be 1–10');
    }
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Save a progress entry. Auto-adds weekNumber and date.
 * @param {Object} entry - { bodyWeight, strengthChange, fatigueLevel, adherence, sleepScore, injuries }
 * @param {string} userId
 * @returns {{ success: boolean, entry?: Object, errors?: string[] }}
 */
export function saveProgressEntry(entry, userId) {
    const validation = validateProgressEntry(entry);
    if (!validation.valid) {
        return { success: false, errors: validation.errors };
    }
    const entries = getProgressEntries(userId);
    const weekNumber = entries.length + 1;
    const normalized = {
        weekNumber,
        date: new Date().toISOString().slice(0, 10),
        bodyWeight: parseFloat(entry.bodyWeight),
        strengthChange: parseFloat(entry.strengthChange) || 0,
        fatigueLevel: Math.max(1, Math.min(10, parseFloat(entry.fatigueLevel) || 5)),
        adherence: Math.max(0, Math.min(100, parseFloat(entry.adherence) || 100)),
        sleepScore: Math.max(1, Math.min(10, parseFloat(entry.sleepScore) || 7)),
        injuries: Array.isArray(entry.injuries) ? entry.injuries : (entry.injuries ? [String(entry.injuries)] : []),
        improvementFlag: !!entry.improvementFlag,
        healedFlag: !!entry.healedFlag,
        notes: String(entry.notes || '').trim()
    };
    entries.unshift(normalized);
    saveProgressEntries(userId, entries);
    return { success: true, entry: normalized };
}

/**
 * Get full progress history (newest first).
 * @param {string} userId
 * @returns {Array}
 */
export function getProgressHistory(userId) {
    return getProgressEntries(userId);
}

/**
 * Get the latest progress entry.
 * @param {string} userId
 * @returns {Object|null}
 */
export function getLatestProgress(userId) {
    const entries = getProgressEntries(userId);
    return entries.length > 0 ? entries[0] : null;
}

/**
 * Clear all progress history for user.
 * @param {string} userId
 */
export function clearProgressHistory(userId) {
    saveProgressEntries(userId, []);
}
