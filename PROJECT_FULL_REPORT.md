# ASCEND AI PROTOCOL - Пълен Технически Отчет

## 1. Обобщение

- Проектът е открит в `antigravity/scratch/iron-protocol`.
- Име на пакета: `ascend-ai-protocol`
- Версия: `1.0.0`
- Тип: Vanilla JS + Vercel serverless + локално-first persistence + AI generation pipeline
- Основна цел: генериране на персонализирани тренировъчни и хранителни планове с rule engine fallback и OpenAI server-side path
- Основни интеграции: OpenAI, Supabase, Vercel
- Основен UI език: BG-first, с наличен EN fallback

Ключовото за този проект е, че има две нива:

- Активно работещ локален продукт: frontend, local auth, localStorage persistence, AI/rule plan generation, dashboard, progress tracking
- Подготвени, но не напълно активирани cloud слоеве: Supabase auth/session/client, cloud persistence, admin flow

## 2. Бърз инвентар

- Общо файлове без `node_modules`: `63`
- Основен frontend shell: `app.js` с около `3024` реда
- `src/lib/ai`: `29` файла
- `src/lib/core`: `3` файла
- `src/lib/data`: `4` файла
- `src/lib/openai`: `2` файла
- `src/api`: `2` файла
- `api`: `2` файла
- `i18n`: `6` файла
- `assets`: `2` файла
- `scripts`: `1` файл

Разпределение по тип:

- `.js`: `52`
- `.json`: `4`
- `.md`: `2`
- `.png`: `2`
- `.css`: `1`
- `.mjs`: `1`
- `.html`: `1`

## 3. Архитектура

### 3.1 Frontend

