# Secure Deployment Guide

## 🔒 Pre-Deployment Security Checklist

### 1. Generate New Master Key

**Never use the default master key in production!**

```bash
# Generate a secure master key
python -c "import secrets; print('MASTER_KEY=' + secrets.token_urlsafe(32))"
```

Copy the output and add it to your backend `.env` file.

### 2. Generate New JWT Secret

```bash
# Generate a secure JWT secret
python -c "import secrets; print('JWT_SECRET=' + secrets.token_urlsafe(64))"
```

### 3. Configure Environment Variables

#### Backend (.env)
```bash
# Required
MONGO_URL="your_mongodb_connection_string"
DB_NAME="your_database_name"
JWT_SECRET="your_generated_jwt_secret"
MASTER_KEY="your_generated_master_key"

# Optional
CORS_ORIGINS="https://yourdomain.com"
```

#### Frontend (.env)
```bash
REACT_APP_BACKEND_URL="https://api.yourdomain.com"
```

### 4. Security Best Practices

✅ **DO:**
- Use HTTPS for all connections
- Store secrets in environment variables
- Use strong, unique keys (32+ characters)
- Rotate keys periodically (every 6-12 months)
- Enable rate limiting
- Monitor failed login attempts
- Implement IP whitelisting for admin access
- Keep dependencies updated
- Use a firewall (WAF)
- Regular security audits
- Implement backup strategy

❌ **DON'T:**
- Commit .env files to git
- Share master key publicly
- Use default/example keys in production
- Store secrets in code
- Disable CORS in production
- Ignore security updates
- Use weak passwords

## 🚀 Deployment Steps

### Option 1: Deploy on Emergent (Recommended)

1. **Set Environment Variables**
   - Go to Settings → Environment Variables
   - Add all required variables
   - Never commit the actual .env file

2. **Deploy**
   - Push your code
   - Emergent handles the rest

### Option 2: Self-Hosted (Docker)

1. **Create docker-compose.yml**
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    env_file: ./backend/.env
    ports:
      - "8001:8001"
    depends_on:
      - mongodb

  frontend:
    build: ./frontend
    env_file: ./frontend/.env
    ports:
      - "3000:3000"

  mongodb:
    image: mongo:latest
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}

volumes:
  mongodb_data:
```

2. **Build and Run**
```bash
docker-compose up -d
```

### Option 3: Manual Deployment

#### Backend
```bash
cd backend
pip install -r requirements.txt
# Set environment variables
export MASTER_KEY="your_generated_key"
export JWT_SECRET="your_jwt_secret"
uvicorn server:app --host 0.0.0.0 --port 8001
```

#### Frontend
```bash
cd frontend
yarn install
yarn build
# Serve with nginx or your preferred web server
```

## 🔐 Post-Deployment Security

### 1. Change Default Master Key Immediately

```bash
# In your backend .env
MASTER_KEY="your_new_secure_key_generated_with_secrets_module"
```

### 2. Set Up Monitoring

- Monitor failed login attempts
- Track API usage patterns
- Set up alerts for suspicious activity
- Log all admin actions

### 3. Regular Maintenance

- Update dependencies monthly
- Rotate keys every 6 months
- Review logs weekly
- Audit user permissions quarterly
- Test backup recovery annually

## 🛡️ Access Control

### Super Admin Access

1. **Initial Login**
   - Use your generated master key
   - Create regular admin users immediately
   - Never share the master key

2. **Create Admin Users**
   ```bash
   # Via API or Dashboard
   POST /api/users
   {
     "username": "admin_name",
     "permissions": ["send_items", "view_logs"]
   }
   ```

3. **Distribute Access Keys Securely**
   - Send via encrypted channel
   - Never via email or chat
   - Use password managers
   - One-time view links

### Permission Structure

```
Super Admin (Master Key)
├── Full access to everything
├── Can create users
└── Can delete users

Regular Users (Access Keys)
├── send_items: Send items to players
├── change_status: Manage server status
├── view_logs: View activity logs
├── manage_users: Create/edit users
└── manage_variables: Manage variables
```

## 🔍 Security Monitoring

### What to Monitor

1. **Failed Login Attempts**
   - More than 10/minute → Potential brute force
   - Action: Temporary IP ban

2. **API Response Times**
   - Slower than 500ms → Performance issue
   - Action: Investigate and optimize

3. **Database Queries**
   - Longer than 1 second → Needs indexing
   - Action: Add indexes

4. **Memory Usage**
   - Over 80% → Scale up needed
   - Action: Increase resources

### Set Up Alerts

```bash
# Example: Monitor failed logins
GET /api/logs?log_type=auth&limit=100
# If failed_count > 10 in last minute → Alert
```

## 🔄 Key Rotation

### When to Rotate

- Every 6-12 months (scheduled)
- After security incident (immediate)
- When team member leaves (immediate)
- Suspected compromise (immediate)

### How to Rotate

1. **Generate New Key**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

2. **Update Environment Variables**
```bash
# Backend .env
MASTER_KEY="new_generated_key"
JWT_SECRET="new_jwt_secret"
```

3. **Restart Services**
```bash
# Emergent: Auto-restart on deploy
# Docker: docker-compose restart
# Manual: Restart backend process
```

4. **Notify Team**
   - Distribute new master key securely
   - Invalidate old keys
   - Update documentation

## 📋 Compliance

### GDPR Compliance
- Log user actions
- Provide data export
- Allow user deletion
- Encrypt sensitive data

### SOC 2 Compliance
- Enable audit logging
- Implement access controls
- Regular security audits
- Disaster recovery plan

## 🆘 Emergency Procedures

### If Master Key is Compromised

1. **Immediate Actions**
   ```bash
   # Generate new key
   NEW_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
   
   # Update in production
   # Deploy immediately
   ```

2. **Revoke All Sessions**
   - Change JWT_SECRET
   - Force all users to re-login

3. **Audit Logs**
   - Check for unauthorized access
   - Review all recent actions

### If Database is Compromised

1. **Isolate Database**
2. **Change All Passwords**
3. **Restore from Backup**
4. **Audit User Access**
5. **Notify Affected Users**

## 📝 Checklist Before Going Live

- [ ] Generated new MASTER_KEY
- [ ] Generated new JWT_SECRET
- [ ] Updated all .env files
- [ ] Tested with new keys
- [ ] HTTPS enabled
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] .gitignore includes .env
- [ ] Documentation updated
- [ ] Team trained on security
- [ ] Emergency contacts defined
- [ ] Incident response plan ready

## 🎯 Quick Reference

### Environment Variables Priority

1. Production environment variables (Emergent/Docker)
2. .env file (never commit!)
3. .env.example (template only)
4. Default values (development only)

### Key Files to Secure

```
❌ Never Commit:
- backend/.env
- frontend/.env
- Any file containing secrets

✅ Safe to Commit:
- backend/.env.example
- frontend/.env.example
- .gitignore
- Documentation
```

---

**Remember**: Security is not a one-time setup. It's an ongoing process!
