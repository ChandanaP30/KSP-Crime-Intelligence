\# KSP Crime Intelligence Platform



An AI-assisted crime intelligence dashboard built for the Karnataka State Police / Karnataka State Crime Records Bureau — visualizing crime data, surfacing CCTV coverage gaps, mapping criminal networks, and prioritizing operational action, all backed by real case data and grounded AI analysis.



\## Features



\- \*\*Dashboard\*\* — KPI overview (total cases, investigation/chargesheet/closure status, chargesheet rate), interactive map with district boundaries, crime-case clustering, hotspot zones, filterable by district/status/crime type/date range, and an Ask AI panel for natural-language questions about the data (English and Kannada).

\- \*\*CCTV Intelligence\*\* — existing camera coverage layer and AI-generated CCTV placement recommendations, scored by crime density, severity, and distance from existing coverage, with priority tiers.

\- \*\*Criminal Network\*\* — offender relationship graph (deterministic hub-and-spoke layout), showing real associate connections by strength (strong/medium/weak), linked cases, court history, and an on-demand AI summary per offender. Includes a map-based view for geographically anchored relationships.

\- \*\*Priority Action Center\*\* — AI-assisted surfacing of cases and operational issues needing attention, filterable and sortable by priority/category/district, with a details drawer and context-aware "Ask AI" for each flagged item.

\- \*\*AI Patrol Recommendation\*\* — suggested patrol locations and timing derived from real crime pattern data.

\- \*\*Knowledge Base (RAG)\*\* — upload official documents (SOPs, legal sections, circulars, manuals) and ask natural-language questions answered strictly from the uploaded content, with citations back to source documents.

\- \*\*Role-based access\*\* — different officer roles (Investigator, Analyst, Supervisor, Policymaker, etc.) see different tabs and levels of access.

\- \*\*Bilingual UI\*\* — English and Kannada, including voice input and text-to-speech for AI answers.

\- \*\*PDF export\*\* — export AI conversation history to a formatted PDF.



\## Demo Login



The dashboard uses role-based authentication and is accessible only to authorised users — there is no public sign-up. Judges/evaluators should log in using the demo credentials below.



\- \*\*Username:\*\* `Admin`

\- \*\*Password:\*\* `Admin123`





\## Setup and Execution



Steps for judges/evaluators to run this project locally:



1\. Clone the GitHub repository

2\. `cd` into the project directory

3\. Install dependencies:

&#x20;  ```bash

&#x20;  npm install

&#x20;  ```

4\. Start the local development server:

&#x20;  ```bash

&#x20;  npm run dev

&#x20;  ```

5\. Vite will print a local URL in the terminal, normally `http://localhost:5173` — open this in a browser.

6\. To create a production build:

&#x20;  ```bash

&#x20;  npm run build

&#x20;  ```

7\. To deploy to Zoho Catalyst (requires the Catalyst CLI to be configured):

&#x20;  ```bash

&#x20;  catalyst deploy

&#x20;  ```

8\. Alternatively, the already-deployed Catalyst URL can be used to access the live application directly, without running anything locally.



\### Important



\- Internet access is required to use connected services.

\- The AI Assistant, crime data, CCTV recommendations, Knowledge Base, and other intelligence features all depend on the configured Zoho Catalyst backend being reachable.

\- Judges should log in using the demo credentials provided above.

\- Never expose API keys, backend credentials, or other sensitive configuration values in this repository or elsewhere.



\## Tech Stack



\*\*Frontend\*\*

\- React 18 + Vite

\- `react-leaflet` / `leaflet.markercluster` — interactive mapping

\- `react-force-graph-2d` — criminal network graph visualization

\- `recharts` — analytics charts

\- `lucide-react` — icons

\- `jspdf` / `html2canvas` — PDF export



\*\*Backend\*\*

\- Zoho Catalyst (serverless functions + Data Store)

\- Functions include: `auth-function`, `map-data-function`, `cctv-recommend-function`, `network-graph-function`, `priority-action-function`, `ask-ai-function`, `kb-function`

\- AI: Catalyst QuickML (GLM chat model + Zia translation)



> \*\*Note:\*\* this repository/zip contains the \*\*frontend only\*\*. The Catalyst backend functions are deployed separately and are not included here — `FUNCTIONS\_BASE` in `src/App.jsx` points to the live deployed backend.



\## Deployment



This project is hosted on \*\*Zoho Catalyst\*\*. The live application is deployed and served via Catalyst Slate, not run through a local dev server.



To deploy (from the project root, with the Catalyst CLI configured):

```bash

catalyst deploy

```



\*\*Live application:\*\* https://fir-dashboard-raqicamd.onslate.in



\## Local Development



For working on the frontend locally (connects to the already-deployed live backend via `FUNCTIONS\_BASE` in `src/App.jsx`):



```bash

npm install

npm run dev

```



This is for previewing frontend changes only — it does not deploy anything. To build a production bundle without deploying:

```bash

npm run build

```



\## Project Structure



```

src/

&#x20; App.jsx              Main application shell + all panel components

&#x20; App.css              Application styling

&#x20; LoginPage.jsx         Government-portal-style login screen

&#x20; translations.js       English/Kannada UI strings

&#x20; assets/               Static assets (district boundaries, images)

&#x20; utils/                Helper utilities (district name mapping)

public/                 Static files served as-is (favicons, images)

```



\## Data Disclaimer



This platform runs on synthetic demonstration data (cases, CCTV camera locations, and offender records) generated for demo/hackathon purposes. District boundary and city-center coordinates are drawn from public general-knowledge sources rather than a surveyed database. It is not connected to live Karnataka Police operational systems.



\## License



Internal / hackathon submission — not licensed for external distribution.

