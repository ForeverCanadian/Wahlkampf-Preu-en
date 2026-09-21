function computeStateOutline(feats){
  if(!window.turf || !feats.length) return null;
  let acc=null;
  for(const f of feats){
    if(!acc){acc=f;continue;}
    try{
      const u=turf.union(acc,f);
      if(u)acc=u;
    }catch(e){ /* skip this piece, keep the accumulated outline as-is */ }
  }
  return acc;
}
STATE_SHADOWS.forEach(s=>{
  try{ s.outline=computeStateOutline(s.features); }catch(e){ s.outline=null; }
});

const DEFAULT_COLORS=["#c00000","#005ea0","#000000","#96c02b","#ffbd00","#f8a520","#5c72a8","#9b6a3f","#7a5aa6","#4b8f5b","#c65f87","#6b6b6b"];
const DEFAULT_NAMES=["SPD","DNVP","Z","NLP","FDP"];
// The bundled constituency baseline stores the first three party series in
// historical source order Z, SPD, DNVP (baseline_A=Z, baseline_B=SPD,
// baseline_C=DNVP). Map each UI slot (SPD, DNVP, Z) to the source column
// that actually holds its data. NLP and FDP already use the UI order.
const MAP_PARTY_SOURCE_ORDER=[1,2,0,3,4];
// National baseline used by the reusable Wikipedia-style election graphic.
const GRAPH_BASELINE=[27.0,29.3,16.7,17.1,9.9];
const GRAPH_INITIAL_SWINGS=[0.8,0.5,-2.0,0.3,0.5];
// Baseline seat result: 630 seats. The first five groups are mapped to the
// five simulator parties; one residual "Sonst." seat is retained.
const LIST_SEATS=181;
const DIRECT_SEATS=DATA.features.length;   // one direct mandate per constituency actually on the map
const TOTAL_SEATS=DIRECT_SEATS+LIST_SEATS;
(function(){const sub=document.querySelector("#page-5 .sub");if(sub)sub.textContent=DIRECT_SEATS+" direct mandates + "+LIST_SEATS+" proportional seats.";})();
const pruState={
  base:[],
  parties:DEFAULT_NAMES.map((name,i)=>({name,color:DEFAULT_COLORS[i]})),
  swings:[],
  voter:[],            // per-party {loyalty, enthusiasm, pos, barrier} — see flow_block.js
  flow:{turnout0:75,firstTimers:0,departures:0},
  selected:null,
  // map display mode: "winner" | "party:N" | "demo:N"
  mapMode:"winner",
  demoVars:[],      // column names from CSV
  demoValues:[],    // per-feature arrays aligned with DATA.features
  demoLabels:{},    // optional friendly labels
  government:{}     // party index -> bool, marks who is in government for the coalition badge
};

function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function pname(i){return pruState.parties[i]?.name || ("Party "+String.fromCharCode(65+i));}
function coords(g,o){if(!g)return;if(g.type==="Polygon")g.coordinates.forEach(r=>r.forEach(p=>o.push(p)));else g.coordinates.forEach(poly=>poly.forEach(r=>r.forEach(p=>o.push(p))));}

const pts=[];DATA.features.forEach(f=>coords(f.geometry,pts));SHADOW_DATA.features.forEach(f=>coords(f.geometry,pts));
let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
pts.forEach(p=>{minX=Math.min(minX,p[0]);maxX=Math.max(maxX,p[0]);minY=Math.min(minY,p[1]);maxY=Math.max(maxY,p[1]);});
const midLat=(minY+maxY)/2*Math.PI/180, cosLat=Math.cos(midLat);
const pad=34,W=1400,H=780,geoW=(maxX-minX)*cosLat,geoH=maxY-minY,targetW=W-2*pad,targetH=H-2*pad,scale=Math.min(targetW/geoW,targetH/geoH);
const drawW=geoW*scale,drawH=geoH*scale,offX=(W-drawW)/2,offY=(H-drawH)/2;
function project(p){return [offX+(p[0]-minX)*cosLat*scale,H-(offY+(p[1]-minY)*scale)];}
function path(g){
  let a=[];
  const ring=r=>r.map((p,i)=>{const q=project(p);return(i?"L":"M")+q[0].toFixed(2)+" "+q[1].toFixed(2)}).join(" ")+" Z";
  if(g.type==="Polygon")g.coordinates.forEach(r=>a.push(ring(r)));
  else g.coordinates.forEach(poly=>poly.forEach(r=>a.push(ring(r))));
  return a.join(" ");
}

