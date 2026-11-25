# Alirada — *be served as you serve*

Alirada is a cooperative Service Economy, Ledger, Marketplace, Project & Employment Workspace, Crowdfunding Engine, Point Exchange, C2P/P2P Reference & Batch Payment System, and Institutional Governance Platform.

## Architecture
- **Frontend:** React 19, TypeScript, Tailwind CSS v4 (Dual Dark/Light theme with `#D4AF37` / `#B88B1E` gold accents, Cinzel + Plus Jakarta Sans + JetBrains Mono).
- **Backend & Security:** Firebase Authentication (Google Sign-In + optional Email/Password) and Cloud Firestore with hardened Attribute-Based Access Control (`firestore.rules`) and schema blueprint (`firebase-blueprint.json`).
- **Core Economy Math:**
  - `Final Score = Hours × Hardship (1–10)`
  - `Balance = Score Earned + Credits In - Deductions - Penalty Score + Carried Cycle Balance` (bounded by configurable negative points floor, default `-6000`).
  - Daily hours warning threshold (`8h`) with admin alert and hard daily cap (`10h`).

## Local & GitHub Publishing (`alirada.com`)
1. **Export to GitHub:** Push to your GitHub repository's `main` branch (`firebase-applet-config.json` is listed in `.gitignore`).
2. **Enable GitHub Pages + Custom Domain:**
   - Open **Settings → Pages**, set **Source** to **GitHub Actions**, and set **Custom domain** to `alirada.com` (enable **Enforce HTTPS** once DNS resolves).
   - `.github/workflows/deploy-pages.yml` automatically detects the custom domain base path, generates `dist/CNAME` (`alirada.com`), and creates `404.html` + `.nojekyll`.
3. **Configure GitHub Actions Secrets:**
   - In GitHub **Settings → Secrets and variables → Actions → Repository secrets → New repository secret**, add `FIREBASE_APPLET_CONFIG` (or the individual `VITE_FIREBASE_*` keys) and re-run the workflow.
   - Optionally lock down the Firebase Web API key in **Google Cloud Console → APIs & Services → Credentials** using **HTTP referrer restrictions** for `https://alirada.com/*` and `https://www.alirada.com/*`.
4. **Authorize `alirada.com` in Firebase Auth:** In Firebase Console (**Authentication → Settings → Authorized domains**), add `alirada.com` and `www.alirada.com` so Google Sign-In works on your live domain.
5. **Local Commands:**
   - Install dependencies: `npm install`
   - Run development server: `npm run dev`
   - Type-check & build: `npm run lint && npm run build`
   - Deploy Firestore rules: `firebase deploy --only firestore:rules`



