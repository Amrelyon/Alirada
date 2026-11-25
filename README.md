# Alirada — *be served as you serve*

Alirada is a cooperative Service Economy, Ledger, Marketplace, Project & Employment Workspace, Crowdfunding Engine, Point Exchange, C2P/P2P Reference & Batch Payment System, and Institutional Governance Platform.

## Architecture
- **Frontend:** React 19, TypeScript, Tailwind CSS v4 (Dual Dark/Light theme with `#D4AF37` / `#B88B1E` gold accents, Cinzel + Plus Jakarta Sans + JetBrains Mono).
- **Backend & Security:** Firebase Authentication (Google Sign-In + optional Email/Password) and Cloud Firestore with hardened Attribute-Based Access Control (`firestore.rules`) and schema blueprint (`firebase-blueprint.json`).
- **Core Economy Math:**
  - `Final Score = Hours × Hardship (1–10)`
  - `Balance = Score Earned + Credits In - Deductions - Penalty Score + Carried Cycle Balance` (bounded by configurable negative points floor, default `-6000`).
  - Daily hours warning threshold (`8h`) with admin alert and hard daily cap (`10h`).

## Local & GitHub Publishing
1. **Export to GitHub:** Use Google AI Studio's GitHub export/save button (or download the project and push to a GitHub repository's `main` branch).
2. **Enable GitHub Pages:** In your GitHub repository, open **Settings → Pages**, set **Source** to **GitHub Actions**, and the included `.github/workflows/deploy-pages.yml` workflow will automatically build and publish `dist/`.
3. **Authorize Firebase Domain:** In the Firebase Console (**Authentication → Settings → Authorized domains**), add your published domain (for example `<your-github-username>.github.io`) so Google Sign-In works on the live site.
4. **Local Commands:**
   - Install dependencies: `npm install`
   - Run development server: `npm run dev`
   - Type-check & build: `npm run lint && npm run build`
   - Deploy Firestore rules: `firebase deploy --only firestore:rules`

