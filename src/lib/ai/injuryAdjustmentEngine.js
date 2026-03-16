/**
 * ASCEND AI PROTOCOL - Injury Adjustment Engine
 * Phase 9: Modify training plans safely when user has injuries, pain flags,
 * movement restrictions, or recovery limitations.
 * Vanilla JS, modular, preserves training day focus.
 */

/** Supported injury/limitation categories */
const INJURY_CATEGORIES = [
    'shoulder', 'knee', 'lower_back', 'wrist', 'elbow', 'neck', 'ankle',
    'general_fatigue', 'movement_restriction', 'hips'
];

/** Map assessment limitations (single value) to engine categories */
const ASSESSMENT_TO_CATEGORY = {
    none: [],
    lower_back: ['lower_back'],
    knees: ['knee'],
    shoulders: ['shoulder'],
    wrist_elbow: ['wrist', 'elbow'],
    hips: ['hips'],
    ankles: ['ankle']
};

/**
 * Injury rules: avoid these exercises when category is flagged; replace with alternatives.
 */
const INJURY_RULES = {
    shoulder: {
        avoid: [
            'overhead press', 'ohp', 'barbell overhead', 'standing press', 'military press',
            'dips', 'dip', 'behind neck press', 'arnold press', 'upright row'
        ],
        replaceWith: [
            { name: 'Landmine Press or Incline DB Press', sets: 3, reps: '8-12', restSec: 75, intensity: 'moderate', notes: 'Shoulder-friendly pressing' },
            { name: 'Cable Chest Press or Machine Press', sets: 3, reps: '10-12', restSec: 75, intensity: 'moderate', notes: 'Supported option' },
            { name: 'Lateral Raise (light)', sets: 2, reps: '12-15', restSec: 45, intensity: 'easy', notes: 'Isolation, controlled' }
        ]
    },
    knee: {
        avoid: [
            'jump rope', 'high knees', 'burpees', 'box jump', 'squat', 'lunge', 'step-up',
            'leg press', 'hack squat', 'front squat', 'deep squat'
        ],
        replaceWith: [
            { name: 'Romanian Deadlift or Hip Thrust', sets: 3, reps: '10-12', restSec: 90, intensity: 'moderate', notes: 'Hip-dominant, knee-sparing' },
            { name: 'Leg Curl (seated or lying)', sets: 3, reps: '10-12', restSec: 60, intensity: 'moderate', notes: 'Controlled, no knee stress' },
            { name: 'Cable Pull-through or Glute Bridge', sets: 3, reps: '12-15', restSec: 60, intensity: 'moderate', notes: 'Hip-dominant' }
        ]
    },
    lower_back: {
        avoid: [
            'deadlift', 'romanian deadlift', 'rdl', 'rack pull', 'good morning',
            'back extension', 'hyperextension', 'barbell row', 'pendlay row'
        ],
        replaceWith: [
            { name: 'Chest-Supported Row or Machine Row', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: 'Spine supported' },
            { name: 'Lat Pulldown or Cable Row', sets: 3, reps: '8-12', restSec: 90, intensity: 'moderate', notes: 'Seated, controlled' },
            { name: 'Leg Curl or Glute Bridge', sets: 3, reps: '10-12', restSec: 60, intensity: 'moderate', notes: 'No spinal load' }
        ]
    },
    wrist: {
        avoid: [
            'skull crusher', 'lying tricep extension', 'barbell curl', 'wrist curl',
            'close grip bench', 'dips'
        ],
        replaceWith: [
            { name: 'Cable Tricep Pushdown (straight bar or rope)', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: 'Neutral wrist' },
            { name: 'Hammer Curl or Cable Curl', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: 'Neutral grip' }
        ]
    },
    elbow: {
        avoid: [
            'skull crusher', 'lying tricep extension', 'close grip bench', 'dips',
            'barbell curl', 'preacher curl'
        ],
        replaceWith: [
            { name: 'Cable Tricep Pushdown', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: 'Reduced elbow stress' },
            { name: 'Hammer Curl or Incline DB Curl', sets: 2, reps: '10-12', restSec: 45, intensity: 'easy', notes: 'Elbow-friendly' }
        ]
    },
    neck: {
        avoid: ['neck bridge', 'wrestler bridge', 'head harness'],
        replaceWith: [
            { name: 'Face Pull or Band Pull-apart', sets: 2, reps: '12-15', restSec: 45, intensity: 'easy', notes: 'Upper back focus' }
        ]
    },
    ankle: {
        avoid: ['jump rope', 'high knees', 'burpees', 'box jump', 'sprint', 'lunge', 'calf raise'],
        replaceWith: [
            { name: 'Seated Calf Raise or Leg Press Calf', sets: 2, reps: '15-20', restSec: 45, intensity: 'easy', notes: 'Controlled' },
            { name: 'Bike or Rower', sets: 1, reps: '10-15 min', restSec: 0, intensity: 'moderate', notes: 'Low impact cardio' }
        ]
    },
    general_fatigue: {
        avoid: [],
        replaceWith: []
    },
    movement_restriction: {
        avoid: [],
        replaceWith: [
            { name: 'Machine or Cable variation', sets: 3, reps: '10-12', restSec: 75, intensity: 'moderate', notes: 'Supported, controlled' }
        ]
    },
    hips: {
        avoid: ['deep squat', 'lunge', 'hip thrust', 'good morning', 'rdl'],
        replaceWith: [
            { name: 'Leg Press (reduced ROM)', sets: 3, reps: '10-12', restSec: 90, intensity: 'moderate', notes: 'Controlled range' },
            { name: 'Seated Leg Curl', sets: 3, reps: '10-12', restSec: 60, intensity: 'moderate', notes: 'Isolation' }
        ]
    }
};

