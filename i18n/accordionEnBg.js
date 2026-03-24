import { engineEnBg } from './accordionEngineBg.js';
import { mealPoolEnBg } from './accordionMealPoolBg.js';

/** Merged EN→BG map for safeI18n when language is `bg` (meal pool overwrites duplicate keys with same labels). */
export const accordionEnBg = { ...engineEnBg, ...mealPoolEnBg };