function shadeColor(hex,level){
  // Four fixed shades of each party colour: 0=lightest, 3=darkest.
  const n=parseInt(hex.replace("#",""),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  const mixes=[0.72,0.48,0.24,0];
  const k=mixes[Math.max(0,Math.min(3,level))];
  return `rgb(${Math.round(r+(255-r)*k)},${Math.round(g+(255-g)*k)},${Math.round(b+(255-b)*k)})`;
}
function shadeLevel(v){return v<25?0:v<40?1:v<60?2:3;}

// Continuous sequential colour scale (light → dark of a base hue)
function sequentialColor(t, baseHex){
  t = Math.max(0, Math.min(1, t));
  const n = parseInt(baseHex.replace("#",""),16);
  const r=(n>>16)&255, g=(n>>8)&255, b=n&255;
  // mix from near-white toward full colour
  const k = 0.85 * (1 - t);  // 0 → almost white, 1 → full colour
  return `rgb(${Math.round(r+(255-r)*k)},${Math.round(g+(255-g)*k)},${Math.round(b+(255-b)*k)})`;
}

// Neutral blue sequential for demographics
function demoColor(t){
  t = Math.max(0, Math.min(1, t));
  // soft blue scale
  const r = Math.round(235 - t * 180);
  const g = Math.round(242 - t * 130);
  const b = Math.round(250 - t * 40);
  return `rgb(${r},${g},${b})`;
}

function normalize(){
  pruState.base=pruState.base.map(v=>{
    const z=pruState.parties.map((_,i)=>Math.max(0,Number(v[i])||0));
    const s=z.reduce((a,b)=>a+b,0)||1;
    return z.map(x=>x*100/s);
  });
}
function ensureBase(){
  while(pruState.base.length<DATA.features.length)pruState.base.push(pruState.parties.map(()=>100/pruState.parties.length));
  pruState.base=pruState.base.slice(0,DATA.features.length);
  pruState.base=pruState.base.map(r=>{
    const a=pruState.parties.map((_,i)=>Number(r[i])||0);
    while(a.length<pruState.parties.length)a.push(0);
    return a.slice(0,pruState.parties.length);
  });
  while(pruState.swings.length<pruState.parties.length)pruState.swings.push(0);
  pruState.swings=pruState.swings.slice(0,pruState.parties.length);
  normalize();
}

function demo(){
  pruState.base=DATA.features.map(f=>{
    const p=[];coords(f.geometry,p);let x=0,y=0;
    p.forEach(q=>{x+=q[0];y+=q[1]});x/=p.length;y/=p.length;
    const a=28+11*Math.sin((x-10)*.55)+6*Math.cos((y-50)*.42);
    const b=27+10*Math.cos((x-15)*.48)-5*Math.sin((y-51)*.50);
    const c=24+8*Math.sin((x+y)*.30)+3*Math.cos(x*.8);
    const d=Math.max(2,100-a-b-c);
    const vals=[a,b,c,d,18+7*Math.cos(x*.35)+3*Math.sin(y*.5),10+5*Math.sin(x*.4)];
    while(vals.length<pruState.parties.length)vals.push(5);
    return vals.slice(0,pruState.parties.length);
  });
  normalize();render();
}

const CENTROID_CACHE=new WeakMap();
function calc(){
  const sourceOrder=(pruState.parties.length===5) ? MAP_PARTY_SOURCE_ORDER : pruState.parties.map((_,i)=>i);

  // Electoral geography adjustments.  The uploaded CSV supplies occupation/
  // density data; the constituency names come from DATA.features.  These
  // adjustments affect the actual constituency vote calculation, so the map,
  // national result, threshold test, list allocation and both graphs all use
  // the same resulting election.
  const demoIndex=name=>{
    const i=pruState.demoVars.findIndex(v=>String(v).toLowerCase()===name);
    return i;
  };
  const demoValue=(row,name)=>{
    const i=demoIndex(name);
    return i>=0 ? (Number(row?.[i])||0) : null;
  };
  const isNamedZentrumCity=name=>{
    const s=String(name||"").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g,"");
    return /aachen|koln|cologne|munster/.test(s);
  };

  // Approximate geographic envelope for the Prussian Rhine Province and
  // Westphalia. Pair it with Catholic share so this does not make every
  // western constituency automatically Zentrum.
  const centroid=feature=>{
    const hit=CENTROID_CACHE.get(feature);
    if(hit)return hit;
    const pts=[];coords(feature.geometry,pts);
    const c=pts.length ? [pts.reduce((a,p)=>a+p[0],0)/pts.length,pts.reduce((a,p)=>a+p[1],0)/pts.length] : [0,0];
    CENTROID_CACHE.set(feature,c);
    return c;
  };
  const isRheinlandWestfalen=(feature,catholic)=>{
    const [lon,lat]=centroid(feature);
    return lon>=5.4 && lon<=9.7 && lat>=50.0 && lat<=52.7 && catholic>=35;
  };

  return pruState.base.map((b,i)=>{
    const feature=DATA.features[i];
    const p=feature.properties||{};
    const raw=pruState.parties.map((_,j)=>{
      const src=sourceOrder[j] ?? j;
      let value=Math.max(0,(Number(b[src])||0)+(Number(pruState.swings[j])||0)+(Number(pruState.localSwings&&pruState.localSwings[i]&&pruState.localSwings[i][j])||0));   // localSwings: optional per-constituency campaign effects (null/absent = no effect)

      const row=pruState.demoValues[i]||[];
      const industry=demoValue(row,"occ_industry_pct");
      const density=demoValue(row,"pop_density_per_km2");
      const catholic=demoValue(row,"rel_catholic_pct") ?? 0;
      const industrialScore=Math.min(1,Math.max(0,
        0.70*((industry??0)/100)+0.30*Math.min(1,(density??0)/500)
      ));
      const partyName=String(pruState.parties[j]?.name||"").toLowerCase();

      // General industrial effect. SPD gains mainly from actual industrial
      // labour, while the bourgeois/right-liberal parties lose ground in
      // dense industrial constituencies.
      if(/spd/.test(partyName)) value += 9*industrialScore;
      else if(/^z$|zentrum|centre/.test(partyName)) value += 5*industrialScore;
      else if(/dnvp/.test(partyName)) value -= 5*industrialScore;
      else if(/nlp|national liberal/.test(partyName)) value -= 9*industrialScore;
      else if(/fdp/.test(partyName)) value -= 13*industrialScore;

      // The FDP/DVP is also reduced in dense urban constituencies generally:
      // its baseline remains available, but industrial-city competition makes
      // it harder for the party to turn a modest underlying vote into a win.
      if(/fdp/.test(partyName)) value -= 5*Math.min(1,(density??0)/450);

      // In the Catholic Rhineland and Westphalia, Catholic identity is the
      // default political force. SPD should break through only where there is
      // both substantial industrial employment and a dense urban population.
      const rw=isRheinlandWestfalen(feature,catholic);
      if(rw){
        const zCatholic=Math.max(0,Math.min(1,(catholic-35)/65));
        const heavyIndustry=(industry??0)>=45 && (density??0)>=250;
        if(/^z$|zentrum|centre/.test(partyName)) value += 18 + 24*zCatholic;
        else if(/spd/.test(partyName) && !heavyIndustry) value -= 14 + 12*zCatholic;
        else if(/dnvp|nlp|national liberal/.test(partyName)) value -= 6 + 8*zCatholic;
        else if(/fdp/.test(partyName)) value -= 10 + 14*zCatholic;
      }

      // In the north/east (especially Pomerania, Brandenburg outside the
      // major industrial centres, and East Prussia), model the electorate as
      // predominantly Protestant and agrarian/conservative. DNVP leads here,
      // with NLP second; SPD, Zentrum and FDP are kept clearly behind.
      const [lon,lat]=centroid(feature);

      // Silesia should retain a strong Catholic/centre-right character, but
      // its large mining and manufacturing towns give the SPD a genuine path
      // to plurality.  This is deliberately a softer regional correction
      // than the old all-purpose east/west penalties.
      const silesia = lon >= 14.0 && lon <= 18.5 && lat >= 49.0 && lat <= 51.7;
      if(silesia){
        const zCatholic=Math.max(0,Math.min(1,catholic/100));
        const silesianIndustry=Math.max(0,Math.min(1,
          0.65*((industry??0)/100)+0.35*Math.min(1,(density??0)/450)
        ));
        const urbanIndustrial=(industry??0)>=45 && (density??0)>=180;
        if(/^z$|zentrum|centre/.test(partyName)) value += 10 + 16*zCatholic;
        else if(/spd/.test(partyName) && urbanIndustrial) value += 5 + 7*silesianIndustry;
        else if(/dnvp/.test(partyName)) value -= 3 + 4*zCatholic;
        else if(/nlp|national liberal/.test(partyName)) value -= 2;
      }

      // Pomerania and the former eastern/Polish territories should be among
      // the DNVP's safer areas.  Keep the advantage strongest in rural,
      // predominantly Protestant districts, while allowing industrial towns
      // and Catholic districts to remain competitive.
      const easternTerritory = p.unit_type === "polish_powiat" ||
        /posen|westpr\.|westpreu|ostpreu|pommern|schlesien/i.test(String(p.display_name||p.name||""));
      const pomeraniaEast = (lon >= 12.0 && lon <= 19.5 && lat >= 52.2 && lat <= 55.1);
      const dnvpHeartland = (easternTerritory || pomeraniaEast) &&
        (industry ?? 0) < 45 && (density ?? 0) < 400 && catholic < 55;
      if(dnvpHeartland){
        if(/dnvp/.test(partyName)) value += 10 + 7*Math.max(0,(55-catholic)/55);
        else if(/nlp|national liberal/.test(partyName)) value += 4;
        else if(/spd/.test(partyName)) value -= 4;
        else if(/^z$|zentrum|centre/.test(partyName)) value -= 4;
        else if(/fdp/.test(partyName)) value -= 5;
      }

      // In the north/east, retain the existing stronger DNVP effect only for
      // genuinely agrarian/protestant districts. Silesian and industrial
      // constituencies are handled separately above.
      const northEast = lon >= 11.0 && lat >= 51.7 && catholic < 35 &&
                        (industry ?? 0) < 42 && (density ?? 0) < 350 && !rw && !silesia;
      if(northEast){
        if(/dnvp/.test(partyName)) value += 18;
        else if(/nlp|national liberal/.test(partyName)) value += 10;
        else if(/spd/.test(partyName)) value -= 7;
        else if(/^z$|zentrum|centre/.test(partyName)) value -= 9;
        else if(/fdp/.test(partyName)) value -= 11;
      }

      // Explicit local treatment requested for Aachen, Köln/Cologne and Münster.
      if(isNamedZentrumCity(p.display_name||p.name||"") &&
         /^(z|zentrum|centre)$/.test(partyName)){
        value += 35;
      }
      return Math.max(0,value);
    });

    // Keep the national polling level anchored to the underlying constituency
    // baseline plus the user's national swing, while compressing the extreme
    // geographic tails. The old model allowed a district's raw baseline and
    // large local penalties to drag a party from (for example) ~15% nationally
    // to 0–2% across huge parts of the country. That is too much geographic
    // variance for a normal election swing.
    //
    // We first measure the national baseline in UI party order, then apply the
    // local geographic model as a relative factor. A power < 1 preserves the
    // regional pattern but pulls unusually high/low districts toward the
    // national center. This is deliberately not a hard 3% floor: genuinely
    // small national parties can still fall below 3% where appropriate.
    // Cache the regional classification so the normalization pass can use the
    // exact same geography without recomputing it or depending on block-local
    // variables from the raw-share pass.
    const props=feature.properties||{};
    const [lon,lat]=centroid(feature);
    const easternTerritory = props.unit_type === "polish_powiat" ||
      /posen|westpr\.|westpreu|ostpreu|pommern/i.test(String(props.display_name||props.name||""));
    const pomeraniaEast = lon >= 12.0 && lon <= 19.5 && lat >= 52.2 && lat <= 55.1;
    const rwRegion = isRheinlandWestfalen(feature, demoValue(pruState.demoValues[i]||[],"rel_catholic_pct") ?? 0);
    const silesiaRegion = lon >= 14.0 && lon <= 18.5 && lat >= 49.0 && lat <= 51.7;
    const catholicFinal=demoValue(pruState.demoValues[i]||[],"rel_catholic_pct") ?? 0;
    const industryFinal=demoValue(pruState.demoValues[i]||[],"occ_industry_pct") ?? 0;
    const densityFinal=demoValue(pruState.demoValues[i]||[],"pop_density_per_km2") ?? 0;
    const northEastRegion = lon >= 11.0 && lat >= 51.7 && catholicFinal < 35 &&
      industryFinal < 42 && densityFinal < 350 && !rwRegion && !silesiaRegion;
    return {feature, raw, easternTerritory, pomeraniaEast, northEastRegion};
  }).map((x,i,all)=>{
    const n=pruState.parties.length;
    const sourceOrder=(n===5) ? MAP_PARTY_SOURCE_ORDER : pruState.parties.map((_,j)=>j);
    const baseNational=Array.from({length:n},(_,j)=>{
      const src=sourceOrder[j] ?? j;
      let total=0;
      pruState.base.forEach(r=>{ total += Number(r[src])||0; });
      return total/(pruState.base.length||1);
    });
    const targetNational=baseNational.map((v,j)=>Math.max(0,v+(Number(pruState.swings[j])||0)));
    const targetSum=targetNational.reduce((a,b)=>a+b,0)||1;
    const target=targetNational.map(v=>v*100/targetSum);

    // Average the geographically adjusted raw shares to establish each
    // party's geographic center before compression.
    const geoTotals=Array(n).fill(0);
    all.forEach(r=>{
      const total=r.raw.reduce((a,b)=>a+b,0)||1;
      r.raw.forEach((v,j)=>geoTotals[j]+=100*v/total);
    });
    const geoNational=geoTotals.map(v=>v/(all.length||1));
    const REGIONAL_COMPRESSION=0.55;

    const factors=x.raw.map((v,j)=>{
      const geo=Math.max(0.75,100*v/(x.raw.reduce((a,b)=>a+b,0)||1));
      const center=Math.max(0.75,geoNational[j]||0.75);
      return Math.pow(geo/center,REGIONAL_COMPRESSION);
    });
    let sh=target.map((v,j)=>v*factors[j]);
    const sum=sh.reduce((a,b)=>a+b,0)||1;
    sh=sh.map(v=>v*100/sum);

    // DNVP eastern-heartland floor.  The regional flags were calculated once
    // above and are carried into this pass, keeping the seat calculation and
    // map calculation on the same data path.  The floor only applies when
    // DNVP is already the district leader, so Silesian/Catholic/industrial
    // exceptions remain untouched.
    const dnvpIndex=pruState.parties.findIndex(p=>/dnvp/.test(String(p.name||'').toLowerCase()));
    if(dnvpIndex>=0 && n===5){
      const dnvpAlreadyLeads=sh[dnvpIndex]===Math.max(...sh);
      if(dnvpAlreadyLeads && (x.easternTerritory || x.pomeraniaEast || x.northEastRegion) && sh[dnvpIndex]<40){
        const oldDnvp=sh[dnvpIndex];
        const scaleOthers=oldDnvp<100 ? (100-40)/(100-oldDnvp) : 0;
        sh=sh.map((v,j)=>j===dnvpIndex ? 40 : v*scaleOthers);
      }
    }

    let w=0;for(let j=1;j<n;j++)if(sh[j]>sh[w])w=j;
    return{feature:x.feature,shares:sh,winner:w};
  });
}

