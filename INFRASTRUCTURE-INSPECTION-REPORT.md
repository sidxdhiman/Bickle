# Infrastructure Inspection Report — Bickle Personal Cloud Server

**Date:** 2026-11-01
**Machine:** HP Victus 15 (Ryzen 5 5600H, 14 GB RAM, 475 GB NVMe)
**OS:** Fedora Linux 43 KDE Plasma Desktop
**Kernel:** 7.1.4-104.fc43.x86_64
**Hostname:** `fedora` (static hostname unset)

---

## 1. System Overview

| Item | Value |
|------|-------|
| Disk free | 99 GB of 475 GB (80 % used) |
| RAM | 14 GB total, ~8.5 GB available |
| Swap | 19 GB (12 GB file + 8 GB zram) |
| CPU governor | `powersave` |
| Temps | 44–46 °C, fans 2400–2700 RPM |
| Battery | Full, AC online |
| Timezone | Asia/Kolkata (IST) |
| SELinux | **Enforcing** (targeted policy) |
| Firewall | firewalld running, FedoraWorkstation zone on `wlo1` |
| Network | `wlo1` — 192.168.1.17/24, IPv6 link + global |
| Docker | Active, enabled; only a `hello-world` container |
| Ollama | Active on `127.0.0.1:11434` |
| OpenClaw Gateway | Active (user service) |
| Port 9000 | **Free** |

### Listening ports (notable)

| Port | Address | Process |
|------|---------|---------|
| 27017 | 127.0.0.1 | mongod |
| 5000 | 0.0.0.0 (all ifaces) | node-22 (Bickle backend) |
| 5173 | [::1] | vite (Bickle frontend dev) |
| 11434 | 127.0.0.1 | ollama |
| 1716 | * | kdeconnectd |
| 5355 | 0.0.0.0 | LLMNR (openclaw) |
| 631 | 127.0.0.1 | CUPS |

---

## 2. MongoDB

| Item | Value |
|------|-------|
| Package | `mongodb-org-server-7.0.37-1.el9.x86_64` |
| Repository | `mongodb-org-7.0` (EL9 baseurl — **unsupported on Fedora 43**) |
| Repo file | `/etc/yum.repos.d/mongodb-org.repo` — **contains a corrupted duplicate section** (two sections concatenated; one with `gpgcheck=0`) |
| Data path | `/var/lib/mongo` (21 MB) |
| Bind | `127.0.0.1:27017` ✓ |
| Port | 27017 ✓ |
| systemd | `mongod.service` — enabled, active |
| **Authentication** | **DISABLED** — `security:` block commented out in `/etc/mongod.conf` |
| mongodump / mongorestore | Available (`mongodb-database-tools-100.17.0`) |
| mongosh | Available (`2.9.2`) |

### Databases (22)

| Database | Data size | Storage |
|----------|-----------|---------|
| admin | 0 KB | 20 KB |
| bickle | 5 KB | 336 KB |
| config | 2 KB | 36 KB |
| hathap | 11 KB | 140 KB |
| hathap_dbg | 4 KB | 144 KB |
| hathap_test | 14 KB | 172 KB |
| hathap_test_engine | 57 KB | 140 KB |
| hathap_test_evaluation | 0 KB | 208 KB |
| hathap_test_intelligence | 0 KB | 100 KB |
| hathap_test_memory | 0 KB | 148 KB |
| hathap_test_memory_e2e | 0 KB | 136 KB |
| hathap_test_p4exec | 56 KB | 216 KB |
| hathap_test_phase10 | 0 KB | 132 KB |
| hathap_test_plan | 209 KB | 188 KB |
| hathap_test_plan_exec | 259 KB | 300 KB |
| hathap_test_research | 19 KB | 148 KB |
| hathap_test_research_sec | 0 KB | 108 KB |
| hathap_test_routing | 136 KB | 248 KB |
| hathap_test_routing_debug | 2 KB | 80 KB |
| local | 181 KB | 60 KB |
| opentime | 84 KB | 484 KB |
| personal-os-dashboard | 0 KB | 40 KB |
| xebia_employee_dashboard_v4 | 590 KB | 172 KB |

### bickle database collections

| Collection | Documents |
|------------|-----------|
| artblogs | 0 |
| tasklists | 1 |
| notes | 0 |
| sleeps | 0 |
| calendarevents | 1 |
| categories | 0 |
| transactions | 0 |
| artvideos | 0 |
| users | 2 |
| habits | 0 |
| usercategories | 16 |
| whiteboards | 1 |
| artphotos | 0 |
| guestsessions | 1 |
| artmusics | 0 |
| tasks | 3 |

### Auth verification

- `connectionStatus` shows `authenticatedUsers: []` — **no authentication configured**
- `system.users` is empty in both `admin` and `bickle`
- `getParameter: {security: 1}` returns no security options — confirms authorization is off

---

## 3. Bickle Application (running in dev mode)

### Structure

