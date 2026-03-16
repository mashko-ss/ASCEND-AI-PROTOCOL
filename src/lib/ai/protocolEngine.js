/**
 * ASCEND AI PROTOCOL - Protocol Engine
 * Phase 7: Multi-week coaching protocol lifecycle.
 * Phase 10: Uses periodization engine for deload week computation.
 */

import { createPeriodizationBlock } from './periodizationEngine.js';

const DB_KEY = 'ascend_protocol_v4_db';

/** Default duration by goal (weeks) - fallback if periodization unavailable */
const DURATION_BY_GOAL = {
    fat_loss: 8,
    muscle_gain: 12,
    recomp: 8,
    longevity: 8,
    endurance: 6
};

/**
 * Get db state.
 * @returns {Object}
 */
function getDb() {
    try {
        return JSON.parse(localStorage.getItem(DB_KEY) || '{}');
    } catch {
        return { users: {}, currentUser: null };
    }
}

/**
 * Save db state.
 * @param {Object} state
 */
function saveDb(state) {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('[ProtocolEngine] Save failed:', e);
    }
}

/**
 * Compute deload weeks for protocol duration.
 * Phase 10: Uses periodization engine.
 * @param {number} durationWeeks
 * @param {string} goal - Optional; used by createPeriodizationBlock
 * @returns {number[]}
 */
function computeDeloadWeeks(durationWeeks, goal = 'recomp') {
    try {
        const block = createPeriodizationBlock(goal);
        return block.deloadWeeks ?? [];
    } catch {
        const deloads = [];
        const interval = durationWeeks <= 8 ? 4 : 5;
        for (let w = interval; w < durationWeeks; w += interval) {
            deloads.push(w);
        }
        return deloads;
    }
}

/**
 * Create protocol state from plan data.
 * Merges protocol engine fields with existing display structure.
 * @param {Object} userProfile - { goal, primary_goal, ... }
 * @param {Object} trainingPlan - apiPlan (raw plan)
 * @param {Object} nutritionPlan - aiResult.nutrition_plan or equivalent
 * @param {Object} fullProtocol - Full protocol object (meta, aiResult, apiPlan, etc.) for display
 * @param {Object} options - { durationWeeks?, protocolId? }
 * @returns {Object} Protocol object with engine fields
 */
export function createProtocol(userProfile, trainingPlan, nutritionPlan, fullProtocol, options = {}) {
    const goal = userProfile?.goal || userProfile?.primary_goal || fullProtocol?.meta?.goal || 'recomp';
    const durationWeeks = options.durationWeeks ?? DURATION_BY_GOAL[goal] ?? 8;
    const deloadWeeks = computeDeloadWeeks(durationWeeks, goal);
    const protocolId = options.protocolId || 'PRT-' + Date.now().toString().slice(-8);

    const engineState = {
        protocolId,
        createdAt: new Date().toISOString().slice(0, 10),
        durationWeeks,
        currentWeek: 1,
        deloadWeeks,
        status: 'active',
        goal,
        planSnapshots: [],
        nutritionSnapshots: [],
        adaptationHistory: [],
        basePlan: trainingPlan ? JSON.parse(JSON.stringify(trainingPlan)) : null
    };

    return { ...fullProtocol, ...engineState };
}

/**
 * Get active protocol for user.
 * @param {string} userId - User email
 * @returns {Object|null}
 */
export function getActiveProtocol(userId) {
    const state = getDb();
    const user = state.users?.[userId];
    return user?.active_protocol ?? null;
}

/**
 * Save active protocol for user.
 * @param {string} userId
 * @param {Object} protocol
 */
export function saveActiveProtocol(userId, protocol) {
    const state = getDb();
    if (!state.users) state.users = {};
    if (!state.users[userId]) state.users[userId] = { email: userId, history: [], telemetry: [] };
    state.users[userId].active_protocol = protocol;
    saveDb(state);
}

/**
 * Advance protocol to next week. Increments currentWeek, optionally stores snapshot.
 * @param {string} userId
 * @param {Object} snapshot - { week, date, trainingPlan, nutritionPlan, adaptation, recommendations }
 * @returns {Object|null} Updated protocol or null
 */
