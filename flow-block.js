
/* =====================================================================
   Voter flow (Wählerwanderung) 1924 -> 1927
   ---------------------------------------------------------------------
   Every party has two voter-behaviour parameters:
     loyalty     % of a party's surviving 1924 voters who vote for it again
     enthusiasm  0-100; low = more of its voters stay home, drives turnout
   The economic "polling effect" (pruState.swings, written by the control
   centre) shifts both:  loyalty += FLOW_K.loyalty * swing,
                         enthusiasm += FLOW_K.enthusiasm * swing.
   The flow matrix is always consistent with the 1924 result and with the
   simulated 1927 result: retained voters follow loyalty, everything else
   (switching, abstaining, first-time voters, activated non-voters,
   departures) is seeded from ideological proximity / enthusiasm and then
   fitted to the marginals by iterative proportional fitting.
   Units: percent of the 1924 electorate (= 100).
   ===================================================================== */
const FLOW_K={loyalty:1.2,enthusiasm:1.5,turnout:0.2,abstain:0.08,sigma:0.28,cap:0.92};
const FLOW_NW="#aeb3ba",FLOW_FT="#5fb3a8",FLOW_DEP="#5b5f66";
const flowDe=(v,k=1)=>Number(v).toFixed(k).replace(".",",");

function defaultVoterProfile(name){
  const s=String(name||"").toLowerCase();
  if(/spd/.test(s))return{loyalty:72,enthusiasm:62,pos:.10,barrier:1};
  if(/^z$|zentrum|centre/.test(s))return{loyalty:82,enthusiasm:60,pos:.42,barrier:.6};
  if(/dnvp/.test(s))return{loyalty:68,enthusiasm:55,pos:.90,barrier:1};
  if(/nlp|national liberal/.test(s))return{loyalty:58,enthusiasm:48,pos:.65,barrier:1};
  if(/fdp/.test(s))return{loyalty:52,enthusiasm:45,pos:.50,barrier:1};
  return{loyalty:55,enthusiasm:50,pos:.5,barrier:1};
}
function ensureFlowParams(){
  const n=pruState.parties.length;
  if(!Array.isArray(pruState.voter))pruState.voter=[];
  while(pruState.voter.length<n)pruState.voter.push(defaultVoterProfile(pruState.parties[pruState.voter.length]&&pruState.parties[pruState.voter.length].name));
  if(pruState.voter.length>n)pruState.voter.length=n;
}

