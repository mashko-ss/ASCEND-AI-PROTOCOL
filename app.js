/**
 * ASCEND AI PROTOCOL - Premium AI Fitness System
 * Architecture: Vanilla JS + Robust LocalStorage Simulation
 */

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
        if(user.active_protocol) {
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
            "Mon": "Mon",
            "Tue": "Tue",
            "Wed": "Wed",
            "Thu": "Thu",
            "Fri": "Fri",
            "Sat": "Sat",
            "Sun": "Sun",
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
        if(activeBtn) activeBtn.classList.add('text-primary', 'font-bold');
        
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
        window.scrollTo(0,0);
        
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
            document.getElementById('nav-avatar').textContent = user.email.substring(0,2).toUpperCase();
            document.getElementById('dropdown-email').textContent = user.email;
            
            // Setup Dropdown listener
            document.getElementById('user-menu-btn').onclick = (e) => {
                e.stopPropagation();
                document.getElementById('user-dropdown').classList.toggle('hidden');
            };
            document.addEventListener('click', () => document.getElementById('user-dropdown').classList.add('hidden'));
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
        
        const toggleTxt = document.getElementById('auth-toggle-text');
        if(authModule.isSignup) {
            toggleTxt.innerHTML = `<span data-i18n="Already have an account?">${langModule.t('Already have an account?')}</span> <span class="text-primary hover-underline cursor-pointer font-bold" onclick="authModule.toggleMode()" data-i18n="Login">${langModule.t('Login')}</span>`;
        } else {
            toggleTxt.innerHTML = `<span data-i18n="No account yet?">${langModule.t('No account yet?')}</span> <span class="text-primary hover-underline cursor-pointer font-bold" onclick="authModule.toggleMode()" data-i18n="Create Account">${langModule.t('Create Account')}</span>`;
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
// 4. THE 9-STEP MATRIX MODULE
// ==========================================
const questions = [
    {
        step: 0, id: 'profile', title: 'Basic Information',
        fields: [
            { id: 'age', type: 'number', label: 'Age', placeholder: 'e.g. 30' },
            { id: 'sex', type: 'radio', cols: 2, label: 'Gender', options: [{val:'m', label:'Male', icon:'fa-mars'}, {val:'f', label:'Female', icon:'fa-venus'}] },
            { id: 'weight', type: 'number', label: 'Weight (kg)', placeholder: 'e.g. 82' },
            { id: 'height', type: 'number', label: 'Height (cm)', placeholder: 'e.g. 178' },
            { id: 'activity', type: 'radio', cols: 1, label: 'Activity Level', options: [
                {val:'sedentary', label:'Mostly sitting / little movement'}, 
                {val:'light', label:'Light activity (walking, light workouts)'},
                {val:'moderate', label:'Regular workouts or active job'},
                {val:'active', label:'Hard training or physical work'}
            ]}
        ]
    },
    {
        step: 1, id: 'goal', title: 'Your Goal',
        fields: [
            { id: 'primary_goal', type: 'radio', cols: 2, label: 'Primary Focus', options: [
                {val:'fat_loss', label:'Fat Loss', subtext:'Lose fat while preserving muscle.', icon:'fa-temperature-arrow-down'},
                {val:'muscle_gain', label:'Build Muscle', subtext:'Gain muscle and strength.', icon:'fa-cubes'},
                {val:'recomp', label:'Recomposition', subtext:'Lose fat and gain muscle at the same time.', icon:'fa-scale-unbalanced'},
                {val:'longevity', label:'Health & Longevity', subtext:'Optimize healthspan and vitality.', icon:'fa-heart-pulse'}
            ]},
            { id: 'secondary_goal', type: 'chips', label: 'Secondary Objectives', options: [
                'Raw Strength', 'Better Stamina', 'Power & Speed', 'Move Better', 'Mental Toughness', 'Aesthetics'
            ]},
            { id: 'seriousness', type: 'radio', cols: 1, label: 'How Dedicated Are You?', options: [
                {val:'low', label:'Just getting started'},
                {val:'medium', label:'I can train regularly'},
                {val:'high', label:'Very serious about my results'}
            ]}
        ]
    },
    {
        step: 2, id: 'background', title: 'Experience & Capability',
        fields: [
            { id: 'experience', type: 'radio', cols: 1, label: 'Training Experience', options: [
                {val:'beginner', label:'Beginner', subtext:'New to training, learning the basics.', icon:'fa-chevron-up'},
                {val:'intermediate', label:'Intermediate', subtext:'Consistent training for a few months.', icon:'fa-angles-up'},
                {val:'advanced', label:'Advanced', subtext:'Several years of training experience.', icon:'fa-star'}
            ]},
            { id: 'fitness_level', type: 'slider', label: 'Current Fitness Level (1-10)', min: 1, max: 10, default: 5 },
            { id: 'weakness', type: 'chips', label: 'Areas for Improvement', options: [
                'Lose Body Fat', 'Build Muscle', 'Increase Strength', 'Improve Energy', 'Better Sleep', 'Reduce Stress', 'Improve Posture', 'Move With Less Pain'
            ]}
        ]
    },
    {
        step: 3, id: 'limitations', title: 'Recovery & Limitations',
        fields: [
            { id: 'has_injuries', type: 'radio', cols: 2, label: 'Do you have any current injuries?', options: [
                {val:'no', label:'No', icon:'fa-check'}, {val:'yes', label:'Yes', icon:'fa-triangle-exclamation'}
            ]},
            { id: 'injuries', type: 'chips', label: 'Select Injuries/Limitations', condition: (d) => d.has_injuries === 'yes', options: [
                'Lower Back / Spine', 'Knees', 'Shoulders', 'Wrist/Elbow', 'Hips', 'Ankles'
            ]},
            { id: 'stress', type: 'slider', label: 'Daily Stress Level (1-10)', min: 1, max: 10, default: 5 },
            { id: 'recovery_ability', type: 'radio', cols: 3, label: 'Recovery Capacity', options: [
                {val:'poor', label:'Poor', subtext:'I often feel sore or tired'},
                {val:'average', label:'Average', subtext:'I recover normally'},
                {val:'excellent', label:'Excellent', subtext:'I bounce back fast'}
            ]}
        ]
    },
    {
        step: 4, id: 'logistics', title: 'Logistics',
        fields: [
            { id: 'days', type: 'slider', label: 'Training Days Per Week', min: 2, max: 6, default: 4 },
            { id: 'session_duration', type: 'radio', cols: 2, label: 'Available Session Duration', options: [
                {val:'30', label:'30 Minutes', icon:'fa-stopwatch-20'},
                {val:'45', label:'45 Minutes', icon:'fa-stopwatch'},
                {val:'60', label:'60 Minutes', icon:'fa-clock'},
                {val:'90', label:'90+ Minutes', icon:'fa-hourglass'}
            ]},
            { id: 'equipment', type: 'radio', cols: 1, label: 'Equipment Access', options: [
                {val:'full', label:'Full Gym', subtext:'A proper gym with machines and free weights.', icon:'fa-building'},
                {val:'garage', label:'Home Gym', subtext:'Basic setup with dumbbells or a barbell.', icon:'fa-warehouse'},
                {val:'minimal', label:'Bodyweight/Minimal', subtext:'No equipment, just your body.', icon:'fa-suitcase'}
            ]}
        ]
    },
    {
        step: 5, id: 'training_style', title: 'Training Style Preference',
        fields: [
            { id: 'style', type: 'radio', cols: 2, label: 'Preferred Style', options: [
                {val:'strength', label:'Strength Focus', subtext:'Lifting heavy weights to build strength and muscle.', icon:'fa-anchor'},
                {val:'hybrid', label:'HIIT', subtext:'Fast-paced workouts to burn fat and get your heart pumping.', icon:'fa-stopwatch'},
                {val:'bodyweight', label:'Calisthenics', subtext:'Using your own bodyweight to get strong and lean.', icon:'fa-street-view'},
                {val:'longevity', label:'Health & Longevity', subtext:'Workouts focused on moving well and living longer.', icon:'fa-heart-circle-check'}
            ]}
        ]
    },
    {
        step: 6, id: 'nutrition', title: 'Nutrition Profile',
        fields: [
            { id: 'diet', type: 'radio', cols: 1, label: 'Diet Type', options: [
                {val:'balanced', label:'Balanced Nutritional Plan', subtext:'A normal diet with a good mix of protein, carbs, and fats.', icon:'fa-scale-balanced'},
                {val:'keto', label:'Keto / Low Carb', subtext:'Eating mostly fats and protein with very few carbs.', icon:'fa-temperature-arrow-down'},
                {val:'plant_based', label:'Plant-Based / Vegan', subtext:'Eating only foods that come from plants.', icon:'fa-leaf'}
            ]},
            { id: 'has_allergies', type: 'radio', cols: 2, label: 'Any food allergies or intolerances?', options: [
                {val:'no', label:'No', icon:'fa-check'}, {val:'yes', label:'Yes', icon:'fa-triangle-exclamation'}
            ]},
            { id: 'allergies', type: 'chips', label: 'Select Restrictions / Avoid', condition: (d) => d.has_allergies === 'yes', options: [
                'Dairy', 'Gluten', 'Nuts', 'Shellfish', 'Soy', 'Eggs'
            ]},
            { id: 'meals_per_day', type: 'slider', label: 'Preferred Meals Per Day', min: 2, max: 6, default: 3 }
        ]
    },
    {
        step: 7, id: 'lifestyle', title: 'Lifestyle & Habits',
        fields: [
            { id: 'cooking', type: 'radio', cols: 3, label: 'Cooking Ability', options: [
                {val:'novice', label:'Novice', subtext:'I can make simple meals'},
                {val:'intermediate', label:'Average', subtext:'I can follow basic recipes'},
                {val:'expert', label:'Expert', subtext:'I am great at cooking and prepping'}
            ]},
            { id: 'budget', type: 'radio', cols: 3, label: 'Food Budget', options: [
                {val:'low', label:'Budget', subtext:'Trying to save money', icon:'fa-coins'},
                {val:'medium', label:'Standard', subtext:'Normal grocery budget', icon:'fa-wallet'},
                {val:'high', label:'Premium', subtext:'Willing to spend more on quality', icon:'fa-money-bill-wave'}
            ]},
            { id: 'hydration', type: 'slider', label: 'Daily Water Intake (Liters)', min: 1, max: 5, default: 2 },
            { id: 'supplements', type: 'radio', cols: 3, label: 'Supplement Use', options: [
                {val:'none', label:'None', subtext:'I only eat whole foods'},
                {val:'basic', label:'Basic', subtext:'Just protein and vitamins'},
                {val:'advanced', label:'Advanced', subtext:'I use a full range of supplements'}
            ]}
        ]
    },
    {
        step: 8, id: 'mindset', title: 'Mindset & Tracking',
        fields: [
            { id: 'work_schedule', type: 'radio', cols: 2, label: 'Work Schedule', options: [
                {val:'standard', label:'Standard (9-5)', icon:'fa-sun'},
                {val:'shift', label:'Shift / Night', icon:'fa-moon'}
            ]},
            { id: 'structure', type: 'radio', cols: 1, label: 'Nutrition Tracking Style', options: [
                {val:'strict', label:'Strict Tracking', subtext:'I want to track every calorie and macro.', icon:'fa-lock'},
                {val:'flexible', label:'Flexible / Intuitive', subtext:'I just want simple guidelines to follow.', icon:'fa-compass'}
            ]}
        ]
    }
];

const wizardModule = {
    current: 0,
    data: {},

    init: () => {
        const user = db.getCurrentUser();
        if (user && user.assessment_state && Object.keys(user.assessment_state.data).length > 0) {
            wizardModule.current = user.assessment_state.step;
            wizardModule.data = user.assessment_state.data;
        } else {
            wizardModule.current = 0;
            wizardModule.data = {};
        }
        wizardModule.render();
    },

    render: () => {
        const q = questions[wizardModule.current];
        document.getElementById('step-counter').textContent = `${wizardModule.current + 1} / ${questions.length}`;
        document.getElementById('step-label').textContent = `${langModule.t('Step')} ${wizardModule.current + 1}`;
        document.getElementById('step-title').textContent = langModule.t(q.title);
        document.getElementById('wizard-progress').style.width = `${((wizardModule.current) / questions.length) * 100}%`;

        const form = document.getElementById('wizard-form');
        let html = '';

        q.fields.forEach(f => {
            const isVisible = f.condition ? f.condition(wizardModule.data) : true;
            const displayStyle = isVisible ? '' : 'display: none;';
            
            html += `<div class="question-block" id="block-${f.id}" style="${displayStyle}">
                        <span class="question-label">${langModule.t(f.label)}</span>`;
            
            if (f.type === 'number') {
                const val = wizardModule.data[f.id] || '';
                const placeholder = f.placeholder ? langModule.t(f.placeholder) : '';
                html += `<input type="number" id="inp-${f.id}" class="input-modern w-full font-mono" placeholder="${placeholder}" value="${val}" oninput="wizardModule.handleInputChange()">`;
            } 
            else if (f.type === 'radio') {
                const gridClass = f.cols === 2 ? 'opts-2' : f.cols === 3 ? 'opts-3' : '';
                html += `<div class="options-grid ${gridClass}">`;
                f.options.forEach(opt => {
                    const checked = wizardModule.data[f.id] === opt.val ? 'checked' : '';
                    html += `
                    <label class="radio-card">
                        <input type="radio" name="${f.id}" value="${opt.val}" ${checked} onchange="wizardModule.handleInputChange()">
                        <div class="radio-card-content">
                            ${opt.icon ? `<i class="fa-solid ${opt.icon}"></i>` : ''}
                            <span class="radio-label">${langModule.t(opt.label)}</span>
                            ${opt.subtext ? `<span class="radio-subtext">${langModule.t(opt.subtext)}</span>` : ''}
                        </div>
                    </label>`;
                });
                html += `</div>`;
            }
            else if (f.type === 'slider') {
                const val = wizardModule.data[f.id] || f.default;
                html += `
                <div class="slider-container">
                    <input type="range" id="inp-${f.id}" class="range-slider" min="${f.min}" max="${f.max}" value="${val}" oninput="document.getElementById('out-${f.id}').innerText=this.value; wizardModule.handleInputChange()">
                    <div class="flex-between text-[0.65rem] text-muted font-bold font-mono tracking-widest uppercase mt-2">
                        <span>${langModule.t('MIN')}: ${f.min}</span>
                        <span class="text-primary text-xl font-bold" id="out-${f.id}">${val}</span>
                        <span>${langModule.t('MAX')}: ${f.max}</span>
                    </div>
                </div>`;
            }
            else if (f.type === 'chips') {
                html += `<div class="chips-grid">`;
                const selected = wizardModule.data[f.id] || [];
                f.options.forEach(opt => {
                    const checked = selected.includes(opt) ? 'checked' : '';
                    html += `
                    <label class="chip-checkbox">
                        <input type="checkbox" name="${f.id}" value="${opt}" ${checked} onchange="wizardModule.handleInputChange()">
                        <div class="chip-content">${langModule.t(opt)}</div>
                    </label>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
        });

        form.innerHTML = html;

        document.getElementById('btn-prev-step').style.visibility = wizardModule.current === 0 ? 'hidden' : 'visible';
        document.getElementById('btn-next-step').innerHTML = wizardModule.current === questions.length - 1 ? `${langModule.t('Create Plan')} <i class="fa-solid fa-microchip ml-2"></i>` : `${langModule.t('Next Step')} <i class="fa-solid fa-angle-right ml-2"></i>`;
        
        // Re-apply static translations to dynamic elements
        if (window.safeI18nApply) { window.safeI18nApply(); }
    },

    handleInputChange: () => {
        wizardModule.captureStep(true);
        const q = questions[wizardModule.current];
        q.fields.forEach(f => {
            if (f.condition) {
                const block = document.getElementById(`block-${f.id}`);
                if (block) {
                    if (f.condition(wizardModule.data)) {
                        block.style.display = 'block';
                    } else {
                        block.style.display = 'none';
                    }
                }
            }
        });
    },

    captureStep: (skipValidation = false) => {
        const stepData = questions[wizardModule.current].fields;
        let valid = true;

        stepData.forEach(f => {
            // Only validate elements that are currently visible/active according to their condition
            const isVisible = f.condition ? f.condition(wizardModule.data) : true;
            
            if (f.type === 'radio') {
                const checked = document.querySelector(`input[name="${f.id}"]:checked`);
                if(checked) wizardModule.data[f.id] = checked.value; 
                else if(isVisible) valid = false;
            } else if (f.type === 'slider' || f.type === 'number') {
                const el = document.getElementById(`inp-${f.id}`);
                if(el && el.value) wizardModule.data[f.id] = el.value; 
                else if(isVisible) valid = false;
            } else if (f.type === 'chips') {
                const checks = Array.from(document.querySelectorAll(`input[name="${f.id}"]:checked`)).map(c => c.value);
                wizardModule.data[f.id] = checks;
                if(isVisible && checks.length === 0 && !f.options.includes('None')) valid = false; // pseudo-validation
            }
        });

        return valid;
    },

    next: () => {
        if (!wizardModule.captureStep()) {
            alert(langModule.t('Please complete all visible fields to proceed.')); return;
        }

        if (wizardModule.current < questions.length - 1) {
            wizardModule.current++;
            db.saveAssessmentState(wizardModule.current, wizardModule.data);
            wizardModule.render();
        } else {
            algorithm.generate(wizardModule.data);
        }
    },

    prev: () => {
        wizardModule.captureStep(true); // Don't block backward navigation with validation
        if(wizardModule.current > 0) { 
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
{
  "workout_plan": [
    {
      "day": "Day Name (e.g., Monday, Tuesday)",
      "focus": "Workout Focus (e.g., Upper Body Strength, Active Recovery)",
      "exercises": [
        {
          "name": "Exercise Name",
          "sets": "Number of sets (e.g., 3-4)",
          "reps": "Rep range (e.g., 8-12)",
          "rest": "Rest time (e.g., 90s)"
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

            // For now, return a mock structured response
            const mockParsedJSON = {
                "workout_plan": [
                    {
                        "day": "Monday",
                        "focus": "Upper Body Strength",
                        "exercises": [
                            {"name": "Barbell Bench Press", "sets": "4", "reps": "5-8", "rest": "120s"}
                        ]
                    }
                ],
                "nutrition_plan": {
                    "daily_calories": "Calculating...",
                    "macros": {"protein": "TBD", "carbs": "TBD", "fats": "TBD"},
                    "guidelines": ["Stay hydrated", "Focus on whole foods"]
                }
            };
            return mockParsedJSON;
        } catch (error) {
            console.error("AI Generation failed:", error);
            return null;
        }
    },

    generate: (data) => {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('active');

        // NEW LOGIC: Call the AI prompt engine and log it, then proceed with legacy simulation
        algorithm.generateAIProtocol(data).then(mockAIResult => {
            console.log("Mock AI Generated JSON object:", mockAIResult);
        });

        let p = 0;
        const bar = document.getElementById('cyber-progress-bar');
        const txt = document.getElementById('loading-text');
        const logs = [langModule.t("Analyzing your profile..."), langModule.t("Calculating nutrition targets..."), langModule.t("Building your workout plan..."), langModule.t("Finalizing your personal plan...")];
        let l = 0;

        const int = setInterval(() => {
            p += 2;
            bar.style.width = p+'%';
            if(p%25===0 && l<logs.length) { txt.textContent = logs[l]; l++; }
            
            if (p >= 100) {
                clearInterval(int);
                const protocol = algorithm.compile(data);
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
        // Advanced Math Matrix (Mifflin-St Jeor Metric)
        const bmr = a.sex === 'm' 
            ? (10 * a.weight) + (6.25 * a.height) - (5 * a.age) + 5 
            : (10 * a.weight) + (6.25 * a.height) - (5 * a.age) - 161; 
            
        let tdee = a.activity === 'active' ? bmr * 1.55 : bmr * 1.2;
        let calories = a.primary_goal === 'fat_loss' ? tdee - 500 : (a.primary_goal === 'muscle_gain' ? tdee + 300 : tdee);
        calories = Math.round(calories);
        
        // Protein (g/kg): ~2.2g for fat loss, 2.0g otherwise
        const protein = Math.round(a.primary_goal === 'fat_loss' ? (a.weight * 2.2) : (a.weight * 2.0));

        const protocol = {
            meta: { goal: a.primary_goal, tier: a.experience.toUpperCase(), days: a.days, style: a.style.toUpperCase() },
            nutrition: {
                cals: calories, pro: protein,
                carbs: Math.round((calories * 0.4) / 4), fats: Math.round((calories * 0.25) / 9),
                diet: a.diet, structure: a.structure
            },
            training: [], recovery: []
        };

        // Build Training Arrays
        let numDays = parseInt(a.days);
        const isBg = langModule.currentLanguage === 'bg';
        const dayNames = isBg ? ['ПОН', 'ВТО', 'СРЯ', 'ЧЕТ', 'ПЕТ', 'СЪБ'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const types = { 
            strength: isBg ? "Фокус върху сила" : "Strength Focus", 
            hybrid: "HIIT", 
            bodyweight: isBg ? "Собствено тегло" : "Bodyweight Focus", 
            endurance: isBg ? "Кардио и издръжливост" : "Endurance" 
        };
        
        for(let i=0; i<numDays; i++) {
            let n = i%2===0 ? types[a.style] : (isBg ? 'Активно възстановяване / Подвижност' : 'Active Recovery / Mobility');
            
            // Generate description keys
            let descKey = '';
            if (i === 0) {
                let w = a.weakness ? a.weakness[0] : (isBg ? 'базова фитнес подготовка' : 'core fitness');
                let translatedW = isBg ? langModule.t(w) : w;
                descKey = isBg ? `Фокус върху основната ви цел, особено [${translatedW}].` : `Focus on your main goal, especially [${translatedW}].`;
            } else {
                descKey = isBg ? "Подобрявайте формата си и следете напредъка." : "Build up your fitness and track progress.";
            }

            protocol.training.push({
                day: dayNames[i],
                name: n,
                desc: descKey
            });
        }

        // Build Recovery Arrays
        const sleep = a.stress > 7 ? '8.5' : '7.5';
        protocol.recovery.push(isBg ? `Стремете се към ~${sleep} часа качествен сън.` : `Aim for ${sleep} hours of quality sleep.`);
        if(a.injuries && !a.injuries.includes('None')) {
            const injuriesList = isBg ? a.injuries.map(i => langModule.t(i)).join(', ') : a.injuries.join(', ');
            protocol.recovery.push(isBg ? `Ежедневна подвижност: ~10 мин разтягане или рехабилитация за [${injuriesList}].` : `Daily mobility: 10 mins dedicated stretching/rehab for [${injuriesList}].`);
        }
        
        return protocol;
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
        document.getElementById('dash-avatar').textContent = user.email.substring(0,2).toUpperCase();

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

            // Nutrition
            document.getElementById('res-macros').innerHTML = `
                <div class="macro-box"><div class="val text-primary">${p.nutrition.cals}</div><div class="lbl">KCAL</div></div>
                <div class="macro-box"><div class="val">${p.nutrition.pro}g</div><div class="lbl">PRO</div></div>
                <div class="macro-box"><div class="val">${p.nutrition.carbs}g</div><div class="lbl">CARB</div></div>
                <div class="macro-box"><div class="val">${p.nutrition.fats}g</div><div class="lbl">FAT</div></div>
            `;
            const dietTitles = {balanced: safeT("Balanced Nutrition"), keto: safeT("Keto Diet"), fasting: safeT("Intermittent Fasting")};
            const structTitles = {strict: safeT("Strict Tracking"), flexible: safeT("Flexible / Intuitive")};
            document.getElementById('res-nutrition-plan').innerHTML = `
                <li><i class="fa-solid fa-check"></i> ${safeT("Diet")}: ${dietTitles[p.nutrition.diet] || safeT(p.nutrition.diet)}</li>
                <li><i class="fa-solid fa-check"></i> ${safeT("Style")}: ${structTitles[p.nutrition.structure] || safeT(p.nutrition.structure)}</li>
            `;

            // Recovery
            document.getElementById('res-recovery-plan').innerHTML = p.recovery.map(r => {
                // Try to parse out the dynamic parts to translate the generic string
                let text = r;
                if (r.startsWith('Aim for') || r.includes('часа качествен сън') || r.includes('hours of quality sleep')) {
                    const hrs = r.match(/([0-9.]+)/)?.[1] || '7.5';
                    text = `${safeT('Aim for')} ${hrs} ${safeT('hours of quality sleep.')}`;
                } else if (r.startsWith('Daily mobility:') || r.includes('Ежедневна подвижност')) {
                    const injMatch = r.match(/\[(.*?)\]/);
                    if (injMatch) {
                        const inj = injMatch[1];
                        const translatedInj = inj.split(', ').map(i => safeT(i)).join(', ');
                        text = `${safeT('Daily mobility: 10 mins dedicated stretching/rehab for')} [${translatedInj}].`;
                    }
                }
                return `<li><i class="fa-solid fa-droplet"></i> ${text}</li>`;
            }).join('');

            // Training Modules (Scroller)
            let modulesHtml = "";
            p.training.forEach((t) => {
                let translatedDesc = safeT(t.desc) || t.desc;
                if (t.desc.startsWith('Focus on your main goal') || t.desc.includes('Фокус върху основната ви цел')) {
                    const weakMatch = t.desc.match(/\[(.*?)\]/);
                    const weak = weakMatch ? weakMatch[1] : 'core fitness';
                    translatedDesc = `${safeT('Focus on your main goal, especially')} [${safeT(weak)}].`;
                } else if (t.desc.startsWith('Build up your fitness') || t.desc.includes('Подобрявайте формата си')) {
                    translatedDesc = safeT('Build up your fitness and track progress.');
                }
                
                modulesHtml += `
                <div class="day-card">
                    <div class="day-header">${safeT(t.day)}</div>
                    <div class="day-body">
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
        let avgW=0, avgA=0, avgE=0, avgS=0, avgWC=0;
        let html = '';
        const len = user.telemetry.length;

        user.telemetry.forEach(t => {
            if(html === '') avgW = t.weight; // latest weight
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
            
            const realA = Math.round(avgA/len);
            const realE = (avgE/len).toFixed(1);
            const realS = (avgS/len).toFixed(1);
            const realWC = Math.round(avgWC/len);

            document.getElementById('tracker-weight').textContent = avgW;
            document.getElementById('tracker-adherence').textContent = realA;
            document.getElementById('tracker-energy').textContent = realE;

            // Trend bars visually simulated
            setTimeout(() => {
                document.getElementById('tracker-adh-bar').style.width = `${realA}%`;
                document.getElementById('tracker-eng-bar').style.width = `${(realE/10)*100}%`;
                // Colors based on performance
                document.getElementById('tracker-adh-bar').style.backgroundColor = realA > 85 ? 'var(--success)' : (realA > 70 ? 'var(--warning)' : 'var(--danger)');
            }, 500);

            const safeT = window.safeI18nT || langModule.t;
            // Update placeholder box on Active protocol 
            document.querySelector('.border-dashed').innerHTML = `
                <div>
                    <i class="fa-solid fa-radar text-primary text-3xl mb-2"></i>
                    <h4 class="text-xs font-bold uppercase text-primary font-mono tracking-widest mt-2"><span data-safe-i18n="Overall Consistency">${safeT("Overall Consistency")}</span>: ${Math.round((realA + realWC)/2) || realA}%</h4>
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
        if(event) event.preventDefault();
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        if(event) event.currentTarget.classList.add('active');
        
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

        if(!w || !adherence || !workouts || !energy || !sleep) { 
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
    if(activeBtn) activeBtn.classList.add('text-primary', 'font-bold');

    // Modals Close handlers
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').classList.remove('active');
        });
    });

    // Check auth to route properly
    const user = db.getCurrentUser();
    if(user) {
        if(user.active_protocol) app.navigate('dashboard');
        else app.navigate('onboarding');
    } else {
        app.navigate('landing');
    }
});
