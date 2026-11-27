<p align="center">
  <img src="assets/icon.png" width="120" alt="LeetPing icon" />
</p>

<h1 align="center">LeetPing</h1>
<p align="center"><b>Your LeetCode alarm clock.</b><br/>Plan which problems to solve, get loud phone alarms that name the exact problem, and keep your streak alive.</p>

<p align="center">
  React Native · Expo SDK 58 · TypeScript · Android, iOS &amp; installable PWA
</p>

---

## Why

"I'll do LeetCode later" turns into a broken streak. LeetPing turns your plan into alarms on your phone:

- At **9:00** it rings: *"On your plan: #146 LRU Cache, #42 Trapping Rain Water"*
- At **21:30** the **streak saver** rings, but only if you haven't solved anything today
- 30 minutes before every **weekly/biweekly contest** it reminds you to show up
- Tap **Solve now** on the alarm and the problem opens straight in LeetCode

## Features

| | |
|---|---|
| 📲 **Installable PWA** | Install on Android, iPhone, Windows or Mac from the browser. Web Push alarms ring even when the app is closed. |
| ⏰ **Real alarms** | Max-importance Android channel (sound, long vibration, bypasses Do Not Disturb, lock-screen visible) plus *alarm-clock mode* for exact-minute delivery even in Doze. **Snooze 10 min** and **Solve now** buttons on every alarm. |
| 🗓️ **Plan your problems** | Add problems by **number** (`42`), **name**, **slug** or **pasted link**, and filter by **topic** and **difficulty**. Schedule them for any of the next 14 days, with an optional per-problem alarm time and a note. Overdue items roll over to today. |
| ✨ **Auto-plan** | Pick a topic (★ marks your weakest ones), difficulty, problems per day and number of days. LeetPing fills your plan with free problems you haven't solved, easiest first. |
| 🔗 **Connected to LeetCode** | Enter your username (no password; it reads your public profile only). You get solved counts by difficulty, streak, ranking, a submission heatmap, contest rating, badges, top topics and languages. |
| ✅ **Auto tick-off** | When LeetCode accepts a solution to a planned problem, LeetPing marks it done. |
| 🔥 **Smart streak saver** | Stays quiet once you've solved today, checked on app open and by a background task about every 30 minutes. |
| 🏆 **Contest alarms** | Upcoming contests are synced and you get an alarm 30 minutes before each starts. |
| 📴 **Offline-first** | Plans and alarms live on the phone (AsyncStorage). Alarms are local notifications, so no server or push account is needed. |

## Screens

**Today**: streak, today's plan, the daily challenge, the next contest and recent accepted solutions.
**Plan**: problems grouped by day, auto-plan, move or delete problems.
**Alarms**: repeating reminders (time + days), contest alarms, alarm-clock mode, test alarm.
**Profile**: LeetCode stats, heatmap, contest rating, topics, languages, badges, data source.

## LeetCode connection

