# MSG — your kitchen, organized

A recipe manager with import, cookbooks, meal planning, a store-ready shopping list, cook mode, and ratings & notes. Warm "Organic" design system (Caprasimo + Figtree, sage & terracotta) from the Claude Design mockup.

## Stack

- **Frontend** — static vanilla-JS SPA (`public/`), no build step
- **Backend** — Supabase (project `msg-recipe-app`, id `beujonpfcwdazmtecmts`): Postgres + Row Level Security, email/password auth, `recipe-photos` storage bucket
- **Hosting** — Fly.io, nginx serving the static files

## Deploy to Fly.io

From this folder, with [flyctl](https://fly.io/docs/flyctl/install/) installed:

```bash
fly auth login
fly launch --no-deploy   # accept the existing fly.toml; pick a unique app name if msg-recipe-app is taken
fly deploy
```

That's it — `fly deploy` builds the Dockerfile (nginx + the `public/` folder) and ships it. The app is fully static; Supabase is called directly from the browser, so there are no server secrets. The publishable key in `js/app.js` is safe to expose — data access is enforced by Row Level Security.

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

- URL import depends on the recipe site publishing JSON-LD recipe data (most major sites do) and on the public `api.allorigins.win` CORS proxy. If a fetch fails, paste-and-parse is the fallback.
- Multi-day "month" planner view, photo-OCR import, and household/shared accounts are natural next steps.

## Local development

```bash
cd public && python3 -m http.server 8080
```

Then open http://localhost:8080 — no build step needed.