function voterFlowModel(v0in,s1in,swings,voter,cfg){
  const n=s1in.length,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const norm=a=>{const t=a.reduce((x,y)=>x+y,0)||1;return a.map(x=>x*100/t)};
  const v0=norm(Array.from({length:n},(_,i)=>Math.max(0,Number(v0in[i])||0)));
  const s1=norm(s1in.map(x=>Math.max(0,Number(x)||0)));
  const T0=clamp((Number(cfg.turnout0)||75)/100,.3,.97),F=clamp(Number(cfg.firstTimers)||0,0,20),D=clamp(Number(cfg.departures)||0,0,20),d=D/100;
  const L=[],E=[],dL=[],dE=[],A=[];
  for(let i=0;i<n;i++){
    const sw=Number(swings[i])||0,v=voter[i];
    dL.push(FLOW_K.loyalty*sw);dE.push(FLOW_K.enthusiasm*sw);
    L.push(clamp(v.loyalty+dL[i],8,98)/100);
    E.push(clamp(v.enthusiasm+dE[i],0,100));
    A.push(clamp(FLOW_K.abstain*(2-E[i]/50),0,.6));           // abstention among 1924 voters
  }
  const E0bar=v0.reduce((a,x,i)=>a+x/100*voter[i].enthusiasm,0);
  const E1bar=s1.reduce((a,x,i)=>a+x/100*E[i],0);
  const T1=clamp(T0+FLOW_K.turnout*(E1bar-E0bar)/50,.3,.97);
  // marginals (percent of the 1924 electorate)
  const R=v0.map(x=>x*T0).concat([100*(1-T0),F]);                 // parties, non-voters 1924, first-time voters
  const elec1=100-D+F,votes1=T1*elec1;
  const C=s1.map(x=>x/100*votes1).concat([(1-T1)*elec1,D]);       // parties, non-voters 1927, departed
  // stage 1: retained voters (loyalty), capped by what the party can still hold in 1927
  const keep=[];for(let i=0;i<n;i++)keep.push(Math.min(R[i]*(1-d)*(1-A[i])*L[i],FLOW_K.cap*C[i]));
  const rR=R.slice(),rC=C.slice();for(let i=0;i<n;i++){rR[i]-=keep[i];rC[i]-=keep[i];}
  // stage 2: seed for all other flows, then fit to the residual marginals
  const rows=n+2,cols=n+2,M=[],sig2=2*FLOW_K.sigma*FLOW_K.sigma;
  const aff=(i,j)=>Math.max(.03,Math.exp(-Math.pow(voter[i].pos-voter[j].pos,2)/sig2))*Math.min(voter[i].barrier,voter[j].barrier);
  const wE=E.map(e=>e+5),wS=wE.reduce((a,b)=>a+b,0)||1;
  for(let i=0;i<n;i++){
    const row=Array(cols).fill(0);let aS=0;for(let j=0;j<n;j++)if(j!==i)aS+=aff(i,j);
    for(let j=0;j<n;j++)if(j!==i)row[j]=(1-d)*(1-A[i])*(1-L[i])*(aS?aff(i,j)/aS:0);
    row[n]=(1-d)*A[i];row[n+1]=d;M.push(row);
  }
  const act=clamp(FLOW_K.abstain*T0/(1-T0)*(E0bar?E1bar/E0bar:1),.02,.6);   // previous non-voters who vote now
  {const row=Array(cols).fill(0);for(let j=0;j<n;j++)row[j]=(1-d)*act*wE[j]/wS;row[n]=(1-d)*(1-act);row[n+1]=d;M.push(row);}
  {const row=Array(cols).fill(0),ft=clamp(T1-.08,.2,.9);for(let j=0;j<n;j++)row[j]=ft*wE[j]/wS;row[n]=1-ft;M.push(row);}
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)M[i][j]*=Math.max(rR[i],0);
  for(let it=0;it<1000;it++){
    let delta=0;
    for(let i=0;i<rows;i++){const s=M[i].reduce((a,b)=>a+b,0);if(s>0){const f=Math.max(rR[i],0)/s;for(let j=0;j<cols;j++){const nv=M[i][j]*f;delta=Math.max(delta,Math.abs(nv-M[i][j]));M[i][j]=nv;}}}
    for(let j=0;j<cols;j++){let s=0;for(let i=0;i<rows;i++)s+=M[i][j];if(s>0){const f=Math.max(rC[j],0)/s;for(let i=0;i<rows;i++){const nv=M[i][j]*f;delta=Math.max(delta,Math.abs(nv-M[i][j]));M[i][j]=nv;}}}
    if(delta<1e-9)break;
  }
  for(let i=0;i<n;i++)M[i][i]=keep[i];
  return{n,M,R,C,T0,T1,L,E,dL,dE,F,D,v0,s1};
}

function computeVoterFlow(){
  ensureFlowParams();
  const e=electionSummary(),n=pruState.parties.length;
  const v0=Array.from({length:n},(_,i)=>GRAPH_BASELINE[i]||0);
  const vf=voterFlowModel(v0,e.national,pruState.swings,pruState.voter,pruState.flow);
  vf.names=pruState.parties.map((p,i)=>p.name||("Party "+String.fromCharCode(65+i)));
  vf.colors=pruState.parties.map((p,i)=>p.color||DEFAULT_COLORS[i]||"#666");
  return vf;
}

