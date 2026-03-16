/**
 * ASCEND AI PROTOCOL - AI Engine Utils
 * Helper functions for guards, clamping, enum safety, safe arrays, and ID generation.
 */

/**
 * Check if value is a non-null object (not array, not primitive).
 * @param {*} v
 * @returns {boolean}
 */
export function isObject(v) {
    return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Check if value is a non-empty string.
 * @param {*} v
 * @returns {boolean}
 */
export function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Check if value is a safe number (finite, not NaN).
 * @param {*} v
 * @returns {boolean}
 */
export function isSafeNumber(v) {
    return typeof v === 'number' && Number.isFinite(v) && !Number.isNaN(v);
}

/**
 * Clamp a number to [min, max].
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
    if (!isSafeNumber(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

/**
 * Parse a value to a safe integer, with fallback.
 * @param {*} v
 * @param {number} fallback
 * @returns {number}
 */
export function toSafeInt(v, fallback = 0) {
    if (isSafeNumber(v)) return Math.floor(v);
    const n = parseInt(v, 10);
    return Number.isFinite(n) && !Number.isNaN(n) ? n : fallback;
}

/**
 * Parse a value to a safe float, with fallback.
 * @param {*} v
 * @param {number} fallback
 * @returns {number}
 */
export function toSafeFloat(v, fallback = 0) {
    if (isSafeNumber(v)) return v;
    const n = parseFloat(v);
    return Number.isFinite(n) && !Number.isNaN(n) ? n : fallback;
}

/**
 * Ensure value is one of the allowed enum values; otherwise return default.
 * @param {*} value
 * @param {string[]} allowed
 * @param {string} defaultValue
 * @returns {string}
 */
export function toEnum(value, allowed, defaultValue) {
    if (!allowed || !Array.isArray(allowed) || allowed.length === 0) return defaultValue;
    const str = String(value || '').trim().toLowerCase();
    if (!str) return defaultValue;
    const found = allowed.find((a) => String(a).toLowerCase() === str);
    return found != null ? found : defaultValue;
}

/**
 * Return a safe array (never null/undefined).
 * @param {*} arr
 * @returns {Array}
 */
export function toSafeArray(arr) {
    return Array.isArray(arr) ? arr : [];
}

/**
 * Generate a unique plan ID.
 * @returns {string}
 */
export function generatePlanId() {
    return 'PLN-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 8);
}
