# Vakar Games Admin Dashboard - PRD

## Problem Statement
Full-stack admin dashboard + public website for Vakar Games (French video game studio). Multi-project API system, granular RBAC, website CMS for games and blog.

## Architecture
- **Frontend**: React + Tailwind CSS (dark gaming theme)
- **Backend**: Python FastAPI
- **Database**: MongoDB
- **Auth**: Custom JWT + Master Key + User Keys (bcrypt)

## Routes
- `/` — Landing page (featured game, about, contact)
- `/games` — Public games page
- `/blog` — Blog list, `/blog/:slug` — Post detail
- `/login` — Admin login
- `/dashboard` — Admin dashboard (dark theme)

## Permissions (20 total, 7 groups)
Projects(3), Items(2), Server(1), Variables(4), Logs & Docs(2), Users(1), Website(7: manage_website, create/edit/delete_games, create/edit/delete_blog)

## Key Features
- [x] Multi-project system with data isolation
- [x] 20 granular permissions in 7 groups
- [x] Featured game on homepage (selectable in admin)
- [x] Games CMS (6 platforms: Steam, Google Play, Apple, PC, Web, Android)
- [x] Blog CMS with image uploads
- [x] Maintenance mode (blocks public pages, admin still accessible)
- [x] Mobile responsive (hamburger menu on public pages)
- [x] Dark theme admin panel
- [x] File upload for images
- [x] API documentation (dark themed)
- [x] No "Admin Panel" link visible on public site
- [x] v1.2.0

## Backlog
- No pending tasks
