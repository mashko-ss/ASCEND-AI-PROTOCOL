/**
 * ASCEND AI PROTOCOL - Premium AI Fitness System
 * Architecture: Vanilla JS + Robust LocalStorage Simulation
 */

import { toDashboardFormat, saveProgressEntry, evaluateProgressFromLatest, getRecommendationsFromLatest, getProgressHistory, createProtocol, advanceProtocolWeek, getNextDeloadWeek, regenerateNextWeekProtocol, getInjuryState, processProgressForRecovery } from './src/lib/ai/index.js';
import { signInWithGoogle as signInWithGoogleCloud, restoreSession, getSessionUser, isCurrentUserAdmin, signOutUser, saveUsername } from './src/lib/core/authAdapter.js';
import { getCurrentUser as storageGetCurrentUser } from './src/lib/data/storageAdapter.js';

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
            isAdmin: false,
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
        log.date = new Date().toLocaleString(); // full timestamp for History Log
        state.users[state.currentUser].telemetry.unshift(log); // newest first
        db.save(state);
    }
};

/** Minimal bridge: legacy `db` shell expects a current user row; cloud OAuth uses storageAdapter via authAdapter. */
function ensureLegacyUserForCloudSession(cloudUser) {
    if (!cloudUser || !cloudUser.email) return;
    const state = db.get();
    const email = String(cloudUser.email).trim().toLowerCase();
    if (!state.users[email]) {
        state.users[email] = {
            email,
            pass: '__oauth__',
            isAdmin: cloudUser.isAdmin === true,
            assessment_state: { step: 0, data: {} },
            active_protocol: null,
            history: [],
            telemetry: []
        };
    } else {
        state.users[email].isAdmin = cloudUser.isAdmin === true;
    }
    if (cloudUser.username) {
        state.users[email].username = cloudUser.username;
    }
    state.currentUser = email;
    db.save(state);
}

function hasUsernameForCurrentUser() {
    const du = db.getCurrentUser();
    if (!du) return false;
    if (du.username && String(du.username).trim()) return true;
    const su = storageGetCurrentUser();
    return Boolean(su?.username?.trim());
}

function persistUsernameToLegacyDb(trimmed) {
    const state = db.get();
    if (!state.currentUser || !state.users[state.currentUser]) return;
    state.users[state.currentUser].username = trimmed;
    db.save(state);
}

function getNavDisplayLabel() {
    const du = db.getCurrentUser();
    if (!du) return '';
    const su = storageGetCurrentUser();
    const name = (su?.username || du.username || '').trim();
    if (name) return name.toUpperCase();
    return du.email.split('@')[0].toUpperCase();
}

function getNavAvatarInitials() {
    const du = db.getCurrentUser();
    if (!du) return '';
    const su = storageGetCurrentUser();
    const name = (su?.username || du.username || '').trim();
    if (name) return name.substring(0, 2).toUpperCase();
    return du.email.substring(0, 2).toUpperCase();
}

/** Nav bar uses monospace uppercase; dropdown shows readable name when username is set. */
function getDropdownDisplayLabel() {
    const du = db.getCurrentUser();
    if (!du) return '';
    const su = storageGetCurrentUser();
    const name = (su?.username || du.username || '').trim();
    if (name) return name;
    return du.email;
}

