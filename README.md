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
1. **Export to GitHub:** Use Google AI Studio's GitHub export/save button (or push to a GitHub repository's `main` branch).
   - `firebase-applet-config.json` is listed in `.gitignore` so public repositories do not trigger secret-scanner warnings on the Firebase Web API key.
   - If you pushed `firebase-applet-config.json` in an earlier commit, untrack it once with:
     `git rm --cached firebase-applet-config.json && git commit -m "Untrack Firebase applet config"`
2. **Enable GitHub Pages (Fixes Blank Page):**
   - In your GitHub repository, open **Settings → Pages** and change **Source** from *Deploy from a branch* to **GitHub Actions**.
   - Serving directly from the `main` branch fails with a blank page because browsers cannot run uncompiled `/src/main.tsx`; the `.github/workflows/deploy-pages.yml` workflow builds `dist/` with relative `./` asset paths so any repo URL or custom domain renders properly.
3. **Provide Firebase Config to GitHub Actions (Optional for Live Login on GitHub Pages):**
   - In GitHub **Settings → Secrets and variables → Actions → New repository secret**, either add `FIREBASE_APPLET_CONFIG` containing your `firebase-applet-config.json` JSON, or add `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_DATABASE_ID`.
   - Note: A Firebase Web `apiKey` is a public client identifier (security is enforced by `firestore.rules`). You can further lock down the key in **Google Cloud Console → APIs & Services → Credentials** with **HTTP referrer restrictions** for your `github.io` and AI Studio URLs.
4. **Authorize Firebase Domain:** In Firebase Console (**Authentication → Settings → Authorized domains**), add `<your-github-username>.github.io` so Google Sign-In works on the live site.
5. **Local Commands:**
   - Install dependencies: `npm install`
   - Run development server: `npm run dev`
   - Type-check & build: `npm run lint && npm run build`
   - Deploy Firestore rules: `firebase deploy --only firestore:rules`


