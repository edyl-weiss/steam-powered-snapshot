/* Steam Powered Snapshot: rendering and interaction. Data lives in data.js. */
const TS_AT = Date.parse("2026-09-28T01:05:00Z");
const MP_AT = Date.parse("2026-09-27T03:15:00Z");
const SRC = {
  ts: {name:"Steam Top Sellers (US, by revenue)", at:TS_AT},
  mp: {name:"Steam most-played chart, via Steam Dashboard", at:MP_AT}
};
const REPORTED = {
  1867240: [
    {k:"All-time peak players", v:"428K+", src:"ComicBook.com report", at:"Sep 25, 2026"}
  ]
};
const PERIODS = [["now","Snapshot"],["24h","24 hours"],["7d","7 days"],["30d","30 days"],["90d","90 days"],["1y","1 year"]];
const MODES = [
  {id:"ts",label:"Top sellers"},{id:"cur",label:"Most played"},{id:"peak",label:"24h peak"},
  {id:"movers",label:"Rank movers"},{id:"weeks",label:"Chart longevity"},
  
  {id:"reviews",label:"Most reviewed"},{id:"trend",label:"Trending",na:true},
  {id:"breakout",label:"Breakout",na:true},{id:"gems",label:"Hidden gems",na:true}
];
const NA_MODE_WHY = {
  trend:"Trending needs change over time, and this page has one snapshot.",
  breakout:"Breakout compares recent activity to a past baseline, which needs history.",
  gems:"Hidden gems need review growth over time, which needs more than one snapshot of review counts."
};
const COLS = [
  {id:"rank",label:"#",cls:"rk",sort:false},
  {id:"name",label:"Game",cls:"gm l",sort:"name"},
  {id:"cur",label:"Players now",sort:"cur"},
  {id:"peak",label:"24h peak",sort:"peak"},
  {id:"score",label:"Review score",sort:"score",det:true},
  {id:"atpeak",label:"All-time peak",sort:"atpeak",det:true},
  {id:"weeks",label:"Weeks on chart",sort:"weeks"},
  {id:"ts",label:"Top seller #",sort:"ts"},
  {id:"chg",label:"Rank change",sort:"chg",tip:"Steam’s own top-seller change versus its previous chart"},
  {id:"then",label:"Rank then",sort:"then",hist:true},
  {id:"mv",label:"Move",sort:"mv",hist:true},
  {id:"price",label:"Price",sort:"price"},
  {id:"reviews",label:"Reviews",sort:"revN",det:true},
  {id:"genre",label:"Genre",det:true,l:true},
  {id:"mp",label:"Most played #",sort:"mp"},
  {id:"dev",label:"Developer",det:true,l:true},
  {id:"release",label:"Release",sort:"relTs",det:true},
  {id:"fresh",label:"Updated",sort:false}
];
const state = {period:"now", mode:"ts", q:"", sort:null, dir:-1, hideNA:false, scoreMin:0, revMin:0, tags:[], copiesMin:0, revenueMin:0, metaMin:0,
  price:null, pmin:"", pmax:"", noF2P:false,
  pmetric:"cur", pthresh:0, chart:"any", newOnly:false};

const $ = s=>document.querySelector(s);
const fmt = n=>n.toLocaleString("en-US");
const ago = t=>{const m=Math.round((Date.now()-t)/60000);
  if(m<60) return `${m} min ago`; const h=Math.round(m/60); if(h<48) return `${h} hr ago`; return `${Math.round(h/24)} days ago`;};
const stamp = t=>new Date(t).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
const esc = s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const tipFor = k=>`Source: ${SRC[k].name}. Observed. Updated ${ago(SRC[k].at)} (${stamp(SRC[k].at)}).`;
const NA_TIP = "Data unavailable: not retrievable for this snapshot. No value is estimated in its place.";
const title = g=>g.name || `App ${g.id}`;
function hue(id){return (id*47)%360}
/* Game art is loaded from Steam's image CDN. Hosts that block outside images (like the claude.ai preview) fall back to the colored initials. */
const STEAM_IMG = id=>[`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/`,`https://cdn.cloudflare.steamstatic.com/steam/apps/${id}/`];
const IMAGES_ON = !/claude\.ai|claudeusercontent|anthropic/.test(location.hostname);
function thumb(id,file){ if(!IMAGES_ON) return ""; const [a,b]=STEAM_IMG(id);
  const alt = file==="header.jpg" ? "" : `${b}header.jpg`;
  return `<img src="${a}${file}" data-fb="${b}${file}" data-fb2="${alt||a+'header.jpg'}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`; }
document.addEventListener("error",e=>{ const im=e.target; if(!(im instanceof HTMLImageElement)) return;
  if(im.dataset.fb){ const n=im.dataset.fb; delete im.dataset.fb; im.src=n; return; }
  if(im.dataset.fb2){ const n=im.dataset.fb2; delete im.dataset.fb2; im.src=n; return; }
  const box=im.closest(".banner"); im.remove(); if(box) box.remove(); }, true);