function renderPartyControls(){
  const box=document.getElementById("partyControls");
  if(!box)return;
  box.innerHTML="";
  pruState.parties.forEach((party,i)=>{
    const wrap=document.createElement("div");wrap.className="party";
    wrap.innerHTML=`<div class="partyhead">
      <input class="colorpick" id="color${i}" type="color" value="${party.color}" title="Party colour">
      <input id="name${i}" type="text" value="${esc(party.name)}" aria-label="Party ${i+1} name">
      <button type="button" class="remove" data-remove="${i}" ${pruState.parties.length<=2?"disabled":""}>Remove</button>
    </div>
    <div class="row">
      <input id="swing${i}" type="range" min="-20" max="20" step=".1" value="${Number(pruState.swings[i]||0)}" aria-label="${esc(party.name)} national swing">
      <input id="swing${i}n" type="number" min="-20" max="20" step=".1" value="${Number(pruState.swings[i]||0)}" aria-label="${esc(party.name)} national swing">
    </div>
    <div class="voter-row">
      <label>Voter loyalty %<input id="loyalty${i}" type="number" min="20" max="98" step="1" value="${Math.round((pruState.voter[i]&&pruState.voter[i].loyalty)??55)}" aria-label="${esc(party.name)} voter loyalty"></label>
      <label>Voter enthusiasm<input id="enthusiasm${i}" type="number" min="0" max="100" step="1" value="${Math.round((pruState.voter[i]&&pruState.voter[i].enthusiasm)??50)}" aria-label="${esc(party.name)} voter enthusiasm"></label>
    </div>
    <div class="hint effline" id="eff${i}"></div>`;
    box.appendChild(wrap);

    document.getElementById("name"+i).addEventListener("input",e=>{pruState.parties[i].name=e.target.value||("Party "+String.fromCharCode(65+i));render();});
    document.getElementById("color"+i).addEventListener("input",e=>{pruState.parties[i].color=e.target.value;render();});
    const r=document.getElementById("swing"+i),n=document.getElementById("swing"+i+"n");
    r.addEventListener("input",()=>{pruState.swings[i]=Number(r.value)||0;n.value=pruState.swings[i];render();});
    n.addEventListener("input",()=>{pruState.swings[i]=Math.max(-20,Math.min(20,Number(n.value)||0));r.value=pruState.swings[i];render();});
    const loy=document.getElementById("loyalty"+i),ent=document.getElementById("enthusiasm"+i);
    const setVoter=(key,val,lo,hi)=>{
      if(!pruState.voter[i])pruState.voter[i]=(typeof defaultVoterProfile==="function")?defaultVoterProfile(party.name):{loyalty:55,enthusiasm:50,pos:.5,barrier:1};
      pruState.voter[i][key]=Math.max(lo,Math.min(hi,Number(val)||0));
      render();
    };
    loy.addEventListener("input",()=>setVoter("loyalty",loy.value,20,98));
    ent.addEventListener("input",()=>setVoter("enthusiasm",ent.value,0,100));
  });
  box.querySelectorAll("[data-remove]").forEach(btn=>btn.addEventListener("click",()=>{
    const i=Number(btn.dataset.remove);
    if(pruState.parties.length<=2)return;
    pruState.parties.splice(i,1);pruState.swings.splice(i,1);
    pruState.base=pruState.base.map(r=>r.filter((_,j)=>j!==i));
    if(pruState.selected!==null)pruState.selected=null;
    renderPartyControls();renderMapModeSelect();ensureBase();render();
  }));
}

