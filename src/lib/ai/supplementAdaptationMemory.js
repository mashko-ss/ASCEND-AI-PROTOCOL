/**
 * ASCEND AI PROTOCOL - Supplement Adaptation Memory
 * Phase 15: Memory for individualized supplement recommendations based on
 * user profile, prior recommendations, tolerance preferences, minimalism,
 * and feedback. No medical claims, no diagnosis, no extreme stacks.
 */

/** Max recent recommendations to track */
const RECENT_RECOMMENDATIONS_CAP = 20;

/** Max feedback history entries */
const FEEDBACK_HISTORY_CAP = 30;

/** Stimulant supplement keys (caffeine, pre-workout-style) */
const STIMULANT_KEYS = ['caffeine'];

/** Pre-workout aliases (map to caffeine for rejection) */
const PRE_WORKOUT_ALIASES = ['pre-workout', 'preworkout', 'pre workout'];

/** Map display names to internal supplement keys */
const NAME_TO_KEY = {
    'protein powder': 'protein_powder',
    'creatine': 'creatine',
    'creatine monohydrate': 'creatine',
    'vitamin d': 'vitamin_d',
    'vitamin d3': 'vitamin_d',
    'omega-3': 'omega3',
    'omega-3 (epa/dha)': 'omega3',
    'omega-3 (algal oil)': 'omega3',
    'magnesium': 'magnesium',
    'electrolytes': 'electrolytes',
    'caffeine': 'caffeine',
    'vitamin b12': 'b12',
    'iron': 'iron',
    'zinc': 'zinc',
    'pre-workout': 'caffeine',
    'preworkout': 'caffeine'
};

/**
 * Normalize supplement name to internal key.
 * @param {string} name - Display name or key
 * @returns {string}
 */
function supplementKey(name) {
    if (!name || typeof name !== 'string') return '';
    const lower = name.toLowerCase().trim();
    if (NAME_TO_KEY[lower]) return NAME_TO_KEY[lower];
    const keyFromDef = Object.keys(NAME_TO_KEY).find(k => lower.includes(k));
    return keyFromDef ? NAME_TO_KEY[keyFromDef] : lower.replace(/\s+/g, '_');
}

/**
 * Create empty supplement memory structure.
 * @returns {Object}
 */
export function createSupplementMemory() {
    return {
        recentRecommendations: [],
        repetitionMap: {},
        acceptedSupplements: [],
        rejectedSupplements: [],
        cautionFlags: [],
        preferenceSignals: {
            essentialsOnly: false,
            avoidStimulants: false,
            lowPillBurden: false,
            budgetSensitive: false,
            plantBasedOnly: false
        },
        feedbackHistory: []
    };
}

/**
 * Update memory after a recommendation run or feedback.
 * @param {Object} memory - Existing memory (mutated)
 * @param {Object} [recommendationOutput] - { essentials, optional }
 * @param {Object|Array} [feedback] - Single feedback or array of feedback items
 */
export function updateSupplementMemory(memory, recommendationOutput, feedback) {
    if (!memory || typeof memory !== 'object') return;

    if (recommendationOutput) {
        const allNames = [
            ...(recommendationOutput.essentials || []).map(i => i.name),
            ...(recommendationOutput.optional || []).map(i => i.name)
        ].filter(Boolean);

        for (const name of allNames) {
            const key = supplementKey(name) || name;
            memory.recentRecommendations = memory.recentRecommendations.filter(k => k !== key);
            memory.recentRecommendations.unshift(key);
            memory.repetitionMap[key] = (memory.repetitionMap[key] || 0) + 1;
        }
        if (memory.recentRecommendations.length > RECENT_RECOMMENDATIONS_CAP) {
            memory.recentRecommendations = memory.recentRecommendations.slice(0, RECENT_RECOMMENDATIONS_CAP);
        }
    }

    const feedbacks = Array.isArray(feedback) ? feedback : (feedback ? [feedback] : []);
    for (const fb of feedbacks) {
        if (!fb?.type) continue;
        memory.feedbackHistory.unshift({ ...fb, ts: Date.now() });
        if (memory.feedbackHistory.length > FEEDBACK_HISTORY_CAP) {
            memory.feedbackHistory = memory.feedbackHistory.slice(0, FEEDBACK_HISTORY_CAP);
        }

        switch (fb.type) {
            case 'preference_update': {
                const pref = String(fb.preference || '').toLowerCase().replace(/\s+/g, '_');
                const val = fb.value === true || fb.value === 'true' || fb.value === 1;
                if (pref === 'essentials_only') memory.preferenceSignals.essentialsOnly = val;
                else if (pref === 'avoid_stimulants') memory.preferenceSignals.avoidStimulants = val;
                else if (pref === 'low_pill_burden') memory.preferenceSignals.lowPillBurden = val;
                else if (pref === 'budget_sensitive') memory.preferenceSignals.budgetSensitive = val;
                else if (pref === 'plant_based_only') memory.preferenceSignals.plantBasedOnly = val;
                break;
            }
            case 'supplement_reject': {
                const key = supplementKey(fb.supplement) || String(fb.supplement || '').toLowerCase();
                if (key && !memory.rejectedSupplements.includes(key)) {
                    memory.rejectedSupplements.push(key);
                }
                if (PRE_WORKOUT_ALIASES.some(a => String(fb.supplement || '').toLowerCase().includes(a))) {
                    if (!memory.rejectedSupplements.includes('caffeine')) memory.rejectedSupplements.push('caffeine');
                }
                break;
            }
            case 'supplement_accept': {
                const key = supplementKey(fb.supplement) || String(fb.supplement || '').toLowerCase();
                if (key && !memory.acceptedSupplements.includes(key)) {
                    memory.acceptedSupplements.push(key);
                }
                break;
            }
            case 'caution_flag': {
                const flag = fb.flag || fb.caution;
                if (flag && !memory.cautionFlags.includes(String(flag))) {
                    memory.cautionFlags.push(String(flag));
                }
                break;
            }
            default:
                break;
        }
    }
}

