/**
 * ASCEND AI PROTOCOL - Premium AI Fitness System
 * Architecture: Vanilla JS + Robust LocalStorage Simulation
 */

// Global App Namespace established early to prevent ReferenceErrors
window.app = window.app || {};

// ==========================================
// 1. DATABASE & PERSISTENCE
// ==========================================
const DB_KEY = 'ascend_protocol_v4_db';

const db = {
    init: () => {
        if (!localStorage.getItem(DB_KEY)) {
            localStorage.setItem(DB_KEY, JSON.stringify({
                users: {},
                currentUser: null
            }));
        }
    },
    get: () => JSON.parse(localStorage.getItem(DB_KEY)),
    save: (data) => localStorage.setItem(DB_KEY, JSON.stringify(data)),

    // User Operations
    getUser: (email) => {
        return db.get().users[email] || null;
    },
    getCurrentUser: () => {
        const state = db.get();
        return state.currentUser ? state.users[state.currentUser] : null;
    },
    createUser: (email, pass) => {
        const state = db.get();
        if (state.users[email]) return false; // exists

        state.users[email] = {
            email,
            pass,
            assessment_state: { step: 0, data: {} }, // Pause & Resume
            active_protocol: null,
            history: [], // Generated protocols array
            telemetry: [] // Weekly check-ins array
        };
        state.currentUser = email;
        db.save(state);
        return true;
    },
    login: (email, pass) => {
        const state = db.get();
        const user = state.users[email];
        if (user && user.pass === pass) {
            state.currentUser = email;
            db.save(state);
            return true;
        }
        return false;
    },
    logout: () => {
        const state = db.get();
        state.currentUser = null;
        db.save(state);
    },

    // Data Operations (on current user)
    saveAssessmentState: (step, data) => {
        const state = db.get();
        if (!state.currentUser) return;
        state.users[state.currentUser].assessment_state = { step, data };
        db.save(state);
    },
    clearAssessmentState: () => {
        const state = db.get();
        if (!state.currentUser) return;
        state.users[state.currentUser].assessment_state = { step: 0, data: {} };
        db.save(state);
    },
    saveNewProtocol: (protocol) => {
        const state = db.get();
        if (!state.currentUser) return;

        const user = state.users[state.currentUser];
        protocol.id = 'PRT-' + Date.now().toString().slice(-6);
        protocol.created_at = new Date().toLocaleDateString();

        // Push old to history if one exists
        if (user.active_protocol) {
            user.history.unshift(user.active_protocol);
        }

        user.active_protocol = protocol;
        db.save(state);
    },
    saveTelemetry: (log) => {
        const state = db.get();
        if (!state.currentUser) return;

        log.id = 'CHK-' + Date.now().toString().slice(-6);
        log.date = new Date().toLocaleDateString();
        state.users[state.currentUser].telemetry.unshift(log); // newest first
        db.save(state);
    }
};

