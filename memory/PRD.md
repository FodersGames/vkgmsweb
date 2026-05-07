# Vakar Games Admin Dashboard - PRD

## Problem Statement
Full-stack admin dashboard + public website for Vakar Games (French video game studio). Multi-project system, granular RBAC, website CMS for games and blog.

## Architecture
- **Frontend**: React + Tailwind CSS (dark gaming theme)
- **Backend**: Python FastAPI
- **Database**: MongoDB
- **Auth**: Custom JWT + Master Key + User Keys (bcrypt)

## Routes
- `/` — Landing page (VAKAR GAMES, LEGENDS ARE BORN)
- `/games` — Public games page
- `/blog` — Public blog list
- `/blog/:slug` — Blog post detail
- `/login` — Admin login
- `/dashboard` — Admin dashboard (dark theme)

## Permissions (20 total, 7 groups)
- **Projects**: view_projects, create_projects, delete_projects
- **Items**: send_items, delete_items
- **Server**: change_status
- **Variables**: view_variables, create_variables, edit_variables, delete_variables
- **Logs & Docs**: view_logs, view_api_docs
- **Users**: manage_users
- **Website**: manage_website, create_games, edit_games, delete_games, create_blog, edit_blog, delete_blog

## Key API Endpoints (v1.2.0)
- Auth: login, verify
- Projects: CRUD + scoped items/status/variables/logs
- Website Games: CRUD + public listing
- Website Blog: CRUD + public listing + individual post
- Website Settings: maintenance mode
- Upload: image upload
- Users: CRUD with 20 permissions

## What's Implemented
- [x] Vakar Games landing page (hero, about, games, contact, footer)
- [x] Public Games page with platform icons (Steam, Google Play, Apple, PC)
- [x] Public Blog page with post listing and individual post view
- [x] Dark themed admin dashboard matching website
- [x] Website management: Games CRUD (name, description, logo, screenshots, platforms, status)
- [x] Website management: Blog CRUD (title, content, image, published status)
- [x] Website management: Settings (maintenance mode toggle)
- [x] File upload endpoint for images
- [x] 20 granular permissions in 7 groups
- [x] Multi-project system with data isolation
- [x] JWT auth + RBAC
- [x] All project tools (Send Items, Status, Variables, Logs)
- [x] User management with granular permission grid
- [x] API documentation
- [x] Rate limiting
- [x] v1.2.0

## Backlog
- No pending tasks
