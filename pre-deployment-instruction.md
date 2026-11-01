# Pre-Deployment Instructions — Bickle Personal Cloud Server

**Date:** 2026-11-01
**Status:** Stage 1 & 2 Complete — Awaiting Stage 3 (Cloudflare Preparation)

---

## Architecture

```
Internet
  │
  ▼
Cloudflare (authoritative DNS + proxy + Worker)
  │
  ├─ sidharthdhiman.com ──► Netlify (portfolio, unchanged)
  │
  └─ /bickle* ──► Worker ──► bickle-origin.sidharthdhiman.com
                                │
                                ▼ (Cloudflare Tunnel, outbound only)
                        Fedora Laptop (192.168.1.17)
                          │
                          ├─ cloudflared
                          ├─ Nginx :80 (127.0.0.1 only)
                          │    ├─ /bickle/  → React dist
                          │    └─ /bickle/api/ → Express :9000
                          ├─ Express :9000 (127.0.0.1 only)
                          └─ MongoDB :27017 (127.0.0.1 only)
```

---

## Stage 1 & 2 — Local Deployment (COMPLETE)

### Verification Results

| # | Checkpoint | Status | Evidence |
|---|-----------|--------|----------|
| 1 | MongoDB works | ✅ | `ping: 1` |
| 2 | MongoDB auth works | ✅ | Admin: 23 DBs, App: 2 users, no-auth blocked |
| 3 | Database survives restart | ✅ | users=2, tasks=3, tasklists=1 intact |
| 4 | Nginx serves frontend | ✅ | `GET /bickle/ → 200`, title `<title>Bickle</title>` |
| 5 | Nginx reverse proxy | ✅ | `GET /bickle/api/tasks → 401` (auth required) |
| 6 | Node.js backend works | ✅ | Direct: "Bickle API is running...", via Nginx: 401 |
| 7 | Frontend served correctly | ✅ | CSS: 200, JS: 200, Favicon: 200 |
| 8 | API requests routed | ✅ | All `/bickle/api/*` → 401, SPA deep links → 200 |
| 9 | Cloudflare Tunnel | ⏳ | Stage 3 — pending |
| 10 | External HTTPS | ⏳ | Stage 3 — pending |
| 11 | Unauthorized blocked | ✅ | No token: "no token", invalid: "token failed", no-auth MongoDB: error |
| 12 | Auto-start services | ✅ | mongod, nginx, bickle-backend, backup timer — all enabled+active |
| 13 | MongoDB backup works | ✅ | Timer active, existing backup verified |
| 14 | Restoration tested | ✅ | 25 docs restored, 0 failures, all indexes recreated |

### Security Posture

| Item | Status |
|------|--------|
| SELinux | Enforcing |
| MongoDB bind | `127.0.0.1:27017` |
| Backend bind | `127.0.0.1:9000` |
| Nginx bind | `127.0.0.1:80` |
| Backend LAN access | Blocked (timeout) |
| Security headers | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, CSP |
| `.env` permissions | `600` (bickle:bickle) |
| No hardcoded secrets | JWT_SECRET generated, MongoDB passwords generated |

### SPA Routing

| Path | Result |
|------|--------|
| `/bickle` | 301 → `/bickle/` |
| `/bickle/` | 200 (index.html) |
| `/bickle/tasks` | 200 (SPA fallback) |
| `/bickle/calendar` | 200 (SPA fallback) |
| `/` (root) | 404 (blocked) |

### Services

| Service | Status | Enabled | Port |
|---------|--------|---------|------|
| mongod | active | yes | 127.0.0.1:27017 |
| nginx | active | yes | 127.0.0.1:80 |
| bickle-backend | active | yes | 127.0.0.1:9000 |
| bickle-mongodb-backup.timer | active | yes | — |

### Directory Structure

