# 🚔 KSP Crime Intelligence Platform

**Karnataka State Police FIR Platform — KSP Datathon 2026**

A modern, AI-powered crime intelligence dashboard built on **Zoho Catalyst** (serverless Node.js backend) with a **React + Vite** frontend, providing real-time crime data visualization, CCTV recommendations, AI patrol planning, a document-grounded AI knowledge base, an AI chatbot, and criminal network mapping for law enforcement agencies.

**Status**: ✅ Production Ready
**Version**: 1.0.0
**Last Updated**: July 26, 2026

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Setup & Installation](#setup--installation)
7. [Development](#development)
8. [Deployment](#deployment)
9. [API Documentation](#api-documentation)
10. [Features Guide](#features-guide)
11. [Troubleshooting](#troubleshooting)
12. [Contributing](#contributing)

---

## Overview

The **KSP Crime Intelligence Platform** is a comprehensive law enforcement intelligence system designed to:

- **Visualize Crime Data** on an interactive Karnataka map with district overlays
- **Detect Crime Hotspots** using intelligent clustering and priority-based CCTV recommendations
- **Recommend AI-Generated Patrol Plans** with officer counts, patrol timing, and confidence scores per area
- **Analyze Patterns** via an AI-powered chatbot with natural language understanding and tool-calling
- **Answer Questions from Uploaded Documents** (SOPs, circulars, IPC/BNS references) via a grounded AI knowledge base with citations
- **Map Criminal Networks** through relationship visualization and graph analysis
- **Track Case Status** with real-time KPI dashboards (total cases, under investigation, chargesheeted, closed)
- **Support Multiple Languages** with native Kannada support alongside English, including voice input and output
- **Authenticate Officers** with a secure, role-based login screen
- **Export Reports** in PDF format for police command centers

Built for the **KSP Datathon 2026** in partnership with Karnataka State Police, leveraging serverless architecture for scalability and cost-effectiveness.

---

## Key Features

### 1. **Officer Authentication** 🔐
- Secure login screen (`LoginPage.jsx`) gates the entire dashboard
- Passwords hashed with PBKDF2 (100,000 iterations) and a per-user salt — never stored in plain text
- Officer accounts stored in a Catalyst `Officers` table (`Username`, `Role`, `FullName`, `Status`)
- Session persists across page refreshes via `localStorage`; logout available from the top navigation

### 2. **KPI Dashboard** 📊
- Real-time statistics cards showing:
  - Total Crime Cases
  - Cases Under Investigation
  - Chargesheeted Cases
  - Closed Cases
- Color-coded status indicators

### 3. **Crime Intelligence Map** 🗺️
- Interactive Leaflet map of Karnataka state
- Marker clustering for performance
- District boundary overlays with color highlighting
- Crime case markers color-coded by status:
  - 🟡 Under Investigation (#D9A441)
  - 🔵 Chargesheeted (#4A7FB5)
  - 🟢 Closed (#5FA88C)
- Pulsing hotspot zone overlay around the centroid of cases in a selected district, sized to actually enclose the farthest case (not a fixed radius)
- Zoom controls, pan, and case popup details on marker click
- A dynamic legend that only shows the layers currently toggled on

### 4. **AI-Powered Chatbot** 🤖
- Natural language query processing via a Catalyst serverless function with tool-calling
- Tools available to the model: crime stats lookup, district comparison, hotspot detection, CCTV recommendations, and risk scoring — all backed by real ZCQL queries, never fabricated
- Can dynamically drive the dashboard: filter by district, crime type, or status; show hotspots; show CCTV layers
- Pre-built sample questions in English and Kannada
- Confidence score with every AI response
- Chat history with a dedicated history drawer
- Voice input (Web Speech API) and voice output (browser speech synthesis) in both English and Kannada
- PDF export of the full AI conversation history (rendered via html2canvas + jsPDF so Kannada text exports correctly)

### 5. **AI Knowledge Base (RAG)** 📚
- Upload SOPs, circulars, IPC/BNS references, and departmental policies as PDF, DOCX, or TXT
- Real per-page text extraction for PDFs (via pdf.js) and paragraph-based section splitting for DOCX/TXT
- BM25 lexical retrieval over document chunks — no external embeddings API required
- Answers are grounded strictly in the uploaded documents, with real citations (document name + page/section)
- Explicitly reports when no relevant information is found rather than guessing
- Supports both English and Kannada queries, with voice input and a language-matching answer

### 6. **AI Patrol Recommendation** 🚓
- Generates a data-driven patrol plan per area: recommended officer count, suggested patrol time window, priority tier, and a plain-language explanation
- Cross-references nearby existing CCTV coverage and recent crime counts per area
- Confidence score per recommendation
- Filterable by district; regenerate on demand

### 7. **CCTV Recommendation Engine** 📹
- Priority-based hotspot detection for CCTV installation planning
- Risk score calculation (0–100) based on crime case density, high-severity incident count, and existing CCTV coverage gaps
- Two-tier prioritization:
  - **High Priority**: #A6231F
  - **Low Priority**: #4A7FB5
- Displays recommended camera count, expected coverage improvement %, and the reasoning behind each recommendation
- Clustered marker view; configurable recommendation limit

### 8. **Criminal Network Graph** 🔗
- Force-directed graph visualization (react-force-graph-2d) of repeat offenders and their linked cases
- Risk-tier node coloring: High (#D94F4F), Medium (#E08A3E), Low (#5FA88C)
- Filter by district, crime type, year, and free-text search; option to hide isolated nodes
- Click a node to see full case history, crime-type breakdown, and an on-demand AI-generated summary
- Resizable filter and detail panels

### 9. **District Boundary Overlays** 🏞️
- GeoJSON-based district boundary visualization
- Auto-fits to the selected district
- Gold highlight for the selected district, subtle blue outline for the rest

### 10. **Analytics Dashboard** 📈
- Crime Trend chart (last 12 months)
- Top Crime Hotspots (top 5 stations by case count)
- Case Resolution Rate (resolved vs. pending)
- Auto-generated narrative AI insight summarizing the current filtered view

### 11. **Filtering & Controls** 🎛️
- District, Status, and Crime Type filters
- CCTV layer toggles (recommendations, active cameras) with adjustable recommendation limit
- Real-time map and analytics updates on every filter change

### 12. **Multi-Language Support** 🌐
- English and native Kannada (ಕನ್ನಡ) script support throughout the UI
- Global language toggle in the top navigation
- AI chatbot and Knowledge Base both understand and respond in Kannada, regardless of which script the question was typed in
- Voice input and output language-matched to the toggle

---

## Technology Stack

### Frontend
| Component | Technology |
|-----------|-----------|
| **Framework** | React 18 |
| **Build Tool** | Vite |
| **Maps** | Leaflet + React-Leaflet |
| **Clustering** | Leaflet.MarkerCluster |
| **Charts** | Recharts |
| **Graph** | react-force-graph-2d |
| **Icons** | Lucide React |
| **PDF Export** | jsPDF + html2canvas |
| **Styling** | Custom CSS with design tokens |
| **Speech** | Web Speech API (native browser) |

### Backend
| Component | Technology |
|-----------|-----------|
| **Platform** | Zoho Catalyst (Serverless) |
| **Runtime** | Node.js |
| **Database** | Zoho Catalyst Data Store, queried via ZCQL — `CaseMaster`, `District`, `Unit`, `CCTVLocation`, `KBDocument`, `KBChunk`, `Officers`, plus lookup tables (`CaseStatusMaster`, `GravityOffence`, `CaseCategory`) |
| **AI Model** | GLM model served via Catalyst QuickML, used for the chatbot and the Knowledge Base's grounded answers |
| **Document Parsing** | pdf.js (PDF), mammoth (DOCX) |

### Infrastructure
| Component | Details |
|-----------|---------|
| **Deployment** | Zoho Catalyst development environment |
| **Live URL** | `https://ksp-fir-platform-60073928681.development.catalystserverless.in` |
| **Version Control** | Git / GitHub |

---

## Project Structure

```
ksp-fir-platform/
├── public/
│   └── vite.svg
│
├── src/
│   ├── App.jsx                  # Main application component + all sub-components
│   │   (KpiCard, ClusterLayer, DistrictBoundaries, HotspotZoneLayer, CctvLayer,
│   │    AnalyticsDrawer, MapLegend, PatrolRecommendationPanel, NetworkGraphPanel,
│   │    KnowledgeBasePanel)
│   ├── App.css                  # Styling
│   ├── LoginPage.jsx             # Authentication screen
│   ├── index.css                # Design tokens & global styles
│   ├── main.jsx                  # React entry point
│   ├── translations.js           # Kannada/English UI localization
│   │
│   ├── utils/
│   │   └── districtNameMap.js    # GeoJSON ↔ database name mapping
│   │
│   └── assets/
│       └── karnataka_districts.json  # GeoJSON district boundaries
│
├── functions/                    # Zoho Catalyst serverless functions
│   ├── dashboard-function/
│   ├── map-data-function/
│   ├── ask-ai-function/
│   ├── network-graph-function/
│   ├── cctv-recommend-function/
│   ├── patrol-recommend-function/
│   ├── kb-function/
│   ├── auth-function/
│   ├── tts-function/
│   ├── cleanup-function/
│   └── cleanup-job-function/
│
├── index.html
├── vite.config.js
├── catalyst.json                 # Catalyst project/function registration
├── package.json
├── package-lock.json
└── README.md
```

### Backend Functions (Zoho Catalyst)

**Called directly from the frontend:**

1. **`dashboard-function`** — KPI metrics
   `GET /server/dashboard-function/` → `{ totalCases, underInvestigation, chargesheeted, closed, chargesheetRate }`

2. **`map-data-function`** — Crime cases and districts
   `GET /server/map-data-function/?type=districts|cases&district=&status=&crimeType=`

3. **`ask-ai-function`** — AI chatbot with tool-calling
   `POST /server/ask-ai-function/` with `{ question }` → `{ insight, reasoning[], recommendation, confidence, dashboardAction }`

4. **`network-graph-function`** — Criminal network data and AI offender summaries
   `GET /server/network-graph-function/`
   `GET /server/network-graph-function/?offenderId=&mode=summary`

5. **`cctv-recommend-function`** — CCTV recommendations and active cameras
   `GET /server/cctv-recommend-function/?limit=20`
   `GET /server/cctv-recommend-function/?mode=active`

6. **`patrol-recommend-function`** — AI patrol plan generation
   `GET /server/patrol-recommend-function/?district=&limit=30`

7. **`kb-function`** — AI Knowledge Base (RAG)
   `POST /server/kb-function/?mode=upload` — parse, chunk, and index a document
   `GET /server/kb-function/?mode=list` — list indexed documents
   `POST /server/kb-function/?mode=delete` — remove a document and its chunks
   `POST /server/kb-function/?mode=query` — BM25 retrieval + grounded LLM answer with citations

8. **`auth-function`** — Officer login (called from `LoginPage.jsx`)
   `POST /server/auth-function/` with `{ action: "login", username, password }`

**Deployed but not currently called by the frontend:**

- **`tts-function`** — backend text-to-speech via Google's translate endpoint (built to guarantee Kannada audio regardless of the browser's installed voices). The current frontend uses the browser's native Web Speech API for voice output instead; this function remains available for a future re-integration.
- **`cleanup-function`** / **`cleanup-job-function`** — scheduled data maintenance, not user-triggered.

---

## Prerequisites

### Required
- **Node.js**: v18 or higher
- **npm**: v8 or higher
- **Git**
- **Zoho Catalyst Account**: for backend deployment (`npm install -g zcatalyst-cli`)
- **Modern Browser**: Chrome or Edge recommended (best Web Speech API support, including Kannada where available)

### Optional
- **Microphone**: for voice input
- **Speakers**: for voice output

---

## Setup & Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/<your-username>/ksp-fir-platform.git
cd ksp-fir-platform
```

### Step 2: Install Frontend Dependencies

```bash
npm install
```

### Step 3: Configure the backend base URL

The frontend points to a deployed Catalyst backend via a constant near the top of `src/App.jsx`:

```javascript
const FUNCTIONS_BASE = 'https://ksp-fir-platform-60073928681.development.catalystserverless.in/server';
```

If you deploy your own Catalyst project, update this to your own project's function base URL.

### Step 4: Start the Development Server

```bash
npm run dev
```

The app opens at `http://localhost:5173/` (or the port Vite reports).

### Step 5: Build for Production

```bash
npm run build
```

Output goes to the `dist/` directory.

---

## Development

### Running Development Server

```bash
npm run dev
```

Hot-reload enabled — changes to `.jsx`/`.css`/`.js` auto-refresh.

### Linting

```bash
npm run lint
```

### Design Tokens

Defined in `src/index.css` and used throughout `App.css` — colors, spacing, radii, shadows, and z-index scales. Reuse these tokens (`var(--accent)`, `var(--spacing-lg)`, etc.) rather than hardcoding new values when extending the UI.

---

## Deployment

### Zoho Catalyst (this project's deployment target)

**Prerequisites**: a Zoho account with Catalyst access, and the Catalyst CLI installed.

```bash
catalyst login
```

**Deploy the frontend (Slate) and all functions:**
```bash
catalyst deploy
```

**Deploy only functions** (faster iteration when only backend code changed):
```bash
catalyst deploy --only functions
```

Which functions get deployed is controlled by the `targets` array in `catalyst.json` at the project root — every function folder under `functions/` that should be live must be listed there.

**Verify:**
```bash
catalyst open
```

> **Note for this submission**: per the Datathon rules, the deployed solution link must be a **Zoho Catalyst** deployment — this project is built and configured specifically for that target.

---

## API Documentation

### Base URL
```
https://ksp-fir-platform-60073928681.development.catalystserverless.in/server
```

### AI Chatbot Query
**`POST /ask-ai-function/`**

Request:
```json
{ "question": "Show theft cases in Bengaluru Urban" }
```

Response:
```json
{
  "insight": "Bengaluru Urban has 342 theft cases, with 156 currently under investigation.",
  "reasoning": ["Total matching cases: 342.", "156 are still under investigation."],
  "recommendation": "Consider increasing CCTV coverage in the highest-density areas.",
  "confidence": 85,
  "dashboardAction": { "type": "filterDistrict", "district": "Bengaluru Urban" }
}
```

`dashboardAction.type` can be `filterDistrict`, `filterCrimeType`, `filterStatus`, `showHotspots`, `showCCTV`, or `none`.

### Knowledge Base Query
**`POST /kb-function/?mode=query`**

Request:
```json
{ "question": "What is the procedure for cyber fraud investigation?", "preferredLang": "en" }
```

Response:
```json
{
  "answer": "...",
  "groundedInKB": true,
  "citations": [{ "documentName": "cyber_fraud_sop.pdf", "source": "Page 1" }]
}
```

### Patrol Recommendations
**`GET /patrol-recommend-function/?district=<rowId>&limit=30`**

Response includes `totalHotspots`, `highPriorityCount`, `lowPriorityCount`, and a `recommendations[]` array with per-area officer counts, patrol timing, nearby CCTV context, and an explanation.

### KPI Dashboard
**`GET /dashboard-function/`** → `{ totalCases, underInvestigation, chargesheeted, closed, chargesheetRate }`

### Crime Cases & Districts
**`GET /map-data-function/?type=cases|districts&district=&status=&crimeType=`**

### CCTV Recommendations & Active Cameras
**`GET /cctv-recommend-function/?limit=20`** and **`?mode=active`**

### Criminal Network
**`GET /network-graph-function/`** and **`?offenderId=&mode=summary`**

### Officer Login
**`POST /auth-function/`** with `{ "action": "login", "username": "...", "password": "..." }`

---

## Features Guide

### Dashboard Tab
- Select District / Status / Crime Type filters — map, KPIs, and analytics all update live
- Toggle CCTV recommendation and active-camera layers; adjust the recommendation limit
- Click "Analytics" to expand the trend/hotspot/resolution charts

### AI Chatbot (side panel, any tab)
- Type a question or click a suggested prompt
- Click the microphone to ask by voice (English or Kannada, based on the language toggle)
- Click 🔊 to hear the answer read aloud
- Open History to revisit past questions or export the full conversation as a PDF

### Knowledge Base Tab
- Upload SOPs/circulars/manuals as PDF, DOCX, or TXT
- Ask questions by text or voice — answers cite the specific document and page/section they came from
- If nothing relevant is uploaded, the assistant says so rather than guessing

### AI Patrol Recommendation Tab
- Filter by district and click "Generate Patrol Plan"
- Each recommendation card shows officer count, suggested patrol window, nearby CCTV context, recent crime count, and a confidence score

### Criminal Network Tab
- Filter by district, crime type, year, or offender name
- Click a node to see linked cases and generate an AI summary of that offender's pattern

---

## Troubleshooting

### Map not loading
- Check the browser console (F12) for errors
- Hard refresh (Ctrl+Shift+R) to rule out stale cached assets

### AI chatbot / Knowledge Base / Patrol panel returns an error or generic fallback
- Confirm the relevant Catalyst function is deployed (`catalyst deploy --only functions`)
- Check that function's logs in the Catalyst console for the actual error
- Verify `FUNCTIONS_BASE` in `App.jsx` points to your deployed project

### Kannada text displays as boxes
- Use a recent version of Chrome or Edge
- For PDF export specifically, the app loads the Noto Sans Kannada web font before rendering — a slow/blocked network connection to Google Fonts can affect this

### Voice input or output doesn't work for Kannada
- This is a genuine platform limitation: browser support for Kannada speech recognition/synthesis varies by OS and browser. Chrome on Android tends to have the best coverage. The app detects a missing Kannada voice and shows a clear message rather than silently failing in the wrong language.

### Login page appears blank
- Confirm `LoginPage.jsx` exists in `src/` and is imported in `App.jsx`
- Clear `localStorage` (`localStorage.clear()` in the console) if a stale session object is causing issues

---

## Contributing

### Code Style
- 2-space indentation
- Follow the existing ESLint configuration
- Reuse existing design tokens rather than introducing new hardcoded values

### Making Changes

```bash
git checkout -b feature/your-feature-name
# make changes
npm run lint
npm run dev   # test locally
git add .
git commit -m "feat: describe your change"
git push
```

---

## Support & Resources

- **Catalyst Docs**: https://catalyst.zoho.com/help/
- **React Docs**: https://react.dev
- **Leaflet Docs**: https://leafletjs.com
- **Vite Docs**: https://vitejs.dev

---

## License

MIT License

---

## Changelog

### Version 1.0.0 (July 26, 2026)
- Initial release for KSP Datathon 2026
- KPI dashboard, interactive crime map with clustering and hotspot zones
- AI chatbot with tool-calling, bilingual (English/Kannada), voice input/output, PDF export
- AI Knowledge Base (RAG) with document upload, BM25 retrieval, and grounded citations
- AI Patrol Recommendation engine
- CCTV recommendation engine (priority-based)
- Criminal network graph visualization
- Officer authentication with role-based accounts
- Full Kannada + English multi-language support throughout

---

## Quick Links

- 🚀 **Live Platform**: https://ksp-fir-platform-60073928681.development.catalystserverless.in
- 📦 **GitHub**: `<add your repository URL here>`

---

**Made for Karnataka State Police | KSP Datathon 2026**