```
Bickle/
├── backend/          Express + Mongoose (port 5000)
│   ├── server.js
│   ├── routes/       12 route files
│   ├── models/       16 Mongoose models
│   ├── middleware/   auth.js, scope.js, artUpload.js
│   ├── config/       pages.js
│   └── uploads/      (empty, art/)
├── frontend/         React + Vite (port 5173)
│   ├── src/
│   └── dist/         production build (8.6 MB)
└── readme.md
```

### Backend

| Item | Value |
|------|-------|
| Framework | Express 4.19 |
| ODM | Mongoose 8.3 |
| Port | 5000 (hardcoded fallback; `PORT` env supported) |
| Bind | `0.0.0.0` (all interfaces) — **security risk** |
| .env file | **Does not exist** |
| JWT secret | Falls back to `'bickle-dev-secret-change-me'` — **insecure** |
| MongoDB URI | Falls back to `mongodb://127.0.0.1:27017/bickle` |
| Run method | `npm run dev` (nodemon) via terminal |
| systemd unit | **None** |

### Frontend

| Item | Value |
|------|-------|
| Framework | React 18 + Vite 5 |
| Dev port | 5173 (localhost only) |
| API base URL | `axios.defaults.baseURL = 'http://localhost:5000/api'` (App.jsx:27) — **hardcoded; breaks behind reverse proxy** |
| Production build | `frontend/dist/` exists (8.6 MB), last built 2026-10-25 |
| Run method | `npm run dev` (vite) via terminal |

---

## 4. Installed Repositories

| Repo | Purpose |
|------|---------|
| fedora / updates | Fedora 43 base |
| mongodb-org-7.0 | MongoDB (EL9 packages — corrupted .repo file) |
| docker-ce-stable | Docker Engine |
| rpmfusion-free / nonfree | Multimedia, codecs |
| code | VS Code |
| vivaldi | Vivaldi browser |
| antigravity-rpm | Third-party |
| fedora-cisco-openh264 | H.264 codec |

---

## 5. Firewall

```
FedoraWorkstation (default, active)
  interfaces: wlo1
  services: dhcpv6-client samba-client ssh
  ports: 1025-65535/udp  1025-65535/tcp    ← overly permissive
```

- Ports 80 and 443 are **not** explicitly opened (below 1025 range).
- The 1025–65535 range is wide open on both TCP and UDP — should be removed.
- Docker zone also present on `docker0`.

---

## 6. Cloudflare

| Item | Status |
|------|--------|
| cloudflared | Not installed |
| ~/.cloudflared/ | Does not exist |
| Domain | None found in hosts, DNS, or config |
| Cloudflare account | Unknown — no cert.pem or config present |

---

## 7. Power Management

| Item | Value |
|------|-------|
| TLP | Not installed / inactive |
| power-profiles-daemon | Inactive |
| logind sleep config | All defaults (no overrides) |
| CPU governor | powersave |
| Battery | Full (100 %), AC online |

---

## 8. Logging

| Item | Value |
|------|-------|
| journald | Persistent (`/var/log/journal` exists, 1.3 GB) |
| rsyslog | Active |
| logrotate | Present with standard configs |
| mongod.log | 52 MB at `/var/log/mongodb/mongod.log` |

---

## 9. Critical Issues Summary

1. **MongoDB has no authentication** — any local process can read/write all databases.
2. **Backend binds to 0.0.0.0:5000** — exposed to the entire LAN.
3. **Insecure JWT secret fallback** in `server.js`.
4. **Frontend hardcodes `http://localhost:5000/api`** — breaks behind Nginx/tunnel.
5. **Firewall opens 1025–65535** on TCP and UDP — overly permissive.
6. **MongoDB repo file corrupted** — duplicate section with `gpgcheck=0`.
7. **No systemd services** for Bickle — won't survive reboot.
8. **No MongoDB backups** configured.
9. **MongoDB EL9 package on Fedora 43** — unsupported; needs pinning/retention strategy.
10. **No Nginx, no cloudflared** installed.

---

## 10. Proposed Changes (pending approval)

| # | Change | Risk |
|---|--------|------|
| 1 | Enable MongoDB auth (`security.authorization: true`), create root + app users | Medium — requires mongod restart; data preserved |
| 2 | Fix MongoDB repo file (remove duplicate section, restore gpgcheck) | Low |
| 3 | Pin mongodb-org packages to prevent accidental upgrades | Low |
| 4 | Create `/opt/personal-cloud/` directory structure | Low |
| 5 | Create `bickle` system user and systemd unit (backend on 127.0.0.1:9000) | Low |
| 6 | Generate JWT secret, create protected `.env` | Low |
| 7 | Change frontend API base to relative `/api`, rebuild production bundle | Low |
| 8 | Install and configure Nginx (port 80, reverse proxy, static serving) | Low |
| 9 | Remove firewall 1025–65535 range | Low |
| 10 | Install cloudflared, create named tunnel (requires browser auth) | Low |
| 11 | Configure Cloudflare Access for private apps | Low |
| 12 | Set up MongoDB daily backups with 7-day retention | Low |
| 13 | Test backup restoration | Low |
| 14 | Configure logind to prevent sleep while plugged in | Low |
| 15 | Add disk/CPU/RAM monitoring | Low |

---

*Report generated by automated system inspection. No changes have been made to the system.*
