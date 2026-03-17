/**
 * ASCEND AI PROTOCOL - Supplement Recommendation Engine
 * Phase 14A: Individual supplement recommendations based on user profile.
 * No diagnosis, no medical claims, no drug-like language, no extreme stacks.
 * Output: essentials, optional, avoid_or_caution, reasoning.
 */

/** Supplement definitions: name, purpose, dose, dietCompatible, caffeineSensitive, etc. */
const SUPPLEMENT_DEFINITIONS = {
    protein_powder: {
        name: 'Protein Powder',
        purpose: 'Convenient way to hit daily protein targets.',
        dose: '1–2 scoops (20–40g protein) as needed to meet daily target.',
        dietCompatible: ['omnivore', 'vegetarian', 'vegan', 'pescatarian'],
        veganAlternative: 'Plant protein (pea, rice, hemp blend)',
        categories: ['protein']
    },
    creatine: {
        name: 'Creatine Monohydrate',
        purpose: 'Supports strength and lean mass; well-researched.',
        dose: '5 g daily, any time. Loading optional.',
        dietCompatible: ['omnivore', 'vegetarian', 'vegan', 'pescatarian'],
        categories: ['performance', 'recovery']
    },
    vitamin_d: {
        name: 'Vitamin D3',
        purpose: 'Bone health, immunity, mood; especially if low sun exposure.',
        dose: '2,000–4,000 IU daily with a fat-containing meal.',
        dietCompatible: ['omnivore', 'vegetarian', 'vegan', 'pescatarian'],
        categories: ['health', 'recovery']
    },
    omega3: {
        name: 'Omega-3 (EPA/DHA)',
        purpose: 'Recovery, joint health, cardiovascular support.',
        dose: '2–3 g EPA+DHA daily.',
        dietCompatible: ['omnivore', 'vegetarian', 'pescatarian'],
        veganAlternative: 'Algal oil (plant-based EPA/DHA)',
        categories: ['recovery', 'health']
    },
    magnesium: {
        name: 'Magnesium',
        purpose: 'Muscle function, sleep support, recovery.',
        dose: '200–400 mg elemental magnesium (glycinate or citrate) before bed if needed.',
        dietCompatible: ['omnivore', 'vegetarian', 'vegan', 'pescatarian'],
        categories: ['recovery', 'sleep']
    },
    electrolytes: {
        name: 'Electrolytes',
        purpose: 'Hydration and performance during long or sweaty sessions.',
        dose: 'As needed during training; follow product label.',
        dietCompatible: ['omnivore', 'vegetarian', 'vegan', 'pescatarian'],
        categories: ['performance', 'hydration']
    },
    caffeine: {
        name: 'Caffeine',
        purpose: 'Performance and focus; supports fat oxidation when cutting.',
        dose: '3–5 mg/kg 30–45 min pre-workout. Start low if sensitive.',
        dietCompatible: ['omnivore', 'vegetarian', 'vegan', 'pescatarian'],
        caffeineSensitive: false,
        categories: ['performance']
    },
    b12: {
        name: 'Vitamin B12',
        purpose: 'Energy metabolism; important for plant-based diets.',
        dose: '500–1000 mcg cyanocobalamin or methylcobalamin, 2–3x per week.',
        dietCompatible: ['vegan', 'vegetarian'],
        categories: ['health', 'vegan_gap']
    },
    iron: {
        name: 'Iron (if needed)',
        purpose: 'Support for plant-based diets; get levels checked before supplementing.',
        dose: 'Only if deficient; follow healthcare provider guidance.',
        dietCompatible: ['vegan', 'vegetarian'],
        caution: 'Do not supplement without testing. Excess iron can be harmful.',
        categories: ['health', 'vegan_gap']
    },
    zinc: {
        name: 'Zinc',
        purpose: 'Immune support, recovery; plant-based diets may have lower absorption.',
        dose: '15–30 mg elemental zinc (with food); avoid long-term high dose.',
        dietCompatible: ['omnivore', 'vegetarian', 'vegan', 'pescatarian'],
        categories: ['health', 'recovery']
    }
};

/**
 * Parse supplement-relevant inputs from user profile.
 * @param {Object} raw
 * @returns {Object}
 */
function parseSupplementInputs(raw) {
    if (!raw || typeof raw !== 'object') raw = {};
    const dietRaw = String(raw.diet || raw.dietType || 'standard').toLowerCase();
    const dietMap = { standard: 'omnivore', balanced: 'omnivore', vegan: 'vegan', vegetarian: 'vegetarian', pescatarian: 'pescatarian', gluten_free: 'omnivore', keto: 'omnivore' };
    const dietType = dietMap[dietRaw] || 'omnivore';

    return {
        goal: raw.goal || raw.primary_goal || 'recomposition',
        dietType,
        trainingDays: raw.trainingDaysPerWeek ?? raw.days ?? 3,
        recoveryQuality: raw.recoveryQuality ?? raw.recovery_quality ?? null,
        sleepQuality: raw.sleepQuality ?? raw.sleep_quality ?? null,
        fatigueLevel: raw.fatigueLevel ?? raw.fatigue ?? null,
        energyLevel: raw.energyLevel ?? raw.energy ?? null,
        experienceLevel: raw.experienceLevel ?? raw.experience ?? 'beginner',
        caffeineTolerance: raw.caffeineTolerance ?? raw.caffeine_tolerance ?? 'moderate',
        nutritionGaps: raw.nutritionGaps ?? raw.nutrition_gaps ?? []
    };
}

