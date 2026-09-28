/* Steam Performance Snapshot: rendering and interaction. Data lives in data.js. */
const TS_AT = Date.parse("2026-09-28T01:05:00Z");
const MP_AT = Date.parse("2026-09-27T03:15:00Z");
const SRC = {
  ts: {name:"Steam Top Sellers (US, by revenue)", at:TS_AT},
  mp: {name:"Steam most-played chart, via Steam Dashboard", at:MP_AT}
};
const REPORTED = {
  1867240: [
    {k:"Launch sales", v:"1M+ copies in first 24 hours", src:"PC Gamer report", at:"Aug 2026"},
    {k:"All-time peak players", v:"428K+", src:"ComicBook.com report", at:"Sep 25, 2026"}
  ]
};
const PERIODS = [["now","Snapshot"],["24h","24 hours"],["7d","7 days"],["30d","30 days"],["90d","90 days"],["1y","1 year"]];
const MODES = [
  {id:"ts",label:"Top sellers"},{id:"cur",label:"Most played"},{id:"peak",label:"24h peak"},
  {id:"movers",label:"Rank movers"},{id:"weeks",label:"Chart longevity"},
  {id:"copies",label:"Est. copies",na:true},{id:"rev",label:"Est. revenue",na:true},
  {id:"reviews",label:"Most reviewed",na:true},{id:"trend",label:"Trending",na:true},
  {id:"breakout",label:"Breakout",na:true},{id:"gems",label:"Hidden gems",na:true}
];
const NA_MODE_WHY = {
  copies:"No public copies-sold data was retrievable for this snapshot.",
  rev:"Revenue estimates need copies-sold data, which isn’t in this snapshot.",
  reviews:"Review counts weren’t retrievable, and review growth needs two snapshots.",
  trend:"Trending needs change over time, and this page has one snapshot.",
  breakout:"Breakout compares recent activity to a past baseline, which needs history.",
  gems:"Hidden gems need review scores and growth, neither of which is in this snapshot."
};
const COLS = [
  {id:"rank",label:"#",cls:"rk",sort:false},
  {id:"name",label:"Game",cls:"gm l",sort:"name"},
  {id:"chg",label:"Rank change",sort:"chg",tip:"Steam’s own top-seller change versus its previous chart"},
  {id:"ts",label:"Top seller #",sort:"ts"},
  {id:"then",label:"Rank then",sort:"then",hist:true},
  {id:"mv",label:"Move",sort:"mv",hist:true},
  {id:"price",label:"Price",sort:"price"},
  {id:"disc",label:"Discount",sort:"disc"},
  {id:"cur",label:"Players now",sort:"cur"},
  {id:"peak",label:"24h peak",sort:"peak"},
  {id:"mp",label:"Most played #",sort:"mp"},
  {id:"weeks",label:"Weeks on chart",sort:"weeks"},
  {id:"reviews",label:"Reviews",na:true},{id:"score",label:"Review score",na:true},
  {id:"meta",label:"Metacritic",na:true},{id:"owners",label:"Est. owners",na:true},
  {id:"copies",label:"Est. copies",na:true},{id:"revenue",label:"Est. revenue",na:true},
  {id:"genre",label:"Genre",na:true,l:true},{id:"release",label:"Release",na:true},
  {id:"fresh",label:"Freshness",sort:false}
];
const state = {period:"now", mode:"ts", q:"", sort:null, dir:-1, hideNA:true,
  price:null, pmin:"", pmax:"", noF2P:false, sale:false, discMin:0,
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
   <div class="fgroup"><h3>Narrow by discount</h3>${chipset("discMin",[[0,"Any"],[10,"10%+"],[25,"25%+"],[50,"50%+"],[75,"75%+"]])}
     <label class="chk"><input type="checkbox" id="sale" ${state.sale?"checked":""}> On sale only</label></div>
   <div class="fgroup"><h3>Narrow by players</h3>${chipset("pmetric",[["cur","Players now"],["peak","24h peak"]])}
     <div style="height:8px;padding:0"></div>${chipset("pthresh",PLAYER_Q.map(v=>[v,v?fmtK(v)+"+":"Any"]))}</div>
   <div class="fgroup"><h3>Narrow by chart</h3>${chipset("chart",[["any","Either chart"],["ts","Top sellers"],["mp","Most played"],["both","On both"]])}
     <label class="chk"><input type="checkbox" id="newOnly" ${state.newOnly?"checked":""}> New chart entries only</label></div>
  </div>
  <div class="unavail">Not available in this snapshot:
   <ul><li>Genre</li><li>Steam tags</li><li>Metacritic score</li><li>Estimated copies sold</li><li>Estimated revenue</li><li>Review count</li><li>Reviews added in period</li><li>Review score</li><li>All-time peak</li><li>Release date</li><li>Developer or publisher search</li></ul></div>`;
  $("#filters").onclick = e=>{const c=e.target.closest(".chip"); if(!c) return;
    const k=c.dataset.k, v=c.dataset.v;
    state[k] = (k==="price") ? (v==="null"?null:v) : (k==="pmetric"||k==="chart") ? v : Number(v);
    if(k==="price"){state.pmin="";state.pmax=""}
    renderFilters(); renderTable();};
  $("#pmin").oninput=e=>{state.pmin=e.target.value;state.price=null;renderTable()};
  $("#pmax").oninput=e=>{state.pmax=e.target.value;state.price=null;renderTable()};
  for(const id of ["noF2P","sale","newOnly"]) $("#"+id).onchange=e=>{state[id]=e.target.checked;renderTable()};
}
function fmtK(v){return v>=1000? (v/1000)+"K" : String(v)}

function passes(g){
  if(state.q){const q=state.q.toLowerCase(); if(!(title(g).toLowerCase().includes(q)||String(g.id).includes(q))) return false;}
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
  if(state.sale&&!(g.disc>0)) return false;
  if(state.discMin&&!(g.disc>=state.discMin)) return false;
  if(state.pthresh){const v=g[state.pmetric]; if(v===undefined||v<state.pthresh) return false;}
  if(state.chart==="ts"&&!g.ts) return false;
  if(state.chart==="mp"&&!g.mp) return false;
  if(state.chart==="both"&&!(g.ts&&g.mp)) return false;
  if(state.newOnly&&!g.isNew) return false;
  return true;
}
function modeList(list){
  const m=state.mode;
  if(m==="ts") return list.filter(g=>g.ts).sort((a,b)=>a.ts-b.ts);
  if(m==="cur") return list.filter(g=>g.cur).sort((a,b)=>b.cur-a.cur);
  if(m==="peak") return list.filter(g=>g.peak).sort((a,b)=>b.peak-a.peak);
  if(m==="movers") return list.filter(g=>typeof g.chg==="number").sort((a,b)=>b.chg-a.chg||a.ts-b.ts);
  if(m==="weeks") return list.filter(g=>g.weeks).sort((a,b)=>b.weeks-a.weeks);
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
    const cls=[c.cls||"", c.na?"na na-col nosort":"", !c.sort&&!c.na?"nosort":"", c.l?"l":""].join(" ");
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
      return `<td class="gm"><div class="game"><span class="mono" aria-hidden="true" style="background:hsl(${hue(g.id)} 28% 30%)">${esc(mono(g))}</span><div><div class="gname">${nm}</div><div class="gmeta">${meta}</div></div></div></td>`;}
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
      return `<td class="pc" ${tsTip}>${g.disc?`<span class="strike">$${g.orig.toFixed(2)}</span>`:""}$${g.price.toFixed(2)}</td>`;
    case "disc":
      if(g.disc===undefined) return `<td>${dn}</td>`;
      return `<td ${tsTip}>${g.disc?`<span class="disc">−${g.disc}%</span>`:`<span class="dn">None</span>`}</td>`;
    case "cur": return g.cur? `<td ${mpTip}>${fmt(g.cur)}<span class="bar"><i style="width:${Math.max(2,g.cur/maxCur*100)}%"></i></span></td>` : `<td>${dn}</td>`;
    case "peak": return g.peak? `<td ${mpTip}>${fmt(g.peak)}</td>` : `<td>${dn}</td>`;
    case "mp": return g.mp? `<td ${mpTip}>${g.mp}</td>` : `<td><span class="dn" data-tip="Not in Steam’s top 100 most played at snapshot time.">Not in top 100</span></td>`;
    case "weeks": return g.weeks? `<td ${tsTip}>${fmt(g.weeks)}</td>` : `<td>${dn}</td>`;
    case "fresh": {const t = g.ts&&g.mp ? Math.min(TS_AT,MP_AT) : g.ts?TS_AT:MP_AT;
      return `<td class="fr" data-tip="${esc((g.ts?tipFor("ts")+" ":"")+(g.mp?tipFor("mp"):""))}">Updated ${ago(t)}</td>`;}
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
  const maxCur = Math.max(...DATA.map(g=>g.cur||0));
  $("#count").textContent = `${list.length} game${list.length===1?"":"s"}`;
  if(!list.length){tb.innerHTML=`<tr><td colspan="${span}" class="empty l"><b>No games match these filters</b>Loosen a filter or clear the search to see more.</td></tr>`;return;}
  tb.innerHTML = list.map((g,i)=>`<tr data-id="${g.id}" tabindex="0">${activeCols().map(c=>cell(g,c,i,maxCur)).join("")}</tr>`).join("");
}
$("#tb").onclick = e=>{const tr=e.target.closest("tr[data-id]"); if(tr) openSheet(+tr.dataset.id)};
$("#tb").onkeydown = e=>{if(e.key==="Enter"){const tr=e.target.closest("tr[data-id]"); if(tr) openSheet(+tr.dataset.id)}};

function mrow(k,v,kind,src){
  const tag = kind==="obs"?`<span class="tag obs">Observed</span>`:kind==="rep"?`<span class="tag rep">Press-reported</span>`:`<span class="tag na">Data unavailable</span>`;
  return `<div class="mrow"><span class="k">${k}</span><span class="v">${v}</span><span class="src">${tag}${src}</span></div>`;
}
let lastFocus=null;
function openSheet(id){
  let g=DATA.find(x=>x.id===id); lastFocus=document.activeElement;
  if(!g) g={id, name:EXTRA_NAMES[id]||null, nameSrc:"chart"};
  const ts=s=>`${SRC.ts.name}. Updated ${ago(TS_AT)}.`, mp=`${SRC.mp.name}. Updated ${ago(MP_AT)}.`;
  const NA="Data unavailable", naSrc="Not retrievable for this snapshot.";
  let h=`<button class="btn close" data-close>Close</button><div class="gmeta">App ${g.id}${g.nameSrc==="ref"?", title matched by reference":""}</div><h2 id="sh-title">${esc(title(g))}</h2>`;
  h+=`<p class="note" style="margin-top:6px"><a href="https://store.steampowered.com/app/${g.id}/" target="_blank" rel="noopener">Open on Steam</a></p>`;
  if(HARDWARE.has(g.id)) h+=`<p class="note">This is hardware, not a game. Steam counts it on its top-sellers chart.</p>`;
  h+= g.ts? mrow("Top seller rank", "#"+g.ts,"obs",ts()) : mrow("Top seller rank","Not in top 100","obs",ts());
  if(g.ts){
    h+=mrow("Rank change", g.isNew?"New entry":g.chg>0?`Up ${g.chg}`:g.chg<0?`Down ${-g.chg}`:"No change","obs",ts());
    h+=mrow("Weeks on chart", fmt(g.weeks),"obs",ts());
    h+=mrow("Price", g.free?"Free to play":`$${g.price.toFixed(2)}`+(g.disc?` (was $${g.orig.toFixed(2)})`:""),"obs",ts());
    h+=mrow("Discount", g.disc?`${g.disc}%`:"None","obs",ts());
  } else {
    h+=mrow("Price",NA,"na",naSrc); h+=mrow("Discount",NA,"na",naSrc);
  }
  h+= g.cur? mrow("Players now", fmt(g.cur),"obs",mp) : mrow("Players now",NA,"na","Not in the top 100 most played at snapshot time.");
  h+= g.peak? mrow("24h peak players", fmt(g.peak),"obs",mp) : mrow("24h peak players",NA,"na","Not in the top 100 most played at snapshot time.");
  if(g.mp) h+=mrow("Most played rank","#"+g.mp,"obs",mp);
  const wk=WEEKS.map(w=>w.rank[g.id]?`${w.label}: #${w.rank[g.id]}`:`${w.label}: not in top 20`);
  h+=mrow("Weekly US chart, last 4 weeks", `<span style="font-weight:600;font-size:13px">${wk.join("<br>")}</span>`,"obs",WEEK_SRC);
  const yr=YROWS.find(r=>r.id===g.id);
  h+= yr ? mrow("Steam year-end top 12 by revenue", yr.y.join(", "),"rep",`Cross-checked press coverage of Steam’s Best of lists. ${yr.note||""}`) : mrow("Steam year-end top 12 by revenue","None, 2020 to 2025","rep","Not in any cross-checked top 12 list from 2020 to 2025.");
  for(const r of (REPORTED[g.id]||[])) h+=mrow(r.k, r.v, "rep", `${r.src}, ${r.at}. Not Steam data.`);
  for(const k of ["Developer","Publisher","Release date","Genres and tags","Steam reviews","Review score","Metacritic","Estimated owners","Estimated copies sold","Estimated revenue","All-time peak players"])
    if(!(k==="All-time peak players"&&REPORTED[g.id])) h+=mrow(k,NA,"na",naSrc);
  h+=`<p class="note">Steam ranks top sellers by revenue, not units, so chart position isn’t a copies-sold figure.</p>`;
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
$("#ftoggle").onclick=e=>{const f=$("#filters"); f.hidden=!f.hidden; e.currentTarget.setAttribute("aria-expanded",String(!f.hidden)); if(!f.hidden) renderFilters();};
$("#natoggle").onclick=e=>{state.hideNA=!state.hideNA; e.currentTarget.textContent=state.hideNA?"Show unavailable columns":"Hide unavailable columns"; e.currentTarget.setAttribute("aria-pressed",String(!state.hideNA)); renderTable();};
$("#natoggle").textContent="Show unavailable columns"; $("#natoggle").setAttribute("aria-pressed","false");

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
if(window.matchMedia("(min-width:981px)").matches){ $("#filters").hidden=false; renderFilters(); $("#ftoggle").setAttribute("aria-expanded","true"); }
window.matchMedia("(min-width:981px)").addEventListener("change",e=>{ if(e.matches){ $("#filters").hidden=false; renderFilters(); } });
const navLinks=[...document.querySelectorAll(".topnav a")];
const secs=navLinks.map(a=>document.querySelector(a.getAttribute("href")));
function markNav(){ let cur=0; secs.forEach((s,i)=>{ if(s && s.getBoundingClientRect().top<140) cur=i; }); navLinks.forEach((a,i)=>a.classList.toggle("on",i===cur)); }
document.addEventListener("scroll",markNav,{passive:true});
setInterval(()=>{renderFresh();},60000);
