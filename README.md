# Worksync - Works Activity Tracker

<p align="center">
  <img src="https://img.shields.io/badge/status-production%20ready-22c55e?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/license-proprietary-red?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/react-18.2-61dafb?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/fastapi-0.115-009688?style=flat-square&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/typescript-5.3-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/postgresql-16-4169e1?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/tailwind%20css-3.4-06b6d4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/ai-deepseek--v4--flash-4f46e5?style=flat-square" alt="DeepSeek AI" />
</p>

Worksync is a comprehensive SaaS platform designed to streamline workforce management through GPS-based attendance tracking, AI-powered daily reports, expense management, and real-time admin monitoring. Built with modern technologies and enterprise-grade security, Worksync empowers teams to work more productively while giving managers full visibility into their operations.

## Table of Contents

- [Deskripsi](#deskripsi)
- [Tech Stack](#tech-stack)
- [Arsitektur](#arsitektur)
- [Prerequisites](#prerequisites)
- [Setup Lokal](#setup-lokal)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Setup Environment Variables](#2-setup-environment-variables)
  - [3. Setup PostgreSQL](#3-setup-postgresql)
  - [4. Backend Setup](#4-backend-setup)
  - [5. Frontend Setup](#5-frontend-setup)
  - [6. Buka Aplikasi](#6-buka-aplikasi)
- [Environment Variables](#environment-variables)
  - [Backend](#backend)
  - [Frontend](#frontend)
- [Setup Manual Steps](#setup-manual-steps)
  - [Generate JWT Secret Key](#generate-jwt-secret-key)
  - [Setup Polar.sh](#setup-polar)
  - [Setup Cloudinary](#setup-cloudinary)
  - [Setup BigDataCloud](#setup-bigdatacloud)
  - [Setup DeepSeek](#setup-deepseek)
  - [Setup PostgreSQL di Railway](#setup-postgresql-di-railway)
  - [Run Migrations](#run-migrations)
  - [Setup Polar.sh Webhook](#setup-polar-webhook)
- [Deployment ke Railway](#deployment-ke-railway)
- [Fitur](#fitur)
  - [Karyawan](#karyawan)
  - [Admin](#admin)
- [Penggunaan API](#penggunaan-api)
- [Kontribusi](#kontribusi)
- [Lisensi](#lisensi)

## Deskripsi

Worksync is a Works Activity Tracker that solves the fundamental challenges of managing distributed and hybrid teams. The platform combines four core functionalities into a single, unified interface:

1. **GPS Attendance** - Employees can check in and out with GPS location verification, selfie photos, and automatic reverse geocoding to determine their exact work location.
2. **AI-Powered Reports** - Daily report generation powered by DeepSeek AI. Employees simply describe their activities, and the AI structures them into professional, well-formatted reports.
3. **Expense Management** - Track team expenses with receipt photo uploads and automatic categorization for transparent reimbursement workflows.
4. **Admin Monitoring Dashboard** - Real-time monitoring with interactive maps, charts, and AI-powered analytics that answer natural language questions about team performance.

Worksync is designed for Indonesian companies and teams, with full Bahasa Indonesia support and localization. The platform handles all the complexities of attendance tracking, expense reporting, and performance monitoring so teams can focus on what matters most: getting work done.

## Tech Stack

### Frontend

| Technology | Purpose |
|------------|---------|
| **Vite 5** | Build tool and dev server for fast HMR |
| **React 18** | UI library for building component-based interfaces |
| **TypeScript** | Type-safe JavaScript for better developer experience |
| **Tailwind CSS 3** | Utility-first CSS framework for rapid UI development |
| **shadcn/ui** | Reusable component library built on Radix UI primitives |
| **React Router v6** | Client-side routing for single-page application navigation |
| **Zustand** | Lightweight state management for global application state |
| **Axios** | HTTP client for API communication with the backend |
| **Recharts** | Composable charting library for data visualization |
| **MapLibre GL** | Open-source map rendering for real-time employee location tracking |
| **lucide-react** | Beautiful, consistent icon set for UI elements |

### Backend

| Technology | Purpose |
|------------|---------|
| **FastAPI** | High-performance Python web framework for building REST APIs |
| **SQLAlchemy** | ORM for database interaction and model management |
| **Alembic** | Database migration tool for schema version control |
| **PostgreSQL 16** | Primary database for production data storage |
| **DeepSeek API** | AI integration for report generation and analytics (model: deepseek-v4-flash) |
| **Polar.sh** | Subscription billing platform for managing SaaS payments |
| **Cloudinary** | Cloud-based media management for storing photos and documents |
| **BigDataCloud API** | Reverse geocoding service for converting GPS coordinates to addresses |
| **Mapcn.dev** | Map tile provider for MapLibre GL integration |

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React SPA (Vite + TypeScript)             │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐  │  │
│  │  │   Auth  │ │Attendance│ │Expenses│ │  Reports   │  │  │
│  │  │  Pages  │ │  Pages   │ │ Pages  │ │   Pages    │  │  │
│  │  └─────────┘ └──────────┘ └────────┘ └────────────┘  │  │
│  │  ┌─────────┐ ┌──────────┐ ┌────────┐ ┌────────────┐  │  │
│  │  │  Admin  │ │  Billing │ │   AI   │ │  Maps &    │  │  │
│  │  │Dashboard│ │  Portal  │ │Assistant│ │ Monitoring │  │  │
│  │  └─────────┘ └──────────┘ └────────┘ └────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST (Axios)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Backend (Python)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Auth &  │ │Attendance│ │ Expenses │ │  Reports &   │  │
│  │  Users   │ │  Module  │ │  Module  │ │  AI Module  │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Admin   │ │ Billing  │ │Uploads/  │ │  External    │  │
│  │  Module  │ │  Module  │ │  Storage │ │   APIs       │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           SQLAlchemy ORM + Alembic Migrations          │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │  Cloudinary  │ │  DeepSeek    │
│   Database   │ │   Storage    │ │    AI API    │
└──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Polar.sh    │ │ BigDataCloud │ │  Mapcn.dev   │
│  Billing     │ │  Geocoding   │ │  Map Tiles   │
└──────────────┘ └──────────────┘ └──────────────┘
```

The architecture follows a modern JAMstack pattern with a decoupled frontend and backend communicating via RESTful APIs. The frontend is a single-page application that handles all UI rendering, while the backend provides a comprehensive REST API with JWT-based authentication, role-based access control, and integration with various third-party services.

## Prerequisites

Before setting up Worksync locally, ensure you have the following installed:

- **Node.js 18+** - JavaScript runtime for the frontend
- **Python 3.11+** - Python interpreter for the backend
- **PostgreSQL 16+** - Relational database (or use Docker)
- **Docker & Docker Compose** (optional but recommended for PostgreSQL)
- **Git** - Version control
- **npm** or **yarn** - Package manager for Node.js
- **pip** - Package manager for Python

## Setup Lokal

### 1. Clone Repository

```bash
git clone <repo-url>
cd worksync
```

### 2. Setup Environment Variables

Copy the example environment files to create your local configuration:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit both `.env` files with your actual credentials. Refer to the [Environment Variables](#environment-variables) section below for detailed descriptions.

### 3. Setup PostgreSQL

**Option A: Using Docker (Recommended)**

```bash
docker compose up db -d
```

This starts a PostgreSQL 16 Alpine container with the default credentials defined in `docker-compose.yml`:
- User: `worksync`
- Password: `worksync_secret`
- Database: `worksync`
- Port: `5432`

Your backend `.env` file should then have:
```
DATABASE_URL=postgresql://worksync:worksync_secret@localhost:5432/worksync
```

**Option B: Using Local PostgreSQL**

```bash
createdb worksync
```

Or via psql:
```sql
CREATE DATABASE worksync;
CREATE USER worksync WITH PASSWORD 'worksync_secret';
GRANT ALL PRIVILEGES ON DATABASE worksync TO worksync;
```

### 4. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

The backend will be available at `http://localhost:8000` with automatic API documentation at `http://localhost:8000/docs`.

Key backend commands:
- **Run migrations**: `alembic upgrade head`
- **Create new migration**: `alembic revision --autogenerate -m "description"`
- **Rollback migration**: `alembic downgrade -1`
- **Run tests**: `pytest`
- **Lint code**: `ruff check .`

### 5. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend development server will start at `http://localhost:5173` with Hot Module Replacement enabled.

Key frontend commands:
- **Development**: `npm run dev`
- **Production build**: `npm run build`
- **Preview build**: `npm run preview`
- **Lint**: `npm run lint`

### 6. Buka Aplikasi

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:8000
- **API Docs (Swagger UI)**: http://localhost:8000/docs
- **API Docs (ReDoc)**: http://localhost:8000/redoc

## Environment Variables

### Backend

| Variable | Description | How to Get |
|----------|-------------|------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/db`) | Generated from your database setup |
| `SECRET_KEY` | JWT signing secret - must be a cryptographically secure random string | Run `openssl rand -hex 32` |
| `ALGORITHM` | JWT hashing algorithm | Set to `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT token expiration time in minutes | Set to `30` (or your preferred value) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Cloudinary Dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Cloudinary Dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Cloudinary Dashboard |
| `DEEPSEEK_API_KEY` | DeepSeek API key for AI features | DeepSeek Platform |
| `DEEPSEEK_MODEL` | DeepSeek model name | Set to `deepseek-v4-flash` |
| `POLAR_ACCESS_TOKEN` | Polar.sh organization access token | Polar.sh Settings |
| `POLAR_WEBHOOK_SECRET` | Polar.sh webhook signing secret | Polar.sh Settings |
| `POLAR_FREE_PRODUCT_ID` | Polar.sh Free plan product ID | Polar.sh Products |
| `POLAR_PRO_PRODUCT_ID` | Polar.sh Pro plan product ID | Polar.sh Products |
| `POLAR_ENTERPRISE_PRODUCT_ID` | Polar.sh Enterprise plan product ID | Polar.sh Products |
| `BIGDATACLOUD_API_KEY` | BigDataCloud API key for reverse geocoding | BigDataCloud API Dashboard |
| `CORS_ORIGINS` | Comma-separated list of allowed CORS origins | Set to `http://localhost:5173` for development |

### Frontend

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Backend API base URL (e.g., `http://localhost:8000/api/v1`) |
| `VITE_BIGDATACLOUD_API_KEY` | BigDataCloud API key for client-side reverse geocoding |
| `VITE_MAPCN_KEY` | Mapcn.dev API key for map tile access |

## Setup Manual Steps

### Generate JWT Secret Key

```bash
openssl rand -hex 32
```

Copy the output and set it as the `SECRET_KEY` in your backend `.env` file.

### Setup Polar.sh

Polar.sh handles all subscription billing and payment processing for Worksync. Follow these steps to set it up:

1. **Create Account**: Sign up at https://polar.sh
2. **Create Organization**: Set up your organization from the Polar.sh dashboard
3. **Create Products**: Create 3 subscription products matching Worksync's pricing:
   - **Free** ($0/month) - Basic plan with limited features
   - **Pro** ($9/month) - Full features for growing teams
   - **Enterprise** ($29/month) - Unlimited access for large organizations
4. **Get Access Token**: Navigate to Organization Settings > API & Webhooks, and generate a new access token
5. **Configure Webhook**: Set your webhook URL to `https://your-domain.com/api/v1/billing/webhook`
6. **Note Credentials**: Save the following from Polar.sh Settings:
   - Organization Access Token → `POLAR_ACCESS_TOKEN`
   - Webhook Secret → `POLAR_WEBHOOK_SECRET`
   - Product IDs for each plan → `POLAR_*_PRODUCT_ID`

### Setup Cloudinary

Cloudinary stores user-uploaded images including attendance selfies and expense receipts.

1. **Create Account**: Register at https://cloudinary.com
2. **Get Credentials**: Navigate to Dashboard to find:
   - Cloud Name → `CLOUDINARY_CLOUD_NAME`
   - API Key → `CLOUDINARY_API_KEY`
   - API Secret → `CLOUDINARY_API_SECRET`
3. **Configure Upload**: Set up unsigned upload presets if needed for client-side uploads

### Setup BigDataCloud

BigDataCloud provides reverse geocoding services that convert GPS coordinates into human-readable addresses.

1. **Create Account**: Register at https://www.bigdatacloud.com
2. **Get API Key**: Navigate to your dashboard and generate a new API key
3. **Set Key**: Add the key to both backend (`BIGDATACLOUD_API_KEY`) and frontend (`VITE_BIGDATACLOUD_API_KEY`) environment variables

### Setup DeepSeek

DeepSeek powers the AI features in Worksync, including automatic report generation and AI analytics.

1. **Register**: Sign up at https://platform.deepseek.com
2. **Get API Key**: Generate an API key from the platform dashboard
3. **Set Configuration**: Add to backend `.env`:
   ```
   DEEPSEEK_API_KEY=your_api_key_here
   DEEPSEEK_MODEL=deepseek-v4-flash
   ```

### Setup PostgreSQL di Railway

If deploying to Railway, follow these steps for managed PostgreSQL:

1. **Deploy PostgreSQL**: From Railway Dashboard, click "New" → "Database" → "Add PostgreSQL"
2. **Copy Connection String**: Railway provides a `DATABASE_URL` environment variable automatically
3. **Connect Backend**: Set the `DATABASE_URL` in your backend Railway environment variables
4. **Run Migrations**: Railway will run `alembic upgrade head` automatically if configured in the start command

### Run Migrations

```bash
cd backend
alembic upgrade head
```

To verify migration status:
```bash
alembic current
```

### Setup Polar.sh Webhook

After deploying your application, configure the Polar.sh webhook:

1. Go to Polar.sh Organization Settings → API & Webhooks
2. Add webhook URL: `https://your-app.railway.app/api/v1/billing/webhook`
3. Subscribe to these events:
   - `subscription.created`
   - `subscription.active`
   - `subscription.canceled`
   - `subscription.updated`
   - `subscription.revoked`
4. Copy the Webhook Secret and set it as `POLAR_WEBHOOK_SECRET` in your backend `.env`

## Deployment ke Railway

Railway provides a streamlined deployment experience for full-stack applications. Follow these steps to deploy Worksync:

### Prerequisites
- A Railway account (https://railway.app)
- Your code pushed to a GitHub repository

### Steps

1. **Create New Project**: Click "New Project" in Railway dashboard
2. **Deploy Backend**:
   - Click "Deploy from GitHub repo"
   - Select your repository
   - Set root directory to `backend`
   - Railway auto-detects Python and sets the start command:
     ```
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - Add all environment variables from backend `.env`
3. **Deploy Frontend**:
   - Click "New" → "Deploy from GitHub repo"
   - Set root directory to `frontend`
   - Build command: `npm run build`
   - Start command: `npm run preview`
   - Add environment variables including `VITE_API_BASE_URL` pointing to your backend URL
4. **Add PostgreSQL**:
   - Click "New" → "Database" → "Add PostgreSQL"
   - Railway automatically creates the `DATABASE_URL` variable
   - Reference it in your backend service
5. **Configure Domains**:
   - Railway generates `.railway.app` URLs for each service
   - Generate a public domain for frontend
   - Update `VITE_API_BASE_URL` with the backend domain
6. **Run Migrations**: Use Railway CLI or add a post-deploy script:
   ```bash
   railway run alembic upgrade head
   ```
7. **Verify Deployment**: Visit your frontend domain to confirm everything is working

### Railway Configuration Tips
- Use Railway's volume mounts for persistent storage of uploaded files
- Enable health checks for the backend service
- Configure automatic deployments from the main branch
- Set up a custom domain for production

## Fitur

### Karyawan

The employee-facing features are designed for simplicity and ease of use:

- **Absensi GPS dengan Selfie**
  - Check-in and check-out with GPS location verification
  - Selfie photo capture to prevent attendance fraud
  - Automatic reverse geocoding showing the exact address
  - Configurable geo-fence radius to restrict attendance to office locations
  - Late arrival detection and automatic marking
  - Attendance history with calendar view

- **Catat Pengeluaran dengan Foto Nota**
  - Quick expense recording with receipt photo upload
  - Automatic categorization (transport, meals, supplies, etc.)
  - Manual category override
  - Pending/approved/rejected status tracking
  - Expense history with monthly summaries

- **Laporan Harian dengan AI Assistant**
  - Describe your day's activities in natural language
  - AI structures and formats the report automatically
  - Edit and approve AI-generated reports
  - Report history with weekly/monthly views
  - AI Assistant chat interface for report refinement

- **Riwayat dan Monitoring Pribadi**
  - Personal attendance dashboard
  - Expense history and status tracking
  - Daily report archive
  - Monthly productivity summary

### Admin

The admin dashboard provides comprehensive management and monitoring capabilities:

- **Dashboard dengan Grafik Tren Mingguan**
  - Overview of attendance rates, expenses, and report completion
  - Weekly trend charts for key metrics
  - Team performance comparisons
  - Quick stats cards for instant insights

- **Monitoring dengan Peta Interaktif**
  - Real-time employee locations on an interactive map
  - Color-coded markers (checked-in, checked-out, late, absent)
  - Click to view employee details and current status
  - Office boundary visualization
  - Historical location playback

- **Manajemen Karyawan**
  - Employee list with detailed profiles
  - Add/remove employees and manage roles
  - Set individual work schedules and office locations
  - View attendance and expense history per employee
  - Export employee data

- **Notifikasi Keterlambatan**
  - Real-time notifications when employees are late
  - Push notifications for critical events
  - Configurable late thresholds
  - Notification history log

- **AI Analytics untuk Insight Data**
  - Natural language queries about team data
  - "Who is frequently late this month?"
  - "What is the total overtime cost?"
  - "Which department has the highest expense?"
  - Automatic insight generation
  - Custom report generation

- **Export Excel (Pro+)**
  - One-click export of attendance data to Excel
  - Expense reports in spreadsheet format
  - Custom date range selection
  - Ready for accounting and payroll processing

- **Manajemen Subscription & Billing**
  - View current plan and usage
  - Upgrade/downgrade subscription
  - Billing history and invoice download
  - Payment method management

## Penggunaan API

The Worksync API is fully documented via Swagger UI at `/docs` and ReDoc at `/redoc` when the backend is running.

### Authentication

All API endpoints (except login/register) require a JWT Bearer token:

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@worksync.com", "password": "yourpassword"}'


# Use the returned token for subsequent requests
curl http://localhost:8000/api/v1/attendances \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | User login |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Get current user profile |
| POST | `/api/v1/attendances/check-in` | Employee check-in |
| POST | `/api/v1/attendances/check-out` | Employee check-out |
| GET | `/api/v1/attendances/summary` | Get attendance summary |
| POST | `/api/v1/expenses` | Create expense record |
| GET | `/api/v1/expenses` | List expenses |
| POST | `/api/v1/reports` | Create daily report |
| POST | `/api/v1/ai/generate-report` | Generate AI report |
| POST | `/api/v1/ai/ask-analytics` | Ask AI analytics question |
| GET | `/api/v1/employees` | List employees (admin) |
| POST | `/api/v1/billing/create-checkout` | Create checkout session |
| GET | `/api/v1/billing/subscription` | Get subscription details |
| POST | `/api/v1/cloudinary/upload` | Upload file to Cloudinary |

### Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Anonymous: 20 requests/minute
- Authenticated: 60 requests/minute
- Pro/Enterprise: 120 requests/minute

### Error Handling

All API errors follow a consistent format:

```json
{
  "detail": "Error message describing what went wrong",
  "code": "ERROR_CODE",
  "status_code": 400
}
```

## Kontribusi

We welcome contributions to Worksync! To contribute:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and conventions
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR
- Use descriptive commit messages

### Code Style

- **Frontend**: ESLint + Prettier configuration is included
- **Backend**: Ruff linter is configured for Python code
- **TypeScript**: Strict mode is enabled; avoid using `any`

## Lisensi

**Proprietary License - All Rights Reserved**

Copyright (c) 2024 FMATheNomad

This software and its associated files are **proprietary and confidential**. Unauthorized copying, modification, distribution, reverse engineering, or use of this software, via any medium, is strictly prohibited without prior written permission from the copyright holder.

This software is provided "as is" without warranty of any kind. See the [LICENSE](./LICENSE) file for the full legal text.

---

<p align="center">
  <strong>Worksync</strong> — Lacak Aktivitas Kerja Tim dengan Mudah dan Profesional<br />
  Dibangun dengan ❤️ oleh <a href="https://github.com/FMATheNomad">FMATheNomad</a>
</p>
