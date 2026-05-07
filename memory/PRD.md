# Admin Dashboard API - Vakar Games - PRD

## Problem Statement
Build a secure backend API with admin dashboard and official website for Vakar Games. Multi-project system with isolated data per game. Granular permission system for fine-grained access control.

## Architecture
- **Frontend**: React + Tailwind CSS
- **Backend**: Python FastAPI
- **Database**: MongoDB
- **Auth**: Custom JWT with Master Key + User Keys (bcrypt hashed)

## Routes
- `/` — Vakar Games landing page (public)
- `/login` — Admin login
- `/dashboard` — Admin dashboard (protected)

## Permissions (13 total, 6 groups)
- **Projects**: view_projects, create_projects, delete_projects
- **Items**: send_items, delete_items
- **Server**: change_status
- **Variables**: view_variables, create_variables, edit_variables, delete_variables
- **Logs & Docs**: view_logs, view_api_docs
- **Users**: manage_users

## Key Endpoints (v1.1.0)
- `GET /api/permissions` — List all available permissions
- `POST/GET/DELETE /api/projects` — Project CRUD
- `POST /api/projects/{slug}/items/send` — Send items
- `DELETE /api/projects/{slug}/items/{uid}` — Delete items for a UID
- `GET /api/projects/{slug}/claimgift/{uid}` — FIFO claim (public)
- `GET/POST /api/projects/{slug}/status` — Server status
- `CRUD /api/projects/{slug}/variables` — Variables
- `GET /api/projects/{slug}/variable/{name}` — Flat JSON (public)
- `GET /api/projects/{slug}/logs` — Logs
- `CRUD /api/users` — User management

## What's Implemented
- [x] Vakar Games landing page (hero, about, games, contact, footer)
- [x] 13 granular permissions in 6 groups
- [x] Multi-project system with data isolation
- [x] JWT auth with master key + user keys
- [x] RBAC with fine-grained permission checks
- [x] Project CRUD with cascade delete
- [x] Send/delete items (project-scoped)
- [x] FIFO claim gift (public, project-scoped)
- [x] Server status management (project-scoped)
- [x] Variables with flat JSON public endpoint (project-scoped)
- [x] Activity logs with filtering (project-scoped)
- [x] User management with granular permission grid
- [x] API documentation page
- [x] Warm theme UI
- [x] Rate limiting
- [x] Version v1.1.0

## Backlog
- No pending tasks. Ask user for next features.