const ALL_TAGS = [...new Set(Object.values(ENRICH).flatMap(e=>e.tags||[]))].filter(t=>!["DLC","Software"].includes(t)).sort().concat(["Software","DLC"]);
const fmtS = n=>{ if(n==null) return ""; const a=Math.abs(n);
  if(a>=1e9) return (n/1e9).toFixed(n>=1e10?0:1).replace(/\.0$/,"")+"B";
  if(a>=1e6) return (n/1e6).toFixed(n>=1e7?0:1).replace(/\.0$/,"")+"M";
  if(a>=1e3) return (n/1e3).toFixed(n>=1e4?0:1).replace(/\.0$/,"")+"K"; return String(Math.round(n)); };
const fmtM = n=>"$"+fmtS(n);
const fmtDate = s=>{ if(!s) return ""; const d=new Date(s+"T00:00:00Z"); return d.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}); };
for(const g of DATA){ const e=ENRICH[g.id]; if(!e) continue; g.e=e;
  if(e.reviews){ g.revN=e.reviews.n; g.score=e.reviews.pct; }
  if(e.rev30) g.rev30V=e.rev30.v;
  g.tags=e.tags||[];
  if(e.meta) g.meta=e.meta;
  if(e.peak) g.atpeak=e.peak.v;
  if(e.copies&&e.copies.v) g.copiesV=e.copies.v;
  if(e.revenue&&e.revenue.v) g.revV=e.revenue.v;
  if(e.owners&&e.owners.v) g.ownersV=e.owners.v;
  if(e.release) g.relTs=Date.parse(e.release);
  g.dev=e.dev; g.pub=e.pub; }
for(const g of DATA){ if(!g.tags) g.tags=[]; }
function genreTip(g){ return (g.e&&g.e.genre?`Detail: ${g.e.genre}. `:"")+"Broad genre tags assigned by hand from Steam store categories and press descriptions, for filtering. Not live store tags."; }
function estTip(o, money){ const f=money?fmtM:fmtS; const parts=[];
  if(o.v) parts.push(`Estimate: ${money?"":"~"}${f(o.v)} from ${o.src}, ${o.at}.`);
  if(o.lo!=null) parts.push(`Range across sources: ${f(o.lo)} to ${f(o.hi)} (${o.rangeSrc}).`);
  if(o.floor) parts.push(o.floor+".");
  if(o.note) parts.push(o.note);
  if(o.conf==="single") parts.push("Only one estimate was found, so it couldn’t be cross-checked.");
  if(o.conf==="low") parts.push("The source rates this estimate as low confidence.");
  return parts.join(" "); }
function estCell(o, money, altNote){
  if(!o){ return altNote ? `<span class="dn" data-tip="${esc(altNote)}">Not applicable</span>` : null; }
  const f=money?fmtM:fmtS;
  if(o.floorOnly) return `<span data-tip="${esc(estTip(o,money))}"><span class="estv">${f(o.floorV)}+</span><span class="estr">publisher figure</span></span>`;
  const main = o.v ? `<span class="estv">~${f(o.v)}</span>` : `<span class="estv rng">${f(o.lo)}–${f(o.hi)}</span>`;
  const sub = (o.v && o.lo!=null) ? `<span class="estr">${f(o.lo)}–${f(o.hi)}</span>` : o.conf==="low" ? `<span class="estr">low confidence</span>` : (o.conf==="single" ? `<span class="estr">1 source</span>` : (o.floor?`<span class="estr">+ publisher figure</span>`:""));
  if(!o.v && o.lo==null) return `<span class="dn" data-tip="${esc(estTip(o,money))}">Disputed</span>`;
  return `<span data-tip="${esc(estTip(o,money))}">${main}${sub}</span>`; }
function mono(g){const w=title(g).replace(/[^A-Za-z0-9 ]/g,"").split(/\s+/).filter(Boolean);return (w.length>1?w.slice(0,3).map(x=>x[0]).join(""):(w[0]||"?").slice(0,3)).toUpperCase()}