// ==========================================
// 1.5 LANGUAGE MODULE
// ==========================================
const langModule = {
    currentLanguage: 'en',
    translations: {
        en: {
            "Start Assessment": "Start Assessment",
            "Resume Step": "Resume Step",
            "Welcome to ASCEND AI PROTOCOL": "Welcome to ASCEND AI PROTOCOL",
            "Personal Setup": "Personal Setup",
            "Login": "Login",
            "Create Account": "Create Account",
            "Logged In As": "Logged In As",
            "Dashboard": "Dashboard",
            "Logout": "Logout",
            "PREMIUM AI FITNESS SYSTEM": "PREMIUM AI FITNESS SYSTEM",
            "Adaptive System": "Adaptive System for Conditioning, Endurance & Natural Development",
            "Hero Subtitle": "A premium AI fitness system optimized for strength, health, longevity, and body recomposition.",
            "Features": "Features",
            "Features Subtitle": "Designed for your success. No cookie-cutter plans.",
            "Comprehensive Assessment": "Comprehensive Assessment",
            "Assessment Desc": "Detailed analysis mapping your current fitness level, health history, and schedule.",
            "Smart Training Plans": "Smart Training Plans",
            "Training Desc": "Personalized workouts that adapt to your progress and consistency.",
            "Weekly Check-ins": "Weekly Check-ins",
            "Check-in Desc": "Weekly tracking ensures your plan stays optimized for your current level.",
            "Access Dashboard": "Access your personalized dashboard.",
            "Email Address": "Email Address",
            "Password": "Password",
            "No account yet?": "No account yet?",
            "Initialize text": "Initialize your assessment to generate a precision protocol for strength, health, longevity, and body recomposition.",
            "Back": "Back",
            "Next Step": "Next Step",
            "YOUR TRAINING PLAN": "YOUR TRAINING PLAN",
            "Pending Assessment": "Pending your assessment.",
            "Log Progress": "Log Progress",
            "Nutrition Plan": "Nutrition Plan",
            "Recovery Plan": "Recovery Plan",
            "Poor": "Poor",
            "Average": "Average",
            "Excellent": "Excellent",
            "Friendly Reminder": "Friendly Reminder",
            "Recovery Note": "Getting enough sleep is crucial for your recovery and progress.",
            "No Data Yet": "No Data Yet",
            "Log Progress Desc": "Log your weekly progress to track your improvements.",
            "Workout Plan": "Workout Plan",
            "Your Progress Title": "Your Progress",
            "Your track record": "Your track record of results.",
            "Body Weight": "Body Weight",
            "Consistency": "Consistency",
            "Energy Level": "Energy Level",
            "kg": "kg",
            "History Log": "History Log",
            "Timestamp": "Timestamp",
            "Weight (kg)": "Weight (kg)",
            "Waist (cm)": "Waist (cm)",
            "Workouts": "Workouts",
            "Energy": "Energy",
            "Sleep": "Sleep",
            "Notes": "Notes",
            "[ No progress logged yet ]": "[ No progress logged yet ]",
            "Plan History": "Plan History",
            "Your previous plans": "Your previous training plans.",
            "Retake Assessment": "Retake Assessment",
            "Current Weight (kg)": "Current Weight (kg)",
            "Diet Consistency (%)": "Diet Consistency (%)",
            "Workouts Completed (%)": "Workouts Completed (%)",
            "Energy Level (1-10)": "Energy Level (1-10)",
            "Sleep Quality (1-10)": "Sleep Quality (1-10)",
            "Low [1]": "Low [1]",
            "High [10]": "High [10]",
            "Poor [1]": "Poor [1]",
            "Great [10]": "Great [10]",
            "Cancel": "Cancel",
            "Save Log": "Save Log",
            "GENERATING PLAN": "GENERATING PLAN",
            "Analyzing status...": "Analyzing your profile...",
            "Monday": "Mon",
            "Tuesday": "Tue",
            "Wednesday": "Wed",
            "Thursday": "Thu",
            "Friday": "Fri",
            "Saturday": "Sat",
            "Sunday": "Sun",
            "Strength Focus": "Strength Focus",
            "Bodyweight Focus": "Bodyweight Focus",
            "Cardio & Endurance Phase": "Cardio & Endurance Phase",
            "Active Recovery / Mobility": "Active Recovery / Mobility",
            "Focus on your main goal, especially": "Focus on your main goal, especially",
            "core fitness": "core fitness",
            "Build up your fitness and track progress.": "Build up your fitness and track progress.",
            "Aim for": "Aim for",
            "hours of quality sleep.": "hours of quality sleep.",
            "Daily mobility: 10 mins dedicated stretching/rehab for": "Daily mobility: 10 mins dedicated stretching/rehab for",
            "PLAN: FAT LOSS": "PLAN: FAT LOSS",
            "PLAN: BUILD MUSCLE": "PLAN: BUILD MUSCLE",
            "PLAN: BODY RECOMPOSITION": "PLAN: BODY RECOMPOSITION",
            "PLAN: OVERALL FITNESS": "PLAN: OVERALL FITNESS",
            "LEVEL": "LEVEL",
            "Frequency": "Frequency",
            "Days / Wk": "Days / Wk",
            "Status": "Status",
            "Active": "Active",
            "Deploy Date": "Deploy Date",
            "Balanced Nutrition": "Balanced Nutrition",
            "Keto Diet": "Keto Diet",
            "Intermittent Fasting": "Intermittent Fasting",
            "Style": "Style",
            "To Do": "To Do",
            "Overall Consistency": "Overall Consistency",
            "Training": "Training",
            "ARCHIVED": "ARCHIVED",
            "Deployed": "Deployed",
            "Level": "Level",
            "kcal limit": "kcal limit",
            "[ No previous plans found ]": "[ No previous plans found ]",
            "Core telemetry indices required for submission.": "Core telemetry indices required for submission.",
            "Diet": "Diet",
            "Basic Information": "Basic Information",
            "Age": "Age",
            "e.g. 30": "e.g. 30",
            "Gender": "Gender",
            "Male": "Male",
            "Female": "Female",
            "e.g. 82": "e.g. 82",
            "Height (cm)": "Height (cm)",
            "e.g. 178": "e.g. 178",
            "Activity Level": "Activity Level",
            "Mostly sitting / little movement": "Mostly sitting / little movement",
            "Light activity (walking, light workouts)": "Light activity (walking, light workouts)",
            "Regular workouts or active job": "Regular workouts or active job",
            "Hard training or physical work": "Hard training or physical work",
            "Your Goal": "Your Goal",
            "Primary Focus": "Primary Focus",
            "Fat Loss": "Fat Loss",
            "Lose fat while preserving muscle.": "Lose fat while preserving muscle.",
            "Build Muscle": "Build Muscle",
            "Gain muscle and strength.": "Gain muscle and strength.",
            "Recomposition": "Recomposition",
            "Lose fat and gain muscle at the same time.": "Lose fat and gain muscle at the same time.",
            "Health & Longevity": "Health & Longevity",
            "Optimize healthspan and vitality.": "Optimize healthspan and vitality.",
            "Secondary Objectives": "Secondary Objectives",
            "Raw Strength": "Raw Strength",
            "Better Stamina": "Better Stamina",
            "Power & Speed": "Power & Speed",
            "Move Better": "Move Better",
            "Mental Toughness": "Mental Toughness",
            "Aesthetics": "Aesthetics",
            "How Dedicated Are You?": "How Dedicated Are You?",
            "Just getting started": "Just getting started",
            "I can train regularly": "I can train regularly",
            "Very serious about my results": "Very serious about my results",
            "Experience & Capability": "Experience & Capability",
            "Training Experience": "Training Experience",
            "Beginner": "Beginner",
            "New to training, learning the basics.": "New to training, learning the basics.",
            "Intermediate": "Intermediate",
            "Consistent training for a few months.": "Consistent training for a few months.",
            "Advanced": "Advanced",
            "Several years of training experience.": "Several years of training experience.",
            "Current Fitness Level (1-10)": "Current Fitness Level (1-10)",
            "Areas for Improvement": "Areas for Improvement",
            "Lose Body Fat": "Lose Body Fat",
            "Increase Strength": "Increase Strength",
            "Improve Energy": "Improve Energy",
            "Better Sleep": "Better Sleep",
            "Reduce Stress": "Reduce Stress",
            "Improve Posture": "Improve Posture",
            "Move With Less Pain": "Move With Less Pain",
            "Recovery & Limitations": "Recovery & Limitations",
            "Do you have any current injuries?": "Do you have any current injuries?",
            "No": "No",
            "Yes": "Yes",
            "Select Injuries/Limitations": "Select Injuries/Limitations",
            "Lower Back / Spine": "Lower Back / Spine",
            "Knees": "Knees",
            "Shoulders": "Shoulders",
            "Wrist/Elbow": "Wrist/Elbow",
            "Hips": "Hips",
            "Ankles": "Ankles",
            "Daily Stress Level (1-10)": "Daily Stress Level (1-10)",
            "Recovery Capacity": "Recovery Capacity",
            "I often feel sore or tired": "I often feel sore or tired",
            "I recover normally": "I recover normally",
            "I bounce back fast": "I bounce back fast",
            "Logistics": "Logistics",
            "Training Days Per Week": "Training Days Per Week",
            "Available Session Duration": "Available Session Duration",
            "30 Minutes": "30 Minutes",
            "45 Minutes": "45 Minutes",
            "60 Minutes": "60 Minutes",
            "90+ Minutes": "90+ Minutes",
            "Equipment Access": "Equipment Access",
            "Full Gym": "Full Gym",
            "A proper gym with machines and free weights.": "A proper gym with machines and free weights.",
            "Home Gym": "Home Gym",
            "Basic setup with dumbbells or a barbell.": "Basic setup with dumbbells or a barbell.",
            "Bodyweight/Minimal": "Bodyweight/Minimal",
            "No equipment, just your body.": "No equipment, just your body.",
            "Training Style Preference": "Training Style Preference",
            "Preferred Style": "Preferred Style",
            "Strength Training": "Strength Training",
            "Lifting heavy weights to build strength and muscle.": "Lifting heavy weights to build strength and muscle.",
            "HIIT & Conditioning": "HIIT & Conditioning",
            "Fast-paced workouts to burn fat and get your heart pumping.": "Fast-paced workouts to burn fat and get your heart pumping.",
            "Calisthenics": "Calisthenics",
            "Using your own bodyweight to get strong and lean.": "Using your own bodyweight to get strong and lean.",
            "Workouts focused on moving well and living longer.": "Workouts focused on moving well and living longer.",
            "Nutrition Profile": "Nutrition Profile",
            "Diet Type": "Diet Type",
            "Balanced Nutritional Plan": "Balanced Nutritional Plan",
            "A normal diet with a good mix of protein, carbs, and fats.": "A normal diet with a good mix of protein, carbs, and fats.",
            "Keto / Low Carb": "Keto / Low Carb",
            "Eating mostly fats and protein with very few carbs.": "Eating mostly fats and protein with very few carbs.",
            "Plant-Based / Vegan": "Plant-Based / Vegan",
            "Eating only foods that come from plants.": "Eating only foods that come from plants.",
            "Any food allergies or intolerances?": "Any food allergies or intolerances?",
            "Select Restrictions / Avoid": "Select Restrictions / Avoid",
            "Dairy": "Dairy",
            "Gluten": "Gluten",
            "Nuts": "Nuts",
            "Shellfish": "Shellfish",
            "Soy": "Soy",
            "Eggs": "Eggs",
            "Preferred Meals Per Day": "Preferred Meals Per Day",
            "Lifestyle & Habits": "Lifestyle & Habits",
            "Cooking Ability": "Cooking Ability",
            "Novice": "Novice",
            "I can make simple meals": "I can make simple meals",
            "I can follow basic recipes": "I can follow basic recipes",
            "Expert": "Expert",
            "I am great at cooking and prepping": "I am great at cooking and prepping",
            "Food Budget": "Food Budget",
            "Budget": "Budget",
            "Trying to save money": "Trying to save money",
            "Standard": "Standard",
            "Normal grocery budget": "Normal grocery budget",
            "Premium": "Premium",
            "Willing to spend more on quality": "Willing to spend more on quality",
            "Daily Water Intake (Liters)": "Daily Water Intake (Liters)",
            "Supplement Use": "Supplement Use",
            "None": "None",
            "I only eat whole foods": "I only eat whole foods",
            "Basic": "Basic",
            "Just protein and vitamins": "Just protein and vitamins",
            "Advanced": "Advanced",
            "I use a full range of supplements": "I use a full range of supplements",
            "Mindset & Tracking": "Mindset & Tracking",
            "Work Schedule": "Work Schedule",
            "Standard (9-5)": "Standard (9-5)",
            "Shift / Night": "Shift / Night",
            "Nutrition Tracking Style": "Nutrition Tracking Style",
            "Strict Tracking": "Strict Tracking",
            "I want to track every calorie and macro.": "I want to track every calorie and macro.",
            "Flexible / Intuitive": "Flexible / Intuitive",
            "I just want simple guidelines to follow.": "I just want simple guidelines to follow.",
            "Step": "Step",
            "Step 8": "Step 8",
            "Step 9": "Step 9",
            "Allergies & Restrictions": "Allergies & Restrictions",
            "No restrictions": "No restrictions",
            "I have no food allergies or restrictions.": "I have no food allergies or restrictions.",
            "Guidelines": "Guidelines",
            "Focus on whole foods and hit your macro targets above.": "Focus on whole foods and hit your macro targets above.",
            "sets": "sets",
            "Rest": "Rest",
            "Create Plan": "Create Plan",
            "Please complete all visible fields to proceed.": "Please complete all visible fields to proceed.",
            "MIN": "MIN",
            "MAX": "MAX"
        },
        bg: {
            "Start Assessment": "Започни настройката",
            "Resume Step": "Продължи от стъпка",
            "Welcome to ASCEND AI PROTOCOL": "Добре дошли в ASCEND AI PROTOCOL",
            "Personal Setup": "Лична настройка",
            "Login": "Вход",
            "Create Account": "Създай профил",
            "Logged In As": "Влязъл като",
            "Dashboard": "Табло",
            "Logout": "Изход",
            "PREMIUM AI FITNESS SYSTEM": "ПРЕМИУМ AI ФИТНЕС СИСТЕМА",
            "Adaptive System": "Адаптивна система за кондиция, издръжливост и естествено развитие",
            "Hero Subtitle": "Премиум AI фитнес система, оптимизирана за сила, здраве, дълголетие и рекомпозиция на тялото.",
            "Features": "Възможности",
            "Features Subtitle": "Създадено за вашия успех. Без шаблони.",
            "Comprehensive Assessment": "Пълен анализ",
            "Assessment Desc": "Детайлен анализ на текущото ви ниво, здравна история и график.",
            "Smart Training Plans": "Умни тренировъчни планове",
            "Training Desc": "Персонализирани тренировки, които се адаптират към вашия напредък.",
            "Weekly Check-ins": "Седмични отчети",
            "Check-in Desc": "Седмичното проследяване гарантира, че планът остава оптимизиран.",
            "Access Dashboard": "Достъп до вашето лично табло.",
            "Email Address": "Имейл адрес",
            "Password": "Парола",
            "No account yet?": "Нямате профил?",
            "Initialize text": "Започнете настройката, за да генерирате прецизен протокол за сила, здраве, дълголетие и рекомпозиция на тялото.",
            "Back": "Назад",
            "Next Step": "Напред",
            "YOUR TRAINING PLAN": "ВАШИЯТ ТРЕНИРОВЪЧЕН ПЛАН",
            "Pending Assessment": "Очаква вашата настройка.",
            "Log Progress": "Въведи прогрес",
            "Nutrition Plan": "Хранителен план",
            "Recovery Plan": "План за възстановяване",
            "Poor": "Слабо",
            "Average": "Средно",
            "Excellent": "Отлично",
            "Friendly Reminder": "Приятелско напомняне",
            "Recovery Note": "Достатъчният сън е критичен фактор за вашето възстановяване и напредък.",
            "No Data Yet": "Няма данни",
            "Log Progress Desc": "Въвеждайте своя седмичен прогрес, за да следите резултатите си.",
            "Workout Plan": "Тренировъчен план",
            "Your Progress Title": "Вашият прогрес",
            "Your track record": "История на резултатите ви.",
            "Body Weight": "Тегло",
            "Consistency": "Постоянство",
            "Energy Level": "Енергия",
            "kg": "кг",
            "History Log": "История",
            "Timestamp": "Дата",
            "Weight (kg)": "Тегло (кг)",
            "Waist (cm)": "Талия (см)",
            "Workouts": "Тренировки",
            "Energy": "Енергия",
            "Sleep": "Сън",
            "Notes": "Бележки",
            "[ No progress logged yet ]": "[ Все още няма въведен прогрес ]",
            "Plan History": "История на плановете",
            "Your previous plans": "Предишни тренировъчни планове.",
            "Retake Assessment": "Повторна настройка",
            "Current Weight (kg)": "Текущо тегло (кг)",
            "Diet Consistency (%)": "Спазване на диетата (%)",
            "Workouts Completed (%)": "Завършени тренировки (%)",
            "Energy Level (1-10)": "Ниво на енергия (1-10)",
            "Sleep Quality (1-10)": "Качество на съня (1-10)",
            "Low [1]": "Ниска [1]",
            "High [10]": "Висока [10]",
            "Poor [1]": "Лошо [1]",
            "Great [10]": "Отлично [10]",
            "Cancel": "Отказ",
            "Save Log": "Запази отчета",
            "GENERATING PLAN": "ГЕНЕРИРАНЕ НА ПЛАН",
            "Analyzing status...": "Анализиране на профила...",
            "Mon": "ПОН",
            "Tue": "ВТО",
            "Wed": "СРЯ",
            "Thu": "ЧЕТ",
            "Fri": "ПЕТ",
            "Sat": "СЪБ",
            "Sun": "НЕД",
            "Strength Focus": "Фокус върху сила",
            "Bodyweight Focus": "Собствено тегло",
            "Cardio & Endurance Phase": "Кардио и издръжливост",
            "Active Recovery / Mobility": "Активно възстановяване / Подвижност",
            "Focus on your main goal, especially": "Фокус върху основната ви цел, особено",
            "core fitness": "базова фитнес подготовка",
            "Build up your fitness and track progress.": "Подобрявайте формата си и следете напредъка.",
            "Aim for": "Стремете се към",
            "hours of quality sleep.": "часа качествен сън.",
            "Daily mobility: 10 mins dedicated stretching/rehab for": "Дневна мобилност: 10 мин. стречинг/рехабилитация за",
            "PLAN: FAT LOSS": "ПЛАН: ИЗЧИСТВАНЕ НА МАЗНИНИ",
            "PLAN: BUILD MUSCLE": "ПЛАН: ПОКАЧВАНЕ НА МУСКУЛИ",
            "PLAN: BODY RECOMPOSITION": "ПЛАН: РЕКОМПОЗИЦИЯ",
            "PLAN: OVERALL FITNESS": "ПЛАН: ОБЩА КОНДИЦИЯ",
            "LEVEL": "НИВО",
            "Frequency": "Честота",
            "Days / Wk": "Дни / Седм",
            "Status": "Статус",
            "Active": "Активен",
            "Deploy Date": "Дата на стартиране",
            "Balanced Nutrition": "Балансирано",
            "Keto Diet": "Кето диета",
            "Intermittent Fasting": "Периодично гладуване",
            "Style": "Стил",
            "To Do": "Изпълни",
            "Overall Consistency": "Общо постоянство",
            "Training": "Тренировки",
            "ARCHIVED": "АРХИВИРАН",
            "Deployed": "Стартиран",
            "Level": "Ниво",
            "kcal limit": "ккал лимит",
            "[ No previous plans found ]": "[ Не са намерени предишни планове ]",
            "Core telemetry indices required for submission.": "Основните телеметрични данни са задължителни за запис.",
            "Diet": "Хранене",
            "Basic Information": "Основна информация",
            "Age": "Възраст",
            "e.g. 30": "напр. 30",
            "Gender": "Пол",
            "Male": "Мъж",
            "Female": "Жена",
            "e.g. 82": "напр. 82",
            "Height (cm)": "Височина (см)",
            "e.g. 178": "напр. 178",
            "Activity Level": "Ниво на активност",
            "Mostly sitting / little movement": "Предимно седяща работа / малко движение",
            "Light activity (walking, light workouts)": "Лека активност (разходки, леки тренировки)",
            "Regular workouts or active job": "Редовни тренировки или активна работа",
            "Hard training or physical work": "Тежки тренировки или физическа работа",
            "Your Goal": "Вашата цел",
            "Primary Focus": "Основен фокус",
            "Fat Loss": "Отслабване",
            "Lose fat while preserving muscle.": "Изчистване на мазнини със запазване на мускулна маса.",
            "Build Muscle": "Мускулна маса",
            "Gain muscle and strength.": "Покачване на сила и мускулна маса.",
            "Recomposition": "Рекомпозиция",
            "Lose fat and gain muscle at the same time.": "Изчистване на мазнини и покачване на мускули едновременно.",
            "Health & Longevity": "Здраве и дълголетие",
            "Optimize healthspan and vitality.": "Оптимизиране на здравето и жизнеността.",
            "Secondary Objectives": "Второстепенни цели",
            "Raw Strength": "Чиста сила",
            "Better Stamina": "По-добра издръжливост",
            "Power & Speed": "Мощ и скорост",
            "Move Better": "По-добро движение",
            "Mental Toughness": "Психическа устойчивост",
            "Aesthetics": "Естетика",
            "How Dedicated Are You?": "Колко сте отдадени?",
            "Just getting started": "Тепърва започвам",
            "I can train regularly": "Мога да тренирам редовно",
            "Very serious about my results": "Много сериозно към резултатите си",
            "Experience & Capability": "Опит и възможности",
            "Training Experience": "Тренировъчен опит",
            "Beginner": "Начинаещ",
            "New to training, learning the basics.": "Нов в тренировките, уча основите.",
            "Intermediate": "Средно напреднал",
            "Consistent training for a few months.": "Редовни тренировки от няколко месеца.",
            "Advanced": "Напреднал",
            "Several years of training experience.": "Няколко години тренировъчен опит.",
            "Current Fitness Level (1-10)": "Текущо фитнес ниво (1-10)",
            "Areas for Improvement": "Зони за подобряване",
            "Lose Body Fat": "Отслабване",
            "Increase Strength": "Покачване на сила",
            "Improve Energy": "Подобрена енергия",
            "Better Sleep": "По-добър сън",
            "Reduce Stress": "Намаляване на стреса",
            "Improve Posture": "По-добра стойка",
            "Move With Less Pain": "Движение без болка",
            "Recovery & Limitations": "Възстановяване и ограничения",
            "Do you have any current injuries?": "Имате ли настоящи контузии?",
            "No": "Не",
            "Yes": "Да",
            "Select Injuries/Limitations": "Изберете контузии/ограничения",
            "Lower Back / Spine": "Кръст / Гръбнак",
            "Knees": "Колена",
            "Shoulders": "Рамене",
            "Wrist/Elbow": "Китка / Лакът",
            "Hips": "Таз",
            "Ankles": "Глезени",
            "Daily Stress Level (1-10)": "Дневен стрес (1-10)",
            "Recovery Capacity": "Възстановяване",
            "I often feel sore or tired": "Често се чувствам изморен или с мускулна треска",
            "I recover normally": "Възстановявам се нормално",
            "I bounce back fast": "Възстановявам се много бързо",
            "Logistics": "Логистика",
            "Training Days Per Week": "Тренировъчни дни в седмицата",
            "Available Session Duration": "Време за тренировка",
            "30 Minutes": "30 Минути",
            "45 Minutes": "45 Минути",
            "60 Minutes": "60 Минути",
            "90+ Minutes": "90+ Минути",
            "Equipment Access": "Налично оборудване",
            "Full Gym": "Пълен фитнес",
            "A proper gym with machines and free weights.": "Добре оборудвана фитнес зала.",
            "Home Gym": "Домашен фитнес",
            "Basic setup with dumbbells or a barbell.": "Основни тежести и дъмбели вкъщи.",
            "Bodyweight/Minimal": "Собствено тегло / Минимално",
            "No equipment, just your body.": "Без оборудване, само собствено тегло.",
            "Training Style Preference": "Предпочитан тренировъчен стил",
            "Preferred Style": "Стил",
            "Strength Training": "Силови тренировки",
            "Lifting heavy weights to build strength and muscle.": "Тренировки с тежести за сила и мускулна маса.",
            "HIIT & Conditioning": "Високоинтензивни интервални тренировки",
            "Fast-paced workouts to burn fat and get your heart pumping.": "Бързи тренировки за изчистване и сърдечна дейност.",
            "Calisthenics": "Калистеника",
            "Using your own bodyweight to get strong and lean.": "Използване на собствено тегло за сила и релеф.",
            "Workouts focused on moving well and living longer.": "Тренировки за дълголетие и по-добро движение.",
            "Nutrition Profile": "Хранителен профил",
            "Diet Type": "Тип диета",
            "Balanced Nutritional Plan": "Балансирано хранене",
            "A normal diet with a good mix of protein, carbs, and fats.": "Нормална диета с добър микс от протеини, въглехидрати и мазнини.",
            "Keto / Low Carb": "Кето / НВХ",
            "Eating mostly fats and protein with very few carbs.": "Основно мазнини и протеин с много малко въглехидрати.",
            "Plant-Based / Vegan": "Растителна / Веган",
            "Eating only foods that come from plants.": "Консумация само на храни от растителен произход.",
            "Any food allergies or intolerances?": "Имате ли хранителни алергии или непоносимости?",
            "Select Restrictions / Avoid": "Ограничения / Избягване",
            "Dairy": "Млечни",
            "Gluten": "Глутен",
            "Nuts": "Ядки",
            "Shellfish": "Морски дарове",
            "Soy": "Соя",
            "Eggs": "Яйца",
            "Preferred Meals Per Day": "Предпочитани хранения на ден",
            "Lifestyle & Habits": "Начин на живот и навици",
            "Cooking Ability": "Готварски умения",
            "Novice": "Начинаещ",
            "I can make simple meals": "Мога да правя прости хранения",
            "I can follow basic recipes": "Следвам базови рецепти",
            "Expert": "Експерт",
            "I am great at cooking and prepping": "Много съм добър в готвенето",
            "Food Budget": "Бюджет за храна",
            "Budget": "Ограничен",
            "Trying to save money": "Старая се да спестявам",
            "Standard": "Стандартен",
            "Normal grocery budget": "Нормален бюджет за храна",
            "Premium": "Премиум",
            "Willing to spend more on quality": "Мога да харча повече за качество",
            "Daily Water Intake (Liters)": "Дневен прием на вода (Литри)",
            "Supplement Use": "Употреба на добавки",
            "None": "Никакви",
            "I only eat whole foods": "Само истинска храна",
            "Basic": "Основни",
            "Just protein and vitamins": "Само протеин и витамини",
            "Advanced": "Напреднал",
            "I use a full range of supplements": "Използвам всякакви добавки",
            "Mindset & Tracking": "Нагласа и проследяване",
            "Work Schedule": "Работен график",
            "Standard (9-5)": "Стандартен (9-5)",
            "Shift / Night": "На смени / Нощна",
            "Nutrition Tracking Style": "Стил на следене на храненето",
            "Strict Tracking": "Стриктно следене",
            "I want to track every calorie and macro.": "Искам да следя всяка калория и макронутриент.",
            "Flexible / Intuitive": "Гъвкав / Интуитивен",
            "I just want simple guidelines to follow.": "Искам просто ясни насоки, които да следвам.",
            "Step": "Стъпка",
            "Step 8": "Стъпка 8",
            "Step 9": "Стъпка 9",
            "Allergies & Restrictions": "Алергии и ограничения",
            "No restrictions": "Без ограничения",
            "I have no food allergies or restrictions.": "Нямам хранителни алергии или ограничения.",
            "Guidelines": "Насоки",
            "Focus on whole foods and hit your macro targets above.": "Фокусирайте се върху истинска храна и постигайте целевите макроси.",
            "sets": "серии",
            "Rest": "Почивка",
            "Create Plan": "Създай план",
            "Please complete all visible fields to proceed.": "Моля, попълнете всички видими полета, за да продължите.",
            "MIN": "МИН",
            "MAX": "МАКС",
            "STRENGTH": "СИЛА",
            "HYBRID": "ХИБРИД",
            "BODYWEIGHT": "СОБСТВЕНО ТЕГЛО",
            "LONGEVITY": "ДЪЛГОЛЕТИЕ",
            "BEGINNER": "НАЧИНАЕЩ",
            "INTERMEDIATE": "СРЕДНО НАПРЕДНАЛ",
            "ADVANCED": "НАПРЕДНАЛ",
            "plant_based": "Растителна / Веган",
            "HIIT": "Високоинтензивни интервални тренировки",
            "Mobility": "Подвижност",
            "Active Recovery": "Активно възстановяване",
            "Endurance": "Кардио и издръжливост",
            "poor": "Слабо",
            "average": "Средно",
            "excellent": "Отлично",
            "Strength": "Сила",
            "Recovery": "Възстановяване"
        }
    },

    init: () => {
        const savedLang = localStorage.getItem('ascend_lang');
        if (savedLang && (savedLang === 'en' || savedLang === 'bg')) {
            langModule.currentLanguage = savedLang;
        } else {
            langModule.currentLanguage = 'en';
        }
        langModule.applyTranslations();
    },

    setLanguage: (lang) => {
        if (!langModule.translations[lang]) return;
        langModule.currentLanguage = lang;
        localStorage.setItem('ascend_lang', lang);
        langModule.applyTranslations();

        // Add active state to switcher if it exists
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('text-primary', 'font-bold'));
        const activeBtn = document.getElementById(`lang-btn-${lang}`);
        if (activeBtn) activeBtn.classList.add('text-primary', 'font-bold');

        // Trigger the new safe i18n system for STEP 1 dashboard texts
        if (window.safeI18nSetLanguage) {
            window.safeI18nSetLanguage(lang);
        }

        // Re-render wizard if active
        if (typeof wizardModule !== 'undefined' && document.getElementById('view-assessment')?.classList.contains('active')) {
            wizardModule.render();
        }

        // Re-render dashboard if active
        if (typeof dashModule !== 'undefined' && document.getElementById('view-dashboard')?.classList.contains('active')) {
            dashModule.render();
        }
    },

    t: (key) => {
        if (!key) return key;

        // STEP 3: Check the safe new module first
        if (window.safeI18nT) {
            const mapped = window.safeI18nT(key);
            if (mapped !== key) return mapped;
        }

        const dict = langModule.translations[langModule.currentLanguage];
        if (dict && dict[key]) return dict[key];

        if (dict) {
            const lowerKey = String(key).toLowerCase();
            for (const [k, v] of Object.entries(dict)) {
                if (k.toLowerCase() === lowerKey) {
                    if (key === String(key).toUpperCase()) {
                        return String(v).toUpperCase();
                    }
                    return v;
                }
            }
        }
        return key;
    },

    applyTranslations: () => {
        const dict = langModule.translations[langModule.currentLanguage];
        // Translate static elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[key]) {
                el.innerText = dict[key];
            }
        });

        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (dict[key]) {
                el.placeholder = dict[key];
            }
        });
    }
};