/**
 * Generate individualized supplement recommendations.
 * @param {Object} rawInput - User profile (goal, diet, training, recovery, sleep, etc.)
 * @returns {{ essentials: Array, optional: Array, avoid_or_caution: Array, reasoning: string[] }}
 */
export function generateSupplementRecommendations(rawInput) {
    const inputs = parseSupplementInputs(rawInput);
    const essentials = [];
    const optional = [];
    const avoid_or_caution = [];
    const reasoning = [];

    const goal = inputs.goal?.toLowerCase?.() || 'recomposition';
    const dietType = inputs.dietType || 'omnivore';
    const trainingDays = Math.max(2, Math.min(6, inputs.trainingDays || 3));
    const sleepQuality = inputs.sleepQuality ?? 7;
    const fatigueLevel = inputs.fatigueLevel ?? 5;
    const caffeineTolerance = (inputs.caffeineTolerance || 'moderate').toLowerCase();

    const addEssential = (key, overrides = {}) => {
        const def = SUPPLEMENT_DEFINITIONS[key];
        if (!def) return;
        let item = { name: def.name, purpose: def.purpose, dose: def.dose };
        if (dietType === 'vegan' && def.veganAlternative) {
            item.veganAlternative = def.veganAlternative;
        }
        essentials.push({ ...item, ...overrides });
    };
    const addOptional = (key, overrides = {}) => {
        const def = SUPPLEMENT_DEFINITIONS[key];
        if (!def) return;
        let item = { name: def.name, purpose: def.purpose, dose: def.dose };
        if (dietType === 'vegan' && def.veganAlternative) item.veganAlternative = def.veganAlternative;
        optional.push({ ...item, ...overrides });
    };
    const addCaution = (text) => {
        avoid_or_caution.push(text);
    };

    if (dietType === 'vegan' || dietType === 'vegetarian') {
        addEssential('b12');
        reasoning.push('Plant-based diets often need B12 supplementation.');
        if (dietType === 'vegan') {
            addEssential('omega3', { name: 'Omega-3 (Algal Oil)', purpose: 'Plant-based EPA/DHA source.', dose: '2–3 g EPA+DHA daily from algal oil.' });
            reasoning.push('Vegan omega-3 from algal oil supports recovery without fish.');
        } else {
            addOptional('omega3');
        }
    } else {
        addOptional('omega3');
    }

    addEssential('protein_powder');
    reasoning.push('Protein powder helps meet daily targets conveniently.');

    addEssential('creatine');
    reasoning.push('Creatine has strong evidence for strength and lean mass.');

    addEssential('vitamin_d');
    reasoning.push('Vitamin D supports bone health and immunity, especially with limited sun.');

    if (trainingDays >= 4 || fatigueLevel >= 6) {
        addOptional('electrolytes');
        reasoning.push('Higher training volume or fatigue may benefit from electrolytes.');
    }

    if (sleepQuality <= 5 || fatigueLevel >= 6) {
        addOptional('magnesium');
        reasoning.push('Magnesium may support sleep and recovery.');
    }

    if (goal === 'fat_loss' && (caffeineTolerance === 'high' || caffeineTolerance === 'moderate')) {
        addOptional('caffeine');
        reasoning.push('Caffeine can support focus and fat oxidation when cutting.');
    } else if (caffeineTolerance === 'low' || caffeineTolerance === 'sensitive') {
        addCaution('Caffeine: You indicated low tolerance. Skip or use minimal amounts.');
    }

    if (dietType === 'vegan' || dietType === 'vegetarian') {
        addOptional('zinc');
        reasoning.push('Plant-based diets may benefit from zinc attention.');
    }

    addCaution('Iron: Only supplement if deficient. Get levels checked first.');
    addCaution('These are general support options, not medical advice. Consult a healthcare provider for personalized guidance.');

    return {
        essentials,
        optional,
        avoid_or_caution,
        reasoning
    };
}

/**
 * Validate supplement output against diet and constraints.
 * Ensures no incompatible recommendations (e.g. fish oil for vegan).
 * @param {Object} output - From generateSupplementRecommendations
 * @param {Object} constraints - { dietType, exclusions }
 * @returns {{ valid: boolean, adjusted: Object }}
 */
export function validateSupplementOutput(output, constraints = {}) {
    const dietType = constraints.dietType || 'omnivore';
    const adjusted = {
        essentials: [],
        optional: [],
        avoid_or_caution: [...(output.avoid_or_caution || [])],
        reasoning: [...(output.reasoning || [])]
    };

    const processList = (list) => {
        return list.filter(item => {
            if (dietType === 'vegan' && item.name?.toLowerCase?.().includes('omega-3') && !item.veganAlternative && !item.name?.toLowerCase?.().includes('algal')) {
                return false;
            }
            if (dietType === 'vegan' && item.name?.toLowerCase?.().includes('whey')) {
                return false;
            }
            return true;
        });
    };

    adjusted.essentials = processList(output.essentials || []);
    adjusted.optional = processList(output.optional || []);

    const valid = adjusted.essentials.length > 0;
    return { valid, adjusted };
}
