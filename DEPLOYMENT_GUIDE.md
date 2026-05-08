# Vakar Games — Deployment Guide (VPS Ubuntu + Domain)

## Prerequisites
- A VPS with Ubuntu 22.04+ (ex: OVH, Hetzner, DigitalOcean)
- A domain name (ex: vakargames.com)
- SSH access to your VPS

---

## Step 1 — Connect to your VPS

```bash
ssh root@YOUR_VPS_IP
```

## Step 2 — Install dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install Python 3.10+ and pip
apt install -y python3 python3-pip python3-venv

# Install MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# Install Nginx
apt install -y nginx

# Install Certbot for HTTPS
apt install -y certbot python3-certbot-nginx

# Install Yarn
npm install -g yarn
```

## Step 3 — Clone your project

```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git vakargames
cd vakargames
```

## Step 4 — Setup Backend

```bash
cd /opt/vakargames/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=vakargames_db
CORS_ORIGINS=https://vakargames.com,https://www.vakargames.com
JWT_SECRET=CHANGE_THIS_TO_A_RANDOM_64_CHAR_STRING
EOF

# Generate a random JWT_SECRET (run this and copy the output into .env)
python3 -c "import secrets; print(secrets.token_urlsafe(64))"

# Create uploads directory
mkdir -p uploads
```

## Step 5 — Build Frontend

```bash
cd /opt/vakargames/frontend

# Create .env for production
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=https://vakargames.com
EOF

# Install dependencies and build
yarn install
yarn build
```

## Step 6 — Setup Systemd Service for Backend

```bash
cat > /etc/systemd/system/vakargames-api.service << 'EOF'
[Unit]
Description=Vakar Games API
After=network.target mongod.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vakargames/backend
Environment=PATH=/opt/vakargames/backend/venv/bin:/usr/bin
ExecStart=/opt/vakargames/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl start vakargames-api
systemctl enable vakargames-api

# Verify it's running
systemctl status vakargames-api
```

## Step 7 — Configure Nginx

```bash
cat > /etc/nginx/sites-available/vakargames << 'EOF'
server {
    listen 80;
    server_name vakargames.com www.vakargames.com;

    # Frontend (React build)
    root /opt/vakargames/frontend/build;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20M;
    }

    # React Router (SPA fallback)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/vakargames /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl reload nginx
```

## Step 8 — Configure your Domain

In your domain registrar (OVH, Cloudflare, etc.), add these DNS records:

| Type | Name | Value |
|------|------|-------|
| A    | @    | YOUR_VPS_IP |
| A    | www  | YOUR_VPS_IP |

Wait for DNS propagation (can take up to 24h, usually 5-30 min).

## Step 9 — Setup HTTPS (SSL)

```bash
certbot --nginx -d vakargames.com -d www.vakargames.com
```

Follow the prompts — Certbot will automatically configure HTTPS on Nginx.

Auto-renewal is automatic, but verify:
```bash
certbot renew --dry-run
```

## Step 10 — First Login

1. Open `https://vakargames.com/login` in your browser
2. Enter the initial setup key: `#fje&)m)fea-4_t97&^%xp@a+*nxab4bf_7!2$6^xpwf1m(ayd`
3. A popup "FIRST CONNECTION" will appear with your **new secure key**
4. **COPY AND SAVE THIS KEY** — it will never be shown again
5. The initial setup key is now permanently invalidated
6. From now on, use your new key to login

---

## Useful Commands

```bash
# Check backend status
systemctl status vakargames-api

# View backend logs
journalctl -u vakargames-api -f

# Restart backend after code changes
systemctl restart vakargames-api

# Rebuild frontend after code changes
cd /opt/vakargames/frontend && yarn build

# Reload Nginx after config changes
nginx -t && systemctl reload nginx

# MongoDB shell
mongosh vakargames_db

# Check disk usage
df -h

# Update code from Git
cd /opt/vakargames && git pull
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && yarn install && yarn build
systemctl restart vakargames-api
```

---

## Security Checklist

- [ ] Change `JWT_SECRET` in `/opt/vakargames/backend/.env` to a unique random string
- [ ] After first login, save your new Super Admin key somewhere safe
- [ ] Set `CORS_ORIGINS` to only your domain
- [ ] Configure firewall: `ufw allow 80,443/tcp && ufw allow ssh && ufw enable`
- [ ] Regular backups: `mongodump --db vakargames_db --out /backups/$(date +%Y%m%d)`