function friendlyDemoName(v){
  return pruState.demoLabels[v] || v
    .replace(/^occ_/,"")
    .replace(/^rel_/,"")
    .replace(/_pct$/,"%")
    .replace(/_per_km2/," / km²")
    .replace(/_/g," ");
}

function renderMapModeSelect(){
  const sel=document.getElementById("mapMode");
  if(!sel)return;
  const opts=[];
  opts.push(`<option value="winner">Winner (default)</option>`);
  pruState.parties.forEach((p,i)=>{
    opts.push(`<option value="party:${i}">Vote share: ${esc(p.name)}</option>`);
  });
  if(pruState.demoVars.length){
    opts.push(`<option disabled>── Demographics ──</option>`);
    pruState.demoVars.forEach((v,i)=>{
      opts.push(`<option value="demo:${i}">${esc(friendlyDemoName(v))}</option>`);
    });
  }
  const prev=pruState.mapMode;
  sel.innerHTML=opts.join("");
  // restore selection if still valid
  const valid=[...sel.options].some(o=>o.value===prev);
  pruState.mapMode=valid?prev:"winner";
  sel.value=pruState.mapMode;
}

function legend(){
  const other=`<div class="leg"><span class="swatch unowned"></span>Andere Länder</div>`;
  const mode=pruState.mapMode||"winner";
  const winnerKey=document.getElementById("winnerShadeKey");
  const choroLeg=document.getElementById("choroLegend");

  if(mode==="winner"){
    if(winnerKey)winnerKey.style.display="";
    if(choroLeg)choroLeg.style.display="none";
    document.getElementById("legend").innerHTML=other+pruState.parties.map((p,i)=>{
      const shades=[0,1,2,3].map(l=>`<span class="swatch" style="background:${shadeColor(p.color,l)}"></span>`).join("");
      return `<div class="leg"><span class="shades">${shades}</span>${esc(p.name)}</div>`;
    }).join("");
  } else if(mode.startsWith("party:")){
    const pi=Number(mode.split(":")[1])||0;
    const p=pruState.parties[pi]||pruState.parties[0];
    if(winnerKey)winnerKey.style.display="none";
    if(choroLeg){
      choroLeg.style.display="flex";
      const steps=6;
      const bar=[...Array(steps)].map((_,i)=>{
        const t=i/(steps-1);
        return `<span style="background:${sequentialColor(t,p.color)}"></span>`;
      }).join("");
      choroLeg.innerHTML=`<strong>${esc(p.name)}</strong> <div class="choro-bar">${bar}</div> <span>0%</span>→<span>100%</span>`;
    }
    document.getElementById("legend").innerHTML=other+`<div class="leg"><span class="swatch" style="background:${p.color}"></span>${esc(p.name)} vote share</div>`;
  } else if(mode.startsWith("demo:")){
    const di=Number(mode.split(":")[1])||0;
    const name=friendlyDemoName(pruState.demoVars[di]||"demographic");
    if(winnerKey)winnerKey.style.display="none";
    // compute range for label
    let lo=Infinity,hi=-Infinity;
    pruState.demoValues.forEach(row=>{
      const v=Number(row[di])||0;
      if(v<lo)lo=v; if(v>hi)hi=v;
    });
    if(!isFinite(lo)){lo=0;hi=100;}
    if(choroLeg){
      choroLeg.style.display="flex";
      const steps=6;
      const bar=[...Array(steps)].map((_,i)=>{
        const t=i/(steps-1);
        return `<span style="background:${demoColor(t)}"></span>`;
      }).join("");
      choroLeg.innerHTML=`<strong>${esc(name)}</strong> <div class="choro-bar">${bar}</div> <span>${lo.toFixed(0)}</span>→<span>${hi.toFixed(0)}</span>`;
    }
    document.getElementById("legend").innerHTML=other+`<div class="leg"><span class="swatch" style="background:${demoColor(0.7)}"></span>${esc(name)}</div>`;
  }
}

function allocateProportional(shares, seats){
  // Largest remainder method (Hare quota) on national vote shares
  const n = shares.length;
  const total = shares.reduce((a,b)=>a+b,0) || 1;
  const quotas = shares.map(s => (s / total) * seats);
  const floors = quotas.map(q => Math.floor(q));
  let remaining = seats - floors.reduce((a,b)=>a+b,0);
  const remainders = quotas.map((q,i) => ({i, r: q - floors[i]})).sort((a,b)=>b.r - a.r);
  const result = floors.slice();
  for(let k=0; k<remaining; k++) result[remainders[k].i]++;
  return result;
}