/**
 * Normalize injuries from assessment limitations and progress data.
 * @param {string} assessmentLimitation - From normalizeInput (e.g. 'shoulders', 'lower_back', 'none')
 * @param {string[]} progressInjuries - From progress entry (free text or codes)
 * @returns {string[]} Normalized category codes
 */
export function normalizeInjuries(assessmentLimitation, progressInjuries = []) {
    const categories = new Set();

    if (assessmentLimitation && assessmentLimitation !== 'none') {
        const mapped = ASSESSMENT_TO_CATEGORY[assessmentLimitation] || [assessmentLimitation];
        mapped.forEach(c => categories.add(c));
    }

    const textToCategory = {
        shoulder: 'shoulder', shoulders: 'shoulder',
        knee: 'knee', knees: 'knee',
        back: 'lower_back', lower_back: 'lower_back', spine: 'lower_back',
        wrist: 'wrist', elbow: 'elbow', wrist_elbow: 'wrist',
        neck: 'neck', ankle: 'ankle', ankles: 'ankle',
        hip: 'hips', hips: 'hips',
        fatigue: 'general_fatigue', tired: 'general_fatigue',
        restriction: 'movement_restriction', mobility: 'movement_restriction'
    };

    for (const item of progressInjuries) {
        const s = String(item || '').toLowerCase().trim();
        if (!s) continue;
        const mapped = textToCategory[s] || (s.includes('shoulder') ? 'shoulder' : s.includes('knee') ? 'knee' : s.includes('back') ? 'lower_back' : s.includes('wrist') ? 'wrist' : s.includes('elbow') ? 'elbow' : null);
        if (mapped) categories.add(mapped);
    }

    return Array.from(categories).filter(c => INJURY_CATEGORIES.includes(c));
}

/**
 * Check if an exercise name matches any avoid pattern for given injuries.
 * @param {string} exerciseName
 * @param {string[]} injuries - Normalized category codes
 * @returns {{ avoid: boolean, category?: string }}
 */
export function isExerciseRisky(exerciseName, injuries) {
    if (!injuries?.length || !exerciseName) return { avoid: false };
    const name = String(exerciseName).toLowerCase();

    for (const cat of injuries) {
        const rules = INJURY_RULES[cat];
        if (!rules?.avoid?.length) continue;
        for (const pattern of rules.avoid) {
            if (name.includes(pattern.toLowerCase())) {
                return { avoid: true, category: cat };
            }
        }
    }
    return { avoid: false };
}

/**
 * Get a safe alternative for an exercise given injuries.
 * Ensures replacement is not risky for other injury categories.
 * @param {string} exerciseName
 * @param {string[]} injuries
 * @returns {Object|null} Replacement exercise or null
 */
export function getSafeAlternative(exerciseName, injuries) {
    const { avoid, category } = isExerciseRisky(exerciseName, injuries);
    if (!avoid || !category) return null;

    const rules = INJURY_RULES[category];
    if (!rules?.replaceWith?.length) return null;

    const focus = inferExerciseFocus(exerciseName);
    const candidates = rules.replaceWith.filter(r => matchesFocus(r.name, focus));
    const pool = candidates.length ? candidates : rules.replaceWith;

    for (const candidate of pool) {
        const risky = isExerciseRisky(candidate.name, injuries);
        if (!risky.avoid) return { ...candidate };
    }
    return pool[0] ? { ...pool[0] } : null;
}

