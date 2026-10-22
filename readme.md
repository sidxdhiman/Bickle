<div align="center">

```
██████╗  ██╗       ██████╗ ██╗  ██╗ ██╗      ███████╗
██╔══██╗ ██║      ██╔════╝ ██║ ██╔╝ ██║      ██╔════╝
██████╔╝ ██║      ██║      █████╔╝  ██║      █████╗  
██╔══██╗ ██║      ██║      ██╔═██╗  ██║      ██╔══╝  
██████╔╝ ██║      ██║      ██║  ██╗ ███████╗ ███████╗
╚═════╝  ╚═╝      ╚██████╗ ╚═╝  ╚═╝ ╚══════╝ ╚══════╝
```

**bickle@bickle-os**
─────────────────────────────────────────────
`OS:`        Bickle Personal OS v1.0
`Host:`      MERN Stack — MongoDB · Express · React · Node
`Kernel:`    React 18.3 · Vite 5.3 · Node.js
`Shell:`     JavaScript (ES2022)
`WM:`        Tailwind CSS 3.4 — class-based theming
`Theme:`     🟪 Dark Violet  ·  ☀️ Light
`Icons:`     Lucide
`Modules:`   11 — dashboard, tasks, habits, focus, calendar, notes,
             whiteboard, pdf-editor, sleep, money, translator
`Dock:`      macOS-style, magnification + accent tint included
`Wallpaper:` 8 gradient presets · custom uploads · auto accent extraction
`Uptime:`    Always-on. No subscriptions. No bloat. No cloud lock-in.
🟪 🟦 🟩 🟨 🟥 ⬛ ⬜

</div>

> *Your life, less chaotic.* A personal productivity hub built for the way your brain actually works — everything in one place, on your machine.

---

## ⚡ Highlights

- **🪟 macOS-style Dock** — floating glass bar with hover magnification, position (bottom/left/right), size, opacity, labels, and accent tint that matches your wallpaper
- **🎨 Smart Backgrounds** — classy gradient-mesh presets or upload your own photo; the app samples the dominant color and retints the entire UI (icons, buttons, dock) automatically
- **👥 Guest Sessions** — hand someone a scoped, expiring session with access to only the pages you grant. Hand it back, it's gone.
- **🌙 Themes** — dark / light, three font families, all persisted locally
- **📴 Fully local** — your data lives in your MongoDB and your browser. Nothing phones home.

## 📦 Modules

| Module | What it does |
| --- | --- |
| 📊 Dashboard | At-a-glance overview of everything |
| ✅ Tasks | Lists, custom statuses, priorities, tags, due dates |
| 🔥 Habits | Streaks and daily tracking |
| ⏱️ Focus | Pomodoro-style timer with progress ring |
| 📅 Calendar | Events, views, scheduling |
| 📝 Notes | Quick capture with categories & pinning |
| 🎨 Whiteboard | Infinite canvas drawing |
| 📄 PDF Editor | Annotate and edit PDFs in-browser |
| 🌙 Sleep | Schedule calculator |
| 💸 Money | Transactions, categories, history |
| 🌐 Translator | Quick translations |

## 🚀 Quick Start

```bash
# 1. Clone
git clone https://github.com/sidxdhiman/Bickle.git
cd Bickle

# 2. Backend (needs MongoDB running locally on :27017)
cd backend
npm install
npm run dev          # → http://localhost:5000

# 3. Frontend (new terminal)
cd ../frontend
npm install
npm run dev          # → http://localhost:5173
```

Backend reads `.env` for `PORT`, `MONGODB_URI`, and `JWT_SECRET`. The frontend bootstraps a local dev account on first run, so you can just open it and go.

## 🗂️ Layout

```
Bickle/
├── backend/
│   ├── config/        # DB + page-access maps
│   ├── controllers/   # tasks, notes, calendar, money, habits…
│   ├── middleware/    # auth (JWT + guest scopes)
│   ├── models/        # Mongoose schemas
│   ├── routes/        # /api/* endpoints
│   └── server.js
└── frontend/
    ├── src/
    │   ├── components/   # Dock, TopNav, modals, BackgroundLayer…
    │   ├── config/       # page registry
    │   ├── context/      # AccessContext (guest sessions)
    │   ├── hooks/        # useDockSettings, useNavMode, useBackground
    │   ├── layouts/      # MainLayout
    │   ├── pages/        # one file per module
    │   └── utils/        # theme, color extraction, presets
    └── index.html
```

## 🧰 Tech Stack

**Frontend** — React 18 · Vite 5 · Tailwind CSS 3 · React Router 6 · Framer Motion · Lucide · pdf-lib/pdfjs
**Backend** — Express 4 · Mongoose 8 · JWT auth · bcryptjs

---

<div align="center">

Named after Travis Bickle *(Robert De Niro)*. You talkin' to me?

`Personal use only — not built for multi-user scaling.`

🟪 🟦 🟩 🟨 🟥 ⬛ ⬜

</div>