function renderFresh(){
  $("#fresh").innerHTML =
   `<span><span class="dot"></span>Top sellers <strong>updated ${ago(TS_AT)}</strong>, ${stamp(TS_AT)}</span>`+
   `<span><span class="dot"></span>Player counts <strong>updated ${ago(MP_AT)}</strong>, ${stamp(MP_AT)}</span>`+
   `<span>Next scheduled refresh: none. This page doesn’t refresh.</span>`;
}
function segs(el, items, cur, onpick){
  el.innerHTML = items.map(([id,l,na])=>`<button type="button" data-id="${id}" class="${na?"na":""}" aria-pressed="${id===cur}">${l}</button>`).join("");
  el.onclick = e=>{const b=e.target.closest("button"); if(b) onpick(b.dataset.id)};
}
function renderControls(){
  segs($("#periods"), PERIODS.map(([id,l])=>[id,l,!["now","7d","30d"].includes(id)]), state.period, id=>{state.period=id;renderControls();renderTable()});
  segs($("#modes"), MODES.map(m=>[m.id,m.label,m.na]), state.mode, id=>{state.mode=id;state.sort=null;renderControls();renderTable()});
}
const PRICE_Q = [["free","Free"],["u10","Under $10"],["10-20","$10–$20"],["20-40","$20–$40"],["40-60","$40–$60"],["60+","$60+"]];
const PLAYER_Q = [0,100,1000,5000,10000,50000,100000];
function chipset(key, opts){return `<div class="chips">`+opts.map(([v,l])=>`<button type="button" class="chip" data-k="${key}" data-v="${v}" aria-pressed="${String(state[key])===String(v)}">${l}</button>`).join("")+`</div>`}
function renderFilters(){
  $("#filters").innerHTML = `<div class="fgrid">
   <div class="fgroup"><h3>Narrow by price</h3>${chipset("price",[["null","Any"],...PRICE_Q])}
     <div class="custom">Custom $<input id="pmin" inputmode="decimal" placeholder="min" value="${state.pmin}"> to $<input id="pmax" inputmode="decimal" placeholder="max" value="${state.pmax}"></div>
     <label class="chk"><input type="checkbox" id="noF2P" ${state.noF2P?"checked":""}> Exclude free-to-play games</label></div>
   <div class="fgroup"><h3>Narrow by players</h3>${chipset("pmetric",[["cur","Players now"],["peak","24h peak"]])}
     <div style="height:8px;padding:0"></div>${chipset("pthresh",PLAYER_Q.map(v=>[v,v?fmtK(v)+"+":"Any"]))}</div>
   <div class="fgroup"><h3>Narrow by chart</h3>${chipset("chart",[["any","Either chart"],["ts","Top sellers"],["mp","Most played"],["both","On both"]])}
     <label class="chk"><input type="checkbox" id="newOnly" ${state.newOnly?"checked":""}> New chart entries only</label></div>
   <div class="fgroup"><h3>Narrow by genre</h3><div class="chips">${[["","Any"],...ALL_TAGS.map(t=>[t,t])].map(([v,l])=>`<button type="button" class="chip" data-tag="${esc(v)}" aria-pressed="${v?state.tags.includes(v):!state.tags.length}">${l}</button>`).join("")}</div></div>
   <div class="fgroup"><h3>Narrow by review score</h3>${chipset("scoreMin",[[0,"Any"],[95,"95%+"],[90,"90%+"],[80,"80%+"],[70,"70%+"]])}</div>
   <div class="fgroup"><h3>Narrow by review count</h3>${chipset("revMin",[[0,"Any"],[1000,"1K+"],[10000,"10K+"],[100000,"100K+"],[1000000,"1M+"]])}</div>
  </div>
  <div class="unavail">Genre tags cover ${DATA.filter(g=>g.tags.length).length} of ${DATA.length} games, and you can pick more than one. Review filters only match games with sourced review data. Not available in this snapshot:
   <ul><li>Reviews added in period</li></ul></div>`;
  $("#filters").onclick = e=>{const c=e.target.closest(".chip"); if(!c) return;
    if(c.dataset.tag!==undefined){ const t=c.dataset.tag; if(!t) state.tags=[]; else state.tags = state.tags.includes(t)? state.tags.filter(x=>x!==t) : [...state.tags,t]; renderFilters(); renderTable(); return; }
    const k=c.dataset.k, v=c.dataset.v;
    state[k] = (k==="price") ? (v==="null"?null:v) : (k==="pmetric"||k==="chart") ? v : Number(v);
    if(k==="price"){state.pmin="";state.pmax=""}
    renderFilters(); renderTable();};
  $("#pmin").oninput=e=>{state.pmin=e.target.value;state.price=null;renderTable()};
  $("#pmax").oninput=e=>{state.pmax=e.target.value;state.price=null;renderTable()};
  for(const id of ["noF2P","newOnly"]) $("#"+id).onchange=e=>{state[id]=e.target.checked;renderTable()};
}
function fmtK(v){return v>=1000? (v/1000)+"K" : String(v)}