Основни frontend файлове:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.json`
- `sw.js`

Наблюдения:

- UI е SPA-style shell с множество `section`-и за views: landing, auth, username setup, onboarding, assessment wizard, dashboard, admin placeholder
- `app.js` държи голяма част от приложната логика: routing, onboarding wizard, auth behavior, dashboard rendering, progress forms, API calling, local DB bridge
- Service worker е конфигуриран с `network-first` за HTML/CSS/JS и `stale-while-revalidate` за останалите GET assets
- Има PWA manifest, но иконите `icon-192.png` и `icon-512.png` липсват от проекта

### 3.2 Server/API

Основни API entry points:

- `api/ai/generate-plan.js`
- `api/admin/list-users.js`

Реални implementation файлове:

- `src/api/ai/generate-plan.js`
- `src/api/admin/list-users.js`

Модел:

- `api/*` са тънки Vercel wrappers
- реалната логика е в `src/api/*`

### 3.3 AI/Protocol Layer

Основен AI engine интерфейс:

- `src/lib/ai/index.js`

Главни модули:

- input normalization: `normalizeInput.js`
- classification: `classifyUser.js`
- plan generation: `generatePlan.js`
- fallback: `fallbackPlan.js`
- validation: `validatePlan.js`
- nutrition: `generateNutritionPlan.js`
- supplements: `supplementEngine.js`
- safety: `safetyValidator.js`
- adaptation: `adaptiveEngine.js`
- recommendations: `recommendationEngine.js`
- injury adjustment: `injuryAdjustmentEngine.js`
- injury recovery: `injuryRecoveryEngine.js`
- periodization: `periodizationEngine.js`
- protocol lifecycle: `protocolEngine.js`
- regeneration: `regenerationEngine.js`
- unified pipeline draft: `pipelineEngine.js`

### 3.4 Persistence Layer

Има два persistence слоя:

- Legacy local DB в `app.js`, базиран на `localStorage` и ключ `ascend_protocol_v4_db`
- По-структуриран adapter слой в `src/lib/data/*` и `src/lib/core/*`

Това е важна особеност: проектът не е изцяло мигриран към новия data/auth слой. Част от реалния runtime още минава през legacy `db` в `app.js`.

## 4. Активни runtime потоци

### 4.1 Реален flow за генериране на план

Активният user flow е:

1. Потребителят попълва 8-step assessment wizard в `app.js`
2. `app.js` прави `POST /api/ai/generate-plan`
3. `src/api/ai/generate-plan.js`:
   - нормализира входа
   - класифицира потребителя
   - опитва OpenAI path
   - валидира изхода
   - ако AI fail-не, връща fallback/rule plan
   - при нужда прилага injury adjustment и week-1 periodization
4. `app.js` преобразува резултата към dashboard формат чрез `toDashboardFormat(...)`
5. `createProtocol(...)` създава multi-week protocol
6. данните се пазят локално чрез legacy `db.saveNewProtocol(...)`

### 4.2 Реален auth flow

Реалният auth flow в момента е локален и legacy:

- signup/login се случва в `app.js`
- използват се `db.createUser(email, password)` и `db.login(email, password)`
- паролата се пази в localStorage-базираната структура

Новият auth adapter съществува, но:

- `getSessionUser()` връща `null`
- `isCurrentUserAdmin()` връща `false`
- `signInWithGoogle()` връща `cloud_auth_not_configured`

Извод:

- локалният email/password auth в `app.js` е реално активният
- cloud auth е подготвен, но не е завършен

### 4.3 Реален dashboard/progress flow

След генериране на протокол:

- активният протокол се пази локално
- user може да въвежда progress/check-ins
- progress данните се използват от adaptive, recommendation, regeneration и injury recovery логиката
- regeneration engine може да advance-не текущата седмица и да създава snapshots

## 5. AI и business logic

### 5.1 Input normalization

`normalizeInput.js` прави:

- clamp на възраст, ръст, тегло
- enum normalization за пол, активност, цел, equipment, experience, diet, limitations
- safe defaults
- консервативна sanitation на текстови полета

### 5.2 Classification

`classifyUser.js` определя:

- goal
- experience level
- schedule profile
- recovery profile
- split type
- plan complexity
- human-readable classification label

### 5.3 Plan generation

`generatePlan.js` работи така:

- ако има OpenAI key, опитва AI generation
- ако AI fail-не или отговорът е невалиден, минава към rule engine
- rule engine генерира `planMeta`, `userSummary`, `weeklyPlan`, `progressionRules`, `recoveryGuidance`, `warnings`
- има защита срещу duplicate day exercise structures чрез `ensureUniqueDayExercises`
- прилага week 1 phase от periodization engine

### 5.4 Nutrition

`generateNutritionPlan.js`:

- смята BMR/TDEE/target calories
- определя макроси
- строи meal plan по slotове
- валидира dietary constraints
- auto-replace-ва invalid meals
- ползва nutrition memory за variety и избягване на boring/disliked meals

### 5.5 Supplements

`supplementEngine.js`:

- генерира essentials и optional supplements
- отчита diet type, fatigue, sleep, training volume, caffeine tolerance
- добавя caution messages
- има адаптивна supplement memory логика

### 5.6 Safety

`safetyValidator.js` валидира:

- твърде ниски калории
- твърде нисък protein intake
- твърде много ограничения
- висока умора без reduction
- твърде много supplement recommendations
- stimulant conflict
- poor meal variety
- weak/empty outputs

Връща:

- `valid`
- `warnings`
- `criticalFlags`
- `qualityScore`
- `checks`

### 5.7 Adaptation / Regeneration / Recovery

Проектът има богата пост-processing логика:

- progress evaluation
- nutrition and training adjustments
- injury-safe exercise replacement
- deload detection
- weekly protocol regeneration
- adaptation summary
- protocol snapshots/history

Това е силната страна на проекта: локалната rule-based логика е доста по-богата от обикновен “generate one JSON and show it” flow.

## 6. Интеграции

### 6.1 OpenAI

Използвани файлове:

- `src/lib/openai/client.js`
- `src/lib/openai/promptBuilder.js`
- `src/api/ai/generate-plan.js`

Наблюдения:

- използва се server-side `Responses API`
- моделът по подразбиране е `gpt-4.1-mini`
- `OPENAI_API_KEY` се чете само от server-side env
- raw AI output никога не се trust-ва директно
- JSON output се parse-ва и валидира

### 6.2 Supabase

Използвани файлове:

- `src/lib/data/supabaseClient.js`
- `src/lib/data/cloudPersistence.js`
- `src/api/admin/list-users.js`
- `scripts/make-admin.mjs`

Наблюдения:

- публичната frontend конфигурация използва `SUPABASE_URL` + `SUPABASE_PUBLIC_KEY`/`SUPABASE_ANON_KEY`
- admin endpoint използва `SUPABASE_SERVICE_ROLE_KEY` или `SUPABASE_SECRET_KEY`
- `scripts/make-admin.mjs` ползва `SUPABASE_SECRET_KEY` и hardcoded `userId`
- реален Supabase client все още не се инициализира: `getSupabaseClient()` връща `null`
- cloud session snapshot в момента връща локален режим

### 6.3 Vercel

`vercel.json`:

- rewrite-ва SPA routes към `index.html`
- добавя security headers
- настройва `Cache-Control` за `sw.js`

## 7. Конфигурация и чувствителни данни

Открити файлове с конфигурации:

- `.env`
- `.env.local`
- `.env.example`
- `config.js`
- `config.example.js`

Открити ключове, редактирани:

- `.env`
  - `OPENAI_API_KEY=<redacted>`
- `.env.local`
  - `SUPABASE_URL=<redacted>`
  - `SUPABASE_PUBLIC_KEY=<redacted>`
- `.env.example`
  - `SUPABASE_URL=<redacted>`
  - `SUPABASE_PUBLIC_KEY=<redacted>`
  - `SUPABASE_ANON_KEY=<redacted>`
- `config.js`
  - `window.ENV=<redacted>`
- `config.example.js`
  - `window.ENV=<redacted>`

Важни бележки:

- `config.js` се генерира от `build.js`
- `config.js` е игнориран от `.gitignore`
- `.env` и `.env.*` също са игнорирани
- публичните Supabase ключове са очаквано достъпни за frontend
- service role / secret key не са намерени в локалните tracked конфигурации, което е добре

## 8. Local storage и данни на потребителя

Основни localStorage ключове:

- `ascend_protocol_v4_db`
- `ascend_current_user`
- `ascend_users`
- `ascend_pending_merges`
- `ascend_sync_state`
- `ascend_progress_<userId>`
- `ascend_injury_recovery_<userId>`

Какви данни се пазят локално:

- потребители
- текущ потребител
- active protocol
- protocol history
- assessment state
- telemetry
- progress entries
- injury recovery state
- pending merge bundles
- sync state

## 9. Реално активен код срещу подготвен код

### 9.1 Активно използвано

- `app.js` UI shell и routing
- `POST /api/ai/generate-plan`
- `src/api/ai/generate-plan.js`
- `src/lib/ai/index.js`
- `src/lib/ai/generatePlan.js`
- `src/lib/ai/generateNutritionPlan.js`
- `src/lib/ai/protocolEngine.js`
- `src/lib/ai/regenerationEngine.js`
- `src/lib/ai/injuryAdjustmentEngine.js`
- `src/lib/ai/periodizationEngine.js`
- local persistence в `app.js`

### 9.2 Подготвено, но невързано или частично невързано

- `runFullProtocolPipeline(...)` в `src/lib/ai/pipelineEngine.js`
- `cloudPersistence.js`
- реален Supabase client/session flow
- Google sign-in
- admin UI с реално съдържание

## 10. Рискове, слабости и технически дълг

### 10.1 Смесени persistence/auth слоеве

Най-същественият архитектурен риск:

- `app.js` използва собствен legacy `db`
- `src/lib/core/*` и `src/lib/data/*` въвеждат нов слой
- част от state-а живее и на двете места

Това води до:

- дублиране на отговорности
- риск от разминаване между current user, username, protocol state и sync layer
- по-трудна миграция към cloud persistence

### 10.2 Cloud auth не е завършен

Кодът показва ясно, че:

- `getSessionUser()` не връща сесия
- `isCurrentUserAdmin()` винаги е `false`
- `signInWithGoogle()` не е конфигуриран

Следствие:

- admin flow не е функционален от frontend
- cloud login реално не работи

### 10.3 Supabase client е scaffold only

`src/lib/data/supabaseClient.js` е подготвен, но:

- не създава клиент
- не прави реална сесия
- cloud persistence helper-ите не могат да станат активни без доработка

### 10.4 PWA икони липсват

`index.html` и `manifest.json` реферират:

- `icon-192.png`
- `icon-512.png`

Но тези файлове не съществуват в проекта.

Риск:

- broken icons за PWA/install/mobile shell

### 10.5 Admin script с hardcoded user ID

`scripts/make-admin.mjs`:

- има hardcoded Supabase user ID
- използва server secret

Риск:

- неудобен deployment flow
- лесно объркване при друга среда или друг администратор

### 10.6 Няма automated tests/lint scripts

В `package.json` има само:

- `build`
- `make-admin`

Няма:

- unit tests
- integration tests
- lint
- type check

### 10.7 Монолитен `app.js`

`app.js` е около `3024` реда и държи:

- routing
- state bridge
- auth behavior
- translations
- dashboard rendering
- wizard behavior
- API calls
- modal logic

Риск:

- трудна поддръжка
- висок coupling
- трудно тестване

## 11. Verification

Изпълнени проверки:

- import на `src/lib/ai/pipelineEngine.js`: OK
- import на `src/lib/ai/index.js`: OK
- `npm.cmd run build`: OK

Build резултат:

- `config.js` е генериран успешно от `build.js`

Ограничения на верификацията:

- не са налични automated tests
- не е правен live API call към OpenAI
- не е правен live call към Supabase
- не е стартиран Vercel runtime или browser preview в тази сесия

## 12. Зависимости

От `package.json`:

- `@supabase/supabase-js` `^2.49.1`
- `dotenv` `^16.4.5`
- `openai` `^4.77.0`

Скриптове:

- `build`: `node build.js`
- `make-admin`: `node scripts/make-admin.mjs`

Изискване за Node:

- `>=18.0.0`

## 13. Пълен файлов инвентар без node_modules

### Root

- `app.js`
- `build.js`
- `config.example.js`
- `index.html`
- `manifest.json`
- `package-lock.json`
- `package.json`
- `PHASE2_DELIVERABLES.md`
- `README.md`
- `styles.css`
- `sw.js`
- `vercel.json`

### scripts

- `scripts/make-admin.mjs`

### assets

- `assets/ascend-logo.png`
- `assets/hero-emblem.png`

### i18n

- `i18n/accordionEngineBg.js`
- `i18n/accordionEnBg.js`
- `i18n/accordionMealPoolBg.js`
- `i18n/bg.js`
- `i18n/en.js`
- `i18n/i18n.js`

### api

- `api/admin/list-users.js`
- `api/ai/generate-plan.js`

### src/api

- `src/api/admin/list-users.js`
- `src/api/ai/generate-plan.js`

### src/lib/openai

- `src/lib/openai/client.js`
- `src/lib/openai/promptBuilder.js`

### src/lib/core

- `src/lib/core/auth.js`
- `src/lib/core/authAdapter.js`
- `src/lib/core/userStore.js`

### src/lib/data

- `src/lib/data/backendAdapter.js`
- `src/lib/data/cloudPersistence.js`
- `src/lib/data/storageAdapter.js`
- `src/lib/data/supabaseClient.js`

### src/lib/ai

- `src/lib/ai/adaptationSummaryEngine.js`
- `src/lib/ai/adaptiveEngine.js`
- `src/lib/ai/classifyUser.js`
- `src/lib/ai/fallbackPlan.js`
- `src/lib/ai/generateNutritionPlan.js`
- `src/lib/ai/generatePlan.js`
- `src/lib/ai/index.js`
- `src/lib/ai/injuryAdjustmentEngine.js`
- `src/lib/ai/injuryRecoveryEngine.js`
- `src/lib/ai/mealRotationEngine.js`
- `src/lib/ai/normalizeInput.js`
- `src/lib/ai/nutritionAdaptationMemory.js`
- `src/lib/ai/nutritionConstraintEngine.js`
- `src/lib/ai/nutritionRules.js`
- `src/lib/ai/periodizationEngine.js`
- `src/lib/ai/pipelineEngine.js`
- `src/lib/ai/progressTracker.js`
- `src/lib/ai/protocolEngine.js`
- `src/lib/ai/recommendationEngine.js`
- `src/lib/ai/regenerationEngine.js`
- `src/lib/ai/rules.js`
- `src/lib/ai/safetyValidator.js`
- `src/lib/ai/savePlanResult.js`
- `src/lib/ai/schemas.js`
- `src/lib/ai/supplementAdaptationMemory.js`
- `src/lib/ai/supplementEngine.js`
- `src/lib/ai/utils.js`
- `src/lib/ai/validatePlan.js`
- `src/lib/ai/workoutGenerator.js`

## 14. Кратък извод

Проектът е доста напреднал като продуктова логика и има силен локален runtime:

- assessment
- plan generation
- nutrition
- adaptation
- protocol lifecycle
- progress tracking

Най-големият незавършен слой е cloud интеграцията:

- auth
- Supabase session/client
- persistence sync
- admin UX

Ако следващата стъпка е modernization или production-hardening, най-важните 4 задачи биха били:

1. уеднаквяване на auth/persistence към един слой
2. реално свързване на Supabase client/session
3. добавяне на tests/lint
4. оправяне на липсващите PWA assets и admin flow