// ==========================================
// 2. CORE ROUTING & APP STATE
// ==========================================
const app = {
    views: ['landing', 'auth', 'onboarding', 'assessment', 'dashboard'],

    navigate: (viewId, context = null) => {
        // Handle logic before view switch
        const user = db.getCurrentUser();

        // Protected routes logic
        const protectedRoutes = ['onboarding', 'assessment', 'dashboard'];
        if (protectedRoutes.includes(viewId) && !user) {
            viewId = 'auth';
            context = 'login';
        }

        // Contextual logic
        if (viewId === 'auth') {
            if (user) return app.navigate('dashboard'); // Already logged in
            authModule.setMode(context || 'login');
        }

        if (viewId === 'dashboard' && user && !user.active_protocol) {
            viewId = 'onboarding'; // No plan = force onboarding
        }

        if (viewId === 'assessment') {
            wizardModule.init();
        }

        if (viewId === 'dashboard' || viewId === 'onboarding') {
            dashModule.render();
        }

        // DOM Update
        app.views.forEach(v => document.getElementById(`view-${v}`).classList.remove('active'));
        document.getElementById(`view-${viewId}`).classList.add('active');

        // NEW LOGIC: Lock body scroll during assessment; allow full page scroll on dashboard
        if (viewId === 'assessment') {
            document.body.classList.add('no-scroll');
            document.documentElement.classList.remove('dashboard-active');
            document.body.classList.remove('dashboard-active');
        } else {
            document.body.classList.remove('no-scroll');
            if (viewId === 'dashboard') {
                document.documentElement.classList.add('dashboard-active');
                document.body.classList.add('dashboard-active');
            } else {
                document.documentElement.classList.remove('dashboard-active');
                document.body.classList.remove('dashboard-active');
            }
        }

        window.scrollTo(0, 0);

        // Auto close mobile menu
        document.getElementById('nav-content').classList.remove('active');
        const icon = document.getElementById('mobile-menu-icon');
        if (icon) {
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-bars');
        }

        app.updateNav();
    },

    updateNav: () => {
        const user = db.getCurrentUser();
        const navAuth = document.getElementById('nav-auth');
        const navUnauth = document.getElementById('nav-unauth');

        if (user) {
            navUnauth.classList.add('hidden');
            navAuth.classList.remove('hidden');
            document.getElementById('nav-user-email').textContent = user.email.split('@')[0].toUpperCase();
            document.getElementById('nav-avatar').textContent = user.email.substring(0, 2).toUpperCase();
            document.getElementById('dropdown-email').textContent = user.email;

            // Setup Dropdown listener safely
            const userMenuBtn = document.getElementById('user-menu-btn');
            if (userMenuBtn) {
                userMenuBtn.onclick = null; // Clear old
                userMenuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const dropdown = document.getElementById('user-dropdown');
                    if (dropdown) dropdown.classList.toggle('hidden');
                });
            }

            // Check if listener was already bound avoiding memory leaks
            if (!window._dropdownBlurListener) {
                document.addEventListener('click', () => {
                    const dropdown = document.getElementById('user-dropdown');
                    if (dropdown) dropdown.classList.add('hidden');
                });
                window._dropdownBlurListener = true;
            }
        } else {
            navUnauth.classList.remove('hidden');
            navAuth.classList.add('hidden');
        }
    },

    toggleMobileMenu: () => {
        const nav = document.getElementById('nav-content');
        const icon = document.getElementById('mobile-menu-icon');
        nav.classList.toggle('active');
        if (nav.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-xmark');
        } else {
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-bars');
        }
    },

    logout: () => {
        db.logout();
        app.navigate('landing');
    }
};

