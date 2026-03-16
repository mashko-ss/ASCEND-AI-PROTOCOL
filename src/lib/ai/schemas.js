/**
 * ASCEND AI PROTOCOL - AI Engine Schemas
 * Plain JavaScript schema references for normalized input and output shapes.
 * Used for validation and documentation; no runtime schema validation library.
 */

/** @typedef {'fat_loss'|'muscle_gain'|'strength'|'endurance'|'recomposition'} Goal */
/** @typedef {'beginner'|'intermediate'|'advanced'} ExperienceLevel */
/** @typedef {'full_body'|'upper_lower'|'push_pull_legs'|'bodypart_split'|'hybrid'} SplitType */
/** @typedef {'gym'|'home_basic'|'bodyweight'|'mixed'} EquipmentAccess */
/** @typedef {'low'|'moderate'|'high'} Difficulty */
/** @typedef {'strength'|'hypertrophy'|'conditioning'|'recovery'|'mixed'} SessionType */
/** @typedef {'compound'|'isolation'|'cardio'|'mobility'|'core'|'circuit'} ExerciseType */
/** @typedef {'easy'|'moderate'|'hard'} Intensity */

/**
 * Normalized input shape (from assessment form).
 * @typedef {Object} NormalizedInput
 * @property {string} gender - male | female
 * @property {number} age - 13-120
 * @property {number} weight - kg, 30-300
 * @property {number} height - cm, 100-250
 * @property {string} activity - sedentary | lightly | moderate | highly
 * @property {Goal} goal
 * @property {string} targetFocus - chest | legs | core | overall
 * @property {ExperienceLevel} experienceLevel
 * @property {EquipmentAccess} equipmentAccess
 * @property {number} trainingDaysPerWeek - 2-6
 * @property {number} sessionDurationMin - 30, 45, 60, 90
 * @property {string} limitations - none | lower_back | knees | shoulders | wrist_elbow | hips | ankles
 * @property {string} diet - standard | vegan | vegetarian | gluten_free | keto
 * @property {string} allergies - none | comma-separated list
 */

/**
 * Classification object from classifyUser.
 * @typedef {Object} Classification
 * @property {Goal} goal
 * @property {ExperienceLevel} experienceLevel
 * @property {string} scheduleProfile - tight | standard | flexible
 * @property {string} recoveryProfile - low | moderate | high
 * @property {EquipmentAccess} equipmentAccess
 * @property {string} planComplexity - simple | moderate | advanced
 */

/**
 * Weekly plan day structure.
 * @typedef {Object} WeeklyPlanDay
 * @property {number} dayIndex
 * @property {string} dayName
 * @property {string} focus
 * @property {SessionType} sessionType
 * @property {number} durationMin
 * @property {Array<{name:string,durationMin:number}>} warmup
 * @property {Array<{blockName:string,exerciseType:ExerciseType,exercises:Array}>} mainBlocks
 * @property {Array<{name:string,durationMin:number}>} cooldown
 */

/**
 * Generated plan output shape.
 * @typedef {Object} GeneratedPlan
 * @property {Object} planMeta
 * @property {Object} userSummary
 * @property {WeeklyPlanDay[]} weeklyPlan
 * @property {Object} progressionRules
 * @property {Object} recoveryGuidance
 * @property {string[]} warnings
 */

export const GOALS = ['fat_loss', 'muscle_gain', 'strength', 'endurance', 'recomposition'];
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'];
export const SPLIT_TYPES = ['full_body', 'upper_lower', 'push_pull_legs', 'bodypart_split', 'hybrid'];
export const EQUIPMENT_ACCESS = ['gym', 'home_basic', 'bodyweight', 'mixed'];
export const SESSION_TYPES = ['strength', 'hypertrophy', 'conditioning', 'recovery', 'mixed'];
export const EXERCISE_TYPES = ['compound', 'isolation', 'cardio', 'mobility', 'core', 'circuit'];
export const INTENSITIES = ['easy', 'moderate', 'hard'];
