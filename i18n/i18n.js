import { en } from './en.js';
import { bg } from './bg.js';
import { accordionEnBg } from './accordionEnBg.js';

export const translations = { en, bg };

// BG-first UI: match app.js (`ascend_lang` = bg). `translations.en` kept for later EN UI.
let currentLanguage = 'bg';
try {
    localStorage.setItem('ascend_lang', 'bg');
} catch (e) {
    /* ignore */
}

export function getLanguage() {
    return currentLanguage;
}
window.safeI18nGetLanguage = getLanguage;

export function setLanguage(lang) {
    if (!translations[lang]) return;
    currentLanguage = lang;
    localStorage.setItem('ascend_lang', lang);
    applyTranslations();
    
    // Dispatch event so other scripts can react if needed
    window.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: lang } }));
}
window.safeI18nSetLanguage = setLanguage;


export function t(key) {
    if (!key) return key;
    const dict = translations[currentLanguage];
    if (dict && dict[key]) {
        return dict[key];
    }
    if (currentLanguage === 'bg' && accordionEnBg[key]) {
        return accordionEnBg[key];
    }
    return key;
}
window.safeI18nT = t;

export function applyTranslations() {
    document.querySelectorAll('[data-safe-i18n]').forEach(el => {
        const key = el.getAttribute('data-safe-i18n');
        el.innerText = t(key);
    });
}
window.safeI18nApply = applyTranslations;

// Initial application
document.addEventListener('DOMContentLoaded', applyTranslations);
