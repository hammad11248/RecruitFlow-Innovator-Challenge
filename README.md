# RecruitFlow 🚀
**Autonomous AI-Powered HR Recruitment Pipeline with Dual-Portal Evaluation System**

> End-to-end candidate ingestion, 6-dimension AI scoring, role-based dual portals (Candidate + HR), interactive leaderboard, and interview scheduling — powered by Google Gemini, Firebase Firestore, FastAPI, and unified Vercel monorepo.

---

## ✨ Features

### Core Pipeline
- 📄 **CV Ingestion**
  * **Functionality:** Drag-and-drop PDF upload with automated AI text parsing.
  * **Technologies:** FastAPI (file streams & upload handles), Python `python-docx`, Google Gemini API (`gemini-1.5-flash`), React (drag-and-drop UI).
- 🧠 **6-Dimension AI Scoring**
  * **Functionality:** Evaluates Technical Skills, Experience, Assessment, CV Quality, Cultural Fit, and Engagement.
  * **Technologies:** Google Gemini API (dimension evaluation), Custom Python scoring algorithms (`scoring_engine.py`), Pydantic v2 (type validation).
- 📝 **Assessment Portal**
  * **Functionality:** Token-gated coding challenges, multiple-choice questions (MCQs), and open-ended assessments.
  * **Technologies:** React (dynamic forms & timers), FastAPI Router, JSON Web Tokens (JWT) for link access, Firebase Firestore.
- 📅 **Interview Scheduling**
  * **Functionality:** Direct, real-time booking of interview slots into Google Calendar.
  * **Technologies:** Google Calendar API, Google Auth OAuthlib, React custom scheduling grid.
- 📧 **Email Notifications**
  * **Functionality:** Automated email notifications triggered by pipeline stage movements.
  * **Technologies:** Gmail SMTP server, Python standard `smtplib`/`email` packages, in-process asyncio background task queue.
- ⚡ **Bulk Import**
  * **Functionality:** Batch ingestion of candidate profiles and datasets via `/api/candidates/bulk-import`.
  * **Technologies:** FastAPI Streaming API, Python `csv` package, Firebase Firestore batch operations.
- 🛡️ **Mock Mode**
  * **Functionality:** Run the entire application locally and offline without external API connections.
  * **Technologies:** LocalStorage mock auth, Mock Axios interceptors, Local JSON database files (`firebase_admin_init_mock.py`).

### Dual-Portal System
- 👤 **Candidate Portal** (`/candidate/:id`)
  * **Functionality:** A public, personal candidate dashboard providing reassuring, constructive feedback.
  * **Technologies:** React 18, React Router v6, Tailwind CSS, custom SVG animations, Axios client.
- 📊 **HR Command Center** (`/hr`)
  * **Functionality:** Secured dashboard featuring candidate rankings, detailed breakdowns, search, and a drill-down drawer.
  * **Technologies:** React 18, Firebase Authentication (client token management), FastAPI security dependencies (`verify_firebase_token`).
- 🔐 **Role-Based Data Separation**
  * **Functionality:** Prevents candidates from accessing administrative HR remarks, raw AI rationale, and passing thresholds.
  * **Technologies:** FastAPI Pydantic serialization models (different schemas for candidate view vs. HR view).
- 🏆 **Interactive Leaderboard**
  * **Functionality:** Sortable candidates list with inline dimension meters, rank medals, and search tags.
  * **Technologies:** React state hooks, CSS grid, Lucide React icons, Axios interceptors.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│                  (Vite + Tailwind CSS v3)                        │
│                                                                 │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │  Candidate Portal │    │  HR Command Center│                  │
│  │  /candidate/:id   │    │  /hr (Protected)  │                  │
│  │  • Aggregate Gauge│    │  • Leaderboard    │                  │
│  │  • 6 Radial Scores│    │  • Search/Filter  │                  │
│  │  • Timeline       │    │  • Drill-Down     │                  │
│  │  • Public Access  │    │  • Full Analytics │                  │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │  axios                │  axios + Bearer Token        │
└───────────┼───────────────────────┼─────────────────────────────┘
            │                       │
            ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Vercel Serverless Backend (Python 3.12)            │
