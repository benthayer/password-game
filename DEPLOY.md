# Deployment Guide

This document covers deploying Password Game to `apps.benthayer.com`.

## Architecture

- **Frontend**: Nginx container serving static files at `passwordgame.apps.benthayer.com` (port 48607)
- **Backend**: Node.js container at `api.passwordgame.apps.benthayer.com` (port 48608)
- **Storage**: Backblaze B2 for encrypted blob storage
- **Database**: SQLite for account/credits data (persisted via Docker volume)

```
┌─────────────────────────────────────────────────────────────────┐
│                         NGINX (server)                          │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
   ┌──────────────┐              ┌──────────────┐
   │ Port 48607   │              │ Port 48608   │
   │ Frontend     │              │ Backend API  │
   │ (Nginx)      │   ────────►  │ (Node.js)    │
   └──────────────┘              └──────────────┘
                                        │
                                        ▼
                                 ┌──────────────┐
                                 │ Backblaze B2 │
                                 │ (blob store) │
                                 └──────────────┘
```

## Prerequisites

- SSH access to `deploy@apps.benthayer.com`
- Node.js and npm installed locally
- Docker and docker-compose on the server

## Environment Files

### Local Development (`.env.local`)

Located at `/home/ben/projects/password-game/.env.local`:

```bash
# Test bucket credentials
B2_KEY_ID=<test-key-id>
B2_KEY=<test-key>
B2_BUCKET=password-game-test
B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com

ADMIN_SECRET=<admin-secret>
```

### Production (`.env` on server)

Located at `/home/deploy/apps/password-game/.env`:

```bash
# Production bucket credentials  
B2_KEY_ID=<prod-key-id>
B2_KEY=<prod-key>
B2_BUCKET=password-game
B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com

ADMIN_SECRET=<admin-secret>
```

**Important**: `.env` is gitignored. It must be created manually on the server.

## Deployment Steps

### 1. Sync Code to Server

```bash
cd /home/ben/projects/password-game

# Sync code (preserves .env and data/ on server)
rsync -avz \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude '.env*' \
  --exclude 'data' \
  ./ deploy@apps.benthayer.com:/home/deploy/apps/password-game/
```

### 2. Deploy with Docker Compose

```bash
ssh deploy@apps.benthayer.com "cd /home/deploy/apps/password-game && \
  docker compose down && \
  docker compose up -d --build"
```

### 3. Verify Deployment

```bash
# Check containers are running
ssh deploy@apps.benthayer.com "docker ps | grep password-game"

# Check backend health
curl -s https://api.passwordgame.apps.benthayer.com/health

# Check frontend
curl -s -o /dev/null -w "%{http_code}" https://passwordgame.apps.benthayer.com/
```

## Quick Deploy (All-in-One)

```bash
cd /home/ben/projects/password-game

# Sync and deploy
rsync -avz \
  --exclude 'node_modules' --exclude 'dist' --exclude '.git' \
  --exclude '.env*' --exclude 'data' \
  ./ deploy@apps.benthayer.com:/home/deploy/apps/password-game/

ssh deploy@apps.benthayer.com "cd /home/deploy/apps/password-game && \
  docker compose down && docker compose up -d --build"

# Verify
curl -s https://api.passwordgame.apps.benthayer.com/health
```

## Server Configuration

### Nginx Config (managed by sync-nginx)

The server config at `/home/deploy/config` contains:

```
proxy,passwordgame.apps.benthayer.com,48607
proxy,api.passwordgame.apps.benthayer.com,48608
```

### Docker Compose Services

| Service | Container Name | Internal Port | External Port |
|---------|---------------|---------------|---------------|
| frontend | password-game-frontend | 80 | 48607 |
| backend | password-game-backend | 3001 | 48608 |

## Directory Structure on Server

```
/home/deploy/apps/password-game/
├── .env                    # Production environment (gitignored, manual)
├── data/                   # SQLite database (persisted)
│   └── accounts.db
├── docker-compose.yml
├── Dockerfile              # Frontend Dockerfile
├── Dockerfile.backend      # Backend Dockerfile
├── nginx.conf              # Frontend nginx config
├── package.json
├── package-lock.json
└── packages/
    ├── backend/
    │   ├── package.json
    │   └── src/
    └── frontend/
        ├── package.json
        └── src/
```