function electionSummary(){
  const r=calc(),votes=pruState.parties.map(()=>0),constSeats=pruState.parties.map(()=>0);
  r.forEach((x,i)=>{x.shares.forEach((v,j)=>votes[j]+=v);const w=x.winner;if(pruState.parties[w])constSeats[w]++;});
  const n=r.length||1,national=votes.map(v=>v/n),eligible=national.map((v,i)=>v>=3||constSeats[i]>0);
  const list=allocateProportional(national.map((v,i)=>eligible[i]?v:0),LIST_SEATS);
  const total=constSeats.map((c,i)=>c+list[i]);
  return {r,national,constSeats,eligible,list,total,totalSeats:total.reduce((a,b)=>a+b,0)};
}
function stats(){
  const e=electionSummary();
  const resultsEl=document.getElementById("results");
  if(resultsEl)resultsEl.innerHTML=pruState.parties.map((p,i)=>`<tr><td><span class="swatch" style="background:${shadeColor(p.color,2)};margin-right:5px"></span>${esc(p.name)}</td><td>${e.national[i].toFixed(1)}%</td><td>${e.constSeats[i]}</td><td>${e.list[i]}</td><td><b>${e.total[i]}</b></td></tr>`).join("");
}

function select(i){
  pruState.selected=i;
  const r=calc()[i],p=r.feature.properties,o=r.shares.map((v,j)=>[v,j]).sort((a,b)=>b[0]-a[0]);
  const detailsEl=document.getElementById("details");
  if(detailsEl)detailsEl.innerHTML=`<strong class="hl">${esc(p.map_no)} · ${esc(p.display_name)}</strong><br><span class="hint">${esc(p.code)} · ${esc(p.unit_type)}</span><table>${o.map(([v,j])=>`<tr><td><span class="swatch" style="background:${shadeColor(pruState.parties[j].color,shadeLevel(v))};margin-right:5px"></span>${esc(pname(j))}</td><td>${v.toFixed(1)}%</td></tr>`).join("")}</table>`;
  applySelectionClass();
}

function toggleSelect(i){
  pruState.selected=(pruState.selected===i)?null:i;
  if(pruState.selected!==null){select(pruState.selected);}
  else{applySelectionClass();}
}

function applySelectionClass(){
  document.querySelectorAll(".district").forEach(e=>e.classList.remove("dist-selected"));
  if(pruState.selected!==null){
    const el=document.querySelector(`[data-i="${pruState.selected}"]`);
    if(el)el.classList.add("dist-selected");
  }
}

const COALITION_DEFS=[
  {members:["SPD","Z","FDP"],name:"Weimarer Coalition"},
  {members:["SPD","Z","FDP","NLP"],name:"Große Koalition"},
  {members:["Z","FDP","NLP","DNVP"],name:"Bürgerblock"},
  {members:["NLP","DNVP"],name:"Nationale Koalition"}
];
function partyAbbrev(i){return String(pname(i)||"").trim().toUpperCase();}
function coalitionStatus(){
  const inGov=pruState.parties.map((_,i)=>i).filter(i=>pruState.government[i]);
  const abbrevs=inGov.map(partyAbbrev).sort();
  if(abbrevs.includes("SPD")&&abbrevs.includes("DNVP")){
    return {label:"No coalition \u2014 SPD and DNVP will not govern together",cls:"bad"};
  }
  for(const def of COALITION_DEFS){
    const m=def.members.slice().sort();
    if(m.length===abbrevs.length && m.every((k,idx)=>k===abbrevs[idx])){
      return {label:def.name,cls:"good"};
    }
  }
  if(abbrevs.length===0)return {label:"No party currently marked in government",cls:"warn"};
  if(abbrevs.length===1)return {label:pname(inGov[0])+" minority government",cls:"warn"};
  return {label:"Unnamed coalition",cls:"warn"};
}
function renderGovToggles(){
  const box=document.getElementById("govToggles");
  if(!box)return;
  box.innerHTML=pruState.parties.map((p,i)=>`<button type="button" class="gov-toggle-label${pruState.government[i]?" active":""}" data-gi="${i}" style="--party-color:${p.color}"><span class="swatch" style="background:${p.color}"></span>${esc(p.name)}</button>`).join("");
  box.querySelectorAll("[data-gi]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const i=Number(btn.dataset.gi);
      pruState.government[i]=!pruState.government[i];
      btn.classList.toggle("active",pruState.government[i]);
      renderCoalitionBadge();
    });
  });
}
function renderCoalitionBadge(){
  const el=document.getElementById("coalitionBadge");
  if(!el)return;
  const info=coalitionStatus();
  el.className="coalition-badge "+info.cls;
  el.textContent=info.label;
}

function renderShadow(svg){
  const defs=document.createElementNS("http://www.w3.org/2000/svg","defs");
  defs.innerHTML=`<pattern id="unowned" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
    <rect width="8" height="8" fill="#e6e8eb"></rect>
    <line x1="0" y1="0" x2="0" y2="8" stroke="#b7bcc4" stroke-width="3"></line>
  </pattern>`;
  svg.appendChild(defs);
  SHADOW_DATA.features.forEach(f=>{
    const e=document.createElementNS("http://www.w3.org/2000/svg","path");
    e.setAttribute("d",path(f.geometry));
    e.setAttribute("fill","url(#unowned)");
    e.setAttribute("fill-rule","evenodd");
    e.setAttribute("class","shadow-pruState");
    e.setAttribute("aria-hidden","true");
    const title=document.createElementNS("http://www.w3.org/2000/svg","title");
    title.textContent="Andere Länder – not simulated";
    e.appendChild(title);
    svg.appendChild(e);
  });
  STATE_SHADOWS.forEach(s=>{
    if(!s.outline)return;
    const e=document.createElementNS("http://www.w3.org/2000/svg","path");
    e.setAttribute("d",path(s.outline.geometry));
    e.setAttribute("fill","none");
    e.setAttribute("fill-rule","evenodd");
    e.setAttribute("class","state-border");
    e.setAttribute("aria-hidden","true");
    const title=document.createElementNS("http://www.w3.org/2000/svg","title");
    title.textContent=s.name+" – not simulated";
    e.appendChild(title);
    svg.appendChild(e);
  });
}