│                                                                 │
│  /api/candidate-portal/:id ──── Sanitized View (no HR data)     │
│  /api/hr/leaderboard ────────── Ranked list + dimensions        │
│  /api/hr/candidate/:id/drill-down ── Full analytical breakdown  │
│                                                                 │
│  ├──▶ Firebase Firestore (candidate data + scores)              │
│  ├──▶ Firebase Storage (CV files)                               │
│  ├──▶ Google Gemini AI (CV parsing + scoring)                   │
│  ├──▶ Gmail SMTP (email notifications)                          │
│  ├──▶ Google Calendar API (interview scheduling)                │
│  └──▶ Asyncio task queue (in-process background worker)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Tech Stack

### Technology Matrix

| Layer | Primary Technologies | Key Libraries & Packages | Purpose & Function |
| :--- | :--- | :--- | :--- |
| **Frontend Core** | React 18, Vite | `react-router-dom` (v6) | Routing, compilation, hot reloading, single-page application structure. |
| **Styling & Icons** | Tailwind CSS v3 | `lucide-react`, standard CSS keyframes | Modern design system, typography, icons, custom micro-animations. |
| **HTTP client** | Axios | Axios instance with Interceptors | Attaches Firebase Auth ID tokens to secure request headers. |
| **Backend Core** | FastAPI (Python 3.12) | `uvicorn`, `pydantic` (v2) | High-performance async REST API, validation schemas, and system settings. |
| **Database** | Firebase Firestore | `firebase-admin` SDK (Python) | Serverless candidate state storage, pipeline logs, and real-time updates. |
| **File Storage** | Firebase Storage | Google Cloud Storage client | Holds candidates' uploaded CV/resume PDF files. |
| **AI Integration** | Google Gemini | `google-generativeai` SDK | Automates extraction of profile data and calculates multi-dimension CV scores. |
| **Background Tasks**| Asyncio Worker | Native `asyncio.Queue` | Handles slow asynchronous operations like CV uploads and notifications. |
| **Communications** | SMTP Mailer | Python `smtplib`, `email.mime` | Dispatches assessment links and interview updates via Gmail SMTP. |
| **Calendar Sync** | Google Calendar API | `google-api-python-client`, `oauth2client` | Synchronizes, verifies, and schedules real interview slots. |
| **Authentication** | Firebase Auth / JWT | `PyJWT` (Python), Firebase client SDK | HR auth portal credentials; secure link tokens for candidates. |
| **Deployment** | Vercel Monorepo | `vercel.json` | Unified static client building and Python serverless function execution. |

---

## 🔧 Local Setup

### Prerequisites

