# SMK Stock Journal 📈

Personal NSE/BSE trade journal with live prices, MTF tracking, and full P&L analytics.
Target URL: **smk-jornal.vercel.app**

---

## COMPLETE DEPLOYMENT GUIDE (Beginner Friendly)

### STEP 1 — Create Supabase Project

1. Go to https://supabase.com → Sign up / Log in
2. Click **"New Project"**
3. Fill in:
   - Name: `smk-stock-journal`
   - Database Password: (save this somewhere)
   - Region: `Southeast Asia (Singapore)` — closest to India
4. Wait ~2 minutes for project to be ready

---

### STEP 2 — Run the Database Schema

1. In Supabase, click **"SQL Editor"** in the left menu
2. Click **"New Query"**
3. Open the file `supabase-schema.sql` from this project
4. Copy everything and paste it into the SQL editor
5. Click **"Run"** (green button)
6. You should see "Success. No rows returned"

---

### STEP 3 — Enable Google Login

1. In Supabase, go to **Authentication → Providers**
2. Find **Google** and click on it
3. Toggle it **ON**
4. You need a **Client ID** and **Client Secret** from Google:

   **Getting Google OAuth credentials:**
   a. Go to https://console.cloud.google.com
   b. Create a new project called `smk-journal`
   c. Go to **APIs & Services → OAuth Consent Screen**
      - Choose **External** → Create
      - App name: `SMK Stock Journal`
      - Support email: `gogoaheadgo@gmail.com`
      - Click Save & Continue through all steps
   d. Go to **APIs & Services → Credentials**
      - Click **+ Create Credentials → OAuth 2.0 Client ID**
      - Type: **Web application**
      - Name: `smk-journal-web`
      - Authorized redirect URIs — add:
        `https://YOUR-PROJECT-ID.supabase.co/auth/v1/callback`
        (replace YOUR-PROJECT-ID with your actual Supabase project ID)
   e. Click Create → Copy the **Client ID** and **Client Secret**

5. Paste Client ID and Client Secret into Supabase → Google provider → Save

---

### STEP 4 — Push Code to GitHub

1. Go to https://github.com → Sign in
2. Click **"New repository"**
3. Name: `smk-stock-journal`
4. Keep it Private → Click **Create repository**
5. Open terminal / command prompt on your computer:

```bash
cd path/to/smk-stock-journal
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/smk-stock-journal.git
git push -u origin main
```

---

### STEP 5 — Deploy on Vercel

1. Go to https://vercel.com → Sign up with GitHub
2. Click **"Add New Project"**
3. Import your `smk-stock-journal` repository
4. Under **Environment Variables**, add these two:
   ```
   Name: NEXT_PUBLIC_SUPABASE_URL
   Value: https://your-project-id.supabase.co

   Name: NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: your-anon-key (from Supabase → Settings → API)
   ```
5. Click **Deploy**
6. After deploy, go to **Settings → Domains**
7. Add custom domain: `smk-jornal.vercel.app`
   - Actually Vercel auto-assigns: `smk-stock-journal.vercel.app`
   - To get `smk-jornal.vercel.app` exactly, name your Vercel project `smk-jornal`

---

### STEP 6 — Link Vercel URL back to Supabase

1. Supabase → **Authentication → URL Configuration**
2. Set **Site URL**: `https://smk-jornal.vercel.app`
3. Under **Redirect URLs**, add: `https://smk-jornal.vercel.app`
4. Save

---

## Done! 🎉

Your journal is live at **smk-jornal.vercel.app**

Sign in with `gogoaheadgo@gmail.com` and start logging trades!

---

## Features

- ✅ All 17 columns from your Excel model
- ✅ Dynamic account names (add RAVI, VINOD, etc. from the app)
- ✅ Long & Short trade tracking
- ✅ Live NSE prices via Yahoo Finance (~15min delay)
- ✅ MTF value + auto-calculated daily interest
- ✅ Unrealised P&L on open positions
- ✅ Realised P&L on closed trades
- ✅ Duration of trade (auto-calculated)
- ✅ Invested capital (auto-calculated)
- ✅ Position size % (vs total open capital)
- ✅ Filter by status (Open/Closed) and by account
- ✅ Win rate + stats dashboard