function passes(g){
  if(state.q){const q=state.q.toLowerCase(); if(!(title(g).toLowerCase().includes(q)||String(g.id).includes(q)||(g.dev||"").toLowerCase().includes(q)||(g.pub||"").toLowerCase().includes(q))) return false;}
  const hasP = g.price!==undefined;
  if(state.price){ if(!hasP) return false; const p=g.price, f=g.free;
    if(state.price==="free"&&!f) return false;
    if(state.price==="u10"&&(f||p>=10)) return false;
    if(state.price==="10-20"&&(p<10||p>20)) return false;
    if(state.price==="20-40"&&(p<20||p>40)) return false;
    if(state.price==="40-60"&&(p<40||p>60)) return false;
    if(state.price==="60+"&&p<60) return false; }
  const mn=parseFloat(state.pmin), mx=parseFloat(state.pmax);
  if(!isNaN(mn)&&(!hasP||g.price<mn)) return false;
  if(!isNaN(mx)&&(!hasP||g.price>mx)) return false;
  if(state.noF2P&&g.free) return false;
  if(state.pthresh){const v=g[state.pmetric]; if(v===undefined||v<state.pthresh) return false;}
  if(state.chart==="ts"&&!g.ts) return false;
  if(state.chart==="mp"&&!g.mp) return false;
  if(state.chart==="both"&&!(g.ts&&g.mp)) return false;
  if(state.newOnly&&!g.isNew) return false;
  if(state.scoreMin&&!(g.score>=state.scoreMin)) return false;
  if(state.revMin&&!(g.revN>=state.revMin)) return false;
  if(state.tags.length && !state.tags.some(t=>g.tags.includes(t))) return false;
  return true;
}
function modeList(list){
  const m=state.mode;
  if(m==="ts") return list.filter(g=>g.ts).sort((a,b)=>a.ts-b.ts);
  if(m==="cur") return list.filter(g=>g.cur).sort((a,b)=>b.cur-a.cur);
  if(m==="peak") return list.filter(g=>g.peak).sort((a,b)=>b.peak-a.peak);
  if(m==="movers") return list.filter(g=>typeof g.chg==="number").sort((a,b)=>b.chg-a.chg||a.ts-b.ts);
  if(m==="weeks") return list.filter(g=>g.weeks).sort((a,b)=>b.weeks-a.weeks);
  if(m==="copies") return list.filter(g=>g.copiesV).sort((a,b)=>b.copiesV-a.copiesV);
  if(m==="rev") return list.filter(g=>g.revV).sort((a,b)=>b.revV-a.revV);
  if(m==="reviews") return list.filter(g=>g.revN).sort((a,b)=>b.revN-a.revN);
  if(m==="rev30") return list.filter(g=>g.rev30V).sort((a,b)=>b.rev30V-a.rev30V);
  return [];
}
function sortBy(list){
  if(!state.sort) return list;
  const k=state.sort, d=state.dir;
  return [...list].sort((a,b)=>{
    let x=a[k], y=b[k];
    if(k==="then"||k==="mv"){const w=weekFor(); const f=g=>{const r=w.rank[g.id]; if(!r) return undefined; return k==="then"?r:(g.ts?r-g.ts:undefined)}; x=f(a); y=f(b);}
    if(k==="name"){x=title(a).toLowerCase();y=title(b).toLowerCase(); return x<y?-d:x>y?d:0}
    const ax=x===undefined||x===null, by=y===undefined||y===null;
    if(ax&&by) return 0; if(ax) return 1; if(by) return -1;
    return (x-y)*d;});
}
function activeCols(){ return COLS.filter(c=>!c.hist||PERIOD_WEEK[state.period]); }
function renderHead(){
  $("#thead").innerHTML = activeCols().map(c=>{
    const s = state.sort===c.sort && c.sort ? (state.dir<0?"descending":"ascending") : null;
    const cls=[c.cls||"", c.det?"na-col":"", !c.sort?"nosort":"", c.l?"l":""].join(" ");
    return `<th scope="col" class="${cls}" data-sort="${c.sort||""}" ${s?`aria-sort="${s}"`:""} ${c.na?`data-tip="${esc(NA_TIP)}"`:c.hist?`data-tip="${esc(histTip())}"`:c.tip?`data-tip="${esc(c.tip)}"`:""}>${c.label}</th>`;}).join("");
}
$("#thead").onclick = e=>{const th=e.target.closest("th"); if(!th||!th.dataset.sort) return;
  const k=th.dataset.sort; if(state.sort===k) state.dir*=-1; else {state.sort=k; state.dir=(k==="name"||k==="ts"||k==="mp")?1:-1;}
  renderTable();};

