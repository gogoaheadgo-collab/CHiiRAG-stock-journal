# SMK Stock Journal — Mobile App

React Native / Expo app for SMK Stock Journal. Connects to your existing Vercel API.

## Setup

### 1. Install dependencies
```bash
cd mobile
npm install
```

### 2. Create .env
```bash
cp .env.example .env
```
Fill in your Supabase URL, anon key, and Vercel URL.

### 3. Add font
Download **SpaceMono-Regular.ttf** from Google Fonts and place it at:
```
mobile/assets/fonts/SpaceMono-Regular.ttf
```

### 4. Add placeholder assets
Place any PNG image at these paths (can be same image):
```
mobile/assets/icon.png           (1024x1024)
mobile/assets/splash.png         (1284x2778)
mobile/assets/adaptive-icon.png  (1024x1024)
```

### 5. Run on Android
```bash
npx expo start --android
```
Scan the QR code with **Expo Go** app on your phone.

---

## Build APK (for distribution)

### Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Configure project
```bash
eas build:configure
```

### Build preview APK
```bash
eas build --platform android --profile preview
```
Download the `.apk` from the EAS dashboard and install on your Android device.

---

## Folder structure

```
mobile/
├── app/
│   ├── _layout.tsx          Root layout + auth provider
│   ├── index.tsx            Redirect to login or app
│   ├── (auth)/
│   │   ├── login.tsx        Login screen
│   │   └── pending.tsx      Awaiting approval screen
│   └── (app)/
│       ├── _layout.tsx      Bottom tab navigator
│       ├── trades.tsx       Trades list
│       ├── notes.tsx        Daily notes
│       ├── alerts.tsx       Price alerts
│       ├── bank.tsx         Bank accounts
│       └── profile.tsx      Profile + sign out
├── context/
│   └── AuthContext.tsx      Session + role state
├── lib/
│   ├── supabase.ts          Supabase client
│   ├── api.ts               All API calls to Vercel
│   └── theme.ts             Colors, fonts, spacing
├── assets/
│   └── fonts/
│       └── SpaceMono-Regular.ttf
├── .env.example
├── app.json
├── babel.config.js
├── eas.json
├── package.json
└── tsconfig.json
```

---

## Notes
- All API calls go through `lib/api.ts` → your existing Vercel endpoints
- Auth session stored securely via `expo-secure-store`
- Dark theme matches the web app exactly
- `check-alerts.js` is cron-only and is NOT called from the app
