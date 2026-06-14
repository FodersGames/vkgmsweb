# CODEBASE.md — Vakar Games Technical Reference
> Ce fichier est destiné à être lu par une IA (ChatGPT, Claude, etc.) pour comprendre entièrement le projet avant d'y apporter des modifications.

---

## 1. Vue d'ensemble

**Vakar Games** est un studio de jeu vidéo français. Ce projet est composé de :
- Un **site web public** (Home, Games, Blog) — thème dark gaming
- Un **admin dashboard** protégé — gestion des jeux, blog, projets API, utilisateurs
- Une **API backend** multi-projets pour servir des données à des jeux (items, variables, status serveur)

**Stack** : React 18 + Tailwind CSS (frontend) / Python FastAPI + MongoDB (backend)
**Version** : 1.3.0
**Contact** : support@vakargames.com

---

## 2. Structure des fichiers

```
/app/
├── backend/
│   ├── server.py              ← TOUT le backend (API, auth, models, endpoints)
│   ├── requirements.txt       ← Dépendances Python
│   ├── uploads/               ← Images uploadées (logos, screenshots, blog)
│   └── .env                   ← Variables d'environnement (MONGO_URL, DB_NAME, JWT_SECRET)
│
├── frontend/
│   ├── public/
│   │   └── index.html         ← HTML racine, meta tags, titre
│   ├── src/
│   │   ├── App.js             ← Routes principales + maintenance check
│   │   ├── index.js            ← Point d'entrée React
│   │   ├── index.css           ← Tailwind + CSS custom
│   │   │
│   │   ├── pages/              ← Pages complètes (1 fichier = 1 route)
│   │   │   ├── Home.js         ← / — Landing page publique
│   │   │   ├── Games.js        ← /games — Liste des jeux publics
│   │   │   ├── Blog.js         ← /blog et /blog/:slug — Blog public
│   │   │   ├── Maintenance.js  ← Page maintenance + hook useMaintenanceCheck
│   │   │   ├── Login.js        ← /login — Authentification + modal first-login
│   │   │   └── Dashboard.js    ← /dashboard — Layout admin avec sidebar
│   │   │
│   │   ├── components/         ← Composants UI du dashboard
│   │   │   ├── SendItems.js        ← Envoi d'items aux joueurs (scoped projet)
│   │   │   ├── ServerStatus.js     ← Gestion statut serveur (scoped projet)
│   │   │   ├── VariablesManagement.js ← CRUD variables (scoped projet)
│   │   │   ├── LogsViewer.js       ← Logs d'activité (scoped projet)
│   │   │   ├── ProjectManagement.js ← CRUD projets API
│   │   │   ├── UserManagement.js   ← CRUD utilisateurs + grille permissions
│   │   │   ├── GamesManagement.js  ← CRUD jeux du site (logos, screenshots, plateformes)
│   │   │   ├── BlogManagement.js   ← CRUD articles de blog
│   │   │   ├── WebsiteSettings.js  ← Toggle mode maintenance
│   │   │   ├── ApiEndpoints.js     ← Documentation API interactive
│   │   │   └── ProtectedRoute.js   ← HOC de protection des routes auth
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.js      ← État auth global (token, user, login/logout)
│   │   │   └── ProjectContext.js   ← État projet sélectionné (pour les outils scoped)
│   │   │
│   │   └── components/ui/     ← Composants Shadcn/UI (ne pas modifier)
│   │
│   ├── package.json
│   └── .env                   ← REACT_APP_BACKEND_URL
│
├── DEPLOYMENT_GUIDE.md        ← Guide de déploiement VPS Ubuntu
└── CODEBASE.md                ← Ce fichier
```

---

## 3. Backend (server.py)

### 3.1 Authentification

Le système n'utilise **aucune clé en dur dans le code en production**.