export function advanceProtocolWeek(userId, snapshot = null) {
    let protocol = getActiveProtocol(userId);
    if (!protocol) return null;

    // Migrate legacy protocols (add engine fields if missing)
    if (protocol.currentWeek == null) protocol = { ...protocol, currentWeek: 1 };
    if (protocol.durationWeeks == null) {
        const goal = protocol.goal || protocol.meta?.goal || 'recomp';
        protocol = { ...protocol, durationWeeks: DURATION_BY_GOAL[goal] ?? 8 };
    }
    if (!protocol.deloadWeeks?.length) protocol = { ...protocol, deloadWeeks: computeDeloadWeeks(protocol.durationWeeks, protocol.goal || protocol.meta?.goal || 'recomp') };
    if (!protocol.basePlan && protocol.apiPlan) protocol = { ...protocol, basePlan: JSON.parse(JSON.stringify(protocol.apiPlan)) };

    const currentWeek = (protocol.currentWeek ?? 1) + 1;
    if (currentWeek > (protocol.durationWeeks ?? 8)) {
        completeProtocol(userId);
        return getActiveProtocol(userId);
    }

    const updated = { ...protocol, currentWeek };

    if (snapshot) {
        const snap = {
            week: snapshot.week ?? currentWeek - 1,
            date: snapshot.date ?? new Date().toISOString().slice(0, 10),
            trainingPlan: snapshot.trainingPlan ?? protocol.apiPlan,
            nutritionPlan: snapshot.nutritionPlan ?? protocol.aiResult?.nutrition_plan,
            adaptation: snapshot.adaptation ?? null,
            recommendations: snapshot.recommendations ?? [],
            isDeload: snapshot.isDeload ?? false,
            regenerationResult: snapshot.regenerationResult ?? null
        };
        updated.planSnapshots = [...(protocol.planSnapshots || []), snap];
        updated.nutritionSnapshots = [...(protocol.nutritionSnapshots || []), { week: snap.week, date: snap.date, plan: snap.nutritionPlan }];
        if (snap.adaptation) {
            updated.adaptationHistory = [...(protocol.adaptationHistory || []), { week: snap.week, adaptation: snap.adaptation }];
        }
        // Update active plan to regenerated snapshot for next week display
        if (snap.trainingPlan) {
            updated.apiPlan = snap.trainingPlan;
            const wp = (snap.trainingPlan?.weeklyPlan || []).map((day) => {
                const exercises = [];
                for (const block of day.mainBlocks || []) {
                    for (const ex of block.exercises || []) {
                        exercises.push({
                            name: ex.name,
                            sets: String(ex.sets || 3),
                            reps: ex.reps || '8-12',
                            rest: `${ex.restSec || 90}s`,
                            rpe: ex.rpe ?? '7',
                            tempo: ex.tempo || '3-1-X-1'
                        });
                    }
                }
                return {
                    day: day.dayName,
                    focus: day.focus,
                    warmup: (day.warmup || [])[0]?.name || '5 min light cardio; dynamic stretches for the muscles you\'ll train today.',
                    exercises
                };
            });
            if (updated.aiResult && wp.length) {
                updated.aiResult = { ...updated.aiResult, workout_plan: wp };
            }
        }
        if (snap.nutritionPlan && updated.aiResult) {
            updated.aiResult = { ...updated.aiResult, nutrition_plan: snap.nutritionPlan };
        }
    }

    saveActiveProtocol(userId, updated);
    return updated;
}

/**
 * Add a snapshot to protocol without advancing week.
 * @param {string} userId
 * @param {Object} snapshot
 */
export function addProtocolSnapshot(userId, snapshot) {
    const protocol = getActiveProtocol(userId);
    if (!protocol) return;

    const snap = {
        week: snapshot.week ?? protocol.currentWeek,
        date: snapshot.date ?? new Date().toISOString().slice(0, 10),
        trainingPlan: snapshot.trainingPlan ?? protocol.apiPlan,
        nutritionPlan: snapshot.nutritionPlan ?? protocol.aiResult?.nutrition_plan,
        adaptation: snapshot.adaptation ?? null,
        recommendations: snapshot.recommendations ?? []
    };

    const updated = {
        ...protocol,
        planSnapshots: [...(protocol.planSnapshots || []), snap],
        nutritionSnapshots: [...(protocol.nutritionSnapshots || []), { week: snap.week, date: snap.date, plan: snap.nutritionPlan }]
    };
    if (snap.adaptation) {
        updated.adaptationHistory = [...(protocol.adaptationHistory || []), { week: snap.week, adaptation: snap.adaptation }];
    }

    saveActiveProtocol(userId, updated);
}

/**
 * Mark protocol as completed. Moves to history.
 * @param {string} userId
 */
export function completeProtocol(userId) {
    const protocol = getActiveProtocol(userId);
    if (!protocol) return;

    const state = getDb();
    const user = state.users?.[userId];
    if (!user) return;

    const completed = { ...protocol, status: 'completed' };
    user.history = user.history || [];
    user.history.unshift(completed);
    user.active_protocol = null;
    saveDb(state);
}

/**
 * Get protocol history (completed protocols).
 * @param {string} userId
 * @returns {Array}
 */
export function getProtocolHistory(userId) {
    const state = getDb();
    const user = state.users?.[userId];
    return user?.history ?? [];
}

/**
 * Check if current week is a deload week.
 * @param {Object} protocol
 * @returns {boolean}
 */
export function isDeloadWeek(protocol) {
    if (!protocol?.deloadWeeks) return false;
    return protocol.deloadWeeks.includes(protocol.currentWeek ?? 1);
}

/**
 * Get next deload week number.
 * @param {Object} protocol
 * @returns {number|null}
 */
export function getNextDeloadWeek(protocol) {
    if (!protocol?.deloadWeeks?.length) return null;
    const current = protocol.currentWeek ?? 1;
    const next = protocol.deloadWeeks.find(w => w > current);
    return next ?? null;
}
