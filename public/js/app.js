/* MSG — recipe app. Vanilla SPA + Supabase. */
'use strict';

/* ── config ── */
const SUPA_URL = 'https://beujonpfcwdazmtecmts.supabase.co';
const SUPA_KEY = 'sb_publishable_w16qO00vx2p8tY0nSsIf9w_-sYFZolJ';
const db = supabase.createClient(SUPA_URL, SUPA_KEY);

/* ── state ── */
const S = {
  user: null,
  recipes: [],
  cookbooks: [],
  cbLinks: [],       // {cookbook_id, recipe_id}
  plan: [],          // meal_plan rows
  shopping: [],
  loaded: false,
  weekStart: null,   // Date of Monday for planner
  browse: { q: '', filter: 'all', sort: 'recent', view: 'grid' },
};

/* ── tiny DOM/util helpers ── */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escAttr = esc;
let toastTimer;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.classList.remove('show'), 2600);
}
const fmtDate = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
const isoDate = d => d.toISOString().slice(0,10);
function mondayOf(d){ const x = new Date(d); const dow = (x.getDay()+6)%7; x.setDate(x.getDate()-dow); x.setHours(0,0,0,0); return x; }
function minsLabel(m){ if(!m) return ''; if(m<60) return `${m} min`; const h=Math.floor(m/60), r=m%60; return r?`${h} h ${r} m`:`${h} h`; }
function greet(){ const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; }
function firstName(){ const n=S.user?.user_metadata?.name || S.user?.email || ''; return n.split(/[@ ]/)[0].replace(/^\w/,c=>c.toUpperCase()); }

/* ── icons (Lucide-style outline, matches design .ic) ── */
const I = {
  home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  book:'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  shelf:'<path d="M2 6h4v14H2zM8 4h4v16H8zM16.5 5.2 20 4l3 15.7-3.9.8z" transform="scale(0.85) translate(1.5 1.5)"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  cart:'<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  chevL:'<path d="m15 18-6-6 6-6"/>',
  chevR:'<path d="m9 18 6-6-6-6"/>',
  star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  pen:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  play:'<polygon points="6 3 20 12 6 21 6 3"/>',
  trash:'<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  note:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  clip:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
};
const ic = (name, size=18) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${I[name]||''}</svg>`;
const starFill = (size=22) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" style="fill:currentColor;stroke:none" aria-hidden="true">${I.star}</svg>`;

/* ── recipe photo helpers ── */
function phStyle(r){ return r.image_url ? ` style="background-image:url('${escAttr(r.image_url)}')"` : ''; }
function phDiv(r, cls=''){
  const has = !!r.image_url;
  return `<div class="ph ${has?'':'empty'} ${cls}"${phStyle(r)}>${has?'':`<span class="ph-initial">${esc((r.title||'?')[0])}</span>`}</div>`;
}

/* ── ingredient scaling ── */
const UNICODE_FRAC = {'¼':.25,'½':.5,'¾':.75,'⅓':1/3,'⅔':2/3,'⅛':.125,'⅜':.375,'⅝':.625,'⅞':.875};
function scaleIngredient(text, factor){
  if (factor === 1) return text;
  return String(text).replace(/(\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞])|(\d+\s*\/\s*\d+)|([¼½¾⅓⅔⅛⅜⅝⅞])|(\d+(?:\.\d+)?)/g, m => {
    let v;
    if (/^\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]$/.test(m)) v = parseInt(m) + UNICODE_FRAC[m.trim().slice(-1)];
    else if (m.includes('/')) { const [a,b] = m.split('/').map(s=>parseFloat(s)); v = a/b; }
    else if (UNICODE_FRAC[m]) v = UNICODE_FRAC[m];
    else v = parseFloat(m);
    const s = v * factor;
    return niceNum(s);
  });
}
function niceNum(n){
  const fr = [[.25,'¼'],[1/3,'⅓'],[.5,'½'],[2/3,'⅔'],[.75,'¾']];
  const whole = Math.floor(n + 1e-6), rem = n - whole;
  if (rem < 0.05) return String(whole || Math.round(n*100)/100);
  for (const [v,g] of fr) if (Math.abs(rem-v) < 0.06) return (whole?whole+' ':'') + g;
  return String(Math.round(n*100)/100);
}

/* ── aisle categorization ── */
const AISLES = [
  ['Produce', /\b(lemon|lime|orange|apple|banana|berr|peach|tomato|potato|onion|shallot|garlic|ginger|scallion|leek|carrot|celery|pepper(?!corn)|zucchini|squash|cucumber|lettuce|arugula|spinach|kale|chard|cabbage|broccoli|cauliflower|mushroom|avocado|herb|thyme|rosemary|basil|cilantro|parsley|mint|dill|sage|fennel|corn\b|pea[s]?\b|green bean|eggplant|radish|beet)/i],
  ['Meat & Fish', /\b(chicken|beef|pork|lamb|turkey|sausage|bacon|prosciutto|ham\b|steak|rib[s]?\b|ground|salmon|tuna|cod|halibut|shrimp|prawn|scallop|anchov|fish|mussel|clam)/i],
  ['Dairy & Eggs', /\b(milk|cream|butter|yogurt|yoghurt|cheese|feta|parmesan|mozzarella|ricotta|cheddar|egg[s]?\b|crème|creme fraiche|buttermilk)/i],
  ['Bakery', /\b(bread|baguette|bun[s]?\b|tortilla|pita|croissant|roll[s]?\b)/i],
  ['Frozen', /\b(frozen|ice cream)/i],
  ['Pantry', /./],
];
function aisleFor(name){ for (const [a, re] of AISLES) if (re.test(name)) return a; return 'Pantry'; }