**Premier lancement :**
1. La variable `SETUP_KEY` (définie dans `.env` sous `MASTER_KEY`) est la clé initiale temporaire
2. Au premier login avec cette clé, le serveur :
   - Génère une nouvelle clé aléatoire (`secrets.token_urlsafe(48)`)
   - Hash cette clé avec bcrypt et la stocke dans la collection `super_admin`
   - Retourne `first_login: true` + `new_key: "..."` dans la réponse
   - La clé initiale est **définitivement invalidée**
3. Les logins suivants utilisent la clé générée (vérifiée contre le hash en DB)

**Tokens JWT :** créés avec `pyjwt`, expiration 24h, payload contient `sub`, `username`, `is_super_admin`, `permissions`.

**Sous-utilisateurs :** créés par l'admin, reçoivent une `access_key` générée (hashée en DB). Chaque user a une liste de permissions.

### 3.2 Permissions (20 au total, 7 groupes)

```python
# Projects
"view_projects", "create_projects", "delete_projects"
# Items
"send_items", "delete_items"
# Server
"change_status"
# Variables
"view_variables", "create_variables", "edit_variables", "delete_variables"
# Logs & Docs
"view_logs", "view_api_docs"
# Users
"manage_users"
# Website
"manage_website", "create_games", "edit_games", "delete_games",
"create_blog", "edit_blog", "delete_blog"
```

Le Super Admin a automatiquement TOUTES les permissions. Les permissions sont vérifiées par le décorateur `require_permission("nom_permission")`.

### 3.3 Collections MongoDB

| Collection | Champs principaux | Usage |
|---|---|---|
| `super_admin` | role, key_hash, created_at | Stocke le hash de la clé Super Admin (1 seul doc) |
| `users` | username, access_key_hash, permissions[], created_at, created_by | Sous-utilisateurs du dashboard |
| `projects` | name, slug, created_at, created_by | Projets API (1 par jeu connecté) |
| `items` | project_slug, uid, variable, amount, created_at, created_by | Items envoyés aux joueurs |
| `server_status` | project_slug, status (open/maintenance/closed), updated_at | Statut serveur par projet |
| `variables` | project_slug, variable_name, values[], created_at, updated_at | Variables globales par projet |
| `logs` | type, project_slug, user, uid, variable, amount, message, timestamp | Logs d'activité |
| `website_games` | name, slug, description, logo_url, screenshots[], platforms[{name,url}], status, featured, created_at | Jeux affichés sur le site |
| `blog_posts` | title, slug, content, image_url, published, author, created_at | Articles de blog |
| `website_settings` | maintenance_mode, updated_at, updated_by | Config globale du site (1 seul doc) |

### 3.4 Endpoints API

