# MSG — your kitchen, organized

A recipe manager with import, cookbooks, meal planning, a store-ready shopping list, cook mode, and ratings & notes. Warm "Organic" design system (Caprasimo + Figtree, sage & terracotta) from the Claude Design mockup.

## Stack

- **Frontend** — static vanilla-JS SPA (`public/`), no build step
- **Backend** — Supabase (project `msg-recipe-app`, id `beujonpfcwdazmtecmts`): Postgres + Row Level Security, email/password auth, `recipe-photos` storage bucket
- **Hosting** — Fly.io; a small zero-dependency Node server (`server.js`) serves the static app and provides `/api/fetch` (server-side page fetching, no CORS) and `/api/parse` (optional AI recipe extraction)

## Optional: AI-powered import (recommended)

The server has an AI parsing endpoint that dramatically improves import quality — it reads pages that publish no structured recipe data, and turns messy pasted text into an accurate, structured recipe. It uses the Anthropic API (Claude Haiku — fast and costs a fraction of a cent per recipe) with your own key:

1. Get an API key at https://platform.claude.com (Settings → API keys)
2. Add it to your Fly app as a secret (never commit it to code):

```bash
fly secrets set ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Fly restarts the app automatically. Without the key everything still works — imports just fall back to structured-data-only parsing and the quick text parser.

## Deploy to Fly.io

From this folder, with [flyctl](https://fly.io/docs/flyctl/install/) installed:

```bash
fly auth login
fly launch --no-deploy   # accept the existing fly.toml; pick a unique app name if msg-recipe-app is taken
fly deploy
```

That's it — `fly deploy` builds the Dockerfile (Node + `server.js` + the `public/` folder) and ships it. The app is fully static; Supabase is called directly from the browser, so there are no server secrets. The publishable key in `js/app.js` is safe to expose — data access is enforced by Row Level Security.

If you rename the app during `fly launch`, that's fine; nothing in the code depends on the hostname.

## First run

1. Open the deployed URL, create an account (email + password).
   - If sign-up says "check your email," confirm via the link Supabase sends, then sign in.
2. Add your first recipe from **Add recipe** — by URL, pasted text, or manual entry.

## Features

- **Home** — greeting, stats, "cook again" resume card, recently added, favorites
- **Recipes** — browse with filters (favorites, vegetarian, ★4+, under 30 min), grid/list, sort
- **Search** — titles, ingredients, and tags with match highlighting
- **Recipe page** — serving scaler (quantities rescale live, fractions included), pantry checkboxes, "add the rest to shopping list," favorite, add-to-plan
- **Cook Mode** — full-screen step-by-step, arrow-key navigation, screen wake lock, finishes into the cook log
- **Meal planner** — week grid (breakfast/lunch/dinner), week stats, shopping preview, one-tap "generate shopping list from this week"
- **Shopping list** — auto-grouped by aisle, recipe source labels, progress bar, clear checked
- **Import** — URL (reads the site's schema.org recipe data via a CORS proxy), paste-and-parse, or manual; edit everything before saving; drag-and-drop photo upload
- **Cookbooks** — cover-image shelf, per-cookbook filters, settings (rename, cover, delete)
- **Ratings & notes** — star rating, cook log, private kitchen notes
- Fully responsive — sidebar on desktop, bottom tab bar with safe-area insets on mobile

## Notes & limits

- URL import tries, in order: our own server fetch (multiple request profiles), public CORS proxies, the Internet Archive, and finally AI extraction of the raw page. A handful of publishers block all automated readers; paste-and-parse (AI-assisted when the key is set) covers those.
- Multi-day "month" planner view, photo-OCR import, and household/shared accounts are natural next steps.

## Local development

```bash
node server.js            # http://localhost:8080
# with AI parsing:
ANTHROPIC_API_KEY=sk-ant-… node server.js
```

No dependencies to install — the server is plain Node 18+.