```
/opt/personal-cloud/
├── apps/
│   ├── frontend/dist/       # React production build (8.6 MB)
│   └── backend/             # Express app + node_modules
│       └── uploads/art/     # User uploads
├── backups/mongodb/         # Daily backups (7-day retention)
├── configs/
│   ├── bickle.env           # Environment file (600 perms)
│   └── ...
├── data/mongodb/            # (unused — MongoDB stays at /var/lib/mongo)
├── logs/
├── scripts/
│   ├── mongodb-backup.sh
│   └── mongodb-restore.sh
└── ...
```

### MongoDB

| Item | Value |
|------|-------|
| Version | 7.0.37 (EL9 package, retained) |
| Data path | /var/lib/mongo (NOT relocated) |
| Auth | Enabled (`authorization: enabled`) |
| Admin user | `bickleAdmin` (root@admin, readWrite@bickle, dbOwner@bickle) |
| App user | `bickleApp` (readWrite@bickle) |
| Databases | 23 (all preserved) |
| Backup | Daily at ~00:30, 7-day retention |
| Restore tested | ✅ 25 documents, 0 failures |

### Frontend Changes for /bickle/ Deployment

| File | Change |
|------|--------|
| `vite.config.js` | Added `base: '/bickle/'` |
| `App.jsx` | `axios.defaults.baseURL = '/bickle/api'` |
| `App.jsx` | Added `basename="/bickle"` to both `<BrowserRouter>` |
| `App.jsx` | Guest token regex updated for `/bickle/guest/*` |
| `App.jsx` | `window.location.href = '/bickle/'` on logout |
| `App.jsx` | SidArt path check includes `/bickle/sid-art` |
| `Art.jsx` | `window.open('/bickle/sid-art', ...)` |
| `ProfileModal.jsx` | Guest links: `${origin}/bickle/guest/${token}` |
| `config/pages.js` | `pageKeyForApiUrl` strips `/bickle/api` prefix |
| `utils/art.js` | `apiOrigin()` fallback updated |
| `index.html` | Inline script checks `/bickle/sid-art` |

### Backend Changes

| File | Change |
|------|--------|
| `server.js` | `app.listen(PORT, '127.0.0.1', ...)` — localhost only |

---

## Stage 3 — Cloudflare Preparation (PENDING)

### What You Need To Do

1. **Create a Cloudflare account** at `dash.cloudflare.com` (free plan is sufficient)
2. **Add `sidharthdhiman.com`** to Cloudflare — it will scan and propose DNS records
3. **Do NOT change nameservers yet** — wait for my confirmation
4. **Provide your email address** for the Cloudflare Access policy (not stored in git)

### What I Will Prepare (No DNS Changes)

- Named tunnel configuration (`bickle-tunnel`)
- `cloudflared` installation
- Cloudflare Worker code for `/bickle*` routing
- Access policies (public app + origin service token)
- Complete DNS record list for your review

---

## DNS Migration Plan (AWAITING APPROVAL)

### Current DNS State (Namecheap)

| Record | Type | Value |
|--------|------|-------|
| sidharthdhiman.com | A | 75.2.60.5 (Netlify) |
| www.sidharthdhiman.com | CNAME | sidxdhiman.netlify.app |
| sidharthdhiman.com | MX | 10 eforward1-3.registrar-servers.com |
| sidharthdhiman.com | MX | 15 eforward4.registrar-servers.com |
| sidharthdhiman.com | MX | 20 eforward5.registrar-servers.com |
| sidharthdhiman.com | TXT | v=spf1 include:spf.efwd.registrar-servers.com ~all |
| NS | NS | dns1/dns2.registrar-servers.com |

### Records to Preserve in Cloudflare

All of the above must be recreated exactly.

### Records to Create in Cloudflare

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| bickle-origin | CNAME | `<tunnel-id>.cfargotunnel.com` | Tunnel origin |
| _dmarc | TXT | `v=DMARC1; p=none; rua=mailto:<your-email>` | Email security (p=none initially) |

### Deployment Order

