/* MSG server — static hosting + recipe fetch/parse API. Node 18+, zero dependencies. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const PUB = path.join(__dirname, 'public');
const AI_KEY = process.env.ANTHROPIC_API_KEY || '';
const AI_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'application/javascript',
  '.woff2':'font/woff2', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.json':'application/json',
};
/* Different sites gate differently: some require a browser-looking UA, others
   (Cloudflare-fronted) block fake browser UAs from servers but allow honest
   clients. So we try a few profiles and prefer the response holding recipe data. */
const FETCH_PROFILES = [
  { name:'default', headers: { 'Accept':'text/html,*/*;q=0.8' } },
  { name:'honest',  headers: { 'User-Agent':'MSG-RecipeApp/1.0 (personal recipe importer)', 'Accept':'text/html,*/*;q=0.8' } },
  { name:'browser', headers: {
      'User-Agent':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language':'en-US,en;q=0.9' } },
];
async function fetchPage(target){
  let fallback = null, lastStatus = 0;
  for (const prof of FETCH_PROFILES){
    try {
      const r = await fetch(target, { headers: prof.headers, redirect:'follow', signal: AbortSignal.timeout(12000) });
      lastStatus = r.status;
      if (!r.ok) continue;
      const html = await r.text();
      if (html.includes('application/ld+json')) return { html };
      if (!fallback) fallback = html;
    } catch {}
  }
  if (fallback) return { html: fallback };
  return { error: lastStatus ? `The site answered ${lastStatus}` : 'The site did not answer in time', status: lastStatus };
}

function json(res, code, obj){
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type':'application/json', 'Cache-Control':'no-store' });
  res.end(body);
}
function readBody(req, limit = 2_000_000){
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > limit) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/* Trim page HTML down to what matters for recipe extraction, to keep AI costs tiny. */
function condenseHtml(html){
  const ld = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
  const og = [...html.matchAll(/<meta[^>]+property="og:(?:image|title|description)"[^>]*>/gi)].map(m=>m[0]);
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&#39;|&apos;/g,"'").replace(/&quot;/g,'"')
    .replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
  if (body.length > 24000) body = body.slice(0, 24000);
  return { ld: ld.join('\n').slice(0, 30000), og: og.join('\n'), text: body };
}

async function aiParse({ text, html, url }){
  if (!AI_KEY) { const e = new Error('AI parsing is not configured'); e.code = 501; throw e; }
  let source;
  if (html){
    const c = condenseHtml(html);
    source = `Structured data found on the page (may be empty):\n${c.ld}\n\nOpen Graph tags:\n${c.og}\n\nVisible page text:\n${c.text}`;
  } else {
    source = `Recipe text pasted by the user:\n${String(text).slice(0, 24000)}`;
  }
  const prompt = `Extract the recipe from the source material below into JSON. Respond with ONLY a JSON object — no markdown fences, no commentary. Use exactly these keys:
{"title": string, "description": string (1-2 sentences, empty string if none), "prep_min": integer|null, "cook_min": integer|null, "total_min": integer|null, "servings": integer (default 4), "cuisine": string|null, "author": string|null (the recipe's credited author or site/creator name), "tags": string[] (up to 5 short tags like "Vegetarian","Weeknight"), "image_url": string|null (absolute URL only), "ingredients": string[] (one complete ingredient per entry, keep quantities and prep notes, e.g. "2 lb zucchini, coarsely grated"), "steps": string[] (one instruction per entry, in order, imperative voice, no step numbers)}
Rules: preserve the recipe's own wording where possible; do not invent quantities or steps that are not in the source; merge duplicate ingredient lists (some pages repeat them); if the source clearly contains no recipe, return {"error":"no recipe found"}.
${url ? `Source URL: ${url}\n` : ''}
SOURCE MATERIAL:
${source}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-api-key': AI_KEY, 'anthropic-version':'2023-06-01' },
    body: JSON.stringify({ model: AI_MODEL, max_tokens: 4000, messages: [{ role:'user', content: prompt }] }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok){
    const detail = await r.text().catch(()=> '');
    const e = new Error(`AI request failed (${r.status})`); e.code = 502; e.detail = detail.slice(0,300); throw e;
  }
  const data = await r.json();
  const textOut = (data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
  const clean = textOut.replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'').trim();
  const parsed = JSON.parse(clean);
  if (parsed.error){ const e = new Error(parsed.error); e.code = 422; throw e; }
  return parsed;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');

  /* ── API ── */
  if (u.pathname === '/api/health') return json(res, 200, { ok:true, ai: !!AI_KEY });

  /* Stream an external image so the client can cache it into its own storage. */
  if (u.pathname === '/api/image' && req.method === 'GET'){
    const target = u.searchParams.get('url') || '';
    if (!/^https?:\/\//i.test(target)) return json(res, 400, { error:'A full http(s) URL is required' });
    try {
      let r = null;
      for (const prof of FETCH_PROFILES){
        try {
          r = await fetch(target, { headers: { ...prof.headers, 'Accept':'image/avif,image/webp,image/*,*/*;q=0.8' }, redirect:'follow', signal: AbortSignal.timeout(12000) });
          if (r.ok) break;
        } catch { r = null; }
      }
      if (!r || !r.ok) return json(res, 502, { error:'Could not fetch that image' });
      const ct = r.headers.get('content-type') || 'image/jpeg';
      if (!ct.startsWith('image/')) return json(res, 415, { error:'Not an image' });
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 8_000_000) return json(res, 413, { error:'Image too large' });
      res.writeHead(200, { 'Content-Type': ct, 'Cache-Control':'no-store' });
      return res.end(buf);
    } catch { return json(res, 502, { error:'Could not fetch that image' }); }
  }

  if (u.pathname === '/api/fetch' && req.method === 'GET'){
    const target = u.searchParams.get('url') || '';
    if (!/^https?:\/\//i.test(target)) return json(res, 400, { error:'A full http(s) URL is required' });
    try {
      const out = await fetchPage(target);
      if (out.error) return json(res, 502, { error: out.error });
      res.writeHead(200, { 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store' });
      return res.end(out.html.slice(0, 3_000_000));
    } catch (e){
      return json(res, 502, { error:'Could not reach the site' });
    }
  }

  if (u.pathname === '/api/parse' && req.method === 'POST'){
    try {
      const body = JSON.parse(await readBody(req) || '{}');
      if (!body.text && !body.html) return json(res, 400, { error:'Send { text } or { html, url }' });
      const recipe = await aiParse(body);
      return json(res, 200, { recipe });
    } catch (e){
      return json(res, e.code || 500, { error: e.message || 'Parse failed', detail: e.detail });
    }
  }

  /* ── static ── */
  let p = path.normalize(u.pathname).replace(/^([.]{2}[\/\\])+/, '');
  if (p === '/' || p === '\\') p = '/index.html';
  let file = path.join(PUB, p);
  if (!file.startsWith(PUB)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) return fs.readFile(path.join(PUB, 'index.html'), (e2, idx) => {
      if (e2){ res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(idx);
    });
    const ext = path.extname(file).toLowerCase();
    const cache = ['.woff2','.css','.js'].includes(ext) ? 'public, max-age=604800' : 'no-cache';
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': cache });
    res.end(data);
  });
});
server.listen(PORT, () => console.log(`MSG serving on :${PORT} — AI parsing ${AI_KEY?'ON':'OFF (set ANTHROPIC_API_KEY to enable)'}`));
