# Phase 2 — OpenAI AI Generation Layer — Deliverables

## Created Files

| File | Purpose |
|------|---------|
| `src/lib/openai/client.js` | OpenAI client wrapper: reads API key from env, timeout handling, safe error handling |
| `src/lib/openai/promptBuilder.js` | Builds prompts with system prompt, developer rules, user context, JSON schema |
| `src/api/ai/generate-plan.js` | API route implementation: normalize → classify → AI → validate → fallback |
| `api/ai/generate-plan.js` | Vercel serverless entry point for `/api/ai/generate-plan` |

## Changed Files

| File | Changes |
|------|---------|
| `src/lib/ai/generatePlan.js` | Added AI path: tries OpenAI first when available; rule engine always fallback. Exported `generateRulePlan`. |
| `src/lib/ai/index.js` | `runEngine` now async; exports `generateRulePlan` |
| `app.js` | `await runEngine(data)` (generate is async) |
| `package.json` | Added `openai` dependency, `"type": "module"` |
| `build.js` | Switched to ESM `import` for compatibility with `type: "module"` |

## Integration Points

```
Frontend (app.js)
    └── runEngine(rawInput)  [async] → generatePlan → AI or rule engine

API Route (POST /api/ai/generate-plan)
    └── normalizeInput → classifyUser → tryAIGeneration → validatePlan
        ├── AI valid → return AI plan
        └── AI fails → generateRulePlan → validatePlan → fallback if needed
```

- **`generatePlan(normalizedInput)`** — Async. Tries AI when `OPENAI_API_KEY` is set; otherwise uses rule engine.
- **`generateRulePlan(normalizedInput)`** — Sync. Rule-based plan only (always available).
- **`validatePlan(plan)`** — Validates and sanitizes any plan (AI or rule).
- **`generateFallbackPlan()`** — Minimal safe plan when validation fails.

## Example API Request

```bash
curl -X POST https://your-app.vercel.app/api/ai/generate-plan \
  -H "Content-Type: application/json" \
  -d '{
    "primary_goal": "muscle_gain",
    "experience": "intermediate",
    "equipment": "gym",
    "days": 4,
    "duration": 60,
    "age": 28,
    "gender": "male",
    "weight": 80,
    "height": 180,
    "activity": "moderate",
    "limitations": "none"
  }'
```

## Example API Response (AI Success)

```json
{
  "success": true,
  "source": "ai",
  "plan": {
    "planMeta": {
      "goal": "muscle_gain",
      "experienceLevel": "intermediate",
      "splitType": "push_pull_legs",
      "trainingDaysPerWeek": 4,
      "sessionDurationMin": 60,
      "equipmentAccess": "gym",
      "difficulty": "moderate"
    },
    "userSummary": {
      "classificationLabel": "Intermediate · Muscle Gain · 4x/week",
      "recoveryProfile": "moderate",
      "scheduleProfile": "standard",
      "notes": []
    },
    "weeklyPlan": [
      {
        "dayIndex": 1,
        "dayName": "Monday",
        "focus": "Push (Chest, Shoulders, Triceps)",
        "sessionType": "hypertrophy",
        "durationMin": 60,
        "warmup": [{ "name": "Light cardio + dynamic stretches", "durationMin": 5 }],
        "mainBlocks": [
          {
            "blockName": "Push",
            "exerciseType": "compound",
            "exercises": [
              { "name": "Bench Press", "sets": 4, "reps": "8-10", "restSec": 90, "intensity": "moderate", "notes": "" }
            ]
          }
        ],
        "cooldown": [{ "name": "Static stretching", "durationMin": 5 }]
      }
    ],
    "progressionRules": {
      "method": "Double progression: weight and reps",
      "weeklyAdjustment": "Add volume or intensity when RPE allows",
      "deloadTrigger": "When performance drops or fatigue is high"
    },
    "recoveryGuidance": {
      "restDayCount": 3,
      "sleepTargetHours": "7-9",
      "hydrationGuidance": "2.5-3.5 L water daily; more on training days."
    },
    "warnings": []
  }
}
```

## Example API Response (Fallback)

```json
{
  "success": true,
  "source": "fallback",
  "plan": {
    "planMeta": { "goal": "recomposition", "experienceLevel": "beginner", ... },
    "userSummary": { ... },
    "weeklyPlan": [ ... ],
    "progressionRules": { ... },
    "recoveryGuidance": { ... },
    "warnings": ["This is a fallback plan. Retake the assessment for a personalized plan."]
  }
}
```

## Environment Variable

Set in Vercel Dashboard → Settings → Environment Variables:

```
OPENAI_API_KEY=sk-...
```

## Constraints Enforced

- **Never expose OpenAI key to frontend** — Key read only from `process.env` on server
- **Never trust raw AI output** — All AI output parsed and validated via `validatePlan`
- **Always validate AI result** — `validatePlan` must pass before returning AI plan
- **Fallback must always work** — Rule engine or `generateFallbackPlan` used when AI fails
