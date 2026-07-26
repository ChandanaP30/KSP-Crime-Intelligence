# 🚔 KSP Crime Intelligence Platform

**Karnataka State Police FIR Platform — KSP Datathon 2026**

A modern, AI-powered crime intelligence dashboard built on **Zoho Catalyst** (serverless Node.js backend) with a **React + Vite** frontend, providing real-time crime data visualization, CCTV recommendations, AI chatbot analysis, and criminal network mapping for law enforcement agencies.

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
- **Analyze Patterns** via AI-powered chatbot with natural language understanding
- **Map Criminal Networks** through relationship visualization and graph analysis
- **Track Case Status** with real-time KPI dashboards (total cases, under investigation, chargesheeted, closed)
- **Support Multiple Languages** with native Kannada support alongside English
- **Export Reports** in PDF format for police command centers

Built for the **KSP Datathon 2026** in partnership with Karnataka State Police, leveraging serverless architecture for scalability and cost-effectiveness.

---

## Key Features

### 1. **KPI Dashboard** 📊
- Real-time statistics cards showing:
  - Total Crime Cases
  - Cases Under Investigation
  - Chargesheeted Cases
  - Closed Cases
- Live data refresh every 5 seconds
- Color-coded status indicators

### 2. **Crime Intelligence Map** 🗺️
- Interactive Leaflet map of Karnataka state
- Marker clustering for performance (max 60px cluster radius)
- District boundary overlays with color highlighting
- Crime case markers color-coded by status:
  - 🟡 Under Investigation (Gold: #D9A441)
  - 🔵 Chargesheeted (Blue: #4A7FB5)
  - 🟢 Closed (Green: #5FA88C)
- Zoom controls and pan functionality
- Case popup details on marker click

### 3. **AI-Powered Chatbot** 🤖
- Natural language query processing via Catalyst serverless functions
- Tool-calling capability to filter dashboard data dynamically:
  - Filter by district name
  - Filter by crime type
  - Filter by case status
  - Show CCTV recommendations
  - Show active cameras
  - Show crime hotspots
- 12 pre-defined sample questions in English + Kannada
- Confidence score for each AI response
- Chat history with persistence (localStorage)
- Voice input support (uses Web Speech API)
- Voice output (text-to-speech for responses)
- PDF export of conversation history

### 4. **CCTV Recommendation Engine** 📹
- Intelligent priority-based hotspot detection
- Risk score calculation (0-100) based on:
  - Crime case density
  - High-severity incident count
  - Existing CCTV coverage gaps
- Two-tier prioritization:
  - **High Priority** (risk score ≥ 80): Red (#A6231F)
  - **Low Priority** (risk score < 80): Blue (#4A7FB5)
- Displays:
  - Recommended camera count
  - Expected coverage improvement percentage
  - Reason for recommendation
- Clustered marker view with spiderify on max zoom
- Configurable recommendation limit (default 20)

### 5. **Criminal Network Graph** 🔗
- Force-directed graph visualization using react-force-graph-2d
- Node types:
  - **Case nodes** (blue): FIR records
  - **Risk nodes** (color-coded): High (#D94F4F), Medium (#E08A3E), Low (#5FA88C)
- Interactive pan, zoom, and drag functionality
- Relationship links between connected entities
- Hover details on nodes and edges
- Dynamic node coloring by risk level

### 6. **Hotspot Zone Visualization** 🔴
- Pulsing radial zones showing crime concentration
- Animated rings with distance-based sizing:
  - Outer ring (largest radius, minimal opacity)
  - Mid ring (70% radius)
  - Inner rings (45%, 22% radius)
- Intensity-based coloring based on case volume
- Only displays when district is selected
- Real-time updates as filters change
- Accessible even without explicit selection via AI tool-calling

### 7. **District Boundary Overlays** 🏞️
- GeoJSON-based district boundary visualization
- Auto-fit to selected district
- Color highlighting:
  - Selected: Gold (#D9A441, 15% opacity)
  - Unselected: Blue (#4A7FB5, 2% opacity)
- Enhanced border weight for selected district

### 8. **Analytics Dashboard** 📈
- **Crime Trend Chart**: Last 12 months bar chart
- **Top Crime Hotspots**: Top 5 stations by case count
- **Case Resolution Rate**: Donut chart showing resolved vs. pending
- **AI Crime Insights**: Auto-generated narrative insights about:
  - Most frequent crime type
  - Station with highest workload
  - Resolution rate percentage
  - Pending case count

### 9. **Filtering & Controls** 🎛️
- **District Filter**: Dropdown with all Karnataka districts
- **Status Filter**: Under Investigation, Chargesheeted, Closed
- **Crime Type Filter**: Dynamic filtering by FIR crime type
- **CCTV Toggles**: Show/hide recommendations, active cameras, hotspot zones
- **Recommendation Limit**: Adjust how many CCTV recommendations to display (10-50)
- Real-time map and analytics updates on filter change

### 10. **Multi-Language Support** 🌐
- **English**: Full UI and data localization
- **Kannada**: Native script support (ಕನ್ನಡ)
- Language toggle in top navigation
- AI responses in selected language
- Voice input/output language matching
- Sample questions in both languages

---

## Technology Stack

### Frontend
| Component | Technology |
|-----------|-----------|
| **Framework** | React 18.3.1 |
| **Build Tool** | Vite 5.3.1 |
| **Maps** | Leaflet 1.9.4 + React-Leaflet 4.2.1 |
| **Clustering** | Leaflet.MarkerCluster 1.5.3 |
| **Charts** | Recharts 3.10.0 |
| **Graph** | react-force-graph-2d 1.29.1 |
| **Icons** | Lucide React 1.26.0 |
| **PDF Export** | jsPDF 4.2.1 + html2canvas 1.4.1 |
| **Styling** | CSS3 with custom design tokens |
| **Speech API** | Web Speech API (native browser) |

### Backend
| Component | Technology |
|-----------|-----------|
| **Platform** | Zoho Catalyst (Serverless) |
| **Runtime** | Node.js |
| **API Endpoints** | 5 serverless functions |
| **Database** | Zoho Creator (CRM-like backend) |
| **Data Source** | FIR records from KSP database |

### Infrastructure
| Component | Details |
|-----------|---------|
| **Deployment** | Zoho Catalyst development environment |
| **Live URL** | `https://ksp-fir-platform-60073928681.development.catalystserverless.in` |
| **Version Control** | Git |

---

## Project Structure

```
ksp-fir-platform/
├── public/
│   └── vite.svg
│
├── src/
│   ├── components/               # React components (inline in App.jsx)
│   │   ├── KpiCard
│   │   ├── ClusterLayer
│   │   ├── DistrictBoundaries
│   │   ├── HotspotZoneLayer
│   │   ├── CctvLayer
│   │   ├── AnalyticsDrawer
│   │   ├── MapLegend
│   │   ├── PatrolRecommendationPanel
│   │   ├── NetworkGraphPanel
│   │   └── KnowledgeBasePanel
│   │
│   ├── App.jsx                  # Main application component (1,800+ lines)
│   ├── App.css                  # Premium styling (1,723 lines)
│   ├── LoginPage.jsx            # Authentication component
│   ├── index.css                # Design tokens & global styles
│   ├── main.jsx                 # React entry point
│   ├── translations.js          # Kannada/English localization
│   │
│   ├── utils/
│   │   └── districtNameMap.js   # GeoJSON ↔ Database name mapping
│   │
│   └── assets/
│       ├── karnataka_districts.json  # GeoJSON district boundaries
│       └── react.svg
│
├── .catalyst/
│   └── slate-config.toml        # Zoho Catalyst configuration
│
├── .kiro/
│   └── specs/                   # Spec documentation
│       └── crime-dashboard-redesign/
│           ├── design.md
│           ├── tasks.md
│           └── .config.kiro
│
├── data-exports/                # Sample CSV exports (optional)
│   ├── *_seed.csv              # Sample data files
│   └── ...
│
├── index.html                   # HTML entry point
├── vite.config.js              # Vite configuration
├── cli-config.json             # Catalyst CLI config
├── package.json                # Dependencies & scripts
├── package-lock.json           # Locked versions
├── .eslintrc.cjs               # ESLint configuration
├── .gitignore
└── README.md                    # This file
```

### Backend Functions (Zoho Catalyst)

The backend consists of 5 serverless Node.js functions deployed on Zoho Catalyst:

1. **`ask-ai-function`** - AI chatbot with tool-calling
   - Endpoint: `POST /server/ask-ai-function/`
   - Processes natural language questions
   - Returns: `{ insight, reasoning[], recommendation, confidence, dashboardAction }`

2. **`dashboard-function`** - KPI metrics
   - Endpoint: `GET /server/dashboard-function/`
   - Returns: `{ total, underInvestigation, chargesheeted, closed }`

3. **`map-data-function`** - Crime cases and districts
   - Endpoint: `GET /server/map-data-function/?type=districts|cases`
   - Query params: `?district=X&status=Y&crimeType=Z`
   - Returns: `{ cases: [...], districts: [...] }`

4. **`cctv-recommend-function`** - CCTV recommendations & active cameras
   - Endpoint: `GET /server/cctv-recommend-function/?limit=20&mode=active`
   - Returns: `{ topRecommendations: [...], cameras: [...] }`

5. **`network-graph-function`** - Criminal network data
   - Endpoint: `GET /server/network-graph-function/?limit=100`
   - Returns: `{ nodes: [...], links: [...] }`

---

## Prerequisites

### Required
- **Node.js**: v16.0.0 or higher
- **npm**: v8.0.0 or higher (or yarn v3.0.0+)
- **Git**: Latest version
- **Zoho Catalyst Account**: For backend deployment
- **Modern Browser**: Chrome, Firefox, Safari, or Edge (2023+)

### Optional
- **Zoho Creator Account**: For database administration
- **Microphone**: For voice input feature
- **Speakers/Headphones**: For voice output feature

---

## Setup & Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/ksp-fir-platform.git
cd ksp-fir-platform
```

### Step 2: Install Frontend Dependencies

```bash
npm install
```

This installs:
- React 18.3.1 + React-DOM
- Leaflet + React-Leaflet
- Recharts for analytics
- Vite build tool
- ESLint + plugins

### Step 3: Environment Setup

The frontend connects to Catalyst serverless functions. The base URL is already configured:

```javascript
const FUNCTIONS_BASE = 'https://ksp-fir-platform-60073928681.development.catalystserverless.in/server';
```

**Note**: For local development, you can override this in `.env`:

```env
# .env (optional)
VITE_CATALYST_BASE=https://your-catalyst-url/server
```

Then update `App.jsx` line 20:

```javascript
const FUNCTIONS_BASE = import.meta.env.VITE_CATALYST_BASE || 'https://...';
```

### Step 4: Start Development Server

```bash
npm run dev
```

Output:
```
  VITE v5.3.1  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

The app opens at `http://localhost:5173/`

### Step 5: Build for Production

```bash
npm run build
```

Output files: `dist/` directory (ready for deployment)

---

## Development

### Running Development Server

```bash
npm run dev
```

Hot-reload enabled. Changes to `.jsx`, `.css`, or `.js` files auto-refresh.

### Linting

```bash
npm run lint
```

Check ESLint rules (React, React Hooks, import order)

### Code Style

Follow ESLint configuration (`.eslintrc.cjs`):
- React: v18 rules with hooks support
- 2-space indentation
- Unused variables must be removed

### Building Assets

```bash
npm run build
npm run preview
```

Preview the production build locally at `http://localhost:4173/`

### Modifying Components

All React components are in `src/App.jsx` (main file, 1,800+ lines).

To add a new feature:

1. Create a component function in `App.jsx`
2. Add styling to `src/App.css`
3. Import any needed libraries from `src/main.jsx`
4. Use design tokens from `src/index.css`

**Design Tokens Available**:
```css
/* Colors */
--bg: #0F1527
--surface: #111D2E
--surface-2: #1A2438
--surface-3: #232D42
--accent: #5B8DEF
--status-investigation: #D9A441
--status-chargesheeted: #4A7FB5
--status-closed: #5FA88C
--success: #10B981
--alert: #EF4444
--warning: #F59E0B

/* Spacing */
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 12px
--spacing-lg: 16px
--spacing-xl: 24px

/* Shadows */
--shadow-sm: 0 2px 8px rgba(0,0,0,0.1)
--shadow-md: 0 4px 16px rgba(0,0,0,0.15)
--shadow-lg: 0 8px 32px rgba(0,0,0,0.3)

/* Z-Index */
--z-sticky: 40
--z-modal: 50
--z-dropdown: 30
```

---

## Deployment

### Option 1: Zoho Catalyst (Recommended)

The platform is built specifically for Zoho Catalyst deployment.

**Prerequisites**:
- Zoho account with Catalyst access
- Catalyst CLI installed: `npm install -g zcli`

**Steps**:

1. **Login to Catalyst**:
   ```bash
   catalyst login
   ```

2. **Create Catalyst Project** (if not already created):
   ```bash
   catalyst init
   ```
   - Choose "React + Vite" template
   - Choose "Node.js" for functions

3. **Deploy Frontend**:
   ```bash
   catalyst deploy
   ```
   - Automatically builds with `npm run build`
   - Deploys `dist/` to Catalyst

4. **Deploy Backend Functions** (separately via Catalyst console):
   - Navigate to Functions in Catalyst console
   - Deploy the 5 serverless functions (ask-ai, dashboard, map-data, cctv-recommend, network-graph)
   - Each function handles its endpoint

5. **Verify Deployment**:
   ```bash
   catalyst open
   ```
   - Opens your live deployment in browser
   - Live URL format: `https://app-{project-id}.catalystserverless.in`

### Option 2: Traditional Hosting (Vite Build)

If not using Catalyst:

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Deploy `dist/` folder** to:
   - **Netlify**: `netlify deploy --dir=dist`
   - **Vercel**: `vercel deploy`
   - **GitHub Pages**: Push `dist/` to `gh-pages` branch
   - **AWS S3 + CloudFront**: Upload `dist/` to S3

3. **Configure backend URL**:
   - Update `FUNCTIONS_BASE` in `src/App.jsx` to point to your serverless backend
   - Must support CORS for cross-origin requests

### Option 3: Docker (Local/Cloud)

**Dockerfile** (create if needed):
```dockerfile
FROM node:16-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:16-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

**Build and run**:
```bash
docker build -t ksp-platform .
docker run -p 3000:3000 ksp-platform
```

---

## API Documentation

### Base URL
```
https://ksp-fir-platform-60073928681.development.catalystserverless.in/server
```

### 1. AI Chatbot Query

**Endpoint**: `POST /ask-ai-function/`

**Request**:
```json
{
  "question": "Show theft cases in Bengaluru"
}
```

**Response**:
```json
{
  "insight": "Bengaluru Urban has 342 theft cases, with 156 currently under investigation...",
  "reasoning": [
    "Queried FIR database for theft + Bengaluru filter",
    "Aggregated by crime type and status",
    "Generated summary with insights"
  ],
  "recommendation": "Consider increasing CCTV coverage in downtown areas.",
  "confidence": 0.92,
  "dashboardAction": {
    "type": "filterDistrict",
    "district": "Bengaluru Urban"
  }
}
```

**Dashboard Actions**:
- `{ type: "filterDistrict", district: "Bengaluru" }`
- `{ type: "filterCrimeType", crimeType: "Theft" }`
- `{ type: "filterStatus", status: "Under Investigation" }`
- `{ type: "showHotspots" }`
- `{ type: "showCCTV" }`
- `{ type: "none" }` (no action needed)

---

### 2. KPI Dashboard

**Endpoint**: `GET /dashboard-function/`

**Response**:
```json
{
  "total": 15248,
  "underInvestigation": 5432,
  "chargesheeted": 7891,
  "closed": 1925
}
```

---

### 3. Crime Cases & Districts

**Endpoint**: `GET /map-data-function/`

**Query Parameters**:
- `type=cases|districts` (required)
- `district=<rowId>` (optional filter)
- `status=Under Investigation|Chargesheeted|Closed` (optional)
- `crimeType=Theft|Assault|...` (optional)

**Response (cases)**:
```json
{
  "cases": [
    {
      "firNumber": "FIR/2026/0001",
      "crimeType": "Theft",
      "status": "Under Investigation",
      "dateOfFIR": "2026-07-01",
      "latitude": 12.9716,
      "longitude": 77.5946,
      "districtId": "dist_001",
      "unitName": "Bengaluru Urban Police Station",
      "severity": "high"
    }
  ]
}
```

**Response (districts)**:
```json
{
  "districts": [
    {
      "rowId": "dist_001",
      "districtName": "Bengaluru Urban",
      "lat": 13.0827,
      "lng": 77.6063
    }
  ]
}
```

---

### 4. CCTV Recommendations & Active Cameras

**Endpoint**: `GET /cctv-recommend-function/`

**Query Parameters**:
- `limit=20` (1-50, default 20)
- `mode=active` (optional, to fetch active cameras)

**Response (recommendations)**:
```json
{
  "topRecommendations": [
    {
      "centroidLat": 12.9716,
      "centroidLon": 77.5946,
      "priority": "High",
      "riskScore": 87,
      "caseCount": 245,
      "highSeverityCount": 18,
      "cameraCount": 3,
      "recommendedCameraCount": 5,
      "expectedCoverageImprovementPct": 34,
      "reason": "High crime density with limited camera coverage"
    }
  ]
}
```

**Response (active cameras)**:
```json
{
  "cameras": [
    {
      "cameraName": "BUP-001",
      "latitude": 12.9716,
      "longitude": 77.5946,
      "status": "Active"
    }
  ]
}
```

---

### 5. Criminal Network Graph

**Endpoint**: `GET /network-graph-function/`

**Query Parameters**:
- `limit=100` (max nodes to return)

**Response**:
```json
{
  "nodes": [
    { "id": "case_001", "type": "case", "label": "FIR/2026/0001", "color": "#4A7FB5" },
    { "id": "risk_001", "type": "risk", "riskScore": 85, "label": "High", "color": "#D94F4F" }
  ],
  "links": [
    { "source": "case_001", "target": "risk_001", "strength": 0.8 }
  ]
}
```

---

## Features Guide

### Dashboard Tab

1. **Select Filters**:
   - Choose district, status, crime type
   - Map updates in real-time
   - KPIs recompute automatically

2. **Explore Map**:
   - Click markers for FIR details
   - Click legend items to toggle layers
   - Zoom with mouse wheel or buttons
   - View district boundaries

3. **View Analytics**:
   - Click "Analytics" toggle
   - See 12-month crime trends
   - Compare top hotspots
   - View resolution rates

### AI Chatbot

1. **Ask Questions**:
   - Type in chat input
   - Press Enter or click Send
   - Wait for AI response

2. **Sample Questions**:
   - Click any pre-written question
   - Dashboard auto-filters to match

3. **Voice Input** (Chrome/Edge):
   - Click microphone icon
   - Speak your question
   - AI transcribes and responds

4. **Export History**:
   - Click "Export as PDF"
   - Saves conversation to file

### Criminal Network Tab

1. **View Relationships**:
   - Explore connected FIRs
   - Drag nodes to rearrange
   - Hover for details

2. **Filter by Risk**:
   - Red nodes = High risk
   - Orange nodes = Medium risk
   - Green nodes = Low risk

### Knowledge Base Tab

1. **Search Documents**:
   - Type keywords
   - View full-text results

2. **Download Files**:
   - View file list
   - Click to download

---

## Troubleshooting

### Common Issues

#### Map not loading

**Symptom**: White/blank map area  
**Solutions**:
1. Check browser console (F12) for errors
2. Verify Leaflet CSS loaded: `leaflet/dist/leaflet.css`
3. Clear browser cache: Ctrl+Shift+Delete
4. Check internet connection

#### AI chatbot returns "Something went wrong"

**Symptom**: Error message from chatbot  
**Solutions**:
1. Verify Catalyst functions are deployed
2. Check network tab (F12) for failed requests
3. Verify `FUNCTIONS_BASE` URL is correct
4. Check function logs in Catalyst console
5. Test endpoint manually: `curl https://...api/ask-ai-function/`

#### No CCTV recommendations showing

**Symptom**: Empty CCTV layer  
**Solutions**:
1. Check toggle is enabled ("Show Recommendations")
2. Verify `cctv-recommend-function` is deployed
3. Increase "Recommendation Limit" slider
4. Select a district to limit results
5. Check network requests in DevTools

#### Kannada text displays as boxes

**Symptom**: ಕನ್ನಡ shows as ??? or squares  
**Solutions**:
1. Install Kannada font (e.g., Noto Sans Kannada)
2. Browser likely doesn't support Kannada: use Chrome
3. Check `src/translations.js` has correct Unicode characters
4. Verify font-family in `src/index.css` includes Kannada

#### Voice input not working

**Symptom**: Clicking mic button does nothing  
**Solutions**:
1. Use Chrome or Edge (Firefox/Safari have limited support)
2. Check browser permissions: Settings → Privacy → Microphone → Allow
3. Verify microphone hardware works
4. Try different language in language toggle
5. Check browser console for `SpeechRecognition` errors

#### Slow performance / lag

**Symptom**: Dashboard sluggish, zoom slow  
**Solutions**:
1. Close other tabs/applications
2. Reduce marker cluster radius in `ClusterLayer` (line 63)
3. Disable unnecessary layers (hotspots, recommendations)
4. Use Chrome DevTools Performance tab to profile
5. Reduce animation duration in CSS

#### Login page appears blank

**Symptom**: Can't see login form  
**Solutions**:
1. Check `LoginPage.jsx` is in `src/`
2. Verify CSS loaded: `src/App.css`
3. Try incognito mode
4. Clear localStorage: `localStorage.clear()`

---

## Contributing

### Code Style

- Use 2-space indentation
- Follow ESLint rules
- Component functions should be commented
- Use meaningful variable names

### Testing Changes

```bash
# Run linter
npm run lint

# Start dev server
npm run dev

# Test in browser
# Navigate to http://localhost:5173
# Use console (F12) for debugging
```

### Making Updates

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make changes:
   - Update components
   - Add styling
   - Test locally

3. Commit:
   ```bash
   git add .
   git commit -m "feat: Add your feature description"
   ```

4. Push and create pull request

### Updating Dependencies

Check for outdated packages:
```bash
npm outdated
```

Update securely:
```bash
npm update
npm audit fix
```

---

## Support & Resources

### Documentation
- **Catalyst Docs**: https://catalyst.zoho.com/help/
- **React Docs**: https://react.dev
- **Leaflet Docs**: https://leafletjs.com
- **Vite Docs**: https://vitejs.dev

### Debugging
- **Browser DevTools**: F12 or Right-click → Inspect
- **Network Tab**: Check API requests/responses
- **Console Tab**: View errors and logs
- **Catalyst Logs**: View function execution logs in console

### Issues & Support
- Report bugs via GitHub Issues
- Include:
  - Browser and version
  - Steps to reproduce
  - Screenshots/error messages
  - Console errors (F12 → Console)

### Contact
- **KSP Datathon 2026 Team**: [Your Email]
- **Zoho Catalyst Support**: [Catalyst Support Link]

---

## License

MIT License - See LICENSE file for details

---

## Changelog

### Version 1.0.0 (July 26, 2026)
- ✅ Initial release for KSP Datathon 2026
- ✅ KPI dashboard with live statistics
- ✅ Interactive crime map with clustering
- ✅ AI chatbot with tool-calling
- ✅ CCTV recommendation engine (priority-based)
- ✅ Criminal network graph visualization
- ✅ District boundary overlays
- ✅ Hotspot zone detection
- ✅ Kannada + English multi-language support
- ✅ Voice input/output capabilities
- ✅ PDF export for conversations
- ✅ Analytics drawer with trends
- ✅ Premium enterprise UI design
- ✅ Full responsive design
- ✅ Production-ready deployment

---

## File Statistics

| File | Lines | Purpose |
|------|-------|---------|
| `src/App.jsx` | 1,800+ | Main React component + all sub-components |
| `src/App.css` | 1,723 | Premium styling & animations |
| `src/index.css` | 123 | Design tokens & global styles |
| `LoginPage.jsx` | 100+ | Authentication component |
| `translations.js` | 50+ | Kannada/English localization |
| `package.json` | 40 | Dependencies & scripts |

---

## Quick Links

- 🚀 **Live Platform**: https://ksp-fir-platform-60073928681.development.catalystserverless.in
- 📦 **GitHub**: https://github.com/your-org/ksp-fir-platform
- 📚 **Datathon Details**: https://ksp-datathon-2026.example.com
- 🔗 **Zoho Catalyst**: https://catalyst.zoho.com
- 🗺️ **Map Data**: Uses Leaflet.js with OpenStreetMap tiles

---

**Made with ❤️ for Karnataka State Police | KSP Datathon 2026**

**Last Updated**: July 26, 2026  
**Maintained By**: Development Team  
**Status**: ✅ Production Ready
