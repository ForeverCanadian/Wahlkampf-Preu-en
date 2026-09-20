(function(){
  'use strict';

  var LS_KEY = 'reichswirtschaft-kennzahlen-register';
  var PAGE5_SHELL = "<main>\n<h1>Prussian Election Simulator</h1>\n<div class=\"sub\">265 constituency seats + 181 proportional seats \u00b7 dynamic parties \u00b7 four vote-share shades per party \u00b7 includes the Hohenzollernsche Lande.</div>\n\n<section class=\"panel map-panel\">\n  <div class=\"map-head\">\n    <strong class=\"hl\">Constituency map</strong>\n    <div class=\"legend\" id=\"legend\"></div>\n  </div>\n  <div class=\"shade-key\" id=\"winnerShadeKey\">\n    <span>Map shade:</span><span>0\u201324%</span><span>25\u201339%</span><span>40\u201359%</span><span>60%+</span>\n  </div>\n  <div class=\"map-mode-bar\">\n    <label for=\"mapMode\">Map display:</label>\n    <select id=\"mapMode\" aria-label=\"Map display mode\"></select>\n    <div class=\"choro-legend\" id=\"choroLegend\" style=\"display:none\"></div>\n  </div>\n  <div class=\"map-wrap\"><svg id=\"map\" viewBox=\"0 0 1400 780\" role=\"img\" aria-label=\"Interactive map of Prussian electoral units\"></svg><div id=\"mapHoverInfo\" class=\"map-hover-info\" style=\"display:none\"></div></div>\n</section>\n\n<section class=\"panel election-graph-panel\">\n  <div class=\"election-graphs-row\">\n    <div class=\"election-graph-wrap\">\n      <svg id=\"electionGraph\" viewBox=\"0 0 608 411\" role=\"img\" aria-label=\"Wikipedia-style election result and gain-loss graph\"></svg>\n    </div>\n    <div class=\"election-graph-wrap\">\n      <svg id=\"seatGraph\" viewBox=\"0 0 608 411\" role=\"img\" aria-label=\"Wikipedia-style seat distribution graph\"></svg>\n      <div class=\"coalition-panel\">\n        <div class=\"hint\" style=\"margin-bottom:6px\">Mark who is in government:</div>\n        <div id=\"govToggles\" class=\"gov-toggles\"></div>\n        <div id=\"coalitionBadge\" class=\"coalition-badge\"></div>\n      </div>\n    </div>\n  </div>\n</section>\n\n<section class=\"panel flow-graph-panel\">\n  <div class=\"flow-graphs-row\">\n    <div class=\"flow-graph-wrap\">\n      <svg id=\"flowGraph\" viewBox=\"0 0 608 520\" role=\"img\" aria-label=\"Voter flow between the 1924 and 1927 elections\"></svg>\n    </div>\n    <div class=\"flow-graph-wrap\">\n      <svg id=\"turnoutGraph\" viewBox=\"0 0 608 400\" role=\"img\" aria-label=\"Turnout, first-time voters and non-voters\"></svg>\n    </div>\n  </div>\n  <div id=\"flowControls\" class=\"flow-controls\" style=\"display:none\"></div>\n  <div id=\"flowNote\" class=\"hint\" style=\"display:none\"></div>\n</section>\n</main>";

  var METRICS = {
    gdpIndex:            { label:'Real GDP Index', unit:'1924 = 100', decimals:1, higherIsBetter:true,  thresholds:{bad:85, warn:95} },
    gdpPerCapita:        { label:'GDP per Capita', unit:'RM', decimals:0, higherIsBetter:true,  thresholds:{bad:1450, warn:1600} },
    heavyIndustryYoY:    { label:'Heavy Industry Output, YoY', unit:'%', decimals:1, higherIsBetter:true,  thresholds:{bad:-8, warn:-3} },
    wholesalePriceIndex: { label:'Wholesale Price Index', unit:'1924 = 100', decimals:1, kind:'price' },
    inflationRate:       { label:'Inflation Rate, YoY', unit:'%', decimals:1, kind:'inflation' },
    unemploymentRate:    { label:'Unemployment Rate', unit:'% of workforce', decimals:1, higherIsBetter:false, thresholds:{bad:15, warn:8} },
    unemployedM:         { label:'Registered Unemployed', unit:'million', decimals:2, higherIsBetter:false, thresholds:{bad:2, warn:1} },
    debtToGdp:           { label:'Debt-to-GDP', unit:'%', decimals:1, higherIsBetter:false, thresholds:{bad:80, warn:40} },
    publicSpendingGdp:   { label:'Public Spending, % of GDP', unit:'%', decimals:1, higherIsBetter:false, thresholds:{bad:35, warn:28} },
    militaryGdp:         { label:'Military Budget, % of GDP', unit:'%', decimals:1, higherIsBetter:false, thresholds:{bad:5, warn:4} },
    revenue:             { label:'Revenue', unit:'bn RM', decimals:2, higherIsBetter:true },
    expenditure:         { label:'Expenditure', unit:'bn RM', decimals:2, higherIsBetter:false },
    balance:             { label:'Budget Balance', unit:'bn RM', decimals:2, higherIsBetter:true, thresholds:{bad:0, warn:0.2}, derived:true },
    publicDebt:          { label:'Public Debt (Reich)', unit:'bn RM', decimals:2, higherIsBetter:false, thresholds:{bad:12, warn:8} },
    interestBurden:      { label:'Interest Burden', unit:'bn RM', decimals:2, higherIsBetter:false, thresholds:{bad:0.7, warn:0.4} },
    privateInvestmentGdp:{ label:'Private Investment, % of GDP', unit:'%', decimals:1, higherIsBetter:true,  thresholds:{bad:10, warn:14} },
    realMedianWage:      { label:'Real Median Wage', unit:'RM/month', decimals:0, higherIsBetter:true,  thresholds:{bad:90, warn:140} },
    povertyRate:         { label:'Poverty Rate', unit:'%', decimals:1, higherIsBetter:false, thresholds:{bad:30, warn:15} }
  };

  var SECTIONS = [
    { title:'I. Overall Economic Development', keys:['gdpIndex','gdpPerCapita','heavyIndustryYoY'] },
    { title:'II. Prices', keys:['wholesalePriceIndex','inflationRate'] },
    { title:'III. Labour Market', keys:['unemploymentRate','unemployedM'] },
    { title:'IV. Public Finances', keys:['debtToGdp','publicSpendingGdp','militaryGdp','revenue','expenditure','balance','publicDebt','interestBurden'] },
    { title:'V. Private Economy and Living Standards', keys:['privateInvestmentGdp','realMedianWage','povertyRate'] }
  ];

  // These weights determine the common economic judgement applied to the
  // governing coalition. Fiscal-health indicators are included so that the
  // Social Liberals' emphasis on sound money and public finances matters.
  var APPROVAL_WEIGHTS = {
    unemploymentRate: 0.24, povertyRate: 0.14, realMedianWage: 0.12,
    inflationRate: 0.14, gdpIndex: 0.12, privateInvestmentGdp: 0.09,
    debtToGdp: 0.06, balance: 0.05, interestBurden: 0.04
  };

  var SWING_SCALE = 10;
  var GOV_STATUSES = ['opposition','support','government'];
  var GOV_WEIGHT = { opposition:0, support:0.5, government:1 };
  var INCUMBENCY_COEFF = 1.2;

  // transferProfile coefficients describe where displaced government votes go.
  // Positive values mean a party benefits when that problem gets worse;
  // negative values mean it benefits when that condition improves.
  var PARTIES = [
    { key:'zentrum', name:'Zentrum', color:'#3d3d3d', baseline:22.8,
      transferProfile:{ unemploymentRate:0.12, povertyRate:0.16, realMedianWage:0.10, inflationRate:0.08, gdpIndex:0.08, debtToGdp:0.06, balance:0.05, interestBurden:0.05, privateInvestmentGdp:0.04, heavyIndustryYoY:0.04 } },
    { key:'spd', name:'SPD', color:'#d9433e', baseline:19.0,
      transferProfile:{ unemploymentRate:0.35, povertyRate:0.30, inflationRate:0.28, realMedianWage:0.20, heavyIndustryYoY:0.12, gdpIndex:0.08 } },
    { key:'dnvp', name:'DNVP', color:'#4a9fd8', baseline:20.6,
      transferProfile:{ unemploymentRate:0.45, povertyRate:0.32, realMedianWage:0.18, heavyIndustryYoY:0.16, gdpIndex:0.12, inflationRate:0.08 } },
    { key:'nlp', name:'Nationalliberale Partei', color:'#a8cc4a', baseline:22.2,
      transferProfile:{ unemploymentRate:-0.10, povertyRate:-0.06, gdpIndex:-0.22, privateInvestmentGdp:-0.34, heavyIndustryYoY:-0.30, realMedianWage:-0.10, debtToGdp:-0.10, balance:-0.08 } },
    { key:'fdp', name:'Freie Demokraten', color:'#f0a93c', baseline:15.4,
      transferProfile:{ inflationRate:-0.36, debtToGdp:-0.24, balance:-0.22, interestBurden:-0.18, privateInvestmentGdp:-0.10, gdpIndex:-0.08, unemploymentRate:0.04, povertyRate:0.04 } }
  ];

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function badness(key, value){
    var cfg = METRICS[key];
    if(!cfg || value==null || isNaN(value)) return 0;
    if(cfg.kind === 'price'){
      var dev = Math.abs(value-100);
      return clamp((dev-3)/5, -1, 10);
    }
    if(cfg.kind === 'inflation'){
      var d = Math.abs(value-1.5);
      return clamp((d-1.5)/3, -1, 10);
    }
    var t = cfg.thresholds;
    if(!t) return 0;
    if(cfg.higherIsBetter){
      return clamp((t.warn - value)/(t.warn - t.bad), -1, 10);
    }
    return clamp((value - t.warn)/(t.bad - t.warn), -1, 10);
  }

  function overallBadness(metrics){
    var total=0, wsum=0;
    Object.keys(APPROVAL_WEIGHTS).forEach(function(k){
      var w = APPROVAL_WEIGHTS[k];
      total += w * badness(k, metricValue(k, metrics));
      wsum += w;
    });
    return wsum ? total/wsum : 0;
  }

  function approvalRating(metrics){
    return clamp(55 - 25*overallBadness(metrics), 0, 100);
  }

  function classifyApproval(v){
    if(v>=55) return 'good';
    if(v>=35) return 'warn';
    return 'bad';
  }

  function economicBadnessLevels(metrics){
    var levels = {};
    var keys = Object.keys(APPROVAL_WEIGHTS);
    // Include every metric used by an opposition transfer profile. These are
    // absolute conditions, not changes from an arbitrary historical baseline.
    PARTIES.forEach(function(p){
      Object.keys(p.transferProfile || {}).forEach(function(k){
        if(keys.indexOf(k) === -1) keys.push(k);
      });
    });
    keys.forEach(function(k){
      levels[k] = badness(k, metricValue(k, metrics));
    });
    return levels;
  }

  function oppositionTransferScore(p, badnessLevels){
    var score = 0;
    Object.keys(p.transferProfile || {}).forEach(function(k){
      var weight = p.transferProfile[k] || 0;
      var level = badnessLevels[k] || 0;
      // Positive profile weights mean that voters exposed to this problem are
      // more likely to move toward this opposition party. Negative weights
      // mean that party is less associated with that source of protest.
      score += weight * Math.max(0, level);
    });
    // Keep every opposition party in the transfer pool, while still making
    // strongly relevant constituencies dominate the allocation.
    return Math.max(0, score) + 0.01;
  }

  /* ===== Incumbency fatigue =====
     After FATIGUE_GRACE_QUARTERS (4 years) in office, the SENIOR governing partner starts to
     bleed support. The penalty is convex, so every additional quarter costs more than the last:
         points = LINEAR * over + ACCEL * over^2      (over = quarters in office beyond the grace period)
     capped at FATIGUE_MAX. Senior partner = the 'government' party with the most seats. This page
     has no Reichstag seat model and seats follow vote share under proportional representation, so
     vote share is used.
     The penalty shaves the top off the governing camp: the senior partner is cut first, and if
     that would drop it below its coalition partner the two are levelled and the rest of the
     penalty is shared equally (so the label never flip-flops from one quarter to the next, and
     whichever party currently has the most seats always carries the burden). Junior partners are
     untouched until the senior has been pulled down to their level.
     Tenure is the senior party's uninterrupted spell in the same governing status. The votes lost
     go to the opposition in proportion to each opposition party's baseline strength ("time for a
     change" is not tied to any one grievance). */
  var FATIGUE_GRACE_QUARTERS = 16;
  var FATIGUE_LINEAR = 0.20;
  var FATIGUE_ACCEL  = 0.035;
  var FATIGUE_MAX    = 25;
  // Nothing a party has banked in office vanishes the moment its status changes. When it leaves a
  // governing spell (government -> support, support -> government, or either -> opposition) the
  // swing it was carrying at that point - economic credit or blame plus any fatigue - is frozen
  // and fades out in a straight line over this many quarters (8 = two years) instead of being
  // zeroed when its accountability baseline resets.
  var LINGER_QUARTERS = 8;
  // How hard fatigue bites depends on how the government is doing. At or above FATIGUE_APPROVAL_HIGH
  // approval only FATIGUE_MIN_FACTOR of the penalty applies; at or below FATIGUE_APPROVAL_LOW the full
  // penalty applies; in between it scales linearly. It is re-read every quarter, so a popular
  // government's fatigue returns in full force as soon as approval turns bad.
  var FATIGUE_APPROVAL_HIGH = 65;
  var FATIGUE_APPROVAL_LOW  = 45;
  var FATIGUE_MIN_FACTOR    = 0.10;
  function fatigueApprovalFactor(approval){
    var t = clamp((FATIGUE_APPROVAL_HIGH - approval) / (FATIGUE_APPROVAL_HIGH - FATIGUE_APPROVAL_LOW), 0, 1);
    return FATIGUE_MIN_FACTOR + (1 - FATIGUE_MIN_FACTOR) * t;
  }

  function fatiguePoints(tenureQuarters){
    var over = (tenureQuarters || 0) - FATIGUE_GRACE_QUARTERS;
    if(over <= 0) return 0;
    return Math.min(FATIGUE_MAX, FATIGUE_LINEAR * over + FATIGUE_ACCEL * over * over);
  }

  function partySwingPoints(metrics, priorMetrics, government, accountabilityBaselines, noLinger){
    government = government || {};
    priorMetrics = priorMetrics || metrics;
    accountabilityBaselines = accountabilityBaselines || {};
    var tenures = accountabilityBaselines._tenure || {};
    var levels = economicBadnessLevels(metrics);
    var out = {};
    var govParties = [];
    var oppositionParties = [];
    var totalGovernmentLoss = 0;
    var totalGovernmentGain = 0;

    PARTIES.forEach(function(p){
      var status = government[p.key] || 'opposition';
      var weight = GOV_WEIGHT[status] || 0;
      if(weight > 0){
        govParties.push({ party:p, status:status, weight:weight });
      } else {
        oppositionParties.push(p);
      }
      out[p.key] = { points:0, status:status, senior:false, fatigue:0, fatigueFactor:1, lingering:0, tenure: tenures[p.key] || 0 };
    });

    // Accountability is cumulative over each party's current spell in office.
    // A party taking office inherits the existing economy without an immediate
    // penalty. Subsequent deterioration during its tenure accumulates against
    // it; subsequent improvement gives it credit. This avoids both extremes:
    // no instant punishment for inherited conditions, but also no disappearing
    // effect when the economy remains poor for several quarters.
    govParties.forEach(function(item){
      var base = accountabilityBaselines[item.party.key] || priorMetrics || metrics;
      var delta = overallBadness(metrics) - overallBadness(base);
      var points = -INCUMBENCY_COEFF * delta * SWING_SCALE * item.weight;
      out[item.party.key].points = points;
      if(points < 0) totalGovernmentLoss += -points;
      if(points > 0) totalGovernmentGain += points;
    });

    // The opposition receives exactly the net votes displaced from government.
    // If incumbents have gained more than they lost, opposition parties surrender
    // the difference. If incumbents have lost more, opposition receives it.
    var netTransferToOpposition = totalGovernmentLoss - totalGovernmentGain;

    if(oppositionParties.length && Math.abs(netTransferToOpposition) > 1e-9){
      var scores = oppositionParties.map(function(p){
        return { party:p, score:oppositionTransferScore(p, levels) };
      });
      var scoreTotal = scores.reduce(function(sum, item){ return sum + item.score; }, 0);
      scores.forEach(function(item){
        out[item.party.key].points += netTransferToOpposition * (item.score / scoreTotal);
      });
    }

    // Incumbency fatigue: the party with the most seats is the senior partner and pays for its
    // time in office. Levelling from the top: lower the leader until it meets the next governing
    // party, then lower both together, and so on, until the whole penalty has been spent.
    var cabinet = [];
    govParties.forEach(function(item){
      if(item.status !== 'government') return;
      cabinet.push({ key:item.party.key, base:item.party.baseline,
                     s:item.party.baseline + out[item.party.key].points });
    });
    cabinet.sort(function(a,b){ return (b.s - a.s) || (b.base - a.base); });
    if(cabinet.length){
      var lead = cabinet[0];
      var fatFactor = fatigueApprovalFactor(approvalRating(metrics));
      var fat = fatiguePoints(out[lead.key].tenure) * fatFactor;
      out[lead.key].fatigueFactor = fatFactor;
      if(fat > 0){
        var k = 1, cur = lead.s, remaining = fat;
        while(remaining > 1e-9){
          var next = k < cabinet.length ? cabinet[k].s : -Infinity;
          var cost = (cur - next) * k;
          if(k < cabinet.length && remaining >= cost){ remaining -= cost; cur = next; k++; }
          else { cur -= remaining / k; remaining = 0; }
        }
        for(var i=0;i<k;i++){
          var loss = cabinet[i].s - cur;
          out[cabinet[i].key].fatigue = loss;
          out[cabinet[i].key].points -= loss;
        }
        if(oppositionParties.length){
          var baseTotal = oppositionParties.reduce(function(sum, p){ return sum + p.baseline; }, 0);
          oppositionParties.forEach(function(p){
            out[p.key].points += fat * (p.baseline / baseTotal);
          });
        }
      }
      // Label whichever governing party ends up with the most seats as the senior partner.
      var top = cabinet.slice().sort(function(a,b){
        var fa = a.s - out[a.key].fatigue, fb = b.s - out[b.key].fatigue;
        return (fb - fa) || (b.base - a.base);
      })[0];
      out[top.key].senior = true;
    }

    // Lingering swing: credit or blame a party banked in a spell it has since left (see
    // LINGER_QUARTERS). L is signed - negative is blame still being carried, positive is credit.
    // The counterweight comes back from / goes to the other parties in proportion to their
    // baseline strength, as with in-office fatigue.
    var linger = noLinger ? {} : (accountabilityBaselines._linger || {});
    PARTIES.forEach(function(p){
      var L = linger[p.key] || 0;
      if(Math.abs(L) <= 1e-9) return;
      out[p.key].lingering = L;
      out[p.key].points += L;
      var others = PARTIES.filter(function(o){ return o.key !== p.key && !GOV_WEIGHT[government[o.key] || 'opposition']; });
      if(!others.length) others = PARTIES.filter(function(o){ return o.key !== p.key; });
      var tot = others.reduce(function(sum, o){ return sum + o.baseline; }, 0);
      others.forEach(function(o){ out[o.key].points -= L * (o.baseline / tot); });
    });

    return out;
  }

  function getAccountabilityBaselines(history, index, currentMetrics, currentGovernment, noLinger){
    var baselines = {};
    var tenure = {};
    history = history || [];
    var lastIndex = history.length - 1;

    PARTIES.forEach(function(p){
      var status = currentGovernment && currentGovernment[p.key] || 'opposition';
      if(!GOV_WEIGHT[status]) return;

      var idx = index;
      var isDraft = false;

      // If the current draft changes this party's status relative to the last
      // filed quarter, its accountability clock starts with the draft quarter.
      if(idx == null || idx > lastIndex){
        isDraft = true;
        if(lastIndex < 0 || (history[lastIndex].government[p.key] || 'opposition') !== status){
          baselines[p.key] = currentMetrics;
          tenure[p.key] = 1;
          return;
        }
        idx = lastIndex;
      }

      // Walk backwards through the uninterrupted spell in the same governing
      // status. The first quarter of that spell is the inherited-condition
      // baseline: taking office itself causes no vote movement.
      var start = idx;
      while(start > 0){
        var prevStatus = history[start-1].government[p.key] || 'opposition';
        if(prevStatus !== status) break;
        start--;
      }
      baselines[p.key] = history[start].metrics;
      // Quarters in office, counting the quarter being evaluated (the draft counts as one more).
      tenure[p.key] = (idx - start + 1) + (isDraft ? 1 : 0);
    });
    baselines._tenure = tenure;

    // Carry-over. A change of status resets the accountability clock above, which on its own would
    // wipe out whatever credit or blame the party had banked in one quarter. Instead, the swing it
    // had at the last quarter of every spell that ended within the past LINGER_QUARTERS (its own
    // accountability points plus any fatigue, positive or negative) is kept and faded out linearly
    // since that quarter. Spells that ended at different times fade independently and add up.
    var linger = {};
    if(!noLinger){
      var pos = (index == null || index > lastIndex) ? history.length : index;
      var swingCache = {};
      var swingsAt = function(j){
        if(!swingCache[j]){
          var hj = history[j];
          var prior = j > 0 ? history[j-1].metrics : hj.metrics;
          var bj = getAccountabilityBaselines(history, j, hj.metrics, hj.government, true);
          swingCache[j] = partySwingPoints(hj.metrics, prior, hj.government, bj, true);
        }
        return swingCache[j];
      };
      PARTIES.forEach(function(p){
        var total = 0;
        for(var j = pos - 1; j >= 0 && pos - j < LINGER_QUARTERS; j--){
          var st = history[j].government[p.key] || 'opposition';
          if(!GOV_WEIGHT[st]) continue;
          var after = (j + 1 < pos) ? (history[j+1].government[p.key] || 'opposition')
                                    : ((currentGovernment && currentGovernment[p.key]) || 'opposition');
          if(after === st) continue;   // this spell is still running, nothing to carry yet
          total += swingsAt(j)[p.key].points * (1 - (pos - j) / LINGER_QUARTERS);
        }
        if(Math.abs(total) > 1e-9) linger[p.key] = total;
      });
    }
    baselines._linger = linger;
    return baselines;
  }

  function partyShares(metrics, priorMetrics, government, accountabilityBaselines){
    var swings = partySwingPoints(metrics, priorMetrics, government, accountabilityBaselines);
    var raw = PARTIES.map(function(p){
      var sw = swings[p.key];
      return { raw: Math.max(0.5, p.baseline + sw.points), status: sw.status };
    });
    var sum = raw.reduce(function(a,r){ return a+r.raw; }, 0);
    return PARTIES.map(function(p,i){
      var sw = swings[p.key];
      return { key:p.key, name:p.name, color:p.color, share: raw[i].raw/sum*100, status: raw[i].status,
               senior: sw.senior, fatigue: sw.fatigue, fatigueFactor: sw.fatigueFactor, lingering: sw.lingering, tenure: sw.tenure };
    });
  }

  var SECTOR_OPTIONS = {
    production:    ['expanding','steady','slowing','contracting'],
    debt:          ['low','moderate','rising','high','very high'],
    profitability: ['strong','thin','weak','squeezed','negative']
  };
  var SECTOR_CLASS = {
    production:    { expanding:'good', steady:'warn', slowing:'warn', contracting:'bad' },
    debt:          { low:'good', moderate:'warn', rising:'warn', high:'bad', 'very high':'bad' },
    profitability: { strong:'good', thin:'warn', weak:'warn', squeezed:'warn', negative:'bad' }
  };

  function defaultGovernment(){
    var g = {};
    PARTIES.forEach(function(p){ g[p.key] = 'opposition'; });
    return g;
  }

  var BASELINE = {
    updatedAt: 0,
    currentPage: 1,
    history: [
      {
        quarter:'Q1 1924',
        government: defaultGovernment(),
        metrics:{
          gdpIndex:100, gdpPerCapita:1600, heavyIndustryYoY:0,
          wholesalePriceIndex:100, inflationRate:0,
          unemploymentRate:7.6, unemployedM:1,
          debtToGdp:40, publicSpendingGdp:23.5, militaryGdp:3.8,
          revenue:7.4, expenditure:7.2, publicDebt:8, interestBurden:0.4,
          privateInvestmentGdp:14, realMedianWage:140, povertyRate:15
        },
        sectors:[
          { name:'Heavy Industry', production:'slowing', employment:1.9, output:12, debt:'high', profitability:'negative' },
          { name:'Export Industry', production:'steady', employment:2.4, output:18, debt:'moderate', profitability:'thin' },
          { name:'Light Industry', production:'steady', employment:2.0, output:15, debt:'moderate', profitability:'thin' },
          { name:'Estate Agriculture', production:'contracting', employment:1.8, output:5, debt:'very high', profitability:'negative' },
          { name:'Peasant Agriculture', production:'steady', employment:7.5, output:10, debt:'high', profitability:'squeezed' },
          { name:'Mittelstand', production:'slowing', employment:3.5, output:12, debt:'rising', profitability:'weak' },
          { name:'Construction', production:'expanding', employment:1.0, output:5, debt:'moderate', profitability:'negative' }
        ]
      }
    ],
    draft: { quarter:'Q2 1924', metrics:null, sectors:null, government:null, events:[] }
  };
  BASELINE.draft.metrics = clone(BASELINE.history[0].metrics);
  BASELINE.draft.sectors = clone(BASELINE.history[0].sectors);
  BASELINE.draft.government = clone(BASELINE.history[0].government);

  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  function classifyMetric(key, value){
    var cfg = METRICS[key];
    if(!cfg || value==null || isNaN(value)) return 'warn';
    if(cfg.kind === 'price'){
      var dev = Math.abs(value-100);
      if(dev<=3) return 'good';
      if(dev<=8) return 'warn';
      return 'bad';
    }
    if(cfg.kind === 'inflation'){
      if(value>=0 && value<=3) return 'good';
      if((value>3 && value<=6) || (value<0 && value>-3)) return 'warn';
      return 'bad';
    }
    var t = cfg.thresholds;
    if(!t) return 'good';
    if(cfg.higherIsBetter){
      if(value < t.bad) return 'bad';
      if(value < t.warn) return 'warn';
      return 'good';
    }
    if(value > t.bad) return 'bad';
    if(value > t.warn) return 'warn';
    return 'good';
  }

  function metricValue(key, snapshotMetrics){
    if(key === 'balance') return (snapshotMetrics.revenue||0) - (snapshotMetrics.expenditure||0);
    return snapshotMetrics[key];
  }

  function fmtNum(v, decimals){
    if(v==null || isNaN(v)) return '—';
    return Number(v).toLocaleString('en-US', {minimumFractionDigits:decimals, maximumFractionDigits:decimals});
  }

  function nextQuarterLabel(label){
    var m = /^Q([1-4])\s+(\d{4})$/.exec(label||'');
    if(!m) return label + ' (next)';
    var q = parseInt(m[1],10), y = parseInt(m[2],10);
    q++; if(q>4){ q=1; y++; }
    return 'Q'+q+' '+y;
  }

  function sparklineSvg(values, cls){
    var w=180, h=36, pad=4;
    if(values.length < 2){
      return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'"></svg>';
    }
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    if(min===max){ min-=1; max+=1; }
    var stepX = (w-2*pad)/(values.length-1);
    var pts = values.map(function(v,i){
      var x = pad + i*stepX;
      var y = pad + (h-2*pad) * (1 - (v-min)/(max-min));
      return x.toFixed(1)+','+y.toFixed(1);
    });
    var last = pts[pts.length-1].split(',');
    var color = 'var(--'+cls+')';
    return '<svg width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'">' +
      '<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+color+'" stroke-width="1.6"/>' +
      '<circle cx="'+last[0]+'" cy="'+last[1]+'" r="2.4" fill="'+color+'"/>' +
      '</svg>';
  }

  var state = loadInitialState();
  normalizeState(state);

  function normalizeState(s){
    if(!s.draft.government) s.draft.government = defaultGovernment();
    if(!s.draft.events) s.draft.events = [];
    s.history.forEach(function(h){
      if(!h.government) h.government = defaultGovernment();
    });
  }

  /* ===== Autonomous quarterly simulation =====
     Filing a quarter no longer just relabels the draft — it hands the freshly filed figures to
     this engine, which rolls a background drift plus a small slate of Weimar-era events (banking
     strain, harvest swings, decrees, strikes, foreign credit...) and nudges whichever root metric
     each one concerns. Every nudge is run through the same rippleMetrics() cascade a manual edit
     uses, so the consequences spread through LINKS exactly as they would by hand. Cabinet
     decisions and legislation are meant to plug into this same nudge interface later; for now the
     Control Center's manual fields remain a sandbox the player can use to override any of it
     before filing the next quarter. */

  function mulberry32(seed){
    var s = seed >>> 0;
    return function(){
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function quarterSeed(label){
    var h = 2166136261;
    var str = String(label) + '|' + String(state.history.length);
    for(var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // signed random in [-1,1], used to size each nudge
  function rnd1(rng){ return rng()*2 - 1; }

  function applyNudge(m, key, delta, log, label){
    if(!delta) return;
    var old = m[key];
    var to = Number(clampMetricValue(key, old + delta).toFixed(METRICS[key].decimals));
    if(to === old) return;
    m[key] = to;
    var ripple = rippleMetrics(m, key, old, to);
    log.push({ label:label, key:key, from:old, to:to, changes: ripple.changes });
  }

  var QUARTER_EVENTS = [
    { id:'good-harvest', label:'A strong harvest eases food prices.', chance:0.16,
      apply:function(m, rng, log){ applyNudge(m,'wholesalePriceIndex', -(0.4+rng()*1.1), log, 'Good harvest'); } },
    { id:'poor-harvest', label:'Crop failures push food prices up.', chance:0.14,
      apply:function(m, rng, log){ applyNudge(m,'wholesalePriceIndex', (0.4+rng()*1.3), log, 'Poor harvest'); } },
    { id:'bank-strain', label:'Renewed strain in the banking sector.', chance:0.14,
      apply:function(m, rng, log){ applyNudge(m,'heavyIndustryYoY', -(0.8+rng()*2.2), log, 'Banking-sector strain'); } },
    { id:'export-rebound', label:'Export orders pick up.', chance:0.15,
      apply:function(m, rng, log){ applyNudge(m,'heavyIndustryYoY', (0.6+rng()*2.0), log, 'Export orders rebound'); } },
    { id:'strike-wave', label:'A wave of industrial strikes.', chance:0.10,
      apply:function(m, rng, log){ applyNudge(m,'heavyIndustryYoY', -(0.5+rng()*1.6), log, 'Strike wave in heavy industry'); } },
    { id:'foreign-credit', label:'A foreign credit line is renewed on easier terms.', chance:0.10,
      apply:function(m, rng, log){ applyNudge(m,'publicDebt', -(0.05+rng()*0.15), log, 'Foreign credit renegotiated'); } },
    { id:'reichsbank-cut', label:'The Reichsbank trims its discount rate.', chance:0.12,
      apply:function(m, rng, log){ applyNudge(m,'privateInvestmentGdp', (0.2+rng()*0.6), log, 'Reichsbank discount-rate cut'); } },
    { id:'emergency-tariff', label:'An emergency decree raises tariffs.', chance:0.09,
      apply:function(m, rng, log){
        applyNudge(m,'wholesalePriceIndex', (0.3+rng()*0.8), log, 'Emergency tariff decree');
        applyNudge(m,'privateInvestmentGdp', -(0.1+rng()*0.4), log, 'Emergency tariff decree');
      } },
    { id:'austerity-decree', label:'An austerity decree trims Reich spending.', chance:0.09,
      apply:function(m, rng, log){ applyNudge(m,'publicSpendingGdp', -(0.2+rng()*0.6), log, 'Austerity decree'); } },
    { id:'military-order', label:'New military procurement orders are placed.', chance:0.09,
      apply:function(m, rng, log){
        applyNudge(m,'militaryGdp', (0.05+rng()*0.2), log, 'Military procurement order');
        applyNudge(m,'heavyIndustryYoY', (0.2+rng()*0.6), log, 'Military procurement order');
      } }
  ];

  /* ===== Economic phases and momentum =====
     The economy is no longer a memoryless coin-flip. Two things give it direction:
       1. PHASES - a deterministic schedule of expansions, stagnations and recessions (4-12 quarters
          each) drawn from a generator seeded by the scenario's founding quarter, so undo/redo and
          reloads reproduce the same cycle. Each phase has a target GDP velocity (index points per
          quarter) and it also tilts the odds of good/bad events (recessions breed bank strain,
          expansions breed export rebounds).
       2. MOMENTUM - each quarter's GDP move is ECON_MOMENTUM x the previous quarter's realised
          move (read from the filed ledger, so manual edits count) plus a pull toward the phase
          velocity plus a small shock. Inflation is sticky in the same way: it carries momentum and
          is pulled toward a target that depends on the phase (a level to revert to, not a running
          total, so it cannot ratchet upward forever the way repeated price nudges would).
     Everything else follows through the LINKS ripple as before. */
  var ECON_MOMENTUM = 0.55;     // share of last quarter's GDP move that carries into this one
  var ECON_NOISE = 0.45;        // size of the fresh random GDP shock (index points)
  var GDP_MOVE_CAP = 2.0;       // hard cap on a single quarter's GDP move
  var INFL_MOMENTUM = 0.40;     // share of last quarter's inflation move that carries over
  var INFL_PULL = 0.20;         // how fast inflation closes the gap to the phase's target rate
  var HEAVY_MOMENTUM = 0.35;    // same idea for heavy-industry output growth (a year-on-year RATE, so it reverts too)
  var HEAVY_PULL = 0.20;
  var PHASE_EVENT_BIAS = 0.5;   // recession: bad events x1.5, good x0.5 (expansion: the reverse)
  var PHASES = {
    expansion:  { label:'expansion',  dir:+1, gdp:+0.60, infl:+2.5, heavy:+6 },
    stagnation: { label:'stagnation', dir: 0, gdp:+0.10, infl:+1.0, heavy:-2 },
    recession:  { label:'recession',  dir:-1, gdp:-0.55, infl:-1.0, heavy:-10 }
  };
  var PHASE_NEXT = {
    expansion:  [['stagnation',0.5],['recession',0.5]],
    stagnation: [['expansion',0.55],['recession',0.45]],
    recession:  [['stagnation',0.4],['expansion',0.6]]
  };

  function phaseSeed(){
    var str = 'phases|' + String((state.history[0] && state.history[0].quarter) || 'start');
    var h = 2166136261;
    for(var i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function economicPhaseAt(t){
    var rng = mulberry32(phaseSeed());
    var pos = 0, phase = 'stagnation', guard = 0;
    while(guard++ < 1000){
      var roll = rng(), acc = 0, chosen = PHASE_NEXT[phase][PHASE_NEXT[phase].length-1][0];
      for(var i=0;i<PHASE_NEXT[phase].length;i++){
        acc += PHASE_NEXT[phase][i][1];
        if(roll < acc){ chosen = PHASE_NEXT[phase][i][0]; break; }
      }
      phase = chosen;
      var len = 4 + Math.floor(rng()*9);           // 4-12 quarters
      var strength = 0.7 + rng()*0.6;              // 0.7-1.3 x the phase's target velocity
      if(t < pos + len){
        return { name:phase, cfg:PHASES[phase], strength:strength, quarterInPhase: t - pos + 1, length:len };
      }
      pos += len;
    }
    return { name:'stagnation', cfg:PHASES.stagnation, strength:1, quarterInPhase:1, length:1 };
  }

  function lastMove(key){
    var h = state.history, n = h.length;
    if(n < 2) return 0;
    var a = h[n-1].metrics[key], b = h[n-2].metrics[key];
    return (isFinite(a) && isFinite(b)) ? a - b : 0;
  }

  // 'tone' marks whether an event helps (+1) or hurts (-1) the economy; the current phase tilts its odds.
  var EVENT_TONE = {
    'good-harvest':+1, 'poor-harvest':-1, 'bank-strain':-1, 'export-rebound':+1, 'strike-wave':-1,
    'foreign-credit':+1, 'reichsbank-cut':+1, 'emergency-tariff':-1, 'austerity-decree':0, 'military-order':0
  };

  function simulateQuarter(metrics, filedLabel){
    var m = clone(metrics);
    var log = [];
    var rng = mulberry32(quarterSeed(filedLabel));
    var phase = economicPhaseAt(state.history.length);

    // GDP: momentum + pull toward the phase's velocity + a smaller fresh shock
    var target = phase.cfg.gdp * phase.strength;
    var gdpMove = ECON_MOMENTUM * lastMove('gdpIndex') + (1 - ECON_MOMENTUM) * target + rnd1(rng) * ECON_NOISE;
    gdpMove = clamp(gdpMove, -GDP_MOVE_CAP, GDP_MOVE_CAP);
    applyNudge(m, 'gdpIndex', Number(gdpMove.toFixed(2)), log,
      'Economic ' + phase.cfg.label + ' (quarter ' + phase.quarterInPhase + ' of ' + phase.length + ')');

    // Inflation: sticky momentum plus a pull toward the phase's target rate (prices follow via LINKS)
    var inflMove = INFL_MOMENTUM * lastMove('inflationRate') + INFL_PULL * (phase.cfg.infl - m.inflationRate);
    inflMove = clamp(inflMove, -1.5, 1.5);
    applyNudge(m, 'inflationRate', Number(inflMove.toFixed(2)), log, 'Inflation momentum');

    // Heavy industry: output growth is a year-on-year rate, so it is pulled toward the phase's
    // typical rate instead of piling up one shock after another.
    var heavyMove = HEAVY_MOMENTUM * lastMove('heavyIndustryYoY') + HEAVY_PULL * (phase.cfg.heavy - m.heavyIndustryYoY);
    heavyMove = clamp(heavyMove, -3, 3);
    applyNudge(m, 'heavyIndustryYoY', Number(heavyMove.toFixed(2)), log, 'Heavy-industry momentum');

    QUARTER_EVENTS.forEach(function(ev){
      var tone = EVENT_TONE[ev.id] || 0;
      var chance = ev.chance * (1 + PHASE_EVENT_BIAS * phase.cfg.dir * tone);
      if(rng() < chance) ev.apply(m, rng, log);
    });

    return { metrics: m, events: log };
  }

  function loadInitialState(){
    var embedded;
    try{ embedded = JSON.parse(document.getElementById('state-data').textContent); }
    catch(e){ embedded = clone(BASELINE); }
    try{
      var raw = localStorage.getItem(LS_KEY);
      if(raw){
        var local = JSON.parse(raw);
        if(local && typeof local.updatedAt === 'number' && local.updatedAt > (embedded.updatedAt||0)){
          return local;
        }
      }
    }catch(e){}
    return embedded;
  }

  var persistHandle = null;
  function schedulePersist(){
    if(persistHandle) clearTimeout(persistHandle);
    persistHandle = setTimeout(persist, 500);
  }
  function persist(){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(state)); }catch(e){}
    if(window.claude && window.claude.use){
      window.claude.use('artifact').then(function(art){
        if(!art || !art.publish) return;
        // buildFullDocument() is async now (see comment on its definition) so
        // it can wait on window.__extSourceReady before reading the cache.
        buildFullDocument(state).then(function(doc){
          return art.publish(doc);
        }).catch(function(err){
          if(err && err.code === 'conflict'){ location.reload(); }
        });
      }).catch(function(){});
    }
  }

  // buildFullDocument() returns a Promise<string> (not a string) because
  // the source text of every extracted block (the three data files plus
  // sim-script, flow-block and this engine-script itself) can no longer be
  // read synchronously via element.textContent now that they load from
  // external files (see the ext-source-cache loader near the top of <head>).
  // It waits on window.__extSourceReady, then reads the cached raw source
  // text for each of them; sourceOf() also falls back to live .textContent
  // so this still works when a block is inline (e.g. in the exported,
  // self-contained copy this function produces).
  function buildFullDocument(s){
    return (window.__extSourceReady || Promise.resolve()).then(function(){
    function sourceOf(id){
      var cached = window.__extSourceCache && window.__extSourceCache[id];
      if(cached != null) return cached;
      var el = document.getElementById(id);
      return el ? el.textContent : '';
    }
    var styleText = document.getElementById('engine-style').textContent;
    var engineText = sourceOf('engine-script');
    var wahlkreiseText = sourceOf('wahlkreise-data-script');
    var shadowText = sourceOf('shadow-data-script');
    var bordersText = sourceOf('state-borders-data-script');
    var csvRawText = (typeof PRUSSIA_CSV_RAW !== 'undefined') ? PRUSSIA_CSV_RAW : '';
    var simText = sourceOf('sim-script');
    // sim-script, flow-block and engine-script are all read through the same
    // sourceOf() helper as the data blocks above: one consistent way to fetch
    // "the original source of block X" whether X is external (cache) or
    // inline (textContent). flow-block was previously missing from this
    // function entirely, which silently dropped the voter-flow feature from
    // every reconstructed/published document; see PROJECT_STATUS.md.
    var flowText = sourceOf('flow-block');
    var page1 = document.getElementById('page-1').outerHTML;
    var page2 = document.getElementById('page-2').outerHTML;
    var page3 = document.getElementById('page-3').outerHTML;
    var navHtml = buildNavHtml(s.currentPage);
    var appHtml = buildAppHtml(s);
    var page4 = '<div class="page' + (s.currentPage===4 ? ' active-page' : '') + '" id="page-4">' + appHtml + '</div>';
    var page5 = '<div class="page' + (s.currentPage===5 ? ' active-page' : '') + '" id="page-5">' + PAGE5_SHELL + '</div>';
    var json = JSON.stringify(s).replace(/<\/script/gi, '<\\/script');
    var stateHtml = '<script id="state-data" type="application/json">' + json + '<' + '/script>';
    var csvRawHtml = '<script id="prussia-csv-raw" type="text/plain">' + csvRawText.replace(/<\/script/gi, '<\\/script') + '<' + '/script>';
    var wahlkreiseHtml = '<script id="wahlkreise-data-script">' + wahlkreiseText.replace(/<\/script/gi, '<\\/script') + '<' + '/script>';
    var shadowHtml = '<script id="shadow-data-script">' + shadowText.replace(/<\/script/gi, '<\\/script') + '<' + '/script>';
    var bordersHtml = '<script id="state-borders-data-script">' + bordersText.replace(/<\/script/gi, '<\\/script') + '<' + '/script>';
    var simHtml = '<script id="sim-script">' + simText.replace(/<\/script/gi, '<\\/script') + '<' + '/script>';
    var flowHtml = '<script id="flow-block">' + flowText.replace(/<\/script/gi, '<\\/script') + '<' + '/script>';
    var styleHtml = '<style id="engine-style">' + styleText + '</style>';
    var engineHtml = '<script id="engine-script">' + engineText + '<' + '/script>';
    var turfHtml = '<script src="https://cdnjs.cloudflare.com/ajax/libs/Turf.js/6.5.0/turf.min.js"></' + 'script>';
    return '<!doctype html><html lang="en"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Volkswirtschaftlicher Lagebericht &amp; Kennzahlen-Register</title>' +
      styleHtml + '</head><body>' + navHtml + page1 + page2 + page3 + page4 + page5 +
      stateHtml + csvRawHtml +
      turfHtml + wahlkreiseHtml + shadowHtml + bordersHtml + simHtml + flowHtml + engineHtml +
      '</body></html>';
    });
  }

  function buildNavHtml(current){
    var labels = [ {n:1,t:'Page 1'}, {n:2,t:'Page 2'}, {n:3,t:'Page 3'}, {n:4,t:'Control Center'}, {n:5,t:'Prussia Election'} ];
    var html = '<div class="page-nav" id="page-nav">';
    html += '<button type="button" class="arrow" id="nav-prev" aria-label="Previous page">&lsaquo;</button>';
    labels.forEach(function(p){
      html += '<button type="button" data-goto="' + p.n + '" class="' + (p.n===current?'active':'') + '">' + p.t + '</button>';
    });
    html += '<button type="button" class="arrow" id="nav-next" aria-label="Next page">&rsaquo;</button>';
    html += '</div>';
    return html;
  }

  function isImprovement(key, oldV, newV){
    var cfg = METRICS[key];
    if(cfg.kind === 'price'){ return Math.abs(newV-100) < Math.abs(oldV-100); }
    if(cfg.kind === 'inflation'){ return Math.abs(newV-1.5) < Math.abs(oldV-1.5); }
    if(cfg.higherIsBetter) return newV > oldV;
    return newV < oldV;
  }


  /* ===== Page 1 — live economic report =====
     Page 1 used to be static markup, so nothing in the Control Center could reach it.
     It now follows the Control Center DRAFT (the same source the Political Outlook and the
     election map use), so every edit is visible on Page 1 straight away. */
  var GDP_PC_BASE = 1600;        // RM, per-capita GDP at the start of the game (Q1 1924)
  var WAGE_BASE = 140;           // RM/month at the start of the game; the wage note compares against this
  var DEBT_SPLIT = { domestic: 8.05/16.05, foreignLong: 4.40/16.05, foreignShort: 3.60/16.05 };
  var NBSP = '\u00a0';
  var MINUS = '\u2212';
  var P1_PRE = {};   // no pre-game history: the charts begin at the neutral Q1 1924 baseline and grow as quarters are filed

  function p1El(id){ return document.getElementById(id); }
  // Calendar year the game started in (taken from the founding quarter), used in the report prose.
  function p1BaseYear(){
    var m = /(\d{4})\s*$/.exec((state.history[0] && state.history[0].quarter) || '');
    return m ? m[1] : '1924';
  }
  function p1R(v){ return (Math.round(v*10)/10).toString(); }
  function p1Pct(v){ return fmtNum(Math.abs(v),1) + NBSP + '%'; }
  function p1Trim(v){ return Number(v).toLocaleString('en-US', {minimumFractionDigits:1, maximumFractionDigits:2}); }
  function p1Rm(txt){ return txt + ' <span class="rm" style="font-size:1em;">RM</span>'; }
  function p1Signed(v){ return (v>0?'+':(v<0?MINUS:'')) + fmtNum(Math.abs(v), Math.abs(v-Math.round(v))<1e-6 ? 0 : 1) + '%'; }
  function p1Plain(v){ return fmtNum(v, Math.abs(v-Math.round(v))<1e-6 ? 0 : 1); }
  function p1PlainPct(v){ return p1Plain(v) + '%'; }

  function p1QuarterTime(label, fallback){
    var m = /^Q([1-4])\s+(\d{4})$/.exec(label || '');
    return m ? parseInt(m[2],10) + (parseInt(m[1],10)-1)/4 : fallback;
  }

  function p1Series(key){
    var out = (P1_PRE[key] || []).map(function(p){ return [p[0], p[1]]; });
    var lastT = 1924;
    state.history.forEach(function(h, i){
      var t = p1QuarterTime(h.quarter, i === 0 ? 1924 : lastT + 0.25);
      if(i > 0 && t <= lastT) t = lastT + 0.25;
      out.push([t, metricValue(key, h.metrics)]);
      lastT = t;
    });
    var td = p1QuarterTime(state.draft.quarter, lastT + 0.25);
    if(td <= lastT) td = lastT + 0.25;
    out.push([td, metricValue(key, state.draft.metrics)]);
    return out;
  }

  function p1ValueAt(series, t){
    if(t <= series[0][0]) return series[0][1];
    for(var i=1;i<series.length;i++){
      if(t <= series[i][0]){
        var a = series[i-1], b = series[i];
        return a[1] + (b[1]-a[1]) * (t-a[0]) / (b[0]-a[0]);
      }
    }
    return series[series.length-1][1];
  }

  function p1Trend(series){
    var last = series[series.length-1][1];
    for(var i=series.length-2;i>=0;i--){
      var d = last - series[i][1];
      if(Math.abs(d) > 1e-9) return d;
    }
    return 0;
  }

  function p1NiceBounds(lo, hi){
    var span = hi - lo; if(span <= 0) span = Math.abs(hi) || 1;
    var raw = span/5, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw/mag;
    var step = (norm<=1 ? 1 : norm<=2 ? 2 : norm<=5 ? 5 : 10) * mag;
    return [Math.floor(lo/step + 1e-9)*step, Math.ceil(hi/step - 1e-9)*step];
  }

  function p1Path(pts){
    if(pts.length < 2) return '';
    var d = 'M' + p1R(pts[0][0]) + ',' + p1R(pts[0][1]);
    for(var i=0;i<pts.length-1;i++){
      var p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || p2;
      var lo = Math.min(p1[1], p2[1]), hi = Math.max(p1[1], p2[1]);
      var c1y = clamp(p1[1] + (p2[1]-p0[1])/6, lo, hi), c2y = clamp(p2[1] - (p3[1]-p1[1])/6, lo, hi);
      d += ' C' + p1R(p1[0] + (p2[0]-p0[0])/6) + ',' + p1R(c1y) + ' ' + p1R(p2[0] - (p3[0]-p1[0])/6) + ',' + p1R(c2y) + ' ' + p1R(p2[0]) + ',' + p1R(p2[1]);
    }
    return d;
  }

  var P1_FIGS = [
    { id:'p1-fig1', key:'gdpIndex', hi:110, lo:90, fmt:p1Plain,
      verdict:function(v,tr,lvl){ return tr>0.05 ? [lvl==='bad'?'recovering':'growing', lvl==='bad'?'warn':'good'] : tr<-0.05 ? ['declining','bad'] : [lvl==='good'?'steady':'stagnant', lvl]; } },
    { id:'p1-fig2', key:'gdpPerCapita', hi:1760, lo:1440, fmt:function(v){ return fmtNum(v, Math.abs(v-Math.round(v))<1e-6 ? 0 : 1); },
      verdict:function(v,tr,lvl){ return tr>0.05 ? ['rising', lvl==='bad'?'warn':'good'] : tr<-0.05 ? ['falling','bad'] : ['flat', lvl]; } },
    { id:'p1-fig3', key:'wholesalePriceIndex', hi:110, lo:90, fmt:p1Plain,
      verdict:function(v,tr,lvl){ return v<97 ? ['deflationary', lvl] : v>103 ? ['inflationary', lvl] : ['stable', lvl]; } },
    { id:'p1-fig3b', key:'inflationRate', hi:4, lo:-4, zero:true, fmt:p1Signed,
      verdict:function(v,tr,lvl){ return v<0 ? ['deflationary', lvl] : v>3 ? ['inflationary', lvl] : ['stable', lvl]; } },
    { id:'p1-fig4', key:'unemploymentRate', hi:12, lo:4, fmt:p1PlainPct,
      verdict:function(v,tr,lvl){ return lvl==='bad' ? ['alarming','bad'] : lvl==='warn' ? ['elevated','warn'] : ['moderate','good']; } }
  ];

  function p1DrawFig(cfg){
    var svg = p1El(cfg.id); if(!svg) return;
    var series = p1Series(cfg.key);
    var vals = series.map(function(p){ return p[1]; });
    var lo = Math.min(cfg.lo, Math.min.apply(null, vals)), hi = Math.max(cfg.hi, Math.max.apply(null, vals));
    if(lo < cfg.lo || hi > cfg.hi){
      var pad = (hi-lo)*0.03, nb = p1NiceBounds(lo-pad, hi+pad); lo = nb[0]; hi = nb[1];
    }
    var t0 = series[0][0], t1 = series[series.length-1][0];
    function X(t){ return 26 + (t-t0)/(t1-t0)*172; }
    function Y(v){ return 10 + (hi-v)/(hi-lo)*60; }
    var cur = vals[vals.length-1], lvl = classifyMetric(cfg.key, cur);
    var trend = p1Trend(series);
    var h = '<line class="axis" x1="26" x2="26" y1="4" y2="70"></line>' +
            '<line class="axis" x1="26" x2="200" y1="70" y2="70"></line>';
    for(var yy = Math.ceil(t0 + 0.001); yy < t1 - 0.001; yy++){
      var gx = p1R(X(yy));
      h += '<line class="year-gridline" x1="' + gx + '" x2="' + gx + '" y1="4" y2="70"></line>' +
           '<text class="year-tick" text-anchor="middle" x="' + gx + '" y="80">' + yy + '</text>';
    }
    if(cfg.zero && lo < 0 && hi > 0){
      var zy = Y(0);
      h += '<line class="axis" opacity="0.5" stroke-dasharray="2,2" x1="26" x2="200" y1="' + p1R(zy) + '" y2="' + p1R(zy) + '"></line>';
      if(zy > 21 && zy < 59) h += '<text class="axis-text" text-anchor="end" x="23" y="' + p1R(zy+3.5) + '">0%</text>';
    }
    h += '<text class="axis-text" text-anchor="end" x="23" y="13.5">' + cfg.fmt(hi) + '</text>' +
         '<text class="axis-text" text-anchor="end" x="23" y="73.5">' + cfg.fmt(lo) + '</text>' +
         '<text class="year-text" x="26" y="88">' + state.history[0].quarter + '</text>' +
         '<text class="year-text" text-anchor="end" x="200" y="88">' + state.draft.quarter + '</text>';
    var pts = series.map(function(p){ return [X(p[0]), Y(p[1])]; });
    h += '<path class="plotline ' + lvl + '" d="' + p1Path(pts) + '" fill="none"></path>';
    svg.innerHTML = h;
    var vd = p1El(cfg.id + '-verdict');
    if(vd){
      var v = cfg.verdict(cur, trend, lvl);
      vd.textContent = v[0];
      vd.className = 'fig-verdict ' + v[1];
    }
  }

  function p1Lead(c){
    var m = c.m, l = c.last, d = overallBadness(m) - overallBadness(l);
    var s1 = d < -0.02 ? 'shows first signs of improvement' : (d > 0.02 ? 'has deteriorated further' : (overallBadness(m) > 0.5 ? 'remains strained' : 'remains stable'));
    var gdp = c.gdpYoy < -0.05 ? 'a contraction of the real economy' : (c.gdpYoy > 0.05 ? 'an expansion of the real economy' : 'a stable real economy');
    var wage = m.realMedianWage > l.realMedianWage ? 'rising real wages' : (m.realMedianWage < WAGE_BASE ? 'falling real wages' : 'stable real wages');
    var un = m.unemploymentRate > 15 ? 'many times above pre-war levels' : (m.unemploymentRate > 8 ? 'well above pre-war levels' : 'at a moderate level');
    return 'The economic situation of the Free State ' + s1 + '. The figures below show ' + gdp + ', ' + wage + ', and an unemployment rate ' + un + '. The Ministry hereby submits to the State Ministry its quarterly overview of the principal economic indicators.';
  }

  function p1Econ(c){
    var m = c.m, y = c.gdpYoy, gdp;
    if(y < -0.05) gdp = 'fell ' + p1Pct(y) + ' against the previous year' + '';
    else if(y > 0.05) gdp = 'rose ' + p1Pct(y) + ' against the previous year' + '';
    else gdp = 'was unchanged against the previous year';
    var out = 'Real gross domestic product ' + gdp + '. ';
    var pc = (1 - m.gdpPerCapita / GDP_PC_BASE) * 100;
    var by = p1BaseYear();
    out += pc > 0.05 ? 'Income per capita has fallen ' + p1Pct(pc) + ' since ' + by + '. '
         : pc < -0.05 ? 'Income per capita now stands ' + p1Pct(pc) + ' above its ' + by + ' level. '
         : 'Income per capita is unchanged from its ' + by + ' level. ';
    var hy = m.heavyIndustryYoY, hl = classifyMetric('heavyIndustryYoY', hy);
    if(hy > 0.05) out += 'Heavy industry has resumed growth, with output up ' + p1Pct(hy) + ' within the year.';
    else if(Math.abs(hy) <= 0.05) out += 'Heavy industry has stabilised, with output unchanged within the year.';
    else if(hl === 'bad') out += 'Heavy industry has been hit hardest, with output collapsing ' + p1Pct(hy) + ' within the year.';
    else if(hl === 'warn') out += 'Heavy industry remains under pressure, with output down ' + p1Pct(hy) + ' within the year.';
    else out += 'Heavy industry has largely stabilised, with output down ' + p1Pct(hy) + ' within the year.';
    return out + ' <span class="fig-ref">(see Fig. 1 and 2)</span>';
  }

  function p1Prices(c){
    var i = c.m.inflationRate, out = 'The wholesale price index ';
    if(i < -0.05) out += 'fell ' + p1Pct(i) + ' over the reporting period; the Ministry observes a continued deflation. Nonetheless, the memory of the currency collapse remains active among the population, further dampening savings behaviour and lending.';
    else if(i > 0.05) out += 'rose ' + p1Pct(i) + ' over the reporting period; the Ministry observes renewed inflationary pressure. The memory of the currency collapse remains active among the population, and rising prices revive fears of a repeat.';
    else out += 'was stable over the reporting period; the Ministry observes stable prices. The memory of the currency collapse remains active among the population, further dampening savings behaviour and lending.';
    return out + ' <span class="fig-ref">(see Fig. 3)</span>';
  }

  function p1Labour(c){
    var u = c.m.unemploymentRate, l = c.last.unemploymentRate;
    var prev = c.unSeries.slice(0, -1).map(function(p){ return p[1]; });
    var prevMax = Math.max.apply(null, prev);
    var isHigh = u > prevMax + 1e-9;
    var head, tail;
    if(isHigh){
      head = 'Unemployment has reached a new high of ' + p1Pct(u);
      tail = c.nFiled <= 1 ? 'The rate has risen against the previous quarter.' : 'The increase has continued and has struck heavy industry hardest.';
    } else if(u < l - 1e-9){
      head = 'Unemployment has eased to ' + p1Pct(u);
      tail = 'The rate has declined against the previous quarter.';
    } else if(u > l + 1e-9){
      head = 'Unemployment stands at ' + p1Pct(u);
      tail = 'The rate has risen against the previous quarter.';
    } else {
      head = 'Unemployment stands at ' + p1Pct(u);
      tail = 'The rate is unchanged against the previous quarter.';
    }
    return head + '; ' + fmtNum(c.m.unemployedM, 2) + ' million persons are registered with the labour exchanges. ' + tail + ' <span class="fig-ref">(see Fig. 4)</span>';
  }

  function p1Cell(idBase, key, m, valHtml, note){
    var lvl = classifyMetric(key, metricValue(key, m));
    var v = p1El(idBase + '-val'), n = p1El(idBase + '-note');
    if(v){ v.innerHTML = valHtml; v.className = 'num' + (lvl === 'good' ? '' : ' ' + lvl); }
    if(n) n.textContent = note;
  }

  function renderPage1(){
    try{
      var m = state.draft.metrics;
      var last = state.history[state.history.length-1].metrics;
      var gdpSer = p1Series('gdpIndex');
      var tCur = gdpSer[gdpSer.length-1][0];
      var c = {
        m: m, last: last, nFiled: state.history.length,
        gdpYoy: (m.gdpIndex / p1ValueAt(gdpSer, tCur - 1) - 1) * 100,
        unSeries: p1Series('unemploymentRate')
      };

      var sub = p1El('p1-subtitle');
      if(sub) sub.textContent = 'Quarterly Report to the State Ministry \u2014 ' + state.draft.quarter;
      var el;
      if((el = p1El('p1-lead'))) el.textContent = p1Lead(c);
      if((el = p1El('p1-econ-text'))) el.innerHTML = p1Econ(c);
      if((el = p1El('p1-price-text'))) el.innerHTML = p1Prices(c);
      if((el = p1El('p1-labour-text'))) el.innerHTML = p1Labour(c);

      P1_FIGS.forEach(p1DrawFig);

      // Table 1 — state budget and indebtedness
      p1Cell('p1-debt', 'debtToGdp', m, p1Pct(m.debtToGdp), (m.debtToGdp > 40 ? 'above' : 'within') + ' the 40' + NBSP + '% guideline');
      p1Cell('p1-spend', 'publicSpendingGdp', m, p1Pct(m.publicSpendingGdp), m.publicSpendingGdp < last.publicSpendingGdp - 0.05 ? 'welfare spending easing' : 'welfare spending rising');
      p1Cell('p1-mil', 'militaryGdp', m, p1Pct(m.militaryGdp), m.militaryGdp > 5 ? 'exceeds Versailles limits' : (m.militaryGdp > 4 ? 'at the edge of Versailles limits' : 'within Versailles limits'));

      // Annex — budget account and debt position
      var bal = m.revenue - m.expenditure;
      if((el = p1El('p1-deficit'))){
        el.textContent = bal < -0.005 ? 'Deficit ' + p1Trim(-bal) : (bal > 0.005 ? 'Surplus ' + p1Trim(bal) : 'Balanced');
        el.className = 'ledger-figure ' + (bal < -0.005 ? 'bad' : (bal > 0.005 ? 'good' : 'warn'));
      }
      if((el = p1El('p1-revenue'))) el.innerHTML = p1Rm(p1Trim(m.revenue) + ' bn');
      if((el = p1El('p1-expenditure'))) el.innerHTML = p1Rm(p1Trim(m.expenditure) + ' bn');
      if((el = p1El('p1-debt-fig'))){
        el.textContent = fmtNum(m.publicDebt, 2);
        el.className = 'ledger-figure ' + classifyMetric('publicDebt', m.publicDebt);
      }
      if((el = p1El('p1-debt-dom'))) el.textContent = fmtNum(m.publicDebt * DEBT_SPLIT.domestic, 2);
      if((el = p1El('p1-debt-fl'))) el.textContent = fmtNum(m.publicDebt * DEBT_SPLIT.foreignLong, 2);
      if((el = p1El('p1-debt-fs'))) el.textContent = fmtNum(m.publicDebt * DEBT_SPLIT.foreignShort, 2);
      if((el = p1El('p1-pie'))){
        var deg = (DEBT_SPLIT.domestic * 360).toFixed(1);
        el.style.background = 'conic-gradient(var(--good) 0deg ' + deg + 'deg, var(--bad) ' + deg + 'deg 360deg)';
      }

      // Table 2 — investment, wages, poverty
      var inv = classifyMetric('privateInvestmentGdp', m.privateInvestmentGdp);
      p1Cell('p1-inv', 'privateInvestmentGdp', m, p1Pct(m.privateInvestmentGdp),
        inv === 'bad' ? 'credit conditions restrictive' : (inv === 'warn' ? 'credit conditions easing' : 'credit conditions favourable'));
      var wagePct = (m.realMedianWage / WAGE_BASE - 1) * 100;
      p1Cell('p1-wage', 'realMedianWage', m, fmtNum(m.realMedianWage, 0) + NBSP + '<span class="rm">RM</span>/mo.',
        (wagePct < -0.05 ? MINUS : '+') + fmtNum(Math.abs(wagePct), 1) + NBSP + '% versus ' + p1BaseYear());
      var pov = classifyMetric('povertyRate', m.povertyRate);
      p1Cell('p1-pov', 'povertyRate', m, p1Pct(m.povertyRate),
        pov === 'bad' ? 'rural worse than urban' : (pov === 'warn' ? 'concentrated in rural districts' : 'confined to isolated districts'));
    }catch(e){
      if(window.console && console.error) console.error('Page 1 render failed:', e);
    }
  }

  function render(){
    var app = document.getElementById('app');
    if(app) app.outerHTML = buildAppHtml(state);
    attachHandlers();
    renderPage1();
    syncPrussiaMap();
    syncPollingGraph();
  }

  var PRU_UI_PARTY_ORDER = { 0:'spd', 1:'dnvp', 2:'zentrum', 3:'nlp', 4:'fdp' };
  var POLL_NATIONAL_CACHE = {};

  function syncPollingGraph(){
    try{
      if(typeof window.updatePollingData !== 'function') return;
      if(!state.history || !state.history.length) return;

      var baselineMetrics = state.history[0].metrics;
      var observationsPerQuarter = 5;
      var xOffsets = [-0.16, -0.08, 0, 0.08, 0.16];

      // Each quarter's simulator share is treated as the underlying polling
      // level. We then create several small, deterministic polling-house
      // observations around it. The variation is seeded from the quarter and
      // observation number, so re-rendering does not make the graph jump.
      var data = [];
      // Each quarter's underlying poll level is what the election simulator (the source of the
      // election-result and voter-flow charts) would return for that quarter's swings, so all
      // three charts show the same party percentages. Falls back to the Control Center's own
      // shares if the simulator is not available or has a different party line-up.
      var simReady = typeof window.pruNationalForSwings === 'function' && window.pruState &&
                     window.pruState.parties && window.pruState.parties.length === Object.keys(PRU_UI_PARTY_ORDER).length;
      var simSig = simReady ? window.pruState.parties.map(function(p){ return p.name; }).join('|') + '#' + window.pruState.base.length : '';
      state.history.forEach(function(h, qi){
        var priorMetrics = qi > 0 ? state.history[qi-1].metrics : h.metrics;
        var baselines = getAccountabilityBaselines(state.history, qi, h.metrics, h.government);
        var shares = partyShares(h.metrics, priorMetrics, h.government, baselines);
        if(simReady){
          try{
            var sw = partySwingPoints(h.metrics, priorMetrics, h.government, baselines);
            var swArr = Object.keys(PRU_UI_PARTY_ORDER).map(function(idx){ return sw[PRU_UI_PARTY_ORDER[idx]].points; });
            var ck = simSig + '@' + swArr.map(function(v){ return v.toFixed(4); }).join(',');
            if(!POLL_NATIONAL_CACHE[ck]) POLL_NATIONAL_CACHE[ck] = window.pruNationalForSwings(swArr);   // filed quarters never change, so compute each once
            var nat = POLL_NATIONAL_CACHE[ck];
            shares = shares.map(function(p){
              for(var idx in PRU_UI_PARTY_ORDER){
                if(PRU_UI_PARTY_ORDER[idx] === p.key && isFinite(nat[idx])){
                  return { key:p.key, name:p.name, color:p.color, share:nat[idx], status:p.status };
                }
              }
              return p;
            });
          }catch(e){ /* keep the Control Center shares for this quarter */ }
        }

        for(var oi = 0; oi < observationsPerQuarter; oi++){
          var row = {
            t: qi + xOffsets[oi],
            quarter: h.quarter,
            quarterIndex: qi,
            pollIndex: oi
          };

          shares.forEach(function(p, pi){
            var seed = (qi + 1) * 17.31 + (oi + 1) * 11.73 + (pi + 1) * 7.19;
            var wave1 = Math.sin(seed) * 0.72;
            var wave2 = Math.cos(seed * 1.73) * 0.34;
            var wave3 = Math.sin(seed * 0.37 + pi) * 0.22;
            var noise = wave1 + wave2 + wave3;

            // Polls naturally differ a little from one another, but stay
            // close enough to the simulator's underlying quarterly share.
            row[p.name] = Number(Math.max(0, p.share + noise).toFixed(3));
          });

          data.push(row);
        }
      });

      window.updatePollingData(data);
      window.pollingGraphData = data;
    }catch(e){
      if(window.console && console.warn) console.warn('Polling graph sync failed:', e);
    }
  }

  function syncPrussiaMap(){
    try{
      if(typeof window.pruState === 'undefined' || !window.pruState) return;
      var baselineMetrics = state.history[0].metrics;
      var priorMetrics = state.history[state.history.length-1].metrics;
      var swings = partySwingPoints(state.draft.metrics, priorMetrics, state.draft.government, getAccountabilityBaselines(state.history, null, state.draft.metrics, state.draft.government));
      Object.keys(PRU_UI_PARTY_ORDER).forEach(function(idx){
        var key = PRU_UI_PARTY_ORDER[idx];
        if(swings[key] && window.pruState.swings){
          window.pruState.swings[idx] = swings[key].points;
        }
      });
      if(typeof window.pruRenderPartyControls === 'function') window.pruRenderPartyControls();
      if(typeof window.pruRender === 'function') window.pruRender();
    }catch(e){ /* map not ready yet or failed to load; report/tracker still work */ }
  }

  function buildAppHtml(s){
    var lastFiled = s.history[s.history.length-1];
    var html = '<div id="app">';
    html += '<hr class="rule-double">';
    html += '<h2 class="section-title"><span class="num">VI.</span>Kennzahlen&#8209;Register &mdash; Control Center</h2>';
    html += '<p class="lead">This register tracks every indicator cited above, quarter by quarter, so future filings can be entered, compared, and exported without redrawing the report by hand.</p>';
    html += '<div class="cc-status">' +
        '<span>Drafting: <b>' + s.draft.quarter + '</b></span>' +
        '<span>Last filed: <b>' + lastFiled.quarter + '</b></span>' +
        '<span>Quarters on record: <b>' + s.history.length + '</b></span>' +
      '</div>';

    html += '<div class="cc-toolbar">' +
      '<button type="button" class="primary" id="btn-file">File ' + s.draft.quarter + ' &rarr;</button>' +
      '<button type="button" id="btn-undo">Undo Last Filed Quarter</button>' +
      '<button type="button" class="danger" id="btn-reset">Reset to Report Baseline</button>' +
      '<button type="button" id="btn-export-json">Export as JSON</button>' +
      '<button type="button" id="btn-export-csv">Export Ledger as CSV</button>' +
      '<label class="cc-toggle"><input type="checkbox" id="chk-links"' + (s.linkMetrics !== false ? ' checked' : '') + '> Linked metrics</label>' +
      '</div>';
    html += renderQuarterEvents(s);
    html += renderRippleNote(s);

    SECTIONS.forEach(function(sec){
      html += '<div class="cc-group"><div class="cc-group-title">' + sec.title + '</div><div class="metric-grid">';
      sec.keys.forEach(function(key){
        html += renderMetricCard(s, key);
      });
      html += '</div></div>';
    });

    html += '<hr class="rule-thin">';
    html += renderSectorsTable(s);
    html += '<hr class="rule-thin">';
    html += renderPoliticalOutlook(s);
    html += '<hr class="rule-thin">';
    html += renderLedgerTable(s);
    html += renderPoliticalLedger(s);
    html += '<p class="cc-hint">Edits are saved automatically a moment after you finish typing or leave a field. With Linked metrics on, changing a figure also moves the figures it drives; you can overwrite any of those by hand afterwards.</p>';
    html += '<div class="pagefoot">&mdash; Page 4 of 4 &mdash;</div>';
    html += '</div>';
    return html;
  }

  function historyValues(s, key){
    return s.history.map(function(h){ return metricValue(key, h.metrics); });
  }

  function renderMetricCard(s, key){
    var cfg = METRICS[key];
    var draftVal = metricValue(key, s.draft.metrics);
    var lastVal = metricValue(key, s.history[s.history.length-1].metrics);
    var cls = classifyMetric(key, draftVal);
    var series = historyValues(s, key).concat([draftVal]);
    var spark = sparklineSvg(series, cls);
    var delta = draftVal - lastVal;
    var deltaCls = delta===0 ? 'warn' : (isImprovement(key, lastVal, draftVal) ? 'good' : 'bad');
    var deltaText = (delta>0?'+':'') + fmtNum(delta, cfg.decimals) + ' vs last filed';

    var inputHtml;
    if(cfg.derived){
      inputHtml = '<div class="metric-readonly">' + fmtNum(draftVal, cfg.decimals) + '</div>';
    } else {
      inputHtml = '<input type="number" step="any" class="metric-input" data-key="' + key + '" value="' + draftVal + '">';
    }

    return '<div class="metric-card">' +
      '<div class="metric-label">' + cfg.label + '</div>' +
      '<div class="metric-input-row">' + inputHtml + '<span class="metric-unit">' + cfg.unit + '</span></div>' +
      '<div class="metric-spark">' + spark + '</div>' +
      '<div class="metric-foot"><span class="metric-delta ' + deltaCls + '">' + deltaText + '</span>' +
      '<span class="metric-badge ' + cls + '">' + cls + '</span></div>' +
      '</div>';
  }

  function renderSectorsTable(s){
    var html = '<div class="cc-table-scroll"><table class="sector-table"><caption>Table 3 &mdash; Survey of Economic Sectors (drafting ' + s.draft.quarter + ')</caption>' +
      '<thead><tr><th>Sector</th><th>Production</th><th>Employed</th><th>Output %</th><th>Debt</th><th>Profitability</th></tr></thead><tbody>';
    s.draft.sectors.forEach(function(row, i){
      html += '<tr>' +
        '<td>' + row.name + '</td>' +
        '<td>' + sectorSelect(i, 'production', row.production) + '</td>' +
        '<td><input type="number" step="0.1" class="sector-input" data-i="' + i + '" data-field="employment" value="' + row.employment + '"> M</td>' +
        '<td><input type="number" step="0.1" class="sector-input" data-i="' + i + '" data-field="output" value="' + row.output + '"> %</td>' +
        '<td>' + sectorSelect(i, 'debt', row.debt) + '</td>' +
        '<td>' + sectorSelect(i, 'profitability', row.profitability) + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function sectorSelect(i, field, current){
    var cls = SECTOR_CLASS[field][current] || 'warn';
    var html = '<select class="sector-select cc-tag ' + cls + '" data-i="' + i + '" data-field="' + field + '">';
    SECTOR_OPTIONS[field].forEach(function(opt){
      html += '<option value="' + opt + '"' + (opt===current?' selected':'') + '>' + opt + '</option>';
    });
    html += '</select>';
    return html;
  }

  function renderPoliticalOutlook(s){
    var baselineMetrics = s.history[0].metrics;
    var draftApproval = approvalRating(s.draft.metrics);
    var lastApproval = approvalRating(s.history[s.history.length-1].metrics);
    var approvalSeries = s.history.map(function(h){ return approvalRating(h.metrics); }).concat([draftApproval]);
    var appCls = classifyApproval(draftApproval);
    var appDelta = draftApproval - lastApproval;
    var appDeltaCls = appDelta===0 ? 'warn' : (appDelta>0 ? 'good' : 'bad');

    var html = '<div class="cc-group">';
    html += '<div class="cc-group-title">Political Outlook</div>';
    html += '<p class="cc-hint" style="margin-bottom:12px;">Derived from the figures above for simulation purposes; not part of the official report. Mark which parties are in government or supporting it below &mdash; those parties take the blame (or credit) for changes in economic conditions after taking office; simply entering government does not change their support. After four years in office the senior governing partner (the government party with the largest vote share) suffers incumbency fatigue, which grows steeper every quarter thereafter.</p>';
    var coalition = coalitionInfo(s.draft.government);
    html += '<div class="metric-badge ' + coalition.cls + '" style="display:inline-block;margin-bottom:14px;font-size:12px;padding:4px 9px;">' + coalition.label + '</div>';
    html += '<div class="metric-grid" style="margin-bottom:16px;">';
    html += '<div class="metric-card">' +
      '<div class="metric-label">Government Approval</div>' +
      '<div class="metric-input-row"><div class="metric-readonly">' + fmtNum(draftApproval,1) + '</div><span class="metric-unit">/ 100</span></div>' +
      '<div class="metric-spark">' + sparklineSvg(approvalSeries, appCls) + '</div>' +
      '<div class="metric-foot"><span class="metric-delta ' + appDeltaCls + '">' + (appDelta>0?'+':'') + fmtNum(appDelta,1) + ' vs last filed</span>' +
      '<span class="metric-badge ' + appCls + '">' + appCls + '</span></div>' +
      '</div>';
    html += '</div>';

    var lastHistoryIndex = s.history.length - 1;
    var priorDraftMetrics = s.history[lastHistoryIndex].metrics;
    var shares = partyShares(s.draft.metrics, priorDraftMetrics, s.draft.government, getAccountabilityBaselines(s.history, null, s.draft.metrics, s.draft.government));
    var lastShares = partyShares(s.history[lastHistoryIndex].metrics, lastHistoryIndex > 0 ? s.history[lastHistoryIndex-1].metrics : s.history[lastHistoryIndex].metrics, s.history[lastHistoryIndex].government, getAccountabilityBaselines(s.history, lastHistoryIndex, s.history[lastHistoryIndex].metrics, s.history[lastHistoryIndex].government));
    var historyShares = s.history.map(function(h, qi){
      var prior = qi > 0 ? s.history[qi-1].metrics : h.metrics;
      return partyShares(h.metrics, prior, h.government, getAccountabilityBaselines(s.history, qi, h.metrics, h.government));
    });

    html += '<div class="party-list">';
    shares.forEach(function(p, i){
      var series = historyShares.map(function(hs){ return hs[i].share; }).concat([p.share]);
      var last = lastShares[i].share;
      var delta = p.share - last;
      var deltaCls = Math.abs(delta) < 0.05 ? 'warn' : (delta>0 ? 'good' : 'bad');
      html += '<div class="party-row status-' + p.status + '">' +
        '<span class="party-dot" style="background:' + p.color + '"></span>' +
        '<span class="party-name">' + p.name + partyNote(p) + '</span>' +
        '<select class="gov-select" data-party="' + p.key + '">' +
          GOV_STATUSES.map(function(st){
            return '<option value="' + st + '"' + (st===p.status?' selected':'') + '>' + govLabel(st) + '</option>';
          }).join('') +
        '</select>' +
        '<span class="party-share">' + fmtNum(p.share,1) + '%</span>' +
        '<span class="party-spark">' + sparklineSvg(series, 'gold') + '</span>' +
        '<span class="metric-delta ' + deltaCls + '">' + (delta>0?'+':'') + fmtNum(delta,1) + '</span>' +
        '</div>';
    });
    html += '</div>';
    html += '</div>';
    return html;
  }

  function partyNote(p){
    var carry = '';
    if(Math.abs(p.lingering) > 0.05){
      carry = p.lingering < 0
        ? '<span class="party-note fatigued">Still carrying blame from office &middot; &minus;' + fmtNum(-p.lingering,1) + ' pts, fading</span>'
        : '<span class="party-note credited">Still carrying credit from office &middot; +' + fmtNum(p.lingering,1) + ' pts, fading</span>';
      if(p.status !== 'government') return carry;
    }
    return partyNoteInOffice(p) + carry;
  }

  function partyNoteInOffice(p){
    if(!p.senior){
      return p.fatigue > 0 ? '<span class="party-note fatigued">Levelled with senior partner &middot; fatigue &minus;' + fmtNum(p.fatigue,1) + ' pts</span>' : '';
    }
    var txt = 'Senior partner &middot; ' + p.tenure + ' qtrs in office';
    if(p.fatigue > 0) return '<span class="party-note fatigued">' + txt + ' &middot; fatigue &minus;' + fmtNum(p.fatigue,1) + ' pts' + (p.fatigueFactor < 0.95 ? ' (eased ' + Math.round((1-p.fatigueFactor)*100) + '% by approval)' : '') + '</span>';
    var left = FATIGUE_GRACE_QUARTERS - p.tenure;
    if(left > 0 && left <= 4) txt += ' &middot; fatigue begins in ' + left + ' qtr' + (left===1?'':'s');
    return '<span class="party-note">' + txt + '</span>';
  }

  function govLabel(st){
    if(st==='government') return 'Government';
    if(st==='support') return 'Support';
    return 'Opposition';
  }

  var COALITION_NAMES = [
    { members:['spd','zentrum','fdp'], name:'Weimarer Coalition' },
    { members:['spd','zentrum','fdp','nlp'], name:'Gro\u00dfe Koalition' },
    { members:['zentrum','fdp','nlp','dnvp'], name:'B\u00fcrgerblock' },
    { members:['nlp','dnvp'], name:'Nationale Koalition' }
  ];
  function coalitionInfo(government){
    government = government || {};
    var govKeys = PARTIES.filter(function(p){ return (government[p.key]||'opposition')==='government'; })
      .map(function(p){ return p.key; }).sort();
    if(govKeys.indexOf('spd')>=0 && govKeys.indexOf('dnvp')>=0){
      return { label:'No coalition \u2014 SPD and DNVP will not govern together', cls:'bad' };
    }
    for(var i=0;i<COALITION_NAMES.length;i++){
      var m = COALITION_NAMES[i].members.slice().sort();
      if(m.length===govKeys.length && m.every(function(k,idx){ return k===govKeys[idx]; })){
        return { label:COALITION_NAMES[i].name, cls:'good' };
      }
    }
    if(govKeys.length===0) return { label:'No party currently in government', cls:'warn' };
    if(govKeys.length===1){
      var solo = PARTIES.filter(function(p){ return p.key===govKeys[0]; })[0];
      return { label:(solo?solo.name:'Single party') + ' minority government', cls:'warn' };
    }
    return { label:'Unnamed coalition', cls:'warn' };
  }

  function renderPoliticalLedger(s){
    var baselineMetrics = s.history[0].metrics;
    var html = '<div class="cc-table-scroll"><table class="stat-table"><caption>Ledger of Political Outlook</caption><thead><tr><th>Quarter</th><th>Approval</th>';
    PARTIES.forEach(function(p){ html += '<th>' + p.name + '</th>'; });
    html += '</tr></thead><tbody>';
    s.history.forEach(function(h, qi){
      var app = approvalRating(h.metrics);
      var priorMetrics = qi > 0 ? s.history[qi-1].metrics : h.metrics;
      var shares = partyShares(h.metrics, priorMetrics, h.government, getAccountabilityBaselines(state.history, qi, h.metrics, h.government));
      html += '<tr><td>' + h.quarter + '</td><td><span class="cc-tag ' + classifyApproval(app) + '">' + fmtNum(app,1) + '</span></td>';
      shares.forEach(function(p){
        var tag = p.status==='opposition' ? '' : (' &middot; ' + govLabel(p.status) + (p.senior ? ' &middot; senior' : ''));
        var fat = p.fatigue > 0 ? '<br><small>fatigue &minus;' + fmtNum(p.fatigue,1) + ' pts</small>' : '';
        html += '<td>' + fmtNum(p.share,1) + '%' + tag + fat + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
  }

  function renderLedgerTable(s){
    var cols = ['gdpIndex','wholesalePriceIndex','inflationRate','unemploymentRate','debtToGdp','publicDebt','realMedianWage','povertyRate'];
    var html = '<div class="cc-table-scroll"><table class="stat-table"><caption>Ledger of Filed Quarters</caption><thead><tr><th>Quarter</th>';
    cols.forEach(function(c){ html += '<th>' + METRICS[c].label + '</th>'; });
    html += '</tr></thead><tbody>';
    s.history.forEach(function(h){
      html += '<tr><td>' + h.quarter + '</td>';
      cols.forEach(function(c){
        var v = metricValue(c, h.metrics);
        html += '<td><span class="cc-tag ' + classifyMetric(c, v) + '">' + fmtNum(v, METRICS[c].decimals) + '</span></td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div><p class="cc-hint">' + s.history.length + ' quarter(s) filed. The draft above is not yet part of this ledger.</p>';
    return html;
  }

  function attachHandlers(){
    var inputs = document.querySelectorAll('.metric-input');
    for(var i=0;i<inputs.length;i++){ inputs[i].addEventListener('change', onMetricChange); }
    var sInputs = document.querySelectorAll('.sector-input');
    for(i=0;i<sInputs.length;i++){ sInputs[i].addEventListener('change', onSectorChange); }
    var sSelects = document.querySelectorAll('.sector-select');
    for(i=0;i<sSelects.length;i++){ sSelects[i].addEventListener('change', onSectorChange); }
    var govSelects = document.querySelectorAll('.gov-select');
    for(i=0;i<govSelects.length;i++){ govSelects[i].addEventListener('change', onGovernmentChange); }

    var btnFile = document.getElementById('btn-file');
    if(btnFile) btnFile.addEventListener('click', fileQuarter);
    var btnUndo = document.getElementById('btn-undo');
    if(btnUndo) btnUndo.addEventListener('click', undoQuarter);
    var btnReset = document.getElementById('btn-reset');
    if(btnReset) btnReset.addEventListener('click', resetBaseline);
    var btnJson = document.getElementById('btn-export-json');
    if(btnJson) btnJson.addEventListener('click', exportJson);
    var btnCsv = document.getElementById('btn-export-csv');
    if(btnCsv) btnCsv.addEventListener('click', exportCsv);
    var chkLinks = document.getElementById('chk-links');
    if(chkLinks) chkLinks.addEventListener('change', onLinkToggle);
  }

  function attachNavHandlers(){
    var prev = document.getElementById('nav-prev');
    var next = document.getElementById('nav-next');
    if(prev) prev.addEventListener('click', function(){ showPage(state.currentPage - 1); });
    if(next) next.addEventListener('click', function(){ showPage(state.currentPage + 1); });
    var gotoButtons = document.querySelectorAll('#page-nav button[data-goto]');
    for(var i=0;i<gotoButtons.length;i++){
      gotoButtons[i].addEventListener('click', function(){
        showPage(parseInt(this.getAttribute('data-goto'),10));
      });
    }
  }

  function showPage(n){
    if(n<1) n=5; if(n>5) n=1;
    state.currentPage = n;
    for(var i=1;i<=5;i++){
      var el = document.getElementById('page-'+i);
      if(el) el.classList.toggle('active-page', i===n);
    }
    var buttons = document.querySelectorAll('#page-nav button[data-goto]');
    for(i=0;i<buttons.length;i++){
      buttons[i].classList.toggle('active', parseInt(buttons[i].getAttribute('data-goto'),10)===n);
    }
    window.scrollTo(0,0);
    state.updatedAt = Date.now();
    schedulePersist();
  }


  /* ===== Linked metrics =====
     Editing one figure now moves the figures it drives. The effect spreads outwards in
     layers (edited figure -> what it drives -> what those drive ...). Every metric moves at most
     once per edit, so nothing can loop, and you can still overwrite any dependent figure by hand
     afterwards (that edit then ripples onward from there). Toggle it off with "Linked metrics".

     types:  abs      target += k * (source change)                         (units per unit)
             rel      target *= (source_new / source_old) ^ k               (proportional / inverse)
             absToRel target *= 1 + k * (source change) / 100               (source pts -> target %)
             relToAbs target += k * (source % change)                       (source % -> target pts)   */
  var LINKS = [
    // output & real economy
    { from:'gdpIndex', to:'gdpPerCapita', type:'rel', k:1 },
    { from:'gdpIndex', to:'unemploymentRate', type:'relToAbs', k:-0.35 },
    { from:'gdpIndex', to:'heavyIndustryYoY', type:'relToAbs', k:1 },
    { from:'gdpIndex', to:'revenue', type:'rel', k:1 },
    { from:'gdpIndex', to:'privateInvestmentGdp', type:'abs', k:0.25 },
    { from:'gdpIndex', to:'debtToGdp', type:'rel', k:-1 },
    { from:'gdpIndex', to:'inflationRate', type:'relToAbs', k:0.1 },
    { from:'gdpPerCapita', to:'gdpIndex', type:'rel', k:1 },
    { from:'heavyIndustryYoY', to:'gdpIndex', type:'absToRel', k:0.12 },
    { from:'heavyIndustryYoY', to:'unemploymentRate', type:'abs', k:-0.1 },
    { from:'privateInvestmentGdp', to:'gdpIndex', type:'absToRel', k:1.5 },
    { from:'privateInvestmentGdp', to:'unemploymentRate', type:'abs', k:-0.5 },
    // labour & living standards
    { from:'unemploymentRate', to:'unemployedM', type:'rel', k:1 },
    { from:'unemploymentRate', to:'povertyRate', type:'abs', k:0.6 },
    { from:'unemploymentRate', to:'realMedianWage', type:'abs', k:-0.8 },
    { from:'unemploymentRate', to:'expenditure', type:'abs', k:0.05 },
    { from:'unemploymentRate', to:'gdpIndex', type:'absToRel', k:-0.8 },
    { from:'unemployedM', to:'unemploymentRate', type:'rel', k:1 },
    { from:'realMedianWage', to:'povertyRate', type:'abs', k:-0.15 },
    { from:'povertyRate', to:'realMedianWage', type:'abs', k:-0.3 },
    { from:'povertyRate', to:'publicSpendingGdp', type:'abs', k:0.03 },
    // prices
    { from:'wholesalePriceIndex', to:'inflationRate', type:'relToAbs', k:1 },
    { from:'inflationRate', to:'wholesalePriceIndex', type:'absToRel', k:1 },
    { from:'inflationRate', to:'realMedianWage', type:'abs', k:-0.5 },
    { from:'inflationRate', to:'privateInvestmentGdp', type:'abs', k:0.2 },
    { from:'inflationRate', to:'debtToGdp', type:'abs', k:-0.5 },
    // public finances
    { from:'revenue', to:'publicDebt', type:'abs', k:-1 },
    { from:'expenditure', to:'publicDebt', type:'abs', k:1 },
    { from:'expenditure', to:'publicSpendingGdp', type:'rel', k:1 },
    { from:'expenditure', to:'gdpIndex', type:'absToRel', k:1.63 },
    { from:'publicSpendingGdp', to:'expenditure', type:'rel', k:1 },
    { from:'militaryGdp', to:'expenditure', type:'abs', k:0.31 },
    { from:'militaryGdp', to:'heavyIndustryYoY', type:'abs', k:0.8 },
    { from:'publicDebt', to:'interestBurden', type:'rel', k:1 },
    { from:'publicDebt', to:'debtToGdp', type:'rel', k:1 },
    { from:'interestBurden', to:'expenditure', type:'abs', k:1 },
    { from:'interestBurden', to:'publicDebt', type:'rel', k:1 },
    { from:'debtToGdp', to:'interestBurden', type:'rel', k:1 },
    { from:'debtToGdp', to:'privateInvestmentGdp', type:'abs', k:-0.03 }
  ];
  var CAN_GO_NEGATIVE = { inflationRate:1, heavyIndustryYoY:1 };
  var CAPPED_AT_100 = { unemploymentRate:1, povertyRate:1, privateInvestmentGdp:1, publicSpendingGdp:1, militaryGdp:1 };
  var lastRipple = null;

  function linkDelta(L, sFrom, sTo, tBefore){
    var dS = sTo - sFrom;
    if(L.type === 'abs') return L.k * dS;
    if(L.type === 'absToRel') return tBefore * L.k * dS / 100;
    if(!sFrom || sFrom <= 0 || sTo <= 0) return 0;           // ratio-based links need positive levels
    if(L.type === 'rel') return tBefore * (Math.pow(sTo / sFrom, L.k) - 1);
    if(L.type === 'relToAbs') return L.k * 100 * (sTo / sFrom - 1);
    return 0;
  }

  function clampMetricValue(key, v){
    if(!CAN_GO_NEGATIVE[key]) v = Math.max(0, v);
    if(CAPPED_AT_100[key]) v = Math.min(100, v);
    if(key === 'gdpIndex' || key === 'gdpPerCapita' || key === 'wholesalePriceIndex') v = Math.max(1, v);
    return v;
  }

  function rippleMetrics(m, rootKey, oldRoot, newRoot){
    var before = clone(m); before[rootKey] = oldRoot;      // values as they were before this edit
    var done = {}; done[rootKey] = true;
    var frontier = {}; frontier[rootKey] = { from: oldRoot, to: newRoot };
    var changes = [], guard = 0;
    while(Object.keys(frontier).length && guard++ < 25){
      var acc = {};
      Object.keys(frontier).forEach(function(src){
        LINKS.forEach(function(L){
          if(L.from !== src || done[L.to] || METRICS[L.to].derived) return;
          var d = linkDelta(L, frontier[src].from, frontier[src].to, before[L.to]);
          if(d) acc[L.to] = (acc[L.to] || 0) + d;
        });
      });
      var next = {};
      Object.keys(acc).forEach(function(t){
        done[t] = true;
        var from = m[t];
        var to = Number(clampMetricValue(t, from + acc[t]).toFixed(METRICS[t].decimals));
        if(to !== from){ m[t] = to; changes.push({ key:t, from:from, to:to }); next[t] = { from:from, to:to }; }
      });
      frontier = next;
    }
    return { key: rootKey, from: oldRoot, to: newRoot, changes: changes };
  }

  function renderRippleNote(s){
    if(!lastRipple) return '';
    var r = lastRipple, shown = r.changes.slice(0, 8);
    var html = '<div class="cc-ripple"><b>' + METRICS[r.key].label + '</b> ' + fmtNum(r.from, METRICS[r.key].decimals) + ' &rarr; ' + fmtNum(r.to, METRICS[r.key].decimals);
    if(!r.changes.length){
      return html + ' &mdash; no linked figures moved.</div>';
    }
    html += ' also moved: ';
    html += shown.map(function(c){
      var cfg = METRICS[c.key];
      return '<span class="rp-item">' + cfg.label + ' ' + fmtNum(c.from, cfg.decimals) + ' &rarr; ' + fmtNum(c.to, cfg.decimals) + '</span>';
    }).join(' &middot; ');
    if(r.changes.length > shown.length) html += ' &middot; +' + (r.changes.length - shown.length) + ' more';
    return html + '</div>';
  }

  function renderQuarterEvents(s){
    var log = s.draft.events || [];
    var html = '<div class="cc-events"><span class="cc-events-title">Since ' + s.history[s.history.length-1].quarter + ' was filed, before any hand edits:</span>';
    if(!log.length){
      return html + '<span class="cc-events-none">Quiet quarter &mdash; only the usual background drift, nothing moved.</span></div>';
    }
    html += log.map(function(ev){
      var row = '<div class="cc-event-row"><b>' + ev.label + '</b> &mdash; ' + METRICS[ev.key].label + ' ' + fmtNum(ev.from, METRICS[ev.key].decimals) + ' &rarr; ' + fmtNum(ev.to, METRICS[ev.key].decimals);
      if(ev.changes && ev.changes.length){
        var shown = ev.changes.slice(0,6);
        row += '<span class="cc-event-moves"> &middot; also moved: ' + shown.map(function(c){
          var cfg = METRICS[c.key];
          return cfg.label + ' ' + fmtNum(c.from, cfg.decimals) + '&rarr;' + fmtNum(c.to, cfg.decimals);
        }).join(', ');
        if(ev.changes.length > shown.length) row += ' +' + (ev.changes.length - shown.length) + ' more';
        row += '</span>';
      }
      return row + '</div>';
    }).join('');
    return html + '</div>';
  }

  function onMetricChange(e){
    var key = e.target.getAttribute('data-key');
    var val = parseFloat(e.target.value);
    if(isNaN(val)) return;
    var old = state.draft.metrics[key];
    state.draft.metrics[key] = val;
    lastRipple = null;
    if(state.linkMetrics !== false && old !== val && !METRICS[key].derived){
      lastRipple = rippleMetrics(state.draft.metrics, key, old, val);
    }
    state.updatedAt = Date.now();
    render();
    schedulePersist();
  }

  function onLinkToggle(e){
    state.linkMetrics = !!e.target.checked;
    lastRipple = null;
    state.updatedAt = Date.now();
    render();
    schedulePersist();
  }

  function onSectorChange(e){
    lastRipple = null;
    var idx = parseInt(e.target.getAttribute('data-i'),10);
    var field = e.target.getAttribute('data-field');
    var val = e.target.value;
    if(field==='employment' || field==='output'){
      val = parseFloat(val);
      if(isNaN(val)) return;
    }
    state.draft.sectors[idx][field] = val;
    state.updatedAt = Date.now();
    render();
    schedulePersist();
  }

  function onGovernmentChange(e){
    lastRipple = null;
    var key = e.target.getAttribute('data-party');
    var val = e.target.value;
    if(GOV_STATUSES.indexOf(val) === -1) return;
    state.draft.government[key] = val;
    state.updatedAt = Date.now();
    render();
    schedulePersist();
  }

  function fileQuarter(){
    lastRipple = null;
    var filedLabel = state.draft.quarter;
    state.history.push({ quarter: filedLabel, metrics: clone(state.draft.metrics), sectors: clone(state.draft.sectors), government: clone(state.draft.government) });
    state.draft.quarter = nextQuarterLabel(filedLabel);
    var sim = simulateQuarter(state.draft.metrics, filedLabel);
    state.draft.metrics = sim.metrics;
    state.draft.events = sim.events;
    state.updatedAt = Date.now();
    render();
    schedulePersist();
  }

  function undoQuarter(){
    lastRipple = null;
    if(state.history.length <= 1){
      alert('The founding quarter (' + BASELINE.history[0].quarter + ') is the baseline and cannot be undone. Use "Reset to Report Baseline" instead.');
      return;
    }
    var popped = state.history.pop();
    state.draft.quarter = popped.quarter;
    state.draft.metrics = clone(popped.metrics);
    state.draft.sectors = clone(popped.sectors);
    state.draft.government = clone(popped.government);
    state.draft.events = [];
    state.updatedAt = Date.now();
    render();
    schedulePersist();
  }

  function resetBaseline(){
    lastRipple = null;
    if(!window.confirm('Reset every quarter back to the original report baseline (' + BASELINE.history[0].quarter + ')? This cannot be undone.')) return;
    var keepPage = state.currentPage;
    state = clone(BASELINE);
    state.currentPage = keepPage;
    state.updatedAt = Date.now();
    render();
    schedulePersist();
  }

  function exportJson(){
    downloadFile('kennzahlen-register.json', JSON.stringify(state, null, 2));
  }

  function exportCsv(){
    var cols = ['gdpIndex','gdpPerCapita','heavyIndustryYoY','wholesalePriceIndex','inflationRate','unemploymentRate','unemployedM','debtToGdp','publicSpendingGdp','militaryGdp','revenue','expenditure','publicDebt','interestBurden','privateInvestmentGdp','realMedianWage','povertyRate'];
    var partyCols = [];
    PARTIES.forEach(function(p){ partyCols.push(p.name); partyCols.push(p.name + ' status'); });
    var lines = ['quarter,' + cols.join(',') + ',approval,' + partyCols.join(',') + ',seniorPartner,seniorTenureQuarters,incumbencyFatiguePts'];
    var baselineMetrics = state.history[0].metrics;
    state.history.forEach(function(h, qi){
      var row = [h.quarter];
      cols.forEach(function(c){ row.push(h.metrics[c]); });
      row.push(approvalRating(h.metrics).toFixed(2));
      var priorMetrics = qi > 0 ? state.history[qi-1].metrics : h.metrics;
      var seniorInfo = { name:'', tenure:'', fatigue:'' };
      partyShares(h.metrics, priorMetrics, h.government, getAccountabilityBaselines(state.history, qi, h.metrics, h.government)).forEach(function(p){
        row.push(p.share.toFixed(2));
        row.push(p.status);
        if(p.senior) seniorInfo = { name:p.name, tenure:p.tenure, fatigue:p.fatigue.toFixed(2) };
      });
      row.push(seniorInfo.name, seniorInfo.tenure, seniorInfo.fatigue);
      lines.push(row.join(','));
    });
    downloadFile('kennzahlen-register-ledger.csv', lines.join('\n'));
  }

  function downloadFile(filename, text){
    if(window.claude && window.claude.use){
      window.claude.use('downloads').then(function(dl){
        if(dl && dl.save){
          dl.save({ filename: filename, data: text }).catch(function(){ fallbackDownload(filename, text); });
        } else {
          fallbackDownload(filename, text);
        }
      }).catch(function(){ fallbackDownload(filename, text); });
    } else {
      fallbackDownload(filename, text);
    }
  }

  function fallbackDownload(filename, text){
    try{
      var blob = new Blob([text], {type:'text/plain'});
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    }catch(e){
      window.alert('Download is not available in this view.');
    }
  }


  function init(){
    for(var i=1;i<=5;i++){
      var el = document.getElementById('page-'+i);
      if(el) el.classList.toggle('active-page', i===state.currentPage);
    }
    render();
    attachNavHandlers();
  }

  init();
})();