function weekFor(){ return WEEKS.find(w=>w.key===PERIOD_WEEK[state.period]); }
function histTip(){ const w=weekFor(); return w? "Rank in Steam’s US weekly chart, week of "+w.full : ""; }
const dn = `<span class="dn" data-tip="${esc(NA_TIP)}">Data unavailable</span>`;
function cell(g,c,i,maxCur){
  const tsTip=`data-tip="${esc(tipFor("ts"))}"`, mpTip=`data-tip="${esc(tipFor("mp"))}"`;
  switch(c.id){
    case "rank": return `<td class="rk"><span class="rknum">${i+1}</span></td>`;
    case "name": {
      const nm = g.name ? (g.nameSrc==="ref" ? `<span class="ref" data-tip="Title matched from Steam App ${g.id} by reference. The source chart listed only the ID.">${esc(g.name)}</span>` : esc(g.name)) : `App ${g.id}`;
      const meta = g.name ? `App ${g.id}` : `<span data-tip="The source chart listed this game by App ID only.">Title not in source</span>`;
      return `<td class="gm"><div class="game"><span class="mono" aria-hidden="true" style="background:hsl(${hue(g.id)} 28% 30%)">${esc(mono(g))}${thumb(g.id,"capsule_231x87.jpg")}</span><div><div class="gname">${nm}</div><div class="gmeta">${meta}</div></div></div></td>`;}
    case "chg":
      if(!g.ts) return `<td>${dn}</td>`;
      if(g.isNew) return `<td ${tsTip}><span class="new">New</span></td>`;
      if(g.chg>0) return `<td ${tsTip}><span class="up">▲ ${g.chg}</span></td>`;
      if(g.chg<0) return `<td ${tsTip}><span class="down">▼ ${-g.chg}</span></td>`;
      return `<td ${tsTip}>0</td>`;
    case "ts": return g.ts? `<td ${tsTip}>${g.ts}</td>` : `<td><span class="dn" data-tip="Not in Steam’s top 100 sellers at snapshot time.">Not in top 100</span></td>`;
    case "then": { const w=weekFor(); const r=w.rank[g.id];
      return r? `<td data-tip="${esc(WEEK_SRC+" Week of "+w.full+".")}">#${r}</td>` : `<td><span class="dn" data-tip="Not in that week’s top 20. Positions 21 to 100 weren’t captured.">Not in top 20</span></td>`; }
    case "mv": { const w=weekFor(); const r=w.rank[g.id];
      if(!r||!g.ts) return `<td><span class="dn" data-tip="Can’t compare: the game wasn’t in the captured part of both charts.">Unknown</span></td>`;
      const d=r-g.ts; return `<td data-tip="${esc("From #"+r+" in the week of "+w.full+" to #"+g.ts+" on the live chart.")}">${d>0?`<span class="up">▲ ${d}</span>`:d<0?`<span class="down">▼ ${-d}</span>`:"0"}</td>`; }
    case "price":
      if(g.price===undefined) return `<td>${dn}</td>`;
      if(g.free) return `<td class="pc" ${tsTip}>Free to Play</td>`;
      return `<td class="pc" data-tip="${esc("Regular US price on Steam, without any sale discount. "+tipFor("ts"))}">$${g.price.toFixed(2)}</td>`;
    case "cur": return g.cur? `<td ${mpTip}>${fmt(g.cur)}<span class="bar"><i style="width:${Math.max(2,g.cur/maxCur*100)}%"></i></span></td>` : `<td>${dn}</td>`;
    case "peak": return g.peak? `<td ${mpTip}>${fmt(g.peak)}</td>` : `<td>${dn}</td>`;
    case "mp": return g.mp? `<td ${mpTip}>${g.mp}</td>` : `<td><span class="dn" data-tip="Not in Steam’s top 100 most played at snapshot time.">Not in top 100</span></td>`;
    case "weeks": return g.weeks? `<td ${tsTip}>${fmt(g.weeks)}</td>` : `<td>${dn}</td>`;
    case "fresh": {const t = g.ts&&g.mp ? Math.min(TS_AT,MP_AT) : g.ts?TS_AT:MP_AT;
      return `<td class="fr" data-tip="${esc((g.ts?tipFor("ts")+" ":"")+(g.mp?tipFor("mp"):""))}">${ago(t).replace(" ago","")}</td>`;}
    case "reviews": { const r=g.e&&g.e.reviews&&g.e.reviews.n?g.e.reviews:null; return `<td class="na-col">${r?`<span data-tip="${esc(`Reported from Steam by ${r.src}, ${r.at}.`)}">${r.approx?"~":""}${fmtS(r.n)}</span>`:dn}</td>`; }
    case "score": { const r=g.e&&g.e.reviews&&g.e.reviews.pct!=null?g.e.reviews:null; return `<td class="na-col">${r?`<span class="${r.pct>=80?"up":r.pct<60?"down":""}" data-tip="${esc(`Share of positive Steam reviews, via ${r.pctSrc||(r.src+", "+r.at)}.`)}">${r.approx?"~":""}${r.pct}%</span>`:dn}</td>`; }
    case "meta": return `<td class="na-col">${g.meta?`<span data-tip="${esc(g.e.metaSrc)}">${g.meta}</span>`:dn}</td>`;
    case "atpeak": { const p=g.e&&g.e.peak; return `<td class="na-col">${p?`<span data-tip="${esc(`${p.src}, ${p.at}.`+(p.tracked?" This is the highest count SteamPulse has recorded, so it can miss records set before its tracking began.":""))}">${fmt(p.v)}${p.tracked?'<span class="estr">tracked peak</span>':""}</span>`:dn}</td>`; }
    case "rev30": { const x=g.e&&estCell(g.e.rev30,true); return `<td class="na-col">${x||dn}</td>`; }
    case "copies": { const x=g.e&&estCell(g.e.copies,false); return `<td class="na-col">${x||dn}</td>`; }
    case "revenue": { const x=g.e&&estCell(g.e.revenue,true,g.e.revenueNote); return `<td class="na-col">${x||dn}</td>`; }
    case "owners": { const x=g.e&&estCell(g.e.owners,false); return `<td class="na-col">${x||(g.free?dn:`<span class="dn" data-tip="Owner estimates are shown for free-to-play games, where copies sold doesn’t apply.">Not applicable</span>`)}</td>`; }
    case "genre": return `<td class="na-col l">${g.tags.length?`<span data-tip="${esc(genreTip(g))}">${esc(g.tags.join(", "))}</span>`:`<span class="dn" data-tip="No reliable store or press description was found for this new release, so it wasn’t tagged rather than guessed.">Not yet tagged</span>`}</td>`;
    case "dev": return `<td class="na-col l">${g.dev?esc(g.dev):dn}</td>`;
    case "release": return `<td class="na-col">${g.e&&g.e.release?`<span data-tip="${esc(g.e.releaseNote||"Steam release date")}">${fmtDate(g.e.release)}</span>`:dn}</td>`;
    default: return `<td class="na-col${c.l?" l":""}">${dn}</td>`;
  }
}
function renderTable(){
  $("#t").classList.toggle("hide-na", state.hideNA);
  renderHead();
  const tb=$("#tb");
  const span=activeCols().length;
  const cav=$("#caveat");
  if(PERIOD_WEEK[state.period]){ const w=weekFor();
    cav.hidden=false; cav.textContent=`Comparing the live chart on Sep 28 with Steam’s weekly chart for ${w.full}. The weekly chart ranks a full week’s revenue and the live chart a shorter rolling window, so treat moves as direction, not precise change. Only that week’s top 20 could be read.`;
  } else cav.hidden=true;
  if(state.period!=="now" && !PERIOD_WEEK[state.period]){
    const p=PERIODS.find(x=>x[0]===state.period)[1].toLowerCase();
    const why = state.period==="1y" ? "Steam’s year-end lists group the top 12 without ranking them, so there’s no rank from a year ago to compare with. See Year by year below for who made the top 12 each year." : state.period==="90d" ? "No chart from about 90 days ago could be found and checked." : "Steam doesn’t publish a daily chart, and no snapshot from 24 hours ago was captured.";
    tb.innerHTML=`<tr><td colspan="${span}" class="empty l"><b>No ${p} comparison available</b>${why} Try 7 days or 30 days.</td></tr>`;
    $("#count").textContent=""; return;
  }
  const mode=MODES.find(m=>m.id===state.mode);
  if(mode.na){
    tb.innerHTML=`<tr><td colspan="${span}" class="empty l"><b>${mode.label}: data unavailable</b>${NA_MODE_WHY[mode.id]} Rather than show a made-up ranking, this view stays empty. Try Top sellers or Most played.</td></tr>`;
    $("#count").textContent=""; return;
  }
  const list = sortBy(modeList(DATA.filter(passes)));
  if(state.mode==="reviews" && state.period==="now"){ cav.hidden=false;
    cav.textContent = state.mode==="rev30" ? `Ranked by Raijin’s estimate of Steam revenue over the 30 days to Sep 28, for the ${DATA.filter(g=>g.rev30V).length} charting games it covers. Raijin rates many of these as low confidence, and they’re marked.` : state.mode==="reviews" ? `Ranked by total Steam reviews for the ${DATA.filter(g=>g.revN).length} games with sourced review data. Counts come from different dates, and review growth over a period can’t be measured from one snapshot.`
      : `Only the ${DATA.filter(g=>state.mode==="copies"?g.copiesV:g.revV).length} games with a sourced estimate are ranked. Estimates come from different firms and dates, and they often disagree, so hover or tap a figure for its source and range.`; }
  const maxCur = Math.max(...DATA.map(g=>g.cur||0));
  $("#count").textContent = `${list.length} game${list.length===1?"":"s"}`;
  if(!list.length){tb.innerHTML=`<tr><td colspan="${span}" class="empty l"><b>No games match these filters</b>Loosen a filter or clear the search to see more.</td></tr>`;return;}
  tb.innerHTML = list.map((g,i)=>`<tr data-id="${g.id}" tabindex="0">${activeCols().map(c=>cell(g,c,i,maxCur)).join("")}</tr>`).join("");
}
$("#tb").onclick = e=>{const tr=e.target.closest("tr[data-id]"); if(tr) openSheet(+tr.dataset.id)};
$("#tb").onkeydown = e=>{if(e.key==="Enter"){const tr=e.target.closest("tr[data-id]"); if(tr) openSheet(+tr.dataset.id)}};

