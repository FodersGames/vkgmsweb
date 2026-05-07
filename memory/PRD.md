# Admin Dashboard API - PRD

## Problem Statement
Build a secure backend API with an admin dashboard (web interface) for managing multiple game projects. Each project has isolated data (items, server status, variables, logs). Features include Super Admin login via master key, RBAC, send items to players, public FIFO claim endpoint, server status management, variables, and activity logs.

## Architecture
- **Frontend**: React + Tailwind CSS (warm theme) 
- **Backend**: Python FastAPI
- **Database**: MongoDB
- **Auth**: Custom JWT with Master Key + User Keys (bcrypt hashed)

## Key Endpoints (v1.0.5)
All game data scoped under `/api/projects/{project_slug}/...`
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `DELETE /api/projects/{slug}` - Delete project + all data
- `POST /api/projects/{slug}/items/send` - Send items (auth)
- `GET /api/projects/{slug}/claimgift/{uid}` - FIFO claim (public)
- `GET/POST /api/projects/{slug}/status` - Server status
- CRUD `/api/projects/{slug}/variables` - Variables management
- `GET /api/projects/{slug}/variable/{name}` - Flat JSON (public)
- `GET /api/projects/{slug}/logs` - Activity logs (auth)
- `POST /api/auth/login` / `GET /api/auth/verify` - Auth (global)
- CRUD `/api/users` - User management (global)

## What's Implemented
- [x] JWT auth with master key + user keys (bcrypt)
- [x] RBAC (send_items, change_status, view_logs, manage_users, manage_variables)
- [x] Multi-project system with data isolation
- [x] Project CRUD (create, list, delete with cascade)
- [x] Project selector in dashboard sidebar
- [x] Send items to players (project-scoped)
- [x] FIFO claim gift endpoint (public, project-scoped)
- [x] Server status management (project-scoped)
- [x] Variables management with flat JSON public endpoint (project-scoped)
- [x] Activity logs with filtering (project-scoped)
- [x] User management (global)
- [x] API documentation page (updated for project endpoints)
- [x] Warm theme UI across all components
- [x] Rate limiting on login and claim endpoints
- [x] Version indicator (v1.0.5)

## Backlog
- No pending tasks. Ask user for next features.