/* ── URL / text recipe parsing ── */
function parseISODuration(s){
  if (!s) return null;
  const m = String(s).match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  return (parseInt(m[1]||0)*1440) + (parseInt(m[2]||0)*60) + parseInt(m[3]||0) || null;
}
function findRecipeNode(o){
  if (!o || typeof o !== 'object') return null;
  if (Array.isArray(o)) { for (const x of o){ const r = findRecipeNode(x); if (r) return r; } return null; }
  const t = o['@type'];
  if (t && (t === 'Recipe' || (Array.isArray(t) && t.includes('Recipe')))) return o;
  if (o['@graph']) return findRecipeNode(o['@graph']);
  for (const k of Object.keys(o)) if (typeof o[k] === 'object') { const r = findRecipeNode(o[k]); if (r) return r; }
  return null;
}
function jsonLdToRecipe(node, url){
  const steps = [];
  const walkInstructions = ins => {
    if (!ins) return;
    if (typeof ins === 'string') { ins.split(/\n+/).forEach(s=>s.trim()&&steps.push(s.trim())); return; }
    if (Array.isArray(ins)) { ins.forEach(walkInstructions); return; }
    if (ins.itemListElement) { walkInstructions(ins.itemListElement); return; }
    if (ins.text) steps.push(String(ins.text).trim());
    else if (ins.name) steps.push(String(ins.name).trim());
  };
  walkInstructions(node.recipeInstructions);
  let img = node.image;
  if (Array.isArray(img)) img = img[0];
  if (img && typeof img === 'object') img = img.url;
  const yieldRaw = Array.isArray(node.recipeYield) ? node.recipeYield[0] : node.recipeYield;
  const servings = parseInt(String(yieldRaw||'').match(/\d+/)?.[0]) || 4;
  let sourceName = '';
  try { sourceName = new URL(url).hostname.replace(/^www\./,''); } catch {}
  return {
    title: String(node.name||'Untitled recipe').trim(),
    description: String(node.description||'').replace(/<[^>]+>/g,'').trim(),
    image_url: img || null,
    source_url: url, source_name: sourceName,
    prep_min: parseISODuration(node.prepTime),
    cook_min: parseISODuration(node.cookTime),
    total_min: parseISODuration(node.totalTime),
    servings,
    cuisine: Array.isArray(node.recipeCuisine)?node.recipeCuisine[0]:(node.recipeCuisine||null),
    tags: [].concat(node.keywords ? String(node.keywords).split(',').map(s=>s.trim()).filter(Boolean).slice(0,5) : []),
    ingredients: (node.recipeIngredient||[]).map(t=>String(t).trim()).filter(Boolean),
    steps,
  };
}
function recipeFromHtml(html, url){
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')){
    try {
      const node = findRecipeNode(JSON.parse(s.textContent));
      if (node) return jsonLdToRecipe(node, url);
    } catch {}
  }
  return null;
}
async function fetchRecipeFromUrl(url, onStatus){
  // Public CORS proxies come and go, and big recipe publishers block some of
  // them — so try several routes and take the first that yields recipe data.
  const enc = encodeURIComponent(url);
  const routes = [
    ['corsproxy.io',      `https://corsproxy.io/?url=${enc}`],
    ['allorigins',        `https://api.allorigins.win/raw?url=${enc}`],
    ['codetabs',          `https://api.codetabs.com/v1/proxy?quest=${url}`],
    ['the Internet Archive', `https://web.archive.org/web/2id_/${url}`],
  ];
  let sawHtml = false;
  for (const [name, prox] of routes){
    onStatus?.(`Fetching via ${name}…`);
    try {
      const res = await fetch(prox, { signal: AbortSignal.timeout(14000) });
      if (!res.ok) continue;
      const html = await res.text();
      if (!html || html.length < 500) continue;
      sawHtml = true;
      const rec = recipeFromHtml(html, url);
      if (rec) return rec;
    } catch {}
  }
  throw new Error(sawHtml
    ? 'That page loaded, but no structured recipe data was found on it'
    : 'Could not reach that page from the browser — the site may block proxies');
}
function parsePastedText(text){
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const out = { title:'', description:'', ingredients:[], steps:[], servings:4, tags:[] };
  if (!lines.length) return out;
  out.title = lines[0].replace(/^#+\s*/,'');
  let mode = '';
  for (const l of lines.slice(1)){
    const low = l.toLowerCase().replace(/[:#]/g,'').trim();
    if (/^ingredients?$/.test(low)) { mode='ing'; continue; }
    if (/^(steps?|method|directions?|instructions?|preparation)$/.test(low)) { mode='step'; continue; }
    const clean = l.replace(/^[-•*]\s*/,'').replace(/^\d+[.)]\s*/,'');
    if (mode==='ing') out.ingredients.push(clean);
    else if (mode==='step') out.steps.push(clean);
    else if (/^[-•*]/.test(l) || /^\d+\s*(cup|tbsp|tsp|lb|oz|g|kg|ml|cloves?|bunch)/i.test(l)) { mode='ing'; out.ingredients.push(clean); }
    else if (/^\d+[.)]/.test(l)) { mode='step'; out.steps.push(clean); }
    else if (!out.description) out.description = l;
  }
  return out;
}

/* ═════════ data layer ═════════ */
async function loadAll(){
  const [r1, r2, r3, r4, r5] = await Promise.all([
    db.from('recipes').select('*').order('created_at', { ascending:false }),
    db.from('cookbooks').select('*').order('created_at'),
    db.from('cookbook_recipes').select('*'),
    db.from('meal_plan').select('*'),
    db.from('shopping_items').select('*').order('created_at'),
  ]);
  for (const r of [r1,r2,r3,r4,r5]) if (r.error) { console.error(r.error); toast('Could not load your kitchen — retrying may help'); }
  S.recipes = r1.data||[]; S.cookbooks = r2.data||[]; S.cbLinks = r3.data||[];
  S.plan = r4.data||[]; S.shopping = r5.data||[];
  S.loaded = true;
}
const recipeById = id => S.recipes.find(r=>r.id===id);
const cookbookById = id => S.cookbooks.find(c=>c.id===id);
const recipesInCookbook = cbId => S.cbLinks.filter(l=>l.cookbook_id===cbId).map(l=>recipeById(l.recipe_id)).filter(Boolean);
const cookbooksOfRecipe = rId => S.cbLinks.filter(l=>l.recipe_id===rId).map(l=>cookbookById(l.cookbook_id)).filter(Boolean);

async function saveRecipe(rec){
  const payload = { ...rec, user_id: S.user.id };
  const q = rec.id
    ? db.from('recipes').update(payload).eq('id', rec.id).select().single()
    : db.from('recipes').insert(payload).select().single();
  const { data, error } = await q;
  if (error) { console.error(error); toast('Save failed — try again'); return null; }
  const i = S.recipes.findIndex(r=>r.id===data.id);
  if (i>=0) S.recipes[i] = data; else S.recipes.unshift(data);
  return data;
}
async function deleteRecipe(id){
  const { error } = await db.from('recipes').delete().eq('id', id);
  if (error) { toast('Delete failed'); return false; }
  S.recipes = S.recipes.filter(r=>r.id!==id);
  S.cbLinks = S.cbLinks.filter(l=>l.recipe_id!==id);
  S.plan = S.plan.filter(p=>p.recipe_id!==id);
  return true;
}
async function setRecipeCookbooks(recipeId, cbIds){
  const cur = S.cbLinks.filter(l=>l.recipe_id===recipeId).map(l=>l.cookbook_id);
  const add = cbIds.filter(id=>!cur.includes(id));
  const rem = cur.filter(id=>!cbIds.includes(id));
  if (add.length){
    const { error } = await db.from('cookbook_recipes').insert(add.map(cookbook_id=>({cookbook_id, recipe_id:recipeId})));
    if (!error) add.forEach(cookbook_id=>S.cbLinks.push({cookbook_id, recipe_id:recipeId}));
  }
  if (rem.length){
    await db.from('cookbook_recipes').delete().eq('recipe_id',recipeId).in('cookbook_id',rem);
    S.cbLinks = S.cbLinks.filter(l=>!(l.recipe_id===recipeId && rem.includes(l.cookbook_id)));
  }
}
async function uploadPhoto(file){
  const ext = (file.name.split('.').pop()||'jpg').toLowerCase();
  const path = `${S.user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from('recipe-photos').upload(path, file, { upsert:true });
  if (error) { toast('Photo upload failed'); return null; }
  return db.storage.from('recipe-photos').getPublicUrl(path).data.publicUrl;
}
async function upsertPlan(dateIso, mealType, recipeId){
  const { data, error } = await db.from('meal_plan')
    .upsert({ user_id:S.user.id, date:dateIso, meal_type:mealType, recipe_id:recipeId }, { onConflict:'user_id,date,meal_type' })
    .select().single();
  if (error) { toast('Could not plan that meal'); return; }
  S.plan = S.plan.filter(p=>!(p.date===dateIso && p.meal_type===mealType));
  S.plan.push(data);
}
async function clearPlan(dateIso, mealType){
  await db.from('meal_plan').delete().match({ user_id:S.user.id, date:dateIso, meal_type:mealType });
  S.plan = S.plan.filter(p=>!(p.date===dateIso && p.meal_type===mealType));
}
async function addShoppingItems(items){ // [{name, quantity, category, recipe_id, recipe_title}]
  const rows = items.map(it=>({ ...it, user_id:S.user.id, category: it.category || aisleFor(it.name) }));
  const { data, error } = await db.from('shopping_items').insert(rows).select();
  if (error) { toast('Could not add to shopping list'); return; }
  S.shopping.push(...data);
}
async function toggleShopping(id, checked){
  await db.from('shopping_items').update({ checked }).eq('id', id);
  const it = S.shopping.find(i=>i.id===id); if (it) it.checked = checked;
}
async function removeShopping(ids){
  await db.from('shopping_items').delete().in('id', ids);
  S.shopping = S.shopping.filter(i=>!ids.includes(i.id));
}

/* ═════════ router / shell ═════════ */
const NAV = [
  ['#/home','Home','home'], ['#/recipes','Recipes','book'], ['#/cookbooks','Cookbooks','shelf'],
  ['#/plan','Meal plan','cal'], ['#/shop','Shopping list','cart'],
];
function route(){ return location.hash || '#/home'; }
window.addEventListener('hashchange', render);

function shell(content, active){
  const initial = esc(firstName()[0]||'M');
  const navLinks = NAV.map(([h,l,i]) =>
    `<a href="${h}" ${active===h?'aria-current="page"':''}>${ic(i,18)}${l}</a>`).join('');
  const tabLinks = [NAV[0],NAV[1],NAV[3],NAV[4]].map(([h,l,i]) =>
    `<a href="${h}" ${active===h?'aria-current="page"':''}>${ic(i)}${l.replace('Meal plan','Plan').replace('Shopping list','Shop')}</a>`).join('');
  return `
  <div class="shell">
    <aside class="sidebar">
      <a class="brand" href="#/home"><span class="brand-mark">M</span><span class="brand-name">MSG</span></a>
      <nav class="side-nav" aria-label="Main">${navLinks}</nav>
      <div class="side-user">
        <span class="avatar">${initial}</span>
        <div class="who"><b>${esc(firstName())}</b><div class="sub">${esc(S.user.email)}</div></div>
        <button class="btn btn-icon btn-ghost" id="btn-logout" title="Sign out">${ic('logout',16)}</button>
      </div>
    </aside>
    <main class="main" id="main">${content}</main>
  </div>
  <nav class="tabbar" aria-label="Main">${tabLinks}</nav>`;
}
function mount(html, active){
  $('#app').innerHTML = shell(html, active);
  $('#btn-logout')?.addEventListener('click', async ()=>{ await db.auth.signOut(); location.hash='#/home'; boot(); });
}
function topbar(placeholder='Search recipes, ingredients, cookbooks…'){
  return `<div class="topbar">
    <div class="searchwrap">${ic('search',16)}
      <input class="input" id="global-search" type="search" placeholder="${escAttr(placeholder)}" autocomplete="off">
    </div>
    <button class="btn btn-primary" onclick="location.hash='#/import'">${ic('plus',15)} Add recipe</button>
  </div>`;
}
function wireTopbar(){
  const inp = $('#global-search');
  if (!inp) return;
  inp.addEventListener('keydown', e=>{
    if (e.key==='Enter' && inp.value.trim()) location.hash = '#/search?q=' + encodeURIComponent(inp.value.trim());
  });
}

async function render(){
  if (!S.user) return renderAuth();
  if (!S.loaded){ $('#app').innerHTML = '<div class="spin" aria-label="Loading"></div>'; await loadAll(); }
  const h = route();
  closeModal();
  if (h.startsWith('#/recipe/')) return viewRecipe(h.slice(9).split('?')[0]);
  if (h.startsWith('#/cook/')) return viewCookMode(h.slice(7));
  if (h.startsWith('#/cookbook/')) return viewCookbook(h.slice(11));
  if (h.startsWith('#/search')) return viewSearch(decodeURIComponent((h.split('q=')[1]||'').split('&')[0]||''));
  if (h.startsWith('#/recipes')) return viewBrowse();
  if (h.startsWith('#/plan')) return viewPlanner();
  if (h.startsWith('#/shop')) return viewShopping();
  if (h.startsWith('#/import')) return viewImport();
  if (h.startsWith('#/cookbooks')) return viewCookbooks();
  return viewHome();
}

/* ═════════ auth ═════════ */
function renderAuth(){
  $('#app').innerHTML = `
  <div class="auth-wrap"><div class="auth-card">
    <span class="brand-mark">M</span>
    <h2 style="margin:0">MSG</h2>
    <p class="text-muted" style="margin:0 0 8px">Import, organize, plan, and cook — your kitchen in one place.</p>
    <form id="auth-form">
      <div class="field"><label for="a-email">Email</label><input class="input" id="a-email" type="email" required autocomplete="email"></div>
      <div class="field"><label for="a-pass">Password</label><input class="input" id="a-pass" type="password" required minlength="6" autocomplete="current-password"></div>
      <p class="auth-err" id="auth-err"></p>
      <button class="btn btn-primary btn-block" id="a-signin" type="submit">Sign in</button>
      <button class="btn btn-secondary btn-block" id="a-signup" type="button">Create an account</button>
    </form>
    <p class="auth-note">Your recipes are private to your account.</p>
  </div></div>`;
  const err = m => $('#auth-err').textContent = m || '';
  $('#auth-form').addEventListener('submit', async e=>{
    e.preventDefault(); err('');
    const { error } = await db.auth.signInWithPassword({ email:$('#a-email').value, password:$('#a-pass').value });
    if (error) return err(error.message);
    boot();
  });
  $('#a-signup').addEventListener('click', async ()=>{
    err('');
    const email = $('#a-email').value, password = $('#a-pass').value;
    if (!email || password.length<6) return err('Enter an email and a password of at least 6 characters.');
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) return err(error.message);
    if (data.session) boot();
    else err('Check your email to confirm your account, then sign in.');
  });
}

/* ═════════ recipe card ═════════ */
function rcard(r, extra=''){
  const cbs = cookbooksOfRecipe(r.id);
  const meta = [minsLabel(r.total_min || ((r.prep_min||0)+(r.cook_min||0)) || null), r.rating?`★ ${r.rating}`:null,
    r.times_cooked?`cooked ${r.times_cooked}×`:'new', cbs[0]?.name].filter(Boolean).join(' · ');
  return `<button class="rcard elev-sm" onclick="location.hash='#/recipe/${r.id}'">
    ${phDiv(r)}
    <span class="body">
      <span class="title">${esc(r.title)}</span>
      <span class="card-meta">${esc(meta)}</span>
      ${extra}
    </span></button>`;
}

/* ═════════ HOME ═════════ */
function viewHome(){
  const today = new Date();
  const dateLine = today.toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric'});
  const recent = S.recipes.slice(0,6);
  const favs = S.recipes.filter(r=>r.favorite).slice(0,5);
  // next planned meal from today forward
  const upcoming = S.plan
    .filter(p=>p.recipe_id && p.date >= isoDate(today))
    .sort((a,b)=>a.date.localeCompare(b.date))[0];
  const upRecipe = upcoming ? recipeById(upcoming.recipe_id) : null;
  const lastCooked = S.recipes.filter(r=>r.last_cooked_at).sort((a,b)=>b.last_cooked_at.localeCompare(a.last_cooked_at))[0];

  const content = `
  ${topbar()}
  <p class="eyebrow">${dateLine}</p>
  <h2>${greet()}, ${esc(firstName())}.</h2>
  <div class="stat-row">
    <div class="stat"><b>${S.recipes.length}</b><span>recipes saved</span></div>
    <div class="stat"><b>${S.cookbooks.length}</b><span>cookbooks</span></div>
    ${upRecipe?`<div class="stat next-up"><b>${esc(upRecipe.title)}</b><span>next · ${new Date(upcoming.date+'T12:00').toLocaleDateString('en-US',{weekday:'short'})} ${upcoming.meal_type}</span></div>`
      :`<div class="stat next-up"><b>Nothing planned</b><span><a href="#/plan">plan this week</a></span></div>`}
  </div>
  ${lastCooked?`
  <div class="resume elev-sm">
    ${phDiv(lastCooked)}
    <div class="body">
      <span class="kicker">Cook again</span>
      <h4 style="margin:0">${esc(lastCooked.title)}</h4>
      <p style="font-size:13.5px;opacity:.75;margin:0">${esc(lastCooked.description||'').slice(0,140)}</p>
      <div><button class="btn btn-sage" onclick="location.hash='#/cook/${lastCooked.id}'">${ic('play',14)} Resume cooking</button></div>
    </div>
  </div>`:''}
  ${S.recipes.length ? `
    <div class="section-head"><h3>Recently added</h3><a href="#/recipes">View all</a></div>
    <div class="two-col">
      <div class="grid-cards">${recent.map(r=>rcard(r)).join('')}</div>
      <div>
        <div class="section-head" style="margin-top:0"><h4 style="margin:0">Favorites</h4>${favs.length?`<a href="#/recipes">View all</a>`:''}</div>
        ${favs.length ? `<div class="fav-list">${favs.map(r=>`
          <button class="fav-item" onclick="location.hash='#/recipe/${r.id}'">
            ${phDiv(r)}
            <span><b>${esc(r.title)}</b><span>${esc([minsLabel(r.total_min),r.rating?`★ ${r.rating}`:null,r.times_cooked?`cooked ${r.times_cooked}×`:null].filter(Boolean).join(' · '))}</span></span>
          </button>`).join('')}</div>`
        : `<p class="text-muted" style="font-size:13.5px">Tap the heart on any recipe to keep it close.</p>`}
      </div>
    </div>`
  : `<div class="empty">${ic('book',34)}<b>Your kitchen is empty — for now</b>
      <p>Bring in your first recipe from a link, a photo of a cookbook page, or straight from your head.</p>
      <button class="btn btn-primary" onclick="location.hash='#/import'">${ic('plus',15)} Add your first recipe</button></div>`}
  `;
  mount(content, '#/home'); wireTopbar();
}

/* ═════════ BROWSE ═════════ */
function browseFiltered(){
  let list = [...S.recipes];
  const f = S.browse.filter;
  if (f==='fav') list = list.filter(r=>r.favorite);
  if (f==='veg') list = list.filter(r=>(r.tags||[]).some(t=>/vegetarian|vegan/i.test(t)));
  if (f==='4plus') list = list.filter(r=>r.rating>=4);
  if (f==='quick') list = list.filter(r=>(r.total_min||((r.prep_min||0)+(r.cook_min||0)))<=30 && (r.total_min||r.prep_min||r.cook_min));
  const s = S.browse.sort;
  if (s==='rating') list.sort((a,b)=>(b.rating||0)-(a.rating||0));
  if (s==='cooked') list.sort((a,b)=>(b.last_cooked_at||'').localeCompare(a.last_cooked_at||''));
  if (s==='az') list.sort((a,b)=>a.title.localeCompare(b.title));
  return list;
}
function viewBrowse(){
  const list = browseFiltered();
  const F = [['all','All'],['fav','Favorites'],['veg','Vegetarian'],['4plus','★ 4+'],['quick','Under 30 min']];
  const content = `
  ${topbar('Search all recipes…')}
  <p class="eyebrow">Your collection</p>
  <div class="detail-head">
    <h2 style="margin:0">All recipes · ${S.recipes.length}</h2>
    <div class="seg" role="group" aria-label="Layout">
      <button class="seg-opt" aria-pressed="${S.browse.view==='grid'}" data-view="grid">${ic('grid',14)} Grid</button>
      <button class="seg-opt" aria-pressed="${S.browse.view==='list'}" data-view="list">${ic('list',14)} List</button>
    </div>
  </div>
  <div class="filter-row">
    ${F.map(([k,l])=>`<button class="tag tag-outline" aria-pressed="${S.browse.filter===k}" data-filter="${k}">${l}</button>`).join('')}
    <span class="spacer"></span>
    <select class="input" id="sort-sel" style="width:auto">
      <option value="recent" ${S.browse.sort==='recent'?'selected':''}>Sort: recently added</option>
      <option value="rating" ${S.browse.sort==='rating'?'selected':''}>Sort: top rated</option>
      <option value="cooked" ${S.browse.sort==='cooked'?'selected':''}>Sort: last cooked</option>
      <option value="az" ${S.browse.sort==='az'?'selected':''}>Sort: A to Z</option>
    </select>
  </div>
  ${list.length
    ? (S.browse.view==='grid'
        ? `<div class="grid-cards">${list.map(r=>rcard(r)).join('')}</div>`
        : `<div class="fav-list">${list.map(r=>`
            <button class="fav-item" onclick="location.hash='#/recipe/${r.id}'">${phDiv(r)}
            <span><b>${esc(r.title)}</b><span>${esc([minsLabel(r.total_min||((r.prep_min||0)+(r.cook_min||0))||null),r.rating?`★ ${r.rating}`:null,cookbooksOfRecipe(r.id)[0]?.name].filter(Boolean).join(' · '))}</span></span></button>`).join('')}</div>`)
    : `<div class="empty">${ic('search',34)}<b>Nothing matches that filter</b><p>Try a different filter, or add a recipe that fits.</p></div>`}
  `;
  mount(content, '#/recipes'); wireTopbar();
  $$('#main [data-filter]').forEach(b=>b.addEventListener('click',()=>{ S.browse.filter=b.dataset.filter; viewBrowse(); }));
  $$('#main [data-view]').forEach(b=>b.addEventListener('click',()=>{ S.browse.view=b.dataset.view; viewBrowse(); }));
  $('#sort-sel').addEventListener('change', e=>{ S.browse.sort=e.target.value; viewBrowse(); });
}

/* ═════════ SEARCH ═════════ */
function viewSearch(q){
  const query = q.trim();
  const rx = query ? new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'i') : null;
  const hits = [];
  if (rx) for (const r of S.recipes){
    const inTitle = rx.test(r.title);
    const ingHit = (r.ingredients||[]).find(i=>rx.test(typeof i==='string'?i:i.text||''));
    const tagHit = (r.tags||[]).find(t=>rx.test(t));
    if (inTitle || ingHit || tagHit) hits.push({ r, inTitle, match: ingHit && !inTitle ? (typeof ingHit==='string'?ingHit:ingHit.text) : null });
  }
  const inTitleCount = hits.filter(h=>h.inTitle).length;
  const cbCount = new Set(hits.flatMap(h=>cookbooksOfRecipe(h.r.id).map(c=>c.id))).size;
  const hl = s => rx ? esc(s).replace(new RegExp(rx.source,'gi'), m=>`<mark>${m}</mark>`) : esc(s);
  const content = `
  ${topbar()}
  <h2>${hits.length} result${hits.length===1?'':'s'} for “${esc(query)}”</h2>
  <p class="text-muted" style="margin-top:-6px">across ${cbCount} cookbook${cbCount===1?'':'s'} · ${inTitleCount} in title · ${hits.length-inTitleCount} in ingredients</p>
  ${hits.length ? `<div class="grid-cards">${hits.map(({r,match})=>rcard(r, match?`<span class="match-note">matches: ${hl(match)}</span>`:'' )).join('')}</div>`
    : `<div class="empty">${ic('search',34)}<b>No recipes match “${esc(query)}”</b><p>Check the spelling, or import a recipe with it.</p>
       <button class="btn btn-primary" onclick="location.hash='#/import'">${ic('plus',15)} Add a recipe</button></div>`}
  `;
  mount(content, '#/recipes'); wireTopbar();
  const gs = $('#global-search'); if (gs) gs.value = query;
}

/* ═════════ RECIPE DETAIL ═════════ */
const servingsState = {}; // recipeId -> current servings
function viewRecipe(id){
  const r = recipeById(id);
  if (!r) { location.hash = '#/recipes'; return; }
  const cbs = cookbooksOfRecipe(id);
  const base = r.servings || 4;
  const cur = servingsState[id] || base;
  const factor = cur / base;
  const ings = (r.ingredients||[]).map(i=>typeof i==='string'?i:i.text||'');
  const steps = (r.steps||[]).map(s=>typeof s==='string'?s:s.text||'');
  const totalM = r.total_min || ((r.prep_min||0)+(r.cook_min||0)) || null;

  const content = `
  <a class="backlink" href="${cbs[0]?`#/cookbook/${cbs[0].id}`:'#/recipes'}">${ic('chevL',14)} Back to ${esc(cbs[0]?.name||'all recipes')}</a>
  <div class="hero">${phDiv(r,'','')}</div>
  <div class="detail-head">
    <div style="min-width:0">
      <p class="eyebrow">${esc([cbs[0]?.name, r.cuisine].filter(Boolean).join(' · ')||'Recipe')}</p>
      <h2 style="margin-bottom:6px">${esc(r.title)}</h2>
      ${r.description?`<p class="text-muted" style="max-width:640px">${esc(r.description)}</p>`:''}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-icon btn-secondary" id="btn-fav" title="${r.favorite?'Remove from favorites':'Add to favorites'}" style="${r.favorite?'color:var(--color-accent)':''}">
        <svg class="ic" width="17" height="17" viewBox="0 0 24 24" style="${r.favorite?'fill:currentColor;':''}" aria-hidden="true">${I.heart}</svg></button>
      <button class="btn btn-secondary" id="btn-plan">${ic('cal',15)} Add to meal plan</button>
      <button class="btn btn-secondary" id="btn-shop-all">${ic('cart',15)} Add to shopping list</button>
      <button class="btn btn-ghost" id="btn-edit">${ic('pen',14)} Edit recipe</button>
    </div>
  </div>
  <div class="meta-row">
    ${r.prep_min?`<span class="meta-pill">${ic('clock',14)} Prep ${minsLabel(r.prep_min)}</span>`:''}
    ${r.cook_min?`<span class="meta-pill">${ic('flame',14)} Cook ${minsLabel(r.cook_min)}</span>`:''}
    ${!r.prep_min&&!r.cook_min&&totalM?`<span class="meta-pill">${ic('clock',14)} ${minsLabel(totalM)}</span>`:''}
    <span class="meta-pill">${ic('users',14)} Serves ${cur}</span>
    ${r.difficulty?`<span class="meta-pill">${esc(r.difficulty)}</span>`:''}
    ${r.rating?`<span class="meta-pill">★ ${r.rating}${r.times_cooked?` · ${r.times_cooked} cooks`:''}</span>`:''}
    ${(r.tags||[]).map(t=>`<span class="tag tag-accent-2">${esc(t)}</span>`).join('')}
  </div>
  <div class="detail-cols">
    <div>
      <div class="ing-head"><h3 style="margin:0">Ingredients</h3>
        <span class="stepper"><button id="serv-minus" aria-label="Fewer servings">−</button><span>${cur} servings</span><button id="serv-plus" aria-label="More servings">+</button></span>
      </div>
      <ul class="ing-list" id="ing-list">
        ${ings.map((t,i)=>`<li><input type="checkbox" id="ing-${i}" aria-label="Have it"><label for="ing-${i}" style="cursor:pointer">${esc(scaleIngredient(t,factor))}</label></li>`).join('')}
      </ul>
      <p class="pantry-note">Check what's already in your pantry · <a href="#" id="shop-rest">add the rest to shopping list</a></p>
      <button class="btn btn-sage btn-block" onclick="location.hash='#/cook/${r.id}'" ${steps.length?'':'disabled'}>${ic('play',14)} Start Cook Mode</button>
    </div>
    <div>
      <h3>Method</h3>
      <ol class="steps">${steps.map(s=>`<li><span>${esc(s)}</span></li>`).join('')||'<p class="text-muted">No steps yet — edit the recipe to add them.</p>'}</ol>
      ${r.notes?`<div class="note-card">${esc(r.notes)}</div>`:''}
      <div style="margin-top:var(--space-4)"><button class="btn btn-ghost" id="btn-notes">${ic('note',15)} Ratings & notes</button></div>
    </div>
  </div>`;
  mount(content, '#/recipes');
  $('#ing-list').addEventListener('change', e=>{ if (e.target.matches('input')) e.target.closest('li').classList.toggle('done', e.target.checked); });
  $('#serv-minus').addEventListener('click', ()=>{ servingsState[id]=Math.max(1,cur-1); viewRecipe(id); });
  $('#serv-plus').addEventListener('click', ()=>{ servingsState[id]=cur+1; viewRecipe(id); });
  $('#btn-fav').addEventListener('click', async ()=>{ await saveRecipe({ id:r.id, favorite:!r.favorite }); viewRecipe(id); });
  $('#btn-plan').addEventListener('click', ()=>openPlanPicker(r));
  $('#btn-edit').addEventListener('click', ()=>openRecipeEditor(r));
  $('#btn-notes').addEventListener('click', ()=>openNotes(r));
  const addToShop = async (only) => {
    const factorNow = (servingsState[id]||base)/base;
    let items = ings.map((t,i)=>({ t:scaleIngredient(t,factorNow), i }));
    if (only) items = items.filter(({i})=>!$(`#ing-${i}`)?.checked);
    if (!items.length) return toast('Everything is already checked off');
    await addShoppingItems(items.map(({t})=>({ name:t, recipe_id:r.id, recipe_title:r.title })));
    toast(`${items.length} item${items.length===1?'':'s'} added to your shopping list`);
  };
  $('#btn-shop-all').addEventListener('click', ()=>addToShop(false));
  $('#shop-rest').addEventListener('click', e=>{ e.preventDefault(); addToShop(true); });
}