function mrow(k,v,kind,src){
  const tag = kind==="obs"?`<span class="tag obs">Observed</span>`:kind==="rep"?`<span class="tag rep">Reported</span>`:kind==="est"?`<span class="tag est">Estimate</span>`:`<span class="tag na">Data unavailable</span>`;
  return `<div class="mrow"><span class="k">${k}</span><span class="v">${v}</span><span class="src">${tag}${src}</span></div>`;
}
let lastFocus=null;
function openSheet(id){
  let g=DATA.find(x=>x.id===id); lastFocus=document.activeElement;
  if(!g) g={id, name:EXTRA_NAMES[id]||null, nameSrc:"chart"};
  const ts=s=>`${SRC.ts.name}. Updated ${ago(TS_AT)}.`, mp=`${SRC.mp.name}. Updated ${ago(MP_AT)}.`;
  const NA="Data unavailable", naSrc="Not retrievable for this snapshot.";
  let h=`<button class="btn close" data-close>Close</button><div class="gmeta">App ${g.id}${g.nameSrc==="ref"?", title matched by reference":""}</div><h2 id="sh-title">${esc(title(g))}</h2>`;
  if(IMAGES_ON) h+=`<div class="banner">${thumb(g.id,"header.jpg")}</div>`;
  h+=`<p class="note" style="margin-top:6px"><a href="https://store.steampowered.com/app/${g.id}/" target="_blank" rel="noopener">Open on Steam</a></p>`;
  if(HARDWARE.has(g.id)) h+=`<p class="note">This is hardware, not a game. Steam counts it on its top-sellers chart.</p>`;
  h+= g.ts? mrow("Top seller rank", "#"+g.ts,"obs",ts()) : mrow("Top seller rank","Not in top 100","obs",ts());
  if(g.ts){
    h+=mrow("Rank change", g.isNew?"New entry":g.chg>0?`Up ${g.chg}`:g.chg<0?`Down ${-g.chg}`:"No change","obs",ts());
    h+=mrow("Weeks on chart", fmt(g.weeks),"obs",ts());
    h+=mrow("Regular price", g.free?"Free to play":`$${g.price.toFixed(2)}`,"obs","Regular US price, without any sale discount. "+ts());
  } else {
    h+=mrow("Price",NA,"na",naSrc);
  }
  h+= g.cur? mrow("Players now", fmt(g.cur),"obs",mp) : mrow("Players now",NA,"na","Not in the top 100 most played at snapshot time.");
  h+= g.peak? mrow("24h peak players", fmt(g.peak),"obs",mp) : mrow("24h peak players",NA,"na","Not in the top 100 most played at snapshot time.");
  if(g.mp) h+=mrow("Most played rank","#"+g.mp,"obs",mp);
  const wk=WEEKS.map(w=>w.rank[g.id]?`${w.label}: #${w.rank[g.id]}`:`${w.label}: not in top 20`);
  h+=mrow("Weekly US chart, last 4 weeks", `<span style="font-weight:600;font-size:13px">${wk.join("<br>")}</span>`,"obs",WEEK_SRC);
  const yr=YROWS.find(r=>r.id===g.id);
  h+= yr ? mrow("Steam year-end top 12 by revenue", yr.y.join(", "),"rep",`Cross-checked press coverage of Steam’s Best of lists. ${yr.note||""}`) : mrow("Steam year-end top 12 by revenue","None, 2020 to 2025","rep","Not in any cross-checked top 12 list from 2020 to 2025.");
  for(const r of (REPORTED[g.id]||[])) h+=mrow(r.k, r.v, "rep", `${r.src}, ${r.at}. Not Steam data.`);
  const e=g.e||{};
  const erow=(k,o,money)=>{ if(!o) return mrow(k,NA,"na",naSrc);
    const f=money?fmtM:fmtS; const v=o.v?`~${f(o.v)}`:(o.lo!=null?`${f(o.lo)}–${f(o.hi)}`:"Disputed");
    return mrow(k,v,"est",estTip(o,money)); };
  h+= e.dev? mrow("Developer",esc(e.dev),"rep","Store metadata, via third-party trackers.") : mrow("Developer",NA,"na",naSrc);
  h+= e.pub? mrow("Publisher",esc(e.pub),"rep","Store metadata, via third-party trackers.") : mrow("Publisher",NA,"na",naSrc);
  h+= e.release? mrow("Release date",fmtDate(e.release),"rep",esc(e.releaseNote||"Steam release date.")) : mrow("Release date",NA,"na",naSrc);
  h+= g.tags.length? mrow("Genre tags",esc(g.tags.join(", ")),"rep",esc(genreTip(g))) : mrow("Genre tags","Not yet tagged","na","No reliable description found for this new release.");
  const rv=e.reviews;
  h+= rv&&rv.n? mrow("Steam reviews",`${rv.approx?"~":""}${fmt(rv.n)}`,"rep",`${esc(rv.src)}, ${esc(rv.at)}. Read from Steam by a third party.`) : mrow("Steam reviews",NA,"na",naSrc);
  h+= rv&&rv.pct!=null? mrow("Review score",`${rv.pct}% positive`,"rep",esc(rv.pctSrc||(rv.src+", "+rv.at))+".") : mrow("Review score",NA,"na",naSrc);
  if(!REPORTED[g.id]) h+= e.peak? mrow(e.peak.tracked?"Tracked peak players":"All-time peak players",fmt(e.peak.v),"rep",`${esc(e.peak.src)}, ${esc(e.peak.at)}.`+(e.peak.tracked?" May miss records set before tracking began.":"")) : mrow("All-time peak players",NA,"na",naSrc);
  if(e.xplat){ const x=e.xplat; const v = x.lo!=null ? `${fmtS(x.lo)}–${fmtS(x.hi)}` : "See note";
    h+= mrow("Players, all platforms", x.lo!=null ? `${v} ${esc(x.unit.split(",")[0])}` : v, "est", `${esc(x.src)}, ${esc(x.at)}. ${x.floor?esc(x.floor)+". ":""}${x.note?esc(x.note):""}`); }
  h+=`<p class="note">Steam ranks top sellers by revenue, not units, so chart position isn’t a copies-sold figure. Review, peak and genre details come from third-party trackers, each labeled with its source and date.</p>`;
  $("#card").innerHTML=h;
  $("#sheet").classList.add("on"); $("#sheet").setAttribute("aria-hidden","false");
  $("#card .close").focus();
}
function closeSheet(){ $("#sheet").classList.remove("on"); $("#sheet").setAttribute("aria-hidden","true"); if(lastFocus) lastFocus.focus(); }
$("#sheet").onclick=e=>{ if(e.target.closest("[data-close]")) closeSheet(); };
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&$("#sheet").classList.contains("on")) closeSheet(); });