// ==========================================
// 3. AUTHENTICATION MODULE
// ==========================================
const authModule = {
    isSignup: false,

    setMode: (mode) => {
        authModule.isSignup = (mode === 'signup');
        document.getElementById('auth-title').textContent = authModule.isSignup ? langModule.t('Create Account') : langModule.t('Login');
        document.getElementById('btn-auth-submit').textContent = authModule.isSignup ? langModule.t('Create Account') : langModule.t('Login');
        document.getElementById('auth-error').classList.add('hidden');

        const toggleContainer = document.getElementById('auth-toggle-text');
        if (toggleContainer) {
            // Rebuild using the safe ID structure without inline onclicks
            if (authModule.isSignup) {
                toggleContainer.innerHTML = `<span data-i18n="Already have an account?">${langModule.t('Already have an account?')}</span> <span class="text-primary hover-underline cursor-pointer font-bold" id="auth-toggle-btn" data-i18n="Login">${langModule.t('Login')}</span>`;
            } else {
                toggleContainer.innerHTML = `<span data-i18n="No account yet?">${langModule.t('No account yet?')}</span> <span class="text-primary hover-underline cursor-pointer font-bold" id="auth-toggle-btn" data-i18n="Create Account">${langModule.t('Create Account')}</span>`;
            }

            // Re-bind listener because we just destroyed the DOM element with innerHTML
            const authToggleBtn = document.getElementById('auth-toggle-btn');
            if (authToggleBtn) {
                authToggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    authModule.toggleMode();
                });
            }
        }
    },

    toggleMode: () => {
        authModule.setMode(authModule.isSignup ? 'login' : 'signup');
    },

    submit: () => {
        const em = document.getElementById('auth-email').value.trim();
        const pwd = document.getElementById('auth-pass').value.trim();
        const err = document.getElementById('auth-error');

        if (!em || !pwd) {
            err.textContent = langModule.t("Please fill in all fields.");
            err.classList.remove('hidden'); return;
        }

        let success;
        if (authModule.isSignup) {
            success = db.createUser(em, pwd);
            if (!success) { err.textContent = langModule.t("Email already registered."); err.classList.remove('hidden'); return; }
        } else {
            success = db.login(em, pwd);
            if (!success) { err.textContent = langModule.t("Invalid email or password."); err.classList.remove('hidden'); return; }
        }

        // Success - clean forms and route
        document.getElementById('auth-email').value = '';
        document.getElementById('auth-pass').value = '';
        app.navigate('dashboard');
    }
};

// ==========================================
// ==========================================
// 4. THE WIZARD MODULE (DOM DRIVEN)
// ==========================================
const wizardModule = {
    current: 0,
    totalSteps: 9,
    data: {},

    init: () => {
        const user = db.getCurrentUser();
        // Restore step state from DB
        if (user && user.assessment_state && Object.keys(user.assessment_state.data).length > 0) {
            wizardModule.current = user.assessment_state.step;
            wizardModule.data = user.assessment_state.data;
        } else {
            wizardModule.current = 0;
            wizardModule.data = {};
        }

        // Restore physical radio checked statuses
        Object.keys(wizardModule.data).forEach(key => {
            if (key === 'allergies') {
                const val = wizardModule.data.allergies;
                if (val === 'none') {
                    const el = document.querySelector('input[name="allergies"][value="none"]');
                    if (el) el.checked = true;
                } else if (val) {
                    val.split(',').forEach(v => {
                        const el = document.querySelector(`input[name="allergies"][value="${v.trim()}"]`);
                        if (el) el.checked = true;
                    });
                }
                return;
            }
            const radio = document.querySelector(`input[name="${key}"][value="${wizardModule.data[key]}"]`);
            if (radio) radio.checked = true;
        });

        wizardModule.render();
    },

    render: () => {
        // Toggle strict .active / .hidden CSS Classes on DOM Steps
        const steps = document.querySelectorAll('.wizard-step');
        steps.forEach((step, index) => {
            if (index === wizardModule.current) {
                step.classList.add('active');
                step.classList.remove('hidden');
                step.style.display = 'block'; // Failsafe
            } else {
                step.classList.remove('active');
                step.classList.add('hidden');
                step.style.display = 'none'; // Failsafe
            }
        });

        // Update progress UI
        document.getElementById('step-counter').textContent = `${wizardModule.current + 1} / ${wizardModule.totalSteps}`;
        document.getElementById('wizard-progress').style.width = `${(wizardModule.current / wizardModule.totalSteps) * 100}%`;

        // Update Button Visibilities
        document.getElementById('btn-prev-step').style.visibility = wizardModule.current === 0 ? 'hidden' : 'visible';

        const nextBtn = document.getElementById('btn-next-step');
        if (wizardModule.current === wizardModule.totalSteps - 1) {
            nextBtn.innerHTML = `<span data-safe-i18n="Create Plan">${langModule.t('Create Plan')}</span> <i class="fa-solid fa-microchip ml-2"></i>`;
        } else {
            nextBtn.innerHTML = `<span data-safe-i18n="Next Step">${langModule.t('Next Step')}</span> <i class="fa-solid fa-angle-right ml-1"></i>`;
        }

        if (window.safeI18nApply) { window.safeI18nApply(); }
    },

    captureStep: () => {
        const currentStepEl = document.getElementById(`step-${wizardModule.current}`);
        if (!currentStepEl) return false;

        // Step 7: Allergies & Restrictions (checkboxes, optional)
        if (wizardModule.current === 7) {
            const checkboxes = currentStepEl.querySelectorAll('input[name="allergies"]:checked');
            const values = Array.from(checkboxes).map(c => c.value);
            if (values.includes('none') || values.length === 0) {
                wizardModule.data.allergies = 'none';
            } else {
                wizardModule.data.allergies = values.filter(v => v !== 'none').join(',');
            }
            return true;
        }

        const checked = currentStepEl.querySelector('input[type="radio"]:checked');
        if (checked) {
            wizardModule.data[checked.name] = checked.value;
            return true;
        }

        return false; // No selection made inside the active step card bounds
    },

    next: () => {
        if (!wizardModule.captureStep()) {
            alert(langModule.t('Please make a selection to proceed.'));
            return;
        }

        if (wizardModule.current < wizardModule.totalSteps - 1) {
            wizardModule.current++;
            db.saveAssessmentState(wizardModule.current, wizardModule.data);
            wizardModule.render();
        } else {
            // Final Step - Complete Assessment
            algorithm.generate(wizardModule.data);
        }
    },

    prev: () => {
        // Silently snag value when going backwards, don't throw fail alerts
        const currentStepEl = document.getElementById(`step-${wizardModule.current}`);
        if (currentStepEl) {
            const checked = currentStepEl.querySelector('input[type="radio"]:checked');
            if (checked) wizardModule.data[checked.name] = checked.value;
        }

        if (wizardModule.current > 0) {
            wizardModule.current--;
            wizardModule.render();
        }
    }
};

