# Vakar Games Admin Dashboard - PRD

## Problem Statement
Full-stack admin dashboard + public website for Vakar Games (French video game studio). Secure first-login flow, multi-project API system, granular RBAC, website CMS.

## Architecture
- **Frontend**: React + Tailwind CSS (dark gaming theme)
- **Backend**: Python FastAPI
- **Database**: MongoDB
- **Auth**: Custom JWT — secure first-login key generation (bcrypt hash in DB, no hardcoded keys)

## Security Model
- Initial setup key triggers first-login flow
- Server generates new random 48-char key, hashes it with bcrypt, stores in DB
- Initial key permanently invalidated after first use
- No secrets stored in code or .env (only JWT_SECRET needed in production)

## Routes
- `/` — Landing page
- `/games` — Public games page
- `/blog`, `/blog/:slug` — Blog
- `/login` — Admin login (dark theme)
- `/dashboard` — Admin dashboard (dark theme)

## Permissions (20 total, 7 groups)
Projects(3), Items(2), Server(1), Variables(4), Logs & Docs(2), Users(1), Website(7)

## What's Implemented
- [x] Secure first-login flow (key generated server-side, shown once)
- [x] Dark themed login + dashboard
- [x] Public website (Home, Games, Blog)
- [x] Featured game on homepage
- [x] Mobile responsive (hamburger menu)
- [x] Maintenance mode
- [x] Games CMS (6 platforms)
- [x] Blog CMS with image uploads
- [x] Multi-project system
- [x] 20 granular permissions
- [x] Deployment guide (DEPLOYMENT_GUIDE.md)
- [x] v1.3.0

## Backlog
- No pending tasks