function render(){
  ensureBase();
  const svg=document.getElementById("map");
  const results=calc();
  // Pre-compute demo range if needed
  let demoLo=0, demoHi=100;
  if((pruState.mapMode||"").startsWith("demo:")){
    const di=Number(pruState.mapMode.split(":")[1])||0;
    demoLo=Infinity; demoHi=-Infinity;
    pruState.demoValues.forEach(row=>{
      const v=Number(row[di])||0;
      if(v<demoLo)demoLo=v; if(v>demoHi)demoHi=v;
    });
    if(!isFinite(demoLo)){demoLo=0;demoHi=100;}
    if(demoHi<=demoLo) demoHi=demoLo+1;
  }

  function showHoverInfo(i){
    const r=results[i];
    const panel=document.getElementById("mapHoverInfo");
    if(!r||!panel)return;
    const p=r.feature.properties;
    const mode=pruState.mapMode||"winner";
    let body;
    if(mode.startsWith("party:")){
      const pi=Number(mode.split(":")[1])||0;
      const party=pruState.parties[pi]||pruState.parties[0];
      const share=r.shares[pi]||0;
      body=`<div class="hint">${esc(party.name)} vote share</div><div class="metric">${share.toFixed(1)}%</div>`;
    } else if(mode.startsWith("demo:")){
      const di=Number(mode.split(":")[1])||0;
      const name=friendlyDemoName(pruState.demoVars[di]||"demographic");
      const raw=(pruState.demoValues[i]&&pruState.demoValues[i][di])||0;
      body=`<div class="hint">${esc(name)}</div><div class="metric">${Number(raw).toFixed(1)}</div>`;
    } else {
      const o=r.shares.map((v,j)=>[v,j]).sort((a,b)=>b[0]-a[0]).slice(0,3);
      body=`<table>${o.map(([v,j])=>`<tr><td><span class="swatch" style="background:${shadeColor(pruState.parties[j].color,shadeLevel(v))};margin-right:5px"></span>${esc(pname(j))}</td><td>${v.toFixed(1)}%</td></tr>`).join("")}</table>`;
    }
    panel.innerHTML=`<strong class="hl">${esc(p.map_no)} · ${esc(p.display_name)}</strong>${body}`;
    panel.style.display="block";
  }
  function hideHoverInfo(){
    const panel=document.getElementById("mapHoverInfo");
    if(panel)panel.style.display="none";
  }

  // Build the static shadow layer and one <path> per constituency only once
  // (and again if the underlying feature set itself changes size). Every
  // later call — e.g. redrawing the map after a campaign End Week — reuses
  // these same nodes and just repaints them, instead of wiping the SVG and
  // rebuilding every path from scratch on every update, which used to make
  // the map (and the campaign screen showing it) visibly flash/reload.
  let districtEls=svg.__districtEls;
  if(!districtEls || districtEls.length!==results.length){
    svg.innerHTML="";
    renderShadow(svg);
    districtEls=results.map((r,i)=>{
      const e=document.createElementNS("http://www.w3.org/2000/svg","path"),p=r.feature.properties;
      e.setAttribute("d",path(r.feature.geometry));e.setAttribute("class","district");
      e.dataset.i=i;
      e.setAttribute("tabindex","0");
      e.setAttribute("role","button");
      e.setAttribute("aria-label",`${p.map_no}: ${p.display_name}`);
      e.addEventListener("click",()=>toggleSelect(i));
      e.addEventListener("keydown",evt=>{
        if(evt.key==="Enter"||evt.key===" "||evt.key==="Spacebar"){evt.preventDefault();toggleSelect(i);}
      });
      e.addEventListener("focus",()=>{showHoverInfo(i);e.classList.add("dist-hover");});
      e.addEventListener("blur",()=>{hideHoverInfo();e.classList.remove("dist-hover");});
      e.addEventListener("mouseenter",()=>{showHoverInfo(i);e.classList.add("dist-hover");});
      e.addEventListener("mouseleave",()=>{hideHoverInfo();e.classList.remove("dist-hover");});
      svg.appendChild(e);
      return e;
    });
    svg.__districtEls=districtEls;
  }

  results.forEach((r,i)=>{
    const e=districtEls[i];
    const w=r.winner;
    const mode=pruState.mapMode||"winner";
    let fill;
    if(mode==="winner"){
      fill=shadeColor((pruState.parties[w]||pruState.parties[0]).color, shadeLevel(r.shares[r.winner]));
    } else if(mode.startsWith("party:")){
      const pi=Number(mode.split(":")[1])||0;
      const share=r.shares[pi]||0;
      const col=(pruState.parties[pi]||pruState.parties[0]).color;
      fill=sequentialColor(share/100, col);
    } else if(mode.startsWith("demo:")){
      const di=Number(mode.split(":")[1])||0;
      const raw=(pruState.demoValues[i]&&pruState.demoValues[i][di])||0;
      const t=(raw-demoLo)/(demoHi-demoLo);
      fill=demoColor(t);
    } else {
      fill=shadeColor((pruState.parties[w]||pruState.parties[0]).color, shadeLevel(r.shares[r.winner]));
    }
    e.setAttribute("fill",fill);
  });

  legend();stats();renderElectionGraph();renderSeatGraph();
  if(typeof renderFlowControls==="function")renderFlowControls();
  if(typeof renderFlowGraphs==="function")renderFlowGraphs();
  applySelectionClass();
  renderGovToggles();renderCoalitionBadge();
}


function renderElectionGraph(){
  const svg=document.getElementById("electionGraph");
  if(!svg)return;
  const e=electionSummary();
  const n=Math.min(pruState.parties.length,12);
  const current=e.national.slice(0,n);
  const baseline=GRAPH_BASELINE.slice(0,n);
  const changes=current.map((v,i)=>v-(baseline[i]||0));
  if(!baseline.length)return;
  const colors=pruState.parties.slice(0,n).map((p,i)=>p.color||DEFAULT_COLORS[i]||"#666");
  const names=pruState.parties.slice(0,n).map((p,i)=>p.name||("Party "+String.fromCharCode(65+i)));
  const W=608,H=411,left=32,right=594,topY=44,zeroY=157;
  const maxVote=Math.max(30,...current,...baseline),scaleTop=(zeroY-topY)/maxVote;
  const bTop=280,bZero=326,bBottom=372,bMin=-6,bMax=6,bScale=(bBottom-bTop)/(bMax-bMin);
  // Fit any number of parties into the same compact Wikipedia-style plot.
  const barW=Math.min(49, Math.max(18, (right-left-((n-1)*7))/n));
  const gap=n>1?7:0;
  const total=barW*n+gap*(n-1);
  const startX=left+(right-left-total)/2;
  const de=v=>Number(v).toFixed(1).replace(".",",");
  const escG=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  let out=`<rect width="608" height="411" fill="#fff"/>
  <style>
    #electionGraph text{font-family:'Vollkorn',Georgia,serif}
    #electionGraph .title{font-size:17px;font-weight:700;fill:#202122;font-family:'UnifrakturMaguntia',cursive}
    #electionGraph .subtitle{font-size:16px;font-weight:700;fill:#202122;font-family:'UnifrakturMaguntia',cursive}
    #electionGraph .num{font-size:13px;fill:#202122}
    #electionGraph .party{font-size:13px;fill:#3366cc}
    #electionGraph .axis{font-size:12px;fill:#54595d}
    #electionGraph .nav{font-size:16px;fill:#3366cc}
    #electionGraph .grid{stroke:#c8ccd1;stroke-width:1}
  </style>
  <text x="177" y="17" class="title">Landtagswahl in Preußen 1927</text>
  <text x="18" y="16" class="nav">← 1924</text>
  <text x="590" y="16" text-anchor="end" class="nav">1931 →</text>`;
  for(const val of [30,20,10,0]){
    const y=zeroY-val*scaleTop;
    out+=`<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" class="grid"/>`;
    out+=`<text x="23" y="${(y+4).toFixed(1)}" text-anchor="end" class="axis">${val}</text>`;
  }
  current.forEach((v,i)=>{
    const x=startX+i*(barW+gap),h=v*scaleTop,y=zeroY-h;
    out+=`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" fill="${colors[i]}"/>`;
    out+=`<text x="${(x+barW/2).toFixed(1)}" y="${(y-5).toFixed(1)}" text-anchor="middle" class="num">${de(v)}</text>`;
    out+=`<text x="${(x+barW/2).toFixed(1)}" y="177" text-anchor="middle" class="party">${escG(names[i])}</text>`;
  });
  out+=`<text x="304" y="227" text-anchor="middle" class="subtitle">Gewinne und Verluste</text>
  <text x="304" y="248" text-anchor="middle" class="subtitle">im Vergleich zu 1924</text>`;
  for(const val of [6,4,2,0,-2,-4,-6]){
    const y=bZero-val*bScale;
    out+=`<line x1="${left}" y1="${y.toFixed(1)}" x2="${right}" y2="${y.toFixed(1)}" class="grid"/>`;
    const lab=val>0?`+${val}`:`${val}`;
    out+=`<text x="23" y="${(y+4).toFixed(1)}" text-anchor="end" class="axis">${lab}</text>`;
  }
  changes.forEach((v,i)=>{
    const x=startX+i*(barW+gap);
    let y,h,labelY;
    if(v>=0){y=bZero-v*bScale;h=bZero-y;labelY=y-5;}else{y=bZero;h=-v*bScale;labelY=y+h+15;}
    out+=`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${Math.max(0,h).toFixed(2)}" fill="${colors[i]}"/>`;
    out+=`<text x="${(x+barW/2).toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" class="num">${v>=0?"+":""}${de(v)}</text>`;
    out+=`<text x="${(x+barW/2).toFixed(1)}" y="398" text-anchor="middle" class="party">${escG(names[i])}</text>`;
  });
  svg.innerHTML=out;
}