/* ═════════ COOK MODE ═════════ */
let wakeLock = null;
async function grabWakeLock(){ try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {} }
function viewCookMode(id){
  const r = recipeById(id);
  if (!r) { location.hash='#/recipes'; return; }
  const steps = (r.steps||[]).map(s=>typeof s==='string'?s:s.text||'');
  const ings = (r.ingredients||[]).map(i=>typeof i==='string'?i:i.text||'');
  let step = 0;
  grabWakeLock();
  const draw = () => {
    const done = step >= steps.length;
    $('#app').innerHTML = `
    <div class="cookmode">
      <header>
        <span class="tag tag-accent-2">${ic('flame',13)} Cook Mode</span>
        <button class="btn btn-icon btn-secondary" id="cm-exit" aria-label="Exit cook mode">${ic('x',16)}</button>
      </header>
      <div class="progress"><i style="width:${Math.min(100,(step/steps.length)*100)}%"></i></div>
      <div class="stepbody">
        ${done ? `
          <p class="kicker">All done</p>
          <p class="steptext">That's the whole recipe. How did it turn out?</p>
          <div style="margin-top:var(--space-4);display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-primary" id="cm-log">${ic('check',15)} Log this cook</button>
            <button class="btn btn-secondary" id="cm-close2">Back to recipe</button>
          </div>`
        : `
          <p class="kicker">Step ${step+1} of ${steps.length} · ${esc(r.title)}</p>
          <p class="steptext">${esc(steps[step])}</p>
          ${ings.length?`<p class="ing-peek"><b>Keep handy:</b> ${esc(ings.slice(0,4).join(' · '))}${ings.length>4?' …':''}</p>`:''}`}
      </div>
      <footer>
        <button class="btn btn-secondary" id="cm-prev" ${step===0?'disabled':''}>${ic('chevL',15)} Back</button>
        ${!done?`<button class="btn btn-primary" id="cm-next">${step===steps.length-1?'Finish':'Next step'} ${ic('chevR',15)}</button>`:'<span></span>'}
      </footer>
    </div>`;
    $('#cm-exit').addEventListener('click', exit);
    $('#cm-prev')?.addEventListener('click', ()=>{ if(step>0){step--;draw();} });
    $('#cm-next')?.addEventListener('click', ()=>{ step++; draw(); });
    $('#cm-close2')?.addEventListener('click', exit);
    $('#cm-log')?.addEventListener('click', async ()=>{
      await db.from('cook_log').insert({ user_id:S.user.id, recipe_id:r.id });
      await saveRecipe({ id:r.id, times_cooked:(r.times_cooked||0)+1, last_cooked_at:new Date().toISOString() });
      toast('Cook logged — nice work'); exit(); openNotes(recipeById(r.id));
    });
  };
  const exit = () => { wakeLock?.release?.(); wakeLock=null; location.hash = '#/recipe/'+r.id; };
  const onKey = e => { if (e.key==='ArrowRight') $('#cm-next')?.click(); if (e.key==='ArrowLeft') $('#cm-prev')?.click(); if (e.key==='Escape') exit(); };
  document.addEventListener('keydown', onKey, { once:false });
  window.addEventListener('hashchange', ()=>document.removeEventListener('keydown', onKey), { once:true });
  draw();
}

