# Corridor

UAE, India and world news in sixty words. Static frontend + one Netlify Function.

## Architecture

The browser never touches a publisher feed. It calls `/api/news`, which is a
Netlify Function that fetches every source server-side, normalises, deduplicates
and ranks them, then caches the result on Netlify's CDN for 10 minutes (stale
copies served for up to an hour while revalidating).

```
browser ──> /api/news ──> netlify/functions/news.mjs ──> ~40 publisher feeds
   │            (CDN cached 10 min, stale-while-revalidate 1h)
   └──> localStorage "saved edition" for instant first paint
```

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev          # netlify dev, serves the site + functions on :8888
```

Opening `index.html` directly with `file://` will **not** work — `/api/news`
needs the Netlify dev server or a deployment.

## Test

```bash
npm test
```

## Deploy

**Option A — Git (recommended)**

1. Push this directory to a GitHub repo.
2. Netlify → Add new site → Import an existing project → pick the repo.
3. Build command: `npm run build` · Publish directory: `.` · Functions: `netlify/functions`
   (all three are already set in `netlify.toml`, so accept the defaults).
4. Deploy.

**Option B — CLI**

```bash
npm install -g netlify-cli
netlify login
netlify link          # or: netlify sites:create
netlify deploy --build --prod
```

## Environment variables

None are required. The app works fully without any API key.

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Optional** | Only if you later add the optional server-side summariser. Set it in Netlify → Site settings → Environment variables. Never put it in frontend code. |

## Adding or removing a source

Edit `netlify/functions/sources.mjs`. It is a fixed allowlist — the function
refuses any host not listed there, so there is no open proxy. Each entry:

```js
{ name: 'Khaleej Times', region: 'uae', method: 'google-news-rss',
  url: '...', weight: 1.35, hint: 'entertainment' }
```

`weight` multiplies the relevance score. `hint` nudges categorisation for
single-topic feeds without overriding clear textual evidence.

## Tuning the feed mix

`FEED_MIX` in `netlify/functions/ranking.mjs` sets target shares for the
"For You" feed. These are guidance, not quotas — high-escalation breaking
stories bypass the mix entirely.