function inkOn(hex){
  const m=/^#?([0-9a-f]{6})$/i.exec(String(hex||""));if(!m)return"#202122";
  const n=parseInt(m[1],16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  return(0.299*r+0.587*g+0.114*b)>150?"#202122":"#ffffff";
}

function renderFlowGraphs(){
  const fs=document.getElementById("flowGraph"),ts=document.getElementById("turnoutGraph");
  if(!fs&&!ts)return;
  let vf;try{vf=computeVoterFlow();}catch(err){console.warn("Voter flow failed:",err);return;}
  if(fs)drawFlowGraph(fs,vf);
  if(ts)drawTurnoutGraph(ts,vf);
  vf.names.forEach((_,i)=>{
    const el=document.getElementById("eff"+i);if(!el)return;
    const f=v=>(v>=0?"+":"")+v.toFixed(1);
    el.textContent=`Polling effect: loyalty ${f(vf.dL[i])}, enthusiasm ${f(vf.dE[i])} \u2192 effective ${Math.round(vf.L[i]*100)}% / ${Math.round(vf.E[i])}`;
  });
}

function drawFlowGraph(svg,vf){
  const n=vf.n,M=vf.M,R=vf.R,C=vf.C,de=flowDe;
  const xL=140,xR=454,nw=14,top=72,bot=476,gap=Math.max(3,Math.min(7,60/(n+1)));
  const namesL=vf.names.concat(["Nichtwähler","Erstwähler"]),namesR=vf.names.concat(["Nichtwähler","Ausgeschieden"]);
  const colL=vf.colors.concat([FLOW_NW,FLOW_FT]),colR=vf.colors.concat([FLOW_NW,FLOW_DEP]);
  const total=R.reduce((a,b)=>a+b,0)||1,scale=(bot-top-gap*(n+1))/total;
  let y=top;const Ln=R.map(v=>{const o={y,h:v*scale};y+=o.h+gap;return o;});
  y=top;const Rn=C.map(v=>{const o={y,h:v*scale};y+=o.h+gap;return o;});
  const valL=R.map((v,i)=>i<n?de(vf.v0[i])+" %":de(v)+" %");
  const valR=C.map((v,j)=>j<n?de(vf.s1[j])+" %":j===n?de((1-vf.T1)*100)+" %":de(v)+" %");
  let out=`<rect width="608" height="520" fill="#fff"/><style>
#flowGraph text{font-family:'Vollkorn',Georgia,serif}
#flowGraph .title,#flowGraph .subtitle{font-family:'UnifrakturMaguntia',cursive;font-weight:700;fill:#202122}
#flowGraph .title{font-size:17px}#flowGraph .subtitle{font-size:15px}
#flowGraph .fyear{font-size:15px;font-weight:700;fill:#202122}
#flowGraph .fname{font-size:12.5px;font-weight:700;fill:#202122}
#flowGraph .fval{font-size:11.5px;font-weight:400;fill:#54595d}
#flowGraph .credit{font-size:11.5px;fill:#72777d}
#flowGraph .flow{fill-opacity:.38;transition:fill-opacity .12s}
#flowGraph .flow.dim{fill-opacity:.06}#flowGraph .flow.hot{fill-opacity:.72}
#flowGraph .fnode{stroke:#fff;stroke-width:1}
#flowGraph .fnode.dim{opacity:.25}#flowGraph .fnode.hot{stroke:#111;stroke-width:1.6}
#flowGraph .tipbox{fill:#111;fill-opacity:.94}#flowGraph .tip{font-size:12px;fill:#fff}
</style>
<text x="18" y="16" class="subtitle">Landtagswahl in Preußen 1927</text><text x="18" y="34" class="title">Wählerwanderung</text>
<text x="${xL+nw/2}" y="62" text-anchor="middle" class="fyear">1924</text><text x="${xR+nw/2}" y="62" text-anchor="middle" class="fyear">1927</text>`;
  const so=Array(n+2).fill(0),dO=Array(n+2).fill(0);
  for(let i=0;i<n+2;i++)for(let j=0;j<n+2;j++){
    const v=M[i][j];if(!(v>1e-4))continue;
    const h=v*scale,y0=Ln[i].y+so[i],z0=Rn[j].y+dO[j];so[i]+=h;dO[j]+=h;
    const x0=xL+nw,cx=(xR-x0)*.5;
    out+=`<path class="flow" data-i="${i}" data-j="${j}" fill="${colL[i]}" d="M ${x0} ${y0.toFixed(2)} C ${x0+cx} ${y0.toFixed(2)}, ${xR-cx} ${z0.toFixed(2)}, ${xR} ${z0.toFixed(2)} L ${xR} ${(z0+h).toFixed(2)} C ${xR-cx} ${(z0+h).toFixed(2)}, ${x0+cx} ${(y0+h).toFixed(2)}, ${x0} ${(y0+h).toFixed(2)} Z"/>`;
  }
  Ln.forEach((nd,i)=>{
    out+=`<rect class="fnode" data-side="L" data-idx="${i}" x="${xL}" y="${nd.y.toFixed(2)}" width="${nw}" height="${Math.max(1,nd.h).toFixed(2)}" fill="${colL[i]}"/>`;
    out+=`<text x="${xL-8}" y="${(nd.y+nd.h/2+4.5).toFixed(1)}" text-anchor="end" class="fname">${esc(namesL[i])}<tspan class="fval" dx="5">${valL[i]}</tspan></text>`;
  });
  Rn.forEach((nd,j)=>{
    out+=`<rect class="fnode" data-side="R" data-idx="${j}" x="${xR}" y="${nd.y.toFixed(2)}" width="${nw}" height="${Math.max(1,nd.h).toFixed(2)}" fill="${colR[j]}"/>`;
    out+=`<text x="${xR+nw+8}" y="${(nd.y+nd.h/2+4.5).toFixed(1)}" class="fname">${esc(namesR[j])}<tspan class="fval" dx="5">${valR[j]}</tspan></text>`;
  });
  out+=`<text x="304" y="497" text-anchor="middle" class="credit">Wahlbeteiligung ${de(vf.T0*100)} % → ${de(vf.T1*100)} % · Parteiwerte: Stimmenanteil, übrige: Anteil der Wahlberechtigten</text>
<text x="304" y="512" text-anchor="middle" class="credit"></text>
<g id="flowTip" display="none" pointer-events="none"><rect class="tipbox" rx="5" ry="5" x="0" y="0" width="200" height="60"/>
<text class="tip" x="9" y="17"></text><text class="tip" x="9" y="32"></text><text class="tip" x="9" y="47"></text><text class="tip" x="9" y="62"></text></g>`;
  svg.__vf=vf;svg.__hot=null;
  svg.innerHTML=out;
  wireFlowGraph(svg);
}

function flowTipLines(vf,el){
  const n=vf.n,M=vf.M,R=vf.R,C=vf.C,de=flowDe;
  const namesL=vf.names.concat(["Nichtwähler 1924","Erstwähler"]),namesR=vf.names.concat(["Nichtwähler 1927","Ausgeschieden"]);
  const pct=(a,b)=>b>1e-9?de(a/b*100,0)+" %":"–";
  const sumRow=(i,a,b)=>{let s=0;for(let j=a;j<b;j++)s+=M[i][j];return s;};
  const sumCol=(j,a,b)=>{let s=0;for(let i=a;i<b;i++)s+=M[i][j];return s;};
  if(el.classList.contains("flow")){
    const i=+el.dataset.i,j=+el.dataset.j,v=M[i][j];
    return[`${namesL[i]} → ${namesR[j]}`,`${de(v,2)} % der Wahlberechtigten`,`${pct(v,R[i])} von ${namesL[i]} · ${pct(v,C[j])} von ${namesR[j]}`];
  }
  const side=el.dataset.side,k=+el.dataset.idx;
  if(side==="L"){
    if(k<n){let off=0;for(let j=0;j<n;j++)if(j!==k)off+=M[k][j];
      return[`${namesL[k]} 1924`,`Stimmenanteil ${de(vf.v0[k])} % · hielten die Treue: ${pct(M[k][k],R[k])}`,`wechselten zu anderen Parteien: ${pct(off,R[k])}`,`Nichtwähler: ${pct(M[k][n],R[k])} · ausgeschieden: ${pct(M[k][n+1],R[k])}`];}
    if(k===n)return[`Nichtwähler 1924 (${de(R[n])} % der Wahlberechtigten)`,`blieben zu Hause: ${pct(M[n][n],R[n])}`,`gingen 1927 wählen: ${pct(sumRow(n,0,n),R[n])}`,`ausgeschieden: ${pct(M[n][n+1],R[n])}`];
    return[`Erstwähler (${de(R[n+1])} % der Wahlberechtigten)`,`wählten eine Partei: ${pct(sumRow(n+1,0,n),R[n+1])}`,`blieben zu Hause: ${pct(M[n+1][n],R[n+1])}`];
  }
  if(k<n){let oth=0;for(let i=0;i<n;i++)if(i!==k)oth+=M[i][k];const dlt=vf.s1[k]-vf.v0[k];
    return[`${namesR[k]} 1927`,`Stimmenanteil ${de(vf.s1[k])} % (${dlt>=0?"+":""}${de(dlt)})`,`Stammwähler von 1924: ${pct(M[k][k],C[k])} · andere Parteien: ${pct(oth,C[k])}`,`frühere Nichtwähler: ${pct(M[n][k],C[k])} · Erstwähler: ${pct(M[n+1][k],C[k])}`];}
  if(k===n)return[`Nichtwähler 1927 (${de((1-vf.T1)*100)} % der Wahlberechtigten)`,`frühere Nichtwähler: ${pct(M[n][n],C[n])}`,`ehemalige Parteiwähler: ${pct(sumCol(n,0,n),C[n])}`,`Erstwähler: ${pct(M[n+1][n],C[n])}`];
  return[`Ausgeschieden (gestorben / fortgezogen)`,`${de(C[n+1])} % der Wahlberechtigten von 1924`,`aus Parteien: ${pct(sumCol(n+1,0,n),C[n+1])} · aus Nichtwählern: ${pct(M[n][n+1],C[n+1])}`];
}

function showFlowTip(svg,evt,lines){
  const tip=svg.querySelector("#flowTip");if(!tip)return;
  const ts=tip.querySelectorAll("text");let w=0;
  ts.forEach((t,k)=>{t.textContent=lines[k]||"";t.setAttribute("font-weight",k===0?"700":"400");});
  tip.setAttribute("display","");
  ts.forEach((t,k)=>{if(lines[k]){let l;try{l=t.getComputedTextLength();}catch(e){l=0;}w=Math.max(w,l||String(lines[k]).length*6.2);}});
  w+=18;const h=10+lines.length*15;
  const box=tip.querySelector("rect");box.setAttribute("width",w.toFixed(0));box.setAttribute("height",h);
  let x=14,y=14;
  const m=svg.getScreenCTM();
  if(m&&svg.createSVGPoint){const pt=svg.createSVGPoint();pt.x=evt.clientX;pt.y=evt.clientY;const p=pt.matrixTransform(m.inverse());
    x=p.x+14;y=p.y+14;if(x+w>604)x=Math.max(4,p.x-w-14);if(y+h>516)y=Math.max(4,p.y-h-14);}
  tip.setAttribute("transform",`translate(${x.toFixed(1)} ${y.toFixed(1)})`);
}

function wireFlowGraph(svg){
  if(svg.__flowWired)return;svg.__flowWired=true;
  const clear=()=>{
    svg.querySelectorAll(".flow,.fnode").forEach(x=>x.classList.remove("dim","hot"));
    const tip=svg.querySelector("#flowTip");if(tip)tip.setAttribute("display","none");
    svg.__hot=null;
  };
  const over=evt=>{
    const el=evt.target&&evt.target.closest?evt.target.closest(".flow,.fnode"):null;
    if(!el||!svg.__vf){clear();return;}
    if(svg.__hot!==el){
      svg.__hot=el;
      const flows=svg.querySelectorAll(".flow"),nodes=svg.querySelectorAll(".fnode");
      if(el.classList.contains("flow")){
        flows.forEach(f=>{f.classList.toggle("dim",f!==el);f.classList.toggle("hot",f===el);});
        nodes.forEach(nd=>nd.classList.remove("dim","hot"));
      }else{
        const side=el.dataset.side,k=el.dataset.idx;
        flows.forEach(f=>{const hit=(side==="L"?f.dataset.i:f.dataset.j)===k;f.classList.toggle("dim",!hit);f.classList.toggle("hot",hit);});
        nodes.forEach(nd=>{nd.classList.toggle("dim",nd!==el);nd.classList.toggle("hot",nd===el);});
      }
    }
    showFlowTip(svg,evt,flowTipLines(svg.__vf,el));
  };
  svg.addEventListener("pointermove",over);
  svg.addEventListener("pointerdown",over);
  svg.addEventListener("pointerleave",clear);
}

function drawTurnoutGraph(svg,vf){
  const n=vf.n,M=vf.M,R=vf.R,C=vf.C,de=flowDe,x0=18,bw=572;
  const items=vf.names.map((nm,i)=>({t:nm,c:vf.colors[i]})).concat([{t:"Nichtwähler",c:FLOW_NW},{t:"Erstwähler",c:FLOW_FT},{t:"Ausgeschieden",c:FLOW_DEP}]);
  let lx=x0,ly=0;
  const pos=items.map(it=>{const w=22+it.t.length*6.4+14;if(lx+w>x0+bw){lx=x0;ly+=19;}const p={x:lx,y:ly};lx+=w;return p;});
  const legendTop=326,H=legendTop+ly+19+16;
  const stack=(segs,x,y,w,h)=>{
    const tot=segs.reduce((a,s)=>a+Math.max(0,s.value),0)||1;let cx=x,o="";
    segs.forEach(s=>{
      if(!(s.value>1e-6))return;
      const sw=s.value/tot*w,p=s.value/tot*100;
      o+=`<g><title>${esc(s.label)}: ${de(p,1)} %</title><rect x="${cx.toFixed(2)}" y="${y}" width="${sw.toFixed(2)}" height="${h}" fill="${s.color}" stroke="#fff" stroke-width=".8"/>`;
      if(sw>=32)o+=`<text x="${(cx+sw/2).toFixed(1)}" y="${y+h/2+4.5}" text-anchor="middle" class="segnum" style="fill:${inkOn(s.color)}">${de(p,0)} %</text>`;
      o+=`</g>`;cx+=sw;
    });
    return o;
  };
  const partySegs=(row)=>vf.names.map((nm,j)=>({label:nm,value:M[row][j],color:vf.colors[j]}));
  const segA=partySegs(n+1).concat([{label:"blieben zu Hause",value:M[n+1][n],color:FLOW_NW}]);
  const segB=partySegs(n).concat([{label:"blieben zu Hause",value:M[n][n],color:FLOW_NW},{label:"ausgeschieden",value:M[n][n+1],color:FLOW_DEP}]);
  const segC=vf.names.map((nm,i)=>({label:nm,value:M[i][n],color:vf.colors[i]})).concat([{label:"schon 1924 Nichtwähler",value:M[n][n],color:FLOW_NW},{label:"Erstwähler",value:M[n+1][n],color:FLOW_FT}]);
  const tw=500,tx=60,d=(vf.T1-vf.T0)*100;
  let out=`<rect width="608" height="${H}" fill="#fff"/><style>
#turnoutGraph text{font-family:'Vollkorn',Georgia,serif}
#turnoutGraph .title,#turnoutGraph .subtitle{font-family:'UnifrakturMaguntia',cursive;font-weight:700;fill:#202122}
#turnoutGraph .title{font-size:17px}#turnoutGraph .subtitle{font-size:15px}
#turnoutGraph .hd{font-size:13px;font-weight:700;fill:#202122}
#turnoutGraph .tl{font-size:12px;fill:#54595d}
#turnoutGraph .segnum{font-size:12px;font-weight:700}
#turnoutGraph .legendText{font-size:12.5px;fill:#202122}
</style>
<text x="18" y="16" class="subtitle">Landtagswahl in Preußen 1927</text><text x="18" y="34" class="title">Erstwähler und Nichtwähler</text>
<text x="${x0}" y="62" class="hd">Wahlbeteiligung</text>
<text x="${x0}" y="81" class="tl">1924</text><rect x="${tx}" y="70" width="${tw}" height="14" fill="#eceef0"/><rect x="${tx}" y="70" width="${(tw*vf.T0).toFixed(1)}" height="14" fill="#6b7280"/>
<text x="${(tx+tw*vf.T0-6).toFixed(1)}" y="81" text-anchor="end" class="segnum" style="fill:#fff">${de(vf.T0*100)} %</text>
<text x="${x0}" y="101" class="tl">1927</text><rect x="${tx}" y="90" width="${tw}" height="14" fill="#eceef0"/><rect x="${tx}" y="90" width="${(tw*vf.T1).toFixed(1)}" height="14" fill="#374151"/>
<text x="${(tx+tw*vf.T1-6).toFixed(1)}" y="101" text-anchor="end" class="segnum" style="fill:#fff">${de(vf.T1*100)} %</text>
<text x="${Math.min(tx+tw*vf.T1+8,560).toFixed(1)}" y="101" class="tl">${d>=0?"+":""}${de(d)} Pkt.</text>
<text x="${x0}" y="138" class="hd">Erstwähler (${de(R[n+1])} % der Wahlberechtigten) – wie sie wählten</text>${stack(segA,x0,145,bw,26)}
<text x="${x0}" y="202" class="hd">Nichtwähler von 1924 (${de(R[n])} %) – wie sie 1927 handelten</text>${stack(segB,x0,209,bw,26)}
<text x="${x0}" y="266" class="hd">Nichtwähler 1927 (${de((1-vf.T1)*100)} %) – woher sie kamen</text>${stack(segC,x0,273,bw,26)}`;
  items.forEach((it,k)=>{
    const p=pos[k],yy=legendTop+p.y;
    out+=`<rect x="${p.x}" y="${yy}" width="14" height="14" fill="${it.c}"/><text x="${p.x+20}" y="${yy+11.5}" class="legendText">${esc(it.t)}</text>`;
  });
  svg.setAttribute("viewBox",`0 0 608 ${H}`);
  svg.innerHTML=out;
}

function renderFlowControls(){
  const box=document.getElementById("flowControls");
  if(!box||box.dataset.ready)return;
  box.dataset.ready="1";
  const defs=[["turnout0","1924 turnout (%)",40,95,.5]];
  box.innerHTML=defs.map(d=>`<label>${d[1]}<input type="number" id="flow_${d[0]}" min="${d[2]}" max="${d[3]}" step="${d[4]}" value="${pruState.flow[d[0]]}"></label>`).join("");
  defs.forEach(d=>{
    const inp=document.getElementById("flow_"+d[0]);
    inp.addEventListener("input",()=>{
      const v=Number(inp.value);if(!isFinite(v))return;
      pruState.flow[d[0]]=Math.max(d[2],Math.min(d[3],v));render();
    });
  });
  const note=document.getElementById("flowNote");

}
try{ensureFlowParams();renderFlowControls();renderFlowGraphs();}catch(e){console.warn("Voter flow init failed:",e);}

