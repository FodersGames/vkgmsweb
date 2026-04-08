# Test Credentials

## Super Admin Access
- **Master Key**: `#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd`
- **Permissions**: All (send_items, change_status, view_logs, manage_users, manage_variables)

## Permissions Available
- `send_items` - Envoyer des items aux joueurs
- `change_status` - Changer le statut du serveur
- `view_logs` - Voir les journaux système
- `manage_users` - Gérer les utilisateurs
- `manage_variables` - Gérer les variables système

## API Endpoints

### Public Endpoints
- GET /api/claimgift/{uid} - Réclamer des items pour un joueur
- GET /api/status - Obtenir le statut du serveur
- GET /api/variable/{variable_name} - Obtenir la valeur d'une variable

### Authenticated Endpoints (require Bearer token)
- POST /api/auth/login - Se connecter avec la clé d'accès
- POST /api/items/send - Envoyer des items (requires: send_items)
- POST /api/status - Changer le statut du serveur (requires: change_status)
- GET /api/logs - Voir les journaux (requires: view_logs)
- POST /api/users - Créer un utilisateur (Super Admin only)
- GET /api/users - Lister les utilisateurs (Super Admin only)
- DELETE /api/users/{username} - Supprimer un utilisateur (Super Admin only)
- PUT /api/users/{username}/permissions - Modifier les permissions (Super Admin only)
- POST /api/variables - Créer une variable (requires: manage_variables)
- GET /api/variables - Lister les variables (requires: manage_variables)
- PUT /api/variables/{variable_name} - Modifier une variable (requires: manage_variables)
- DELETE /api/variables/{variable_name} - Supprimer une variable (requires: manage_variables)

## Usage
1. Se connecter avec la clé maître pour obtenir l'accès Super Admin
2. Créer des utilisateurs via le dashboard avec des permissions spécifiques
3. Utiliser les clés d'accès générées pour authentifier les utilisateurs réguliers