LeetPing calls LeetCode's public GraphQL API (`https://leetcode.com/graphql`) straight from the phone. The query shapes follow
[alfa-leetcode-api](https://github.com/alfaarghya/alfa-leetcode-api) ([docs](https://alfaarghya.github.io/alfa-leetcode-api/)):

| Data | GraphQL field | alfa-leetcode-api equivalent |
|---|---|---|
| Profile, solved stats, ranking | `matchedUser { profile, submitStatsGlobal }`, `allQuestionsCount` | `/:username`, `/:username/solved` |
| Streak + heatmap | `matchedUser { userCalendar { streak totalActiveDays submissionCalendar } }` | `/:username/calendar` |
| Recent accepted | `recentAcSubmissionList(username, limit)` | `/:username/acSubmission` |
| Badges | `matchedUser { badges }` | `/:username/badges` |
| Topic skills | `matchedUser { tagProblemCounts }` | `/:username/skill` |
| Languages | `matchedUser { languageProblemCount }` | `/:username/language` |
| Contest rating | `userContestRanking(username)` | `/:username/contest` |
| Daily challenge | `activeDailyCodingChallengeQuestion` | `/daily` |
| Problem by slug | `question(titleSlug)` | `/select?titleSlug=` |
| Problem list (search / tags / difficulty) | `questionList(filters)` | `/problems?tags=&difficulty=&limit=` |
| Upcoming contests | `topTwoContests` | `/contests/upcoming` |

**Fallback:** if a direct GraphQL call fails, LeetPing retries against an alfa-leetcode-api server. The public instance (`https://alfa-leetcode-api.onrender.com`) is heavily rate limited, so for reliable fallback you can self-host it and paste its URL into **Profile → Data source**:

```bash
docker run -p 3000:3000 alfaarghya/alfa-leetcode-api:2.0.4
```

## Install as a PWA (phone + desktop)

LeetPing also ships as an installable web app with real push alarms:

- **Android (Chrome/Edge)**: open the site and tap **Install app**.
- **iPhone/iPad (iOS 16.4+)**: Safari → **Share → Add to Home Screen**, then open it from the home screen and allow notifications. iOS only allows web notifications for home-screen apps.
- **Desktop (Chrome/Edge)**: use the install icon in the address bar.

How alarms reach a **closed** PWA: the app uploads its next 14 days of alarms to `/api/push`. A scheduler calls `/api/dispatch` every minute, and the server sends each due alarm as a Web Push (VAPID). The service worker shows it with **Solve now** and **Snooze 10 min** buttons, and snooze works with the app closed too. While the app is open, in-page timers ring on time, sharing a notification tag with the push so you never get duplicates.

### Deploy (free tier)

1. **Upstash Redis**: create a free database at upstash.com and copy the REST URL and token.
2. **VAPID keys**: `npm run vapid`
3. **Vercel**: import the GitHub repo (it reads `vercel.json`: builds `expo export -p web`, serves `dist/`, runs `api/*.mjs`). Add these env vars:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:you@example.com`), `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET` (any long random string).
4. **Scheduler**: create a free [cron-job.org](https://cron-job.org) job hitting `https://YOUR-APP.vercel.app/api/dispatch?key=CRON_SECRET` **every minute**. Or use the included GitHub Action (`.github/workflows/dispatch-alarms.yml`, every ~5 min): set repo variable `LEETPING_URL` and secret `CRON_SECRET`.

Without step 4, alarms still ring while the app is open or backgrounded. Alarms that came due while it was closed ring as soon as you reopen it (if under 30 minutes late).

### Try the PWA locally

```bash
npm run pwa:local   # builds the web app and serves http://localhost:4173
```

This runs the real API functions with an in-memory Redis and throwaway VAPID keys, so push alarms work on localhost without any accounts.

`/api/leetcode` is a small read-only proxy: browsers can't call LeetCode's GraphQL directly (CORS). Mutations and large bodies are rejected.

## Run it on your phone

Prerequisites: Node 20+ and the **Expo Go** app on your phone ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)).

```bash
git clone https://github.com/aryanpol73/leetcode-reminder.git
cd leetcode-reminder
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). Open **Alarms → Allow notifications**, then **Send a test alarm**.

> Expo Go covers the UI, LeetCode sync and scheduled alarms. Background sync and exact alarm-clock delivery need a real build (below).

### Install as a real app (APK)

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview   # gives you an installable .apk link
```

For local development builds: `npx expo run:android` (needs Android Studio).

### Make alarms reliable on Android

1. **Alarms → Allow exact alarms** (Android 12+ asks for this separately).
2. Keep **Alarm-clock mode** on.
3. On Xiaomi, Oppo, Vivo, Samsung and similar phones, set LeetPing's battery usage to **Unrestricted** so the OS doesn't kill background sync.

## Development

```bash
npm run typecheck   # tsc --noEmit
npm test            # alarm planner unit tests (no device needed)
npm run test:live   # live checks against the LeetCode API (LEETPING_TEST_USER=you to use your profile)
npx expo-doctor     # dependency / config health
```

### Project layout

```
src/
  app/                    Expo Router screens
    (tabs)/index.tsx      Today
    (tabs)/plan.tsx       Plan + Auto-plan
    (tabs)/alarms.tsx     Alarms + settings
    (tabs)/profile.tsx    LeetCode profile & stats
    add-problem.tsx       Search/filter/add problems (modal)
    reminder.tsx          Create/edit an alarm (modal)
    _layout.tsx           Providers, notification tap/snooze handling
  lib/
    leetcode.ts           GraphQL client + alfa-leetcode-api fallback
    schedule.ts           Pure alarm planner (unit tested)
    notifications.ts      Channels, permissions, scheduling via expo-notifications
    background.ts         Background sync task (expo-background-task)
    dates.ts, types.ts
  state/store.tsx         App state, persistence, sync
  components/ui.tsx       Design system (cards, chips, heatmap, time picker…)
tests/                    node:test suites
```

### How alarms are scheduled

Alarms are queued as one-off local notifications for the next **14 days**, capped at 60 (iOS allows 64 pending). Each one carries that day's planned problems in its text. The queue is rebuilt whenever the plan or reminders change, when the app opens, and on every background sync. A streak-saver alarm is left out for today once LeetCode shows an accepted solution from today.

## Credits

- LeetCode data: [leetcode.com](https://leetcode.com). LeetPing is an unofficial companion app and is not affiliated with LeetCode.
- API reference & fallback: [alfa-leetcode-api](https://github.com/alfaarghya/alfa-leetcode-api) by alfaarghya (MIT).

## License

MIT © 2026 Aryan Pol
