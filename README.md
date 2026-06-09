# RecruitFlow 🚀
**Autonomous AI-Powered HR Recruitment Pipeline**

> End-to-end candidate ingestion, 6-dimension AI scoring, assessment portal, and interview scheduling — powered by Google Gemini, Firebase Firestore, and FastAPI.

---

## ✨ Features

- 📄 **CV Ingestion** — Drag-and-drop PDF upload with Gemini AI parsing
- 🧠 **6-Dimension AI Scoring** — Technical Skills, Experience, Assessment, Communication, Cultural Fit, Engagement
- 📊 **Live Dashboard** — Real-time candidate pipeline with score visualization
- 📝 **Assessment Portal** — Token-gated coding + MCQ assessments
- 📅 **Interview Scheduling** — Google Calendar integration
- 📧 **Email Notifications** — Gmail SMTP (free tier)
- 🔐 **Firebase Auth** — HR user authentication
- ⚡ **Bulk Import** — CSV dataset ingestion via `/api/candidates/bulk-import`
- 🛡️ **Mock Mode** — Runs fully offline with local JSON mock database

---

## 🏗️ Architecture

```
React Frontend (Vite + Tailwind)
        │  axios HTTP
        ▼
FastAPI Backend (Python 3.12)
        │
        ├──▶ Firebase Firestore (candidate data)
        ├──▶ Firebase Storage (CV files)
        ├──▶ Google Gemini AI (CV parsing + scoring)
        ├──▶ Gmail SMTP (email notifications)
        ├──▶ Google Calendar API (scheduling)
        └──▶ Celery + Redis (async task queue)
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Firebase JS SDK |
| Backend | FastAPI, Python 3.12, Pydantic v2 |
| Database | Firebase Firestore |
| Storage | Firebase Storage |
| AI Engine | Google Gemini (free tier) |
| Email | Gmail SMTP |
| Task Queue | Celery + Redis |
| Auth | Firebase Authentication |
| Deployment | Docker, Railway (API), Vercel (Frontend) |

---

## 🚀 Quick Start

### Prerequisites

- Node.js v20+
- Python 3.12+
- A [Firebase project](https://console.firebase.google.com/) with Firestore + Storage + Auth enabled
- A free [Gemini API key](https://aistudio.google.com/)

### 1. Clone & Configure

```bash
git clone https://github.com/your-username/recruitflow.git
cd recruitflow

# Copy environment template and fill in your values
cp .env.example .env
```

Open `.env` and fill in:
- `VITE_FIREBASE_*` — from Firebase Console → Project Settings
- `GEMINI_API_KEY` — from [Google AI Studio](https://aistudio.google.com/)
- `EMAIL_USER` / `EMAIL_PASS` — your Gmail + [App Password](https://support.google.com/accounts/answer/185833)
- `FIREBASE_SERVICE_ACCOUNT_PATH` — path to your downloaded `serviceAccountKey.json`
- `FIREBASE_STORAGE_BUCKET` — your Firebase storage bucket name

### 2. Place Service Account Key

Download your Firebase service account key from:
**Firebase Console → Project Settings → Service Accounts → Generate new private key**

Save it as `serviceAccountKey.json` in the project root.

### 3. Run with Docker (Recommended)

```bash
# Start backend + Redis + Celery workers
docker-compose up --build

# In a new terminal, start the frontend dev server
cd frontend
npm install
npm run dev
```

- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/api/docs

### 4. Run Manually (Development)

```bash
# Terminal 1 — Backend
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev

# Optional: Terminal 3 — Celery Worker (for async pipeline)
celery -A backend.celery_app worker --loglevel=info
```

### 5. Bulk Import Test Data

```bash
# Import 1000 synthetic candidates from the CSV dataset
python -u backend/bulk_import.py
```

---

## ☁️ Deployment

### Backend → [Railway](https://railway.app)

1. Connect your GitHub repo at Railway
2. Set **Root Directory** to `/` (project root)
3. Railway auto-detects `railway.toml` and uses `backend/Dockerfile`
4. Add all environment variables from `.env.example` in Railway's dashboard
5. Upload `serviceAccountKey.json` contents as a `FIREBASE_SERVICE_ACCOUNT_JSON` env var (see `firebase_admin_init.py` for inline JSON support)

### Frontend → [Vercel](https://vercel.com)

1. Connect your GitHub repo at Vercel
2. Set **Root Directory** to `frontend/`
3. Vercel auto-detects `vercel.json` — no extra config needed
4. Add these environment variables in Vercel's dashboard:
   - All `VITE_FIREBASE_*` variables
   - `VITE_API_URL=https://your-railway-api.railway.app`

