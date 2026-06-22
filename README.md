# Mini Mailing App — Internal Invitation Sender

A premium internal web app for HEINEKEN Myanmar teams to prepare, preview, test,
and send **personalized invitation emails** from their own Microsoft mailbox —
one email per recipient, never a CC/BCC blast.

Built with **Vite + React + TypeScript**. The app lives in [`app/`](app/).

## Features

- **Compose** one subject + message with `{{Name}}` / `{{Company}}` placeholders
- **Recipients** — editable grid: add rows inline, paste a list, or import `.xlsx` / `.csv`
  - Download a blank import template, export the current list to Excel/CSV
  - Live validation: invalid email, missing name, duplicate detection
- **Attachments**, **preview**, **test send**, and **Send All** (one-by-one with
  live progress, pause / cancel, retry-failed-only)
- **Templates** and **recipient groups** saved for reuse
- **Send history** + exportable reports
- **Microsoft Graph sending** — sign in with your Azure AD account and send for real,
  or explore in **demo mode** with simulated sends (no Azure needed)

## Run locally

```bash
cd app
npm install
npm run dev
```

Open http://localhost:5173/.

## Real Microsoft sending (optional)

Sending "from your own mailbox" uses Microsoft sign-in (OAuth) — **not** an API key.
In your Azure app registration:

1. **Authentication → Add a platform → Single-page application (SPA)** — a
   browser SPA must use the SPA platform, not "Public client (mobile & desktop)".
2. Redirect URI: `http://localhost:5173`
3. **API permissions → Microsoft Graph → Delegated:** `Mail.Send`, `User.Read`
4. _Optional:_ `Mail.Send.Shared` — only needed to send **from a shared mailbox**
   (Settings → send-from). If it isn't granted, the app falls back to sending as
   the signed-in user.

Then in the app: **Settings → Microsoft connection**, paste your **Application (client) ID**
and **Directory (tenant) ID**, and connect. Settings, templates, groups, and history are
stored locally in the browser.
