# HR Recruitment Funnel — Enterprise SaaS

End-to-end automated HR recruitment pipeline with AI-powered candidate screening, technical assessment, and interview scheduling.

## Architecture

```
┌─────────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React Frontend    │────▶│   FastAPI Backend │────▶│ Firebase Firestore│
│  (Vite + Tailwind)  │     │   (Python 3.11)  │     │  (Admin SDK)     │
│                     │     │                  │     │                  │
│ • /apply            │     │ • /api/candidates│     │ • candidates/    │
│ • /dashboard        │     │ • /api/assessments│    │ • assessments/   │
│ • /assessment/:token│     │ • /api/schedule  │     │ • jobs/          │
│ • /schedule         │     │ • /api/jobs      │     │ • hr_users/      │
│ • /login            │     └───────┬──────────┘     │ • errors/        │
│                     │             │                 └──────────────────┘
│ Firebase JS SDK v9  │     ┌───────▼──────────┐
│ • onSnapshot        │     │   Celery + Redis │     ┌──────────────────┐
│ • uploadBytes       │     │                  │────▶│  Claude AI API   │
│ • Firebase Auth     │     │ Task Chain:      │     │  (Anthropic)     │
└─────────────────────┘     │ parse → screen → │     └──────────────────┘
                            │ assess → notify  │
                            └──────────────────┘     ┌──────────────────┐
                                                     │  Firebase Storage│
                                                     │  (CV uploads)    │
                                                     └──────────────────┘
```

## 6-Dimension Scoring Rubric

| Dimension | Weight | Method |
|-----------|--------|--------|
| Technical Skills Match | 30% | Claude semantic matching against job.requiredSkills |
| Experience & Seniority | 20% | Years, seniority level, domain, leadership signals |
| Assessment Performance | 25% | MCQ + Coding + Open-ended with speed/resubmission modifiers |
| CV Quality & Communication | 10% | Claude holistic evaluation |
| Cultural & Role Fit | 10% | Claude persona matching against job.rolePersonaPrompt |
| Response Time & Engagement | 5% | Time-delta scoring (<24h=100, 24-48h=75, etc.) |

## Prerequisites

- **Node.js** v20+ and npm
- **Python** 3.11+
- **Docker** & Docker Compose
- **Firebase** project with Firestore, Storage, and Auth enabled
- **Redis** (included via Docker Compose)

## Firebase Project Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use an existing one)
3. Enable **Firestore Database** (production mode)
4. Enable **Storage** (production mode)
5. Enable **Authentication** → Email/Password provider

### 2. Generate Service Account Key

1. Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the JSON file as `serviceAccountKey.json` in the project root

### 3. Get Frontend Config

1. Firebase Console → Project Settings → General → Your Apps
2. Add a Web App, copy the config object
3. Fill in the `VITE_FIREBASE_*` variables in your `.env`

### 4. Create HR User

1. Firebase Console → Authentication → Users → Add User
2. Create an HR admin user with email/password
3. In Firestore, manually create a document at `hr_users/{uid}` with:
   ```json
   { "role": "admin", "email": "hr@company.com" }
   ```

## Environment Variables

Copy `.env.example` to `.env` and fill in all values:

```bash
cp .env.example .env
```

| Variable | Description | Required |
|----------|-------------|----------|
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON | ✅ |
| `FIREBASE_STORAGE_BUCKET` | Storage bucket name | ✅ |
| `VITE_FIREBASE_*` | Frontend Firebase config (6 vars) | ✅ |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key | ✅ |
| `SENDGRID_API_KEY` | SendGrid email API key | ✅ |
| `SENDGRID_FROM_EMAIL` | Sender email address | ✅ |
| `GOOGLE_CALENDAR_CREDENTIALS_PATH` | Calendar OAuth2 credentials | Optional |
| `GOOGLE_CALENDAR_ID` | Calendar ID for scheduling | Optional |
| `REDIS_URL` | Redis connection URL | ✅ |
| `JWT_SECRET_KEY` | Secret for assessment tokens | ✅ |

## Quick Start

### Docker (Recommended)

```bash
# Start all services (FastAPI, Celery worker, Celery beat, Redis)
docker-compose up --build

# In another terminal, start the frontend
cd frontend
npm install
npm run dev
```

### Manual

