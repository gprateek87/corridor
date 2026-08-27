/* ============================================================
   Corridor — /.netlify/functions/news
   Fetches every publisher server-side, normalises to one schema,
   deduplicates, ranks, and serves from the Netlify CDN.
   The visitor's browser never touches a publisher feed.
   ============================================================ */

import Parser from 'rss-parser';
import { SOURCES, PUBLISHERS, ALLOWED_HOSTS } from './sources.mjs';
import { categorise, scoreStory, balanceFeed, isPromotional, isFiller } from './ranking.mjs';

const SOURCE_TIMEOUT_MS = 4500;
const MAX_AGE_HOURS = 72;
const PER_SOURCE_LIMIT = 20;
const TOTAL_LIMIT = 90;

const parser = new Parser({
  timeout: SOURCE_TIMEOUT_MS,
  headers: { 'User-Agent': 'CorridorNews/2.0 (+https://corridornews.netlify.app)' },
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

/* ---------------- text hygiene ---------------- */
const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
  '&nbsp;': ' ', '&rsquo;': '\u2019', '&lsquo;': '\u2018', '&ldquo;': '\u201C',
  '&rdquo;': '\u201D', '&mdash;': '\u2014', '&ndash;': '\u2013', '&hellip;': '\u2026'
};

function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&[a-z]+;/gi, m => ENTITIES[m.toLowerCase()] ?? m);
}

function clean(s) {
  return decodeEntities(String(s || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/* Google News appends " - Publisher". Strip only that final suffix, and only
   when the tail actually looks like a publisher — never break a real hyphen. */
function stripPublisherSuffix(title) {
  const m = title.match(/^(.*\S)\s+[-–—]\s+([^-–—]{2,45})$/);
  if (!m) return { title, publisher: null };
  const tail = m[2].trim();
  const known = PUBLISHERS.some(p => p.toLowerCase() === tail.toLowerCase());
  const publisherish = known || (/^[A-Z]/.test(tail) && tail.split(/\s+/).length <= 4 && !/[.!?,:]$/.test(tail));
  if (!publisherish) return { title, publisher: null };
  return { title: m[1].trim(), publisher: tail };
}

function summarise(raw, fallbackTitle, words = 60) {
  const text = clean(raw);
  if (!text || text.length < 25) return '';
  if (text.toLowerCase().startsWith(fallbackTitle.slice(0, 24).toLowerCase())) return '';
  const parts = text.split(' ');
  if (parts.length <= words) return text;
  const cut = parts.slice(0, words).join(' ');
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return stop > cut.length * 0.55 ? cut.slice(0, stop + 1) : cut.replace(/[,;:\s]+$/, '') + '\u2026';
}

/* ---------------- image discovery (feed data only, no page fetches) ---------------- */
function pickImage(item) {
  const ok = u => typeof u === 'string' && /^https:\/\//i.test(u) && !/\.(mp3|mp4|m4a|pdf)(\?|$)/i.test(u);

  if (ok(item.enclosure?.url) && (item.enclosure.type || '').startsWith('image')) return item.enclosure.url;
  if (ok(item.enclosure?.url) && !item.enclosure.type) return item.enclosure.url;

  for (const m of item.mediaContent || []) {
    const u = m?.$?.url;
    if (ok(u) && (!m.$.medium || m.$.medium === 'image')) return u;
  }
  for (const m of item.mediaThumbnail || []) {
    if (ok(m?.$?.url)) return m.$.url;
  }
  const html = item.contentEncoded || item['content:encoded'] || item.content || item.description || '';
  const found = String(html).match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i);
  return found && ok(found[1]) ? found[1] : null;
}

/* ---------------- identity ---------------- */
function canonicalUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref|oc$)/i.test(p)) u.searchParams.delete(p);
    }
    u.hash = '';
    return u.toString();
  } catch { return null; }
}

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

const titleKey = t => t.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 8).join('-');