- Node.js v20+
- Python 3.12+
- A [Firebase project](https://console.firebase.google.com/) with Firestore + Storage + Auth enabled
- A free [Gemini API key](https://aistudio.google.com/)

### 1. Clone & Configure

```bash
git clone https://github.com/your-username/recruitflow.git
cd recruitflow

# Copy environment template and fill in your values (macOS / Linux)
cp .env.example .env
```

On Windows PowerShell:

```powershell
git clone https://github.com/your-username/recruitflow.git
Set-Location .\recruitflow
# Copy environment template
Copy-Item .env.example .env
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

### 3. Run Manually (Development)

Quick start (Windows PowerShell):

```powershell
# Terminal 1 — Backend
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload

# Terminal 2 — Frontend
Set-Location .\frontend
npm install
npm run dev
```

Quick start (macOS / Linux):

```bash
# Terminal 1 — Backend
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev
```

- **Frontend**: http://localhost:5173
- **HR dashboard**: http://localhost:5173/hr
- **Candidate portal**: http://localhost:5173/candidate/{candidateId}
- **API Docs**: http://localhost:8001/api/docs
- **API health**: http://localhost:8001/api/health

---

## 🌐 Portal Access Guide

### Candidate Portal (Public)

Candidates access their personal dashboard via a unique URL:

```
http://localhost:5173/candidate/{candidateId}
```

**What candidates see:**
- ✅ Overall aggregate score (animated SVG circular rings)
- ✅ 6-dimension radial score charts (Technical Skills, Experience, Assessment, CV Quality, Cultural Fit, Engagement)
- ✅ Application pipeline timeline with real-time status updates
- ✅ Completion progress bar and completed module badges
- ✅ Assessment CTA button (when assessment is pending)
- ✅ Interview schedule details (when scheduled)

**What candidates do NOT see:**
- ❌ AI reasoning/rationale behind scores
- ❌ Screening thresholds or pass/fail criteria
- ❌ Other candidates' data or rankings
- ❌ Raw CV parsing data or admin notes

### HR Command Center (Authenticated)

HR personnel log in at `/login` and access the command center at `/hr`:

```
http://localhost:5173/hr
```

**What HR sees:**
- 📊 6 analytics stat cards (Total, Passed, Scored, Interviews, Avg Score, Top Performer)
- 🏆 Sortable leaderboard with rank badges and inline 6-dimension progress meters
- 🔍 Full-text search by name/email + status filter chips
- 📋 Tabbed drill-down drawer per candidate:
  - **Overview** — Score metrics + matching summaries + capabilities list
  - **Dimensions** — Full 6-dimension breakdown with evaluation progress bars
  - **Profile** — Skills, experience, target positions, CV download
  - **Timeline** — Milestone stepper history with evaluation status

---

## ☁️ Vercel Deployment

RecruitFlow is configured as a unified Vercel monorepo. Both the frontend and backend deploy automatically under the same project domain.

### Deployment Instructions:

1. Commit and push the code changes to your GitHub repository.
2. Go to the **[Vercel Dashboard](https://vercel.com/)** and click **Add New -> Project**.
3. Select your repository.
4. Keep the **Root Directory** empty (Vercel will parse the root `vercel.json` file).
5. Under **Environment Variables**, add the environment keys required by your backend:
   * `FIREBASE_SERVICE_ACCOUNT_JSON` (Paste the raw JSON string content of your private key `serviceAccountKey.json`).
   * `FIREBASE_STORAGE_BUCKET` (e.g. `your-project-id.appspot.com`).
   * `GEMINI_API_KEY`
   * `JWT_SECRET_KEY`
   * `EMAIL_USER` / `EMAIL_PASS` (Gmail SMTP credentials).
   * `GOOGLE_CALENDAR_ID`
6. Click **Deploy**. Vercel will build the frontend React assets and run the backend as Python serverless functions, mapping `/api/*` requests natively without CORS configuration.

---

## 📡 API Reference

### Core Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/health` | None | Health check |
| `POST` | `/api/candidates/upload` | None | Upload PDF/DOCX CV |
| `POST` | `/api/candidates/bulk-import` | None | Bulk import JSON list |
| `GET` | `/api/candidates` | Bearer token | List candidates |
| `GET` | `/api/candidates/{id}` | Bearer token | Get candidate details |
| `POST` | `/api/assessments/submit` | None | Submit assessment |
| `GET` | `/api/assessments/{token}` | None | Get assessment by token |
| `GET` | `/api/schedule` | Bearer token | Get interview slots |
| `POST` | `/api/schedule` | Bearer token | Book interview slot |
| `GET` | `/api/jobs` | Bearer token | List jobs |
| `POST` | `/api/jobs` | Bearer token | Create job |

### Evaluation Portal Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/candidate-portal/{id}` | **None** (public) | Sanitized candidate dashboard data |
| `GET` | `/api/hr/leaderboard` | Bearer token | Ranked candidate leaderboard with filters |
| `GET` | `/api/hr/candidate/{id}/drill-down` | Bearer token | Full analytical breakdown for HR |

**Interactive API docs**: `http://localhost:8001/api/docs`

---

## 🧮 6-Dimension Scoring Rubric

| # | Dimension | Weight | Description |
|---|-----------|--------|-------------|
| D1 | **Technical Skills** | 30% | Gemini AI matches CV skills vs job requirements (exact, semantic, inferred) |
| D2 | **Experience & Seniority** | 20% | Years of experience, seniority level match, domain expertise, leadership signals |
| D3 | **Assessment Performance** | 25% | MCQ + coding + open-ended test scores with speed bonus and resubmission penalty |
| D4 | **CV Quality & Communication** | 10% | Clarity, structure, quantified achievements, grammar & professionalism |
| D5 | **Cultural & Role Fit** | 10% | Role persona matching, communication style, growth mindset indicators |
| D6 | **Response Time & Engagement** | 5% | Time from assessment sent → submitted (<24h = 100, >72h = 25) |

---

## 📁 Project Structure

```
├── backend/
│   ├── main.py                    # FastAPI app entry point + router registry
│   ├── config.py                  # Pydantic settings (all env vars)
│   ├── firebase_admin_init.py     # Firebase Admin SDK + Mock fallback
│   ├── firebase_admin_init_mock.py # Local mock Firestore/Storage
│   ├── bulk_import.py             # CSV dataset bulk importer
│   ├── api/
│   │   └── index.py               # Vercel serverless python handler
│   ├── agents/
│   │   ├── cv_parser_agent.py     # Gemini AI CV parser (D1, D2, D4)
│   │   ├── scoring_engine.py      # 6-dimension scoring calculations
│   │   └── evaluator.py           # Assessment evaluation pipeline (D3, D5, D6)
│   ├── routes/
│   │   ├── candidates.py          # /api/candidates list, detail, & bulk import
│   │   ├── assessments.py         # /api/assessments endpoints
│   │   ├── schedule.py            # /api/schedule endpoints
│   │   ├── auth.py                # Firebase token verification
│   │   └── evaluation.py          # Dual-portal endpoints (candidate + HR)
│   ├── models/
│   │   ├── candidate.py           # Pydantic models + 6-dimension types
│   │   ├── assessment.py          # Assessment submission models
│   │   └── job.py                 # Job posting models
│   ├── services/
│   │   ├── firestore_service.py   # Firestore CRUD helpers
│   │   ├── storage_service.py     # Firebase Storage helpers
│   │   ├── email_service.py       # Gmail SMTP email sender
│   │   ├── calendar_service.py    # Google Calendar API
│   │   └── task_queue_service.py  # Local/Vercel task queue service
│   └── tasks/pipeline_tasks.py    # Background task executor logic
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # React Router (6 routes)
│   │   ├── main.jsx               # Entry point + AuthProvider
│   │   ├── firebase.js            # Firebase SDK + mock mode
│   │   ├── index.css              # Design system + animations
│   │   ├── api/
│   │   │   └── client.js          # Axios instance with auth interceptor
│   │   ├── context/
│   │   │   └── AuthContext.jsx    # Firebase Auth context
│   │   ├── hooks/
│   │   │   ├── useAuth.js         # Auth hook
│   │   │   ├── useCandidates.js   # Real-time candidates hook
│   │   │   └── useAssessment.js   # Assessment data hook
│   │   ├── components/
│   │   │   ├── RadialScore.jsx    # Animated SVG radial/donut chart
│   │   │   ├── AggregateGauge.jsx # Semicircular gauge with gradient
│   │   │   ├── TimelineStepper.jsx# Animated pipeline timeline
│   │   │   ├── LeaderboardTable.jsx# Sortable leaderboard with ranks
│   │   │   ├── DrillDownDrawer.jsx# Tabbed HR drill-down panel
│   │   │   ├── FactorBreakdownChart.jsx # Horizontal bar chart
│   │   │   ├── ScoreRadar.jsx     # 6-axis radar chart
│   │   │   ├── ScoreBar.jsx       # Linear score bar
│   │   │   ├── StatusPill.jsx     # Color-coded status badge
│   │   │   ├── FileUpload.jsx     # CV drag-and-drop upload
│   │   │   ├── CalendarGrid.jsx   # Calendar component
│   │   │   └── ProtectedRoute.jsx # Auth guard
│   │   └── pages/
│   │       ├── CandidatePortal.jsx# Public candidate dashboard
│   │       ├── HrDashboard.jsx    # HR command center + leaderboard
│   │       ├── Apply.jsx          # Public application form
│   │       ├── Login.jsx          # Firebase Auth login
│   │       ├── Assessment.jsx     # Token-gated assessment
│   │       └── Schedule.jsx       # Interview calendar
│   ├── tailwind.config.js         # Custom color palette + animations
│   ├── postcss.config.js
│   ├── vite.config.js
│   └── package.json
├── vercel.json                    # Vercel monorepo deployment config
├── requirements.txt               # Vercel python dependency list
├── .github/workflows/ci.yml       # GitHub Actions CI/CD
├── firestore.rules                # Firebase security rules
├── .env.example                   # Environment variable template
└── README.md