/* ═════════ MEAL PLANNER ═════════ */
const MEALS = ['breakfast','lunch','dinner'];
function viewPlanner(){
  if (!S.weekStart) S.weekStart = mondayOf(new Date());
  const days = [...Array(7)].map((_,i)=>{ const d=new Date(S.weekStart); d.setDate(d.getDate()+i); return d; });
  const todayIso = isoDate(new Date());
  const weekIsos = days.map(isoDate);
  const weekPlan = S.plan.filter(p=>weekIsos.includes(p.date));
  const planned = weekPlan.filter(p=>p.recipe_id).length;
  const dinnerTimes = weekPlan.filter(p=>p.meal_type==='dinner'&&p.recipe_id)
    .map(p=>{ const r=recipeById(p.recipe_id); return r ? (r.total_min||((r.prep_min||0)+(r.cook_min||0))||0) : 0; }).filter(Boolean);
  const avgDinner = dinnerTimes.length ? Math.round(dinnerTimes.reduce((a,b)=>a+b,0)/dinnerTimes.length) : null;
  const vegCount = weekPlan.filter(p=>{ const r=recipeById(p.recipe_id); return r&&(r.tags||[]).some(t=>/vegetarian|vegan/i.test(t)); }).length;
  const shopPreview = {};
  for (const p of weekPlan){ const r=recipeById(p.recipe_id); if(!r) continue;
    for (const ing of (r.ingredients||[])){ const t=typeof ing==='string'?ing:ing.text||''; const a=aisleFor(t); shopPreview[a]=(shopPreview[a]||0)+1; } }
  const previewTotal = Object.values(shopPreview).reduce((a,b)=>a+b,0);
  const range = `${fmtDate(days[0])} – ${fmtDate(days[6])}`;

  const cellFor = (d, meal) => {
    const dIso = isoDate(d);
    const p = weekPlan.find(x=>x.date===dIso && x.meal_type===meal);
    const r = p?.recipe_id ? recipeById(p.recipe_id) : null;
    if (r) return `<button class="plan-cell filled" data-date="${dIso}" data-meal="${meal}" title="${escAttr(r.title)}">
      ${phDiv(r)}<span class="nm">${esc(r.title)}</span>${dIso===todayIso&&meal==='dinner'?'<span class="tag tag-accent" style="position:absolute;top:4px;right:4px">tonight</span>':''}</button>`;
    return `<button class="plan-cell" data-date="${dIso}" data-meal="${meal}" aria-label="Plan ${meal} for ${fmtDate(d)}"></button>`;
  };
  const content = `
  ${topbar()}
  <p class="eyebrow">Meal plan</p>
  <div class="plan-head">
    <h2 style="margin:0">Week of ${range}</h2>
    <div class="week-nav">
      <button class="btn btn-icon btn-secondary" id="wk-prev" aria-label="Previous week">${ic('chevL',15)}</button>
      <button class="btn btn-ghost" id="wk-today">Today</button>
      <button class="btn btn-icon btn-secondary" id="wk-next" aria-label="Next week">${ic('chevR',15)}</button>
      <button class="btn btn-primary" id="gen-shop">${ic('cart',15)} Generate shopping list from this week</button>
    </div>
  </div>
  <div class="plan-wrap">
    <div class="plan-grid">
      <span></span>
      ${days.map(d=>`<div class="dhead ${isoDate(d)===todayIso?'today':''}">${d.toLocaleDateString('en-US',{weekday:'short'})}<b>${d.getDate()}</b></div>`).join('')}
      ${MEALS.map(meal=>`<div class="mlabel">${meal}</div>${days.map(d=>cellFor(d,meal)).join('')}`).join('')}
    </div>
    <div class="plan-side">
      <div class="card elev-sm"><h5 style="margin:0 0 6px">This week</h5>
        <div class="plan-stats">
          <div class="row"><span>Meals planned</span><b>${planned} of 21</b></div>
          ${avgDinner?`<div class="row"><span>Avg. dinner time</span><b>${minsLabel(avgDinner)}</b></div>`:''}
          <div class="row"><span>Vegetarian meals</span><b>${vegCount}</b></div>
        </div></div>
      <div class="card elev-sm"><h5 style="margin:0 0 6px">Shopping preview · ${previewTotal} items</h5>
        <div class="plan-stats">
          ${Object.entries(shopPreview).map(([a,n])=>`<div class="row"><span>${esc(a)}</span><b>${n}</b></div>`).join('')||'<p class="text-muted" style="font-size:13px;margin:0">Plan meals to see what you\'ll need.</p>'}
        </div>
        <a href="#/shop" class="btn btn-secondary" style="margin-top:8px">Open shopping list</a></div>
    </div>
  </div>`;
  mount(content, '#/plan'); wireTopbar();
  $('#wk-prev').addEventListener('click', ()=>{ S.weekStart.setDate(S.weekStart.getDate()-7); viewPlanner(); });
  $('#wk-next').addEventListener('click', ()=>{ S.weekStart.setDate(S.weekStart.getDate()+7); viewPlanner(); });
  $('#wk-today').addEventListener('click', ()=>{ S.weekStart = mondayOf(new Date()); viewPlanner(); });
  $$('#main .plan-cell').forEach(c=>c.addEventListener('click', ()=>openMealPicker(c.dataset.date, c.dataset.meal)));
  $('#gen-shop').addEventListener('click', async ()=>{
    if (!weekPlan.some(p=>p.recipe_id)) return toast('Plan a few meals first');
    const items = [];
    for (const p of weekPlan){ const r=recipeById(p.recipe_id); if(!r) continue;
      for (const ing of (r.ingredients||[])){ const t=typeof ing==='string'?ing:ing.text||'';
        items.push({ name:t, recipe_id:r.id, recipe_title:r.title }); } }
    await addShoppingItems(items);
    toast(`${items.length} items added from this week's plan`);
    location.hash = '#/shop';
  });
}
function openMealPicker(dateIso, meal){
  const existing = S.plan.find(p=>p.date===dateIso && p.meal_type===meal);
  const d = new Date(dateIso+'T12:00');
  openModal(`
    <h3 class="dialog-title">${meal[0].toUpperCase()+meal.slice(1)} · ${d.toLocaleDateString('en-US',{weekday:'long', month:'short', day:'numeric'})}</h3>
    <input class="input" id="mp-search" placeholder="Search your recipes…" autocomplete="off">
    <div class="fav-list" id="mp-list" style="max-height:320px;overflow:auto"></div>
    <div class="dialog-actions">
      ${existing?.recipe_id?`<button class="btn btn-danger" id="mp-clear" style="margin-right:auto">Remove meal</button>`:''}
      <button class="btn btn-secondary" data-close>Cancel</button>
    </div>`);
  const drawList = q => {
    const rx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i') : null;
    const list = S.recipes.filter(r=>!rx||rx.test(r.title)).slice(0,30);
    $('#mp-list').innerHTML = list.map(r=>`
      <button class="fav-item" data-pick="${r.id}">${phDiv(r)}
        <span><b>${esc(r.title)}</b><span>${esc(minsLabel(r.total_min||((r.prep_min||0)+(r.cook_min||0))||null)||'')}</span></span></button>`).join('')
      || '<p class="text-muted" style="font-size:13.5px;padding:8px">No recipes match. Import one first.</p>';
    $$('#mp-list [data-pick]').forEach(b=>b.addEventListener('click', async ()=>{
      await upsertPlan(dateIso, meal, b.dataset.pick); closeModal(); viewPlanner();
    }));
  };
  drawList('');
  $('#mp-search').addEventListener('input', e=>drawList(e.target.value));
  $('#mp-clear')?.addEventListener('click', async ()=>{ await clearPlan(dateIso, meal); closeModal(); viewPlanner(); });
}

