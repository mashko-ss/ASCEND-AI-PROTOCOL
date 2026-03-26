/**
 * ASCEND AI PROTOCOL - Injury Recovery / Return-to-Base Engine
 * Phase 11: Detect injury state, adapt during injury, track recovery,
 * gradually reintroduce normal training, return to base protocol safely.
 *
 * Plan A: injury_detected -> injury_active -> improving -> reintroduction -> back_to_base
 */

import { normalizeInjuries } from './injuryAdjustmentEngine.js';
import { getProgressHistory } from './progressTracker.js';
import {
    getInjuryState as getStoredInjuryState,
    saveInjuryState as saveStoredInjuryState
} from '../data/storageAdapter.js';

/** Reintroduction volume factors by week (1-indexed) */
const REINTRO_VOLUME_WEEK1 = 0.65; // 60-70%
const REINTRO_VOLUME_WEEK2 = 0.85; // 80-90%

/**
 * Create default injury state.
 * @returns {Object}
 */
function createDefaultState() {
    const now = new Date().toISOString().slice(0, 10);
    return {
        injuryState: 'none',
        activeInjuries: [],
        startedAt: now,
        updatedAt: now,
        returnToBaseWeek: 0,
        notes: '',
        basePlanSnapshot: null
    };
}

/**
 * Get injury recovery state for user.
 * @param {string} userId
 * @returns {Object}
 */
export function getInjuryState(userId) {
    try {
        const parsed = getStoredInjuryState(userId);
        if (!parsed || typeof parsed !== 'object') return createDefaultState();
        return {
            ...createDefaultState(),
            ...parsed,
            injuryState: parsed.injuryState || 'none',
            activeInjuries: Array.isArray(parsed.activeInjuries) ? parsed.activeInjuries : [],
            returnToBaseWeek: Math.max(0, parseInt(parsed.returnToBaseWeek, 10) || 0)
        };
    } catch {
        return createDefaultState();
    }
}

/**
 * Save injury recovery state for user.
 * @param {string} userId
 * @param {Object} state
 */
export function saveInjuryState(userId, state) {
    try {
        const normalized = {
            ...state,
            updatedAt: new Date().toISOString().slice(0, 10)
        };
        saveStoredInjuryState(userId, normalized);
    } catch (e) {
        console.warn('[InjuryRecoveryEngine] Save failed:', e);
    }
}

/**
 * Check if injury is cleared based on current vs previous injuries and notes.
 * @param {string[]} currentInjuries - Normalized injury categories
 * @param {string[]} previousInjuries - Previous week's injuries
 * @param {string} notes - User notes (may contain "healed", "no injury", etc.)
 * @returns {boolean}
 */
export function isInjuryCleared(currentInjuries, previousInjuries, notes = '') {
    const noteLower = String(notes).toLowerCase();
    const healedPhrases = ['healed', 'no injury', 'no pain', 'cleared', 'better', 'resolved', 'gone', 'none'];
    const suggestsHealed = healedPhrases.some(p => noteLower.includes(p));

    if (currentInjuries.length === 0 && (previousInjuries?.length > 0 || suggestsHealed)) {
        return true;
    }
    if (currentInjuries.length === 0 && suggestsHealed) return true;
    return currentInjuries.length === 0 && (!previousInjuries || previousInjuries.length === 0);
}

/**
 * Evaluate injury recovery from progress history and current injuries.
 * Updates state machine: detected -> active -> improving -> reintroduction -> cleared.
 * @param {Array} progressHistory - From getProgressHistory (newest first)
 * @param {string[]} currentInjuries - Normalized from latest progress
 * @param {Object} options - { improvementFlag?: boolean, healedFlag?: boolean, notes?: string }
 * @returns {{ state: Object, transition: string|null }}
 */