// Hover a wedge or a legend row to highlight that party and dim the rest.
// Mirrors the polling graph's interaction.
function applySeatSelection(svg){
  const sel=svg.__seatSelected;
  svg.querySelectorAll(".seat-mark").forEach(n=>{
    const match=sel==null||+n.getAttribute("data-seat-idx")===sel;
    n.setAttribute("opacity",match?"1":"0.15");
  });
  svg.querySelectorAll(".seat-legend-item").forEach(n=>{
    const match=sel==null||+n.getAttribute("data-seat-idx")===sel;
    n.setAttribute("opacity",match?"1":"0.4");
  });
}
function wireSeatGraph(svg){
  if(svg.__seatWired)return;svg.__seatWired=true;
  svg.addEventListener("pointerover",evt=>{
    const n=evt.target&&evt.target.closest?evt.target.closest("[data-seat-idx]"):null;
    const i=n?+n.getAttribute("data-seat-idx"):null;
    if((svg.__seatSelected??null)===i)return;
    svg.__seatSelected=i;
    applySeatSelection(svg);
  });
  svg.addEventListener("pointerleave",()=>{
    if(svg.__seatSelected==null)return;
    svg.__seatSelected=null;
    applySeatSelection(svg);
  });
}

function renderSeatGraph(){
  const svg=document.getElementById("seatGraph");if(!svg)return;
  const e=electionSummary(),labels=pruState.parties.map(p=>p.name),cols=pruState.parties.map((p,i)=>p.color||DEFAULT_COLORS[i]||"#666"),seats=e.total,total=seats.reduce((a,b)=>a+b,0)||1;
  const cx=414,cy=231,outer=160,inner=78,start=Math.PI,span=Math.PI;
  const escG=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const polar=(r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)];
  const arc=(a0,a1,ro=outer,ri=inner)=>{const [x0,y0]=polar(ro,a0),[x1,y1]=polar(ro,a1),[ix1,iy1]=polar(ri,a1),[ix0,iy0]=polar(ri,a0),large=(a1-a0)>Math.PI?1:0;return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${ro} ${ro} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L ${ix1.toFixed(2)} ${iy1.toFixed(2)} A ${ri} ${ri} 0 ${large} 0 ${ix0.toFixed(2)} ${iy0.toFixed(2)} Z`};
  // Direct mandates fill the outer band, list mandates the inner band (a lighter tint of the party colour).
  const tint=(hex,t)=>{const m=/^#?([0-9a-f]{6})$/i.exec(hex||"");if(!m)return hex;const n=parseInt(m[1],16),f=c=>Math.round(c+(255-c)*t).toString(16).padStart(2,"0");return "#"+f(n>>16&255)+f(n>>8&255)+f(n&255);};
  // Parliamentary order, far left to far right (unknown/renamed parties sit in the centre).
  const RANK={"SPD":0,"Z":1,"Zentrum":1,"FDP":2,"Freie Demokraten":2,"NLP":3,"Nationalliberale Partei":3,"DNVP":4};
  const order=labels.map((_,i)=>i).sort((x,y)=>((RANK[labels[x]]??2.5)-(RANK[labels[y]]??2.5))||(x-y));
  const dir=e.constSeats,lst=e.list,mid=(outer+inner)/2,majority=Math.floor(total/2)+1;
  let out=`<rect width="608" height="411" fill="#fff"/><style>#seatGraph text{font-family:'Vollkorn',Georgia,serif}#seatGraph .title,#seatGraph .subtitle{font-family:'UnifrakturMaguntia',cursive;font-weight:700;fill:#202122}#seatGraph .title{font-size:17px}#seatGraph .subtitle{font-size:15px}#seatGraph .legendText{font-size:13px;fill:#202122}#seatGraph .seatNum{font-size:13px;font-weight:700;fill:#202122}#seatGraph .credit{font-size:12px;fill:#72777d}</style><text x="18" y="14" class="subtitle">Landtagswahl in Preußen 1927</text><text x="18" y="32" class="title">Sitzverteilung (${TOTAL_SEATS} Sitze)</text>`;
  const lx=20,ly=62,rowH=Math.min(30,300/Math.max(labels.length,1)),lw=252;
  out+=`<text x="${lx+150}" y="55" text-anchor="end" font-size="10.5" class="credit">Direkt</text><text x="${lx+196}" y="55" text-anchor="end" font-size="10.5" class="credit">Liste</text><text x="${lx+lw-6}" y="55" text-anchor="end" font-size="10.5" class="credit">Gesamt</text>`;
  order.forEach((i,k)=>{const name=labels[i],y=ly+k*rowH,ty=(y+rowH/2+5).toFixed(2);out+=`<g class="seat-legend-item" data-seat-idx="${i}" style="cursor:pointer"><rect x="${lx}" y="${y.toFixed(2)}" width="${lw}" height="${Math.max(22,rowH-2).toFixed(2)}" fill="#fff" stroke="#f0f0f0" stroke-width="1"/><rect x="${lx+5}" y="${(y+Math.max(2,(rowH-18)/2)).toFixed(2)}" width="18" height="18" fill="${cols[i]}"/><text x="${lx+32}" y="${ty}" class="legendText">${escG(name)}</text><text x="${lx+150}" y="${ty}" text-anchor="end" class="legendText">${dir[i]}</text><text x="${lx+196}" y="${ty}" text-anchor="end" class="legendText">${lst[i]}</text><text x="${lx+lw-6}" y="${ty}" text-anchor="end" class="seatNum">${seats[i]}</text></g>`;});
  let a=start;order.forEach(i=>{const v=seats[i],da=v/total*span,a1=a+da;if(da>0.0001){
    out+=`<path class="seat-mark" data-seat-idx="${i}" style="cursor:pointer" d="${arc(a,a1)}" fill="${cols[i]}"/>`;
    a=a1;}});
  out+=`<line x1="${cx}" y1="${cy-outer-10}" x2="${cx}" y2="${cy}" stroke="#202122" stroke-width="1.6" stroke-dasharray="2 4" stroke-linecap="round" pointer-events="none"/><text x="${cx}" y="${cy-outer-16}" text-anchor="middle" class="credit" pointer-events="none">Mehrheit: ${majority}</text>`;
  out+=`<text x="20" y="395" class="credit">${TOTAL_SEATS} Sitze · ${DIRECT_SEATS} Wahlkreise + ${LIST_SEATS} Listenmandate</text><text x="590" y="395" text-anchor="end" class="credit">Sitzverteilung</text>`;
  svg.innerHTML=out;
  // Keep the highlighted party across re-renders (sliders, map edits, ...), unless it no longer exists.
  if(svg.__seatSelected!=null&&svg.__seatSelected>=labels.length)svg.__seatSelected=null;
  wireSeatGraph(svg);
  applySeatSelection(svg);
}