/* ═════════ SHOPPING LIST ═════════ */
function viewShopping(){
  const items = S.shopping;
  const done = items.filter(i=>i.checked).length;
  const groups = {};
  for (const it of items) (groups[it.category||'Pantry'] ||= []).push(it);
  const order = ['Produce','Meat & Fish','Dairy & Eggs','Bakery','Frozen','Pantry'];
  const aisleNames = Object.keys(groups).sort((a,b)=>(order.indexOf(a)+99)%99-(order.indexOf(b)+99)%99);
  const content = `
  ${topbar()}
  <p class="eyebrow">Shopping list</p>
  <div class="shop-head">
    <h2 style="margin:0">${items.length} item${items.length===1?'':'s'}, ${aisleNames.length} aisle${aisleNames.length===1?'':'s'}</h2>
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <span class="shop-progress"><span class="bar"><i style="width:${items.length?Math.round(done/items.length*100):0}%"></i></span> ${done} of ${items.length} done</span>
      <button class="btn btn-secondary" id="shop-clear" ${done?'':'disabled'}>Clear checked</button>
    </div>
  </div>
  ${items.length ? aisleNames.map(a=>`
    <div class="aisle">
      <h4>${esc(a)} <span>${groups[a].length} item${groups[a].length===1?'':'s'}</span></h4>
      <ul class="shop-list">
        ${groups[a].map(it=>`<li class="${it.checked?'done':''}">
          <input type="checkbox" data-id="${it.id}" ${it.checked?'checked':''} aria-label="Got it">
          <span class="nm">${esc(it.name)}</span>
          ${it.recipe_title?`<span class="src">${esc(it.recipe_title)}</span>`:''}
          <button class="rm" data-rm="${it.id}" aria-label="Remove item">${ic('x',14)}</button>
        </li>`).join('')}
      </ul>
    </div>`).join('')
  : `<div class="empty">${ic('cart',34)}<b>Your list is clear</b>
     <p>Add items below, from any recipe, or generate a list from your meal plan.</p>
     <a class="btn btn-secondary" href="#/plan">Open meal plan</a></div>`}
  <div class="shop-add">
    <input class="input" id="shop-new" placeholder="Add an item — e.g. 2 lemons" autocomplete="off">
    <button class="btn btn-primary" id="shop-addbtn">Add</button>
  </div>`;
  mount(content, '#/shop'); wireTopbar();
  $$('#main .shop-list input[type=checkbox]').forEach(cb=>cb.addEventListener('change', async ()=>{
    await toggleShopping(cb.dataset.id, cb.checked); viewShopping();
  }));
  $$('#main [data-rm]').forEach(b=>b.addEventListener('click', async ()=>{ await removeShopping([b.dataset.rm]); viewShopping(); }));
  $('#shop-clear')?.addEventListener('click', async ()=>{
    await removeShopping(S.shopping.filter(i=>i.checked).map(i=>i.id)); viewShopping();
  });
  const add = async () => {
    const v = $('#shop-new').value.trim(); if (!v) return;
    await addShoppingItems([{ name:v }]); viewShopping();
    setTimeout(()=>$('#shop-new')?.focus(), 50);
  };
  $('#shop-addbtn').addEventListener('click', add);
  $('#shop-new').addEventListener('keydown', e=>{ if (e.key==='Enter') add(); });
}

