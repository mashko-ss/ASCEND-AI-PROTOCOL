/**
 * English → Bulgarian for dashboard accordion content from API / generators (not meal-pool rows).
 * Keys must match source strings exactly (including en-dashes – and straight quotes).
 */
export const engineEnBg = {
  // —— generateNutritionPlan.js ——
  'Prioritize protein at every meal (aim for 25–40g per meal).':
    'Поставяйте протеина като основен приоритет във всяко хранене (целете се към 25–40 g на хранене).',
  'Prioritize protein at every meal (aim for 25-40g per meal).':
    'Поставяйте протеина като основен приоритет във всяко хранене (целете се към 25–40 g на хранене).',
  'Eat whole foods 80% of the time; allow flexibility for the rest.':
    'Залагайте основно на пълноценни храни (около 80% от избора); за останалото допускайте гъвкавост.',
  'Time carbs around training for energy and recovery.':
    'Разпределяйте въглехидратите около тренировката за енергия и възстановяване.',
  'Include fiber-rich vegetables with lunch and dinner.':
    'Включвайте зеленчуци с фибри на обяд и вечеря.',
  'Moderate deficit; avoid aggressive cuts to preserve muscle.':
    'Поддържайте умерен калориен дефицит; избягвайте рязко редене, за да пазите мускулна маса.',
  'Calories are low. Consider consulting a professional if you feel fatigued.':
    'Калориите са ниски. При постоянна умора обмислете консултация със специалист.',
  'Surplus supports muscle growth; monitor body fat to avoid excessive gain.':
    'Излишъкът подпомага растежа; следете телесните мазнини, за да няма прекалено покачване.',
  'Maintenance calories with adequate protein; progress may be slower but sustainable.':
    'Поддържащи калории с достатъчно протеин; напредъкът може да е по-бавен, но устойчив.',
  'Ensure B12 and iron from fortified foods or supplements.':
    'Осигурете B12 и желязо от обогатени храни или добавки.',
  'Keep carbs under 50g; focus on fats and protein.':
    'Държете въглехидратите под 50 g; акцент върху мазнини и протеин.',
  'Higher training volume: prioritize recovery nutrition and sleep.':
    'При по-голям тренировъчен обем: приоритет на хранене за възстановяване и сън.',
  'Some meals were swapped to meet dietary constraints.':
    'Някои ястия бяха заменени, за да отговарят на диетичните ограничения.',
  'Disliked items were avoided in meal selection.':
    'Нежеланите храни бяха избегнати при избора на ястия.',
  'Previously flagged meals were deprioritized for variety.':
    'Преди отбелязаните ястия бяха с по-нисък приоритет за по-голямо разнообразие.',
  'Balanced nutrition': 'Балансирано хранене',
  'Whole foods, protein, vegetables': 'Пълноценни храни, протеин, зеленчуци',

  // —— src/lib/ai/index.js toDashboardFormat ——
  "5 min light cardio; dynamic stretches for the muscles you'll train today.":
    'Около 5 минути леко кардио и динамично разтягане за мускулите, които тренирате днес.',
  '60–90 min before: 30–40g carbs + 15–20g protein (e.g. oats + banana + whey, or rice cakes + Greek yogurt). Caffeine optional 30–45 min pre (3–5 mg/kg).':
    '60–90 мин преди: 30–40 g въглехидрати + 15–20 g протеин (напр. овес + банан + суроватъчен протеин, или оризови питки + гръцко кисело мляко). Кофеин по избор 30–45 мин преди (3–5 mg/kg).',
  'Within 1–2 hours: 40–60g carbs + 25–40g protein. Example: chicken + rice + vegetables, or whey + banana + toast. Prioritize whole foods when possible.':
    'В рамките на 1–2 часа: 40–60 g въглехидрати + 25–40 g протеин. Пример: пиле + ориз + зеленчуци, или суроватъчен шейк + банан + тост. По възможност заложете на пълноценни храни.',

  // Supplements (index.js stacks)
  Caffeine: 'Кофеин',
  'Performance and focus; supports fat oxidation.':
    'Фокус и представяне; подкрепя окисляването на мазнини.',
  '3–5 mg/kg 30–45 min pre-workout.': '3–5 mg/kg 30–45 мин преди тренировка.',
  'Whey or Plant Protein': 'Суроватъчен или растителен протеин',
  'Preserve muscle while in deficit.': 'Запазване на мускул при дефицит.',
  '1–2 scoops as needed.': '1–2 мерителни лъжици при нужда.',
  'Vitamin D3': 'Витамин D3',
  'Immune and metabolic support.': 'Имунна и метаболитна подкрепа.',
  '2,000–4,000 IU daily with fat.': '2000–4000 IU дневно с храна, съдържаща мазнини.',
  'Omega-3 (EPA/DHA)': 'Омега-3 (EPA/DHA)',
  'Recovery and body composition.': 'Възстановяване и телесен състав.',
  '2–3 g EPA+DHA daily.': '2–3 g EPA+DHA дневно.',
  'Creatine Monohydrate': 'Креатин монохидрат',
  'Strength and lean mass; strong evidence.': 'Сила и мускулна маса; силни доказателства.',
  '5 g daily, any time.': '5 g дневно, по всяко време.',
  'Hit daily protein targets.': 'Постигане на дневните белтъчни цели.',
  '2,000–4,000 IU daily.': '2000–4000 IU дневно.',
  'Bone health, immunity.': 'Костно здраве и имунитет.',
  'Recovery and joint health.': 'Възстановяване и стави.',
  Electrolytes: 'Електролити',
  'Hydration and performance during long sessions.':
    'Хидратация и представяне при по-дълги тренировки.',
  'As needed during training.': 'При нужда по време на тренировка.',
  'Health and immunity.': 'Здраве и имунитет.',
  Recovery: 'Възстановяване',
  Protein: 'Протеин',
  'Recovery.': 'Възстановяване.',
  'Recovery and muscle maintenance.': 'Възстановяване и поддържане на мускул.',
  'As needed.': 'При нужда.',

  // —— generatePlan.js ——
  'Linear: add weight or reps each week':
    'Линейна прогресия: добавяйте тежест или повторения всяка седмица',
  'Double progression: weight and reps':
    'Двойна прогресия: тежест и повторения',
  'Add 1-2 reps or 2.5% weight when all sets completed':
    'Добавяйте 1–2 повторения или ~2,5% тежест, когато всички серии са изпълнени качествено',
  'Add volume or intensity when RPE allows':
    'Увеличавайте обем или интензитет, когато RPE го позволява',
  'Every 4th week': 'На всяка четвърта седмица',
  'When performance drops or fatigue is high':
    'При спад в представянето или висока умора',
  '2.5-3.5 L water daily; more on training days.':
    '2,5–3,5 л вода дневно; повече в тренировъчни дни.',
  '2.5-3.5 L water daily.': '2,5–3,5 л вода дневно.',

  // —— generatePlan.js warnings ——
  'Short sessions with high frequency: prioritize recovery and sleep.':
    'Кратки сесии с висока честота: приоритет на възстановяване и сън.',
  'Modify exercises as needed for your limitations.':
    'Коригирайте упражненията според ограниченията си.',
  'Consider starting with 3-4 days to build consistency.':
    'Обмислете старт с 3–4 дни седмично за по-стабилен навик.',

  // —— fallbackPlan.js ——
  'This is a safe fallback plan. Consider retaking the assessment for a personalized plan.':
    'Това е безопасен резервен план. Повторете настройката за по-персонализиран план.',
  'This is a fallback plan. Retake the assessment for a personalized plan.':
    'Това е резервен план. Повторете настройката за персонализиран план.',

  // —— recommendationEngine.js ——
  'Weight loss rate exceeds 1 kg/week. Risk of muscle loss.':
    'Темпът на отслабване надхвърля 1 kg/седмица. Риск от загуба на мускул.',
  'Increase calories by 200 kcal': 'Увеличете калориите с 200 kcal',
  'Strength regression detected. Recovery may be insufficient.':
    'Отчетен е спад в силата. Възстановяването може да е недостатъчно.',
  'Deload week or reduce load by 10%':
    'Разтоварваща седмица или намалете тежестта с ~10%',
  'Fatigue level is elevated. Overtraining risk.':
    'Повишена умора. Риск от претрениране.',
  'Reduce training volume by 20%': 'Намалете тренировъчния обем с около 20%',
  'Sleep quality is low. Recovery and performance are impacted.':
    'Ниско качество на съня. Засегнати са възстановяването и представянето.',
  'Prioritize recovery and reduce intensity':
    'Приоритет на възстановяване и по-нисък интензитет',
  'Program adherence is below target. Complexity may be a barrier.':
    'Спазването на програмата е под целта. Сложността може да е пречка.',
  'Simplify program structure': 'Опростете структурата на програмата',
  'Adaptive engine suggests increasing intake.':
    'Адаптивният модул предлага увеличаване на приема.',
  'Deload week recommended by adaptive engine.':
    'Препоръчва се разтоварваща седмица от адаптивния модул.',
  'Deload week: reduce volume and intensity by 40–50%':
    'Разтоварване: намалете обема и интензитета с 40–50%',
  'Follow modified exercise selections in your plan':
    'Следвайте коригираните упражнения в плана си',

  // —— injuryAdjustmentEngine.js getInjuryWarnings ——
  'Shoulder: overhead pressing and dips modified. Use supported pressing options.':
    'Рамо: променени са жимове над глава и кофи. Ползвайте по-подкрепени варианти.',
  'Knee: high-impact and deep knee flexion modified. Hip-dominant alternatives used.':
    'Коляно: намален удар и дълбоко сгъване. Предпочитани са варианти с акцент върху ханш.',
  'Lower back: heavy hinge patterns modified. Chest-supported and machine options used.':
    'Кръст: променени са тежки „щангови“ модели. Ползвайте опора за гърди и уреди.',
  'Wrist: high-stress curls and extensions modified. Neutral-grip alternatives used.':
    'Китка: променени са натоварващи сгъвания и разгъвания. Неутрален хват.',
  'Elbow: skull crushers and heavy curls modified. Cable and hammer variations used.':
    'Лакът: променени са „черепотрошачи“ и тежки сгъвания. Кабел и хамър варианти.',
  'Neck: direct neck work avoided. Upper back focus maintained.':
    'Врат: без директна работа за врата. Акцент върху горен гръб.',
  'Ankle: jumping and sprinting modified. Low-impact options used.':
    'Глезен: променени са подскоци и спринт. Нискоударни варианти.',
  'Hips: deep hip flexion modified. Controlled range variations used.':
    'Таз: контролиран обхват при сгъване в тазобедрената става.',
  'General fatigue: volume may be reduced.':
    'Обща умора: обемът може да бъде намален.',
  'Movement restriction: machine and supported variations preferred.':
    'Ограничение в движението: предпочитани уреди и подкрепени варианти.',

  // —— adaptiveEngine.js (progress / adaptive summary) ——
  'Reduce training volume by 20% this week.':
    'Намалете тренировъчния обем с около 20% тази седмица.',
  'Prioritize sleep; consider reducing intensity until sleep improves.':
    'Приоритет на съня; намалете интензитета, докато сънят не се подобри.',
  'Consider a deload week to recover.':
    'Обмислете разтоварваща седмица за възстановяване.',
  'Deload week: reduce volume and intensity by 40–50% to recover.':
    'Разтоварване: намалете обема и интензитета с 40–50% за възстановяване.',

  // —— app.js nutrition fallbacks (safeT keys) ——
  'Focus on whole foods and hit your macro targets above.':
    'Основавайте храненето си предимно на пълноценни храни и постигайте макросите отгоре.',
  'Eat 4–5 balanced meals daily with protein at each.':
    '4–5 балансирани хранения дневно; поставяйте протеина като приоритет във всяко хранене.',
  'Eat 4-5 balanced meals daily with protein at each.':
    '4–5 балансирани хранения дневно; поставяйте протеина като приоритет във всяко хранене.',

  // Supplement fallbacks (API / stored plans may still carry EN)
  'Performance and focus.': 'Производителност и фокус.',
  'Preserve muscle.': 'Запазване на мускулна маса.',
  'Immune support.': 'Имунна подкрепа.',
  '3–5 mg/kg pre-workout.': '3–5 mg/kg преди тренировка.',
  '1–2 scoops.': '1–2 мерителни лъжици.',
  '2,000–4,000 IU daily.': '2000–4000 IU дневно.',
  'Strength and lean mass.': 'Сила и мускулна маса.',
  'Hit protein targets.': 'Постигане на белтъчни цели.',
  'Bone health.': 'Костно здраве.',
  'Joint health.': 'Здраве на ставите.',
  'Convenience.': 'Удобство.',
  'Immunity.': 'Имунитет.',
  'Strength.': 'Сила.',

  // MEAL_NAMES (generateNutritionPlan) — slot labels if surfaced
  Breakfast: 'Закуска',
  'Pre-Workout': 'Преди тренировка',
  'Post-Workout': 'След тренировка',
  Lunch: 'Обяд',
  Dinner: 'Вечеря',
  Snack: 'Междинно хранене',
  pre_workout: 'Преди тренировка',
  post_workout: 'След тренировка',
  breakfast: 'Закуска',
  lunch: 'Обяд',
  dinner: 'Вечеря',
  snack: 'Междинно хранене',

  // —— Fallback / template warmups (generatePlan) ——
  'Light cardio + dynamic stretches': 'Леко кардио и динамично разтягане',
  'Static stretching': 'Статично разтягане'
};