```
Phase 1: Local Preparation ✅ COMPLETE
  ├── 1.1  MongoDB auth + backups ✅
  ├── 1.2  Nginx reverse proxy ✅
  ├── 1.3  Systemd services ✅
  ├── 1.4  Frontend /bickle/ base path ✅
  ├── 1.5  Production build ✅
  └── 1.6  Local testing ✅

Phase 2: Cloudflare Preparation (no nameserver change)
  ├── 2.1  Create Cloudflare account ← YOUR ACTION
  ├── 2.2  Add sidharthdhiman.com to Cloudflare ← YOUR ACTION
  ├── 2.3  Verify imported DNS records
  ├── 2.4  Create named tunnel
  ├── 2.5  Install cloudflared locally
  ├── 2.6  Run tunnel, verify connectivity
  ├── 2.7  Create Worker, deploy with secrets
  ├── 2.8  Create Access policies (both layers)
  └── 2.9  Test with /etc/hosts override

Phase 3: DNS Migration (requires explicit approval)
  ├── 3.1  Review complete record list with you
  ├── 3.2  Your approval to change nameservers
  ├── 3.3  Change nameservers at Namecheap
  ├── 3.4  Wait for propagation
  ├── 3.5  Verify all records resolve
  └── 3.6  Enable Cloudflare proxy

Phase 4: Go Live
  ├── 4.1  Test root website (must be unchanged)
  ├── 4.2  Test /bickle/ path
  ├── 4.3  Test email delivery
  ├── 4.4  Test Access enforcement
  ├── 4.5  Monitor for 24 hours
  └── 4.6  Enable Cloudflare DNSSEC (optional)
```

### Key Constraints

- **No nameserver changes** until explicit approval
- **No production DNS modifications** without approval
- **Root website must remain functional** at all times
- **Email DNS records must be preserved** exactly
- **No passwords, tokens, or secrets shared in chat**
- **MongoDB never exposed publicly**
- **Backend never exposed directly**

---

## Service Management Commands

```bash
# MongoDB
sudo systemctl status mongod
sudo systemctl restart mongod
sudo systemctl stop mongod

# Nginx
sudo systemctl status nginx
sudo systemctl reload nginx    # after config changes
sudo systemctl restart nginx
sudo nginx -t                   # test config

# Backend
sudo systemctl status bickle-backend
sudo systemctl restart bickle-backend
sudo journalctl -u bickle-backend -f   # follow logs

# Backups
sudo systemctl start bickle-mongodb-backup.timer
sudo systemctl status bickle-mongodb-backup.timer
sudo /opt/personal-cloud/scripts/mongodb-backup.sh   # manual backup

# Restore
sudo /opt/personal-cloud/scripts/mongodb-restore.sh <backup_dir> [target_db]

# Full restart
sudo systemctl restart mongod nginx bickle-backend
```

---

## Local Access

- **Frontend:** http://127.0.0.1/bickle/
- **API:** http://127.0.0.1/bickle/api/
- **Backend direct:** http://127.0.0.1:9000/ (localhost only)

---

## Troubleshooting

```bash
# Check all services
systemctl status mongod nginx bickle-backend bickle-mongodb-backup.timer

# Check ports
ss -tlnp | grep -E ":80 |:9000 |:27017 "

# Check Nginx errors
sudo tail -20 /var/log/nginx/error.log

# Check backend logs
journalctl -u bickle-backend --since "1 hour ago"

# Check MongoDB logs
sudo tail -20 /var/log/mongodb/mongod.log

# Check SELinux denials
ausearch -m avc -c nginx
ausearch -m avc -c node

# Test MongoDB auth
mongosh --host 127.0.0.1 -u bickleAdmin -p '<password>' --authenticationDatabase admin

# Test API
curl http://127.0.0.1/bickle/api/tasks
curl -H "Authorization: Bearer <token>" http://127.0.0.1/bickle/api/tasks

# Test frontend
curl -I http://127.0.0.1/bickle/
curl -I http://127.0.0.1/bickle/assets/index-ByMnjRfP.css
```
