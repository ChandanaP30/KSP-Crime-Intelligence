# KSP Crime Intelligence Platform

An AI-assisted crime intelligence and analytics platform designed to explore how artificial intelligence, data visualisation, and geographical analysis can support crime-related decision-making.

The platform brings together crime analytics, geographical mapping, CCTV coverage analysis, criminal network visualisation, AI-assisted recommendations, and a document-based knowledge assistant in one interface.

> **Project status:** Hackathon / demonstration prototype. This is an independent project and is not an official Karnataka State Police or Karnataka State Crime Records Bureau product.

## Overview

Analysing crime-related information can involve large amounts of records, geographical data, investigation details, and supporting documents. This project explores how these different sources of information can be presented through a unified dashboard.

The platform uses interactive visualisations and AI-assisted features to help users explore patterns, identify potential coverage gaps, and understand information more efficiently.

## Key Features

### 1. Crime Analytics Dashboard
- Overview of total cases and case statuses.
- Interactive crime statistics and visualisations.
- District-wise and crime-type filtering.
- Date-range and investigation-status filters.
- Interactive geographical crime map.
- Natural-language questions through the AI Assistant.

### 2. CCTV Intelligence
- Visualisation of existing CCTV coverage.
- Identification of potential coverage gaps.
- AI-assisted CCTV placement recommendations.
- Priority scoring based on crime density, severity, and existing camera coverage.

### 3. Criminal Network Analysis
- Visual representation of offender relationships.
- Relationship strength indicators.
- Linked case and court-history information.
- Geographical relationship visualisation.
- AI-generated offender summaries.

### 4. Priority Action Centre
- AI-assisted identification of cases and operational issues requiring attention.
- Priority-based filtering and sorting.
- District and category filters.
- Detailed information through an interactive side panel.
- Context-aware AI assistance.

### 5. AI Patrol Recommendations
- Suggested patrol locations.
- Recommendations based on crime-pattern information.
- Location-based analysis to support patrol planning.

### 6. AI Knowledge Base (RAG)
- Upload documents such as SOPs, manuals, legal sections, and circulars.
- Ask questions using natural language.
- Retrieve information from uploaded documents.
- Display references and citations to supporting documents.

### 7. Bilingual Interface
- English and Kannada language support.
- Voice input for supported interactions.
- Text-to-speech for AI responses.

### 8. Role-Based Access
Different user roles have different levels of access to the dashboard and its features, including:
- Investigator
- Analyst
- Supervisor
- Policymaker
- Administrator

### 9. PDF Export
- Export AI conversation history into formatted PDF documents.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React 18 |
| Build Tool | Vite |
| Mapping | Leaflet, React Leaflet |
| Map Visualisation | Esri World Imagery |
| Network Visualisation | react-force-graph-2d |
| Charts | Recharts |
| Icons | Lucide React |
| PDF Generation | jsPDF, html2canvas |
| Backend | Zoho Catalyst |
| Database | Zoho Catalyst Data Store |
| AI Services | Catalyst QuickML, GLM chat model |
| Language Support | Zia Translation |

## System Architecture

The application follows a frontend and backend architecture.

**Frontend**
- Built using React and Vite.
- Handles dashboard components, interactive maps, charts, filters, and user interactions.
- Communicates with backend services through API requests.

**Backend**
- Uses Zoho Catalyst serverless functions.
- Handles authentication, data retrieval, AI requests, and knowledge-base operations.
- Uses Catalyst Data Store for application data.

**AI Integration**
- Supports natural-language interaction with crime-related information.
- Provides AI-assisted summaries and recommendations.
- Uses a Retrieval-Augmented Generation (RAG) workflow for document-based question answering.

**Important:** The Catalyst backend functions are deployed separately and are not included in this repository. The frontend connects to the configured backend endpoint.

## Project Structure

```text
KSP-Crime-Intelligence/
│
├── public/
│   └── Static assets
│
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── LoginPage.jsx
│   ├── translations.js
│   ├── assets/
│   └── utils/
│
├── .kiro/
│   └── specs/
│
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
└── README.md
```

Additional demonstration datasets and supporting files are maintained in the repository.

## Getting Started

### Prerequisites

Install the following:

- Node.js
- npm
- Git

### 1. Clone the repository

```bash
git clone https://github.com/ChandanaP30/KSP-Crime-Intelligence.git
```

### 2. Navigate to the project directory

```bash
cd KSP-Crime-Intelligence
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npm run dev
```

Open the local URL displayed in your terminal. Vite normally uses:

```text
http://localhost:5173
```

### 5. Create a production build

```bash
npm run build
```

### 6. Deployment

The application is hosted using Zoho Catalyst.

Deployment requires a configured Catalyst CLI and the appropriate project permissions.

```bash
catalyst deploy
```

## Live Application

Explore the deployed application:

[Open KSP Crime Intelligence Platform](https://fir-dashboard-raqicamd.onslate.in)

Availability of AI and data-related features depends on the configured backend services.

## Data and Privacy Disclaimer

This project uses synthetic demonstration data for development, testing, and hackathon demonstration purposes.

- It is not connected to live Karnataka Police operational systems.
- It does not provide access to official police databases.
- Geographical coordinates are approximate demonstration values.
- AI-generated recommendations are intended for demonstration and exploration.
- AI-generated information should not be treated as verified evidence or used as the sole basis for operational decisions.

No real personal, victim, accused, or confidential investigation information should be uploaded or exposed through this public repository.

## Security

- Never commit API keys, passwords, access tokens, or private configuration files.
- Keep sensitive environment variables outside the source code.
- Use appropriate authentication and access controls.
- Do not expose confidential backend endpoints or database credentials.
- Review demonstration datasets before sharing the repository publicly.

## Future Improvements

- Improve AI-based crime-pattern analysis.
- Enhance the accuracy and explainability of AI recommendations.
- Improve geographical data visualisation.
- Strengthen document retrieval and response accuracy.
- Add more language support.
- Improve backend performance and security.
- Expand automated testing and documentation.

## Licence

No open-source licence is currently provided with this project.

The repository is publicly viewable, but public visibility does not automatically grant permission to reuse, modify, or redistribute its code.

---

## Author

**Chandana Patagar**

Electronics and Communication Engineering Student

GitHub: [@ChandanaP30](https://github.com/ChandanaP30)

Project Repository: [KSP Crime Intelligence](https://github.com/ChandanaP30/KSP-Crime-Intelligence)