/**
 * Apply structured feedback to memory (convenience wrapper).
 * Supports: "I want essentials only", "Avoid stimulants", "Too many supplements",
 * "I do not want caffeine", "Keep creatine", "Remove pre-workout", "Budget version", "Plant-based only".
 * @param {Object} memory - Memory to update (mutated)
 * @param {Object} feedback - { type, preference?, value?, supplement?, flag? }
 */
export function applySupplementFeedback(memory, feedback) {
    updateSupplementMemory(memory, null, feedback);
}

/**
 * Parse natural feedback text into structured feedback (optional helper).
 * @param {string} text - User feedback text
 * @returns {Object|null} Structured feedback or null
 */
export function parseFeedbackText(text) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase().trim();

    if (lower.includes('essentials only') || lower.includes('essentials-only')) {
        return { type: 'preference_update', preference: 'essentials_only', value: true };
    }
    if (lower.includes('avoid stimulant') || lower.includes('no stimulant')) {
        return { type: 'preference_update', preference: 'avoid_stimulants', value: true };
    }
    if (lower.includes('too many supplement') || lower.includes('fewer supplement') || lower.includes('low pill')) {
        return { type: 'preference_update', preference: 'low_pill_burden', value: true };
    }
    if (lower.includes('no caffeine') || lower.includes('do not want caffeine') || lower.includes('avoid caffeine')) {
        return { type: 'supplement_reject', supplement: 'Caffeine' };
    }
    if (lower.includes('keep creatine') || lower.includes('want creatine')) {
        return { type: 'supplement_accept', supplement: 'Creatine' };
    }
    if (lower.includes('remove pre-workout') || lower.includes('no pre-workout') || lower.includes('remove preworkout')) {
        return { type: 'supplement_reject', supplement: 'Pre-workout' };
    }
    if (lower.includes('budget') || lower.includes('cheaper')) {
        return { type: 'preference_update', preference: 'budget_sensitive', value: true };
    }
    if (lower.includes('plant-based only') || lower.includes('plant based only') || lower.includes('vegan only')) {
        return { type: 'preference_update', preference: 'plant_based_only', value: true };
    }
    return null;
}

/**
 * Score a supplement candidate for ranking.
 * score = goalFit + dietCompatibility + recoveryFit + deficiencySupport + userAcceptance
 *         - repetitionPenalty - rejectionPenalty - stimulantPenalty - pillBurdenPenalty - budgetPenalty
 * @param {Object} candidate - { key, name, purpose, dose, categories, ... }
 * @param {Object} context - { goal, dietType, memory, constraints, inputs }
 * @returns {number}
 */
