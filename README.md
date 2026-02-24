# Sprout Deploy

Overview and setup guide for the two services in this repo:

- `sprout-backend/`: Express + TypeScript API with Claude-powered agents, SQLite (Drizzle), S3 document uploads, and a Python hand-tracking websocket.
- `sprout-frontend/`: Next.js 16 app that visualizes and runs the learning graph, streams agent activity over SSE, and can be steered by hand tracking.

## Prerequisites
- Node.js 20+ and npm.
- Anaconda/Miniconda (or Python 3.11+) for the computer-vision hand tracking service.
- Gemini API key.
- AWS credentials and an S3 bucket for document uploads (skip uploads if you don’t set these).
- Webcam access (for hand tracking).
- macOS/Linux with a working camera driver; on Windows, ensure `opencv-python` can access DirectShow.

## Quick Start (development)
1) **Backend API**
   - `cd sprout-backend`
   - Create `.env` (see Env Reference below).
   - Install deps: `npm install`
   - Apply DB schema: `npm run db:migrate` (creates `sprout.db` locally)
   - Run API: `npm run dev` (http://localhost:8000; health at `/api/health`)

2) **Computer-vision hand tracking (Anaconda)**
   - `cd sprout-backend`
   - Ensure conda exists: `conda --version` (install Miniconda if missing).
   - Create env: `conda create -n sprout-cv python=3.11 -y`
   - Activate: `conda activate sprout-cv`
   - Install CV deps: `pip install -r requirements.txt`
   - Run the WS server: `python backend.py` (opens `ws://localhost:8765`; keep running while using the UI)

3) **Frontend**
   - `cd sprout-frontend`
   - Create `.env.local` (see Env Reference).
   - Install deps: `npm install`
   - Run dev server: `npm run dev` (http://localhost:3000). The app proxies `/backend-api/*` to the backend and directly connects to `http://localhost:8000` for SSE.

4) **Use it**
   - Start all three processes in separate terminals: Python hand tracker → backend → frontend.
   - Open http://localhost:3000, add a topic (branch), upload docs if desired, and watch agents stream progress in the activity card.
   - Toggle “Hand tracking” in the bottom-right of the graph view to drive the pointer with your webcam.

## Environment Reference
### Backend (`sprout-backend/.env`)
```
GEMINI_API_KEY=your_key
# Optional model overrides (defaults already set to flash to fit free tier):
# GEMINI_MODEL=gemini-2.5-flash
# GEMINI_MODEL_SMALL=gemini-2.5-flash
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
DB_PATH=./sprout.db        # optional; default shown
PORT=8000                  # optional
```

### Frontend (`sprout-frontend/.env`)
```
NEXT_PUBLIC_BACKEND_ORIGIN=http://localhost:8000
NEXT_PUBLIC_BACKEND_PROXY_PREFIX=/backend-api   # matches next.config.ts rewrite
NEXT_PUBLIC_SMALL_AGENTS=false                  # set true to use cheaper agent mode
```

## Data + Agents
- SQLite DB lives at `sprout-backend/sprout.db`; migrations are in `sprout-backend/drizzle/` and generated from `src/db/schema.ts`.
- A default user (`00000000-0000-0000-0000-000000000000`) is auto-seeded at server start.
- Agent SSE endpoints: `/api/agents/topics/:topicNodeId/run`, `/api/agents/concepts/:conceptNodeId/run`, plus diagnostic + review routes. See `sprout-backend/AGENTS.md` for flows and events.

## Handy scripts
- Backend: `npm run dev`, `npm run db:migrate`, `npm run db:generate`, `npm run db:push`, `npm run build && npm start`.
- Frontend: `npm run dev`, `npm run build && npm start`, `npm run lint` / `npm run format` (Biome).

## Troubleshooting
- **Hand tracking not moving:** ensure `python backend.py` is running in the `sprout-cv` conda env and the browser camera permission is granted.
- **Uploads fail:** confirm AWS creds/bucket in `.env`; S3 is required for document uploads.
- **SSE stops:** the frontend bypasses the proxy for streaming; verify `NEXT_PUBLIC_BACKEND_ORIGIN` matches the backend URL and CORS is enabled (it is by default in `src/index.ts`).
