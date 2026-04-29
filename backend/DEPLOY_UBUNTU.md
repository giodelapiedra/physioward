# PhysioWard Backend — Ubuntu Deployment Guide

Deploy the Node/Express + PostgreSQL backend to a self-managed Ubuntu server.

Tested against Ubuntu 22.04 LTS and 24.04 LTS. Assumes you already have SSH
access and sudo on the box.

---

## 0. What you are deploying

| Thing             | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Runtime           | Node.js 20 LTS                                           |
| Language          | TypeScript (built to `dist/` via `npm run build`)        |
| Framework         | Express 4                                                |
| Database          | PostgreSQL 14+ (database name `nookal`)                  |
| Listens on        | `PORT=3001` (loopback only — Nginx proxies to it)        |
| Process manager   | PM2 (recommended) OR systemd unit (both shown)           |
| External services | Nookal API v2 (REST) + v3 (GraphQL)                      |
| Public entrypoint | `https://api2.tanauancity.com` → Nginx → `127.0.0.1:3001` |

The backend runs migrations automatically on boot (`src/index.ts` calls
`runMigrations()` then `seedInitialUser()`), so you do **not** need to run
`npm run db:migrate` manually the first time.

---

## 1. Prepare the server

SSH into the server as a sudo user.

### 1.1 Update + install base tools

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw build-essential ca-certificates gnupg
```

### 1.2 Install Node.js 20 (via NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should print v20.x
npm --version
```

### 1.3 Install PostgreSQL

If you already have PostgreSQL running on this server (from another project),
**skip the install** and jump to 1.4.

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo systemctl status postgresql   # should show "active (running)"
```

### 1.4 Create the database + app user

Pick a strong password for the DB user — you'll paste it into `.env` below.

```bash
sudo -u postgres psql <<'SQL'
CREATE USER physioward WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
CREATE DATABASE nookal OWNER physioward;
GRANT ALL PRIVILEGES ON DATABASE nookal TO physioward;
SQL
```

Verify:

```bash
psql "postgres://physioward:REPLACE_WITH_STRONG_PASSWORD@localhost:5432/nookal" -c '\conninfo'
```

You should see `You are connected to database "nookal" ...`. Press `\q` to exit
if it drops you into a psql prompt.

### 1.5 Firewall (UFW)

Only expose SSH + HTTP + HTTPS. Keep port 3001 and 5432 private.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'     # 80 + 443, available after step 4
sudo ufw enable
sudo ufw status
```

### 1.6 Create a dedicated system user for the app (recommended)

Running Node as your sudo user is fine for a POC, but a dedicated user is
safer — it can't modify other projects on the box.

```bash
sudo adduser --system --group --home /opt/physioward --shell /bin/bash physioward
sudo mkdir -p /opt/physioward
sudo chown physioward:physioward /opt/physioward
```

From here on, anything that touches the app code should be run as `physioward`:

```bash
sudo -iu physioward       # opens a shell as the physioward user
```

---

## 2. Get the code onto the server

Pick ONE of the two options. If your repo is private, use Option A.

### Option A — clone from Git (recommended)

As the `physioward` user:

```bash
cd /opt/physioward
git clone https://github.com/YOUR_ORG/physioward-v2.git app
cd app/backend
```

If the repo is private, set up a deploy key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ''
cat ~/.ssh/id_ed25519.pub
```

Copy that public key into GitHub → Settings → Deploy keys (read-only is fine).

### Option B — rsync from your Windows machine

From PowerShell on your dev machine (not on the server):

```powershell
# Replace with your server's IP/hostname and the deploy user
$SERVER = "youruser@your.server.ip"

rsync -avz --exclude node_modules --exclude dist --exclude .env `
  "D:/New folder (7)/PhysioWard_v2/physioward-v2/" `
  "${SERVER}:/opt/physioward/app/"
```

Windows rsync: install via `winget install cwRsync` or use WSL.

---

## 3. Configure + build the backend

As the `physioward` user, in `/opt/physioward/app/backend`:

### 3.1 Install dependencies

```bash
npm ci                 # faster + reproducible; uses package-lock.json
```

### 3.2 Create `.env`

```bash
cp .env.example .env
nano .env
```

Fill these in — the app will refuse to start if any are invalid (zod check in
`src/config/env.ts`):

```
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://app.tanauancity.com         # change to wherever the React app lives

DATABASE_URL=postgres://physioward:REPLACE_WITH_STRONG_PASSWORD@localhost:5432/nookal