export function scoreSupplementCandidate(candidate, context) {
    const { goal, dietType, memory, constraints, inputs } = context;
    const mem = memory || createSupplementMemory();
    const key = candidate.key || supplementKey(candidate.name) || '';

    let goalFitScore = 5;
    let dietCompatibilityScore = 5;
    let recoveryFitScore = 0;
    let deficiencyRiskSupportScore = 0;
    let userAcceptanceScore = 0;
    let repetitionPenalty = 0;
    let rejectionPenalty = 0;
    let stimulantPenalty = 0;
    let pillBurdenPenalty = 0;
    let budgetPenalty = 0;

    const goalLower = (goal || 'recomposition').toLowerCase();
    const categories = candidate.categories || [];

    if (goalLower === 'fat_loss' && categories.includes('performance')) goalFitScore += 2;
    if (goalLower === 'muscle_gain' && (categories.includes('performance') || categories.includes('recovery'))) goalFitScore += 2;
    if (goalLower === 'recomposition' && (categories.includes('recovery') || categories.includes('health'))) goalFitScore += 1;
    if (categories.includes('vegan_gap') && (dietType === 'vegan' || dietType === 'vegetarian')) deficiencyRiskSupportScore += 5;
    if (categories.includes('recovery') || categories.includes('sleep')) recoveryFitScore += 2;

    if (mem.acceptedSupplements.includes(key)) userAcceptanceScore += 8;
    if (mem.rejectedSupplements.includes(key)) rejectionPenalty += 25;

    const repCount = mem.repetitionMap[key] || 0;
    const recentIdx = mem.recentRecommendations.indexOf(key);
    if (recentIdx >= 0) {
        repetitionPenalty = 4 + (RECENT_RECOMMENDATIONS_CAP - recentIdx) * 0.4;
    } else if (repCount > 0) {
        repetitionPenalty = Math.min(6, repCount * 1.2);
    }

    if (STIMULANT_KEYS.includes(key) && mem.preferenceSignals.avoidStimulants) {
        stimulantPenalty += 20;
    }

    if (mem.preferenceSignals.lowPillBurden && !categories.includes('vegan_gap') && !['protein_powder', 'creatine', 'vitamin_d'].includes(key)) {
        pillBurdenPenalty += 3;
    }

    if (mem.preferenceSignals.budgetSensitive) {
        const expensiveKeys = ['omega3', 'electrolytes', 'magnesium'];
        if (expensiveKeys.includes(key)) budgetPenalty += 2;
    }

    if (mem.preferenceSignals.essentialsOnly) {
        const essentialKeys = ['protein_powder', 'creatine', 'vitamin_d', 'b12', 'omega3'];
        const isEssential = essentialKeys.includes(key) || categories.includes('vegan_gap');
        if (!isEssential) pillBurdenPenalty += 6;
    }

    return (
        goalFitScore +
        dietCompatibilityScore +
        recoveryFitScore +
        deficiencyRiskSupportScore +
        userAcceptanceScore -
        repetitionPenalty -
        rejectionPenalty -
        stimulantPenalty -
        pillBurdenPenalty -
        budgetPenalty
    );
}

/**
 * Check if a supplement should be avoided given memory and constraints.
 * @param {Object} candidate - { key, name, ... }
 * @param {Object} memory - Supplement memory
 * @param {Object} constraints - { dietType, avoidStimulants, ... }
 * @returns {boolean}
 */
export function shouldAvoidSupplement(candidate, memory, constraints = {}) {
    const mem = memory || createSupplementMemory();
    const key = candidate.key || supplementKey(candidate.name) || '';

    if (mem.rejectedSupplements.includes(key)) return true;
    if (STIMULANT_KEYS.includes(key) && (mem.preferenceSignals.avoidStimulants || constraints.avoidStimulants)) return true;

    const dietType = constraints.dietType || 'omnivore';
    if (dietType === 'vegan' && key === 'omega3' && candidate.name && !String(candidate.name).toLowerCase().includes('algal')) return true;
    if (dietType === 'vegan' && candidate.name?.toLowerCase?.().includes('whey')) return true;

    return false;
}

/**
 * Get adapted supplement recommendations from base list using memory and constraints.
 * @param {Array} baseRecommendations - [{ key, name, purpose, dose, ... }]
 * @param {Object} memory - Supplement memory
 * @param {Object} constraints - { dietType, maxOptional?, avoidStimulants? }
 * @param {Object} inputs - User inputs (goal, dietType, etc.)
 * @returns {{ essentials: Array, optional: Array, adaptationNotes: string[] }}
 */
export function getAdaptedSupplementRecommendations(baseRecommendations, memory, constraints, inputs) {
    const mem = memory || createSupplementMemory();
    const adaptationNotes = [];
    const maxOptional = constraints?.maxOptional ?? 10;
    const goal = inputs?.goal || inputs?.primary_goal || 'recomposition';
    const dietType = constraints?.dietType || inputs?.dietType || 'omnivore';

    const essentials = [];
    const optional = [];

    const baseEssentials = (baseRecommendations.essentials || baseRecommendations).filter(Boolean);
    const baseOptional = (baseRecommendations.optional || []).filter(Boolean);

    for (const item of baseEssentials) {
        const key = item.key || supplementKey(item.name);
        const candidate = { ...item, key };
        if (shouldAvoidSupplement(candidate, mem, constraints)) {
            adaptationNotes.push(`Skipped ${item.name || key}: user preference or constraint.`);
            continue;
        }
        essentials.push(item);
    }

    const optionalCandidates = baseOptional.map(item => ({
        ...item,
        key: item.key || supplementKey(item.name)
    })).filter(c => !shouldAvoidSupplement(c, mem, constraints));

    const scored = optionalCandidates.map(c => ({
        item: c,
        score: scoreSupplementCandidate(c, { goal, dietType, memory: mem, constraints, inputs })
    }));
    scored.sort((a, b) => b.score - a.score);

    const selected = scored.slice(0, maxOptional).map(s => s.item);
    for (const s of selected) {
        optional.push(s);
    }

    if (mem.preferenceSignals.essentialsOnly && optional.length > 0) {
        adaptationNotes.push('Essentials-only mode: optional list reduced.');
    }
    if (mem.preferenceSignals.avoidStimulants) {
        adaptationNotes.push('Stimulant avoidance active: caffeine/pre-workout excluded.');
    }
    if (mem.preferenceSignals.lowPillBurden) {
        adaptationNotes.push('Lower pill burden preferred: fewer optional supplements.');
    }

    return {
        essentials,
        optional,
        adaptationNotes
    };
}