```bash
# Terminal 1: Redis
redis-server

# Terminal 2: FastAPI
cd backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8000

# Terminal 3: Celery Worker
celery -A backend.celery_app worker --loglevel=info

# Terminal 4: Celery Beat (for engagement deadline checks)
celery -A backend.celery_app beat --loglevel=info

# Terminal 5: Frontend
cd frontend
npm install
npm run dev
```

Application will be available at:
- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/api/docs
- **API ReDoc**: http://localhost:8000/api/redoc

## Project Structure

```
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── config.py                  # Pydantic settings
│   ├── firebase_admin_init.py     # Firebase Admin SDK singleton
│   ├── celery_app.py              # Celery configuration
│   ├── routes/
│   │   ├── candidates.py          # /api/candidates endpoints
│   │   ├── assessments.py         # /api/assessments endpoints
│   │   └── schedule.py            # /api/schedule endpoints
│   ├── agents/
│   │   ├── cv_parser_agent.py     # Claude CV parsing (D1, D2, D4)
│   │   ├── evaluator.py           # Assessment scoring (D3, D5, D6)
│   │   └── scoring_engine.py      # 6-dimension score computation
│   ├── models/
│   │   ├── candidate.py           # Candidate Pydantic models
│   │   ├── assessment.py          # Assessment Pydantic models
│   │   └── job.py                 # Job Pydantic models
│   ├── services/
│   │   ├── firestore_service.py   # Firestore CRUD helpers
│   │   ├── storage_service.py     # Firebase Storage helpers
│   │   ├── email_service.py       # SendGrid integration
│   │   └── calendar_service.py    # Google Calendar API
│   ├── tasks/
│   │   └── pipeline_tasks.py      # Celery task chain
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── firebase.js            # Firebase JS SDK config
│   │   ├── App.jsx                # React Router setup
│   │   ├── main.jsx               # Entry point
│   │   ├── context/AuthContext.jsx # Firebase Auth context
│   │   ├── pages/
│   │   │   ├── Login.jsx          # HR login (Firebase Auth)
│   │   │   ├── Apply.jsx          # Candidate CV upload + tracking
│   │   │   ├── Dashboard.jsx      # HR dashboard (live updates)
│   │   │   ├── Assessment.jsx     # Assessment portal (split-pane)
│   │   │   └── Schedule.jsx       # Interview calendar
│   │   ├── components/
│   │   │   ├── CandidateTable.jsx # Live candidate table
│   │   │   ├── CandidateDrawer.jsx# Detail drawer with radar chart
│   │   │   ├── StatusPill.jsx     # Status badges
│   │   │   ├── ScoreBar.jsx       # Animated score bars
│   │   │   ├── ScoreRadar.jsx     # SVG radar chart (6 dimensions)
│   │   │   ├── CalendarGrid.jsx   # Weekly calendar view
│   │   │   └── ProtectedRoute.jsx # Auth guard
│   │   ├── hooks/
│   │   │   ├── useCandidates.js   # Firestore onSnapshot
│   │   │   ├── useAssessment.js   # Assessment data + submission
│   │   │   └── useAuth.js         # Auth hook
│   │   └── api/client.js          # Axios + Firebase Auth token
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── docker-compose.yml
├── firestore.rules
├── .env.example
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/candidates/upload` | Upload CV + start pipeline |
| GET | `/api/candidates` | List candidates (with filters) |
| GET | `/api/candidates/{id}` | Get candidate details |
| POST | `/api/assessments/submit` | Submit assessment answers |
| GET | `/api/assessments/{token}` | Get assessment by token |
| GET | `/api/schedule` | Get available interview slots |
| POST | `/api/schedule` | Book an interview slot |
| GET | `/api/jobs` | List active jobs |
| POST | `/api/jobs` | Create a new job |
| GET | `/api/health` | Health check |

## Pipeline Flow

```
CV Upload → Firestore (UPLOADED)
    ↓
Celery: parse_cv_task → Claude AI parsing → D1, D2, D4 scores
    ↓
Celery: screening_decision_task → pass/fail on partial composite
    ↓ (if passed)
Celery: send_assessment_email_task → SendGrid email + Firestore assessment
    ↓
Celery: notify_hr_task → HR notification email
    ↓ (candidate submits)
Celery: evaluate_assessment_task → MCQ/Coding/Open-ended scoring
    ↓
Scoring Engine → D3, D5, D6 → Composite Score
    ↓ (if composite ≥ threshold)
Google Calendar API → Interview scheduled
    ↓
SendGrid → Interview confirmation email
```

## License

MIT
