# Admin Dashboard - Production Ready

A professional admin dashboard with Azure DevOps/FreshService design theme, featuring JWT authentication, role-based access control, FIFO gift queue system, and comprehensive variable management.

## 🎨 Design

**Azure DevOps / FreshService Theme**
- Clean white professional interface
- Azure blue (#0078D4) accent color
- Sidebar navigation with icon badges
- Enterprise-grade typography (Chivo + IBM Plex Sans)
- Consistent spacing and borders
- Responsive design

## ✨ Features

### 🔐 Authentication & Security
- **Master Key Access**: Super Admin authentication
- **JWT Tokens**: 24-hour session with automatic refresh
- **Role-Based Access Control (RBAC)**: 5 permission types
- **bcrypt Hashing**: Secure key storage
- **Rate Limiting**: DDoS protection (10/min login, 30/min claim)

### 👥 User Management
- Create users with custom permissions
- Edit user permissions dynamically
- Delete users
- Generate secure access keys
- Permission types:
  - `send_items` - Send items to players
  - `change_status` - Change server status
  - `view_logs` - View activity logs
  - `manage_users` - Manage user accounts
  - `manage_variables` - Manage system variables

### 📦 FIFO Gift Queue System
**Unique Feature**: First-In-First-Out queue for gift items
- GET `/api/claimgift/{uid}` returns ALL pending items
- Automatically deletes ONLY the first (oldest) item
- Each request decrements the queue by 1
- Includes `length` field showing remaining items
- Perfect for progressive reward systems

**Example:**
```json
// First GET
{
  "length": 3,
  "variable": "wood",
  "amount": "14",
  "items": [
    {"variable": "workbench", "amount": "2"},
    {"variable": "stone", "amount": "5"}
  ]
}

// Second GET (after first item deleted)
{
  "length": 2,
  "variable": "workbench",
  "amount": "2",
  "items": [
    {"variable": "stone", "amount": "5"}
  ]
}
```

### 📊 Variables System
- **Public API**: GET `/api/variable/{variable_name}`
- Create, Read, Update, Delete variables
- Multiple values per variable
- Perfect for game configuration
- Examples: `max_players`, `drop_rates`, `server_settings`

### 💪 Flexible Amount Field
- Accepts **ANY** text or number value
- Not limited to integers
- Examples: `"10"`, `"100 gold coins"`, `"legendary"`, `"epic quality"`

### 📝 Activity Logs
- Comprehensive logging system
- Filter by: type, user, UID, date
- Log types: send, claim, status, auth, user_action, variable_action
- Configurable limits (default: 100, max: 1000)

### 🔄 Server Status Management
- Three states: Open, Maintenance, Closed
- Color-coded status indicators
- Permission-based access control
- Public status endpoint for games

## 🚀 Quick Start

### 1. Login
Navigate to the dashboard and use the master key (configured in backend environment variables):
```
MASTER_KEY=your_secure_master_key_here
```

⚠️ **Security Note**: Change the default master key before deployment!

### 2. Create a User
```bash
curl -X POST https://your-api.com/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "game_manager",
    "permissions": ["send_items", "view_logs"]
  }'
```

Response includes the access key - **save it immediately**!

### 3. Send Items
```bash
curl -X POST https://your-api.com/api/items/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "player_12345",
    "variable": "legendary_sword",
    "amount": "epic quality"
  }'
```

### 4. Claim Items (Public)
```bash
curl https://your-api.com/api/claimgift/player_12345
```

Returns all items with length, deletes the first one.

### 5. Create Variables
```bash
curl -X POST https://your-api.com/api/variables \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variable_name": "max_players",
    "values": ["100", "200", "500"]
  }'
```

### 6. Get Variable (Public)
```bash
curl https://your-api.com/api/variable/max_players
```

## 📡 API Endpoints

### Public (No Auth)
- `GET /api/claimgift/{uid}` - Claim items (FIFO queue)
- `GET /api/status` - Get server status
- `GET /api/variable/{variable_name}` - Get variable values

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verify token

### User Management (Super Admin)
- `POST /api/users` - Create user
- `GET /api/users` - List users
- `PUT /api/users/{username}/permissions` - Update permissions
- `DELETE /api/users/{username}` - Delete user

### Items
- `POST /api/items/send` - Send items (requires: send_items)

### Server Status
- `POST /api/status` - Change status (requires: change_status)

### Variables
- `POST /api/variables` - Create variable (requires: manage_variables)
- `GET /api/variables` - List variables (requires: manage_variables)
- `PUT /api/variables/{variable_name}` - Update variable (requires: manage_variables)
- `DELETE /api/variables/{variable_name}` - Delete variable (requires: manage_variables)

### Logs
- `GET /api/logs` - Get logs with filters (requires: view_logs)

**See full API documentation in the "API Endpoints" tab (Super Admin only)**

## 🏗️ Architecture

### Backend
- **Framework**: FastAPI 0.110.1
- **Database**: MongoDB (Motor async driver)
- **Authentication**: PyJWT + bcrypt
- **Rate Limiting**: SlowAPI
- **Validation**: Pydantic models

### Frontend
- **Framework**: React 19
- **Router**: React Router DOM 7
- **HTTP Client**: Axios
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Notifications**: Sonner

### Database Collections
- `users` - User accounts with permissions
- `items` - Gift queue (FIFO)
- `variables` - System configuration
- `server_status` - Current status
- `logs` - Activity logs

## 🔒 Security

### Implemented
✅ JWT authentication (24h expiration)
✅ bcrypt password hashing
✅ Rate limiting (10/min login, 30/min claim)
✅ RBAC with 5 permission types
✅ Input validation (Pydantic)
✅ CORS configuration
✅ MongoDB injection protection
✅ Environment variables for secrets

### Recommendations for Production
1. **Change the master key** to a unique value
2. **Enable HTTPS** (SSL/TLS)
3. **Implement IP whitelisting** for admin access
4. **Add 2FA** for Super Admin
5. **Regular security audits**
6. **Monitor failed login attempts**
7. **Use a WAF** for DDoS protection
8. **Implement backup strategy**

## 📊 Performance & Limits

### Recommended Limits
- **Users**: Up to 10,000 users
- **Items queue**: 1,000 items per player
- **Variables**: 500 variables
- **Logs**: Keep last 100,000 entries

### Rate Limits
- **Login**: 10 requests/minute per IP
- **Claim gift**: 30 requests/minute per IP
- **Other endpoints**: No limit (protected by auth)

### Database
- **MongoDB**: No hard storage limit
- **Document size**: 16MB max
- **Connections**: Up to 65,000 concurrent

**See `/app/SECURITY_AND_LIMITS.md` for complete details**

## 💰 Cost & Credits

### On Emergent Platform
- ✅ **No credit usage** for API requests
- ✅ **No hard limits** during development
- ✅ **Free database** included
- ✅ **Free hosting** in preview

### After Deployment
- Self-hosted: Depends on provider
- MongoDB Atlas: Free tier available (512MB)
- All features included

## 🧪 Testing

**All tests passing: 100%**
- ✅ Backend API endpoints
- ✅ FIFO queue system
- ✅ Flexible amount fields
- ✅ User management
- ✅ Variables CRUD
- ✅ Azure theme implementation
- ✅ English language

## 📁 Project Structure

```
/app/
├── backend/
│   ├── server.py          # FastAPI application
│   ├── requirements.txt   # Python dependencies
│   └── .env              # Environment variables
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.js
│   │   │   └── Dashboard.js
│   │   ├── components/
│   │   │   ├── UserManagement.js
│   │   │   ├── VariablesManagement.js
│   │   │   ├── SendItems.js
│   │   │   ├── ServerStatus.js
│   │   │   ├── LogsViewer.js
│   │   │   └── ApiEndpoints.js
│   │   ├── context/
│   │   │   └── AuthContext.js
│   │   ├── App.js
│   │   └── index.css
│   ├── package.json
│   └── .env
├── memory/
│   └── test_credentials.md
├── README.md
└── SECURITY_AND_LIMITS.md
```

## 🎯 Use Cases

### Game Servers
- Manage player rewards
- Configure server settings
- Monitor player activity
- Control server status

### SaaS Platforms
- User management
- Feature flags (variables)
- Activity monitoring
- Access control

### API Services
- Centralized configuration
- Multi-tenant management
- Audit logging
- Rate-limited public endpoints

## 🔄 FIFO Queue Use Cases

Perfect for:
- **Progressive rewards**: Players claim items one at a time
- **Timed events**: Distribute items over time
- **Achievement systems**: Sequential unlocks
- **Subscription rewards**: Monthly item distribution
- **Battle pass rewards**: Tier-based progression

## 📚 Additional Resources

- **API Documentation**: Available in dashboard (Super Admin only)
- **Security Guide**: `/app/SECURITY_AND_LIMITS.md`
- **Test Credentials**: `/app/memory/test_credentials.md`

## 🛠️ Development

### Backend
```bash
cd /app/backend
pip install -r requirements.txt
# Server runs on 0.0.0.0:8001
```

### Frontend
```bash
cd /app/frontend
yarn install
yarn start
# Runs on localhost:3000
```

### Environment Variables
**Backend (.env):**
- `MONGO_URL` - MongoDB connection string
- `DB_NAME` - Database name
- `JWT_SECRET` - Secret for JWT signing
- `CORS_ORIGINS` - Allowed CORS origins

**Frontend (.env):**
- `REACT_APP_BACKEND_URL` - Backend API URL

## 📝 Changelog

### v1.0.3 (Current)
- 🎯 Version updated to 1.0.3

### v1.0.2
- 🔒 Master key moved to environment variable (MASTER_KEY)
- 📚 Complete security documentation (DEPLOYMENT_SECURITY.md)
- 🔐 .env.example files added for both frontend and backend
- 📋 Enhanced .gitignore for secret protection
- 🎯 Version indicator in dashboard sidebar
- 📡 Version endpoint: GET /api/version

### v2.0
- ✨ Azure DevOps/FreshService theme
- ✨ FIFO queue system for gift items
- ✨ Flexible amount field (text + numbers)
- ✨ Complete variables CRUD system
- ✨ User delete and permission editing
- ✨ All text in English
- ✨ API Endpoints documentation (Super Admin only)
- 🔒 Enhanced security features
- 📊 Performance optimizations

### v1.0
- Initial release
- Basic user management
- Items send system
- Server status control
- Activity logs

## 📞 Support

For issues or questions:
1. Check `/app/SECURITY_AND_LIMITS.md`
2. Review API documentation in dashboard
3. Check test credentials in `/app/memory/test_credentials.md`

## 📄 License

Production-ready admin dashboard built with FastAPI, React, and MongoDB.

---

**Built with ❤️ using Azure DevOps design principles**