// ==========================================
// 1.5 LANGUAGE MODULE
// ==========================================
const langModule = {
    /** Default visible UI language: BG-first market. English remains in `translations.en` for recovery. */
    currentLanguage: 'bg',
    translations: {
        en: {
            "Start Assessment": "Start Assessment",
            "Resume Step": "Resume Step",
            "Resume Step with number": "Resume from step {n}",
            "Pause Assessment": "Pause assessment",
            "Steps progress": "{n} / {m}",
            "Welcome to ASCEND AI PROTOCOL": "Welcome to ASCEND AI PROTOCOL",
            "Personal Setup": "Personal Setup",
            "Login": "Login",
            "Create Account": "Create Account",
            "Continue with Google": "Continue with Google",
            "Cloud sign-in is not available.": "Cloud sign-in is not available.",
            "Google sign-in failed.": "Google sign-in failed.",
            "Admin Dashboard": "Admin Dashboard",
            "Admin dashboard placeholder": "Administrator access. Content TBD.",
            "Signed in": "Signed in",
            "Choose where to go": "Choose where to go",
            "Admin Panel": "Admin Panel",
            "Open App": "Open App",
            "Username setup title": "Choose your display name",
            "Username setup hint": "This name appears in the app instead of your email when possible.",
            "Username label": "Display name",
            "Username placeholder": "Your name or nickname",
            "Save and continue": "Save and continue",
            "Username required": "Please enter a username.",
            "Could not save.": "Could not save.",
            "welcome_onboarding_title": "Welcome to ASCEND AI PROTOCOL",
            "welcome_onboarding_subtitle": "Answer a few short questions so we can build a personalized strategy for your goals, level, limitations, and lifestyle.",
            "welcome_hook_line1": "No generic programs. No guesswork.",
            "welcome_hook_line2": "Only an individual approach that turns what we know about you into a clear, actionable plan.",
            "welcome_cta_start": "Start the questions",
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
            "MEAL PLAN": "MEAL PLAN",
            "meals/day": "meals/day",
            "water": "water",
            "WARNINGS": "WARNINGS",
            "Weekly Progress": "Weekly Progress",
            "Strength Change": "Strength Change",
            "Fatigue": "Fatigue",
            "Sleep": "Sleep",
            "Adherence": "Adherence",
            "Injuries / Notes": "Injuries / Notes",
            "Progress History": "Progress History",
            "No entries yet": "No entries yet.",
            "Adaptation Recommendations": "Adaptation Recommendations",
            "Deload week recommended": "Deload week recommended",
            "No changes recommended": "No changes recommended",
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
            "How did you feel this week?": "How did you feel this week?",
            "Injuries notes placeholder": "e.g. shoulder, knee, lower back",
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
            "Save Progress": "Save Progress",
            "Enter Progress": "Enter Progress",
            "GENERATING PLAN": "GENERATING PLAN",
            "Analyzing status...": "Analyzing your profile...",
            "Building your workout plan...": "Building your workout plan...",
            "Finalizing your personal plan...": "Finalizing your personal plan...",
            "Failed to generate plan. Please try again.": "Failed to generate plan. Please try again.",
            "API Error": "API Error",
            "Fallback plan used": "Fallback plan used",
            "Progression Rules": "Progression Rules",
            "Recovery Guidance": "Recovery Guidance",
            "Warnings": "Warnings",
            "Rest days": "Rest days",
            "per week": "per week",
            "Sleep": "Sleep",
            "hours": "hours",
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
            "Completed": "Completed",
            "Paused": "Paused",
            "Deploy Date": "Deploy Date",
            "Protocol Status": "Protocol Status",
            "Advance Week": "Advance Week",
            "Current Week": "Current Week",
            "Goal": "Goal",
            "Next Deload": "Next Deload",
            "Start Date": "Start Date",
            "No active protocol": "No active protocol.",
            "None": "None",
            "Muscle Gain": "Muscle Gain",
            "Recomposition": "Recomposition",
            "Longevity": "Longevity",
            "Endurance": "Endurance",
            "Week": "Week",
            "No snapshots yet": "No snapshots yet.",
            "Adaptation recorded": "Adaptation recorded",
            "Action": "Action",
            "Latest Regeneration Result": "Latest Regeneration Result",
            "Deload": "Deload",
            "Volume": "Volume",
            "Intensity": "Intensity",
            "Calories": "Calories",
            "Cardio": "Cardio",
            "No": "No",
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
            "Step 1": "Step 1",
            "Step 2": "Step 2",
            "Step 3": "Step 3",
            "Step 4": "Step 4",
            "Step 5": "Step 5",
            "Step 6": "Step 6",
            "Step 7": "Step 7",
            "Personal Stats": "Personal Stats",
            "Daily Activity Level": "Daily Activity Level",
            "Activity Outside of Training": "Activity Outside of Training",
            "Primary Goal": "Primary Goal",
            "Sedentary": "Sedentary",
            "Lightly Active": "Lightly Active",
            "Moderately Active": "Moderately Active",
            "Very Active": "Very Active",
            "Target Focus": "Target Focus",
            "Weak muscle groups or priorities": "Weak muscle groups or priorities",
            "Chest": "Chest",
            "Legs": "Legs",
            "Core": "Core",
            "Overall": "Overall",
            "Experience & Equipment": "Experience & Equipment",
            "Schedule": "Schedule",
            "2 Days": "2 Days",
            "3 Days": "3 Days",
            "4 Days": "4 Days",
            "5 Days": "5 Days",
            "6 Days": "6 Days",
            "Limitations & Injuries": "Limitations & Injuries",
            "No injuries or limitations": "No injuries or limitations.",
            "Dietary Needs": "Dietary Needs",
            "Allergies / Exclusions": "Allergies / Exclusions",
            "Standard / Balanced": "Standard / Balanced",
            "Vegan": "Vegan",
            "Vegetarian": "Vegetarian",
            "Gluten-free": "Gluten-free",
            "Keto": "Keto",
            "Mostly sitting / little movement": "Mostly sitting / little movement",
            "Light activity (walking, light workouts)": "Light activity (walking, light workouts)",
            "Regular movement or active job": "Regular movement or active job",
            "Regular workouts or active job": "Regular workouts or active job",
            "Hard physical work or intense daily activity": "Hard physical work or intense daily activity",
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
            "Gym": "Gym",
            "Home": "Home",
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
            "Warm-up": "Warm-up",
            "Pre-workout": "Pre-workout",
            "Post-workout": "Post-workout",
            "Mark exercise complete": "Mark exercise complete",
            "RPE": "RPE",
            "Tempo": "Tempo",
            "Create Plan": "Create Plan",
            "Please complete all visible fields to proceed.": "Please complete all visible fields to proceed.",
            "MIN": "MIN",
            "MAX": "MAX"
        },
        bg: {
            "Start Assessment": "Започни оценката",
            "Resume Step": "Продължи от стъпка",
            "Resume Step with number": "Продължи от стъпка {n}",
            "Pause Assessment": "Пауза на оценката",
            "Steps progress": "Стъпка {n} от {m}",
            "Welcome to ASCEND AI PROTOCOL": "Добре дошъл в ASCEND AI PROTOCOL",
            "Personal Setup": "Лична настройка",
            "Login": "Вход",
            "Create Account": "Създай профил",
            "Continue with Google": "Продължи с Google",
            "Cloud sign-in is not available.": "Облачен вход не е наличен.",
            "Google sign-in failed.": "Входът с Google не бе успешен.",
            "Admin Dashboard": "Админ табло",
            "Admin dashboard placeholder": "Администраторски достъп. Съдържание — предстои.",
            "Signed in": "Влязли сте",
            "Choose where to go": "Изберете накъде",
            "Admin Panel": "Админ панел",
            "Open App": "Отвори приложението",
            "Username setup title": "Избери показвано име",
            "Username setup hint": "Това име се показва в приложението вместо имейла, когато е възможно.",
            "Username label": "Показвано име",
            "Username placeholder": "Име или псевдоним",
            "Save and continue": "Запази и продължи",
            "Username required": "Моля, въведи потребителско име.",
            "Could not save.": "Запазването не бе успешно.",
            "welcome_onboarding_title": "Добре дошъл в ASCEND AI PROTOCOL",
            "welcome_onboarding_subtitle": "Започни въпросите, за да създадеш прецизен протокол за сила, здраве или дълголетие и рекомпозиция на тялото.",
            "welcome_hook_line1": "Без общи програми. Без догадки.",
            "welcome_hook_line2": "Само индивидуален подход, който превръща информацията за теб в ясен и приложим план за действие.",
            "welcome_cta_start": "Започни въпросите",
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
            "Initialize text": "Стартирайте настройката, за да получите прецизен протокол за сила, здраве, дълголетие и рекомпозиция на тялото.",
            "Back": "Назад",
            "Next Step": "Продължи",
            "YOUR TRAINING PLAN": "ВАШИЯТ ТРЕНИРОВЪЧЕН ПЛАН",
            "Pending Assessment": "Очаква вашата настройка.",
            "Log Progress": "Въведете прогрес",
            "Nutrition Plan": "Хранителен план",
            "MEAL PLAN": "Примерен план на храненията",
            "meals/day": "хранения/ден",
            "water": "вода",
            "WARNINGS": "ПРЕДУПРЕЖДЕНИЯ",
            "Weekly Progress": "Седмичен прогрес",
            "Strength Change": "Промяна в силата",
            "Fatigue": "Умора",
            "Sleep": "Сън",
            "Adherence": "Спазване",
            "Injuries / Notes": "Контузии / Бележки",
            "Progress History": "История на прогреса",
            "No entries yet": "Няма записи.",
            "Adaptation Recommendations": "Препоръки за адаптация",
            "Deload week recommended": "Препоръчва се седмица за възстановяване",
            "No changes recommended": "Няма препоръчани промени",
            "Recovery Plan": "План за възстановяване",
            "Poor": "Слабо",
            "Average": "Средно",
            "Excellent": "Отлично",
            "Friendly Reminder": "Напомняне",
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
            "How did you feel this week?": "Как се чувстваше тази седмица?",
            "Injuries notes placeholder": "напр. рамо, коляно, кръст",
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
            "Save Progress": "Запазване на прогреса",
            "Enter Progress": "Въведете прогрес",
            "GENERATING PLAN": "ГЕНЕРИРАНЕ НА ПЛАН",
            "Analyzing status...": "Анализиране на профила...",
            "Building your workout plan...": "Изграждане на тренировъчния план...",
            "Finalizing your personal plan...": "Финализиране на личния план...",
            "Failed to generate plan. Please try again.": "Грешка при генериране на плана. Моля, опитайте отново.",
            "API Error": "Грешка при генериране",
            "Fallback plan used": "Използван е резервен план.",
            "Progression Rules": "Правила за прогресия",
            "Recovery Guidance": "Насоки за възстановяване",
            "Warnings": "Предупреждения",
            "Rest days": "Дни за почивка",
            "per week": "на седмица",
            "Sleep": "Сън",
            "hours": "часа",
            "Monday": "ПОН",
            "Tuesday": "ВТО",
            "Wednesday": "СРЯ",
            "Thursday": "ЧЕТ",
            "Friday": "ПЕТ",
            "Saturday": "СЪБ",
            "Sunday": "НЕД",
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
            "PLAN: FAT LOSS": "План: Отслабване",
            "PLAN: BUILD MUSCLE": "План: Покачване на мускулна маса",
            "PLAN: BODY RECOMPOSITION": "План: Рекомпозиция",
            "PLAN: OVERALL FITNESS": "План: Обща кондиция",
            "LEVEL": "НИВО",
            "Frequency": "Честота",
            "Days / Wk": "дни седмично",
            "days weekly": "дни седмично",
            "Status": "Статус",
            "Active": "Активен",
            "Completed": "Завършено",
            "Paused": "На пауза",
            "Protocol Status": "Статус на протокола",
            "Advance Week": "Следваща седмица",
            "Current Week": "Текуща седмица",
            "Goal": "Цел",
            "Next Deload": "Следваща разтоварваща седмица",
            "Start Date": "Начална дата",
            "No active protocol": "Няма активен протокол.",
            "Muscle Gain": "Покачване на маса",
            "Longevity": "Дълголетие",
            "Week": "Седмица",
            "No snapshots yet": "Все още няма записи.",
            "Adaptation recorded": "Адаптацията е записана",
            "Action": "Действие",
            "Latest Regeneration Result": "Последен резултат от регенерация",
            "Deload": "Разтоварване",
            "Volume": "Обем",
            "Intensity": "Интензитет",
            "Calories": "Калории",
            "Cardio": "Кардио",
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
            "Height (cm)": "Ръст (см)",
            "e.g. 178": "напр. 178",
            "Activity Level": "Ниво на активност",
            "Step 1": "Стъпка 1",
            "Step 2": "Стъпка 2",
            "Step 3": "Стъпка 3",
            "Step 4": "Стъпка 4",
            "Step 5": "Стъпка 5",
            "Step 6": "Стъпка 6",
            "Step 7": "Стъпка 7",
            "Personal Stats": "Лични данни",
            "Daily Activity Level": "Ниво на активност",
            "Activity Outside of Training": "Активност извън тренировките",
            "Primary Goal": "Основна цел",
            "Sedentary": "Заседнал начин на живот",
            "Lightly Active": "Леко активен",
            "Moderately Active": "Умерено активен",
            "Very Active": "Много активен",
            "Target Focus": "Приоритет в тренировката",
            "Weak muscle groups or priorities": "Слаби мускулни групи или приоритети",
            "Chest": "Гърди",
            "Legs": "Крака",
            "Core": "Корем",
            "Overall": "Цялостно",
            "Experience & Equipment": "Опит и оборудване",
            "Schedule": "График",
            "2 Days": "2 дни",
            "3 Days": "3 дни",
            "4 Days": "4 дни",
            "5 Days": "5 дни",
            "6 Days": "6 дни",
            "Limitations & Injuries": "Ограничения и травми",
            "No injuries or limitations": "Няма травми или ограничения.",
            "Dietary Needs": "Хранителни предпочитания",
            "Allergies / Exclusions": "Алергии и изключения",
            "Standard / Balanced": "Стандартно / балансирано",
            "Vegan": "Веган",
            "Vegetarian": "Вегетарианско",
            "Gluten-free": "Без глутен",
            "Keto": "Кето",
            "Mostly sitting / little movement": "Предимно седене и малко движение през деня.",
            "Light activity (walking, light workouts)": "Леки разходки и умерена активност; без интензивни тренировки.",
            "Regular movement or active job": "Редовно движение или работа със значителна физическа натовареност през деня.",
            "Regular workouts or active job": "Редовно движение или работа, която изисква активност през по-голямата част от деня.",
            "Hard physical work or intense daily activity": "Тежък физически труд или много висока дневна физическа активност.",
            "Hard training or physical work": "Интензивна физическа работа или висока активност през по-голямата част от деня.",
            "Your Goal": "Вашата цел",
            "Primary Focus": "Основен акцент",
            "Fat Loss": "Изгаряне на мазнини",
            "Lose fat while preserving muscle.": "Фокус върху изгаряне на мазнини със запазване на мускулна маса.",
            "Build Muscle": "Покачване на мускулна маса",
            "Gain muscle and strength.": "Покачване на сила и мускулна маса.",
            "Recomposition": "Рекомпозиция",
            "Lose fat and gain muscle at the same time.": "Рекомпозиция: мазнини надолу, мускул нагоре в един период.",
            "Health & Longevity": "Здраве и дълголетие",
            "Optimize healthspan and vitality.": "Дългосрочно здраве, енергия и жизненост.",
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
            "New to training, learning the basics.": "Начинаещи сте; акцент върху основните движения и техника.",
            "Intermediate": "Средно ниво",
            "Consistent training for a few months.": "Редовни тренировки от няколко месеца насам.",
            "Advanced": "Напреднал",
            "Several years of training experience.": "Многогодишен, последователен тренировъчен опит.",
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
            "Select Injuries/Limitations": "Болки в ставите, травми или други ограничения",
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
            "Training Days Per Week": "Тренировъчни дни седмично",
            "Available Session Duration": "Продължителност на една тренировка",
            "30 Minutes": "30 мин",
            "45 Minutes": "45 мин",
            "60 Minutes": "60 мин",
            "90+ Minutes": "90+ мин",
            "Equipment Access": "Достъп до оборудване",
            "Full Gym": "Пълен фитнес",
            "Gym": "Фитнес зала",
            "Home": "Вкъщи",
            "A proper gym with machines and free weights.": "Фитнес зала с уреди и свободни тежести.",
            "Home Gym": "Домашен фитнес",
            "Basic setup with dumbbells or a barbell.": "Базово оборудване: дъмбели или щанга.",
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
            "Diet Type": "Тип хранене",
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
            "None": "Няма",
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
            "reps": "повторения",
            "Rest": "Почивка",
            "Warm-up": "Загрявка",
            "Pre-workout": "Преди тренировка",
            "Post-workout": "След тренировка",
            "Mark exercise complete": "Отбележи упражнението като изпълнено",
            "RPE": "RPE",
            "Tempo": "Темпо",
            "Create Plan": "Завърши",
            "Please complete all visible fields to proceed.": "Моля, попълни всички полета в тази стъпка, за да продължиш.",
            "Required field": "Това поле е задължително.",
            "Select option": "Избери опция",
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
        // BG-first: always show Bulgarian in UI. English dictionaries stay loaded; restore later via `ascend_lang` + switcher.
        langModule.currentLanguage = 'bg';
        try {
            localStorage.setItem('ascend_lang', 'bg');
        } catch (e) { /* ignore */ }
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

        if (document.getElementById('view-entry')?.classList.contains('active')) {
            entryModule.refreshEntry();
        }

        if (document.getElementById('view-welcome-onboarding')?.classList.contains('active')
            || document.getElementById('view-username-setup')?.classList.contains('active')) {
            langModule.applyTranslations();
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
// 2. AUTHENTICATED ENTRY (hub after login)
// ==========================================
const entryModule = {
    refreshEntry() {
        const adminBtn = document.getElementById('entry-btn-admin-panel');
        if (adminBtn) {
            if (isCurrentUserAdmin()) adminBtn.classList.remove('hidden');
            else adminBtn.classList.add('hidden');
        }
        langModule.applyTranslations();
    }
};

// ==========================================
// 2. CORE ROUTING & APP STATE
// ==========================================
const app = {
    views: ['landing', 'auth', 'entry', 'username-setup', 'welcome-onboarding', 'onboarding', 'assessment', 'dashboard', 'admin'],

    /** Member app: dashboard if protocol exists, else onboarding. */
    openApp: () => {
        const user = db.getCurrentUser();
        if (!user) {
            app.navigate('auth', 'login');
            return;
        }
        if (user.active_protocol) app.navigate('dashboard');
        else app.navigate('onboarding');
    },

    navigate: (viewId, context = null) => {
        // Handle logic before view switch
        const user = db.getCurrentUser();

        // Protected routes logic
        const protectedRoutes = ['entry', 'username-setup', 'welcome-onboarding', 'onboarding', 'assessment', 'dashboard', 'admin'];
        if (protectedRoutes.includes(viewId) && !user) {
            viewId = 'auth';
            context = 'login';
        }

        // Admin-only view: block non-admins
        if (viewId === 'admin') {
            if (!user) {
                viewId = 'auth';
                context = 'login';
            } else if (!isCurrentUserAdmin()) {
                viewId = user.active_protocol ? 'dashboard' : 'onboarding';
            }
        }

        // Username / welcome: normal users only; admins use entry flow
        if (viewId === 'username-setup' || viewId === 'welcome-onboarding') {
            if (!user) {
                viewId = 'auth';
                context = 'login';
            } else if (isCurrentUserAdmin()) {
                viewId = 'entry';
            }
        }

        if (viewId === 'username-setup' && user && hasUsernameForCurrentUser() && !isCurrentUserAdmin()) {
            viewId = 'welcome-onboarding';
        }

        if (viewId === 'welcome-onboarding' && user && !hasUsernameForCurrentUser() && !isCurrentUserAdmin()) {
            viewId = 'username-setup';
        }

        // Contextual logic
        if (viewId === 'auth') {
            if (user) return routeAfterAuth();
            authModule.setMode(context || 'login');
        }

        if (viewId === 'dashboard' && user && !user.active_protocol && !isCurrentUserAdmin()) {
            viewId = 'onboarding'; // No plan = force onboarding (non-admin only)
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
            if (viewId === 'dashboard' || viewId === 'admin') {
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

        if (viewId === 'entry') {
            entryModule.refreshEntry();
        }
    },

    updateNav: () => {
        const user = db.getCurrentUser();
        const navAuth = document.getElementById('nav-auth');
        const navUnauth = document.getElementById('nav-unauth');

        if (user) {
            navUnauth.classList.add('hidden');
            navAuth.classList.remove('hidden');
            document.getElementById('nav-user-email').textContent = getNavDisplayLabel();
            document.getElementById('nav-avatar').textContent = getNavAvatarInitials();
            document.getElementById('dropdown-email').textContent = getDropdownDisplayLabel();

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

    logout: async () => {
        try {
            await signOutUser();
        } catch (e) {
            console.warn('[ASCEND] signOutUser failed:', e);
        }
        db.logout();
        app.navigate('landing');
    }
};

// ==========================================
// 3. AUTHENTICATION MODULE
// ==========================================
const authModule = {
    isSignup: false,

    googleSignInErrorMessage: (result) => {
        const unavailable = ['cloud_auth_not_configured', 'supabase_client_unavailable', 'oauth_sign_in_unavailable'];
        if (result && unavailable.includes(result.reason)) {
            return langModule.t('Cloud sign-in is not available.');
        }
        if (result && typeof result.reason === 'string' && result.reason.trim()) {
            return result.reason.trim();
        }
        return langModule.t('Google sign-in failed.');
    },

    mountGoogleButton: () => {
        const authForm = document.getElementById('auth-form');
        const toggle = document.getElementById('auth-toggle-text');
        if (!authForm || !toggle || document.getElementById('btn-auth-google')) return;

        const wrap = document.createElement('div');
        wrap.className = 'mt-4';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btn-auth-google';
        btn.className = 'btn btn-outline btn-large w-full font-mono uppercase tracking-widest text-sm';
        btn.setAttribute('data-i18n', 'Continue with Google');
        btn.textContent = langModule.t('Continue with Google');
        btn.setAttribute('aria-label', langModule.t('Continue with Google'));
        wrap.appendChild(btn);
        authForm.parentNode.insertBefore(wrap, toggle);

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            authModule.signInWithGoogle();
        });

        langModule.applyTranslations();
    },

    signInWithGoogle: async () => {
        const errEl = document.getElementById('auth-error');
        if (errEl) errEl.classList.add('hidden');

        const btn = document.getElementById('btn-auth-google');
        if (btn) btn.disabled = true;

        try {
            const result = await signInWithGoogleCloud();
            if (!result.ok) {
                if (errEl) {
                    errEl.textContent = authModule.googleSignInErrorMessage(result);
                    errEl.classList.remove('hidden');
                }
            } else if (result.redirectUrl) {
                window.location.assign(result.redirectUrl);
            } else {
                const sessionUser = getSessionUser();
                if (sessionUser) {
                    ensureLegacyUserForCloudSession(sessionUser);
                    routeAfterAuth();
                }
            }
        } catch (e) {
            console.warn('[ASCEND] Google sign-in error:', e);
            if (errEl) {
                errEl.textContent = langModule.t('Google sign-in failed.');
                errEl.classList.remove('hidden');
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    },

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
        routeAfterAuth();
    }
};

function routeAfterAuth() {
    if (isCurrentUserAdmin()) app.navigate('entry');
    else if (!hasUsernameForCurrentUser()) app.navigate('username-setup');
    else app.navigate('welcome-onboarding');
}

const usernameModule = {
    submit: async () => {
        const input = document.getElementById('username-input');
        const err = document.getElementById('username-setup-error');
        const val = input?.value?.trim() || '';
        if (!val) {
            if (err) {
                err.textContent = langModule.t('Username required');
                err.classList.remove('hidden');
            }
            return;
        }
        if (err) err.classList.add('hidden');
        const result = await saveUsername(val);
        if (!result.ok) {
            if (result.reason === 'no_user' && db.getCurrentUser()) {
                persistUsernameToLegacyDb(val);
                app.navigate('welcome-onboarding');
                return;
            }
            if (err) {
                err.textContent = typeof result.reason === 'string' ? result.reason : langModule.t('Could not save.');
                err.classList.remove('hidden');
            }
            return;
        }
        persistUsernameToLegacyDb(val);
        app.navigate('welcome-onboarding');
    }
};

// ==========================================
// ==========================================
// 4. THE WIZARD MODULE (DOM DRIVEN)
// ==========================================
const wizardModule = {
    current: 0,
    totalSteps: 8,
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

        // Restore form state: radios, checkboxes, and text inputs
        Object.keys(wizardModule.data).forEach(key => {
            if (key === 'allergies') {
                const val = wizardModule.data.allergies;
                if (val === 'none') {
                    const el = document.querySelector('input[name="allergies"][value="none"]');
                    if (el) el.checked = true;
                } else if (val) {
                    val.split(',').forEach(v => {
                        const el = document.querySelector(`input[name="allergies"][value="${String(v).trim()}"]`);
                        if (el) el.checked = true;
                    });
                }
                return;
            }
            if (key === 'age' || key === 'weight' || key === 'height') {
                const input = document.getElementById(`input-${key}`);
                if (input) input.value = wizardModule.data[key];
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

        // Update progress UI (localized step counter)
        const stepCounterEl = document.getElementById('step-counter');
        if (stepCounterEl) {
            stepCounterEl.textContent = langModule.t('Steps progress')
                .replace('{n}', String(wizardModule.current + 1))
                .replace('{m}', String(wizardModule.totalSteps));
        }
        document.getElementById('wizard-progress').style.width = `${(wizardModule.current / wizardModule.totalSteps) * 100}%`;

        const pauseBtn = document.getElementById('assessment-pause-btn');
        if (pauseBtn) {
            const pauseT = langModule.t('Pause Assessment');
            pauseBtn.setAttribute('title', pauseT);
            pauseBtn.setAttribute('aria-label', pauseT);
        }

        // Update Button Visibilities
        document.getElementById('btn-prev-step').style.visibility = wizardModule.current === 0 ? 'hidden' : 'visible';

        const nextBtn = document.getElementById('btn-next-step');
        if (wizardModule.current === wizardModule.totalSteps - 1) {
            nextBtn.innerHTML = `<span data-safe-i18n="Create Plan">${langModule.t('Create Plan')}</span> <i class="fa-solid fa-microchip ml-2"></i>`;
        } else {
            nextBtn.innerHTML = `<span data-safe-i18n="Next Step">${langModule.t('Next Step')}</span> <i class="fa-solid fa-angle-right ml-1"></i>`;
        }

        if (window.safeI18nApply) { window.safeI18nApply(); }
        if (langModule && langModule.applyTranslations) { langModule.applyTranslations(); }
    },

    captureStep: () => {
        const currentStepEl = document.getElementById(`step-${wizardModule.current}`);
        if (!currentStepEl) return false;

        // Step 0: Personal Stats (gender + age, weight, height inputs)
        if (wizardModule.current === 0) {
            const genderEl = currentStepEl.querySelector('input[name="gender"]:checked');
            const ageEl = document.getElementById('input-age');
            const weightEl = document.getElementById('input-weight');
            const heightEl = document.getElementById('input-height');
            if (!genderEl || !ageEl?.value?.trim() || !weightEl?.value?.trim() || !heightEl?.value?.trim()) {
                return false;
            }
            wizardModule.data.gender = genderEl.value;
            wizardModule.data.age = ageEl.value.trim();
            wizardModule.data.weight = weightEl.value.trim();
            wizardModule.data.height = heightEl.value.trim();
            return true;
        }

        // Step 7: Dietary Needs (diet radio + allergies checkboxes)
        if (wizardModule.current === 7) {
            const dietRadio = currentStepEl.querySelector('input[name="diet"]:checked');
            if (!dietRadio) return false;
            wizardModule.data.diet = dietRadio.value;
            const checkboxes = currentStepEl.querySelectorAll('input[name="allergies"]:checked');
            const values = Array.from(checkboxes).map(c => c.value);
            if (values.includes('none') || values.length === 0) {
                wizardModule.data.allergies = 'none';
            } else {
                wizardModule.data.allergies = values.filter(v => v !== 'none').join(',');
            }
            return true;
        }

        // Step 4 (index 4): Experience & Equipment — require BOTH experience and equipment
        if (wizardModule.current === 4) {
            const experienceEl = currentStepEl.querySelector('input[name="experience"]:checked');
            const equipmentEl = currentStepEl.querySelector('input[name="equipment"]:checked');
            if (!experienceEl || !equipmentEl) return false;
            wizardModule.data.experience = experienceEl.value;
            wizardModule.data.equipment = equipmentEl.value;
            return true;
        }

        // Steps 1, 2, 3, 5, 6: single radio per step (activity, primary_goal, target_focus, days, duration, limitations)
        const checked = currentStepEl.querySelector('input[type="radio"]:checked');
        if (checked) {
            wizardModule.data[checked.name] = checked.value;
            return true;
        }

        return false;
    },

    next: () => {
        if (!wizardModule.captureStep()) {
            alert(langModule.t('Please complete all visible fields to proceed.'));
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
        // Silently capture current step when going backwards
        const currentStepEl = document.getElementById(`step-${wizardModule.current}`);
        if (currentStepEl) {
            if (wizardModule.current === 0) {
                const genderEl = currentStepEl.querySelector('input[name="gender"]:checked');
                const ageEl = document.getElementById('input-age');
                const weightEl = document.getElementById('input-weight');
                const heightEl = document.getElementById('input-height');
                if (genderEl) wizardModule.data.gender = genderEl.value;
                if (ageEl?.value?.trim()) wizardModule.data.age = ageEl.value.trim();
                if (weightEl?.value?.trim()) wizardModule.data.weight = weightEl.value.trim();
                if (heightEl?.value?.trim()) wizardModule.data.height = heightEl.value.trim();
            } else if (wizardModule.current === 7) {
                const dietRadio = currentStepEl.querySelector('input[name="diet"]:checked');
                if (dietRadio) wizardModule.data.diet = dietRadio.value;
                const checkboxes = currentStepEl.querySelectorAll('input[name="allergies"]:checked');
                const values = Array.from(checkboxes).map(c => c.value);
                wizardModule.data.allergies = (values.includes('none') || values.length === 0) ? 'none' : values.filter(v => v !== 'none').join(',');
            } else if (wizardModule.current === 4) {
                const experienceEl = currentStepEl.querySelector('input[name="experience"]:checked');
                const equipmentEl = currentStepEl.querySelector('input[name="equipment"]:checked');
                if (experienceEl) wizardModule.data.experience = experienceEl.value;
                if (equipmentEl) wizardModule.data.equipment = equipmentEl.value;
            } else {
                const checked = currentStepEl.querySelector('input[type="radio"]:checked');
                if (checked) wizardModule.data[checked.name] = checked.value;
            }
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
                        "Поставяйте протеина като основен приоритет във всяко хранене (целете се към 25–40 g на хранене).",
                        "Залагайте основно на пълноценни храни (около 80% от избора); за останалото допускайте гъвкавост.",
                        "Хидратация: 2,5–3 л вода дневно; повече в тренировъчни дни.",
                        "Разпределяйте въглехидратите около тренировката за енергия и възстановяване.",
                        "Включвайте зеленчуци с фибри на обяд и вечеря."
                    ],
                    "meal_timing": {
                        "pre_workout": "60–90 мин преди: 30–40 g въглехидрати + 15–20 g протеин (напр. овес + банан + суроватъчен протеин, или оризови питки + гръцко кисело мляко). Кофеин по избор 30–45 мин преди (3–5 mg/kg).",
                        "post_workout": "В рамките на 1–2 часа: 40–60 g въглехидрати + 25–40 g протеин. Пример: пиле + ориз + зеленчуци, или суроватъчен шейк + банан + тост. По възможност заложете на пълноценни храни."
                    },
                    "supplement_stack": [
                        { "name": "Креатин монохидрат", "purpose": "Сила и мускулна маса; силни доказателства за всички цели.", "dose": "5 g дневно (по всяко време)." },
                        { "name": "Витамин D3", "purpose": "Костно здраве, имунитет, настроение; особено при малко слънце.", "dose": "2000–4000 IU с храна, съдържаща мазнини." },
                        { "name": "Омега-3 (EPA/DHA)", "purpose": "Възстановяване, стави, телесен състав.", "dose": "2–3 g EPA+DHA комбинирано дневно." },
                        { "name": "Суроватъчен или растителен протеин", "purpose": "Удобен начин да покриете дневния протеин.", "dose": "1–2 мерителни лъжици при нужда." }
                    ]
                }
            };
            return mockParsedJSON;
        } catch (error) {
            console.error("AI Generation failed:", error);
            return null;
        }
    },

    _isGenerating: false,

    generate: async (data) => {
        if (algorithm._isGenerating) return;
        algorithm._isGenerating = true;

        const overlay = document.getElementById('loading-overlay');
        const nextBtn = document.getElementById('btn-next-step');
        const bar = document.getElementById('cyber-progress-bar');
        const txt = document.getElementById('loading-text');

        overlay?.classList.add('active');
        if (nextBtn) nextBtn.disabled = true;

        try {
            bar.style.width = '20%';
            txt.textContent = langModule.t("Analyzing status...");

            const res = await fetch('/api/ai/generate-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            bar.style.width = '70%';
            txt.textContent = langModule.t("Building your workout plan...") || "Building your workout plan...";

            const json = await res.json();

            if (json.source || json.debugStage) {
                console.log('[AI Debug]', { source: json.source, debugStage: json.debugStage, debugMessage: json.debugMessage });
            }

            if (!res.ok || !json.success || !json.plan) {
                throw new Error(json.error || json.debugMessage || langModule.t("Failed to generate plan. Please try again."));
            }

            bar.style.width = '100%';
            txt.textContent = langModule.t("Finalizing your personal plan...") || "Finalizing your personal plan...";

            const aiResult = toDashboardFormat(json.plan, data);
            const protocol = algorithm.compile(data);
            protocol.aiResult = aiResult;
            protocol.apiPlan = json.plan;
            protocol.apiSource = json.source;
            if (json.plan?.planMeta) {
                protocol.meta.splitType = json.plan.planMeta.splitType || protocol.meta.style;
                protocol.meta.days = String(json.plan.planMeta.trainingDaysPerWeek || protocol.meta.days);
            }

            const userProfile = { goal: data.primary_goal, primary_goal: data.primary_goal, ...data };
            const enhancedProtocol = createProtocol(userProfile, json.plan, aiResult.nutrition_plan, protocol, {});
            db.saveNewProtocol(enhancedProtocol);
            db.clearAssessmentState();

            setTimeout(() => {
                overlay?.classList.remove('active');
                algorithm._isGenerating = false;
                if (nextBtn) nextBtn.disabled = false;
                app.navigate('dashboard');
            }, 600);
        } catch (err) {
            overlay?.classList.remove('active');
            algorithm._isGenerating = false;
            if (nextBtn) nextBtn.disabled = false;

            const safeMsg = langModule.t("Failed to generate plan. Please try again.");
            alert(safeMsg);
            console.error('[AI Generate Error]', err);
        }
    },

    compile: (a) => {
        // Elite 8-step data: gender, age, weight, height, activity, primary_goal, target_focus, experience, equipment, days, duration, limitations, diet, allergies
        const weightNum = parseFloat(a.weight) || 80;
        const heightNum = parseFloat(a.height) || 175;
        const ageNum = parseInt(a.age, 10) || 30;
        let tdee = 2000;
        if (a.activity === 'highly') tdee = 3000;
        else if (a.activity === 'moderate' || a.activity === 'lightly') tdee = 2500;
        else if (a.activity === 'sedentary') tdee = 2000;
        const goal = a.primary_goal || 'recomp';
        let calories = goal === 'fat_loss' ? tdee - 500 : (goal === 'muscle_gain' ? tdee + 300 : tdee);
        const protein = goal === 'fat_loss' ? 180 : 160;

        const protocol = {
            meta: {
                goal: goal,
                tier: (a.experience || 'beginner').toUpperCase(),
                days: a.days || '3',
                style: (a.equipment || 'home').toUpperCase(),
                target_focus: a.target_focus || 'overall',
                limitations: a.limitations || 'none'
            },
            nutrition: {
                cals: calories,
                pro: protein,
                carbs: Math.round((calories * 0.4) / 4),
                fats: Math.round((calories * 0.25) / 9),
                diet: a.diet || 'standard',
                structure: 'Flexible',
                allergies: a.allergies || 'none'
            },
            training: [],
            recovery: []
        };

        let numDays = parseInt(a.days || 3, 10);
        const isBg = langModule.currentLanguage === 'bg';
        const dayNames = isBg ? ['Понеделник', 'Вторник', 'Сряда', 'Четвъртък', 'Петък', 'Събота', 'Неделя'] : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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

        const sleep = (a.activity === 'highly' || a.activity === 'moderate') ? '8.5' : '7.5';
        protocol.recovery.push(isBg ? `Стремете се към ~${sleep} часа качествен сън.` : `Aim for ${sleep} hours of quality sleep.`);
        protocol.recovery.push(isBg ? `Ежедневна подвижност: ~10 мин разтягане.` : `Daily mobility: 10 mins dedicated stretching.`);
        if (a.limitations && a.limitations !== 'none') {
            protocol.recovery.push(isBg ? `Ограничения: ${a.limitations}.` : `Limitations: ${a.limitations}.`);
        }
        return protocol;
    }
};

// ==========================================
// 5.5 ACCORDION MODULE (collapsible + scroll-into-view)
// ==========================================
// Accordion: 100% independent toggles. Opening one accordion toggles ONLY that card's content; siblings are never affected.
// Uses event.currentTarget and precise DOM traversal (ID mapping) so ONLY the clicked day's content is toggled.
const accordionModule = {
    _bound: false,
    _boundTraining: false,

    bind: () => {
        const view = document.getElementById('view-dashboard');
        if (!view) return;

        // Day cards: strict delegation on #res-training-plan — each day opens/closes only its own content; siblings untouched
        const trainingPlanEl = document.getElementById('res-training-plan');
        if (trainingPlanEl && !accordionModule._boundTraining) {
            accordionModule._boundTraining = true;
            trainingPlanEl.addEventListener('click', (e) => {
                const trigger = e.target.closest('.accordion-trigger');
                if (!trigger) return;
                if (!trainingPlanEl.contains(trigger)) return;
                const accordionId = trigger.getAttribute('data-accordion-id');
                if (!accordionId) return;
                const card = document.getElementById(accordionId);
                if (!card || !card.classList.contains('day-card')) return;
                e.preventDefault();
                e.stopPropagation();
                accordionModule._toggleOne(card, trigger);
            });
            trainingPlanEl.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const trigger = e.target.closest('.accordion-trigger');
                if (!trigger) return;
                if (!trainingPlanEl.contains(trigger)) return;
                const accordionId = trigger.getAttribute('data-accordion-id');
                if (!accordionId) return;
                const card = document.getElementById(accordionId);
                if (!card || !card.classList.contains('day-card')) return;
                e.preventDefault();
                e.stopPropagation();
                accordionModule._toggleOne(card, trigger);
            });
        }

        // All other accordions (nutrition, recovery, training header)
        if (!accordionModule._bound) {
            accordionModule._bound = true;
            view.addEventListener('click', (e) => {
                if (e.target.closest('#res-training-plan')) return;
                const trigger = e.target.closest('.accordion-trigger');
                if (!trigger) return;
                const accordionId = trigger.getAttribute('data-accordion-id');
                const card = accordionId ? document.getElementById(accordionId) : trigger.closest('.accordion-card');
                if (!card) return;
                e.preventDefault();
                e.stopPropagation();
                accordionModule._toggleOne(card, trigger);
            });

            view.addEventListener('keydown', (e) => {
                if (e.target.closest('#res-training-plan')) return;
                const trigger = e.target.closest('.accordion-trigger');
                if (!trigger) return;
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const accordionId = trigger.getAttribute('data-accordion-id');
                const card = accordionId ? document.getElementById(accordionId) : trigger.closest('.accordion-card');
                if (!card) return;
                e.preventDefault();
                accordionModule._toggleOne(card, trigger);
            });
        }
    },

    _toggleOne: (card, trigger) => {
        // Precise DOM traversal: use data-accordion-id to find body by ID (e.g. accordion-day-0-body)
        const accordionId = trigger.getAttribute('data-accordion-id');
        const body = accordionId ? document.getElementById(accordionId + '-body') : trigger.nextElementSibling;
        const wasClosed = card.classList.contains('is-closed');

        if (wasClosed) {
            card.classList.remove('is-closed');
            card.classList.add('is-open');
            trigger.setAttribute('aria-expanded', 'true');
            if (body) body.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
            card.classList.add('is-closed');
            card.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
        }
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
// 5.5.1 DASHBOARD HELPER FUNCTIONS (accordion + back navigation)
// ==========================================
function setupAccordionBehavior() {
    accordionModule.bind();
}

function toggleAccordion(id) {
    const card = document.getElementById(id);
    if (!card) return;
    const trigger = card.querySelector('.accordion-trigger');
    if (!trigger) return;
    accordionModule._toggleOne(card, trigger);
}

function handleBackNavigation() {
    // 1. If modal is open, close it
    const modal = document.getElementById('modal-checkin');
    if (modal?.classList.contains('active')) {
        toggleModal('modal-checkin', false);
        return;
    }

    // 2. If on Progress or History tab, switch to main dashboard (Your Plan)
    const activeTab = document.querySelector('.dash-tab.active');
    const activeTabId = activeTab?.id;
    if (activeTabId === 'tab-progress-tracker' || activeTabId === 'tab-history') {
        dashModule.switchTab('active-protocol', null);
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        document.querySelector('.sidebar-link[data-tab="active-protocol"]')?.classList.add('active');
        return;
    }

    // 3. Fallback: scroll to main dashboard top
    const dashboardMain = document.querySelector('.dashboard-main');
    if (dashboardMain) {
        dashboardMain.scrollTo({ top: 0, behavior: 'smooth' });
    }
    const viewDashboard = document.getElementById('view-dashboard');
    if (viewDashboard) {
        viewDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ==========================================
// 5.55 DASHBOARD VISIBLE LABELS (BG copy; API/internal English unchanged)
// ==========================================
function localizeSplitLabel(raw, safeT) {
    const s = String(raw || '').toLowerCase().trim().replace(/\s+/g, '_');
    const key = `split_${s}`;
    const tr = safeT(key);
    if (tr !== key) return tr;
    return String(raw || '').replace(/_/g, ' ');
}

function localizeDayHeader(raw, safeT) {
    const d = String(raw || '').trim();
    const tr = safeT(d);
    if (tr !== d) return tr;
    return d;
}

const FOCUS_LABEL_BG = {
    'Full Body': 'Цяло тяло',
    'Upper Body': 'Горна част',
    'Lower Body': 'Долна част',
    'Push (Chest, Shoulders, Triceps)': 'Гърди, рамене, трицепс (натиск)',
    'Pull (Back, Biceps)': 'Гръб и бицепс (теглене)',
    Legs: 'Крака',
    'Chest & Triceps': 'Гърди и трицепс',
    'Back & Biceps': 'Гръб и бицепс',
    'Shoulders & Core': 'Рамене и корем',
    'Strength Focus': 'Акцент върху сила',
    'Hypertrophy Focus': 'Акцент върху мускулна маса',
    Conditioning: 'Кондиция',
    'Recovery / Mobility': 'Възстановяване и мобилност',
    'Push Focus (Chest & Shoulders)': 'Гърди и рамене',
    'Pull & Lower Body': 'Гръб и долна част',
    'Active Recovery': 'Активно възстановяване',
    'Light Cardio + Mobility': 'Леко кардио и динамично разтягане',
    'Pull Focus (Back & Biceps)': 'Гръб и бицепс',
    'Leg Focus (Quads, Hamstrings, Glutes)': 'Предно / задно бедро и седалище'
};

function localizeFocusLabel(focus, safeT) {
    const f = String(focus || '').trim();
    if (FOCUS_LABEL_BG[f]) return FOCUS_LABEL_BG[f];
    const tr = safeT(f);
    return tr !== f ? tr : f;
}

const EXERCISE_LABEL_BG = {
    'Barbell Bench Press': 'Лежанка с щанга',
    'Bent-Over Barbell Row': 'Гребане с щанга в наклон',
    'Overhead Dumbbell Press': 'Жим с дъмбели от стоеж',
    'Pull-ups or Lat Pulldown': 'Набирания или скрипец пред гърди',
    'Cable Tricep Pushdown': 'Изтласкване за трицепс на кабел',
    'Barbell Back Squat': 'Клек с щанга',
    'Romanian Deadlift': 'Румънска мъртва тяга',
    'Leg Press': 'Крака в уред',
    'Leg Curl': 'Сгъване за бедро',
    Plank: 'Планк',
    'Light Cardio (Bike or Walk)': 'Леко кардио (велоергометър или ходене)',
    'Hip Mobility Flow': 'Мобилност на тазобедрената става',
    'Shoulder Dislocates': 'Разгрявка за рамене',
    'Cat-Cow Stretch': 'Разтягане „котка–крава“',
    'Incline Dumbbell Press': 'Наклонен лег с дъмбели',
    'Dumbbell Flyes': 'Кросоувър с дъмбели',
    'Seated Dumbbell Shoulder Press': 'Жим с дъмбели седнал',
    'Lateral Raises': 'Странични дъмбели',
    'Face Pulls': 'Фейс пул',
    'Conventional Deadlift': 'Класическа мъртва тяга',
    'Pull-ups or Assisted Pull-ups': 'Набирания или с помощ',
    'Cable Row': 'Гребане на кабел',
    'Bulgarian Split Squat': 'Български клек',
    'Barbell Curl': 'Сгъване за бицепс с щанга',
    'Squat or Leg Press': 'Клек или крака в уред',
    'Bench Press or Push-up': 'Лежанка или лицеви',
    'Row or Pull-up': 'Гребане или набиране',
    'Overhead Press': 'Жим от стоеж',
    'Plank or Core': 'Планк / корем',
    'Lunges or Step-up': 'Клек с крачка или стъпване',
    'Leg Curl or Nordic': 'Сгъване за бедро или нордик',
    'Calf Raise': 'Повдигане на пръсти',
    'Incline DB Press or Dips': 'Наклонен лег с дъмбели или кофи',
    'Tricep Extension': 'Разгъване за трицепс',
    'Lateral Raise': 'Странично дъмбели',
    'Lat Pulldown or Chin-up': 'Скрипец пред гърди или подхват',
    'Face Pull or Reverse Fly': 'Фейс пул или обърнато разгъване',
    'Bicep Curl': 'Сгъване за бицепс',
    'Hammer Curl': 'Хамър сгъване',
    'Deadlift or Rack Pull': 'Мъртва тяга или от стойки',
    'Lat Pulldown': 'Скрипец пред гърди',
    'Cable Fly or Push-up': 'Кросоувър с кабел или лицеви',
    'Tricep Pushdown': 'Изтласкване за трицепс'
};

function localizeExerciseName(name, safeT) {
    const n = String(name || '').trim();
    if (EXERCISE_LABEL_BG[n]) return EXERCISE_LABEL_BG[n];
    const tr = safeT(n);
    return tr !== n ? tr : n;
}

// ==========================================
// 5.6 NUTRITION RENDERERS (Phase 3)
// ==========================================
const nutritionRenderers = {
    renderNutritionHeader: (plan, safeT) => {
        if (!plan) return '';
        const meals = plan.mealsPerDay ?? 4;
        const hydration = plan.hydrationLiters ?? 2.5;
        const mealsLbl = safeT('meals/day') || 'meals/day';
        const waterLbl = safeT('water') || 'water';
        return `<div class="nutrition-meta-row flex flex-wrap gap-4 mt-3 mb-3 text-[0.7rem] font-mono text-secondary">
            <span><i class="fa-solid fa-utensils text-primary mr-1"></i> ${meals} ${mealsLbl}</span>
            <span><i class="fa-solid fa-droplet text-primary mr-1"></i> ${hydration} L ${waterLbl}</span>
        </div>`;
    },
    renderMacros: (plan, safeT, fallback) => {
        if (!plan) return fallback || '';
        let calories = plan.daily_calories || (plan.calories ? `${plan.calories} ${safeT('kcal unit')}` : '—');
        if (typeof calories === 'number') calories = `${calories} ${safeT('kcal unit')}`;
        const pro = plan.macros?.protein ?? fallback?.pro ?? '—';
        const carb = plan.macros?.carbs ?? fallback?.carbs ?? '—';
        const fat = plan.macros?.fats ?? fallback?.fats ?? '—';
        return `<div class="macro-box"><div class="val text-primary">${calories}</div><div class="lbl">${safeT('macro kcal')}</div></div>
            <div class="macro-box"><div class="val">${pro}</div><div class="lbl">${safeT('macro protein')}</div></div>
            <div class="macro-box"><div class="val">${carb}</div><div class="lbl">${safeT('macro carbs')}</div></div>
            <div class="macro-box"><div class="val">${fat}</div><div class="lbl">${safeT('macro fats')}</div></div>`;
    },
    renderMealPlan: (plan, safeT) => {
        if (!plan?.mealPlan || !Array.isArray(plan.mealPlan) || plan.mealPlan.length === 0) return '';
        const items = plan.mealPlan.map((m) => {
            const name = m.mealName || 'Meal';
            const purpose = m.purpose || '';
            const foods = typeof m.exampleFoods === 'string' ? m.exampleFoods : (Array.isArray(m.exampleFoods) ? m.exampleFoods.join('; ') : '');
            return `<li class="mb-2"><strong class="text-primary">${safeT(name)}</strong> — ${safeT(purpose)} <span class="text-muted block mt-1 text-[0.65rem]">${safeT(foods)}</span></li>`;
        }).join('');
        return `<ul class="protocol-list font-mono text-sm">${items}</ul>`;
    },
    renderNutritionWarnings: (plan, safeT) => {
        if (!plan?.warnings || !Array.isArray(plan.warnings) || plan.warnings.length === 0) return '';
        const items = plan.warnings.map((w) => `<li><i class="fa-solid fa-triangle-exclamation text-warning"></i> ${safeT(w)}</li>`).join('');
        return `<ul class="protocol-list font-mono text-sm text-warning">${items}</ul>`;
    }
};

// ==========================================
// 5.7 PROGRESS RENDERERS (Phase 5)
// ==========================================
/** Localize dynamic recommendation strings (e.g. calorie bump) when no exact i18n key exists. */
function translateRecoDynamic(text, safeT) {
    if (text == null || text === '') return text;
    const tr = safeT(text);
    if (tr !== text) return tr;
    const s = String(text);
    const m = s.match(/^Increase calories by (\d+) kcal\.?$/i);
    if (m) return `Увеличете калориите с ${m[1]} kcal`;
    return text;
}

const progressRenderers = {
    renderProgressHistory: (entries, safeT) => {
        if (!entries || entries.length === 0) {
            return `<p class="text-muted" data-safe-i18n="No entries yet">${safeT('No entries yet')}</p>`;
        }
        const rows = entries.slice(0, 10).map((e) => {
            const inj = (e.injuries && e.injuries.length) ? ` · ${e.injuries.join(', ')}` : '';
            return `<div class="flex justify-between py-1 border-b border-border-light text-[0.65rem]"><span>${safeT('progress history week')} ${e.weekNumber} · ${e.date}</span><span>${e.bodyWeight} ${safeT('kg')} · ${safeT('Adherence')}: ${e.adherence}% · ${safeT('Fatigue')}: ${e.fatigueLevel} · ${safeT('Sleep')}: ${e.sleepScore}</span></div>`;
        }).join('');
        return `<div class="space-y-0">${rows}</div>`;
    },
    renderAdaptiveSummary: (result, safeT) => {
        if (!result) return '';
        const parts = [];
        const t = result.trainingAdjustments || {};
        if (t.volumeChange !== 0 || t.intensityChange !== 0 || t.loadProgression !== 0) {
            const v = t.volumeChange > 0 ? `+${(t.volumeChange * 100).toFixed(0)}%` : (t.volumeChange * 100).toFixed(0) + '%';
            const i = t.intensityChange > 0 ? `+${(t.intensityChange * 100).toFixed(0)}%` : (t.intensityChange * 100).toFixed(0) + '%';
            const loadPart = t.loadProgression ? `, ${safeT('Load label')} ${t.loadProgression > 0 ? '+' : ''}${t.loadProgression}%` : '';
            parts.push(`<p><i class="fa-solid fa-dumbbell text-primary mr-1"></i> ${safeT('Training')}: ${safeT('Volume')} ${v}, ${safeT('Intensity')} ${i}${loadPart}</p>`);
        }
        const c = result.cardioAdjustments || {};
        if (c.cardioMinutesChange !== 0) {
            parts.push(`<p><i class="fa-solid fa-heart-pulse text-primary mr-1"></i> ${safeT('Cardio')}: ${c.cardioMinutesChange > 0 ? '+' : ''}${c.cardioMinutesChange} ${safeT('min')}</p>`);
        }
        const n = result.nutritionAdjustments || {};
        if (n.calorieChange !== 0) {
            parts.push(`<p><i class="fa-solid fa-utensils text-primary mr-1"></i> ${safeT('Calories')}: ${n.calorieChange > 0 ? '+' : ''}${n.calorieChange} ${safeT('kcal unit')}</p>`);
        }
        if (result.triggerDeload) {
            parts.push(`<p class="text-warning"><i class="fa-solid fa-pause text-warning mr-1"></i> ${safeT('Deload week recommended')}</p>`);
        }
        const rec = result.recoveryRecommendations || [];
        rec.forEach((r) => parts.push(`<p class="text-secondary"><i class="fa-solid fa-check text-primary mr-1"></i> ${safeT(r)}</p>`));
        return parts.length ? parts.join('') : '<p class="text-muted">' + (safeT('No changes recommended') || 'No changes recommended') + '</p>';
    },
    renderRecommendations: (recommendations, safeT) => {
        if (!recommendations || recommendations.length === 0) {
            return `<p class="text-muted" data-safe-i18n="No recommendations at this time">${safeT('No recommendations at this time')}</p>`;
        }
        const typeIcons = { training: 'fa-dumbbell', nutrition: 'fa-utensils', recovery: 'fa-shield-heart' };
        const priorityClasses = { high: 'text-warning', medium: 'text-primary', low: 'text-secondary' };
        return recommendations.map((r) => {
            const icon = typeIcons[r.type] || 'fa-circle';
            const pClass = priorityClasses[r.priority] || 'text-secondary';
            return `<div class="recommendation-item p-3 rounded border border-border-light bg-surface-hover">
                <div class="flex items-start gap-2">
                    <i class="fa-solid ${icon} text-primary mt-0.5"></i>
                    <div class="flex-grow">
                        <p class="font-bold text-xs uppercase tracking-widest ${pClass}">${safeT(r.type)} · ${safeT(r.priority)}</p>
                        <p class="text-secondary text-xs mt-1">${translateRecoDynamic(r.message, safeT)}</p>
                        <p class="text-primary font-mono text-xs mt-2"><strong>${safeT('Action')}:</strong> ${translateRecoDynamic(r.action, safeT)}</p>
                    </div>
                </div>
            </div>`;
        }).join('');
    },
    renderRecoveryStatus: (state, safeT) => {
        if (!state) return `<p class="text-muted" data-safe-i18n="No recovery data">${safeT('No recovery data')}</p>`;
        const s = state.injuryState || 'none';
        const modeMap = { none: safeT('Base'), cleared: safeT('Base'), detected: safeT('Adjusted'), active: safeT('Adjusted'), improving: safeT('Adjusted'), reintroduction: safeT('Reintroduction') };
        const stateMap = { none: safeT('No injury'), detected: safeT('Injury detected'), active: safeT('Injury active'), improving: safeT('Improving'), reintroduction: safeT('Reintroduction'), cleared: safeT('Cleared') };
        const mode = modeMap[s] || safeT('Base');
        const stateLabel = stateMap[s] || s;
        const injuries = (state.activeInjuries || []).length ? state.activeInjuries.join(', ') : safeT('None');
        const returnWeek = state.returnToBaseWeek || 0;
        let html = `<div class="space-y-2"><p><strong>${safeT('State')}:</strong> ${stateLabel}</p><p><strong>${safeT('Mode')}:</strong> ${mode}</p><p><strong>${safeT('Active injuries')}:</strong> ${injuries}</p>`;
        if (returnWeek > 0) html += `<p><strong>${safeT('Return-to-base week')}:</strong> ${returnWeek}</p>`;
        if (state.notes) html += `<p class="text-muted text-[0.65rem]">${safeT(state.notes)}</p>`;
        html += '</div>';
        return html;
    },
    renderRecoveryTransition: (state, safeT) => {
        if (!state || state.injuryState === 'none') return '';
        const s = state.injuryState || 'none';
        const tips = { detected: safeT('Plan adjusted for injury. Log progress weekly.'), active: safeT('Continue injury-adjusted training. Check "Feeling better" when improved.'), improving: safeT('Check "Injury healed" when ready to return.'), reintroduction: safeT('Gradual return: 60–70% week 1, 80–90% week 2.'), cleared: safeT('Back to base protocol.') };
        return tips[s] ? `<p class="text-xs text-secondary mt-2">${tips[s]}</p>` : '';
    },
    renderReturnToBaseInfo: (state, safeT) => {
        if (!state || state.injuryState !== 'reintroduction') return '';
        const w = state.returnToBaseWeek || 1;
        const pct = w === 1 ? '60–70%' : '80–90%';
        return `<p class="text-xs text-primary mt-4"><i class="fa-solid fa-info-circle mr-1"></i> ${safeT('Reintroduction')}: ${pct} ${safeT('of volume this week')}.</p>`;
    }
};

// ==========================================
// 5.8 PROTOCOL RENDERERS (Phase 7)
// ==========================================
const protocolRenderers = {
    renderProtocolStatus: (protocol, safeT) => {
        if (!protocol) return `<p class="text-muted" data-safe-i18n="No active protocol">${safeT('No active protocol')}</p>`;
        const currentWeek = protocol.currentWeek ?? 1;
        const durationWeeks = protocol.durationWeeks ?? 8;
        const goal = protocol.goal || protocol.meta?.goal || 'recomp';
        const status = protocol.status || 'active';
        const startDate = protocol.createdAt || protocol.created_at || '—';
        const nextDeload = getNextDeloadWeek(protocol);
        const goalMap = { fat_loss: safeT('Fat Loss'), muscle_gain: safeT('Muscle Gain'), recomp: safeT('Recomposition'), longevity: safeT('Longevity'), endurance: safeT('Endurance') };
        const statusMap = { active: safeT('Active'), completed: safeT('Completed'), paused: safeT('Paused') };
        return `
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div class="p-3 rounded bg-surface-hover border border-border-light">
                    <p class="text-[0.65rem] uppercase tracking-widest text-muted">${safeT('Current Week')}</p>
                    <p class="text-xl font-bold text-primary font-mono">${currentWeek} / ${durationWeeks}</p>
                </div>
                <div class="p-3 rounded bg-surface-hover border border-border-light">
                    <p class="text-[0.65rem] uppercase tracking-widest text-muted">${safeT('Goal')}</p>
                    <p class="font-bold">${goalMap[goal] || goal}</p>
                </div>
                <div class="p-3 rounded bg-surface-hover border border-border-light">
                    <p class="text-[0.65rem] uppercase tracking-widest text-muted">${safeT('Status')}</p>
                    <p class="font-bold text-success">${statusMap[status] || status}</p>
                </div>
                <div class="p-3 rounded bg-surface-hover border border-border-light">
                    <p class="text-[0.65rem] uppercase tracking-widest text-muted">${safeT('Next Deload')}</p>
                    <p class="font-mono">${nextDeload ? `${safeT('Week')} ${nextDeload}` : safeT('None')}</p>
                </div>
                <div class="p-3 rounded bg-surface-hover border border-border-light">
                    <p class="text-[0.65rem] uppercase tracking-widest text-muted">${safeT('Start Date')}</p>
                    <p class="font-mono">${startDate}</p>
                </div>
            </div>
        `;
    },
    renderProtocolTimeline: (protocol, safeT) => {
        if (!protocol) return '';
        const durationWeeks = protocol.durationWeeks ?? 8;
        const currentWeek = protocol.currentWeek ?? 1;
        const deloadWeeks = protocol.deloadWeeks || [];
        let html = '<div class="flex gap-1 flex-wrap mt-2">';
        for (let w = 1; w <= durationWeeks; w++) {
            const isCurrent = w === currentWeek;
            const isDeload = deloadWeeks.includes(w);
            const isPast = w < currentWeek;
            let cls = 'w-6 h-6 rounded text-[0.6rem] flex items-center justify-center font-mono font-bold ';
            if (isCurrent) cls += 'bg-primary text-base';
            else if (isDeload) cls += 'bg-warning/20 text-warning border border-warning';
            else if (isPast) cls += 'bg-surface-hover text-muted';
            else cls += 'bg-surface-hover text-secondary';
            html += `<span class="${cls}" title="${safeT('Week')} ${w}${isDeload ? ` (${safeT('Deload')})` : ''}">${w}</span>`;
        }
        html += '</div>';
        return html;
    },
    renderProtocolSnapshots: (protocol, safeT) => {
        if (!protocol?.planSnapshots?.length) return '<p class="text-muted text-xs">' + (safeT('No snapshots yet') || 'No snapshots yet') + '</p>';
        return protocol.planSnapshots.map((s) => `
            <div class="p-2 rounded border border-border-light bg-surface-hover text-xs mb-2">
                <span class="font-bold text-primary">${safeT('Week')} ${s.week}</span> ${s.date}
                ${s.adaptation ? '<span class="text-muted ml-2">' + safeT('Adaptation recorded') + '</span>' : ''}
            </div>
        `).join('');
    },
    renderLatestRegeneration: (protocol, safeT) => {
        const snapshots = protocol?.planSnapshots || [];
        const last = snapshots[snapshots.length - 1];
        const rr = last?.regenerationResult;
        if (!rr || typeof rr !== 'object') return null;
        const vol = rr.volumeChange ?? 0;
        const int = rr.intensityChange ?? 0;
        const cal = rr.calorieChange ?? 0;
        const volStr = vol !== 0 ? `${vol > 0 ? '+' : ''}${vol}%` : '0%';
        const intStr = int !== 0 ? `${int > 0 ? '+' : ''}${int}%` : '0%';
        const calStr = cal !== 0 ? `${cal > 0 ? '+' : ''}${cal} kcal` : '0';
        return `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div class="p-2 rounded bg-surface-hover"><span class="text-muted">${safeT('Week')}</span> <strong>${rr.week}</strong></div>
                <div class="p-2 rounded bg-surface-hover"><span class="text-muted">${safeT('Deload')}</span> <strong>${rr.isDeload ? safeT('Yes') : safeT('No')}</strong></div>
                <div class="p-2 rounded bg-surface-hover"><span class="text-muted">${safeT('Volume')}</span> <strong>${volStr}</strong></div>
                <div class="p-2 rounded bg-surface-hover"><span class="text-muted">${safeT('Intensity')}</span> <strong>${intStr}</strong></div>
                <div class="p-2 rounded bg-surface-hover"><span class="text-muted">${safeT('Calories')}</span> <strong>${calStr}</strong></div>
                ${(rr.cardioChange ?? 0) !== 0 ? `<div class="p-2 rounded bg-surface-hover"><span class="text-muted">${safeT('Cardio')}</span> <strong>${(rr.cardioChange ?? 0) > 0 ? '+' : ''}${rr.cardioChange ?? 0} min</strong></div>` : ''}
            </div>
        `;
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
            obSlot.innerHTML = `<button type="button" class="btn btn-outline btn-large w-full mt-4 text-sm tracking-wide" onclick="app.navigate('assessment')">${langModule.t('Resume Step with number').replace('{n}', String(user.assessment_state.step + 1))}</button>`;
        } else {
            obSlot.innerHTML = '';
        }

        // Ensure new dynamically added translations are processed
        if (langModule && langModule.applyTranslations) {
            langModule.applyTranslations();
        }

        // Dashboard Sidebar Header (prefer saved username over email local-part)
        document.getElementById('dash-username').textContent = getDropdownDisplayLabel();
        document.getElementById('dash-avatar').textContent = getNavAvatarInitials();

        if (user.active_protocol) {
            const p = user.active_protocol;

            const safeT = window.safeI18nT || langModule.t;
            // Populate Protocol Context
            const titleMap = { fat_loss: safeT("PLAN: FAT LOSS"), muscle_gain: safeT("PLAN: BUILD MUSCLE"), recomp: safeT("PLAN: BODY RECOMPOSITION"), longevity: safeT("PLAN: OVERALL FITNESS"), military: safeT("PLAN: OVERALL FITNESS") };
            document.getElementById('dash-mission-type').textContent = titleMap[p.meta.goal] || safeT("PLAN: OVERALL FITNESS");
            document.getElementById('dash-tier').textContent = safeT(p.meta.tier) + " " + safeT("LEVEL");
            document.getElementById('res-training-style').textContent = (p.apiPlan?.planMeta?.splitType ? localizeSplitLabel(p.apiPlan.planMeta.splitType, safeT) : safeT(p.meta.style));

            // Profile Stats
            document.getElementById('res-profile-stats').innerHTML = `
                <div class="stat-item"><span class="stat-label" data-safe-i18n="Frequency">${safeT("Frequency")}</span><span class="stat-value"><i class="fa-solid fa-calendar-day text-primary mr-1 text-xs"></i> ${p.meta.days} ${safeT("days weekly")}</span></div>
                <div class="stat-item"><span class="stat-label" data-safe-i18n="Status">${safeT("Status")}</span><span class="stat-value text-success"><i class="fa-solid fa-check text-success mr-1 text-xs"></i> ${safeT("Active")}</span></div>
                <div class="stat-item"><span class="stat-label" data-safe-i18n="Deploy Date">${safeT("Deploy Date")}</span><span class="stat-value">${p.created_at}</span></div>
            `;

            // Protocol Status card (Phase 7)
            const protocolStatusEl = document.getElementById('protocol-status-content');
            if (protocolStatusEl) {
                protocolStatusEl.innerHTML = protocolRenderers.renderProtocolStatus(p, safeT) + protocolRenderers.renderProtocolTimeline(p, safeT);
            }

            // Recovery Status card (Phase 11)
            const recoveryStatusEl = document.getElementById('recovery-status-content');
            if (recoveryStatusEl && typeof getInjuryState === 'function') {
                const recoveryState = getInjuryState(user.email);
                recoveryStatusEl.innerHTML = progressRenderers.renderRecoveryStatus(recoveryState, safeT) +
                    progressRenderers.renderRecoveryTransition(recoveryState, safeT) +
                    progressRenderers.renderReturnToBaseInfo(recoveryState, safeT);
            }

            // Latest Regeneration Result (Phase 8)
            const regenSection = document.getElementById('latest-regeneration-result');
            const regenContent = document.getElementById('latest-regeneration-content');
            if (regenSection && regenContent) {
                const regenHtml = protocolRenderers.renderLatestRegeneration(p, safeT);
                if (regenHtml) {
                    regenSection.classList.remove('hidden');
                    regenContent.innerHTML = regenHtml;
                } else {
                    regenSection.classList.add('hidden');
                }
            }

            // Fallback notice (subtle, when API used rule engine)
            const fallbackNotice = document.getElementById('res-fallback-notice');
            if (fallbackNotice) {
                if (p.apiSource === 'fallback') {
                    fallbackNotice.textContent = safeT("Fallback plan used");
                    fallbackNotice.classList.remove('hidden');
                } else {
                    fallbackNotice.classList.add('hidden');
                }
            }

            // Determine if we have an AI JSON Protocol to render
            if (p.aiResult) {
                // Remove Pending Assessment message
                const pendingEl = document.querySelector('#dash-mission-type').nextElementSibling;
                if (pendingEl) pendingEl.style.display = 'none';

                // Render apiPlan sections (progression, recovery, warnings) when available
                if (p.apiPlan) {
                    const rg = p.apiPlan.recoveryGuidance || {};
                    const pr = p.apiPlan.progressionRules || {};
                    const warn = Array.isArray(p.apiPlan.warnings) ? p.apiPlan.warnings : [];
                    let recoveryHtml = '';
                    if (rg.restDayCount != null || rg.sleepTargetHours || rg.hydrationGuidance) {
                        recoveryHtml += `<li><i class="fa-solid fa-check text-primary"></i> ${safeT("Rest days")}: ${rg.restDayCount ?? '—'} ${safeT("per week")}</li>`;
                        if (rg.sleepTargetHours) recoveryHtml += `<li><i class="fa-solid fa-check text-primary"></i> ${safeT("Sleep")}: ${rg.sleepTargetHours} ${safeT("hours")}</li>`;
                        if (rg.hydrationGuidance) recoveryHtml += `<li><i class="fa-solid fa-check text-primary"></i> ${safeT(rg.hydrationGuidance)}</li>`;
                    }
                    if (pr.method || pr.weeklyAdjustment || pr.deloadTrigger) {
                        recoveryHtml += `<li class="mt-2"><strong class="text-primary text-[0.65rem] uppercase tracking-widest">${safeT("Progression Rules")}</strong></li>`;
                        if (pr.method) recoveryHtml += `<li><i class="fa-solid fa-arrow-trend-up text-primary"></i> ${safeT(pr.method)}</li>`;
                        if (pr.weeklyAdjustment) recoveryHtml += `<li><i class="fa-solid fa-arrow-trend-up text-primary"></i> ${safeT(pr.weeklyAdjustment)}</li>`;
                        if (pr.deloadTrigger) recoveryHtml += `<li><i class="fa-solid fa-arrow-trend-up text-primary"></i> ${safeT(pr.deloadTrigger)}</li>`;
                    }
                    if (recoveryHtml) {
                        document.getElementById('res-recovery-plan').innerHTML = recoveryHtml;
                    }
                    if (warn.length > 0) {
                        const warnEl = document.getElementById('res-recovery-plan');
                        if (warnEl) {
                            const warnHtml = `<li class="mt-2 pt-2 border-t border-border-light"><strong class="text-warning text-[0.65rem] uppercase tracking-widest">${safeT("Warnings")}</strong></li>${warn.map(w => `<li><i class="fa-solid fa-triangle-exclamation text-warning"></i> ${safeT(w)}</li>`).join('')}`;
                            warnEl.insertAdjacentHTML('beforeend', warnHtml);
                        }
                    }
                } else if (p.recovery && p.recovery.length > 0) {
                    document.getElementById('res-recovery-plan').innerHTML = p.recovery.map(r => `<li><i class="fa-solid fa-check text-primary"></i> ${safeT(r)}</li>`).join('');
                }

                // Render AI Nutrition Plan (Phase 3: deterministic generator + structured UI)
                if (p.aiResult.nutrition_plan) {
                    const aiN = p.aiResult.nutrition_plan;
                    const macrosHtml = nutritionRenderers.renderMacros(aiN, safeT, p.nutrition ? { pro: `${p.nutrition.pro}g`, carbs: `${p.nutrition.carbs}g`, fats: `${p.nutrition.fats}g` } : null);
                    document.getElementById('res-macros').innerHTML = macrosHtml;

                    const guidelines = (aiN.guidelines && Array.isArray(aiN.guidelines) && aiN.guidelines.length) ? aiN.guidelines : (aiN.notes || []);
                    const guidelinesContent = guidelines.length
                        ? `<ul class="protocol-list font-mono text-sm">${guidelines.map(g => `<li><i class="fa-solid fa-check text-primary"></i> ${safeT(g)}</li>`).join('')}</ul>`
                        : `<p class="text-secondary text-sm font-mono">${safeT("Focus on whole foods and hit your macro targets above.")}</p>`;

                    const mealPlanContent = nutritionRenderers.renderMealPlan(aiN, safeT) || `<p class="text-secondary text-sm font-mono">${safeT("Eat 4–5 balanced meals daily with protein at each.")}</p>`;

                    const mealTiming = aiN.meal_timing;
                    const preText = mealTiming?.pre_workout || '60–90 мин преди: въглехидрати + протеин (напр. овес, банан, суроватъчен протеин). Кофеин по избор 30–45 мин преди.';
                    const postText = mealTiming?.post_workout || 'В рамките на 1–2 часа: 40–60 g въглехидрати + 25–40 g протеин. Пример: пилешко месо, ориз и зеленчуци или суроватъчен протеин и банан.';
                    const mealTimingContent = `<ul class="protocol-list font-mono text-sm"><li><i class="fa-solid fa-clock text-primary"></i> <strong class="text-secondary">${safeT('Pre-workout')}:</strong> ${safeT(preText)}</li><li><i class="fa-solid fa-clock text-primary"></i> <strong class="text-secondary">${safeT('Post-workout')}:</strong> ${safeT(postText)}</li></ul>`;

                    let supplementStack = aiN.supplement_stack && Array.isArray(aiN.supplement_stack) ? aiN.supplement_stack : [];
                    if (supplementStack.length === 0) {
                        const goal = (p.meta && p.meta.goal) ? p.meta.goal : 'recomp';
                        const stacksBg = { fat_loss: [{ name: 'Кофеин', purpose: 'Производителност и фокус.', dose: '3–5 mg/kg преди тренировка.' }, { name: 'Суроватъчен или растителен протеин', purpose: 'Запазване на мускулна маса.', dose: '1–2 мерителни лъжици.' }, { name: 'Витамин D3', purpose: 'Имунна подкрепа.', dose: '2000–4000 IU дневно.' }, { name: 'Омега-3', purpose: 'Възстановяване.', dose: '2–3 g дневно.' }], muscle_gain: [{ name: 'Креатин монохидрат', purpose: 'Сила и мускулна маса.', dose: '5 g дневно.' }, { name: 'Суроватъчен или растителен протеин', purpose: 'Постигане на белтъчни цели.', dose: '1–2 мерителни лъжици.' }, { name: 'Витамин D3', purpose: 'Костно здраве.', dose: '2000–4000 IU дневно.' }, { name: 'Омега-3', purpose: 'Стави.', dose: '2–3 g дневно.' }], recomp: [{ name: 'Креатин монохидрат', purpose: 'Сила.', dose: '5 g дневно.' }, { name: 'Витамин D3', purpose: 'Здраве.', dose: '2000–4000 IU дневно.' }, { name: 'Омега-3', purpose: 'Възстановяване.', dose: '2–3 g дневно.' }, { name: 'Суроватъчен или растителен протеин', purpose: 'Удобство.', dose: '1–2 мерителни лъжици.' }], military: [{ name: 'Витамин D3', purpose: 'Имунитет.', dose: '2000–4000 IU дневно.' }, { name: 'Омега-3', purpose: 'Възстановяване.', dose: '2–3 g дневно.' }, { name: 'Креатин', purpose: 'Сила.', dose: '5 g дневно.' }, { name: 'Протеин', purpose: 'Удобство.', dose: 'При нужда.' }] };
                        supplementStack = stacksBg[goal] || stacksBg.recomp;
                    }
                    let supplementContent = '<ul class="protocol-list font-mono text-sm">';
                    supplementStack.forEach(s => { supplementContent += `<li><i class="fa-solid fa-capsules text-primary"></i> <strong class="text-primary">${safeT(s.name || '')}</strong> — ${safeT(s.purpose || '')} <span class="text-muted">(${safeT(s.dose || '')})</span></li>`; });
                    supplementContent += '</ul>';

                    const warningsContent = nutritionRenderers.renderNutritionWarnings(aiN, safeT);

                    const headerHtml = nutritionRenderers.renderNutritionHeader(aiN, safeT);

                    const nestedItems = [
                        { id: 'accordion-nutrition-guidelines', title: safeT('Nutrition guidelines section'), body: guidelinesContent },
                        { id: 'accordion-nutrition-meals', title: safeT('Nutrition meal plan section'), body: mealPlanContent },
                        { id: 'accordion-nutrition-meal-timing', title: safeT('Nutrition meal timing section'), body: mealTimingContent },
                        { id: 'accordion-nutrition-supplements', title: safeT('Nutrition supplements section'), body: supplementContent }
                    ];
                    if (warningsContent) nestedItems.push({ id: 'accordion-nutrition-warnings', title: safeT('Nutrition warnings section'), body: warningsContent });

                    let nutritionHtml = headerHtml;
                    nestedItems.forEach(({ id, title, body }) => {
                        nutritionHtml += `<div class="nested-accordion accordion-card is-closed" id="${id}">
                            <div class="nested-accordion-trigger accordion-trigger" data-accordion-id="${id}" tabindex="0" role="button" aria-expanded="false" aria-controls="${id}-body">
                                <span class="text-[0.65rem] uppercase tracking-widest text-primary font-bold">${title}</span>
                                <span class="accordion-toggle-icon" aria-hidden="true"><i class="accordion-chevron fa-solid fa-chevron-down" aria-hidden="true"></i></span>
                            </div>
                            <div class="accordion-body nested-accordion-body" id="${id}-body">${body}</div>
                        </div>`;
                    });
                    document.getElementById('res-nutrition-plan').innerHTML = nutritionHtml;
                }

                // Render AI Training Plan (every day: warm-up protocol at top + exercises with RPE & Tempo)
                if (p.aiResult.workout_plan) {
                    // [DEBUG] Log weekly plan before rendering; verify unique day structures
                    const wp = p.aiResult.workout_plan;
                    if (typeof wp !== 'undefined' && wp !== null) {
                        console.log('[ASCEND DEBUG] workout_plan before render:', JSON.stringify(wp.map((d) => ({ day: d.day, focus: d.focus, exNames: (d.exercises || []).map((e) => e?.name) })), null, 2));
                        const sigs = new Map();
                        for (let i = 0; i < wp.length; i++) {
                            const exNames = (wp[i].exercises || []).map((e) => e?.name).filter(Boolean).join('|');
                            if (exNames && sigs.has(exNames)) {
                                console.warn('[ASCEND DEBUG] Duplicate day structure detected: day', i, 'matches day', sigs.get(exNames), '- same exercises:', exNames.slice(0, 80) + '...');
                            } else if (exNames) {
                                sigs.set(exNames, i);
                            }
                        }
                    }
                    let aiHtml = '';
                    const defaultWarmup = 'Около 5 минути леко кардио и динамично разтягане за мускулните групи в тази тренировка.';
                    p.aiResult.workout_plan.forEach((w, idx) => {
                        const warmupText = (w.warmup && String(w.warmup).trim()) ? w.warmup : defaultWarmup;
                        const warmupHtml = `<div class="text-[0.7rem] mb-3 p-2 rounded bg-surface-hover border border-border-light text-secondary"><span class="text-primary font-bold uppercase text-[0.65rem] tracking-widest block mb-1">${safeT('Warm-up')}</span><span>${safeT(warmupText)}</span></div>`;

                        let exHtml = (w.exercises || []).map((e, exIdx) => {
                            const rpe = (e.rpe != null && e.rpe !== '') ? `${safeT('RPE')} ${e.rpe}` : '';
                            const tempo = (e.tempo != null && e.tempo !== '' && e.tempo !== '—') ? `${safeT('Tempo')} ${e.tempo}` : (e.tempo === '—' ? '—' : '');
                            const meta = [rpe, tempo].filter(Boolean).join(' · ');
                            const checkId = `ex-day-${idx}-${exIdx}`;
                            return `
                            <div class="exercise-row text-[0.7rem] mt-2 border-t border-border-light pt-2 text-secondary">
                                <input type="checkbox" class="exercise-checkbox" id="${checkId}" aria-label="${safeT("Mark exercise complete")}"/>
                                <label for="${checkId}" class="exercise-checkbox-custom" aria-hidden="true"></label>
                                <div class="exercise-content">
                                    <span class="text-primary font-bold block">${localizeExerciseName(e.name, safeT)}</span>
                                    <span>${e.sets} ${safeT('sets')} · ${e.reps} ${safeT('reps')} · ${safeT('Rest')}: ${e.rest}</span>
                                    ${meta ? `<span class="block mt-1 text-muted font-mono text-[0.65rem]">${meta}</span>` : ''}
                                </div>
                            </div>
                        `;
                        }).join('');

                        aiHtml += `
                        <div class="day-card accordion-card is-closed flex flex-col justify-start" id="accordion-day-${idx}">
                            <div class="day-header accordion-trigger border-b border-border-light pb-2 pt-2 text-xs tracking-widest flex items-center justify-between gap-2" data-accordion-id="accordion-day-${idx}" tabindex="0" role="button" aria-expanded="false" aria-controls="accordion-day-${idx}-body">
                                <span>${localizeDayHeader(w.day, safeT)}</span>
                                <span class="accordion-toggle-icon" aria-hidden="true"><i class="accordion-chevron fa-solid fa-chevron-down" aria-hidden="true"></i></span>
                            </div>
                            <div class="day-body accordion-body flex-grow" id="accordion-day-${idx}-body">
                                <div class="day-desc font-mono">
                                    <strong class="text-warning tracking-widest uppercase block text-center text-sm mb-3">${localizeFocusLabel(w.focus, safeT)}</strong>
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
                    <div class="macro-box"><div class="val text-primary">${p.nutrition.cals} ${safeT('kcal unit')}</div><div class="lbl">${safeT('macro kcal')}</div></div>
                    <div class="macro-box"><div class="val">${p.nutrition.pro}g</div><div class="lbl">${safeT('macro protein')}</div></div>
                    <div class="macro-box"><div class="val">${p.nutrition.carbs}g</div><div class="lbl">${safeT('macro carbs')}</div></div>
                    <div class="macro-box"><div class="val">${p.nutrition.fats}g</div><div class="lbl">${safeT('macro fats')}</div></div>
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

                    modulesHtml += `
                    <div class="day-card accordion-card is-closed" id="accordion-day-fb-${idx}">
                        <div class="day-header accordion-trigger flex items-center justify-between gap-2" data-accordion-id="accordion-day-fb-${idx}" tabindex="0" role="button" aria-expanded="false" aria-controls="accordion-day-fb-${idx}-body">
                            <span>${localizeDayHeader(t.day, safeT)}</span>
                            <span class="accordion-toggle-icon" aria-hidden="true"><i class="accordion-chevron fa-solid fa-chevron-down" aria-hidden="true"></i></span>
                        </div>
                        <div class="day-body accordion-body" id="accordion-day-fb-${idx}-body">
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

            // Phase 5: Progress history + adaptive summary
            const progressHistoryEl = document.getElementById('progress-history-list');
            const adaptiveSummaryEl = document.getElementById('adaptive-summary-container');
            const adaptiveContentEl = document.getElementById('adaptive-summary-content');
            if (progressHistoryEl) {
                const entries = getProgressHistory(user.email);
                progressHistoryEl.innerHTML = progressRenderers.renderProgressHistory(entries, safeT);
            }
            if (adaptiveSummaryEl && adaptiveContentEl) {
                const userProfile = p.meta ? { goal: p.meta.goal, weight: p.nutrition?.cals ? 80 : 80, limitations: p.meta?.limitations || 'none' } : { goal: 'recomposition', weight: 80, limitations: 'none' };
                const result = getRecommendationsFromLatest(user.email, userProfile, p.apiPlan);
                if (result) {
                    adaptiveSummaryEl.classList.remove('hidden');
                    adaptiveContentEl.innerHTML = progressRenderers.renderAdaptiveSummary(result.adaptation, safeT);
                    const recCard = document.getElementById('ai-recommendations-content');
                    if (recCard) {
                        recCard.innerHTML = progressRenderers.renderRecommendations(result.recommendations, safeT);
                    }
                } else {
                    adaptiveSummaryEl.classList.add('hidden');
                    const recCard = document.getElementById('ai-recommendations-content');
                    if (recCard) {
                        recCard.innerHTML = `<p class="text-muted" data-safe-i18n="Log progress to see personalized recommendations">${safeT('Log progress to see personalized recommendations')}</p>`;
                    }
                }
            }

            accordionModule.bind();
        }

        if (typeof window.safeI18nApply === 'function') window.safeI18nApply();

        // Populate Telemetry History
        dashModule.renderTelemetry(user);

        // Populate Plan History
        dashModule.renderHistory(user);

        // Reset tabs
        document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.sidebar-link[data-tab="active-protocol"]')?.classList.add('active');
        document.getElementById('tab-active-protocol')?.classList.add('active');

        // Ensure accordion delegation is bound (works for static + dynamically injected accordions)
        accordionModule.bind();
    },

    renderTelemetry: (user) => {
        let avgA = 0, avgE = 0, avgS = 0, avgWC = 0;
        let html = '';
        const len = user.telemetry.length;
        let latestWeight = '--', latestAdherence = '--', latestEnergy = '--';

        user.telemetry.forEach((t, i) => {
            if (i === 0) {
                latestWeight = t.weight;
                latestAdherence = t.adherence || '--';
                latestEnergy = t.energy != null ? t.energy : '--';
            }
            avgA += parseInt(t.adherence) || 0;
            avgE += parseInt(t.energy) || 0;
            avgS += parseInt(t.sleep) || 0;
            avgWC += parseInt(t.workouts) || 0;

            const waistStr = t.waist ? `${t.waist}` : '-';
            const sleepStr = t.sleep ? `${t.sleep}/10` : '-';
            const workStr = t.workouts ? `${t.workouts}%` : '-';

            const safeT = window.safeI18nT || langModule.t;
            html += `<tr>
                <td>${t.date}</td>
                <td>${t.weight}</td>
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
            const realWC = Math.round(avgWC / len);

            document.getElementById('tracker-weight').textContent = latestWeight;
            document.getElementById('tracker-adherence').textContent = latestAdherence;
            document.getElementById('tracker-energy').textContent = latestEnergy;

            const adhNum = parseInt(latestAdherence) || 0;
            const engNum = parseFloat(latestEnergy) || 0;
            setTimeout(() => {
                document.getElementById('tracker-adh-bar').style.width = `${adhNum}%`;
                document.getElementById('tracker-eng-bar').style.width = `${(engNum / 10) * 100}%`;
                document.getElementById('tracker-adh-bar').style.backgroundColor = adhNum > 85 ? 'var(--success)' : (adhNum > 70 ? 'var(--warning)' : 'var(--danger)');
            }, 100);

            // Telemetry stats displayed in Progress tab KPIs; progress form is in Recovery card
        } else {
            tb.innerHTML = '';
            empty.classList.remove('hidden');
        }
    },

    renderHistory: (user) => {
        let html = '';
        const safeT = window.safeI18nT || langModule.t;
        user.history.forEach((h, i) => {
            const titleMap = { fat_loss: safeT("PLAN: FAT LOSS"), muscle_gain: safeT("PLAN: BUILD MUSCLE"), recomp: safeT("PLAN: BODY RECOMPOSITION"), longevity: safeT("PLAN: OVERALL FITNESS"), military: safeT("PLAN: OVERALL FITNESS") };
            html += `
            <div class="history-card">
                <div>
                    <span class="badge mb-2">${safeT("ARCHIVED")}</span>
                    <h4 class="text-xl font-heading font-black tracking-widest">${titleMap[h.meta.goal] || safeT("PLAN: OVERALL FITNESS")}</h4>
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

        // Reset form and close modal
        document.getElementById('checkin-val-weight').value = '';
        document.getElementById('checkin-val-waist').value = '';
        document.getElementById('checkin-val-adherence').value = '';
        document.getElementById('checkin-val-workouts').value = '';
        document.getElementById('checkin-val-energy').value = '7';
        document.getElementById('checkin-val-sleep').value = '7';
        document.getElementById('checkin-val-notes').value = '';
        const energyOut = document.getElementById('energy-out');
        const sleepOut = document.getElementById('sleep-out');
        if (energyOut) energyOut.textContent = '7';
        if (sleepOut) sleepOut.textContent = '7';

        const overlay = document.getElementById('modal-checkin');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
        }

        dashModule.render(); // re-render: new row in History Log + update Your Progress stats (localStorage already updated)
    }
};

// ==========================================
// 6.5 MODAL HELPERS
// ==========================================
function toggleModal(modalId, show) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;
    if (show) {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        const energyEl = document.getElementById('checkin-val-energy');
        const sleepEl = document.getElementById('checkin-val-sleep');
        const energyOut = document.getElementById('energy-out');
        const sleepOut = document.getElementById('sleep-out');
        if (energyEl && energyOut) energyOut.textContent = energyEl.value;
        if (sleepEl && sleepOut) sleepOut.textContent = sleepEl.value;
    } else {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

// ==========================================
// 7. BOOTSTRAP & EVENTS
// ==========================================
async function initApp() {
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

    try {
        await restoreSession();
        const sessionUser = getSessionUser();
        if (sessionUser) {
            ensureLegacyUserForCloudSession(sessionUser);
        }
    } catch (e) {
        console.warn('[ASCEND] Session restore skipped:', e);
    }

    // Set active class on initial loader
    const activeBtn = document.getElementById(`lang-btn-${langModule.currentLanguage}`);
    if (activeBtn) activeBtn.classList.add('text-primary', 'font-bold');

    // Modals Close handlers: Cancel button and X
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) {
                overlay.classList.remove('active');
                overlay.setAttribute('aria-hidden', 'true');
            }
        });
    });

    // Close progress modal when clicking the overlay backdrop (outside the modal)
    const progressModalOverlay = document.getElementById('modal-checkin');
    if (progressModalOverlay) {
        progressModalOverlay.addEventListener('click', (e) => {
            if (e.target === progressModalOverlay) {
                progressModalOverlay.classList.remove('active');
                progressModalOverlay.setAttribute('aria-hidden', 'true');
            }
        });
    }

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
    if (navUserDashboard) navUserDashboard.addEventListener('click', (e) => {
        e.preventDefault();
        if (isCurrentUserAdmin()) app.navigate('entry');
        else app.navigate('welcome-onboarding');
    });

    const assessmentPauseBtn = document.getElementById('assessment-pause-btn');
    if (assessmentPauseBtn) assessmentPauseBtn.addEventListener('click', (e) => { e.preventDefault(); app.navigate('dashboard'); });

    const navUserAssessment = document.getElementById('nav-user-assessment');
    if (navUserAssessment) navUserAssessment.addEventListener('click', (e) => { e.preventDefault(); app.navigate('assessment'); });

    const onboardingStartBtn = document.getElementById('onboarding-start-btn');
    if (onboardingStartBtn) onboardingStartBtn.addEventListener('click', (e) => { e.preventDefault(); app.navigate('assessment'); });

    const sidebarRetakeBtn = document.getElementById('sidebar-retake-btn');
    if (sidebarRetakeBtn) sidebarRetakeBtn.addEventListener('click', (e) => { e.preventDefault(); app.navigate('assessment'); });

    const navUserLogout = document.getElementById('nav-user-logout');
    if (navUserLogout) navUserLogout.addEventListener('click', (e) => { e.preventDefault(); void app.logout(); });

    const adminLogoutBtn = document.getElementById('admin-logout-btn');
    if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', (e) => { e.preventDefault(); void app.logout(); });

    const entryBtnAdminPanel = document.getElementById('entry-btn-admin-panel');
    if (entryBtnAdminPanel) entryBtnAdminPanel.addEventListener('click', (e) => { e.preventDefault(); app.navigate('admin'); });

    const entryBtnOpenApp = document.getElementById('entry-btn-open-app');
    if (entryBtnOpenApp) entryBtnOpenApp.addEventListener('click', (e) => { e.preventDefault(); app.openApp(); });

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
    if (dashLogProgressBtn) dashLogProgressBtn.addEventListener('click', (e) => {
        e.preventDefault();
        dashModule.switchTab('progress-tracker', null);
        document.getElementById('tab-btn-progress')?.classList.add('active');
        toggleModal('modal-checkin', true);
    });

    const tabBtnHistory = document.getElementById('tab-btn-history');
    if (tabBtnHistory) tabBtnHistory.addEventListener('click', (e) => { e.preventDefault(); dashModule.switchTab('history', e); });

    // --- Dashboard Back button ---
    const dashboardBackBtn = document.getElementById('dashboard-back-btn');
    if (dashboardBackBtn) dashboardBackBtn.addEventListener('click', (e) => { e.preventDefault(); handleBackNavigation(); });

    // --- Phase 7/8: Advance Week (Regeneration Engine) ---
    const advanceWeekBtn = document.getElementById('advance-week-btn');
    if (advanceWeekBtn) {
        advanceWeekBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const user = db.getCurrentUser();
            if (!user?.active_protocol) return;
            const p = user.active_protocol;
            const userProfile = { goal: p.meta?.goal || p.goal || 'recomposition', weight: 80, primary_goal: p.meta?.goal || p.goal };
            const result = regenerateNextWeekProtocol(user.email, userProfile, p, p.apiPlan);
            if (result.status === 'completed') {
                dashModule.render();
                return;
            }
            if (result.status === 'advanced') {
                dashModule.render();
            }
        });
    }

    // --- Modals ---
    const trackerLogBtn = document.getElementById('tracker-log-btn');
    if (trackerLogBtn) trackerLogBtn.addEventListener('click', (e) => { e.preventDefault(); toggleModal('modal-checkin', true); });

    const modalSaveLogBtn = document.getElementById('modal-save-log-btn');
    if (modalSaveLogBtn) modalSaveLogBtn.addEventListener('click', (e) => { e.preventDefault(); dashModule.submitCheckin(); });

    // --- Phase 5: Progress entry form ---
    const progressFatigue = document.getElementById('progress-fatigue');
    const progressSleep = document.getElementById('progress-sleep');
    if (progressFatigue && document.getElementById('progress-fatigue-out')) {
        progressFatigue.addEventListener('input', () => { document.getElementById('progress-fatigue-out').textContent = progressFatigue.value; });
    }
    if (progressSleep && document.getElementById('progress-sleep-out')) {
        progressSleep.addEventListener('input', () => { document.getElementById('progress-sleep-out').textContent = progressSleep.value; });
    }
    const progressForm = document.getElementById('progress-entry-form');
    if (progressForm) {
        progressForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const user = db.getCurrentUser();
            if (!user) return;
            const injuriesRaw = (document.getElementById('progress-injuries')?.value || '').trim();
            const entry = {
                bodyWeight: document.getElementById('progress-body-weight')?.value,
                strengthChange: document.getElementById('progress-strength-change')?.value || 0,
                fatigueLevel: document.getElementById('progress-fatigue')?.value || 5,
                adherence: document.getElementById('progress-adherence')?.value,
                sleepScore: document.getElementById('progress-sleep')?.value || 7,
                injuries: injuriesRaw ? injuriesRaw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean) : [],
                improvementFlag: document.getElementById('progress-improvement')?.checked || false,
                healedFlag: document.getElementById('progress-healed')?.checked || false,
                notes: injuriesRaw
            };
            const result = saveProgressEntry(entry, user.email);
            if (!result.success) {
                alert((result.errors || []).join('\n'));
                return;
            }
            processProgressForRecovery(user.email, entry, user.active_protocol?.meta?.limitations || 'none', user.active_protocol?.basePlan || user.active_protocol?.apiPlan);
            const userProfile = { goal: user.active_protocol?.meta?.goal || 'recomposition', weight: 80, limitations: user.active_protocol?.meta?.limitations || 'none' };
            const recResult = getRecommendationsFromLatest(user.email, userProfile, user.active_protocol?.apiPlan);
            const adaptiveSummaryEl = document.getElementById('adaptive-summary-container');
            const adaptiveContentEl = document.getElementById('adaptive-summary-content');
            const recCard = document.getElementById('ai-recommendations-content');
            const safeT = window.safeI18nT || langModule.t;
            if (recResult) {
                if (adaptiveSummaryEl && adaptiveContentEl) {
                    adaptiveSummaryEl.classList.remove('hidden');
                    adaptiveContentEl.innerHTML = progressRenderers.renderAdaptiveSummary(recResult.adaptation, safeT);
                }
                if (recCard) {
                    recCard.innerHTML = progressRenderers.renderRecommendations(recResult.recommendations, safeT);
                }
            } else if (recCard) {
                recCard.innerHTML = `<p class="text-muted" data-safe-i18n="Log progress to see personalized recommendations">${safeT('Log progress to see personalized recommendations')}</p>`;
            }
            const progressHistoryEl = document.getElementById('progress-history-list');
            if (progressHistoryEl) {
                progressHistoryEl.innerHTML = progressRenderers.renderProgressHistory(getProgressHistory(user.email), safeT);
            }
            if (typeof window.safeI18nApply === 'function') window.safeI18nApply();
            progressForm.reset();
            document.getElementById('progress-fatigue').value = 5;
            document.getElementById('progress-sleep').value = 7;
            document.getElementById('progress-fatigue-out').textContent = '5';
            document.getElementById('progress-sleep-out').textContent = '7';
            const impEl = document.getElementById('progress-improvement');
            const healedEl = document.getElementById('progress-healed');
            if (impEl) impEl.checked = false;
            if (healedEl) healedEl.checked = false;
            const recoveryCard = document.getElementById('recovery-status-content');
            if (recoveryCard && typeof progressRenderers.renderRecoveryStatus === 'function') {
                recoveryCard.innerHTML = progressRenderers.renderRecoveryStatus(getInjuryState(user.email), safeT);
            }
        });
    }

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

    const usernameSetupForm = document.getElementById('username-setup-form');
    if (usernameSetupForm) {
        usernameSetupForm.addEventListener('submit', (e) => {
            e.preventDefault();
            void usernameModule.submit();
        });
    }

    const welcomeStartBtn = document.getElementById('welcome-start-btn');
    if (welcomeStartBtn) {
        welcomeStartBtn.addEventListener('click', (e) => {
            e.preventDefault();
            app.navigate('assessment');
        });
    }

    authModule.mountGoogleButton();

    // Check auth to route properly
    const user = db.getCurrentUser();
    if (user) {
        routeAfterAuth();
    } else {
        app.navigate('landing');
    }
}

// Run init when DOM is ready (handles ES module load-after-DOMContentLoaded race)
async function runInit() {
    try {
        await initApp();
    } catch (err) {
        console.error('[ASCEND] Startup error:', err);
        throw err;
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { void runInit(); });
} else {
    void runInit();
}

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