/* ═════════ IMPORT ═════════ */
let importDraft = null; // parsed recipe being reviewed
let importMode = 'url';
function viewImport(){
  const content = `
  ${topbar()}
  <p class="eyebrow">Add a recipe</p>
  <h2>Bring a recipe into MSG</h2>
  <div class="import-ways">
    <button class="way" data-mode="url" aria-pressed="${importMode==='url'}">${ic('link',26)}<b>Import from URL</b>
      <p>Paste a link from any recipe site — we pull the title, photo, ingredients and steps.</p></button>
    <button class="way" data-mode="paste" aria-pressed="${importMode==='paste'}">${ic('clip',26)}<b>Paste text</b>
      <p>Copy a recipe from anywhere — an email, a note, a message — and we'll sort it into shape.</p></button>
    <button class="way" data-mode="manual" aria-pressed="${importMode==='manual'}">${ic('pen',26)}<b>Manual entry</b>
      <p>Start from a blank page — for the family recipes that live in your head.</p></button>
  </div>
  <div class="import-pane" id="import-pane"></div>`;
  mount(content, '#/import'); wireTopbar();
  $$('#main .way').forEach(b=>b.addEventListener('click', ()=>{ importMode=b.dataset.mode; importDraft=null; viewImport(); }));
  drawImportPane();
}
function drawImportPane(){
  const pane = $('#import-pane');
  if (importDraft) return drawReview(pane);
  if (importMode==='url'){
    pane.innerHTML = `
      <div class="field"><label for="imp-url">Recipe link</label>
        <div style="display:flex;gap:8px">
          <input class="input" id="imp-url" type="url" placeholder="https://…" autocomplete="off">
          <button class="btn btn-primary" id="imp-fetch">Fetch</button>
        </div></div>
      <p class="parse-note" id="imp-status">Works with most recipe sites — we read the recipe data the site publishes.</p>`;
    const go = async () => {
      const url = $('#imp-url').value.trim();
      if (!/^https?:\/\//.test(url)) return $('#imp-status').textContent = 'Enter a full link starting with https://';
      $('#imp-status').textContent = 'Fetching and parsing…'; $('#imp-fetch').disabled = true;
      try { importDraft = await fetchRecipeFromUrl(url, m => { const el = $('#imp-status'); if (el) el.textContent = m; }); drawImportPane(); }
      catch (e){ $('#imp-status').textContent = `${e.message}. You can paste the recipe text instead.`; $('#imp-fetch').disabled = false; }
    };
    $('#imp-fetch').addEventListener('click', go);
    $('#imp-url').addEventListener('keydown', e=>{ if (e.key==='Enter') go(); });
  } else if (importMode==='paste'){
    pane.innerHTML = `
      <div class="field"><label for="imp-text">Recipe text</label>
        <textarea class="input" id="imp-text" rows="10" placeholder="Title on the first line, then ingredients and steps — headings like “Ingredients” and “Method” help, but aren't required."></textarea></div>
      <button class="btn btn-primary" id="imp-parse">Parse it</button>`;
    $('#imp-parse').addEventListener('click', ()=>{
      const t = $('#imp-text').value; if (!t.trim()) return;
      importDraft = parsePastedText(t); drawImportPane();
    });
  } else {
    importDraft = { title:'', description:'', ingredients:[''], steps:[''], servings:4, tags:[] };
    drawReview(pane, true);
  }
}
function drawReview(pane, isManual=false){
  const d = importDraft;
  pane.innerHTML = `
    ${isManual?'':`<h4 style="margin-bottom:2px">Parsed & ready to review</h4>
    <p class="parse-note">${d.source_name?`from ${esc(d.source_name)} · `:''}everything below is editable</p>`}
    <div class="form-grid" style="margin-top:var(--space-3)">
      <div class="field" style="grid-column:1/-1"><label>Title</label><input class="input" id="d-title" value="${escAttr(d.title)}"></div>
      <div class="field" style="grid-column:1/-1"><label>Description</label><textarea class="input" id="d-desc" rows="2">${esc(d.description||'')}</textarea></div>
      <div class="field"><label>Prep (min)</label><input class="input" id="d-prep" type="number" min="0" value="${d.prep_min||''}"></div>
      <div class="field"><label>Cook (min)</label><input class="input" id="d-cook" type="number" min="0" value="${d.cook_min||''}"></div>
      <div class="field"><label>Servings</label><input class="input" id="d-serv" type="number" min="1" value="${d.servings||4}"></div>
      <div class="field"><label>Cookbook</label><select class="input" id="d-cb"><option value="">None</option>
        ${S.cookbooks.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div>
      <div class="field" style="grid-column:1/-1"><label>Tags (comma separated)</label>
        <input class="input" id="d-tags" value="${escAttr((d.tags||[]).join(', '))}" placeholder="Vegetarian, Weeknight"></div>
      <div class="field" style="grid-column:1/-1"><label>Photo</label>
        <div class="photo-drop ${d.image_url?'has-img':''}" id="d-photo" ${d.image_url?`style="background-image:url('${escAttr(d.image_url)}')"`:''}>
          ${ic('camera',22)} Drop a photo here, or tap to choose</div>
        <input type="file" id="d-photo-file" accept="image/*" hidden></div>
    </div>
    <h5 style="margin-top:var(--space-4)">Ingredients · <span id="d-ing-count">${d.ingredients.length}</span></h5>
    <div class="edit-rows" id="d-ings"></div>
    <button class="btn btn-ghost" id="d-add-ing">${ic('plus',14)} Add ingredient</button>
    <h5 style="margin-top:var(--space-4)">Steps · <span id="d-step-count">${d.steps.length}</span></h5>
    <div class="edit-rows" id="d-steps"></div>
    <button class="btn btn-ghost" id="d-add-step">${ic('plus',14)} Add step</button>
    <div class="field" style="margin-top:var(--space-4)"><label>Personal note</label>
      <textarea class="input" id="d-note" rows="2" placeholder="Only you see this — swaps, timing, who loved it."></textarea></div>
    <div class="dialog-actions" style="justify-content:flex-start">
      <button class="btn btn-primary" id="d-save">Save recipe</button>
      <button class="btn btn-secondary" id="d-discard">Discard</button>
    </div>`;
  const drawRows = () => {
    $('#d-ings').innerHTML = d.ingredients.map((t,i)=>`
      <div class="row"><input class="input" data-ing="${i}" value="${escAttr(typeof t==='string'?t:t.text||'')}" placeholder="2 lb zucchini, coarsely grated">
      <button class="rm" data-rm-ing="${i}" aria-label="Remove">${ic('x',14)}</button></div>`).join('');
    $('#d-steps').innerHTML = d.steps.map((t,i)=>`
      <div class="row"><span class="idx">${i+1}</span><input class="input" data-step="${i}" value="${escAttr(typeof t==='string'?t:t.text||'')}" placeholder="What happens in this step?">
      <button class="rm" data-rm-step="${i}" aria-label="Remove">${ic('x',14)}</button></div>`).join('');
    $('#d-ing-count').textContent = d.ingredients.length;
    $('#d-step-count').textContent = d.steps.length;
    $$('#d-ings [data-ing]').forEach(inp=>inp.addEventListener('input', ()=>d.ingredients[+inp.dataset.ing]=inp.value));
    $$('#d-steps [data-step]').forEach(inp=>inp.addEventListener('input', ()=>d.steps[+inp.dataset.step]=inp.value));
    $$('#d-ings [data-rm-ing]').forEach(b=>b.addEventListener('click', ()=>{ d.ingredients.splice(+b.dataset.rmIng,1); drawRows(); }));
    $$('#d-steps [data-rm-step]').forEach(b=>b.addEventListener('click', ()=>{ d.steps.splice(+b.dataset.rmStep,1); drawRows(); }));
  };
  drawRows();
  $('#d-add-ing').addEventListener('click', ()=>{ d.ingredients.push(''); drawRows(); });
  $('#d-add-step').addEventListener('click', ()=>{ d.steps.push(''); drawRows(); });
  const drop = $('#d-photo'), fileInp = $('#d-photo-file');
  drop.addEventListener('click', ()=>fileInp.click());
  drop.addEventListener('dragover', e=>{ e.preventDefault(); drop.classList.add('dragover'); });
  drop.addEventListener('dragleave', ()=>drop.classList.remove('dragover'));
  const handleFile = async f => {
    if (!f) return;
    drop.classList.remove('dragover'); drop.textContent = 'Uploading…';
    const url = await uploadPhoto(f);
    if (url){ d.image_url = url; drop.classList.add('has-img'); drop.style.backgroundImage = `url('${url}')`; drop.innerHTML=''; }
  };
  drop.addEventListener('drop', e=>{ e.preventDefault(); handleFile(e.dataTransfer.files[0]); });
  fileInp.addEventListener('change', ()=>handleFile(fileInp.files[0]));
  $('#d-discard').addEventListener('click', ()=>{ importDraft=null; viewImport(); });
  $('#d-save').addEventListener('click', async ()=>{
    const title = $('#d-title').value.trim();
    if (!title) return toast('Give the recipe a title first');
    const rec = await saveRecipe({
      title, description: $('#d-desc').value.trim(),
      prep_min: parseInt($('#d-prep').value)||null, cook_min: parseInt($('#d-cook').value)||null,
      total_min: d.total_min || ((parseInt($('#d-prep').value)||0)+(parseInt($('#d-cook').value)||0)) || null,
      servings: parseInt($('#d-serv').value)||4,
      tags: $('#d-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
      ingredients: d.ingredients.map(t=>typeof t==='string'?t.trim():t).filter(Boolean),
      steps: d.steps.map(t=>typeof t==='string'?t.trim():t).filter(Boolean),
      image_url: d.image_url||null, source_url: d.source_url||null, source_name: d.source_name||null,
      cuisine: d.cuisine||null, notes: $('#d-note').value.trim(),
    });
    if (!rec) return;
    const cb = $('#d-cb').value;
    if (cb) await setRecipeCookbooks(rec.id, [cb]);
    importDraft = null;
    toast('Recipe saved to your kitchen');
    location.hash = '#/recipe/'+rec.id;
  });
}

/* ═════════ COOKBOOKS ═════════ */
function cbCoverStyle(c){
  if (c.cover_url) return ` style="background-image:url('${escAttr(c.cover_url)}')"`;
  const first = recipesInCookbook(c.id).find(r=>r.image_url);
  return first ? ` style="background-image:url('${escAttr(first.image_url)}')"` : '';
}
function viewCookbooks(){
  const content = `
  ${topbar()}
  <p class="eyebrow">Your shelf</p>
  <div class="detail-head"><h2 style="margin:0">Cookbooks</h2>
    <button class="btn btn-primary" id="cb-new">${ic('plus',15)} New cookbook</button></div>
  <div class="cb-grid" style="margin-top:var(--space-4)">
    ${S.cookbooks.map(c=>{
      const n = recipesInCookbook(c.id).length;
      return `<button class="cb-card"${cbCoverStyle(c)} onclick="location.hash='#/cookbook/${c.id}'">
        <span class="scrim"></span><span class="label"><b>${esc(c.name)}</b><span>${n} recipe${n===1?'':'s'}</span></span></button>`;
    }).join('')}
    <button class="cb-card newcb" id="cb-new2">${ic('plus',22)} New cookbook<br><span style="font-size:11px;opacity:.7">upload a cover image</span></button>
  </div>`;
  mount(content, '#/cookbooks'); wireTopbar();
  const openNew = ()=>openCookbookSettings(null);
  $('#cb-new').addEventListener('click', openNew);
  $('#cb-new2').addEventListener('click', openNew);
}
function viewCookbook(id){
  const c = cookbookById(id);
  if (!c){ location.hash='#/cookbooks'; return; }
  let recipes = recipesInCookbook(id);
  const f = S.browse.filter;
  if (f==='fav') recipes = recipes.filter(r=>r.favorite);
  if (f==='veg') recipes = recipes.filter(r=>(r.tags||[]).some(t=>/vegetarian|vegan/i.test(t)));
  if (f==='4plus') recipes = recipes.filter(r=>r.rating>=4);
  if (f==='quick') recipes = recipes.filter(r=>(r.total_min||((r.prep_min||0)+(r.cook_min||0)))<=30 && (r.total_min||r.prep_min||r.cook_min));
  const F = [['all','All'],['fav','Favorites'],['veg','Vegetarian'],['4plus','★ 4+'],['quick','Under 30 min']];
  const content = `
  <a class="backlink" href="#/cookbooks">${ic('chevL',14)} Back to your shelf</a>
  <div class="detail-head">
    <div><h2 style="margin-bottom:2px">${esc(c.name)}</h2>
      <p class="text-muted" style="margin:0">${recipesInCookbook(id).length} recipes${c.description?` · ${esc(c.description)}`:''}</p></div>
    <button class="btn btn-ghost" id="cb-settings">${ic('pen',14)} Cookbook settings</button>
  </div>
  <div class="filter-row">
    ${F.map(([k,l])=>`<button class="tag tag-outline" aria-pressed="${S.browse.filter===k}" data-filter="${k}">${l}</button>`).join('')}
  </div>
  ${recipes.length ? `<div class="grid-cards">${recipes.map(r=>rcard(r)).join('')}</div>`
    : `<div class="empty">${ic('book',34)}<b>No recipes here yet</b>
       <p>Assign recipes to this cookbook from the edit screen, or when importing.</p>
       <button class="btn btn-primary" onclick="location.hash='#/import'">${ic('plus',15)} Add a recipe</button></div>`}`;
  mount(content, '#/cookbooks');
  $('#cb-settings').addEventListener('click', ()=>openCookbookSettings(c));
  $$('#main [data-filter]').forEach(b=>b.addEventListener('click',()=>{ S.browse.filter=b.dataset.filter; viewCookbook(id); }));
}
function openCookbookSettings(c){
  const isNew = !c;
  openModal(`
    <h3 class="dialog-title">${isNew?'New cookbook':'Cookbook settings'}</h3>
    <div class="field"><label>Name</label><input class="input" id="cb-name" value="${escAttr(c?.name||'')}" placeholder="Weeknight Suppers"></div>
    <div class="field"><label>Description</label><textarea class="input" id="cb-desc" rows="2" placeholder="What lives in this collection?">${esc(c?.description||'')}</textarea></div>
    <div class="field"><label>Cover</label>
      <div class="photo-drop ${c?.cover_url?'has-img':''}" id="cb-photo" ${c?.cover_url?`style="background-image:url('${escAttr(c.cover_url)}')"`:''}>${ic('camera',20)} Tap to choose a cover image</div>
      <input type="file" id="cb-photo-file" accept="image/*" hidden></div>
    <div class="dialog-actions">
      ${isNew?'':`<button class="btn btn-danger" id="cb-del" style="margin-right:auto">Delete cookbook…</button>`}
      <button class="btn btn-secondary" data-close>Cancel</button>
      <button class="btn btn-primary" id="cb-save">${isNew?'Create':'Save'}</button>
    </div>`);
  let coverUrl = c?.cover_url || null;
  const drop = $('#cb-photo'), fileInp = $('#cb-photo-file');
  drop.addEventListener('click', ()=>fileInp.click());
  fileInp.addEventListener('change', async ()=>{
    const f = fileInp.files[0]; if (!f) return;
    drop.textContent = 'Uploading…';
    const url = await uploadPhoto(f);
    if (url){ coverUrl = url; drop.classList.add('has-img'); drop.style.backgroundImage=`url('${url}')`; drop.innerHTML=''; }
  });
  $('#cb-save').addEventListener('click', async ()=>{
    const name = $('#cb-name').value.trim();
    if (!name) return toast('Name the cookbook first');
    const payload = { name, description:$('#cb-desc').value.trim(), cover_url:coverUrl, user_id:S.user.id };
    const q = isNew ? db.from('cookbooks').insert(payload).select().single()
                    : db.from('cookbooks').update(payload).eq('id', c.id).select().single();
    const { data, error } = await q;
    if (error) return toast('Could not save the cookbook');
    if (isNew) S.cookbooks.push(data);
    else { const i=S.cookbooks.findIndex(x=>x.id===c.id); S.cookbooks[i]=data; }
    closeModal(); toast(isNew?'Cookbook created':'Saved'); render();
  });
  $('#cb-del')?.addEventListener('click', async ()=>{
    if (!confirm(`Delete “${c.name}”? Recipes inside stay in your collection.`)) return;
    await db.from('cookbooks').delete().eq('id', c.id);
    S.cookbooks = S.cookbooks.filter(x=>x.id!==c.id);
    S.cbLinks = S.cbLinks.filter(l=>l.cookbook_id!==c.id);
    closeModal(); location.hash='#/cookbooks'; render();
  });
}

/* ═════════ modals ═════════ */
function openModal(inner){
  $('#modal-root').innerHTML = `<div class="dialog-backdrop" id="mbk"><div class="dialog" role="dialog" aria-modal="true">${inner}</div></div>`;
  $('#mbk').addEventListener('click', e=>{ if (e.target.id==='mbk') closeModal(); });
  $$('#modal-root [data-close]').forEach(b=>b.addEventListener('click', closeModal));
  document.addEventListener('keydown', escClose);
}
function escClose(e){ if (e.key==='Escape') closeModal(); }
function closeModal(){ $('#modal-root').innerHTML=''; document.removeEventListener('keydown', escClose); }

/* — edit recipe details / categories (screen 9) — */
function openRecipeEditor(r){
  const myCbs = cookbooksOfRecipe(r.id).map(c=>c.id);
  const CUISINES = ['American','Italian','French','Mexican','Middle Eastern','Japanese','Indian','Thai','Chinese','Mediterranean'];
  const DIETARY = ['Vegetarian','Vegan','Gluten-free','Dairy-free','Low-carb'];
  const plainTags = (r.tags||[]).filter(t=>!DIETARY.includes(t));
  const dietTags = (r.tags||[]).filter(t=>DIETARY.includes(t));
  openModal(`
    <h3 class="dialog-title">Edit recipe details</h3>
    <div class="field"><label>Title</label><input class="input" id="e-title" value="${escAttr(r.title)}"></div>
    <div class="field"><label>Description</label><textarea class="input" id="e-desc" rows="2">${esc(r.description||'')}</textarea></div>
    <div class="form-grid">
      <div class="field"><label>Prep (min)</label><input class="input" id="e-prep" type="number" min="0" value="${r.prep_min||''}"></div>
      <div class="field"><label>Cook (min)</label><input class="input" id="e-cook" type="number" min="0" value="${r.cook_min||''}"></div>
      <div class="field"><label>Servings</label><input class="input" id="e-serv" type="number" min="1" value="${r.servings||4}"></div>
      <div class="field"><label>Difficulty</label><select class="input" id="e-diff">
        <option value="">—</option>${['Easy','Medium','Involved'].map(x=>`<option ${r.difficulty===x?'selected':''}>${x}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Cookbooks</label>
      <div class="filter-row" style="margin:0">${S.cookbooks.map(c=>
        `<button class="tag tag-outline" data-cb="${c.id}" aria-pressed="${myCbs.includes(c.id)}">${esc(c.name)}</button>`).join('')||'<span class="text-muted" style="font-size:13px">No cookbooks yet — create one from the shelf.</span>'}</div></div>
    <div class="field"><label>Cuisine</label>
      <div class="filter-row" style="margin:0">${CUISINES.map(x=>
        `<button class="tag tag-outline" data-cui="${x}" aria-pressed="${r.cuisine===x}">${x}</button>`).join('')}</div></div>
    <div class="field"><label>Tags (comma separated)</label>
      <input class="input" id="e-tags" value="${escAttr(plainTags.join(', '))}" placeholder="Weeknight, One-pan"></div>
    <div class="field"><label>Dietary</label>
      <div class="filter-row" style="margin:0">${DIETARY.map(x=>
        `<button class="tag tag-outline" data-diet="${x}" aria-pressed="${dietTags.includes(x)}">${x}</button>`).join('')}</div></div>
    <div class="field"><label>Ingredients (one per line)</label>
      <textarea class="input" id="e-ings" rows="6" style="border-radius:var(--radius-md)">${esc((r.ingredients||[]).map(i=>typeof i==='string'?i:i.text||'').join('\n'))}</textarea></div>
    <div class="field"><label>Steps (one per line)</label>
      <textarea class="input" id="e-steps" rows="6" style="border-radius:var(--radius-md)">${esc((r.steps||[]).map(s=>typeof s==='string'?s:s.text||'').join('\n'))}</textarea></div>
    <div class="field"><label>Photo</label>
      <div class="photo-drop ${r.image_url?'has-img':''}" id="e-photo" ${r.image_url?`style="background-image:url('${escAttr(r.image_url)}')"`:''}>${ic('camera',20)} Tap to choose a photo</div>
      <input type="file" id="e-photo-file" accept="image/*" hidden></div>
    <div class="dialog-actions">
      <button class="btn btn-danger" id="e-del" style="margin-right:auto">Delete recipe…</button>
      <button class="btn btn-secondary" data-close>Cancel</button>
      <button class="btn btn-primary" id="e-save">Save changes</button>
    </div>`);
  let imageUrl = r.image_url || null;
  const selCbs = new Set(myCbs); let cuisine = r.cuisine||null; const diet = new Set(dietTags);
  $$('#modal-root [data-cb]').forEach(b=>b.addEventListener('click', ()=>{
    const id=b.dataset.cb; selCbs.has(id)?selCbs.delete(id):selCbs.add(id);
    b.setAttribute('aria-pressed', selCbs.has(id)); }));
  $$('#modal-root [data-cui]').forEach(b=>b.addEventListener('click', ()=>{
    cuisine = cuisine===b.dataset.cui ? null : b.dataset.cui;
    $$('#modal-root [data-cui]').forEach(x=>x.setAttribute('aria-pressed', x.dataset.cui===cuisine)); }));
  $$('#modal-root [data-diet]').forEach(b=>b.addEventListener('click', ()=>{
    const t=b.dataset.diet; diet.has(t)?diet.delete(t):diet.add(t);
    b.setAttribute('aria-pressed', diet.has(t)); }));
  const drop=$('#e-photo'), fi=$('#e-photo-file');
  drop.addEventListener('click', ()=>fi.click());
  fi.addEventListener('change', async ()=>{
    const f=fi.files[0]; if(!f) return; drop.textContent='Uploading…';
    const url = await uploadPhoto(f);
    if (url){ imageUrl=url; drop.classList.add('has-img'); drop.style.backgroundImage=`url('${url}')`; drop.innerHTML=''; }});
  $('#e-save').addEventListener('click', async ()=>{
    const title=$('#e-title').value.trim(); if(!title) return toast('The recipe needs a title');
    const prep=parseInt($('#e-prep').value)||null, cook=parseInt($('#e-cook').value)||null;
    const saved = await saveRecipe({ id:r.id, title, description:$('#e-desc').value.trim(),
      prep_min:prep, cook_min:cook, total_min:(prep||0)+(cook||0)||r.total_min||null,
      servings:parseInt($('#e-serv').value)||4, difficulty:$('#e-diff').value||null, cuisine,
      tags:[...$('#e-tags').value.split(',').map(s=>s.trim()).filter(Boolean), ...diet],
      ingredients:$('#e-ings').value.split('\n').map(s=>s.trim()).filter(Boolean),
      steps:$('#e-steps').value.split('\n').map(s=>s.trim()).filter(Boolean),
      image_url:imageUrl });
    if (!saved) return;
    await setRecipeCookbooks(r.id, [...selCbs]);
    closeModal(); toast('Saved'); render();
  });
  $('#e-del').addEventListener('click', async ()=>{
    if (!confirm(`Delete “${r.title}” for good? This can't be undone.`)) return;
    if (await deleteRecipe(r.id)){ closeModal(); toast('Recipe deleted'); location.hash='#/recipes'; }
  });
}

/* — add to meal plan picker — */
function openPlanPicker(r){
  const start = mondayOf(new Date());
  const days = [...Array(14)].map((_,i)=>{ const d=new Date(start); d.setDate(d.getDate()+i); return d; });
  openModal(`
    <h3 class="dialog-title">Plan “${esc(r.title)}”</h3>
    <div class="form-grid">
      <div class="field"><label>Day</label><select class="input" id="pp-day">
        ${days.map(d=>`<option value="${isoDate(d)}" ${isoDate(d)===isoDate(new Date())?'selected':''}>${d.toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})}${isoDate(d)===isoDate(new Date())?' · today':''}</option>`).join('')}</select></div>
      <div class="field"><label>Meal</label><select class="input" id="pp-meal">
        ${MEALS.map(m=>`<option ${m==='dinner'?'selected':''}>${m}</option>`).join('')}</select></div>
    </div>
    <div class="dialog-actions">
      <button class="btn btn-secondary" data-close>Cancel</button>
      <button class="btn btn-primary" id="pp-save">Add to plan</button>
    </div>`);
  $('#pp-save').addEventListener('click', async ()=>{
    await upsertPlan($('#pp-day').value, $('#pp-meal').value, r.id);
    closeModal(); toast(`Planned for ${$('#pp-meal').value}`);
  });
}

