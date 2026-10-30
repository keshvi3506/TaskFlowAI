[![CI Pipeline](https://github.com/keshvi3506/TaskFlowAI/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/keshvi3506/TaskFlowAI/actions/workflows/ci.yml)

# TaskFlow AI — Practical 13 (ITUE301)

A full-stack task manager with CRUD operations and a secure Groq-powered task description generator.

## Requirements
- Node.js 18 or newer
- npm
- A Groq API key from https://aistudio.google.com/app/apikey (required for live AI generation; task management still works without it)

## Run locally

### 1. Backend
Open PowerShell in the `backend` folder:

```powershell
npm install
Copy-Item .env.example .env
```

Open `backend/.env` and paste your key after `GROQ_API_KEY=`. Keep this file private; it is ignored by Git.

Then run:

```powershell
npm run dev
```

Backend: http://localhost:5000

### 2. Frontend
Open a second PowerShell terminal in the `frontend` folder:

```powershell
npm install
npm run dev
```

Open the URL printed by Vite, normally http://localhost:5173.

## Features
- Create, list, complete/reopen, and delete tasks.
- Task priority (Low, Medium, High).
- Real Groq-generated task descriptions through the Express backend using Google's `generateContent` REST API.
- `GET /api/ai/status` reports whether a server-side key is configured without exposing the key.
- API key stored only in backend `.env`.
- Loading state, editable AI suggestion, visible AI disclaimer, fallback message, 20-second timeout.
- Simple one-request-per-task-key-per-minute rate limit.
- Tasks persist locally in `backend/data/tasks.json`.

## Configure live Groq AI
1. Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Copy `backend/.env.example` to `backend/.env` (PowerShell: `Copy-Item .env.example .env` while inside `backend`).
3. Set `GROQ_API_KEY` to your key. Keep it private; never put it in frontend files or GitHub.
4. Restart the backend after editing `.env`. The sidebar should show **Groq API connected**.
5. Enter a task title and click **Generate with AI**. A real response is returned by the Groq model and inserted into the editable description field.

The backend calls `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` and sends the key in the `x-goog-api-key` header. If Groq fails or times out, the task manager remains usable and displays a clearly identified fallback.

## API endpoints
- `GET /api/health`
- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/ai/generate-description` with `{ "title": "..." }`

## Responsible AI
Do not send passwords, personal identifiers, confidential company information, private student records, or sensitive data to an external AI service. Treat generated text as a suggestion and review it before use.

## Note on persistence
For this quick practical implementation, tasks are stored in a local JSON file on the backend rather than a hosted database. This keeps the project runnable without database setup.


## AI provider note
This practical uses the Groq hosted inference API and the `openai/gpt-oss-20b` model. This is a genuine external AI API call, not a hardcoded response. Groq's free-plan access is subject to account and model rate limits. The college practical brief specifically names OpenAI or Gemini; confirm with your faculty that Groq is acceptable as an alternative provider.

## Practical 12 — CI/CD Pipeline with GitHub Actions

This repository uses GitHub Actions for Continuous Integration. Every push to the
`main` branch triggers the workflow at `.github/workflows/ci.yml`.

The workflow checks out the repository, sets up Node.js 20, installs backend
dependencies, and runs the automated API tests using Vitest and Supertest.

### Run backend tests locally

From the repository root:

```powershell
cd backend
npm install
npm test
```

### Pipeline demonstration

1. Push the workflow and tests to `main`.
2. Open the repository's **Actions** tab and verify that the CI Pipeline passes.
3. To demonstrate a failure, temporarily change an expected value in
   `backend/tests/api.test.js` (for example, expect status `201` instead of `200`).
4. Commit and push that intentional test change. Open the Actions run and inspect
   the failed test log (red X).
5. Restore the correct expected value (`200`), commit, and push again.
6. Confirm the latest run passes (green check).
7. Capture screenshots of the failed and successful runs for the practical journal.

Do not leave the deliberately broken test in the final submitted version.
