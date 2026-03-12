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
        document.getElementById('auth-title').textContent = authModule.isSignup ? 'Create Account' : 'Login';
        document.getElementById('btn-auth-submit').textContent = authModule.isSignup ? 'Create Account' : 'Login';
        document.getElementById('auth-error').classList.add('hidden');
        
        const toggleTxt = document.getElementById('auth-toggle-text');
        if(authModule.isSignup) {
            toggleTxt.innerHTML = `Already have an account? <span class="text-primary hover-underline cursor-pointer font-bold" onclick="authModule.toggleMode()">Login</span>`;
        } else {
            toggleTxt.innerHTML = `No account yet? <span class="text-primary hover-underline cursor-pointer font-bold" onclick="authModule.toggleMode()">Create Account</span>`;
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
            err.textContent = "Please fill in all fields.";
            err.classList.remove('hidden'); return;
        }

        let success;
        if (authModule.isSignup) {
            success = db.createUser(em, pwd);
            if (!success) { err.textContent = "Email already registered."; err.classList.remove('hidden'); return; }
        } else {
            success = db.login(em, pwd);
            if (!success) { err.textContent = "Invalid email or password."; err.classList.remove('hidden'); return; }
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
                {val:'strength', label:'Strength Training', subtext:'Lifting heavy weights to build strength and muscle.', icon:'fa-anchor'},
                {val:'hybrid', label:'HIIT & Conditioning', subtext:'Fast-paced workouts to burn fat and get your heart pumping.', icon:'fa-stopwatch'},
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
        document.getElementById('step-label').textContent = `Step ${wizardModule.current + 1}`;
        document.getElementById('step-title').textContent = q.title;
        document.getElementById('wizard-progress').style.width = `${((wizardModule.current) / questions.length) * 100}%`;

        const form = document.getElementById('wizard-form');
        let html = '';

        q.fields.forEach(f => {
            const isVisible = f.condition ? f.condition(wizardModule.data) : true;
            const displayStyle = isVisible ? '' : 'display: none;';
            
            html += `<div class="question-block" id="block-${f.id}" style="${displayStyle}">
                        <span class="question-label">${f.label}</span>`;
            
            if (f.type === 'number') {
                const val = wizardModule.data[f.id] || '';
                html += `<input type="number" id="inp-${f.id}" class="input-modern w-full font-mono" placeholder="${f.placeholder}" value="${val}" oninput="wizardModule.handleInputChange()">`;
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
                            <span class="radio-label">${opt.label}</span>
                            ${opt.subtext ? `<span class="radio-subtext">${opt.subtext}</span>` : ''}
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
                        <span>MIN: ${f.min}</span>
                        <span class="text-primary text-xl font-bold" id="out-${f.id}">${val}</span>
                        <span>MAX: ${f.max}</span>
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
                        <div class="chip-content">${opt}</div>
                    </label>`;
                });
                html += `</div>`;
            }
            html += `</div>`;
        });

        form.innerHTML = html;

        document.getElementById('btn-prev-step').style.visibility = wizardModule.current === 0 ? 'hidden' : 'visible';
        document.getElementById('btn-next-step').innerHTML = wizardModule.current === questions.length - 1 ? 'Create Plan <i class="fa-solid fa-microchip ml-2"></i>' : 'Next Step <i class="fa-solid fa-angle-right ml-2"></i>';
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
            alert('Please complete all visible fields to proceed.'); return;
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
    generate: (data) => {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('active');

        let p = 0;
        const bar = document.getElementById('cyber-progress-bar');
        const txt = document.getElementById('loading-text');
        const logs = ["Analyzing your profile...", "Calculating nutrition targets...", "Building your workout plan...", "Finalizing your personal plan..."];
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
        const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const types = { strength: "Strength Focus", hybrid: "HIIT & Conditioning", bodyweight: "Bodyweight Focus", endurance: "Cardio & Endurance Phase" };
        
        for(let i=0; i<numDays; i++) {
            let n = i%2===0 ? types[a.style] : 'Active Recovery / Mobility';
            protocol.training.push({
                day: dayNames[i],
                name: n,
                desc: i===0 ? `Focus on your main goal, especially [${a.weakness ? a.weakness[0] : 'core fitness'}].` : "Build up your fitness and track progress."
            });
        }

        // Build Recovery Arrays
        const sleep = a.stress > 7 ? '8.5 hours' : '7.5 hours';
        protocol.recovery.push(`Aim for ${sleep} of quality sleep.`);
        if(a.injuries && !a.injuries.includes('None')) {
            protocol.recovery.push(`Daily mobility: 10 mins dedicated stretching/rehab for [${a.injuries.join(', ')}].`);
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
            obSlot.innerHTML = `<button class="btn btn-outline btn-large w-full mt-4 font-mono uppercase text-xs tracking-widest" onclick="app.navigate('assessment')">Resume Step ${user.assessment_state.step + 1}</button>`;
        } else {
            obSlot.innerHTML = '';
        }

        // Dashboard Sidebar Header
        document.getElementById('dash-username').textContent = user.email.split('@')[0];
        document.getElementById('dash-avatar').textContent = user.email.substring(0,2).toUpperCase();

        if (user.active_protocol) {
            const p = user.active_protocol;
            
            // Populate Protocol Context
            const titleMap = { fat_loss: "PLAN: FAT LOSS", muscle_gain: "PLAN: BUILD MUSCLE", recomp: "PLAN: BODY RECOMPOSITION", military: "PLAN: OVERALL FITNESS" };
            document.getElementById('dash-mission-type').textContent = titleMap[p.meta.goal];
            document.getElementById('dash-tier').textContent = p.meta.tier + " LEVEL";
            document.getElementById('res-training-style').textContent = p.meta.style;

            // Profile Stats
            document.getElementById('res-profile-stats').innerHTML = `
                <div class="stat-item"><span class="stat-label">Frequency</span><span class="stat-value"><i class="fa-solid fa-calendar-day text-primary mr-1 text-xs"></i> ${p.meta.days} Days / Wk</span></div>
                <div class="stat-item"><span class="stat-label">Status</span><span class="stat-value text-success"><i class="fa-solid fa-check text-success mr-1 text-xs"></i> Active</span></div>
                <div class="stat-item"><span class="stat-label">Deploy Date</span><span class="stat-value">${p.created_at}</span></div>
            `;

            // Nutrition
            document.getElementById('res-macros').innerHTML = `
                <div class="macro-box"><div class="val text-primary">${p.nutrition.cals}</div><div class="lbl">KCAL</div></div>
                <div class="macro-box"><div class="val">${p.nutrition.pro}g</div><div class="lbl">PRO</div></div>
                <div class="macro-box"><div class="val">${p.nutrition.carbs}g</div><div class="lbl">CARB</div></div>
                <div class="macro-box"><div class="val">${p.nutrition.fats}g</div><div class="lbl">FAT</div></div>
            `;
            
            const dietTitles = {balanced: "Balanced Nutrition", keto: "Keto Diet", fasting: "Intermittent Fasting"};
            const structTitles = {strict: "Strict Tracking", flexible: "Flexible/Intuitive"};
            document.getElementById('res-nutrition-plan').innerHTML = `
                <li><i class="fa-solid fa-check"></i> Diet: ${dietTitles[p.nutrition.diet] || p.nutrition.diet}</li>
                <li><i class="fa-solid fa-check"></i> Style: ${structTitles[p.nutrition.structure] || p.nutrition.structure}</li>
            `;

            // Recovery
            document.getElementById('res-recovery-plan').innerHTML = p.recovery.map(r => `<li><i class="fa-solid fa-droplet"></i> ${r}</li>`).join('');

            // Training Modules (Scroller)
            let modulesHtml = "";
            p.training.forEach((t) => {
                modulesHtml += `
                <div class="day-card">
                    <div class="day-header">${t.day}</div>
                    <div class="day-body">
                        <div class="day-desc font-mono">
                            <strong class="text-primary tracking-widest uppercase">${t.name}</strong><br>
                            <span class="text-xs uppercase mt-2 block opacity-80">${t.desc}</span>
                        </div>
                        <div class="mt-4"><span class="day-stat-chip"><i class="fa-solid fa-circle text-primary text-[0.45rem]"></i> To Do</span></div>
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
            
            html += `<tr>
                <td>${t.date}</td>
                <td>${t.weight} kg</td>
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

            // Update placeholder box on Active protocol 
            document.querySelector('.border-dashed').innerHTML = `
                <div>
                    <i class="fa-solid fa-radar text-primary text-3xl mb-2"></i>
                    <h4 class="text-xs font-bold uppercase text-primary font-mono tracking-widest mt-2">Overall Consistency: ${Math.round((realA + realWC)/2) || realA}%</h4>
                    <p class="text-[0.65rem] text-muted mt-1 uppercase font-mono tracking-widest">Diet: ${realA}% | Training: ${realWC}%</p>
                </div>
            `;
        } else {
            tb.innerHTML = '';
            empty.classList.remove('hidden');
        }
    },

    renderHistory: (user) => {
        let html = '';
        user.history.forEach((h, i) => {
            const titleMap = { fat_loss: "PLAN: FAT LOSS", muscle_gain: "PLAN: BUILD MUSCLE", recomp: "PLAN: BODY RECOMPOSITION", military: "PLAN: OVERALL FITNESS" };
            html += `
            <div class="history-card">
                <div>
                    <span class="badge mb-2">ARCHIVED</span>
                    <h4 class="text-xl font-heading font-black tracking-widest">${titleMap[h.meta.goal]}</h4>
                    <p class="text-secondary text-xs uppercase font-mono mt-1">Deployed: ${h.created_at}</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    <span class="day-stat-chip">Level: ${h.meta.tier}</span>
                    <span class="day-stat-chip">${h.nutrition.cals} kcal limit</span>
                </div>
            </div>`;
        });
        
        const grid = document.getElementById('history-grid');
        grid.innerHTML = html || '<p class="text-muted font-mono uppercase text-sm">[ No previous plans found ]</p>';
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
            alert('Core telemetry indices required for submission.'); 
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