---

## 📡 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | None | Health check |
| `POST` | `/api/candidates/upload` | None | Upload PDF CV |
| `POST` | `/api/candidates/bulk-import` | None | Bulk import JSON list |
| `GET` | `/api/candidates` | Bearer token | List candidates |
| `GET` | `/api/candidates/{id}` | Bearer token | Get candidate details |
| `POST` | `/api/assessments/submit` | None | Submit assessment |
| `GET` | `/api/assessments/{token}` | None | Get assessment by token |
| `GET` | `/api/schedule` | Bearer token | Get interview slots |
| `POST` | `/api/schedule` | Bearer token | Book interview slot |
| `GET` | `/api/jobs` | Bearer token | List jobs |
| `POST` | `/api/jobs` | Bearer token | Create job |

**Interactive API docs**: `http://localhost:8001/api/docs`

---

## 🧮 6-Dimension Scoring Rubric

| Dimension | Description |
|-----------|-------------|
| **Technical Skills** | Gemini AI matches CV skills vs job requirements |
| **Experience** | Seniority level, years, domain expertise |
| **Assessment** | MCQ + coding + open-ended test performance |
| **Communication** | CV quality, language clarity |
| **Cultural Fit** | Role persona matching |
| **Engagement** | Response speed and interaction quality |

---

## 📁 Project Structure

```
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── config.py                  # Pydantic settings (all env vars)
│   ├── firebase_admin_init.py     # Firebase Admin SDK + Mock fallback
│   ├── firebase_admin_init_mock.py # Local mock Firestore/Storage
│   ├── bulk_import.py             # CSV dataset bulk importer
│   ├── app/
│   │   ├── routes/candidates.py   # /api/candidates/upload & bulk-import
│   │   ├── models/candidate.py    # CandidateApplication, ScoreRubric
│   │   └── agents/cv_parser_agent.py # Gemini AI CV parser
│   ├── routes/
│   │   ├── candidates.py          # /api/candidates list & detail
│   │   ├── assessments.py         # /api/assessments endpoints
│   │   └── schedule.py            # /api/schedule endpoints
│   ├── services/
│   │   ├── firestore_service.py   # Firestore CRUD helpers
│   │   ├── storage_service.py     # Firebase Storage helpers
│   │   └── email_service.py       # Gmail SMTP email sender
│   ├── tasks/pipeline_tasks.py    # Celery async task chain
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # React Router + connection test
│   │   ├── components/
│   │   │   ├── FileUpload.jsx     # CV drag-and-drop upload
│   │   │   └── Dashboard.jsx      # Candidate pipeline table
│   │   └── pages/
│   │       ├── Login.jsx          # Firebase Auth login
│   │       ├── Assessment.jsx     # Candidate assessment portal
│   │       └── Schedule.jsx       # Interview calendar
│   ├── vercel.json                # Vercel deployment config
│   ├── vite.config.js
│   └── package.json
├── .github/workflows/ci.yml       # GitHub Actions CI/CD
├── docker-compose.yml             # Full stack Docker setup
├── railway.toml                   # Railway deployment config
├── firestore.rules                # Firebase security rules
├── .env.example                   # Environment variable template
└── README.md
```

---

## 🔒 Security Notes

- **Never commit `.env` or `serviceAccountKey.json`** — both are in `.gitignore`
- The `JWT_SECRET_KEY` must be a random 32+ character string in production
- Gmail App Passwords are single-app passwords — not your real account password
- Firebase Firestore security rules are in `firestore.rules` — deploy them via Firebase CLI

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