function inferExerciseFocus(exerciseName) {
    const n = String(exerciseName).toLowerCase();
    if (n.includes('push') || n.includes('chest') || n.includes('press') || n.includes('dip')) return 'push';
    if (n.includes('pull') || n.includes('row') || n.includes('back') || n.includes('lat')) return 'pull';
    if (n.includes('leg') || n.includes('squat') || n.includes('rdl') || n.includes('lunge')) return 'legs';
    if (n.includes('curl') || n.includes('bicep')) return 'arm';
    if (n.includes('tricep') || n.includes('extension') || n.includes('pushdown')) return 'arm';
    return 'general';
}

function matchesFocus(altName, focus) {
    const n = String(altName).toLowerCase();
    if (focus === 'push' && (n.includes('press') || n.includes('chest'))) return true;
    if (focus === 'pull' && (n.includes('row') || n.includes('pulldown') || n.includes('pull'))) return true;
    if (focus === 'legs' && (n.includes('leg') || n.includes('hip') || n.includes('rdl') || n.includes('glute'))) return true;
    if (focus === 'arm' && (n.includes('curl') || n.includes('tricep') || n.includes('pushdown'))) return true;
    return focus === 'general';
}

/**
 * Adjust a single exercise for injuries.
 * @param {Object} exercise - { name, sets, reps, restSec, intensity, notes }
 * @param {string[]} injuries
 * @returns {{ adjusted: Object, replaced: boolean, reason?: string }}
 */
export function adjustExerciseForInjury(exercise, injuries) {
    if (!exercise || !injuries?.length) return { adjusted: { ...exercise }, replaced: false };

    const alt = getSafeAlternative(exercise.name, injuries);
    if (!alt) return { adjusted: { ...exercise }, replaced: false };

    return {
        adjusted: alt,
        replaced: true,
        reason: `Replaced for ${injuries.join('/')} considerations`
    };
}

/**
 * Get human-readable warnings for the given injuries.
 * @param {string[]} injuries - Normalized category codes
 * @returns {string[]}
 */
export function getInjuryWarnings(injuries) {
    if (!injuries?.length) return [];

    const messages = {
        shoulder: 'Shoulder: overhead pressing and dips modified. Use supported pressing options.',
        knee: 'Knee: high-impact and deep knee flexion modified. Hip-dominant alternatives used.',
        lower_back: 'Lower back: heavy hinge patterns modified. Chest-supported and machine options used.',
        wrist: 'Wrist: high-stress curls and extensions modified. Neutral-grip alternatives used.',
        elbow: 'Elbow: skull crushers and heavy curls modified. Cable and hammer variations used.',
        neck: 'Neck: direct neck work avoided. Upper back focus maintained.',
        ankle: 'Ankle: jumping and sprinting modified. Low-impact options used.',
        hips: 'Hips: deep hip flexion modified. Controlled range variations used.',
        general_fatigue: 'General fatigue: volume may be reduced.',
        movement_restriction: 'Movement restriction: machine and supported variations preferred.'
    };

    return injuries
        .filter(c => messages[c])
        .map(c => messages[c]);
}

/**
 * Apply injury adjustments to a full training plan.
 * @param {Object} trainingPlan - Plan with weeklyPlan, mainBlocks, exercises
 * @param {string[]} injuries - Normalized injury categories
 * @param {Object} options - { reduceVolumeOnFatigue?: boolean }
 * @returns {{ adjustedPlan: Object, replacements: Array, warnings: string[] }}
 */
export function adjustPlanForInjuries(trainingPlan, injuries, options = {}) {
    const result = {
        adjustedPlan: trainingPlan ? JSON.parse(JSON.stringify(trainingPlan)) : null,
        replacements: [],
        warnings: []
    };

    if (!result.adjustedPlan?.weeklyPlan || !injuries?.length) {
        result.warnings = getInjuryWarnings(injuries);
        return result;
    }

    const hasFatigue = injuries.includes('general_fatigue');
    const volumeReduce = hasFatigue && options.reduceVolumeOnFatigue !== false;

    for (const day of result.adjustedPlan.weeklyPlan) {
        const blocks = day.mainBlocks || [];
        for (const block of blocks) {
            const exercises = block.exercises || [];
            const newExercises = [];
            for (const ex of exercises) {
                const { adjusted, replaced, reason } = adjustExerciseForInjury(ex, injuries);
                if (replaced) {
                    result.replacements.push({
                        original: ex.name,
                        replacement: adjusted.name,
                        reason: reason || 'Injury modification'
                    });
                    newExercises.push(adjusted);
                } else {
                    let finalEx = { ...adjusted };
                    if (volumeReduce && (finalEx.sets > 2)) {
                        finalEx.sets = Math.max(2, Math.floor(finalEx.sets * 0.8));
                    }
                    newExercises.push(finalEx);
                }
            }
            block.exercises = newExercises;
        }
    }

    result.warnings = getInjuryWarnings(injuries);
    return result;
}