// ==========================================
// 5. THE AI GENERATION ALGORITHM
// ==========================================
const algorithm = {
    // ---- NEW AI GENERATION ENGINE ----
    generateAIProtocol: async (userProfile) => {
        // Construct the highly detailed System Prompt
        const systemPrompt = `
You are an elite, world-class fitness and nutrition coach. Your goal is to design a highly effective, personalized plan based on the user's profile.
You must adhere strictly to evidence-based principles, such as progressive overload, adequate recovery, and logical exercise sequencing (e.g., Push/Pull/Legs, Upper/Lower, or Full Body splits depending on frequency).

USER PROFILE:
${JSON.stringify(userProfile, null, 2)}

CRITICAL REQUIREMENT:
You must output the result ONLY in strict JSON format. Do NOT include any markdown formatting (like \`\`\`json), no introductory text, no conversational text, and no concluding text. Just the raw JSON object.

The JSON MUST exactly follow this structure:

WORKOUT PLAN RULES:
- EVERY day MUST include a specific "warmup" string (e.g., 5 min row, band work, dynamic stretches relevant to that day).
- EVERY exercise MUST include "rpe" (1-10, Rate of Perceived Exertion) and "tempo" (e.g., 3-1-X-1 for eccentric-pause-concentric-pause). Use "—" for tempo only on non-rep work (e.g., planks, cardio duration).

NUTRITION PLAN RULES:
- You MUST include "meal_timing" with both "pre_workout" and "post_workout" as specific, actionable advice (timing, carbs/protein, example foods).
- You MUST include "supplement_stack": an array of 3–5 evidence-based supplements tailored to the user's goal (e.g., fat loss: caffeine, protein; muscle gain: creatine, protein; recomp: creatine, omega-3, vitamin D). Each item: name, purpose, dose.

{
  "workout_plan": [
    {
      "day": "Day Name (e.g., Monday, Tuesday)",
      "focus": "Workout Focus (e.g., Upper Body Strength, Active Recovery)",
      "warmup": "Specific warm-up protocol for THIS day (required for every day)",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": "Number of sets (e.g., 3-4)",
          "reps": "Rep range (e.g., 8-12)",
          "rest": "Rest time (e.g., 90s)",
          "rpe": "RPE 1-10 (required for every exercise)",
          "tempo": "Tempo e.g. 3-1-X-1 (required; use — for holds/cardio)"
        }
      ]
    }
  ],
  "nutrition_plan": {
    "daily_calories": "Target calories (e.g., 2500 kcal)",
    "macros": {
      "protein": "Target protein (e.g., 180g)",
      "carbs": "Target carbs (e.g., 250g)",
      "fats": "Target fats (e.g., 70g)"
    },
    "guidelines": [
      "Rule 1 based on their dietary preference and goal",
      "Rule 2...",
      "Rule 3..."
    ],
    "meal_timing": {
      "pre_workout": "Specific pre-workout nutrition advice (timing, carbs/protein, examples)",
      "post_workout": "Specific post-workout nutrition advice (window, anabolic window, examples)"
    },
    "supplement_stack": [
      { "name": "Supplement name", "purpose": "Evidence-based reason", "dose": "e.g., 5g daily" }
    ]
  }
}`;

        console.log("--- GENERATED AI SYSTEM PROMPT ---");
        console.log(systemPrompt);
        console.log("----------------------------------");

        // Mock API Call Structure indicating where the actual fetch request goes
        try {
            console.log("Simulating API fetch request to AI Provider...");
            // const response = await fetch('https://api.openai.com/v1/chat/completions', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': 'Bearer YOUR_API_KEY'
            //     },
            //     body: JSON.stringify({
            //         model: 'gpt-4o', // or equivalent model
            //         messages: [{ role: 'system', content: systemPrompt }],
            //         temperature: 0.7,
            //         response_format: { type: 'json_object' }
            //     })
            // });
            // const aiResult = await response.json();
            // const parsedJSON = JSON.parse(aiResult.choices[0].message.content);
            // return parsedJSON;

            // Premium mock: multi-day workout plan + rich nutrition plan (warmup, RPE, tempo, meal timing, supplements)
            const mockParsedJSON = {
                "workout_plan": [
                    {
                        "day": "Monday",
                        "focus": "Upper Body Strength",
                        "warmup": "5 min row or bike; 2x10 band pull-aparts, 2x10 band dislocates; 1x8 empty bar bench, 1x8 bent-over row.",
                        "exercises": [
                            { "name": "Barbell Bench Press", "sets": "4", "reps": "5-8", "rest": "120s", "rpe": "8", "tempo": "3-1-X-1" },
                            { "name": "Bent-Over Barbell Row", "sets": "4", "reps": "6-10", "rest": "90s", "rpe": "8", "tempo": "3-1-X-1" },
                            { "name": "Overhead Dumbbell Press", "sets": "3", "reps": "8-12", "rest": "90s", "rpe": "7", "tempo": "3-0-X-1" },
                            { "name": "Pull-ups or Lat Pulldown", "sets": "3", "reps": "8-12", "rest": "90s", "rpe": "7", "tempo": "2-1-X-1" },
                            { "name": "Cable Tricep Pushdown", "sets": "3", "reps": "10-15", "rest": "60s", "rpe": "7", "tempo": "2-0-X-1" }
                        ]
                    },
                    {
                        "day": "Tuesday",
                        "focus": "Lower Body & Core",
                        "warmup": "5 min bike; leg swings 10/side, hip circles 10/side; 1x8 goblet squat, 1x8 RDL with light KB.",
                        "exercises": [
                            { "name": "Barbell Back Squat", "sets": "4", "reps": "5-8", "rest": "120s", "rpe": "8", "tempo": "3-1-X-1" },
                            { "name": "Romanian Deadlift", "sets": "3", "reps": "8-10", "rest": "90s", "rpe": "8", "tempo": "3-1-X-1" },
                            { "name": "Leg Press", "sets": "3", "reps": "10-12", "rest": "90s", "rpe": "7", "tempo": "3-0-X-1" },
                            { "name": "Leg Curl", "sets": "3", "reps": "10-12", "rest": "60s", "rpe": "7", "tempo": "2-1-X-1" },
                            { "name": "Plank", "sets": "3", "reps": "45-60s", "rest": "60s", "rpe": "6", "tempo": "—" }
                        ]
                    },
                    {
                        "day": "Wednesday",
                        "focus": "Active Recovery / Mobility",
                        "warmup": "5 min easy walk or bike; full-body dynamic stretch.",
                        "exercises": [
                            { "name": "Light Cardio (Bike or Walk)", "sets": "1", "reps": "20-30 min", "rest": "-", "rpe": "4", "tempo": "—" },
                            { "name": "Hip Mobility Flow", "sets": "2", "reps": "8-10 per side", "rest": "30s", "rpe": "3", "tempo": "—" },
                            { "name": "Shoulder Dislocates", "sets": "2", "reps": "10-15", "rest": "30s", "rpe": "3", "tempo": "—" },
                            { "name": "Cat-Cow Stretch", "sets": "2", "reps": "10", "rest": "30s", "rpe": "3", "tempo": "—" }
                        ]
                    },
                    {
                        "day": "Thursday",
                        "focus": "Push Focus (Chest & Shoulders)",
                        "warmup": "5 min row; band pull-aparts 2x15; 1x8 incline DB press light, 1x8 lateral raise light.",
                        "exercises": [
                            { "name": "Incline Dumbbell Press", "sets": "4", "reps": "8-10", "rest": "90s", "rpe": "8", "tempo": "3-1-X-1" },
                            { "name": "Dumbbell Flyes", "sets": "3", "reps": "10-12", "rest": "60s", "rpe": "7", "tempo": "3-0-X-1" },
                            { "name": "Seated Dumbbell Shoulder Press", "sets": "4", "reps": "8-10", "rest": "90s", "rpe": "8", "tempo": "3-0-X-1" },
                            { "name": "Lateral Raises", "sets": "3", "reps": "12-15", "rest": "60s", "rpe": "7", "tempo": "2-1-X-1" },
                            { "name": "Face Pulls", "sets": "3", "reps": "12-15", "rest": "60s", "rpe": "6", "tempo": "2-1-X-1" }
                        ]
                    },
                    {
                        "day": "Friday",
                        "focus": "Pull & Lower Body",
                        "warmup": "5 min bike; 2x8 cat-cow, 2x8 hip hinge; 1x5 deadlift with bar, 1x5 with 60% working weight.",
                        "exercises": [
                            { "name": "Conventional Deadlift", "sets": "4", "reps": "4-6", "rest": "120s", "rpe": "8", "tempo": "2-1-X-1" },
                            { "name": "Pull-ups or Assisted Pull-ups", "sets": "3", "reps": "6-10", "rest": "90s", "rpe": "8", "tempo": "2-1-X-1" },
                            { "name": "Cable Row", "sets": "3", "reps": "8-12", "rest": "90s", "rpe": "7", "tempo": "3-1-X-1" },
                            { "name": "Bulgarian Split Squat", "sets": "3", "reps": "8-10 per leg", "rest": "90s", "rpe": "7", "tempo": "3-0-X-1" },
                            { "name": "Barbell Curl", "sets": "3", "reps": "8-12", "rest": "60s", "rpe": "7", "tempo": "2-1-X-1" }
                        ]
                    }
                ],
                "nutrition_plan": {
                    "daily_calories": "2,200 kcal",
                    "macros": { "protein": "165g", "carbs": "220g", "fats": "73g" },
                    "guidelines": [
                        "Prioritize protein at every meal (aim for 25-40g per meal).",
                        "Eat whole foods 80% of the time; allow flexibility for the rest.",
                        "Stay hydrated: 2.5-3 L water daily, more on training days.",
                        "Time carbs around training for energy and recovery.",
                        "Include fiber-rich vegetables with lunch and dinner."
                    ],
                    "meal_timing": {
                        "pre_workout": "60–90 min before: 30–40g carbs + 15–20g protein (e.g. oats + banana + whey, or rice cakes + Greek yogurt). Caffeine optional 30–45 min pre (3–5 mg/kg).",
                        "post_workout": "Within 1–2 hours: 40–60g carbs + 25–40g protein. Example: chicken + rice + vegetables, or whey + banana + toast. Prioritize whole foods when possible."
                    },
                    "supplement_stack": [
                        { "name": "Creatine Monohydrate", "purpose": "Strength and lean mass; evidence-based for all goals.", "dose": "5 g daily (any time)." },
                        { "name": "Vitamin D3", "purpose": "Bone health, immunity, mood; especially if low sun exposure.", "dose": "2,000–4,000 IU with a fat-containing meal." },
                        { "name": "Omega-3 (EPA/DHA)", "purpose": "Recovery, joint health, body composition.", "dose": "2–3 g EPA+DHA combined daily." },
                        { "name": "Whey or Plant Protein", "purpose": "Convenient way to hit protein targets.", "dose": "1–2 scoops as needed to meet daily protein." }
                    ]
                }
            };
            return mockParsedJSON;
        } catch (error) {
            console.error("AI Generation failed:", error);
            return null;
        }
    },

    generate: async (data) => {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('active');

        // NEW LOGIC: Await the AI prompt engine and log the strictly formatted JSON
        console.log("Gathering user profile data for AI:", JSON.stringify(data, null, 2));
        const aiResult = await algorithm.generateAIProtocol(data);

        console.log("==========================================");
        console.log("🔥 FINAL AI GENERATED PROTOCOL (JSON) 🔥");
        console.log("==========================================");
        console.log(JSON.stringify(aiResult, null, 2));
        console.log("==========================================");
        // 1. Simulate sending the prompt to the AI and waiting for a response (1.5 seconds)
        setTimeout(() => {
            console.log("AI Response Received!");

            // 2. This is the generated workout (Mock Data) returned by the AI
            const aiWorkoutPlan = `
                <div class="active-workout-plan" style="background: rgba(255, 87, 34, 0.1); border-left: 4px solid #ff5722; padding: 15px; margin-top: 15px; border-radius: 4px;">
                    <h4 style="color: #fff; margin-bottom: 10px;">DAY 1: UPPER BODY FOCUS</h4>
                    <ul style="color: #aaa; list-style: none; padding-left: 0;">
                        <li style="margin-bottom: 8px;"><strong>1. Barbell Bench Press</strong>: 4 sets x 8-10 reps (90s rest)</li>
                        <li style="margin-bottom: 8px;"><strong>2. Pull-ups</strong>: 3 sets x 8-12 reps (90s rest)</li>
                        <li style="margin-bottom: 8px;"><strong>3. Overhead Dumbbell Press</strong>: 3 sets x 10-12 reps (60s rest)</li>
                    </ul>
                    <hr style="border-color: #333; margin: 15px 0;">
                    <h4 style="color: #fff; margin-bottom: 10px;">DAY 2: LOWER BODY FOCUS</h4>
                    <ul style="color: #aaa; list-style: none; padding-left: 0;">
                        <li style="margin-bottom: 8px;"><strong>1. Barbell Squats</strong>: 4 sets x 6-8 reps (120s rest)</li>
                        <li style="margin-bottom: 8px;"><strong>2. Romanian Deadlifts</strong>: 3 sets x 10-12 reps (90s rest)</li>
                    </ul>
                </div>
            `;

            // 3. Hide the assessment view and show the final dashboard
            const assessmentView = document.getElementById('assessment-view');
            const dashboardView = document.getElementById('dashboard-view');

            if (assessmentView) assessmentView.classList.add('hidden');
            if (dashboardView) dashboardView.classList.remove('hidden');

            // 4. Replace "Pending your assessment." with the actual workout plan in the Dashboard
            if (dashboardView) {
                dashboardView.innerHTML = dashboardView.innerHTML.replace(
                    'Pending your assessment.',
                    aiWorkoutPlan
                );
            }

            console.log("Dashboard successfully updated with AI Protocol!");
        }, 1500); // End of setTimeout simulation
        let p = 0;
        const bar = document.getElementById('cyber-progress-bar');
        const txt = document.getElementById('loading-text');
        const logs = [langModule.t("Analyzing your profile..."), langModule.t("Calculating nutrition targets..."), langModule.t("Building your workout plan..."), langModule.t("Finalizing your personal plan...")];
        let l = 0;

        const int = setInterval(() => {
            p += 2;
            bar.style.width = p + '%';
            if (p % 25 === 0 && l < logs.length) { txt.textContent = logs[l]; l++; }

            if (p >= 100) {
                clearInterval(int);
                const protocol = algorithm.compile(data);

                // Inject the AI JSON structure into the protocol for dashboard rendering
                if (aiResult) {
                    protocol.aiResult = aiResult;
                }

                db.saveNewProtocol(protocol);
                db.clearAssessmentState();

                setTimeout(() => {
                    overlay.classList.remove('active');
                    app.navigate('dashboard');
                }, 800);
            }
        }, 30);
    },

    compile: (a) => {
        // Fallback generic values since text inputs (age/weight) are removed in favor of strict 8-step cards
        let tdee = a.activity === 'highly' ? 3000 : (a.activity === 'moderate' ? 2500 : 2000);
        let calories = a.weight_goal === 'lose' ? tdee - 500 : (a.weight_goal === 'gain' ? tdee + 300 : tdee);

        const protein = a.weight_goal === 'lose' ? 180 : 160;

        const protocol = {
            meta: { goal: a.primary_goal || 'recomp', tier: (a.experience || 'beginner').toUpperCase(), days: a.days || '3', style: (a.equipment || 'minimal').toUpperCase() },
            nutrition: {
                cals: calories, pro: protein,
                carbs: Math.round((calories * 0.4) / 4), fats: Math.round((calories * 0.25) / 9),
                diet: a.diet || 'balanced', structure: 'Flexible'
            },
            training: [], recovery: []
        };

        // Build Training Arrays
        let numDays = parseInt(a.days || 3);
        const isBg = langModule.currentLanguage === 'bg';
        const dayNames = isBg ? ['ПОНЕДЕЛНИК', 'ВТОРНИК', 'СРЯДА', 'ЧЕТВЪРТЪК', 'ПЕТЪК', 'СЪБОТА', 'НЕДЕЛЯ'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        for (let i = 0; i < numDays; i++) {
            let n = i % 2 === 0 ? (isBg ? "Тренировка" : "Training Session") : (isBg ? 'Активно възстановяване' : 'Active Recovery');
            let descKey = i === 0
                ? (isBg ? `Фокус: ${a.primary_goal}` : `Focusing on ${a.primary_goal}`)
                : (isBg ? "Подобрявайте формата си." : "Build up your fitness.");

            protocol.training.push({
                day: dayNames[i] || `Day ${i + 1}`,
                name: n,
                desc: descKey
            });
        }

        // Build Recovery Arrays
        const sleep = a.activity === 'highly' ? '8.5' : '7.5';
        protocol.recovery.push(isBg ? `Стремете се към ~${sleep} часа качествен сън.` : `Aim for ${sleep} hours of quality sleep.`);
        protocol.recovery.push(isBg ? `Ежедневна подвижност: ~10 мин разтягане.` : `Daily mobility: 10 mins dedicated stretching.`);

        return protocol;
    }
};

// ==========================================
// 5.5 ACCORDION MODULE (collapsible + scroll-into-view)
// ==========================================
const accordionModule = {
    bind: (container = null) => {
        const root = container || document.getElementById('view-dashboard');
        if (!root) return;

        const triggers = root.querySelectorAll('.accordion-trigger');
        triggers.forEach(trigger => {
            const id = trigger.getAttribute('data-accordion-id');
            if (!id) return;

            const card = document.getElementById(id);
            if (!card) return;

            const open = () => {
                const wasClosed = card.classList.contains('is-closed');
                card.classList.remove('is-closed');
                card.classList.add('is-open');
                trigger.setAttribute('aria-expanded', 'true');
                if (wasClosed) {
                    const body = card.querySelector('.accordion-body');
                    if (body) {
                        body.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            };

            const close = () => {
                card.classList.add('is-closed');
                card.classList.remove('is-open');
                trigger.setAttribute('aria-expanded', 'false');
            };

            const toggle = () => {
                if (card.classList.contains('is-closed')) {
                    open();
                } else {
                    close();
                }
            };

            trigger.addEventListener('click', (e) => {
                e.preventDefault();
                toggle();
            });

            trigger.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            });
        });
    },

    initDashboardAccordions: () => {
        const view = document.getElementById('view-dashboard');
        if (!view) return;

        view.querySelectorAll('.accordion-card').forEach(card => {
            if (!card.classList.contains('is-closed')) {
                card.classList.add('is-open');
            }
        });
        accordionModule.bind();
    }
};

// ==========================================
// 6. DASHBOARD & UI ORCHESTRATION
// ==========================================
const dashModule = {
    render: () => {
        const user = db.getCurrentUser();
        if (!user) return;

        // Render Resume logic in Onboarding view
        const obSlot = document.getElementById('resume-assessment-slot');
        if (user.assessment_state && user.assessment_state.step > 0) {
            obSlot.innerHTML = `<button class="btn btn-outline btn-large w-full mt-4 font-mono uppercase text-xs tracking-widest" onclick="app.navigate('assessment')"><span data-i18n="Resume Step">Resume Step</span> ${user.assessment_state.step + 1}</button>`;
        } else {
            obSlot.innerHTML = '';
        }

        // Ensure new dynamically added translations are processed
        if (langModule && langModule.applyTranslations) {
            langModule.applyTranslations();
        }

        // Dashboard Sidebar Header
        document.getElementById('dash-username').textContent = user.email.split('@')[0];
        document.getElementById('dash-avatar').textContent = user.email.substring(0, 2).toUpperCase();

        if (user.active_protocol) {
            const p = user.active_protocol;

            const safeT = window.safeI18nT || langModule.t;
            // Populate Protocol Context
            const titleMap = { fat_loss: safeT("PLAN: FAT LOSS"), muscle_gain: safeT("PLAN: BUILD MUSCLE"), recomp: safeT("PLAN: BODY RECOMPOSITION"), military: safeT("PLAN: OVERALL FITNESS") };
            document.getElementById('dash-mission-type').textContent = titleMap[p.meta.goal];
            document.getElementById('dash-tier').textContent = safeT(p.meta.tier) + " " + safeT("LEVEL");
            document.getElementById('res-training-style').textContent = safeT(p.meta.style);

            // Profile Stats
            document.getElementById('res-profile-stats').innerHTML = `
                <div class="stat-item"><span class="stat-label" data-safe-i18n="Frequency">${safeT("Frequency")}</span><span class="stat-value"><i class="fa-solid fa-calendar-day text-primary mr-1 text-xs"></i> ${p.meta.days} ${safeT("Days / Wk")}</span></div>
                <div class="stat-item"><span class="stat-label" data-safe-i18n="Status">${safeT("Status")}</span><span class="stat-value text-success"><i class="fa-solid fa-check text-success mr-1 text-xs"></i> ${safeT("Active")}</span></div>
                <div class="stat-item"><span class="stat-label" data-safe-i18n="Deploy Date">${safeT("Deploy Date")}</span><span class="stat-value">${p.created_at}</span></div>
            `;

            // Determine if we have an AI JSON Protocol to render
            if (p.aiResult) {
                // Remove Pending Assessment message
                const pendingEl = document.querySelector('#dash-mission-type').nextElementSibling;
                if (pendingEl) pendingEl.style.display = 'none';

                // Render AI Nutrition Plan (dynamic rich HTML — no static "Calculating...")
                if (p.aiResult.nutrition_plan) {
                    const aiN = p.aiResult.nutrition_plan;
                    const calories = (aiN.daily_calories && !String(aiN.daily_calories).toLowerCase().includes('calculating') && !String(aiN.daily_calories).toLowerCase().includes('tbd'))
                        ? aiN.daily_calories
                        : (p.nutrition ? `${p.nutrition.cals} kcal` : '—');
                    const pro = (aiN.macros && aiN.macros.protein && !String(aiN.macros.protein).toLowerCase().includes('tbd')) ? aiN.macros.protein : (p.nutrition ? `${p.nutrition.pro}g` : '—');
                    const carb = (aiN.macros && aiN.macros.carbs && !String(aiN.macros.carbs).toLowerCase().includes('tbd')) ? aiN.macros.carbs : (p.nutrition ? `${p.nutrition.carbs}g` : '—');
                    const fat = (aiN.macros && aiN.macros.fats && !String(aiN.macros.fats).toLowerCase().includes('tbd')) ? aiN.macros.fats : (p.nutrition ? `${p.nutrition.fats}g` : '—');
                    document.getElementById('res-macros').innerHTML = `
                        <div class="macro-box"><div class="val text-primary break-all text-sm">${calories}</div><div class="lbl">KCAL</div></div>
                        <div class="macro-box"><div class="val">${pro}</div><div class="lbl">PRO</div></div>
                        <div class="macro-box"><div class="val">${carb}</div><div class="lbl">CARB</div></div>
                        <div class="macro-box"><div class="val">${fat}</div><div class="lbl">FAT</div></div>
                    `;
                    const guidelines = (aiN.guidelines && Array.isArray(aiN.guidelines) && aiN.guidelines.length) ? aiN.guidelines : [];
                    let nutritionHtml = guidelines.length
                        ? `<div class="text-[0.65rem] uppercase tracking-widest text-primary font-bold mb-2">${safeT("Guidelines")}</div><ul class="protocol-list font-mono text-sm">${guidelines.map(g => `<li><i class="fa-solid fa-check text-primary"></i> ${safeT(g)}</li>`).join('')}</ul>`
                        : `<p class="text-secondary text-sm font-mono">${safeT("Focus on whole foods and hit your macro targets above.")}</p>`;

                    // Meal Timing (pre/post workout) — always show; use AI data or evidence-based fallback
                    const mealTiming = aiN.meal_timing;
                    const preText = mealTiming && mealTiming.pre_workout ? mealTiming.pre_workout : (langModule.currentLanguage === 'bg' ? '60–90 мин преди: въглехидрати + протеин (напр. овес, банан, протеин). Кафеин по избор 30–45 мин преди.' : '60–90 min before: carbs + protein (e.g. oats, banana, whey). Caffeine optional 30–45 min pre.');
                    const postText = mealTiming && mealTiming.post_workout ? mealTiming.post_workout : (langModule.currentLanguage === 'bg' ? 'В рамките на 1–2 часа: 40–60g въглехидрати + 25–40g протеин. Пример: пиле + ориз + зеленчуци или протеин + банан.' : 'Within 1–2 hours: 40–60g carbs + 25–40g protein. Example: chicken + rice + vegetables, or whey + banana + toast.');
                    nutritionHtml += `<div class="mt-4 pt-4 border-t border-border-light"><div class="text-[0.65rem] uppercase tracking-widest text-primary font-bold mb-2">Meal Timing</div><ul class="protocol-list font-mono text-sm"><li><i class="fa-solid fa-clock text-primary"></i> <strong class="text-secondary">Pre-workout:</strong> ${safeT(preText)}</li><li><i class="fa-solid fa-clock text-primary"></i> <strong class="text-secondary">Post-workout:</strong> ${safeT(postText)}</li></ul></div>`;

                    // Recommended Supplement Stack — always show; use AI data or goal-based evidence-based fallback
                    let supplementStack = aiN.supplement_stack && Array.isArray(aiN.supplement_stack) ? aiN.supplement_stack : [];
                    if (supplementStack.length === 0) {
                        const goal = (p.meta && p.meta.goal) ? p.meta.goal : 'recomp';
                        const stacks = {
                            fat_loss: [
                                { name: 'Caffeine', purpose: 'Performance and focus; supports fat oxidation.', dose: '3–5 mg/kg 30–45 min pre-workout.' },
                                { name: 'Whey or Plant Protein', purpose: 'Preserve muscle while in deficit.', dose: '1–2 scoops as needed.' },
                                { name: 'Vitamin D3', purpose: 'Immune and metabolic support.', dose: '2,000–4,000 IU daily with fat.' },
                                { name: 'Omega-3 (EPA/DHA)', purpose: 'Recovery and body composition.', dose: '2–3 g EPA+DHA daily.' }
                            ],
                            muscle_gain: [
                                { name: 'Creatine Monohydrate', purpose: 'Strength and lean mass; strong evidence.', dose: '5 g daily, any time.' },
                                { name: 'Whey or Plant Protein', purpose: 'Hit daily protein targets.', dose: '1–2 scoops as needed.' },
                                { name: 'Vitamin D3', purpose: 'Bone health, immunity.', dose: '2,000–4,000 IU daily.' },
                                { name: 'Omega-3 (EPA/DHA)', purpose: 'Recovery and joint health.', dose: '2–3 g EPA+DHA daily.' }
                            ],
                            recomp: [
                                { name: 'Creatine Monohydrate', purpose: 'Strength and lean mass.', dose: '5 g daily.' },
                                { name: 'Vitamin D3', purpose: 'Health and performance.', dose: '2,000–4,000 IU daily.' },
                                { name: 'Omega-3 (EPA/DHA)', purpose: 'Recovery and body composition.', dose: '2–3 g EPA+DHA daily.' },
                                { name: 'Whey or Plant Protein', purpose: 'Convenient protein to hit targets.', dose: '1–2 scoops as needed.' }
                            ],
                            military: [
                                { name: 'Vitamin D3', purpose: 'Healthspan and immunity.', dose: '2,000–4,000 IU daily.' },
                                { name: 'Omega-3 (EPA/DHA)', purpose: 'Recovery and longevity.', dose: '2–3 g EPA+DHA daily.' },
                                { name: 'Creatine Monohydrate', purpose: 'Strength and cognitive support.', dose: '5 g daily.' },
                                { name: 'Protein (optional)', purpose: 'Convenience for daily protein.', dose: 'As needed.' }
                            ]
                        };
                        supplementStack = stacks[goal] || stacks.recomp;
                    }
                    nutritionHtml += `<div class="mt-4 pt-4 border-t border-border-light"><div class="text-[0.65rem] uppercase tracking-widest text-primary font-bold mb-2">Recommended Supplement Stack</div><ul class="protocol-list font-mono text-sm">`;
                    supplementStack.forEach(s => {
                        const name = s.name || '';
                        const purpose = s.purpose || '';
                        const dose = s.dose || '';
                        nutritionHtml += `<li><i class="fa-solid fa-capsules text-primary"></i> <strong class="text-primary">${safeT(name)}</strong> — ${safeT(purpose)} <span class="text-muted">(${safeT(dose)})</span></li>`;
                    });
                    nutritionHtml += `</ul></div>`;

                    document.getElementById('res-nutrition-plan').innerHTML = nutritionHtml;
                }

                // Render AI Training Plan (every day: warm-up protocol at top + exercises with RPE & Tempo)
                if (p.aiResult.workout_plan) {
                    let aiHtml = '';
                    const defaultWarmup = langModule.currentLanguage === 'bg' ? '5 мин леко кардио; динамично разтягане за работещите мускулни групи.' : '5 min light cardio; dynamic stretches for the muscles you\'ll train today.';
                    p.aiResult.workout_plan.forEach((w, idx) => {
                        const warmupText = (w.warmup && String(w.warmup).trim()) ? w.warmup : defaultWarmup;
                        const warmupHtml = `<div class="text-[0.7rem] mb-3 p-2 rounded bg-surface-hover border border-border-light text-secondary"><span class="text-primary font-bold uppercase text-[0.65rem] tracking-widest block mb-1">Warm-up</span><span>${safeT(warmupText)}</span></div>`;

                        let exHtml = (w.exercises || []).map((e, exIdx) => {
                            const rpe = (e.rpe != null && e.rpe !== '') ? `RPE ${e.rpe}` : '';
                            const tempo = (e.tempo != null && e.tempo !== '' && e.tempo !== '—') ? `Tempo ${e.tempo}` : (e.tempo === '—' ? '—' : '');
                            const meta = [rpe, tempo].filter(Boolean).join(' · ');
                            const checkId = `ex-day-${idx}-${exIdx}`;
                            return `
                            <div class="exercise-row text-[0.7rem] mt-2 border-t border-border-light pt-2 text-secondary">
                                <input type="checkbox" class="exercise-checkbox" id="${checkId}" aria-label="${safeT("Mark exercise complete")}"/>
                                <label for="${checkId}" class="exercise-checkbox-custom" aria-hidden="true"></label>
                                <div class="exercise-content">
                                    <span class="text-primary font-bold block">${safeT(e.name)}</span>
                                    <span>${e.sets} ${safeT("sets")} | ${e.reps} | ${safeT("Rest")}: ${e.rest}</span>
                                    ${meta ? `<span class="block mt-1 text-muted font-mono text-[0.65rem]">${meta}</span>` : ''}
                                </div>
                            </div>
                        `;
                        }).join('');

                        const accordionId = `accordion-day-${idx}`;
                        aiHtml += `
                        <div class="day-card accordion-card is-open flex flex-col justify-start" id="${accordionId}" data-accordion-id="${accordionId}">
                            <div class="day-header accordion-trigger border-b border-border-light pb-2 mb-2 text-center text-xs tracking-widest" data-accordion-id="${accordionId}" tabindex="0" role="button" aria-expanded="true" aria-controls="${accordionId}-body">
                                <span>${safeT(w.day)}</span>
                                <i class="accordion-chevron fa-solid fa-chevron-down" aria-hidden="true"></i>
                            </div>
                            <div class="day-body accordion-body flex-grow" id="${accordionId}-body">
                                <div class="day-desc font-mono">
                                    <strong class="text-warning tracking-widest uppercase block text-center text-sm mb-3">${safeT(w.focus)}</strong>
                                    ${warmupHtml}
                                    <div>${exHtml}</div>
                                </div>
                            </div>
                        </div>`;
                    });
                    document.getElementById('res-training-plan').innerHTML = aiHtml;
                }
            } else {
                // Fallback rendering
                document.getElementById('res-macros').innerHTML = `
                    <div class="macro-box"><div class="val text-primary">${p.nutrition.cals}</div><div class="lbl">KCAL</div></div>
                    <div class="macro-box"><div class="val">${p.nutrition.pro}g</div><div class="lbl">PRO</div></div>
                    <div class="macro-box"><div class="val">${p.nutrition.carbs}g</div><div class="lbl">CARB</div></div>
                    <div class="macro-box"><div class="val">${p.nutrition.fats}g</div><div class="lbl">FAT</div></div>
                `;
                const dietTitles = { balanced: safeT("Balanced Nutrition"), keto: safeT("Keto Diet"), fasting: safeT("Intermittent Fasting") };
                const structTitles = { strict: safeT("Strict Tracking"), flexible: safeT("Flexible / Intuitive") };
                document.getElementById('res-nutrition-plan').innerHTML = `
                    <li><i class="fa-solid fa-check"></i> ${safeT("Diet")}: ${dietTitles[p.nutrition.diet] || safeT(p.nutrition.diet)}</li>
                    <li><i class="fa-solid fa-check"></i> ${safeT("Style")}: ${structTitles[p.nutrition.structure] || safeT(p.nutrition.structure)}</li>
                `;

                let modulesHtml = "";
                p.training.forEach((t, idx) => {
                    let translatedDesc = safeT(t.desc) || t.desc;
                    if (t.desc.startsWith('Focus on your main goal') || t.desc.includes('Фокус върху основната ви цел')) {
                        const weakMatch = t.desc.match(/\[(.*?)\]/);
                        const weak = weakMatch ? weakMatch[1] : 'core fitness';
                        translatedDesc = `${safeT('Focus on your main goal, especially')} [${safeT(weak)}].`;
                    } else if (t.desc.startsWith('Build up your fitness') || t.desc.includes('Подобрявайте формата си')) {
                        translatedDesc = safeT('Build up your fitness and track progress.');
                    }

                    const accordionId = `accordion-day-${idx}`;
                    modulesHtml += `
                    <div class="day-card accordion-card is-open" id="${accordionId}" data-accordion-id="${accordionId}">
                        <div class="day-header accordion-trigger" data-accordion-id="${accordionId}" tabindex="0" role="button" aria-expanded="true" aria-controls="${accordionId}-body">
                            <span>${safeT(t.day)}</span>
                            <i class="accordion-chevron fa-solid fa-chevron-down" aria-hidden="true"></i>
                        </div>
                        <div class="day-body accordion-body" id="${accordionId}-body">
                            <div class="day-desc font-mono">
                                <strong class="text-primary tracking-widest uppercase">${safeT(t.name)}</strong><br>
                                <span class="text-xs uppercase mt-2 block opacity-80">${translatedDesc}</span>
                            </div>
                            <div class="mt-4"><span class="day-stat-chip"><i class="fa-solid fa-circle text-primary text-[0.45rem]"></i> ${safeT("To Do")}</span></div>
                        </div>
                    </div>`;
                });
                document.getElementById('res-training-plan').innerHTML = modulesHtml;
            }
            accordionModule.bind();
        }

        // Populate Telemetry History
        dashModule.renderTelemetry(user);

        // Populate Plan History
        dashModule.renderHistory(user);

        // Reset tabs
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.sidebar-link[data-tab="active-protocol"]')?.classList.add('active');
        document.getElementById('tab-active-protocol')?.classList.add('active');
    },

    renderTelemetry: (user) => {
        let avgW = 0, avgA = 0, avgE = 0, avgS = 0, avgWC = 0;
        let html = '';
        const len = user.telemetry.length;

        user.telemetry.forEach(t => {
            if (html === '') avgW = t.weight; // latest weight
            avgA += parseInt(t.adherence) || 0;
            avgE += parseInt(t.energy) || 0;
            avgS += parseInt(t.sleep) || 0;
            avgWC += parseInt(t.workouts) || 0;

            const waistStr = t.waist ? `${t.waist} cm` : '-';
            const sleepStr = t.sleep ? `${t.sleep}/10` : '-';
            const workStr = t.workouts ? `${t.workouts}%` : '-';

            const safeT = window.safeI18nT || langModule.t;
            html += `<tr>
                <td>${t.date}</td>
                <td>${t.weight} ${safeT("kg")}</td>
                <td>${waistStr}</td>
                <td>${t.adherence}%</td>
                <td>${workStr}</td>
                <td>${t.energy}/10</td>
                <td>${sleepStr}</td>
                <td>${t.notes || '-'}</td>
            </tr>`;
        });

        const tb = document.getElementById('checkin-tbody');
        const empty = document.getElementById('checkin-empty');

        if (len > 0) {
            tb.innerHTML = html;
            empty.classList.add('hidden');

            const realA = Math.round(avgA / len);
            const realE = (avgE / len).toFixed(1);
            const realS = (avgS / len).toFixed(1);
            const realWC = Math.round(avgWC / len);

            document.getElementById('tracker-weight').textContent = avgW;
            document.getElementById('tracker-adherence').textContent = realA;
            document.getElementById('tracker-energy').textContent = realE;

            // Trend bars visually simulated
            setTimeout(() => {
                document.getElementById('tracker-adh-bar').style.width = `${realA}%`;
                document.getElementById('tracker-eng-bar').style.width = `${(realE / 10) * 100}%`;
                // Colors based on performance
                document.getElementById('tracker-adh-bar').style.backgroundColor = realA > 85 ? 'var(--success)' : (realA > 70 ? 'var(--warning)' : 'var(--danger)');
            }, 500);

            const safeT = window.safeI18nT || langModule.t;
            // Update placeholder box on Active protocol 
            document.querySelector('.border-dashed').innerHTML = `
                <div>
                    <i class="fa-solid fa-radar text-primary text-3xl mb-2"></i>
                    <h4 class="text-xs font-bold uppercase text-primary font-mono tracking-widest mt-2"><span data-safe-i18n="Overall Consistency">${safeT("Overall Consistency")}</span>: ${Math.round((realA + realWC) / 2) || realA}%</h4>
                    <p class="text-[0.65rem] text-muted mt-1 uppercase font-mono tracking-widest"><span data-safe-i18n="Diet">${safeT("Diet")}</span>: ${realA}% | <span data-safe-i18n="Training">${safeT("Training")}</span>: ${realWC}%</p>
                </div>
            `;
        } else {
            tb.innerHTML = '';
            empty.classList.remove('hidden');
        }
    },

    renderHistory: (user) => {
        let html = '';
        const safeT = window.safeI18nT || langModule.t;
        user.history.forEach((h, i) => {
            const titleMap = { fat_loss: safeT("PLAN: FAT LOSS"), muscle_gain: safeT("PLAN: BUILD MUSCLE"), recomp: safeT("PLAN: BODY RECOMPOSITION"), military: safeT("PLAN: OVERALL FITNESS") };
            html += `
            <div class="history-card">
                <div>
                    <span class="badge mb-2">${safeT("ARCHIVED")}</span>
                    <h4 class="text-xl font-heading font-black tracking-widest">${titleMap[h.meta.goal]}</h4>
                    <p class="text-secondary text-xs uppercase font-mono mt-1">${safeT("Deployed")}: ${h.created_at}</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <span class="day-stat-chip">${safeT("Level")}: ${safeT(h.meta.tier)}</span>
                    <span class="day-stat-chip">${h.nutrition.cals} ${safeT("kcal limit")}</span>
                </div>
            </div>`;
        });

        const grid = document.getElementById('history-grid');
        grid.innerHTML = html || `<p class="text-muted font-mono uppercase text-sm" data-safe-i18n="[ No previous plans found ]">${safeT('[ No previous plans found ]')}</p>`;
    },

    switchTab: (tabId, event) => {
        if (event) event.preventDefault();
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        if (event) event.currentTarget.classList.add('active');

        document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tabId}`).classList.add('active');
    },

    submitCheckin: () => {
        const w = document.getElementById('checkin-val-weight').value;
        const waist = document.getElementById('checkin-val-waist').value;
        const adherence = document.getElementById('checkin-val-adherence').value;
        const workouts = document.getElementById('checkin-val-workouts').value;
        const energy = document.getElementById('checkin-val-energy').value;
        const sleep = document.getElementById('checkin-val-sleep').value;
        const notes = document.getElementById('checkin-val-notes').value;

        if (!w || !adherence || !workouts || !energy || !sleep) {
            alert(langModule.t('Core telemetry indices required for submission.'));
            return;
        }

        db.saveTelemetry({
            weight: w,
            waist: waist,
            adherence: adherence,
            workouts: workouts,
            energy: energy,
            sleep: sleep,
            notes: notes
        });

        // Reset and close
        document.getElementById('checkin-val-weight').value = '';
        document.getElementById('checkin-val-waist').value = '';
        document.getElementById('checkin-val-adherence').value = '';
        document.getElementById('checkin-val-workouts').value = '';
        document.getElementById('checkin-val-notes').value = '';
        document.getElementById('modal-checkin').classList.remove('active');

        dashModule.render(); // re-render to plot trends
    }
};

// ==========================================
// 7. BOOTSTRAP & EVENTS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(err => {
                console.log('SW registration failed: ', err);
            });
        });
    }

    db.init();
    langModule.init();

    // Set active class on initial loader
    const activeBtn = document.getElementById(`lang-btn-${langModule.currentLanguage}`);
    if (activeBtn) activeBtn.classList.add('text-primary', 'font-bold');

    // Modals Close handlers
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.remove('active');
        });
    });

    // ==========================================
    // EXPLICIT, SAFE EVENT LISTENERS (Null-checked)
    // ==========================================

    // --- Navigation & Routing ---
    const navBrandLogo = document.getElementById('nav-brand-logo');
    if (navBrandLogo) navBrandLogo.addEventListener('click', (e) => { e.preventDefault(); app.navigate('landing'); });

    const navMobileLogin = document.getElementById('nav-mobile-login');
    if (navMobileLogin) navMobileLogin.addEventListener('click', (e) => { e.preventDefault(); app.navigate('auth', 'login'); });

    const heroLoginBtn = document.getElementById('hero-login-btn');
    if (heroLoginBtn) heroLoginBtn.addEventListener('click', (e) => { e.preventDefault(); app.navigate('auth', 'login'); });

    const navMobileSignup = document.getElementById('nav-mobile-signup');
    if (navMobileSignup) navMobileSignup.addEventListener('click', (e) => { e.preventDefault(); app.navigate('auth', 'signup'); });

    const heroStartBtn = document.getElementById('hero-start-btn');
    if (heroStartBtn) heroStartBtn.addEventListener('click', (e) => { e.preventDefault(); app.navigate('auth', 'signup'); });

    const navUserDashboard = document.getElementById('nav-user-dashboard');
    if (navUserDashboard) navUserDashboard.addEventListener('click', (e) => { e.preventDefault(); app.navigate('dashboard'); });

    const assessmentPauseBtn = document.getElementById('assessment-pause-btn');
    if (assessmentPauseBtn) assessmentPauseBtn.addEventListener('click', (e) => { e.preventDefault(); app.navigate('dashboard'); });

    const navUserAssessment = document.getElementById('nav-user-assessment');
    if (navUserAssessment) navUserAssessment.addEventListener('click', (e) => { e.preventDefault(); app.navigate('assessment'); });

    const onboardingStartBtn = document.getElementById('onboarding-start-btn');
    if (onboardingStartBtn) onboardingStartBtn.addEventListener('click', (e) => { e.preventDefault(); app.navigate('assessment'); });

    const sidebarRetakeBtn = document.getElementById('sidebar-retake-btn');
    if (sidebarRetakeBtn) sidebarRetakeBtn.addEventListener('click', (e) => { e.preventDefault(); app.navigate('assessment'); });

    const navUserLogout = document.getElementById('nav-user-logout');
    if (navUserLogout) navUserLogout.addEventListener('click', (e) => { e.preventDefault(); app.logout(); });

    // --- Language & Menu ---
    const langBtnEn = document.getElementById('lang-btn-en');
    if (langBtnEn) langBtnEn.addEventListener('click', (e) => { e.preventDefault(); langModule.setLanguage('en'); });

    const langBtnBg = document.getElementById('lang-btn-bg');
    if (langBtnBg) langBtnBg.addEventListener('click', (e) => { e.preventDefault(); langModule.setLanguage('bg'); });

    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', (e) => { e.preventDefault(); app.toggleMobileMenu(); });

    // --- Auth Module ---
    const authToggleBtn = document.getElementById('auth-toggle-btn');
    if (authToggleBtn) authToggleBtn.addEventListener('click', (e) => { e.preventDefault(); authModule.toggleMode(); });

    // --- Dashboard Tabs ---
    const tabBtnProtocol = document.getElementById('tab-btn-protocol');
    if (tabBtnProtocol) tabBtnProtocol.addEventListener('click', (e) => { e.preventDefault(); dashModule.switchTab('active-protocol', e); });

    const tabBtnProgress = document.getElementById('tab-btn-progress');
    if (tabBtnProgress) tabBtnProgress.addEventListener('click', (e) => { e.preventDefault(); dashModule.switchTab('progress-tracker', e); });

    const dashLogProgressBtn = document.getElementById('dash-log-progress-btn');
    if (dashLogProgressBtn) dashLogProgressBtn.addEventListener('click', (e) => { e.preventDefault(); dashModule.switchTab('progress-tracker', e); });

    const tabBtnHistory = document.getElementById('tab-btn-history');
    if (tabBtnHistory) tabBtnHistory.addEventListener('click', (e) => { e.preventDefault(); dashModule.switchTab('history', e); });

    // --- Modals ---
    const trackerLogBtn = document.getElementById('tracker-log-btn');
    if (trackerLogBtn) trackerLogBtn.addEventListener('click', (e) => { e.preventDefault(); toggleModal('modal-checkin', true); });

    const modalSaveLogBtn = document.getElementById('modal-save-log-btn');
    if (modalSaveLogBtn) modalSaveLogBtn.addEventListener('click', (e) => { e.preventDefault(); dashModule.submitCheckin(); });

    // --- Allergies step: "No restrictions" vs others mutually exclusive ---
    document.getElementById('wizard-form')?.addEventListener('change', (e) => {
        const target = e.target;
        if (target?.getAttribute('name') === 'allergies' && target.type === 'checkbox') {
            const noneCb = document.querySelector('input[name="allergies"][value="none"]');
            const allCbs = document.querySelectorAll('input[name="allergies"]');
            if (target.value === 'none' && target.checked) {
                allCbs.forEach(cb => { if (cb !== target) cb.checked = false; });
            } else if (target.value !== 'none' && target.checked && noneCb) {
                noneCb.checked = false;
            }
        }
    });

    // --- Wizard Navigation ---
    const btnNextStep = document.getElementById('btn-next-step');
    if (btnNextStep) btnNextStep.addEventListener('click', (e) => { e.preventDefault(); wizardModule.next(); });

    const btnPrevStep = document.getElementById('btn-prev-step');
    if (btnPrevStep) btnPrevStep.addEventListener('click', (e) => { e.preventDefault(); wizardModule.prev(); });

    // --- Form Submission ---
    const authForm = document.getElementById('auth-form');
    if (authForm) authForm.addEventListener('submit', (e) => { e.preventDefault(); authModule.submit(); });

    // Check auth to route properly
    const user = db.getCurrentUser();
    if (user) {
        if (user.active_protocol) app.navigate('dashboard');
        else app.navigate('onboarding');
    } else {
        app.navigate('landing');
    }
});

// ==========================================
// 8. TESTING: AI GENERATION PROTOCOL
// ==========================================
window.testAIProtocol = async () => {
    console.log("Starting AI Protocol Test...");

    // Create a mock user profile representing the 8 steps
    const mockProfile = {
        goal: "recomp", // 1. Training Goal (Recomposition)
        seriousness: "high", // Secondary: How dedicated
        experience: "intermediate", // 2. Experience Level
        fitness_level: 6,
        has_injuries: "no", // 3. Limitations
        stress: 5,
        recovery_ability: "average",
        days: "4", // 4. Days per Week
        session_duration: "60", // 5. Session Duration
        equipment: "full", // 6. Available Equipment
        style: "hybrid", // 7. Training Style 
        diet: "balanced", // 8. Nutrition Profile
        has_allergies: "no",
        meals_per_day: "3",
        budget: "medium", // Lifestyle & Habits
        hydration: "3",
        supplements: "basic",
        work_schedule: "standard", // Mindset & Tracking
        structure: "flexible"
    };

    console.log("Mock Profile Data:", mockProfile);

    // Call the AI Engine
    const result = await algorithm.generateAIProtocol(mockProfile);

    console.log("----------------------------------");
    console.log("AI SYSTEM RESPONSE (MOCK JSON):");
    console.log(JSON.stringify(result, null, 2));
    console.log("----------------------------------");

    if (result && result.workout_plan && result.nutrition_plan) {
        console.log("✅ Test Passed: Valid JSON structure returned containing workout_plan and nutrition_plan.");
    } else {
        console.error("❌ Test Failed: Invalid JSON structure or missing key elements.");
    }
};