**Publics (pas d'auth) :**
- `GET /api/version` — Version de l'API
- `GET /api/permissions` — Liste de toutes les permissions
- `GET /api/projects/{slug}/claimgift/{uid}` — File FIFO d'items pour un joueur
- `GET /api/projects/{slug}/status` — Statut serveur d'un projet
- `GET /api/projects/{slug}/variable/{name}` — Variable en format JSON aplati
- `GET /api/website/games/public` — Jeux publiés
- `GET /api/website/games/featured` — Jeu featured (affiché sur la homepage)
- `GET /api/website/blog/public` — Articles publiés
- `GET /api/website/blog/{slug}` — Article par slug
- `GET /api/website/settings` — État maintenance

**Auth requise :**
- `POST /api/auth/login` — Login (retourne JWT + éventuellement first_login/new_key)
- `GET /api/auth/verify` — Vérifie un token
- `POST /api/upload` — Upload d'image (retourne URL)
- `CRUD /api/projects` — Gestion des projets
- `POST /api/projects/{slug}/items/send` — Envoyer des items
- `DELETE /api/projects/{slug}/items/{uid}` — Supprimer items d'un joueur
- `POST /api/projects/{slug}/status` — Changer le statut serveur
- `CRUD /api/projects/{slug}/variables` — Gestion des variables
- `GET /api/projects/{slug}/logs` — Consulter les logs
- `CRUD /api/users` — Gestion des utilisateurs
- `PUT /api/users/{username}/permissions` — Modifier les permissions
- `CRUD /api/website/games` — Gestion des jeux du site
- `CRUD /api/website/blog` — Gestion du blog
- `PUT /api/website/settings` — Toggle maintenance

### 3.5 Concepts importants

- **Multi-projet** : toutes les données de jeu (items, status, variables, logs) sont isolées par `project_slug`. Un projet = un jeu connecté à l'API.
- **Featured game** : un seul jeu peut être `featured: true`. Quand on en marque un, les autres sont automatiquement `featured: false`.
- **Uploads** : les images sont stockées dans `/backend/uploads/` et servies via `/api/uploads/filename.ext`.
- **Slugs** : générés automatiquement à partir des noms (lowercase, tirets).

---

## 4. Frontend

### 4.1 Design System

**Thème dark gaming** cohérent sur tout le site :
- Fonds : `#0a0a0f` (le plus dark), `#0d0d14`, `#111118`, `#151520`, `#1c1c2e`
- Bordures : `#2a2a3c`
- Texte principal : `#e4e4e7`
- Texte secondaire : `#71717a`
- Accent principal : `#4ECDC4` (teal)
- Danger : `#EB5757` (rouge)
- Warning : `#F2994A` (orange)

**Typographies :**
- Titres/Headers : `Bebas Neue` (Google Fonts, déjà importée dans index.css)
- Body text : `Inter` (Google Fonts)
- Code/mono : `IBM Plex Mono`

**Icônes :** `lucide-react` (déjà installé). Ne PAS utiliser d'emojis.

### 4.2 Routing (App.js)

```
/               → Home.js          (public, bloqué par maintenance)
/games          → Games.js         (public, bloqué par maintenance)
/blog           → BlogList         (public, bloqué par maintenance)
/blog/:slug     → BlogPost         (public, bloqué par maintenance)
/login          → Login.js         (PAS bloqué par maintenance)
/dashboard      → Dashboard.js     (PAS bloqué par maintenance, protégé par auth)
```

Le composant `AppRoutes` dans App.js vérifie le mode maintenance via `useMaintenanceCheck()` (défini dans Maintenance.js). Si maintenance activée, toutes les routes publiques affichent la page maintenance.

### 4.3 Context (état global)

**AuthContext.js :**
- `token` : JWT stocké dans localStorage
- `user` : objet user (id, username, is_super_admin, permissions)
- `login(key)` : appelle `/api/auth/login`, retourne `{success, first_login, new_key}`
- `logout()` : supprime token et redirige vers /login
- `hasPermission(perm)` : vérifie si l'utilisateur a une permission

**ProjectContext.js :**
- `projects` : liste des projets
- `selectedProject` : projet actif (stocké dans localStorage)
- `selectProject(project)` : change le projet actif
- `createProject(name)` / `deleteProject(slug)` : CRUD projets

### 4.4 Dashboard (Dashboard.js)

Layout avec sidebar fixe à gauche. La sidebar contient :
1. **Logo + info user** en haut
2. **Sélecteur de projet** (dropdown)
3. **Navigation** en 3 sections :
   - **General** : Projects, Users, API Docs
   - **Project Tools** (visible si un projet est sélectionné) : Send Items, Server Status, Variables, Logs
   - **Website** : Games, Blog, Settings
4. **Sign Out + version** en bas

Chaque onglet est conditionné par `hasPermission()`. Les onglets "Project Tools" nécessitent un projet sélectionné.

### 4.5 Pages publiques

Toutes les pages publiques partagent :
- Navbar fixe avec "VAKAR GAMES" + liens Games/Blog (PAS de lien Admin Panel)
- Menu hamburger sur mobile
- Footer avec logo + liens + copyright
- Titres dynamiques (`document.title`)

**Home.js** : Hero plein écran → About section → Featured Game section (1 seul jeu depuis `/api/website/games/featured`) → Contact (support@vakargames.com) → Footer

**Games.js** : Hero "OUR GAMES" → grille de jeux depuis `/api/website/games/public` avec icônes de plateformes (Steam, Google Play, Apple, PC, Web, Android)

**Blog.js** : Hero "BLOG" → liste d'articles depuis `/api/website/blog/public`. Chaque article lien vers `/blog/:slug`.

### 4.6 Login (Login.js)

- Formulaire dark avec champ "Access Key" (type password)
- Si la réponse contient `first_login: true` → affiche une **modal "FIRST CONNECTION"** avec :
  - La nouvelle clé générée
  - Bouton copier
  - Avertissement rouge "Save this key now!"
  - Bouton "I've saved my key — Continue to Dashboard"
- Sinon → redirige directement vers /dashboard

### 4.7 Composants admin (components/)

Tous les composants admin utilisent le thème dark. Pattern commun :
- Card avec header (icône gradient + titre)
- Formulaire de création (toggle show/hide)
- Liste des éléments avec actions edit/delete

**GamesManagement.js** : 
- Plateformes disponibles : `steam`, `google_play`, `apple`, `pc`, `web`, `android`
- Chaque plateforme a un lien URL personnalisable
- Checkbox "Featured Game" (1 seul jeu featured à la fois)
- Upload logo + screenshots

**UserManagement.js** :
- Grille de permissions organisée en 7 groupes visuels
- Boutons "Select All" / "Clear All"
- Quand un user est créé, sa clé d'accès est affichée une seule fois

---

## 5. Variables d'environnement

### Backend (.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=vakargames_db
JWT_SECRET=<random_64_chars>
MASTER_KEY=<initial_setup_key>          ← N'est utilisé qu'au premier login, puis ignoré
CORS_ORIGINS=https://vakargames.com     ← Domaines autorisés (séparés par virgule)
```

### Frontend (.env)
```
REACT_APP_BACKEND_URL=https://vakargames.com    ← URL publique du backend (pas de /api)
```

---

## 6. Conventions de code

- **Backend** : tout est dans `server.py` (pas de modules séparés). Routes préfixées par `/api`. MongoDB avec motor async. Pydantic pour la validation. Ne JAMAIS retourner `_id` de MongoDB dans les réponses (utiliser `serialize_doc()` ou `{"_id": 0}` dans les projections).
- **Frontend** : 1 composant par fichier. Exports nommés pour les composants (`export const X`), exports par défaut pour les pages (`export default`). Toutes les API calls utilisent `process.env.REACT_APP_BACKEND_URL`. Axios pour les requêtes HTTP. `sonner` (toast) pour les notifications.
- **Pas d'emojis** dans le code ou l'interface.
- **Tout en anglais** dans l'interface utilisateur.

---

## 7. Règles critiques pour éviter de casser le projet

1. **Ne JAMAIS hardcoder de clés/secrets** — tout passe par .env et la DB
2. **Ne JAMAIS modifier les composants dans `components/ui/`** — ce sont des composants Shadcn partagés
3. **Toujours préfixer les routes backend par `/api`** — le reverse proxy Nginx en dépend
4. **MongoDB : exclure `_id` des réponses** ou utiliser `serialize_doc()` — sinon erreur de sérialisation JSON
5. **Les permissions sont vérifiées côté backend ET frontend** — modifier les deux si on ajoute une permission
6. **Un seul jeu peut être `featured: true`** — le backend reset les autres automatiquement
7. **Le mode maintenance ne bloque PAS /login et /dashboard** — c'est intentionnel
8. **Les images uploadées sont dans `/backend/uploads/`** — s'assurer que ce dossier est persistant en production
9. **CORS_ORIGINS** doit contenir le domaine exact du frontend en production
10. **`REACT_APP_BACKEND_URL`** doit être défini AVANT le `yarn build` (il est injecté au build time)