/* ---------------- fetch one source ---------------- */
async function fetchSource(source) {
  const started = Date.now();
  const base = { source: source.name, method: source.method, success: false, count: 0 };

  let host;
  try { host = new URL(source.url).hostname; } catch { return { ...base, error: 'bad-url' }; }
  if (!ALLOWED_HOSTS.has(host)) return { ...base, error: 'host-not-allowed' };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), SOURCE_TIMEOUT_MS);

  try {
    const res = await fetch(source.url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'CorridorNews/2.0 (+https://corridornews.netlify.app)',
                 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }
    });
    if (!res.ok) return { ...base, error: `http-${res.status}`, status: res.status, ms: Date.now() - started };

    const xml = await res.text();
    if (!xml || xml.length < 120) return { ...base, error: 'empty-body', ms: Date.now() - started };
    if (/^\s*<!doctype html/i.test(xml)) return { ...base, error: 'html-not-feed', ms: Date.now() - started };

    const feed = await parser.parseString(xml);
    const items = (feed.items || []).slice(0, PER_SOURCE_LIMIT);
    const stories = items.map(it => normalise(it, source)).filter(Boolean);

    return { ...base, success: stories.length > 0, count: stories.length, stories,
             status: res.status, ms: Date.now() - started,
             error: stories.length ? undefined : 'no-usable-items' };
  } catch (err) {
    const timedOut = err?.name === 'AbortError';
    return { ...base, error: timedOut ? 'timeout' : 'fetch-failed', ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- normalise one item ---------------- */
function normalise(item, source) {
  const rawTitle = clean(item.title);
  const url = canonicalUrl(item.link || item.guid || '');
  if (!rawTitle || !url) return null;

  const isGN = source.method === 'google-news-rss';
  const { title, publisher } = isGN ? stripPublisherSuffix(rawTitle) : { title: rawTitle, publisher: null };
  if (!title) return null;

  /* Keep the curated source name in the UI. A Google News query for
     site:khaleejtimes.com stays "Khaleej Times" — never "Google News". */
  let displaySource = source.name;
  if (isGN && publisher && /wire$/i.test(source.name)) displaySource = publisher;

  const publishedAt = item.isoDate || item.pubDate
    ? new Date(item.isoDate || item.pubDate).toISOString()
    : new Date().toISOString();

  const summary = summarise(item.contentSnippet || item.summary || item.description || item.content || '', title);

  const story = {
    id: hash(url) + '-' + titleKey(title).slice(0, 24),
    title,
    summary,
    url,
    image: isGN ? null : pickImage(item),   // Google News items carry no usable art
    source: displaySource,
    publishedAt,
    category: '',
    region: source.region,
    relevanceScore: 0,
    indiaImpact: 0,
    gulfImpact: 0,
    escalation: 0
  };

  story.category = categorise(story, source.hint);
  Object.assign(story, scoreStory(story, source));
  return story;
}

/* ---------------- filtering & dedupe ---------------- */
function refine(all) {
  const cutoff = Date.now() - MAX_AGE_HOURS * 36e5;
  const byId = new Map();
  const byTitle = new Map();

  for (const s of all) {
    if (!s.title || !s.url) continue;
    if (new Date(s.publishedAt).getTime() < cutoff) continue;
    if (isPromotional(s.title + ' ' + s.summary)) continue;
    if (isFiller(s.title) && s.relevanceScore < 12) continue;

    const tk = titleKey(s.title);
    const existing = byTitle.get(tk);
    if (existing) {
      /* same story from two feeds — keep the better-scored, richer copy */
      const better = (s.relevanceScore + (s.image ? 2 : 0) + (s.summary ? 1 : 0)) >
                     (existing.relevanceScore + (existing.image ? 2 : 0) + (existing.summary ? 1 : 0));
      if (better) { byId.delete(existing.id); byTitle.set(tk, s); byId.set(s.id, s); }
      continue;
    }
    if (byId.has(s.id)) continue;
    byTitle.set(tk, s);
    byId.set(s.id, s);
  }
  return [...byId.values()];
}

/* ---------------- handler ---------------- */
export default async function handler() {
  const settled = await Promise.allSettled(SOURCES.map(fetchSource));

  const results = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: SOURCES[i].name, method: SOURCES[i].method, success: false, count: 0, error: 'rejected' }
  );

  const collected = results.flatMap(r => r.stories || []);
  const stories = balanceFeed(refine(collected), TOTAL_LIMIT);

  /* One diagnostic line per publisher, merging that publisher's queries. */
  const merged = new Map();
  for (const r of results) {
    const key = `${r.source}|${r.method}`;
    const cur = merged.get(key) || { source: r.source, method: r.method, success: false, count: 0, errors: [] };
    cur.success = cur.success || r.success;
    cur.count += r.count || 0;
    if (r.error) cur.errors.push(r.error);
    merged.set(key, cur);
  }
  const diagnostics = [...merged.values()].map(d => ({
    source: d.source,
    method: d.method,
    success: d.success,
    count: d.count,
    ...(d.success ? {} : { error: d.errors[0] || 'unknown' })
  })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  const body = {
    stories,
    updatedAt: new Date().toISOString(),
    count: stories.length,
    diagnostics
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=60',
      'Netlify-CDN-Cache-Control': 'public, durable, s-maxage=600, stale-while-revalidate=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

/* exported for tests */
export const __test = { clean, decodeEntities, stripPublisherSuffix, summarise, canonicalUrl, refine, normalise, titleKey };
