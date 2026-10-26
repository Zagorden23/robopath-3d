# RoboPath 3D — Interactive Robot Motion Planning Simulator

**Plan Smarter. Navigate Safely. Visualize Path Planning.**

RoboPath 3D is a full-stack MERN (MongoDB, Express.js, React.js, Node.js) + Three.js / React Three Fiber interactive robotics motion-planning platform. It unifies 2D occupancy-grid search and 3D continuous/extruded arena simulation into a single synchronized workspace with live telemetry, KaTeX mathematical narration, multi-channel authentication, and persistent experiment analytics.

---

## 1. Key Capabilities

- **Synchronized 2D & 3D Simulation Engine (`SimulationContext`)**:
  - Edits to grid dimensions (`rows × cols`), obstacle walls, start/goal cells, selected planner, heuristic, 4/8-direction connectivity, and dynamic moving obstacles stay 100% synchronized across `/simulator` (3D View & Split 3D+2D View), `/simulator-2d` (2D Grid Lab), and `/algorithms` (Head-to-Head Comparison).
- **6 Verified Path-Planning Algorithms**:
  - **Graph Search**: Breadth-First Search (`BFS`), Dijkstra's Algorithm (`DIJKSTRA`), A* Search (`ASTAR`), Greedy Best-First Search (`GREEDY`).
  - **Sampling-Based Planners**: Rapidly-Exploring Random Tree (`RRT`) and Asymptotically Optimal `RRT*` (`RRT_STAR`) with local neighborhood parent selection and tree rewiring.
- **Soothing Lemon-Cream & Ivory Laboratory UI**:
  - Designed with warm lemon-cream (`#fdfaf0`) and ivory (`#f6f1de`, `#ffffff`) surfaces, contrasting deep teal navigation (`#0c353d`), deep navy typography (`#0f1e36`), muted blue/teal controls, and restrained amber highlights (`#d97706`).
  - Zero-overlap 3-column docked simulator layout with interactive 3D floor raycast editing, camera presets (`Isometric`, `Perspective`, `Top-Down`, `Front`, `Side`, `Follow Robot`), timeline scrubbing, and live KaTeX mathematical commentary.
- **Multi-Channel Authentication & Security**:
  - Email/Password authentication (`bcryptjs` password hashing), Email OTP (`nodemailer` SMTP), Phone SMS OTP (`twilio` Verify / SMS), and Password Reset flows.
  - HTTP-only JWT session cookies, CSRF double-submit token protection, rate limiting, and strict multi-tenant ownership checks on all saved scenarios and experiment records.
- **Data Persistence, Analytics & Export**:
  - Mongoose models for `User`, `Scenario`, `SimulationResult`, and `OtpRecord`.
  - One-click CSV and JSON telemetry/waypoint export and 3D PNG snapshot capture.

---

## 2. Project Architecture

```text
robopath-3d/
├── server/
│   ├── db/database.js              # MongoDB Mongoose connection & multi-tenant repository
│   ├── middleware/                 # JWT auth, CSRF validation, and rate-limiting middleware
│   ├── models/                     # Mongoose schemas (User, Scenario, SimulationResult, OtpRecord)
│   ├── routes/                     # Express REST endpoints (/api/auth, /api/scenarios, /api/results, /api/user)
│   ├── services/                   # Nodemailer SMTP & Twilio SMS OTP delivery services
│   ├── app.js                      # Express app, CORS, /api/health, and production SPA static serving
│   └── index.js                    # Server bootstrap & production secret validation
├── src/
│   ├── components/
│   │   ├── common/                 # Deep-Teal Navbar, collapsible AppSidebar, ProtectedRoute, KatexMath
│   │   └── scene/                  # Three.js / R3F 3D Arena (SimulatorScene, RobotMesh, PathMesh, ExploredNodesMesh)
│   ├── context/
│   │   ├── AuthContext.jsx         # Session & authentication state
│   │   └── SimulationContext.jsx   # Unified 2D + 3D grid environment, planner, & playback state
│   ├── engine/
│   │   ├── grid/                   # Occupancy grid, 8 presets, BFS/Dijkstra/A*/Greedy/RRT/RRT* planners, undo/redo
│   │   └── planners/               # Continuous space & kinematic utilities
│   ├── pages/                      # Landing, Signin, Signup, Dashboard, Simulator (3D), Simulator2D, Algorithms, Experiments, Analytics, Scenarios, Profile, Settings
│   ├── services/api.js             # REST client supporting VITE_API_BASE_URL & CSRF headers
│   ├── App.jsx                     # Router & layout orchestration
│   └── index.css                   # Lemon-Cream & Deep-Teal design system
├── tests/                          # Vitest + Supertest suite (113 tests across 6 suites)
├── .env.example                    # Sanitized environment variable template
├── render.yaml                     # Render Blueprint configuration
└── package.json
```

---

## 3. Local Installation & Development

### Prerequisites
- **Node.js** v18.18+ or v20+
- **MongoDB** (Local MongoDB Community Server on `mongodb://127.0.0.1:27017/robopath` or a **MongoDB Atlas** cluster URI)

### Setup Steps
1. **Clone the repository and install dependencies**:
   ```bash
   git clone https://github.com/Zagorden23/robopath-3d.git
   cd robopath-3d
   npm ci
   ```
2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Update `.env` with your `MONGODB_URI`, `JWT_SECRET`, and optional `SMTP_*` / `TWILIO_*` credentials.
3. **Start the full-stack development servers (Express API on `:5000` + Vite HMR on `:5173`)**:
   ```bash
   npm run dev
   ```
4. **Run the automated test suite (113 unit & API integration tests)**:
   ```bash
   npm test
   ```
5. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

---

## 4. MongoDB Atlas Setup

1. Create a cluster in [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a database user with `readWrite` permissions on the `robopath` database.
3. Under **Network Access**, allow your Render service outbound IP addresses.
4. Copy the SRV connection string and set it as `MONGODB_URI` in your Render environment variables:
   ```text
   mongodb+srv://<db_user>:<db_password>@<cluster>.mongodb.net/robopath?retryWrites=true&w=majority
   ```

---

## 5. Deployment on Render

This repository includes a [`render.yaml`](./render.yaml) Blueprint for automated deployment on Render.

### Option A: Unified Full-Stack Web Service (Recommended & Configured in `render.yaml`)
The Express server (`server/app.js`) automatically serves the compiled Vite frontend from `dist/` and routes all non-API paths (`/*`) to `dist/index.html` so client-side routing and browser refreshes work seamlessly alongside `/api/*`.
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`
- **Required Environment Variables on Render**:
  - `NODE_ENV`: `production`
  - `MONGODB_URI`: Your MongoDB Atlas connection string
  - `JWT_SECRET`: Auto-generated 64-byte secret (or custom >= 32 chars)
  - `CLIENT_ORIGIN`: Your Render service URL (e.g. `https://robopath-3d.onrender.com`)

### Option B: Split Static Site + Web Service Deployment
If deploying the React frontend and Express backend as two separate Render services:
1. **Backend Web Service**:
   - Build Command: `npm ci`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`
   - Env Vars: `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN=https://<your-frontend-site>.onrender.com`
2. **Frontend Static Site**:
   - Build Command: `npm ci && npm run build`
   - Publish Directory: `dist`
   - Rewrite Rule: `/*` → `/index.html` (200 Rewrite)
   - Env Var: `VITE_API_BASE_URL=https://<your-backend-service>.onrender.com`