/* — ratings & notes (screen 10) — */
async function openNotes(r){
  const { data: log } = await db.from('cook_log').select('*').eq('recipe_id', r.id).order('cooked_at',{ascending:false}).limit(12);
  let rating = r.rating || 0;
  openModal(`
    <p class="eyebrow" style="margin:0">Ratings & notes</p>
    <h3 class="dialog-title" style="margin-top:-4px">${esc(r.title)}</h3>
    <p class="text-muted" style="margin:0;font-size:13px">Cooked ${r.times_cooked||0} time${r.times_cooked===1?'':'s'}</p>
    <div class="field"><label>Your rating</label>
      <div class="stars" id="n-stars">${[1,2,3,4,5].map(i=>
        `<button data-star="${i}" class="${i<=rating?'on':''}" aria-label="${i} star${i===1?'':'s'}">${starFill(26)}</button>`).join('')}</div>
      <p class="text-muted" style="font-size:12px;margin:4px 0 0" id="n-hint">${rating?`Rated ${rating}`:'Tap a star to rate'}</p></div>
    ${log?.length?`<div class="field"><label>Cook log</label>
      <ul class="log-list">${log.map(l=>`<li><span>${new Date(l.cooked_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
        <span class="text-muted">${l.rating?`★ ${l.rating}`:''}${l.note?` · ${esc(l.note)}`:''}</span></li>`).join('')}</ul></div>`:''}
    <div class="field"><label>Kitchen notes · only you see these</label>
      <textarea class="input" id="n-notes" rows="4" placeholder="Swaps that worked, timing for your oven, who asked for seconds…">${esc(r.notes||'')}</textarea></div>
    <div class="dialog-actions">
      <button class="btn btn-secondary" data-close>Close</button>
      <button class="btn btn-primary" id="n-save">Save</button>
    </div>`);
  $$('#n-stars [data-star]').forEach(b=>b.addEventListener('click', ()=>{
    rating = +b.dataset.star;
    $$('#n-stars [data-star]').forEach(x=>x.classList.toggle('on', +x.dataset.star<=rating));
    $('#n-hint').textContent = `Rated ${rating}`;
  }));
  $('#n-save').addEventListener('click', async ()=>{
    await saveRecipe({ id:r.id, rating: rating||null, notes: $('#n-notes').value.trim() });
    closeModal(); toast('Notes saved'); render();
  });
}

/* ═════════ boot ═════════ */
async function boot(){
  const { data:{ session } } = await db.auth.getSession();
  S.user = session?.user || null;
  S.loaded = false;
  render();
}
db.auth.onAuthStateChange((_e, session)=>{
  const had = !!S.user;
  S.user = session?.user || null;
  if (!!S.user !== had){ S.loaded = false; render(); }
});
boot();
