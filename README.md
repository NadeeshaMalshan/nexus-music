# Nexus Music

Nexus Music is an AI-powered music dashboard built with Next.js, React, and TypeScript. It mixes YouTube-based playback, live metadata, device transfer controls, and AI-driven music features in a desktop-style dashboard.

## What this app does

- Plays music and video via YouTube integration.
- Shows current track metadata, artwork, and live metadata updates.
- Supports cross-device playback sync and device transfer controls.
- Provides playlist, search, and library UI with AI-enhanced recommendations.
- Uses real-time events for device state and playback updates.

## Project structure

- `src/app/` - Next.js app routes, global layout, and metadata.
- `src/components/` - UI components for the player, sidebar, dashboard, and helpers.
- `src/components/echoai/` - core music dashboard and EchoAI experience components.
- `src/context/` - React contexts for app state, device sync, settings, dashboard data, and jam sessions.
- `src/lib/` - utility functions, animation definitions, and helpers.
- `public/` - static assets such as icons and branding.

## App flow

1. `src/app/layout.tsx` wraps the page in React providers and renders `DashboardWrapper`.
2. `DashboardWrapper` loads state from `DashboardContext` and renders the dashboard shell.
3. `FloatingPlayer` displays the always-visible playback controls and cross-device popup.
4. `DeviceSyncContext` manages device state, active devices, and transfer actions.
5. `ExpandedPlayer` provides the full-screen playback view for video or live song interaction.

## Installation

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## Environment variables

Create a `.env` file with values for the following keys:

- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `PUSHER_APP_ID`
- `PUSHER_SECRET`
- `NEXT_PUBLIC_PUSHER_KEY`
- `NEXT_PUBLIC_PUSHER_CLUSTER`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `GEMINI_API_KEY`
- `YT_KEY_1`
- `GENIUS_ACCESS_TOKEN`
- `ACR_HOST`
- `ACR_ACCESS_KEY`
- `ACR_ACCESS_SECRET`

> Keep secrets out of version control.

## Scripts

- `npm run dev` - start the development server
- `npm run build` - build the production bundle
- `npm run start` - start the production server
- `npm run lint` - run ESLint checks

## Dependencies

- Next.js `16.2.1`
- React `19.2.4`
- TypeScript
- Tailwind CSS v4
- motion/react
- next-auth
- pusher / pusher-js
- openai
- @google/generative-ai
- @huggingface/inference
- react-youtube
- ytmusic-api
- play-dl

## Notes

The repository also contains helper scripts and test utilities in the root (`test-*.mjs`), plus auto-generated player scripts. Review them before maintenance or deployment.
