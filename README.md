# Alirada — *be served as you serve*

Alirada is a cooperative Service Economy, Ledger, Marketplace, Project & Employment Workspace, Crowdfunding Engine, Point Exchange, C2P/P2P Reference & Batch Payment System, and Institutional Governance Platform.

## Architecture
- **Frontend:** React 19, TypeScript, Tailwind CSS v4 (Dual Dark/Light theme with `#D4AF37` / `#B88B1E` gold accents, Cinzel + Plus Jakarta Sans + JetBrains Mono).
- **Backend & Security:** Firebase Authentication (Google Sign-In + optional Email/Password) and Cloud Firestore with hardened Attribute-Based Access Control (`firestore.rules`) and schema blueprint (`firebase-blueprint.json`).
- **Core Economy Math:**
  - `Final Score = Hours × Hardship (1–10)`
  - `Balance = Score Earned + Credits In - Deductions - Penalty Score + Carried Cycle Balance` (bounded by configurable negative points floor, default `-6000`).
  - Daily hours warning threshold (`8h`) with admin alert and hard daily cap (`10h`).

## Local & GitHub Setup
1. Install dependencies: `npm install`
2. Run development server: `npm run dev`
3. Build for production: `npm run build`
4. Deploy Firestore security rules: `firebase deploy --only firestore:rules`