export function evaluateInjuryRecovery(progressHistory, currentInjuries, options = {}) {
    const improvementFlag = !!options.improvementFlag;
    const healedFlag = !!options.healedFlag;
    const notes = String(options.notes || '').toLowerCase();

    const prevEntry = progressHistory?.[1]; // Second entry = previous week
    const previousInjuries = prevEntry?.injuries
        ? normalizeInjuries('none', prevEntry.injuries)
        : [];

    const hasCurrentInjuries = currentInjuries && currentInjuries.length > 0;
    const hadPreviousInjuries = previousInjuries && previousInjuries.length > 0;
    const cleared = isInjuryCleared(currentInjuries, previousInjuries, notes) || healedFlag;

    return {
        hasCurrentInjuries,
        hadPreviousInjuries,
        cleared,
        improvementFlag,
        healedFlag,
        suggestsImprovement: improvementFlag || (hadPreviousInjuries && currentInjuries.length < previousInjuries.length),
        suggestsHealed: healedFlag || (cleared && hadPreviousInjuries)
    };
}

/**
 * Build reintroduction adjustments: volume scaling for gradual return.
 * Week 1 back: 60-70%, Week 2: 80-90%, then full.
 * @param {Object} basePlan - Original protocol plan (reference)
 * @param {Object} currentAdjustedPlan - Current injury-adjusted plan
 * @param {Object} recoveryState - From getInjuryState
 * @returns {{ adjustedPlan: Object, volumeFactor: number, mode: string }}
 */
export function buildReintroductionAdjustments(basePlan, currentAdjustedPlan, recoveryState) {
    const week = recoveryState.returnToBaseWeek || 0;
    let volumeFactor = 1;
    let mode = 'base';

    if (week === 1) {
        volumeFactor = REINTRO_VOLUME_WEEK1;
        mode = 'reintroduction';
    } else if (week === 2) {
        volumeFactor = REINTRO_VOLUME_WEEK2;
        mode = 'reintroduction';
    } else if (week > 2) {
        volumeFactor = 1;
        mode = 'base';
    }

    // During reintroduction, use base plan (original) with volume scaling
    const planToAdjust = (basePlan?.weeklyPlan ? basePlan : currentAdjustedPlan) || basePlan || currentAdjustedPlan;
    if (!planToAdjust?.weeklyPlan || volumeFactor >= 1) {
        return { adjustedPlan: planToAdjust, volumeFactor: 1, mode };
    }

    const adjusted = JSON.parse(JSON.stringify(planToAdjust));
    for (const day of adjusted.weeklyPlan || []) {
        for (const block of day.mainBlocks || []) {
            for (const ex of block.exercises || []) {
                const sets = parseInt(ex.sets, 10) || 3;
                ex.sets = Math.max(1, Math.round(sets * volumeFactor));
            }
        }
    }
    return { adjustedPlan: adjusted, volumeFactor, mode };
}

/**
 * Restore plan toward base protocol structure gradually.
 * Merges adjusted plan back toward base: reintroduction phase applies volume scaling,
 * then progressively restores original exercises when cleared.
 * @param {Object} basePlan - Original protocol plan
 * @param {Object} adjustedPlan - Current injury-adjusted plan
 * @param {Object} recoveryState - From getInjuryState
 * @returns {{ plan: Object, mode: 'adjusted'|'reintroduction'|'base' }}
 */
export function restoreTowardBaseProtocol(basePlan, adjustedPlan, recoveryState) {
    const state = recoveryState.injuryState || 'none';
    const returnWeek = recoveryState.returnToBaseWeek || 0;

    if (state === 'none' || state === 'cleared') {
        if (returnWeek >= 2) {
            return { plan: basePlan || adjustedPlan, mode: 'base' };
        }
    }

    if (state === 'reintroduction') {
        const { adjustedPlan: reintroPlan, mode } = buildReintroductionAdjustments(
            basePlan,
            adjustedPlan,
            recoveryState
        );
        return { plan: reintroPlan, mode: mode || 'reintroduction' };
    }

    if (state === 'detected' || state === 'active' || state === 'improving') {
        return { plan: adjustedPlan || basePlan, mode: 'adjusted' };
    }

    return { plan: adjustedPlan || basePlan, mode: 'adjusted' };
}

/**
 * Process progress entry and update injury recovery state.
 * Call this when user saves progress. Handles state transitions.
 * @param {string} userId
 * @param {Object} progressEntry - { injuries, improvementFlag?, healedFlag?, notes? }
 * @param {string} assessmentLimitation - From protocol meta
 * @param {Object} basePlan - Original plan to preserve when injury first detected
 * @returns {{ state: Object, transition: string|null }}
 */