NOOKAL_API_KEY=<v2 key from Nookal>
NOOKAL_BASE_URL=https://api.nookal.com/production/v2
NOOKAL_LOCATION_NEWPORT=<id>
NOOKAL_LOCATION_NARRABEEN=<id>
NOOKAL_LOCATION_BROOKVALE=<id>

NOOKAL_V3_BASE_URL=https://au-apiv3.nookal.com
NOOKAL_V3_CLIENT_ID=<v3 client id>
NOOKAL_V3_CLIENT_SECRET=<v3 Basic Key>
NOOKAL_V3_LOCATION_NEWPORT=1
NOOKAL_V3_LOCATION_NARRABEEN=2
NOOKAL_V3_LOCATION_BROOKVALE=6

CEO_EMAIL=sam@physioward.com.au
CEO_PASSWORD=<strong password — you will change it in-app after first login>

JWT_SECRET=<paste output of: openssl rand -base64 48>
JWT_EXPIRES_IN=15m

SNAPSHOT_TTL_MINUTES=60
```

Generate the JWT secret:

```bash
openssl rand -base64 48
```

Lock down the file so only the app user can read it:

```bash
chmod 600 .env
```

### 3.3 Build TypeScript

```bash
npm run build
```

This produces `dist/` and copies `src/db/migrations/` into `dist/db/migrations/`
(see the `build` script in `package.json`).

### 3.4 Smoke test

```bash
npm start
```

Expected output:

```
[db] migrations up to date
[db] seeded CEO user: sam@physioward.com.au
🚀 PhysioWard Backend — http://localhost:3001
```

From a second terminal on the server:

```bash
curl http://127.0.0.1:3001/api/health
# → {"status":"ok","timestamp":"..."}
```

Stop it with `Ctrl+C`. You will run it under PM2 next.

---

## 4. Run as a service

Two options. Pick one. **PM2 is easier; systemd is more "standard Ubuntu".**

### Option A — PM2 (recommended)

Install globally (as root, once):

```bash
sudo npm install -g pm2
```

As the `physioward` user, in `/opt/physioward/app/backend`:

```bash
pm2 start dist/index.js --name physioward-backend --time
pm2 save
```

Install the boot script so PM2 auto-starts on reboot (one-time, run as root
with the generated command):

```bash
# Run as physioward user — it prints the exact sudo command to copy/paste
pm2 startup systemd -u physioward --hp /opt/physioward
```

Useful commands:

```bash
pm2 status
pm2 logs physioward-backend --lines 100
pm2 restart physioward-backend
pm2 stop physioward-backend
```

### Option B — systemd unit

As root:

```bash
sudo nano /etc/systemd/system/physioward-backend.service
```

Paste:

```ini
[Unit]
Description=PhysioWard Backend (Node.js / Express)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=physioward
Group=physioward
WorkingDirectory=/opt/physioward/app/backend
EnvironmentFile=/opt/physioward/app/backend/.env
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=physioward-backend

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/physioward/app/backend

[Install]
WantedBy=multi-user.target
```

Enable + start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now physioward-backend
sudo systemctl status physioward-backend
sudo journalctl -u physioward-backend -f       # tail logs
```

---

## 5. Nginx reverse proxy + HTTPS

The backend listens on `127.0.0.1:3001` (loopback). Nginx terminates TLS and
forwards `/api/*` to it.

### 5.1 Install Nginx + certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 5.2 Point DNS

In your DNS provider, create an A record:

```
api2.tanauancity.com    A    <server public IP>
```

Wait a minute, then verify from your laptop: `nslookup api2.tanauancity.com`.

### 5.3 Site config

```bash
sudo nano /etc/nginx/sites-available/physioward-api
```

Paste (replace the domain):

```nginx
server {
    listen 80;
    server_name api2.tanauancity.com;

    # Allow certbot to write HTTP-01 challenge files
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Cookies (refresh token) need these
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";

        proxy_read_timeout 60s;
        client_max_body_size 2m;
    }
}
```

Enable + reload:

```bash
sudo ln -s /etc/nginx/sites-available/physioward-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Quick check from your laptop:

```
curl http://api2.tanauancity.com/api/health
```

### 5.4 Get an HTTPS certificate

```bash
sudo certbot --nginx -d api2.tanauancity.com
```

Certbot auto-edits the config to add TLS and the 80→443 redirect. Auto-renew is
installed as a systemd timer — verify with `systemctl list-timers | grep certbot`.

Verify end-to-end:

```
curl https://api2.tanauancity.com/api/health
```

---

## 6. Frontend (brief)

The backend is now live. For the React frontend:

- Build on your machine or on the server: `cd frontend && npm ci && npm run build`
- Serve the contents of `frontend/dist/` from another Nginx server block (e.g.
  `app.tanauancity.com`) as static files.
- Make sure the frontend calls `https://api2.tanauancity.com/api/...` and that
  `FRONTEND_URL` in the backend `.env` matches the frontend origin exactly
  (CORS uses it with `credentials: true`).

If you want, I can write a separate frontend deploy guide — just ask.

---

## 7. Day-two operations

### Deploying updates

As the `physioward` user:

```bash
cd /opt/physioward/app
git pull
cd backend
npm ci
npm run build

# PM2:
pm2 restart physioward-backend

# systemd:
sudo systemctl restart physioward-backend
```

Migrations in new `src/db/migrations/*.sql` files run automatically on restart.

### Viewing logs

```bash
# PM2
pm2 logs physioward-backend --lines 200

# systemd
sudo journalctl -u physioward-backend -n 200 --no-pager
sudo journalctl -u physioward-backend -f
```

### Database backup

Daily `pg_dump` to a local folder (add to the `physioward` user's crontab via
`crontab -e`):

```
15 3 * * * pg_dump -Fc "postgres://physioward:PASSWORD@localhost:5432/nookal" \
  > /opt/physioward/backups/nookal-$(date +\%F).dump && \
  find /opt/physioward/backups -name 'nookal-*.dump' -mtime +14 -delete
```

Create the backups dir first: `mkdir -p /opt/physioward/backups`.

### Rotating the JWT secret

Changing `JWT_SECRET` invalidates all issued access + refresh tokens (everyone
has to log in again). Do this if you suspect a leak:

```bash
openssl rand -base64 48          # copy output
nano .env                        # replace JWT_SECRET
pm2 restart physioward-backend   # or systemctl restart
```

---

## 8. Troubleshooting

| Symptom                                    | Check this                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| App exits with "Invalid environment config"| A required var in `.env` is missing or wrong format. Error lists which.    |
| `ECONNREFUSED 127.0.0.1:5432`              | PostgreSQL isn't running. `sudo systemctl status postgresql`.              |
| `password authentication failed`           | `DATABASE_URL` password wrong. Re-test with `psql "$DATABASE_URL"`.        |
| 502 Bad Gateway from Nginx                 | Backend is down. `pm2 status` / `journalctl -u physioward-backend`.        |
| CORS error in browser console              | `FRONTEND_URL` in `.env` doesn't exactly match the frontend origin.        |
| Login works then dies on refresh           | Refresh cookie blocked — check HTTPS is on and `SameSite` isn't an issue.  |
| Migrations didn't run                      | Check boot logs — you want to see `[db] migrations up to date`.            |

Port already in use:

```bash
sudo ss -tlnp | grep 3001
```

---

## 9. Hardening checklist (do before going live)

- [ ] `.env` is `chmod 600` and owned by the app user
- [ ] `CEO_PASSWORD` from the env is **only** used for the first seed — change
      it in-app after first login (the seed is idempotent and won't overwrite)
- [ ] `JWT_SECRET` is ≥ 32 chars and unique per environment
- [ ] UFW only exposes 22 / 80 / 443
- [ ] PostgreSQL is listening on `localhost` only (default on Ubuntu — verify
      with `sudo ss -tlnp | grep 5432` — you want `127.0.0.1:5432` not `0.0.0.0`)
- [ ] `NODE_ENV=production` in `.env` (error responses hide stack traces)
- [ ] Certbot auto-renew timer is active
- [ ] Daily `pg_dump` cron is in place
- [ ] SSH: disable password auth, key-only (`/etc/ssh/sshd_config` →
      `PasswordAuthentication no`, then `sudo systemctl reload ssh`)

---

## 10. Quick reference

```bash
# Tail live logs
pm2 logs physioward-backend
# or
sudo journalctl -u physioward-backend -f

# Restart after code change
cd /opt/physioward/app/backend && git pull && npm ci && npm run build && pm2 restart physioward-backend

# Open psql on the prod DB
psql "$(grep ^DATABASE_URL /opt/physioward/app/backend/.env | cut -d= -f2-)"

# Verify backend reachable
curl https://api2.tanauancity.com/api/health
```