## Troubleshooting

### Backend Won't Start

Check logs:
```bash
ssh deploy@apps.benthayer.com "docker logs password-game-backend --tail 100"
```

Common issues:
- Missing `.env` file - create it with B2 credentials
- Missing `data/` directory - create it: `mkdir -p data`

### B2 Connection Errors

Verify credentials in `.env`:
```bash
ssh deploy@apps.benthayer.com "cat /home/deploy/apps/password-game/.env"
```

Test B2 connectivity:
```bash
ssh deploy@apps.benthayer.com "docker exec password-game-backend \
  node -e \"console.log(process.env.B2_BUCKET)\""
```

### Frontend Returns 502

- Check backend is running: `docker ps | grep backend`
- Check backend logs for errors
- Verify nginx proxy config points to correct port

### Database Issues

SQLite database location: `/home/deploy/apps/password-game/data/accounts.db`

View accounts:
```bash
ssh deploy@apps.benthayer.com "sqlite3 /home/deploy/apps/password-game/data/accounts.db \
  'SELECT address_hash, initial_credits, spent_credits, file_size FROM accounts;'"
```

Add credits to an account:
```bash
ssh deploy@apps.benthayer.com "sqlite3 /home/deploy/apps/password-game/data/accounts.db \
  \"UPDATE accounts SET initial_credits = initial_credits + 100 WHERE address_hash = 'ADDRESS_HASH';\""
```

### Container Won't Start - Port Conflict

Check if ports are in use:
```bash
ssh deploy@apps.benthayer.com "docker ps | grep -E '48607|48608'"
```

Stop conflicting containers before deploying.

## Viewing Logs

### Backend Logs
```bash
ssh deploy@apps.benthayer.com "docker logs password-game-backend --tail 100 -f"
```

### Frontend Logs (nginx)
```bash
ssh deploy@apps.benthayer.com "docker logs password-game-frontend --tail 100 -f"
```

## Rolling Back

If deployment fails, you can roll back by checking out a previous commit and redeploying:

```bash
cd /home/ben/projects/password-game
git log --oneline -10  # Find the commit to roll back to
git checkout <commit-hash>

# Redeploy
rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '.git' \
  --exclude '.env*' --exclude 'data' \
  ./ deploy@apps.benthayer.com:/home/deploy/apps/password-game/

ssh deploy@apps.benthayer.com "cd /home/deploy/apps/password-game && \
  docker compose down && docker compose up -d --build"

# Return to master
git checkout master
```

## First-Time Setup

If deploying to a fresh server:

1. **Create directory and sync code:**
   ```bash
   ssh deploy@apps.benthayer.com "mkdir -p /home/deploy/apps/password-game"
   rsync -avz --exclude 'node_modules' --exclude 'dist' --exclude '.git' \
     ./ deploy@apps.benthayer.com:/home/deploy/apps/password-game/
   ```

2. **Create production `.env`:**
   ```bash
   ssh deploy@apps.benthayer.com "cat > /home/deploy/apps/password-game/.env << 'EOF'
   B2_KEY_ID=<your-prod-key-id>
   B2_KEY=<your-prod-key>
   B2_BUCKET=password-game
   B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
   ADMIN_SECRET=<your-admin-secret>
   EOF"
   ```

3. **Create data directory:**
   ```bash
   ssh deploy@apps.benthayer.com "mkdir -p /home/deploy/apps/password-game/data"
   ```

4. **Add to nginx config** (`/home/deploy/config`):
   ```
   proxy,passwordgame.apps.benthayer.com,48607
   proxy,api.passwordgame.apps.benthayer.com,48608
   ```

5. **Run sync to generate nginx configs:**
   ```bash
   ssh deploy@apps.benthayer.com "/home/deploy/sync"
   ```

6. **Deploy:**
   ```bash
   ssh deploy@apps.benthayer.com "cd /home/deploy/apps/password-game && \
     docker compose up -d --build"
   ```