export function processProgressForRecovery(userId, progressEntry, assessmentLimitation = 'none', basePlan = null) {
    const currentInjuries = normalizeInjuries(assessmentLimitation, progressEntry?.injuries ?? []);
    const prevState = getInjuryState(userId);

    const history = getProgressHistory(userId);
    const evalResult = evaluateInjuryRecovery(history, currentInjuries, {
        improvementFlag: progressEntry?.improvementFlag,
        healedFlag: progressEntry?.healedFlag,
        notes: progressEntry?.notes || progressEntry?.injuries?.join?.(' ') || ''
    });

    let newState = { ...prevState };
    let transition = null;

    // 1. New injury appears: detected -> active
    if (evalResult.hasCurrentInjuries && prevState.injuryState === 'none') {
        newState = {
            ...newState,
            injuryState: 'detected',
            activeInjuries: [...currentInjuries],
            startedAt: new Date().toISOString().slice(0, 10),
            basePlanSnapshot: basePlan ? JSON.parse(JSON.stringify(basePlan)) : prevState.basePlanSnapshot,
            notes: progressEntry?.notes || ''
        };
        transition = 'detected';
    } else if (evalResult.hasCurrentInjuries && prevState.injuryState === 'detected') {
        newState = {
            ...newState,
            injuryState: 'active',
            activeInjuries: [...currentInjuries],
            notes: progressEntry?.notes || prevState.notes
        };
        transition = 'active';
    } else if (evalResult.hasCurrentInjuries && (prevState.injuryState === 'active' || prevState.injuryState === 'detected')) {
        newState = {
            ...newState,
            activeInjuries: [...currentInjuries],
            notes: progressEntry?.notes || prevState.notes
        };
    }

    // 2. User reports improvement
    if (evalResult.improvementFlag && prevState.injuryState === 'active') {
        newState = {
            ...newState,
            injuryState: 'improving',
            activeInjuries: [...currentInjuries],
            returnToBaseWeek: 0,
            notes: progressEntry?.notes || prevState.notes
        };
        transition = 'improving';
    }

    // 3. User reports healed / no injury - do NOT jump to cleared; start reintroduction
    if (evalResult.suggestsHealed || evalResult.healedFlag) {
        if (prevState.injuryState === 'active' || prevState.injuryState === 'improving' || prevState.injuryState === 'detected') {
            newState = {
                ...newState,
                injuryState: 'reintroduction',
                activeInjuries: [],
                returnToBaseWeek: 1,
                notes: progressEntry?.notes || prevState.notes
            };
            transition = 'reintroduction';
        }
    }

    // 4. Reintroduction phase: advance returnToBaseWeek when no injuries (each progress save = 1 step)
    if (prevState.injuryState === 'reintroduction' && !evalResult.hasCurrentInjuries) {
        const nextWeek = Math.min(3, (prevState.returnToBaseWeek || 0) + 1);
        newState = {
            ...newState,
            returnToBaseWeek: nextWeek,
            activeInjuries: []
        };
        if (nextWeek >= 2) {
            newState.injuryState = 'cleared';
            transition = 'cleared';
        }
    }

    // 5. Fully cleared - reset to none (back_to_base) on next progress save
    if (prevState.injuryState === 'cleared' && !evalResult.hasCurrentInjuries) {
        newState = createDefaultState();
        transition = 'back_to_base';
    }

    saveInjuryState(userId, newState);
    return { state: newState, transition };
}

/**
 * Advance recovery week when protocol advances. Call from regenerationEngine.
 * In reintroduction: increments returnToBaseWeek; when >= 2, transitions to cleared.
 * @param {string} userId
 * @returns {{ state: Object, transition: string|null }}
 */
export function advanceRecoveryWeek(userId) {
    const prevState = getInjuryState(userId);
    if (prevState.injuryState !== 'reintroduction') {
        return { state: prevState, transition: null };
    }

    const nextWeek = Math.min(3, (prevState.returnToBaseWeek || 0) + 1);
    const newState = {
        ...prevState,
        returnToBaseWeek: nextWeek,
        activeInjuries: []
    };
    let transition = null;

    if (nextWeek >= 2) {
        newState.injuryState = 'cleared';
        transition = 'cleared';
    }

    saveInjuryState(userId, newState);
    return { state: newState, transition };
}