// tooltip (hover on desktop; tap shows details sheet instead)
const tip=$("#tip");
document.addEventListener("mouseover",e=>{const el=e.target.closest("[data-tip]"); if(!el){tip.classList.remove("on");return}
  tip.textContent=el.dataset.tip; const r=el.getBoundingClientRect();
  tip.style.left=Math.min(window.innerWidth-270,Math.max(8,r.left))+"px";
  tip.style.top=(r.bottom+6+120>window.innerHeight? r.top-6-tip.offsetHeight : r.bottom+6)+"px";
  tip.classList.add("on");});
document.addEventListener("scroll",()=>tip.classList.remove("on"),true);

$("#q").oninput=e=>{state.q=e.target.value.trim();renderTable()};
$("#natoggle").onclick=e=>{state.hideNA=!state.hideNA; e.currentTarget.textContent=state.hideNA?"Show detail columns":"Hide detail columns"; e.currentTarget.setAttribute("aria-pressed",String(!state.hideNA)); renderTable();};
$("#natoggle").textContent="Hide detail columns"; $("#natoggle").setAttribute("aria-pressed","true");

// ---------- history rendering ----------
function nameOf(id){ const g=DATA.find(x=>x.id===id); return g?title(g):(EXTRA_NAMES[id]||`App ${id}`); }
function tcls(r){ return r===1?"t1":r<=5?"t5":r<=10?"t10":"t20"; }
function renderWeeks(){
  const ids=new Set(); WEEKS.forEach(w=>w.ids.forEach(i=>ids.add(i)));
  DATA.filter(g=>g.ts&&g.ts<=20).forEach(g=>ids.add(g.id));
  const rows=[...ids].map(id=>{const g=DATA.find(x=>x.id===id); const rs=WEEKS.map(w=>w.rank[id]); const now=g&&g.ts;
    const best=Math.min(...rs.filter(Boolean), now||999); return {id,rs,now,best};}).sort((a,b)=>a.best-b.best||nameOf(a.id).localeCompare(nameOf(b.id)));
  $("#wkh").innerHTML=`<th class="gm l" scope="col">Game</th>`+WEEKS.map(w=>`<th scope="col" data-tip="${esc("Week of "+w.full+". "+WEEK_SRC)}">Week of ${w.label}</th>`).join("")+`<th scope="col" data-tip="${esc(tipFor("ts"))}">Live, Sep 28</th>`;
  $("#wkb").innerHTML=rows.map(r=>`<tr data-id="${r.id}" tabindex="0"><td class="gm"><span class="gname">${esc(nameOf(r.id))}</span>${HARDWARE.has(r.id)?'<span class="hw">Hardware</span>':''}</td>`+
    r.rs.map((x,i)=>x?`<td class="cellr ${tcls(x)}" data-tip="${esc("#"+x+", week of "+WEEKS[i].full)}">${x}</td>`:`<td class="cellr none" data-tip="Not in that week’s top 20. Positions 21 to 100 weren’t captured.">·</td>`).join("")+
    (r.now?`<td class="cellr ${tcls(r.now)}" data-tip="${esc(tipFor("ts"))}">${r.now}</td>`:`<td class="cellr none" data-tip="Not in the live top 100 on Sep 28.">·</td>`)+`</tr>`).join("");
}
function renderYears(){
  const rows=[...YROWS].sort((a,b)=>b.y.length-a.y.length||Math.min(...a.y)-Math.min(...b.y));
  $("#yrh").innerHTML=`<th class="gm l" scope="col">Game</th>`+YEARS.map(y=>`<th scope="col" data-tip="${esc("Sources: "+YEAR_SRC[y])}">${y}</th>`).join("")+`<th scope="col">Years</th>`;
  $("#yrb").innerHTML=rows.map(r=>`<tr ${r.id?`data-id="${r.id}" tabindex="0"`:`class="noid"`}><td class="gm"><span class="gname">${esc(r.n)}</span>${r.note?`<div class="gmeta" data-tip="${esc(r.note)}">See note</div>`:""}</td>`+
    YEARS.map(y=>r.y.includes(y)?`<td class="cellr" data-tip="${esc(`${r.n}: in Steam’s ${y} top 12 by revenue. Sources: ${YEAR_SRC[y]}.`)}"><span class="plat" aria-label="In top 12"></span></td>`:`<td class="cellr none" aria-label="Not in top 12">·</td>`).join("")+
    `<td class="cellr"><span class="yearcount">${r.y.length}</span></td></tr>`).join("");
  $("#ylegend").textContent=`${YROWS.length} different games or franchises made the top 12 across the six years.`;
  $("#facts").innerHTML=FACTS.map(f=>`<div class="fact"><b>${f.v}</b><span>${f.tag==="est"?'<span class="tag rep" style="border-color:var(--est);color:var(--est)">Estimate</span>':f.tag==="rep"?'<span class="tag rep">Press-reported</span>':'<span class="tag obs">Derived</span>'}${esc(f.k)}</span><small>${esc(f.s)}</small></div>`).join("");
}
function renderChecks(){
  $("#checklist").innerHTML=CHECKS.map(c=>`<div class="check"><h3>${esc(c.t)}</h3><span class="st ${c.ok?"ok":"warn"}">${c.ok?"Sources agree":"Conflict found and resolved"}</span>${c.p.map(p=>`<p>${esc(p)}</p>`).join("")}</div>`).join("");
}
for(const sel of ["#wkb","#yrb"]){
  $(sel).addEventListener("click",e=>{const tr=e.target.closest("tr[data-id]"); if(tr) openSheet(+tr.dataset.id)});
  $(sel).addEventListener("keydown",e=>{if(e.key==="Enter"){const tr=e.target.closest("tr[data-id]"); if(tr) openSheet(+tr.dataset.id)}});
}

renderFresh(); renderControls(); renderTable(); renderWeeks(); renderYears(); renderChecks();
$("#filters").hidden=false; renderFilters();
const navLinks=[...document.querySelectorAll(".topnav a")];
const secs=navLinks.map(a=>document.querySelector(a.getAttribute("href")));
function markNav(){ let cur=0; secs.forEach((s,i)=>{ if(s && s.getBoundingClientRect().top<140) cur=i; }); navLinks.forEach((a,i)=>a.classList.toggle("on",i===cur)); }
document.addEventListener("scroll",markNav,{passive:true});
setInterval(()=>{renderFresh();},60000);