function parseCSV(t){
  const lines=t.trim().split(/\r?\n/);if(lines.length<2)throw Error("CSV is empty.");
  const parse=s=>{let o=[],c="",q=false;for(let i=0;i<s.length;i++){if(s[i]=='"'){if(q&&s[i+1]=='"'){c+='"';i++;}else q=!q}else if(s[i]===","&&!q){o.push(c);c=""}else c+=s[i]}o.push(c);return o};
  const h=parse(lines[0]).map(x=>x.trim());
  const ci=h.indexOf("code");
  const bi=h.map((x,i)=>/^baseline_[A-Z]+$/.test(x)?i:-1).filter(i=>i>=0).sort((a,b)=>h[a].localeCompare(h[b],undefined,{numeric:true}));
  const reserved=new Set(["code","map_no","name","winner","winner_share","constituency","unit_type","classification_basis",
    "zentrum","spd","dnvp","national liberals","social liberals","polish regional party","display_name"]);
  const demoAllow=/^(occ_|rel_|pop_|pct_|density)/i;
  const di=h.map((_,i)=>i).filter(i=>i!==ci && bi.indexOf(i)<0 && !reserved.has(h[i].toLowerCase()) && demoAllow.test(h[i]));
  if(ci<0||bi.length<2)throw Error("Required baseline columns are missing. Need code plus at least baseline_A and baseline_B.");
  const count=bi.length;
  if(count>12)throw Error("This simulator supports a maximum of 12 parties.");
  const old=pruState.parties.slice(0,count);
  pruState.parties=Array.from({length:count},(_,i)=>old[i]||({name:"Party "+String.fromCharCode(65+i),color:DEFAULT_COLORS[i]}));
  pruState.swings=Array.from({length:count},(_,i)=>GRAPH_INITIAL_SWINGS[i]||0);
  const baseMap=new Map(), demoMap=new Map();
  lines.slice(1).forEach(l=>{
    const r=parse(l);const code=(r[ci]||"").trim();if(!code)return;
    baseMap.set(code,bi.map(k=>Number(r[k])||0));
    if(di.length) demoMap.set(code,di.map(k=>Number(r[k])||0));
  });
  pruState.base=DATA.features.map(f=>baseMap.get(f.properties.code)||Array(count).fill(0));
  pruState.demoVars=di.map(i=>h[i]);
  pruState.demoValues=DATA.features.map(f=>demoMap.get(f.properties.code)||Array(di.length).fill(0));
  pruState.demoLabels={};
  pruState.mapMode="winner";
  normalize();pruState.selected=null;render();renderPartyControls();renderMapModeSelect();
}

pruState.swings=[0,0,0,0,0];
// prussia-csv-raw used to be an inline <script type="text/plain"> read
// synchronously via .textContent right here. It is now a plain global
// (PRUSSIA_CSV_RAW) defined by prussia-csv-raw.js, a normal <script src>
// loaded just like DATA / SHADOW_DATA / STATE_SHADOWS above - so this stays
// fully synchronous exactly as it always was (a brief fetch()-based version
// existed for one revision but broke real usage; see the ext-source-cache
// comment in <head> for why).
try{
  if(typeof PRUSSIA_CSV_RAW === "undefined") throw new Error("embedded CSV not found");
  parseCSV(PRUSSIA_CSV_RAW);
}catch(e){
  console.warn("Falling back to illustrative demo data:", e.message);
  demo();
}
renderPartyControls();
renderMapModeSelect();
document.getElementById("mapMode").addEventListener("change",e=>{
  pruState.mapMode=e.target.value||"winner";
  render();
});

window.pruState=pruState;
window.pruRender=render;
window.pruRenderPartyControls=renderPartyControls;
// National vote share (%) per party that the election simulator would give for a set of national
// swings, without touching what is on screen. The polling chart uses this so that it shows exactly
// the same party percentages as the election-result and voter-flow charts.
window.pruNationalForSwings=function(swings,local){
  const saved=pruState.swings.slice(), savedLocal=pruState.localSwings;
  try{
    for(let i=0;i<pruState.parties.length;i++)pruState.swings[i]=Number(swings[i])||0;
    pruState.localSwings=local||null;   // callers that pass nothing (e.g. the historical polling series) never see campaign effects
    return electionSummary().national.slice();
  }finally{
    for(let i=0;i<saved.length;i++)pruState.swings[i]=saved[i];
    pruState.localSwings=savedLocal;
  }
};
// Full projected result (national shares, constituency winners/shares, seats) for a set of national swings
// and optional per-constituency local swings, without touching what is on screen. Used by the campaign.
window.pruProjectionForSwings=function(swings,local){
  const saved=pruState.swings.slice(), savedLocal=pruState.localSwings;
  try{
    for(let i=0;i<pruState.parties.length;i++)pruState.swings[i]=Number(swings[i])||0;
    pruState.localSwings=local||null;
    const e=electionSummary();
    return {
      national:e.national.slice(), constSeats:e.constSeats.slice(), total:e.total.slice(), totalSeats:e.totalSeats,
      results:e.r.map(x=>({winner:x.winner,shares:x.shares.slice()}))
    };
  }finally{
    for(let i=0;i<saved.length;i++)pruState.swings[i]=saved[i];
    pruState.localSwings=savedLocal;
  }
};
window.pruParseCSV=parseCSV;
