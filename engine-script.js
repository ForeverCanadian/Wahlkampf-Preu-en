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

  /* ===== Political game state (Phase 2, Step 1) =====
     This is the foundation for the campaign/pledge/coalition systems planned
     for later Phase 2 steps. Nothing in this step reads or writes s.game yet
     outside of defaulting/normalizing it — it is inert scaffolding. It lives
     as a property of the same `state` object as the economic engine's
     history/draft, so it is automatically covered by the existing
     persist()/buildFullDocument()/localStorage pipeline with no changes to
     any of that plumbing.
     Party keys mirror defaultGovernment()'s (zentrum/spd/dnvp/nlp/fdp, from
     PARTIES above) so this can eventually line up with state.draft.government
     without a translation layer.
     Phase 2, Step 2 adds 'party-selection' as the first phase (see the
     party-selection screen further down) — a new game now starts there
     instead of 'governing', and only moves to 'governing' once the player
     picks a party.
     Phase 2, Step 3 inserts 'pledge-selection' right after
     'party-selection' — a new game now goes party-selection ->
     pledge-selection -> governing, only reaching 'governing' once both a
     party and a pledge are chosen. See PLEDGES / the pledge-selection
     screen further down.
     Phase 2, Step 4 wires up the 'campaign' phase already named in
     GAME_PHASES since Step 1 (nothing previously transitioned into it): a
     "Begin Campaign" toolbar button on the governing-phase Control Center
     moves phase governing -> campaign and seeds campaignWeek/campaignFunds/
     campaign (see beginCampaign() and the campaign screen further down);
     week 12's action moves campaign -> election. */
  var GAME_PHASES = ['party-selection', 'pledge-selection', 'governing', 'campaign', 'election', 'coalition-formation'];

  /* ===== Pledge definitions (Phase 2, Step 3) =====
     A small, fixed menu of pledges the player can choose from — one per
     game, chosen once at the start (no campaign/re-pledging logic yet).
     Each definition is intentionally minimal: just what's needed to show
     the pledge-selection screen and seed state.game.pledge. `relatedMetric`
     names one of the existing METRICS keys the pledge is thematically about
     (e.g. so a later step can judge fulfillment against it) but nothing
     reads that field yet — it's documentation for the next step, not wired
     to anything. `startingPopularity` seeds the runtime pledge object's
     `popularity`; nothing updates it yet either. */
  var PLEDGES = [
    { key:'stabilize-currency', name:'Stabilize the Currency',
      description:'Keep prices steady and defend the Rentenmark against renewed inflation.',
      relatedMetric:'inflationRate', startingPopularity:50 },
    { key:'cut-unemployment', name:'Reduce Unemployment',
      description:'Put idle hands back to work, especially in heavy industry and the trades.',
      relatedMetric:'unemploymentRate', startingPopularity:50 },
    { key:'balance-budget', name:'Balance the Budget',
      description:'Bring Reich spending back in line with revenue and halt the growth of public debt.',
      relatedMetric:'debtToGdp', startingPopularity:50 },
    { key:'raise-wages', name:'Raise Real Wages',
      description:'Push wages up faster than the cost of living for working families.',
      relatedMetric:'realMedianWage', startingPopularity:50 },
    { key:'expand-welfare', name:'Expand Social Insurance',
      description:'Widen unemployment, health and old-age insurance to cover more of the population.',
      relatedMetric:'povertyRate', startingPopularity:50 }
  ];

  /* Builds the runtime state.game.pledge object from a PLEDGES definition.
     This is the "proper structure" Step 3 asks for: enough fields for a
     later step to add bills/policies, move popularity, and resolve
     fulfillment, without any of those step 4+ behaviors existing yet.
     name/description are copied at selection time (rather than looked up
     from PLEDGES by key every time) so the chosen pledge keeps its text
     even if PLEDGES is edited or reordered later. */
  function makePledgeState(def){
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      status: 'active',        // 'active' | 'fulfilled' | 'broken' — no transitions wired yet
      popularity: def.startingPopularity, // 0-100 scale, matching METRICS-style numbers used elsewhere; nothing moves it yet
      bills: [],                // placeholder for linked bills/policies (Phase 2, Step 4+)
      fulfillment: null         // shape TBD — placeholder for the fulfillment system (Phase 2, Step 4+)
    };
  }

  /* ===== Campaign skeleton (Phase 2, Step 4) =====
     A minimal 12-week campaign loop: each week the player picks one
     placeholder action (logged, no mechanical effect yet — no polling
     movement, no funds raised or spent, no AI opponent behavior). Week 12's
     action is the one that ends the campaign and moves to 'election'.
     CAMPAIGN_ACTIONS is a small fixed menu, same pattern as PARTIES/
     PLEDGES above. STARTING_CAMPAIGN_FUNDS just seeds a number for the
     campaign screen to display — nothing here raises, spends, or otherwise
     touches it; that's explicitly a later step. */
  var CAMPAIGN_ACTIONS = [
    { key:'canvass', name:'Canvass the District', description:'Go door to door making the case directly to voters.' },
    { key:'speech', name:'Give a Public Speech', description:'Address a hall of supporters and undecided voters alike.' },
    { key:'press', name:'Court the Press', description:'Sit for interviews and place statements with sympathetic papers.' },
    { key:'organize', name:'Organize Local Committees', description:'Build out the party\u2019s local volunteer network.' }
  ];
  var STARTING_CAMPAIGN_FUNDS = 500; // bn RM equivalent placeholder — display only, not mechanically meaningful yet
  var CAMPAIGN_WEEKS = 12;

  function defaultGameState(){
    return {
      year: 1924,
      quarter: 'Q1 1924',       // mirrors the economic engine's quarter label format
      phase: GAME_PHASES[0],    // 'party-selection' | 'pledge-selection' | 'governing' | 'campaign' | 'election' | 'coalition-formation'
      playerParty: null,        // party key from PARTIES (e.g. 'spd'), null until chosen
      pledge: null,              // makePledgeState() result once chosen (see PLEDGES above), null until then
      campaignWeek: 0,          // 1-12 while phase==='campaign' (see beginCampaign()), 0 otherwise
      campaignFunds: 0,         // seeded to STARTING_CAMPAIGN_FUNDS when the campaign begins; nothing raises or spends it yet
      campaign: null,           // { actions: [] } once the campaign begins — one logged entry per completed week, see CAMPAIGN_ACTIONS
      election: {
        lastHeld: null,         // quarter label of the most recently held election, e.g. 'Q1 1924'
        results: null           // { parties: [{ key, votes, seats }], totalSeats } once an election runs
      },
      government: {
        coalition: [],          // array of party keys currently in government
        status: defaultGovernment() // party key -> 'opposition' | 'support' | 'government'
      }
    };
  }

  var BASELINE = {
    updatedAt: 0,
    currentPage: 1,
    game: null, // filled in below, after BASELINE.history/draft exist (defaultGameState() only needs PARTIES/defaultGovernment(), both already defined above)
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
  BASELINE.game = defaultGameState();

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
    // Backfills s.game for any state saved (localStorage) or embedded
    // (state-data) before Phase 2 Step 1 introduced it.
    if(!s.game) s.game = defaultGameState();
    if(!s.game.election) s.game.election = { lastHeld: null, results: null };
    if(!s.game.government) s.game.government = { coalition: [], status: defaultGovernment() };
    if(!s.game.government.status) s.game.government.status = defaultGovernment();
    // Phase 2 Step 4: backfills the campaign fields for any state saved
    // before this step introduced them (all Step 1-3 saves — campaignWeek
    // already existed as inert scaffolding since Step 1, but campaignFunds/
    // campaign did not). No phase-gating needed here the way party/pledge
    // selection are gated: phase could never have been 'campaign' before
    // this step existed, since nothing set it, so there's no save to
    // recover mid-campaign — only the fields themselves need defaulting.
    if(s.game.campaignWeek == null) s.game.campaignWeek = 0;
    if(s.game.campaignFunds == null) s.game.campaignFunds = 0;
    if(s.game.campaign === undefined) s.game.campaign = null;
    // Phase 2 Step 2: any state saved before 'party-selection' existed (or
    // that otherwise has no playerParty yet) is put back into the
    // party-selection phase, so the start screen still gates play — a
    // Step 1 save had phase:'governing' by default even though no party had
    // been chosen.
    // Phase 2 Step 3: once a party is chosen but no pledge has been (a
    // Step-2-era save made before pledge-selection existed, or a fresh game
    // mid-way through the new two-screen start flow), gate on
    // 'pledge-selection' the same way. These two checks are deliberately
    // exclusive (a state can't be missing playerParty AND need only the
    // pledge gate) so there's no ordering ambiguity between them.
    if(!s.game.playerParty){
      if(s.game.phase !== 'party-selection') s.game.phase = 'party-selection';
    } else if(!s.game.pledge){
      if(s.game.phase !== 'party-selection' && s.game.phase !== 'pledge-selection'){
        s.game.phase = 'pledge-selection';
      }
    }
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
    renderPartySelectOverlay();
    renderPledgeSelectOverlay();
    renderCampaignScreen();
  }

  /* ===== Party selection (Phase 2, Step 2) =====
     A game start screen shown whenever state.game.phase is 'party-selection'
     (a fresh game, or an older save normalized back into that phase — see
     normalizeState()). It is a single overlay appended to <body> and
     styled entirely with inline styles here, rather than anything added to
     elections.html's own <style id="engine-style"> block, so this feature
     stays contained to this file the same way Phase 2 Step 1 did. It is
     rebuilt by render() like everything else, and disappears on its own
     once state.game.phase moves past 'party-selection' — no other page or
     the nav bar underneath it needed any change.
     Uses its own escGame() rather than sim-script.js's esc(): the two files
     load as independent <script> tags, and sim-script.js can fail before
     defining esc() (e.g. if its constituency data files are missing) without
     stopping engine-script.js — this screen should not go down with it. */
  function escGame(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(m){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
    });
  }

  function renderPartySelectOverlay(){
    var el = document.getElementById('party-select-overlay');
    var show = state.game && state.game.phase === 'party-selection';
    if(!show){
      if(el) el.parentNode.removeChild(el);
      return;
    }
    if(!el){
      el = document.createElement('div');
      el.id = 'party-select-overlay';
      document.body.appendChild(el);
    }
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(18,14,10,0.92);'+
      'display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto;';
    var html = '<div style="background:#fbf6ea;max-width:520px;width:100%;padding:32px 36px;'+
      'border:1px solid #c9bfa5;box-shadow:0 12px 40px rgba(0,0,0,0.4);font-family:Georgia,\'EB Garamond\',serif;">';
    html += '<h2 style="margin:0 0 10px;font-size:23px;color:#202122;">Choose Your Party</h2>';
    html += '<p style="margin:0 0 22px;color:#4a4a4a;line-height:1.5;font-size:15px;">'+
      'Select the party you will lead, beginning ' + escGame(state.game.quarter) + '. This choice cannot be changed once the game begins.</p>';
    html += '<div id="party-select-list" style="display:flex;flex-direction:column;gap:10px;">';
    PARTIES.forEach(function(p){
      html += '<button type="button" class="party-select-btn" data-party="' + escGame(p.key) + '" style="'+
        'display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid #ccc2a8;'+
        'background:#fff;cursor:pointer;text-align:left;font-size:15px;font-family:inherit;color:#202122;">'+
        '<span style="width:15px;height:15px;border-radius:50%;background:' + escGame(p.color) + ';display:inline-block;flex:0 0 auto;border:1px solid rgba(0,0,0,0.15);"></span>'+
        '<span>' + escGame(p.name) + '</span>'+
      '</button>';
    });
    html += '</div></div>';
    el.innerHTML = html;
    var buttons = el.querySelectorAll('.party-select-btn');
    for(var i=0;i<buttons.length;i++){
      buttons[i].addEventListener('click', onPartySelectClick);
    }
  }

  function onPartySelectClick(e){
    onPartySelect(e.currentTarget.getAttribute('data-party'));
  }

  function onPartySelect(key){
    if(!state.game || state.game.phase !== 'party-selection') return;
    var known = PARTIES.some(function(p){ return p.key === key; });
    if(!known) return;
    state.game.playerParty = key;
    var idx = GAME_PHASES.indexOf('party-selection');
    state.game.phase = GAME_PHASES[idx+1] || 'governing';
    state.updatedAt = Date.now();
    render();
    schedulePersist();
  }

  /* ===== Pledge selection (Phase 2, Step 3) =====
     Shown whenever state.game.phase is 'pledge-selection' — normally right
     after party selection, or an older save normalized back here (see
     normalizeState()). Same pattern as the party-selection overlay just
     above it: a single <body>-level overlay, inline-styled, rebuilt by
     render(), gone once the phase moves past 'pledge-selection'. Reuses
     escGame() rather than duplicating it. */
  function renderPledgeSelectOverlay(){
    var el = document.getElementById('pledge-select-overlay');
    var show = state.game && state.game.phase === 'pledge-selection';
    if(!show){
      if(el) el.parentNode.removeChild(el);
      return;
    }
    if(!el){
      el = document.createElement('div');
      el.id = 'pledge-select-overlay';
      document.body.appendChild(el);
    }
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(18,14,10,0.92);'+
      'display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto;';
    var partyName = '';
    if(state.game.playerParty){
      var p = PARTIES.filter(function(pp){ return pp.key === state.game.playerParty; })[0];
      if(p) partyName = p.name;
    }
    var html = '<div style="background:#fbf6ea;max-width:560px;width:100%;padding:32px 36px;'+
      'border:1px solid #c9bfa5;box-shadow:0 12px 40px rgba(0,0,0,0.4);font-family:Georgia,\'EB Garamond\',serif;">';
    html += '<h2 style="margin:0 0 10px;font-size:23px;color:#202122;">Choose Your Pledge</h2>';
    html += '<p style="margin:0 0 22px;color:#4a4a4a;line-height:1.5;font-size:15px;">'+
      'As leader of the ' + escGame(partyName || 'party') + ', choose the single pledge you will campaign and govern on, beginning ' +
      escGame(state.game.quarter) + '. This choice cannot be changed once the game begins.</p>';
    html += '<div id="pledge-select-list" style="display:flex;flex-direction:column;gap:10px;">';
    PLEDGES.forEach(function(pl){
      html += '<button type="button" class="pledge-select-btn" data-pledge="' + escGame(pl.key) + '" style="'+
        'display:block;padding:12px 16px;border:1px solid #ccc2a8;'+
        'background:#fff;cursor:pointer;text-align:left;font-family:inherit;color:#202122;">'+
        '<span style="display:block;font-size:15px;font-weight:bold;margin-bottom:3px;">' + escGame(pl.name) + '</span>'+
        '<span style="display:block;font-size:13px;color:#5a5a5a;line-height:1.4;">' + escGame(pl.description) + '</span>'+
      '</button>';
    });
    html += '</div></div>';
    el.innerHTML = html;
    var buttons = el.querySelectorAll('.pledge-select-btn');
    for(var i=0;i<buttons.length;i++){
      buttons[i].addEventListener('click', onPledgeSelectClick);
    }
  }

  function onPledgeSelectClick(e){
    onPledgeSelect(e.currentTarget.getAttribute('data-pledge'));
  }

  function onPledgeSelect(key){
    if(!state.game || state.game.phase !== 'pledge-selection') return;
    var def = PLEDGES.filter(function(p){ return p.key === key; })[0];
    if(!def) return;
    state.game.pledge = makePledgeState(def);
    var idx = GAME_PHASES.indexOf('pledge-selection');
    state.game.phase = GAME_PHASES[idx+1] || 'governing';
    state.updatedAt = Date.now();
    render();
    schedulePersist();
  }

  /* ===== Campaign phase (Phase 2, Step 4) =====
     beginCampaign() is the sole entry point into the 'campaign' phase (from
     the "Begin Campaign" button shown on the governing-phase Control
     Center — see buildAppHtml()/attachHandlers()). renderCampaignScreen()
     is the weekly screen, same <body>-overlay pattern as the party/pledge
     screens: shown only while phase==='campaign', rebuilt by render(),
     removed once the phase moves past 'campaign'. onCampaignAction() logs
     the picked action for the current week (no mechanical effect — see the
     comment on CAMPAIGN_ACTIONS above) and advances campaignWeek; advancing
     past CAMPAIGN_WEEKS (12) ends the campaign and moves to 'election'. */
  function beginCampaign(){
    if(!state.game || state.game.phase !== 'governing') return;
    state.game.phase = 'campaign';
    state.game.campaignWeek = 1;
    state.game.campaignFunds = STARTING_CAMPAIGN_FUNDS;
    state.game.campaign = { actions: [] };
    state.updatedAt = Date.now();
    render();
    schedulePersist();
  }

  /* ===== Campaign UI (Phase 2, Step 5) — full-screen campaign headquarters =====
     UI ONLY. Nothing in this block changes campaign mechanics: beginCampaign()
     and onCampaignAction() are untouched, the 12-week loop, the
     CAMPAIGN_ACTIONS menu, campaignFunds and the action log behave exactly as
     before. The only interaction difference is presentational: an action
     placard *stages* the week's action, and the End Week button then calls the
     existing onCampaignAction() with it (exactly one action is still logged
     per week, and week 12 still hands off to 'election').

     Visual language: a Weimar-era political newspaper page — black ink on
     off-white newsprint, thick-thin rules, ornamental chain borders, Fraktur
     nameplate, condensed grotesque rubrics, engraved/woodcut icons, halftone
     and grain. The party colour is a second "spot ink" (rules, seals, stamps,
     misregistered numerals), never a UI fill.

     Reuse, not rewrite: the existing Prussian election map (.map-panel, #map)
     and the existing polling graph (.polling-graph-panel) are MOVED into the
     campaign screen while phase==='campaign' and put back in their original
     spot on page 5 afterwards. Moving the same nodes keeps every id, event
     listener and the syncPrussiaMap()/syncPollingGraph() plumbing working
     as-is — updatePollingData() still finds '.polling-graph-panel > svg'.

     The screen is a persistent shell (built once) with dynamic regions that are
     refilled on every render(); the two adopted panels live in slots that are
     never re-rendered. Every class here is prefixed cmp- so it cannot collide
     with the global rules in elections.html (bare svg / button / .panel /
     .hint / .title ...). */

  var CMP = {
    selected: null,       // action key staged for the current week (UI only — nothing is logged until End Week)
    selectedWeek: 0,      // week the staged action belongs to
    renderedWeek: 0,      // last week the shell rendered (drives the one-off "off the press" reveal)
    committing: false,    // guards the short stamp animation before End Week commits
    home: null            // [{node,parent,next}] where the adopted map/polling panels normally live
  };

  var CMP_ABBR = { zentrum:'Z', spd:'SPD', dnvp:'DNVP', nlp:'NLP', fdp:'FDP' };

  // Period advertising copy for the four placards (presentation only).
  var CMP_SLOGAN = { canvass:'Von Haus zu Haus!', speech:'Auf zur Versammlung!', press:'Das Wort in die Presse!', organize:'Ortsgruppen gr\u00fcnden!' };

  var CMP_CSS = `
@import url('https://fonts.googleapis.com/css2?family=League+Gothic&family=UnifrakturCook:wght@700&family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&display=swap');

html.cmp-lock, html.cmp-lock body{ overflow:hidden !important; }

.cmp-root{
  --np:#e9e3d0; --np-hi:#f3eee1; --np-lo:#d6cdb2;
  --ink:#16120d; --ink-soft:#4a4235; --ink-mid:#7d735f;
  --cmp-cond:'League Gothic','Oswald','Arial Narrow','Impact',sans-serif;
  --cmp-serif:'Old Standard TT','Vollkorn',Georgia,'Times New Roman',serif;
  --cmp-fraktur:'UnifrakturMaguntia','UnifrakturCook','Old English Text MT',Georgia,serif;
  /* fine newsprint grain + coarse mottling */
  --cmp-grain:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .18  0 0 0 0 .14  0 0 0 0 .07  0 0 0 .62 0'/></filter><rect width='100%' height='100%' filter='url(%23g)'/></svg>");
  --cmp-mottle:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'><filter id='m'><feTurbulence type='fractalNoise' baseFrequency='.011' numOctaves='3' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .34  0 0 0 0 .14  0 0 0 .55 -.12'/></filter><rect width='100%' height='100%' filter='url(%23m)'/></svg>");
  /* ornamental chain (Zierleiste) */
  --cmp-chain:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='22' height='10' viewBox='0 0 22 10'><path d='M0 5h5M17 5h5' stroke='%2316120d' stroke-width='1'/><path d='M11 .8l4.2 4.2-4.2 4.2-4.2-4.2z' fill='%2316120d'/><circle cx='5.6' cy='5' r='1' fill='%2316120d'/><circle cx='16.4' cy='5' r='1' fill='%2316120d'/></svg>");
  --cmp-dots:radial-gradient(circle at 50% 50%, var(--ink) 0 1.05px, transparent 1.45px);

  position:fixed; inset:0; z-index:9999;
  display:grid; grid-template-rows:auto minmax(0,1fr) auto auto auto; gap:9px;
  padding:16px 22px 14px; overflow:auto;
  color:var(--ink); font-family:var(--cmp-serif); font-size:14px; line-height:1.35;
  text-shadow:0 0 .5px rgba(22,18,13,.55);          /* ink spread */
  background-color:var(--np);
  background-image:var(--cmp-grain), var(--cmp-mottle), radial-gradient(140% 110% at 50% 45%, transparent 58%, rgba(96,72,28,.26) 100%);
  box-shadow:inset 0 0 0 5px var(--np), inset 0 0 0 8px var(--ink), inset 0 0 0 10px var(--np), inset 0 0 0 11px var(--ink);
}
.cmp-root *{ box-sizing:border-box; }
/* elections.html styles bare button / button:hover (rounded, white on hover) for the simulator UI; keep the placards rigid and on-paper */
.cmp-root button{ font-family:inherit; border-radius:0; text-shadow:inherit; }
.cmp-root :focus-visible{ outline:3px solid var(--ink); outline-offset:3px; box-shadow:0 0 0 6px var(--party); }
.cmp-inked{ filter:url(#cmp-ink); }

.cmp-rule{ height:7px; border-top:3px solid var(--ink); border-bottom:1px solid var(--ink); }
.cmp-chain{ height:10px; background:var(--cmp-chain) repeat-x center; }

/* ---------- header: campaign-office letterhead ---------- */
.cmp-head{
  position:relative; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:18px;
  padding:5px 2px 12px; border-top:1px solid var(--ink);
}
.cmp-head::after{ content:""; position:absolute; left:0; right:0; bottom:0; height:7px; border-top:3px solid var(--ink); border-bottom:2px solid var(--party); }
.cmp-party{ display:flex; align-items:center; gap:11px; min-width:0; }
.cmp-seal{
  flex:0 0 auto; width:42px; height:42px; border-radius:50%; display:grid; place-items:center;
  border:2px solid var(--party-deep); color:var(--party-deep); background:var(--np-hi);
  box-shadow:0 0 0 2px var(--np-hi), 0 0 0 3px var(--party-deep); font:400 17px/1 var(--cmp-cond); letter-spacing:.04em;
}
.cmp-party-name{ font:400 31px/1 var(--cmp-cond); text-transform:uppercase; letter-spacing:.07em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cmp-title{ text-align:center; margin:0; }
.cmp-title-main{ display:inline-flex; align-items:center; gap:14px; font:400 clamp(26px,3vw,42px)/1 var(--cmp-cond); text-transform:uppercase; letter-spacing:.17em; white-space:nowrap; }
.cmp-title-main::before, .cmp-title-main::after{ content:""; width:clamp(40px,7vw,110px); height:10px; background:var(--cmp-chain) repeat-x center; }
.cmp-title-sub{ display:block; margin-top:2px; font:italic 400 12.5px/1.2 var(--cmp-serif); color:var(--ink-soft); }
.cmp-week{
  justify-self:end; display:flex; align-items:baseline; gap:9px; padding:1px 14px 0;
  border:1px solid var(--ink); box-shadow:0 0 0 3px var(--np), 0 0 0 4px var(--ink); background:var(--np-hi);
}
.cmp-week-word{ font:italic 400 14px/1 var(--cmp-serif); }
.cmp-week-num{ font:400 42px/1 var(--cmp-cond); letter-spacing:.03em; display:inline-block; text-shadow:2px 1px 0 var(--party); }   /* second ink, slightly off register */
.cmp-week-of{ font:400 18px/1 var(--cmp-cond); letter-spacing:.08em; color:var(--ink-soft); }

/* ---------- main row ---------- */
.cmp-main{ display:grid; grid-template-columns:minmax(0,1.12fr) minmax(0,1fr); gap:20px; min-height:0; padding:4px 4px 0; }
.cmp-side{ display:grid; grid-template-rows:minmax(0,1fr) auto; gap:20px; min-height:0; min-width:0; }

/* boxed, printed-in illustrations */
.cmp-sheet{
  position:relative; min-width:0; min-height:0; display:flex; flex-direction:column;
  background-color:var(--np-hi); background-image:var(--cmp-grain);
  border:3px solid var(--ink); box-shadow:0 0 0 3px var(--np), 0 0 0 4px var(--ink);
}
.cmp-rubric{
  flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:1px 12px 0; background:var(--ink); color:var(--np-hi); text-shadow:none;
  font:400 19px/1.3 var(--cmp-cond); letter-spacing:.2em; text-transform:uppercase;
}
.cmp-rubric > span:first-child::before{ content:""; display:inline-block; width:8px; height:8px; margin:0 9px 1px 0; background:var(--party-lit); transform:rotate(45deg); }
.cmp-map-slot > .map-panel, .cmp-poll-slot > .polling-graph-panel{ margin:0; }
.cmp-empty{ margin:auto; padding:18px; text-align:center; font:italic 400 14px/1.4 var(--cmp-serif); color:var(--ink-soft); }

/* adopted existing panels: keep their behaviour, retire their web-app skin */
.cmp-root .panel{ background:transparent; border:0; border-radius:0; box-shadow:none; }
.cmp-map-slot .map-panel{
  padding:8px 14px 8px; flex:1; min-height:0; display:grid; gap:2px 12px;
  grid-template-columns:auto minmax(0,1fr); grid-template-rows:auto auto minmax(0,1fr);
  grid-template-areas:"head head" "shade mode" "map map";
}
.cmp-map-slot .map-head{ grid-area:head; margin:0; align-items:baseline; }
.cmp-map-slot .shade-key{ grid-area:shade; margin:0; align-self:center; }
.cmp-map-slot .map-mode-bar{ grid-area:mode; margin:0; }
.cmp-map-slot .map-wrap{ grid-area:map; margin:4px 0 0; min-height:0; overflow:hidden; }
.cmp-map-slot #map{ width:100%; height:100%; }
.cmp-root .hl{ color:var(--ink); font-size:19px; }
.cmp-root .legend{ gap:4px 14px; font-size:12px; }
.cmp-root .hint, .cmp-root .shade-key, .cmp-root .map-mode-bar label, .cmp-root .choro-legend{ color:var(--ink-soft); }
.cmp-root .map-mode-bar select{
  background:var(--np-hi); color:var(--ink); border:1px solid var(--ink); border-radius:0;
  font:400 13px var(--cmp-serif); padding:2px 6px; min-width:160px;
}
.cmp-root .map-hover-info{ background:var(--np-hi); border:2px solid var(--ink); border-radius:0; box-shadow:0 0 0 2px var(--np-hi), 0 0 0 3px var(--ink); }
.cmp-root .swatch.unowned{ border-color:var(--ink-mid); }

.cmp-poll-slot .polling-graph-panel{ padding:6px 12px 8px !important; flex:1; min-height:0; display:flex; }
.cmp-poll-slot .polling-graph-panel > svg{ width:100%; height:100%; mix-blend-mode:multiply; }   /* the chart's white ground prints as newsprint */
.cmp-zoom-btn{
  cursor:pointer; background:var(--np-hi); color:var(--ink); border:1px solid var(--np-hi); padding:0 9px;
  font:400 15px/1.35 var(--cmp-cond); letter-spacing:.14em; text-transform:uppercase; text-shadow:none;
}
.cmp-root .cmp-zoom-btn{ background-color:var(--np-hi); }
.cmp-root .cmp-zoom-btn:hover{ background-color:var(--party-lit); color:var(--ink); }
.cmp-poll-slot.cmp-zoom{ position:fixed; left:4vw; right:4vw; top:5vh; bottom:5vh; z-index:10; box-shadow:0 0 0 100vmax rgba(14,11,7,.78), 0 0 0 3px var(--np), 0 0 0 4px var(--ink); }
.cmp-poll-slot.cmp-zoom .polling-graph-panel{ padding:16px 22px 18px !important; }

.cmp-map-slot::after, .cmp-you::after{
  content:""; position:absolute; pointer-events:none; opacity:.3; background:var(--cmp-dots) 0 0 / 5px 5px;
}
.cmp-map-slot::after{ left:0; bottom:0; width:38%; height:34%; -webkit-mask-image:radial-gradient(circle at 0 100%, #000, transparent 70%); mask-image:radial-gradient(circle at 0 100%, #000, transparent 70%); }
.cmp-you::after{ right:0; bottom:0; width:34%; height:60%; -webkit-mask-image:radial-gradient(circle at 100% 100%, #000, transparent 70%); mask-image:radial-gradient(circle at 100% 100%, #000, transparent 70%); }

/* ---------- your campaign: printed notice ---------- */
.cmp-you{ display:grid; grid-template-columns:minmax(0,1.2fr) minmax(0,1fr); gap:6px 22px; align-content:start; padding:0 16px 10px; overflow:hidden; }
.cmp-you-head{ grid-column:1 / -1; margin:0 -16px 5px; }
.cmp-you-head .cmp-rubric-title{ margin:0; font:inherit; letter-spacing:inherit; text-transform:inherit; }
.cmp-stamp{
  display:inline-block; padding:0 8px; border:2px solid var(--np-hi); color:var(--np-hi);
  font:400 14px/1.35 var(--cmp-cond); letter-spacing:.2em; text-transform:uppercase; transform:rotate(-3deg);
}
.cmp-pledge-name{ margin:0 0 2px; font:700 21px/1.1 var(--cmp-serif); }
.cmp-pledge-desc{ margin:0; font:italic 400 13px/1.28 var(--cmp-serif); color:var(--ink-soft); }
.cmp-you-stats{ display:grid; gap:6px; align-content:start; }
.cmp-meter-row{ display:grid; grid-template-columns:auto 1fr auto; align-items:center; gap:9px; font-size:13px; }
.cmp-meter{ position:relative; height:12px; border:1px solid var(--ink);
  background-image:repeating-linear-gradient(90deg, transparent 0 9.4%, var(--ink) 9.4% 10%); }
.cmp-meter > i{ position:absolute; left:0; top:0; bottom:0; background:var(--party); box-shadow:inset 0 0 0 1px var(--party-deep); }
.cmp-meter-val{ font:400 20px/1 var(--cmp-cond); letter-spacing:.05em; }
.cmp-poll-line{ margin:0; font-size:13px; line-height:1.3; }
.cmp-poll-line b{ font:400 21px/1 var(--cmp-cond); letter-spacing:.04em; color:var(--party-deep); text-shadow:none; }
.cmp-cal{ grid-column:1 / -1; display:grid; grid-template-columns:repeat(12,minmax(0,1fr)); margin-top:5px; border:1px solid var(--ink); }
.cmp-cal-cell{
  --ic-fill:var(--ink); --ic-cut:var(--np-hi);
  position:relative; height:27px; display:grid; place-items:center; background:var(--np-hi);
  font:400 16px/1 var(--cmp-cond); letter-spacing:.04em; color:var(--ink-soft);
}
.cmp-cal-cell + .cmp-cal-cell{ border-left:1px solid var(--ink); }
.cmp-cal-cell.is-done{ --ic-fill:var(--np-hi); --ic-cut:var(--ink); background:var(--ink); color:var(--np-hi); }
.cmp-cal-cell.is-now{ background:var(--party); color:var(--party-ink); box-shadow:inset 0 0 0 2px var(--np-hi), inset 0 0 0 3px var(--ink); }
.cmp-cal-cell svg.cmp-ico{ width:19px; height:19px; }

/* ---------- action placards (Anschlag / newspaper advertisements) ---------- */
.cmp-actions{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:22px; padding:6px 4px 3px; }
.cmp-act{
  --ic-fill:var(--ink); --ic-cut:var(--np-hi);
  position:relative; display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; gap:13px; text-align:left;
  padding:9px 14px 9px 11px; cursor:pointer; color:var(--ink); border:3px solid var(--ink); min-height:84px;
  background-color:var(--np-hi); background-image:var(--cmp-grain);
  box-shadow:inset 0 0 0 3px var(--np-hi), inset 0 0 0 4px var(--ink), 0 0 0 3px var(--np), 0 0 0 4px var(--ink);
  transition:transform .12s ease;
}
/* corner ornaments differ per advertisement, like separate ads on a page */
.cmp-act::before{ content:""; position:absolute; left:8px; right:8px; top:6px; height:5px; background:var(--cmp-chain) repeat-x center / 22px 5px; opacity:.85; pointer-events:none; }
.cmp-act--speech::before{ background:var(--cmp-dots) repeat-x center / 6px 5px; }
.cmp-act--press::before{ background:repeating-linear-gradient(-45deg, var(--ink) 0 1px, transparent 1px 4px); height:4px; }
.cmp-act--organize::before{ background:repeating-linear-gradient(90deg, var(--ink) 0 5px, transparent 5px 10px); height:2px; top:8px; }
.cmp-root .cmp-act:hover{ background-color:var(--np-lo); transform:translateY(-2px); }
.cmp-act-medal{
  position:relative; width:60px; height:60px; border-radius:50%; display:grid; place-items:center; margin-top:5px;
  border:2px solid var(--ink); box-shadow:0 0 0 2px var(--np-hi), 0 0 0 3px var(--party-deep);
  background-image:var(--cmp-dots); background-size:4px 4px; background-color:var(--np-hi);
}
.cmp-act svg.cmp-ico{ width:44px; height:44px; }
.cmp-act-slogan{ display:block; margin-top:5px; font:italic 400 12.5px/1.1 var(--cmp-serif); color:var(--ink-soft); }
.cmp-act-name{ display:block; font:400 31px/.98 var(--cmp-cond); text-transform:uppercase; letter-spacing:.045em; filter:url(#cmp-ink); }
.cmp-act-desc{ display:block; margin-top:3px; padding-top:3px; border-top:1px solid var(--ink); font:400 12px/1.25 var(--cmp-serif); color:var(--ink-soft); }
/* staged action: the placard prints in reverse (white on black ink) with a spot-colour tab */
.cmp-act[aria-pressed="true"], .cmp-root .cmp-act[aria-pressed="true"]:hover{
  --ic-fill:var(--np-hi); --ic-cut:var(--ink); color:var(--np-hi); background-color:var(--ink); transform:translateY(-3px);
  box-shadow:inset 0 0 0 3px var(--ink), inset 0 0 0 4px var(--np-hi), 0 0 0 3px var(--np), 0 0 0 4px var(--ink);
}
.cmp-act[aria-pressed="true"]::before{ filter:invert(1); }
.cmp-act[aria-pressed="true"] .cmp-act-slogan, .cmp-act[aria-pressed="true"] .cmp-act-desc{ color:var(--np-lo); border-color:var(--np-lo); }
.cmp-act[aria-pressed="true"] .cmp-act-medal{ border-color:var(--np-hi); background-color:var(--ink); background-image:radial-gradient(circle at 50% 50%, rgba(243,238,225,.4) 0 1px, transparent 1.4px); box-shadow:0 0 0 2px var(--ink), 0 0 0 3px var(--party-lit); }
.cmp-act[aria-pressed="true"]::after{
  content:"This week"; position:absolute; right:12px; top:-13px; padding:0 11px 0 12px; z-index:2;
  background:var(--party); color:var(--party-ink); font:400 17px/1.4 var(--cmp-cond); letter-spacing:.14em; text-transform:uppercase; text-shadow:none;
  border:2px solid var(--ink); transform:rotate(2deg);
}
.cmp-ico .f{ fill:var(--ic-fill,currentColor); }
.cmp-ico .c{ stroke:var(--ic-cut,#f3eee1); fill:none; }
.cmp-ico .o{ stroke:var(--ic-fill,currentColor); fill:none; }

/* ---------- the newspaper ---------- */
.cmp-news{ padding:5px 16px 8px; border-width:4px; box-shadow:0 0 0 3px var(--np), 0 0 0 5px var(--ink); }
.cmp-news-inner{ display:flex; flex-direction:column; min-width:0; }
.cmp-np-head{ display:grid; grid-template-columns:minmax(150px,1fr) auto minmax(150px,1fr); align-items:center; gap:14px; padding:2px 0 0; }
.cmp-np-title{ font:400 clamp(38px,7.2vh,68px)/1 var(--cmp-fraktur); text-align:center; white-space:nowrap; letter-spacing:.01em; padding:0 6px; }
.cmp-np-ear{ justify-self:start; display:flex; align-items:center; gap:10px; padding:3px 12px 3px 9px; border:1px solid var(--ink); box-shadow:0 0 0 2px var(--np-hi), 0 0 0 3px var(--ink); min-height:46px; }
.cmp-np-ear.r{ justify-self:end; justify-content:flex-end; text-align:right; padding:3px 9px 3px 12px; }
.cmp-np-ear b{ display:block; font:400 21px/1 var(--cmp-cond); letter-spacing:.1em; text-transform:uppercase; }
.cmp-np-ear i{ display:block; font:italic 400 12px/1.15 var(--cmp-serif); color:var(--ink-soft); }
.cmp-vig{ position:relative; flex:0 0 auto; width:46px; height:40px; display:grid; place-items:center; }
.cmp-vig::before{ content:""; position:absolute; inset:0; border-radius:50%; background:var(--cmp-dots) 0 0 / 4px 4px; opacity:.5; -webkit-mask-image:radial-gradient(circle, #000 30%, transparent 72%); mask-image:radial-gradient(circle, #000 30%, transparent 72%); }
.cmp-vig svg{ position:relative; width:42px; height:38px; color:var(--ink); }
.cmp-np-dateline{
  display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:14px; margin:3px 0 6px; padding:1px 0;
  border-top:3px solid var(--ink); border-bottom:1px solid var(--ink);
  font:italic 400 12px/1.5 var(--cmp-serif);
}
.cmp-np-dateline > :last-child{ text-align:right; }
.cmp-np-dateline .cmp-chain{ width:120px; height:8px; background-size:22px 8px; }
.cmp-np-dateline b{ font:400 15px/1 var(--cmp-cond); font-style:normal; letter-spacing:.1em; text-transform:uppercase; }
.cmp-np-body{ display:grid; grid-template-columns:minmax(0,2.35fr) minmax(0,1.15fr) minmax(0,1.1fr) minmax(0,1.2fr); align-items:stretch; }
.cmp-np-body > *{ padding:0 14px; min-width:0; }
.cmp-np-body > * + *{ border-left:1px solid var(--ink); }
.cmp-np-body > :first-child{ padding-left:0; }
.cmp-np-body > :last-child{ padding-right:0; }
.cmp-lead h3{ margin:0; font:700 clamp(21px,2.5vw,34px)/1.03 var(--cmp-serif); letter-spacing:-.01em; filter:url(#cmp-ink); }
.cmp-lead h4{ margin:3px 0 4px; padding:2px 0; border-top:1px solid var(--ink); border-bottom:1px solid var(--ink); font:italic 700 13.5px/1.25 var(--cmp-serif); }
.cmp-lead p, .cmp-col p{ margin:0; font-size:12.5px; line-height:1.32; text-align:justify; hyphens:auto; }
/* The lead paragraph's length varies week to week (projection sentence or pledge blurb), which used to
   grow/shrink #cmp-np-body's auto height and, with it, the shared flexible row above (cmp-main) that the
   map and polling graph fill at width/height:100% — reading as the map/graph "zooming" each week. Clamping
   this paragraph to a fixed number of lines (and reserving that space even when the text is shorter) keeps
   #cmp-np-body's height constant regardless of what the week's story actually says. */
.cmp-lead p{ display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; min-height:calc(12.5px * 1.32 * 3); }
.cmp-lead p::first-letter{ float:left; font:400 40px/.78 var(--cmp-fraktur); padding:3px 5px 0 0; color:var(--party-deep); text-shadow:none; }
.cmp-col h5{ margin:0 0 4px; padding:0 0 1px; border-bottom:2px solid var(--ink); font:400 18px/1.1 var(--cmp-cond); letter-spacing:.16em; text-transform:uppercase; }
.cmp-col h5 small{ font:italic 400 12px/1 var(--cmp-serif); letter-spacing:0; text-transform:none; color:var(--ink-soft); margin-left:4px; }
.cmp-tag{ font-style:italic; font-weight:700; }
/* Reserves room for the full 3 entries (cmpFillNews only shows the log once entries exist, growing from 1
   to 3 over the first few weeks) so the Chronik column's height doesn't grow week to week either. */
.cmp-chron{ list-style:none; margin:0; padding:0; font-size:12.5px; min-height:calc((12.5px * 1.25 + 2px + 1px) * 3); }
.cmp-chron li{ display:flex; gap:6px; align-items:baseline; padding:1px 0; border-bottom:1px dotted var(--ink-mid); line-height:1.25; }
.cmp-chron li b{ font:400 15px/1 var(--cmp-cond); letter-spacing:.08em; text-transform:uppercase; flex:0 0 auto; }
.cmp-polls{ list-style:none; margin:0; padding:0; display:grid; gap:1px; }
.cmp-polls li{ display:grid; grid-template-columns:38px minmax(0,1fr) auto; align-items:center; gap:6px; font-size:12px; line-height:1.15; }
.cmp-polls .cmp-bar{ height:8px; border:1px solid var(--ink); }
.cmp-polls .cmp-bar i{ display:block; height:100%; background:var(--c); }
.cmp-polls li.is-you{ font-weight:700; }
.cmp-polls li.is-you .cmp-bar{ box-shadow:0 0 0 1px var(--np-hi), 0 0 0 2px var(--ink); }
.cmp-polls .cmp-abbr{ font:400 16px/1 var(--cmp-cond); letter-spacing:.06em; }
.cmp-polls .cmp-pct{ text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; min-width:42px; }
.cmp-polls .cmp-pct small{ display:inline-block; min-width:30px; margin-left:5px; font:italic 400 10.5px/1 var(--cmp-serif); color:var(--ink-soft); }
.cmp-fx-line{ font-size:12px; color:var(--ink-soft); }
.cmp-fx-line b{ font:400 15px/1 var(--cmp-cond); letter-spacing:.05em; color:var(--ink); text-shadow:none; }
.cmp-print{ animation:cmp-print .75s steps(16,end) both; }
@keyframes cmp-print{ from{ clip-path:inset(0 0 100% 0); } to{ clip-path:inset(0 0 0 0); } }

/* ---------- footer: treasury + End Week ---------- */
.cmp-foot{ position:relative; display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:20px; padding:12px 6px 4px; }
.cmp-foot::before{ content:""; position:absolute; left:0; right:0; top:0; height:7px; border-top:1px solid var(--ink); border-bottom:3px solid var(--ink); }
.cmp-funds{ display:flex; align-items:baseline; gap:12px; }
.cmp-funds-label{ font:italic 400 14px/1 var(--cmp-serif); color:var(--ink-soft); }
.cmp-funds-num{ font:400 40px/1 var(--cmp-cond); letter-spacing:.04em; font-variant-numeric:tabular-nums; text-shadow:2px 1px 0 var(--party); }
.cmp-funds-num .cmp-rm{ font-size:.55em; margin-left:7px; letter-spacing:.14em; text-shadow:none; color:var(--ink-soft); }
.cmp-foot-note{ text-align:center; font:italic 400 14px/1.3 var(--cmp-serif); color:var(--ink-soft); }
.cmp-foot-note b{ font-style:normal; font-weight:700; color:var(--ink); }
.cmp-end{
  position:relative; cursor:pointer; padding:5px 26px 9px 24px; border:3px solid var(--ink);
  background-color:var(--ink); background-image:var(--cmp-grain); color:var(--np-hi); text-shadow:none;
  font:400 32px/1 var(--cmp-cond); letter-spacing:.13em; text-transform:uppercase; white-space:nowrap;
  box-shadow:inset 0 0 0 2px var(--ink), inset 0 0 0 3px var(--np-hi), 0 0 0 3px var(--np), 0 0 0 4px var(--ink);
  transition:transform .09s ease;
}
.cmp-end::after{ content:""; position:absolute; left:8px; right:8px; bottom:6px; height:3px; background:var(--party-lit); }
.cmp-root .cmp-end, .cmp-root .cmp-end:hover{ background-color:var(--ink); }
.cmp-end:hover:not(:disabled){ transform:translateY(-2px); }
.cmp-end:disabled, .cmp-root .cmp-end:disabled:hover{ cursor:not-allowed; background-color:transparent; background-image:none; color:var(--ink-soft); border:3px dashed var(--ink-soft); box-shadow:none; }
.cmp-end:disabled::after{ display:none; }
.cmp-end.cmp-stamping{ transform:translateY(5px) scale(.985); box-shadow:inset 0 0 0 2px var(--ink), inset 0 0 0 3px var(--np-hi), 0 0 0 3px var(--np), 0 0 0 4px var(--ink); }

/* ---------- smaller screens ---------- */
@media (max-height:1000px) and (min-width:901px){
  .cmp-root{ gap:7px; padding:12px 20px 10px; }
  .cmp-head{ padding:3px 2px 10px; }
  .cmp-seal{ width:36px; height:36px; font-size:15px; }
  .cmp-party-name{ font-size:26px; }
  .cmp-title-main{ font-size:clamp(24px,2.7vw,34px); }
  .cmp-title-sub{ font-size:12px; margin-top:0; }
  .cmp-week{ padding:0 12px; }
  .cmp-week-num{ font-size:34px; }
  .cmp-main{ gap:16px; padding-top:2px; }
  .cmp-side{ gap:16px; }
  .cmp-actions{ gap:18px; padding-top:4px; }
  .cmp-act{ min-height:70px; padding:8px 12px 8px 10px; gap:11px; }
  .cmp-act-medal{ width:50px; height:50px; margin-top:4px; }
  .cmp-act svg.cmp-ico{ width:37px; height:37px; }
  .cmp-act-slogan{ display:none; }
  .cmp-act-name{ font-size:26px; }
  .cmp-act-desc{ font-size:11.5px; line-height:1.2; margin-top:2px; }
  .cmp-news{ padding:4px 16px 6px; }
  .cmp-np-title{ font-size:clamp(34px,5.3vh,58px); }
  .cmp-np-ear{ min-height:0; padding:2px 8px; }
  .cmp-np-ear b{ font-size:19px; }
  .cmp-vig{ width:38px; height:32px; }
  .cmp-vig svg{ width:34px; height:30px; }
  .cmp-np-dateline{ margin:2px 0 5px; }
  .cmp-lead h3{ font-size:clamp(20px,3.1vh,30px); }
  .cmp-lead h4{ margin:3px 0 0; }
  .cmp-lead p{ display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; margin-top:3px; }
  .cmp-col h5{ font-size:17px; margin-bottom:3px; }
  .cmp-polls li{ font-size:11.5px; line-height:1.05; }
  .cmp-polls .cmp-abbr{ font-size:14px; }
  .cmp-polls .cmp-bar{ height:7px; }
  .cmp-foot{ padding-top:10px; }
  .cmp-funds-num{ font-size:34px; }
  .cmp-end{ font-size:27px; padding:4px 22px 8px 20px; }
  .cmp-you{ gap:4px 20px; padding-bottom:8px; }
  .cmp-pledge-name{ font-size:19px; }
  .cmp-pledge-desc{ font-size:12.5px; }
  .cmp-cal-cell{ height:24px; }
  .cmp-cal-cell svg.cmp-ico{ width:17px; height:17px; }
}
@media (max-height:800px) and (min-width:901px){
  .cmp-root{ gap:6px; padding:10px 18px 8px; }
  .cmp-title-sub{ display:none; }
  .cmp-head{ padding-bottom:8px; }
  .cmp-rubric{ font-size:17px; line-height:1.25; }
  .cmp-act{ min-height:54px; }
  .cmp-act-desc{ display:none; }
  .cmp-act-name{ font-size:25px; }
  .cmp-act-medal{ width:44px; height:44px; margin-top:3px; }
  .cmp-act svg.cmp-ico{ width:33px; height:33px; }
  .cmp-np-title{ font-size:clamp(28px,4.9vh,42px); }
  .cmp-np-ear{ display:none; }
  .cmp-np-head{ grid-template-columns:1fr; }
  .cmp-np-dateline{ display:none; }
  .cmp-lead h3{ font-size:clamp(18px,2.9vh,24px); }
  .cmp-lead h4{ display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden; }
  .cmp-lead p{ display:none; }
  .cmp-pledge-desc{ display:none; }
  .cmp-you-stats{ grid-column:2; }
  .cmp-foot{ padding-top:8px; }
  .cmp-funds-num{ font-size:30px; }
  .cmp-end{ font-size:24px; padding:3px 20px 7px 18px; }
  .cmp-main{ min-height:380px; }
}
@media (max-width:1180px){
  .cmp-actions{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .cmp-np-body{ grid-template-columns:minmax(0,1fr) minmax(0,1fr); row-gap:12px; }
  .cmp-np-body > *{ border-left:0 !important; padding:0 8px; }
}
@media (max-width:900px){
  .cmp-root{ display:flex; flex-direction:column; gap:14px; padding:14px 16px 12px; }
  .cmp-root > *{ flex:0 0 auto; }
  .cmp-head{ grid-template-columns:1fr auto; }
  .cmp-title{ grid-column:1 / -1; grid-row:2; }
  .cmp-title-main::before, .cmp-title-main::after{ display:none; }
  .cmp-main{ display:flex; flex-direction:column; gap:20px; min-height:0; }
  .cmp-map-slot{ height:min(118vw,620px); }
  .cmp-map-slot .map-panel{ grid-template-columns:minmax(0,1fr); grid-template-rows:auto auto auto minmax(0,1fr); grid-template-areas:"head" "shade" "mode" "map"; }
  .cmp-root .map-mode-bar select{ min-width:0; max-width:100%; }
  .cmp-side{ display:flex; flex-direction:column; gap:20px; }
  .cmp-poll-slot{ height:min(70vw,460px); }
  .cmp-you{ grid-template-columns:1fr; }
  .cmp-actions{ grid-template-columns:1fr; }
  .cmp-np-head{ grid-template-columns:1fr; }
  .cmp-np-title{ font-size:9.4vw; white-space:normal; line-height:1.05; }
  .cmp-np-ear{ display:none; }
  .cmp-np-body{ grid-template-columns:1fr; }
  .cmp-np-body > *{ padding:0 !important; }
  .cmp-np-dateline{ grid-template-columns:1fr; text-align:center; }
  .cmp-np-dateline > :last-child{ text-align:center; }
  .cmp-np-dateline .cmp-chain{ display:none; }
  .cmp-foot{ grid-template-columns:1fr; text-align:center; gap:8px; }
  .cmp-funds{ justify-content:center; }
  .cmp-end{ width:100%; }
  .cmp-party-name{ font-size:24px; }
}
@media (prefers-reduced-motion:reduce){
  .cmp-root *, .cmp-root *::before, .cmp-root *::after{ animation:none !important; transition:none !important; }
}
`;

  function cmpEnsureStyles(){
    if(document.getElementById('campaign-ui-style')) return;
    var st = document.createElement('style');
    st.id = 'campaign-ui-style';
    st.textContent = CMP_CSS;
    document.head.appendChild(st);
  }

  /* ---- small helpers ---- */
  function cmpPartyDef(key){
    return PARTIES.filter(function(p){ return p.key === key; })[0] || PARTIES[0];
  }
  // The map, the polling graph and the party legend all draw with pruState's party colours
  // (editable in the simulator), so the campaign's spot ink reads from there when available.
  function cmpPartyColor(def){
    var color = def.color;
    try{
      var pp = window.pruState && window.pruState.parties;
      Object.keys(PRU_UI_PARTY_ORDER).forEach(function(i){
        if(PRU_UI_PARTY_ORDER[i] === def.key && pp && pp[i] && /^#[0-9a-f]{6}$/i.test(pp[i].color||'')) color = pp[i].color;
      });
    }catch(e){}
    return color;
  }
  function cmpRgb(hex){
    var n = parseInt(String(hex).replace('#',''), 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
  }
  function cmpLum(hex){
    var c = cmpRgb(hex);
    return (0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]) / 255;
  }
  function cmpInkFor(hex){ return cmpLum(hex) > 0.56 ? '#16120d' : '#f3eee1'; }
  function cmpHex(c){
    return '#' + c.map(function(v){ v = Math.max(0, Math.min(255, Math.round(v))); return (v<16?'0':'') + v.toString(16); }).join('');
  }
  function cmpDeepen(hex, k){   // toward black: party colour as legible ink on newsprint
    return cmpHex(cmpRgb(hex).map(function(v){ return v*(1-k); }));
  }
  function cmpLift(hex, k){     // toward white: party colour as legible ink on black (very dark parties only)
    return cmpLum(hex) < 0.3 ? cmpHex(cmpRgb(hex).map(function(v){ return v + (255-v)*k; })) : hex;
  }
  function cmpElectionLabel(){
    var q = state.draft && state.draft.quarter, m = /(\d{4})/.exec(q || '');
    var year = m ? m[1] : (state.game && state.game.year) || '';
    return 'Reichstagswahl ' + year;
  }
  function cmpPad2(n){ return (n < 10 ? '0' : '') + n; }
  function cmpActionDef(key){
    return CAMPAIGN_ACTIONS.filter(function(a){ return a.key === key; })[0];
  }

  // Latest polling for the campaign screen. During the campaign this is the stored weekly tracker
  // (state.game.campaign.polls / .baseline, the same numbers the polling graph draws around) with the change
  // since the previous poll; otherwise the latest quarter's polling averaged from the graph data.
  function cmpLatestPolls(){
    var c = state.game && state.game.phase === 'campaign' && state.game.campaign;
    if(c && c.baseline && c.baseline.national){
      var lastP = c.polls && c.polls.length ? c.polls[c.polls.length-1] : { week:0, shares:c.baseline.national };
      var prevS = c.polls && c.polls.length ? (c.polls.length > 1 ? c.polls[c.polls.length-2].shares : c.baseline.national) : null;
      var rowsC = PARTIES.map(function(p){
        var v = Number(lastP.shares[p.key]) || 0;
        return { key:p.key, name:p.name, abbr:CMP_ABBR[p.key] || p.key.toUpperCase(), color:cmpPartyColor(p), share:v,
                 delta: prevS ? v - (Number(prevS[p.key]) || 0) : null };
      });
      rowsC.sort(function(a,b){ return b.share - a.share; });
      return { quarter: lastP.week === 0 ? state.draft.quarter : 'week ' + lastP.week, rows:rowsC };
    }
    var data = window.pollingGraphData;
    if(!data || !data.length) return null;
    var last = data[data.length-1];
    var field = last.quarterIndex != null ? 'quarterIndex' : 'quarter';
    var rows = data.filter(function(d){ return d[field] === last[field]; });
    if(!rows.length) return null;
    var out = PARTIES.map(function(p){
      var sum = 0, n = 0;
      rows.forEach(function(r){ if(isFinite(Number(r[p.name]))){ sum += Number(r[p.name]); n++; } });
      return { key:p.key, name:p.name, abbr:CMP_ABBR[p.key] || p.key.toUpperCase(), color:cmpPartyColor(p), share:n ? sum/n : 0, delta:null };
    });
    out.sort(function(a,b){ return b.share - a.share; });
    return { quarter:last.quarter, rows:out };
  }

  function cmpSigned(v, d){ return (v >= 0 ? '+' : '\u2212') + fmtNum(Math.abs(v), d); }

  // Woodcut-style icons: solid ink silhouettes with white-line cuts (.f = solid, .c = cut lines, .o = outline).
  function cmpIcon(key){
    var s = '<svg class="cmp-ico" viewBox="0 0 48 48" stroke-width="1.7" stroke-linecap="square" stroke-linejoin="round" aria-hidden="true" focusable="false">';
    if(key === 'canvass'){          // an arched door with panels, knocker and step
      s += '<path class="f" d="M11 43V20a13 13 0 0 1 26 0v23z"/>' +
           '<path class="c" d="M16 43V21a8 8 0 0 1 16 0v22M24 13v30M16 27h16M16 34h16"/>' +
           '<circle class="f" cx="28.5" cy="30" r="0"/><path class="c" d="M27 30.5h3"/>' +
           '<path class="o" d="M6 43h36M8 46h32"/>';
    } else if(key === 'speech'){    // a megaphone with sound rays
      s += '<path class="f" d="M6 20l24-11v30L6 28z"/>' +
           '<path class="c" d="M11 21.5l14-6M11 24l14-1M11 26.5l14 4"/>' +
           '<path class="f" d="M12 29l3 12h6l-2.5-11z"/>' +
           '<path class="o" d="M34 17c3.5 3 3.5 11 0 14M39 12c5.5 5 5.5 19 0 24M44 8c7 7 7 25 0 32"/>';
    } else if(key === 'press'){     // a newspaper with masthead block and columns
      s += '<path class="f" d="M7 9h30v31H11a4 4 0 0 1-4-4z"/>' +
           '<path class="c" d="M11 14h22M11 19h22"/>' +
           '<path class="c" d="M11 24h10M11 28h10M11 32h10M11 36h10M25 24h8M25 28h8M25 32h8"/>' +
           '<path class="o" d="M37 15h4v21a4 4 0 0 1-4 4"/>';
    } else {                        // organize: a banner on a pole
      s += '<path class="f" d="M13 5h3v39h-3z"/><path class="f" d="M16 8h25l-6 8 6 8H16z"/>' +
           '<path class="c" d="M21 12h14M21 16h10M21 20h14"/>' +
           '<path class="o" d="M7 44h15M9 47h11"/>';
    }
    return s + '</svg>';
  }

  // Engraved ballot box for the newspaper's left ear.
  function cmpVignette(){
    return '<svg viewBox="0 0 64 56" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      '<path d="M9 26h46v26H9z" fill="currentColor" fill-opacity=".14"/>' +
      '<path d="M9 26l6-9h34l6 9"/><path d="M25 21h14" stroke-width="3.2"/>' +
      '<path d="M13 30v19M16.5 30v19M20 30v19M23.5 30v19M27 30v19" stroke-width="1"/>' +
      '<path d="M35 5l11 2.4-3.4 14.6-11-2.4z" fill="#f3eee1"/><path d="M36 9.5l7.6 1.6M35 13.6l7.6 1.6" stroke-width="1"/>' +
      '<path d="M5 52h54" stroke-width="2"/></svg>';
  }

  /* ---- bulletin copy: everything comes from real state (actions logged, draft metrics, polls, funds) ---- */
  var CMP_STORIES = {
    canvass:  { head:'{P} canvassers work the district door to door', deck:'Volunteers spent the week putting the case for \u201c{L}\u201d to voters at their own doors.' },
    speech:   { head:'{P} leader takes the platform', deck:'This week\u2019s speech carried the case for \u201c{L}\u201d to supporters and undecided voters alike.' },
    press:    { head:'{P} places its case in the papers', deck:'Interviews and statements on \u201c{L}\u201d ran in sympathetic newspapers this week.' },
    organize: { head:'{P} builds out its local committees', deck:'New volunteer committees took shape in the districts behind \u201c{L}\u201d.' }
  };

  function cmpFill(tpl, party, pledge){
    return tpl.replace('{P}', party).replace('{L}', pledge);
  }

  var CMP_ECON = {
    unemploymentRate: { phrase:'unemployment',            unit:'% of the workforce' },
    inflationRate:    { phrase:'inflation, year on year', unit:'%' },
    povertyRate:      { phrase:'the poverty rate',        unit:'%' },
    realMedianWage:   { phrase:'the real median wage',    unit:'RM a month' },
    debtToGdp:        { phrase:'public debt',             unit:'% of GDP' },
    gdpIndex:         { phrase:'real GDP',                unit:'on the 1924 = 100 index' }
  };

  function cmpEconomyLine(){
    var m = state.draft && state.draft.metrics;
    if(!m) return '<p>No Reich figures on file.</p>';
    var worst = null, worstScore = -Infinity;
    Object.keys(CMP_ECON).forEach(function(k){
      var b = badness(k, metricValue(k, m));
      if(b > worstScore){ worstScore = b; worst = k; }
    });
    var cfg = METRICS[worst], txt = CMP_ECON[worst], v = metricValue(worst, m), cls = classifyMetric(worst, v);
    var word = cls === 'bad' ? 'a grave concern' : (cls === 'warn' ? 'cause for concern' : 'within bounds');
    return '<p>Reich figures for ' + escGame(state.draft.quarter) + ' put <b>' + escGame(txt.phrase) + '</b> at ' +
      fmtNum(v, cfg.decimals) + NBSP + escGame(txt.unit) + ' \u2014 <span class="cmp-tag">' + word + '</span>.</p>';
  }

  // One sentence on what last week's action actually did (from the result stored on the log entry).
  function cmpEffectSentence(last){
    var r = last && last.result;
    if(!r) return '';
    if(last.action === 'canvass'){
      return r.regionName ? 'Local support in ' + r.regionName + ' rose by ' + fmtNum(r.localPts, 1) + ' points, and the party\u2019s campaign strength grew.'
                          : 'The party\u2019s campaign strength grew.';
    }
    if(last.action === 'speech') return 'The speech added ' + fmtNum(r.natPts, 1) + ' points to the party\u2019s national standing; such bounces fade within weeks.';
    if(last.action === 'press') return 'The coverage added ' + fmtNum(r.natPts, 1) + ' points of national visibility, which fades only slowly.';
    if(last.action === 'organize') return 'Organization now stands at level ' + r.orgLevel + ': every later action is ' + Math.round((r.orgMult - 1) * 100) + '% stronger.';
    return '';
  }

  // Projection sentence from the stored campaign projection (constituencies and seats on today's polling).
  function cmpProjectionSentence(party){
    var c = state.game && state.game.campaign, pr = c && (c.projection || c.baseline);
    if(!pr || !pr.seats) return '';
    var pk = party.key, base = c.baseline && c.baseline.seats ? c.baseline.seats[pk] : null;
    var move = base != null ? seatsMove(pr.seats[pk] - base) : '';
    function seatsMove(d){ return d === 0 ? ' \u2014 level with the start of the campaign' : ' (' + cmpSigned(d, 0) + ' since the campaign began)'; }
    return 'Projection on the latest polling: ' + fmtNum(pr.national[pk], 1) + '% of the vote, ' + pr.constSeats[pk] + ' constituencies and ' +
      pr.seats[pk] + ' of ' + pr.totalSeats + ' seats' + move + '.';
  }

  // Builds the newspaper masthead + dateline once (they're the same for the
  // whole campaign) and patches only the week number, funds figure and the
  // article body each week — the body is the only part meant to play the
  // "just printed" reveal effect. Previously the whole thing, masthead
  // included, was replaced via innerHTML every week, which is what made the
  // header (and the "Woche N" box) look like it was reloading top-to-bottom
  // right along with the intentional reveal on the articles below it.
  function cmpNewsShellHtml(party){
    return '<div class="cmp-news-inner">' +
      '<div class="cmp-np-head">' +
        '<div class="cmp-np-ear"><span class="cmp-vig">' + cmpVignette() + '</span><span><b>Woche <span id="cmp-np-week-num"></span></b><i>von ' + CAMPAIGN_WEEKS + '</i></span></div>' +
        '<div class="cmp-np-title cmp-inked">Der Wahlkampf-Bote</div>' +
        '<div class="cmp-np-ear r"><span><b id="cmp-np-quarter"></b><i id="cmp-np-election-label"></i></span></div>' +
      '</div>' +
      '<div class="cmp-np-dateline"><span>Erscheint w\u00f6chentlich bis zum Wahltag</span><span class="cmp-chain"></span><span>Wahlkasse: <b id="cmp-np-funds"></b></span></div>' +
      '<div class="cmp-np-body" id="cmp-np-body"></div>' +
    '</div>';
  }

  function cmpNewsBodyHtml(party, week){
    var g = state.game, pledge = g.pledge, pledgeName = pledge ? pledge.name : 'its programme';
    var acts = (g.campaign && g.campaign.actions) || [];
    var last = acts[acts.length-1];
    var head, deck;
    var effect = cmpEffectSentence(last);
    if(week >= CAMPAIGN_WEEKS){
      head = 'Final week: ' + party.name + ' makes its closing case';
      deck = 'Polling day follows the close of this week. ' + (effect || 'The party leadership settles the last week\u2019s work at headquarters.');
    } else if(!last){
      head = party.name + ' opens its campaign on \u201c' + pledgeName + '\u201d';
      deck = CAMPAIGN_WEEKS + ' weeks remain until polling day. Headquarters is open and the first week\u2019s work awaits a decision.';
    } else {
      var st = CMP_STORIES[last.action] || { head:'{P} campaigns on', deck:'The party pressed on with \u201c{L}\u201d this week.' };
      head = cmpFill(st.head, party.name, pledgeName);
      if(last.action === 'canvass' && last.result && last.result.regionName) head = party.name + ' canvassers work ' + last.result.regionName;
      deck = effect || cmpFill(st.deck, party.name, pledgeName);
    }
    var bodyText = cmpProjectionSentence(party) || (pledge && pledge.description ? 'The party campaigns on \u201c' + pledge.name + '\u201d: ' + pledge.description : '');

    var polls = cmpLatestPolls(), pollHtml;
    if(polls){
      pollHtml = '<ul class="cmp-polls">' + polls.rows.map(function(r){
        return '<li' + (r.key === party.key ? ' class="is-you"' : '') + ' style="--c:' + escGame(r.color) + '"><span class="cmp-abbr">' + escGame(r.abbr) +
          '</span><span class="cmp-bar"><i style="width:' + Math.min(100, r.share/35*100).toFixed(1) + '%"></i></span><span class="cmp-pct">' + fmtNum(r.share, 1) + '%' +
          (r.delta != null && Math.abs(r.delta) >= 0.05 ? '<small>' + cmpSigned(r.delta, 1) + '</small>' : '') + '</span></li>';
      }).join('') + '</ul>';
    } else {
      pollHtml = '<p>No polls published yet.</p>';
    }

    var chron = acts.slice(-3).reverse().map(function(a){
      var d = cmpActionDef(a.action), r = a.result || {};
      var tip = a.action === 'canvass' && r.regionName ? 'Local support in ' + r.regionName + ' +' + fmtNum(r.localPts, 1) :
                (a.action === 'speech' || a.action === 'press') && r.natPts != null ? 'National +' + fmtNum(r.natPts, 1) :
                a.action === 'organize' && r.orgLevel ? 'Organization level ' + r.orgLevel : '';
      return '<li' + (tip ? ' title="' + escGame(tip) + '"' : '') + '><b>Wo.\u00a0' + a.week + '</b><span>' + escGame(d ? d.name : a.action) + '</span></li>';
    }).join('');
    if(!chron) chron = '<li><span>The campaign has only just begun.</span></li>';

    return '<article class="cmp-lead"><h3>' + escGame(head) + '</h3><h4>' + escGame(deck) + '</h4>' + (bodyText ? '<p>' + escGame(bodyText) + '</p>' : '') + '</article>' +
      '<article class="cmp-col"><h5>Wirtschaft</h5>' + cmpEconomyLine() + '</article>' +
      '<article class="cmp-col"><h5>Chronik</h5><ul class="cmp-chron">' + chron + '</ul></article>' +
      '<article class="cmp-col"><h5>Umfragen' + (polls ? '<small>' + escGame(polls.quarter) + '</small>' : '') + '</h5>' + pollHtml + '</article>';
  }

  function cmpFillNews(party, week, animate){
    var el = document.getElementById('cmp-news');
    if(!el) return;
    if(el.getAttribute('data-cmp-news') !== '1'){
      el.innerHTML = cmpNewsShellHtml(party);
      el.setAttribute('data-cmp-news', '1');
    }
    var wkEl = document.getElementById('cmp-np-week-num'); if(wkEl) wkEl.textContent = week;
    var qEl = document.getElementById('cmp-np-quarter'); if(qEl) qEl.textContent = state.draft.quarter;
    var lblEl = document.getElementById('cmp-np-election-label'); if(lblEl) lblEl.textContent = cmpElectionLabel();
    var fundsEl = document.getElementById('cmp-np-funds'); if(fundsEl) fundsEl.textContent = fmtNum(state.game.campaignFunds, 0) + ' RM';
    var bodyEl = document.getElementById('cmp-np-body');
    if(bodyEl){
      bodyEl.innerHTML = cmpNewsBodyHtml(party, week);
      if(animate){
        // Restart the reveal on just this week's articles.
        bodyEl.classList.remove('cmp-print');
        void bodyEl.offsetWidth;
        bodyEl.classList.add('cmp-print');
      } else {
        bodyEl.classList.remove('cmp-print');
      }
    }
  }

  /* ---- shell + panel adoption ---- */
  function cmpEnsureShell(){
    var el = document.getElementById('campaign-screen-overlay');
    if(el && el.getAttribute('data-cmp') === '1') return el;
    if(!el){
      el = document.createElement('div');
      el.id = 'campaign-screen-overlay';
      document.body.appendChild(el);
    }
    el.setAttribute('data-cmp', '1');
    el.className = 'cmp-root';
    el.removeAttribute('style');
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Election campaign headquarters');
    el.innerHTML =
      // letterpress ink spread: slightly roughens the edges of the big display type
      '<svg width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true" focusable="false"><filter id="cmp-ink" x="-2%" y="-4%" width="104%" height="108%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="1" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.7" xChannelSelector="R" yChannelSelector="G"/></filter></svg>' +
      '<header id="cmp-head" class="cmp-head"></header>' +
      '<div class="cmp-main">' +
        '<section id="cmp-map-slot" class="cmp-sheet cmp-map-slot"><div class="cmp-rubric"><span>Die Wahlkarte</span></div></section>' +
        '<div class="cmp-side">' +
          '<section id="cmp-poll-slot" class="cmp-sheet cmp-poll-slot"><div class="cmp-rubric"><span>Die Umfragen</span><button type="button" class="cmp-zoom-btn" data-cmp-zoom aria-expanded="false">Enlarge</button></div></section>' +
          '<section id="cmp-you" class="cmp-sheet cmp-you"></section>' +
        '</div>' +
      '</div>' +
      '<section id="cmp-actions" class="cmp-actions" aria-label="Campaign actions"></section>' +
      '<section id="cmp-news" class="cmp-sheet cmp-news" aria-label="Campaign news"></section>' +
      '<footer id="cmp-foot" class="cmp-foot"></footer>';
    el.addEventListener('click', cmpOnClick);
    document.documentElement.classList.add('cmp-lock');
    cmpAdopt();
    return el;
  }

  function cmpAdopt(){
    if(CMP.home) return;
    CMP.home = [];
    [['#page-5 .map-panel', 'cmp-map-slot', 'The election map is not part of this document.'],
     ['#page-5 .polling-graph-panel', 'cmp-poll-slot', 'The polling graph is not part of this document.']].forEach(function(t){
      var node = document.querySelector(t[0]), slot = document.getElementById(t[1]);
      if(!slot) return;
      if(node){
        CMP.home.push({ node:node, parent:node.parentNode, next:node.nextSibling });
        slot.appendChild(node);
      } else {
        var msg = document.createElement('div');
        msg.className = 'cmp-empty';
        msg.textContent = t[2];
        slot.appendChild(msg);
      }
    });
    // The polling graph (and anything else that sizes itself from its
    // container, e.g. via a ResizeObserver/window "resize" listener) was
    // built at its original, much smaller size on page 3. It only ever
    // looked right in here because the old per-week full-page rebuild
    // happened to trigger a reflow big enough for it to notice its new,
    // much larger container and redraw at the right size. Now that the
    // campaign screen doesn't tear the page down every week, ask for that
    // resize explicitly instead of relying on the accidental side effect.
    cmpNudgeResize();
  }

  function cmpNudgeResize(){
    if(typeof window.requestAnimationFrame === 'function'){
      window.requestAnimationFrame(function(){
        try{ window.dispatchEvent(new Event('resize')); }catch(e){}
      });
    } else {
      try{ window.dispatchEvent(new Event('resize')); }catch(e){}
    }
  }

  function cmpRelease(){
    var zoomed = document.getElementById('cmp-poll-slot');
    if(zoomed) zoomed.classList.remove('cmp-zoom');
    if(CMP.home){
      CMP.home.slice().reverse().forEach(function(h){
        var parent = h.parent && h.parent.isConnected ? h.parent : document.querySelector('#page-5 main');
        if(!parent) return;
        parent.insertBefore(h.node, (h.next && h.next.parentNode === parent) ? h.next : null);
      });
      CMP.home = null;
    }
    document.documentElement.classList.remove('cmp-lock');
  }

  /* ---- dynamic regions ---- */
  // Builds the cmp-head shell (party seal/name + masthead + week counter) only
  // once per party, then just patches the text that actually changes each
  // week (the "weeks to polling day" subtitle and the week number). Used to
  // rebuild this whole header from scratch every End Week via innerHTML,
  // which is what made it visibly redraw top-to-bottom alongside the actual
  // "stamped" week-number animation, even though only the week number was
  // meant to animate.
  function cmpHeadShellHtml(party){
    return '<div class="cmp-party"><span class="cmp-seal" aria-hidden="true">' + escGame(party.abbr) + '</span><span class="cmp-party-name">' + escGame(party.name) + '</span></div>' +
      '<h1 class="cmp-title"><span class="cmp-title-main cmp-inked">' + escGame(cmpElectionLabel()) + '</span>' +
        '<span class="cmp-title-sub" id="cmp-title-sub"></span></h1>' +
      '<div class="cmp-week" aria-live="polite"><span class="cmp-week-word">Week</span><b class="cmp-week-num cmp-inked" id="cmp-week-num"></b><span class="cmp-week-of">of ' + CAMPAIGN_WEEKS + '</span></div>';
  }

  function cmpFillHead(party, week){
    var el = document.getElementById('cmp-head');
    if(!el) return;
    if(el.getAttribute('data-cmp-party') !== party.key){
      el.innerHTML = cmpHeadShellHtml(party);
      el.setAttribute('data-cmp-party', party.key);
    }
    var left = CAMPAIGN_WEEKS - week;
    var subEl = document.getElementById('cmp-title-sub');
    if(subEl) subEl.textContent = left > 0 ? left + (left === 1 ? ' week' : ' weeks') + ' to polling day' : 'The last week before polling day';
    var wkEl = document.getElementById('cmp-week-num');
    if(wkEl){
      wkEl.textContent = cmpPad2(week);
      if(CMP.renderedWeek !== week){
        // Restart the "stamped" reveal on just the digits, not the header around them.
        wkEl.classList.remove('cmp-print');
        void wkEl.offsetWidth; // force reflow so re-adding the class restarts the animation
        wkEl.classList.add('cmp-print');
      }
    }
  }

  function cmpFillYou(party, week){
    var g = state.game, pl = g.pledge;
    var acts = (g.campaign && g.campaign.actions) || [];
    var polls = cmpLatestPolls(), poll = '';
    if(polls){
      var rank = 0;
      polls.rows.forEach(function(r, i){ if(r.key === party.key) rank = i; });
      var mine = polls.rows[rank];
      poll = '<p class="cmp-poll-line">Latest poll (' + escGame(polls.quarter) + '): <b>' + fmtNum(mine.share, 1) + '%</b>' +
        (mine.delta != null && Math.abs(mine.delta) >= 0.05 ? ' (' + cmpSigned(mine.delta, 1) + ')' : '') + ', ranked ' + (rank+1) + ' of ' + polls.rows.length + '.</p>';
    }
    var fxc = g.campaign && g.campaign.fx;
    if(fxc) poll += '<p class="cmp-poll-line cmp-fx-line">Campaign strength <b>' + fmtNum(fxc.strength, 1) + '</b> \u00b7 Organization <b>\u00d7' + fmtNum(campaignMultiplier(fxc), 2) + '</b></p>';
    var cells = '';
    for(var w = 1; w <= CAMPAIGN_WEEKS; w++){
      var done = acts.filter(function(a){ return a.week === w; })[0];
      var cls = 'cmp-cal-cell' + (done ? ' is-done' : (w === week ? ' is-now' : ''));
      cells += '<span class="' + cls + '" title="Week ' + w + (done && cmpActionDef(done.action) ? ': ' + escGame(cmpActionDef(done.action).name) : '') + '">' +
        (done ? cmpIcon(done.action) : w) + '</span>';
    }
    document.getElementById('cmp-you').innerHTML =
      '<div class="cmp-rubric cmp-you-head"><span><span class="cmp-rubric-title">Your campaign</span></span>' + (pl ? '<span class="cmp-stamp">' + escGame(pl.status || 'active') + '</span>' : '') + '</div>' +
      '<div class="cmp-you-pledge">' + (pl ? '<h3 class="cmp-pledge-name">' + escGame(pl.name) + '</h3><p class="cmp-pledge-desc">' + escGame(pl.description) + '</p>'
        : '<p class="cmp-pledge-desc">No pledge chosen.</p>') + '</div>' +
      '<div class="cmp-you-stats">' + (pl ? '<div class="cmp-meter-row"><span>Pledge standing</span><span class="cmp-meter" role="img" aria-label="Pledge standing ' + fmtNum(pl.popularity, 0) + ' out of 100"><i style="width:' + Math.max(0, Math.min(100, pl.popularity)) + '%"></i></span><span class="cmp-meter-val">' + fmtNum(pl.popularity, 0) + '</span></div>' : '') + poll + '</div>' +
      '<div class="cmp-cal" role="img" aria-label="Campaign calendar, week ' + week + ' of ' + CAMPAIGN_WEEKS + '">' + cells + '</div>';
  }

  function cmpFillActions(week){
    var sel = CMP.selectedWeek === week ? CMP.selected : null;
    document.getElementById('cmp-actions').innerHTML = CAMPAIGN_ACTIONS.map(function(a){
      return '<button type="button" class="cmp-act cmp-act--' + escGame(a.key) + '" data-cmp-action="' + escGame(a.key) + '" title="' + escGame(a.description) + '" aria-pressed="' + (sel === a.key ? 'true' : 'false') + '">' +
        '<span class="cmp-act-medal">' + cmpIcon(a.key) + '</span>' +
        '<span><span class="cmp-act-slogan">' + escGame(CMP_SLOGAN[a.key] || '') + '</span><span class="cmp-act-name">' + escGame(a.name) + '</span><span class="cmp-act-desc">' + escGame(a.description) + '</span></span></button>';
    }).join('');
  }

  function cmpFillFoot(week){
    var sel = CMP.selectedWeek === week ? CMP.selected : null, def = sel && cmpActionDef(sel);
    var last = week >= CAMPAIGN_WEEKS;
    document.getElementById('cmp-foot').innerHTML =
      '<div class="cmp-funds"><span class="cmp-funds-label">Campaign funds</span><span class="cmp-funds-num">' + fmtNum(state.game.campaignFunds, 0) + '<span class="cmp-rm">RM</span></span></div>' +
      '<div class="cmp-foot-note">' + (def ? 'Week ' + week + ' action: <b>' + escGame(def.name) + '</b>' : 'Choose one action for week ' + week + ' to end the week.') + '</div>' +
      '<button type="button" class="cmp-end" id="cmp-end-week"' + (def ? '' : ' disabled') + '>End Week ' + week + (last ? ' \u2192 Polling Day' : ' \u2192') + '</button>';
  }

  function renderCampaignScreen(){
    var el = document.getElementById('campaign-screen-overlay');
    var show = state.game && state.game.phase === 'campaign';
    if(!show){
      if(el){
        cmpRelease();
        el.parentNode.removeChild(el);
      }
      CMP.selected = null; CMP.selectedWeek = 0; CMP.renderedWeek = 0; CMP.committing = false;
      return;
    }
    cmpEnsureStyles();
    el = cmpEnsureShell();
    var week = state.game.campaignWeek || 1;
    var def = cmpPartyDef(state.game.playerParty);
    var color = cmpPartyColor(def);
    var party = { key:def.key, name:def.name, abbr:CMP_ABBR[def.key] || def.key.toUpperCase(), color:color };
    if(CMP.selectedWeek !== week){ CMP.selected = null; CMP.selectedWeek = week; }
    el.style.setProperty('--party', color);
    el.style.setProperty('--party-ink', cmpInkFor(color));
    el.style.setProperty('--party-deep', cmpDeepen(color, 0.4));
    el.style.setProperty('--party-lit', cmpLift(color, 0.42));
    var weekChanged = CMP.renderedWeek !== week;
    cmpFillHead(party, week);
    cmpFillYou(party, week);
    cmpFillActions(week);
    cmpFillNews(party, week, weekChanged);
    cmpFillFoot(week);
    CMP.renderedWeek = week;
  }

  /* ---- interaction (one delegated listener on the overlay) ---- */
  function cmpOnClick(e){
    var t = e.target && e.target.closest ? e.target.closest('[data-cmp-action],[data-cmp-zoom],#cmp-end-week') : null;
    if(!t || !state.game || state.game.phase !== 'campaign') return;
    var week = state.game.campaignWeek || 1;
    if(t.hasAttribute('data-cmp-zoom')){
      var slot = document.getElementById('cmp-poll-slot');
      var on = slot.classList.toggle('cmp-zoom');
      t.setAttribute('aria-expanded', on ? 'true' : 'false');
      t.textContent = on ? 'Close' : 'Enlarge';
      return;
    }
    if(t.hasAttribute('data-cmp-action')){
      var key = t.getAttribute('data-cmp-action');
      if(!cmpActionDef(key)) return;
      CMP.selected = key; CMP.selectedWeek = week;
      cmpFillActions(week);
      cmpFillFoot(week);
      return;
    }
    if(t.id === 'cmp-end-week') cmpEndWeek(week);
  }

  // Stage-then-commit: End Week hands the staged action to the existing onCampaignAction(),
  // which logs it and advances the week (or ends the campaign after week 12) exactly as before.
  function cmpEndWeek(week){
    if(CMP.committing || !CMP.selected || CMP.selectedWeek !== week) return;
    var key = CMP.selected;
    CMP.committing = true;
    var btn = document.getElementById('cmp-end-week');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function commit(){
      CMP.committing = false;
      CMP.selected = null;
      onCampaignAction(key);
    }
    if(btn && !reduce){ btn.classList.add('cmp-stamping'); setTimeout(commit, 220); }
    else commit();
  }

  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    var slot = document.getElementById('cmp-poll-slot');
    if(slot && slot.classList.contains('cmp-zoom')){
      slot.classList.remove('cmp-zoom');
      var b = slot.querySelector('[data-cmp-zoom]');
      if(b){ b.setAttribute('aria-expanded', 'false'); b.textContent = 'Enlarge'; }
    }
  });

  /* ===== Campaign effects (Phase 2, Step 6) =====
     The four campaign actions now change the game. Design goals: simple, deterministic (no
     randomness), all tuning in CAMPAIGN_TUNING, and built ON TOP of the existing systems:

       - Effects accumulate in state.game.campaign.fx (plain numbers, persisted with the rest of state).
       - The player's party gets NATIONAL campaign points on top of the swing the economic engine already
         computes for the draft quarter (partySwingPoints), pushed through the same simulator
         (pruState.swings -> calc() -> electionSummary()) that produces the map, the election chart
         and the historical polling series. Other parties lose vote share only through the
         simulator's own normalisation.
       - Local (constituency-level) effects use the optional pruState.localSwings hook in sim-script.js.
         Nothing in pruState.base (the historical results), GRAPH_BASELINE or the filed quarters changes:
         the overlay exists only while phase==='campaign' and is switched off (localSwings = null,
         swings back to the draft's own) as soon as the phase moves on.
       - Polling: after every End Week the simulator's national result under the new effects is stored as
         that week's tracker poll (state.game.campaign.polls); syncPollingGraph() appends those to the
         existing polling series as extra rows, with the same deterministic noise recipe as the quarterly polls.
       - Projection: the same swings drive the map (winners/support per constituency) and the
         seat projection stored in state.game.campaign.projection.

     Actions (each stacks over the 12 weeks; every action's strength is scaled by the organisation multiplier
     earned from earlier Organize weeks):
       Canvass  -> campaign strength +1 (small permanent national lift) and a local boost, in vote-share points,
                   across the constituencies of the region where the party has the most seats within reach.
                   Local effects persist (tiny fade) and show diminishing returns in a region already worked.
       Speech   -> enthusiasm: a large national polling boost that fades fast.
       Press    -> visibility: a smaller national boost that fades slowly.
       Organize -> organisation +1: every future action is stronger (+10% per level, capped), plus a little
                   campaign strength right away. No direct polling effect of its own beyond that.
     Order each week: fade short-term effects -> apply the chosen action -> recompute polling and
     projection -> (render) redraw graph, map and news. Funds, pledge, the 12-week flow and the election
     transition are untouched. */
  var CAMPAIGN_TUNING = {
    orgBonusPerLevel: 0.10,   // each Organize week strengthens every later action by 10% ...
    orgBonusCap: 0.60,        // ... up to +60%
    organizeStrength: 0.4,    // campaign strength gained immediately by Organize
    canvassStrength: 1.0,     // campaign strength gained by Canvass
    strengthNational: 0.15,   // permanent national points per unit of campaign strength
    canvassLocalPoints: 7.0,  // local vote-share points (pre-normalisation) added across the worked region per Canvass
    canvassLocalKeep: 0.985,  // share of local support kept from one week to the next
    canvassDiminish: 0.06,    // returns fall by this factor per point already banked in the same region
    speechPoints: 1.5,        // national points from a speech ...
    speechDecay: 0.55,        // ... of which this fraction is still there a week later (short-lived)
    pressPoints: 0.7,         // national points from press work ...
    pressDecay: 0.85,         // ... fading slowly
    nationalCap: 8,           // soft ceiling (tanh) on total national campaign points
    pollNoise: 0.3,           // tracker-poll noise relative to the quarterly polls
    pollStep: 0.2             // x-axis spacing (in quarters) between weekly tracker polls on the polling graph
  };

  // Campaign regions: each constituency belongs to the nearest of these anchors (lon/lat of its centroid).
  var CAMPAIGN_REGIONS = [
    { key:'rhineland',   name:'the Rhineland',                 lon:6.9,  lat:50.8 },
    { key:'westphalia',  name:'Westphalia',                    lon:8.0,  lat:51.8 },
    { key:'hesse',       name:'Hesse-Nassau',                  lon:9.0,  lat:50.5 },
    { key:'hanover',     name:'Hanover and the coast',         lon:9.6,  lat:52.9 },
    { key:'holstein',    name:'Schleswig-Holstein',            lon:9.8,  lat:54.2 },
    { key:'saxony',      name:'the Province of Saxony',        lon:11.6, lat:51.7 },
    { key:'brandenburg', name:'Berlin and Brandenburg',        lon:13.4, lat:52.5 },
    { key:'pomerania',   name:'Pomerania',                     lon:15.8, lat:53.8 },
    { key:'silesia',     name:'Silesia',                       lon:16.8, lat:51.0 },
    { key:'posen',       name:'Posen and West Prussia',        lon:18.0, lat:52.9 },
    { key:'eastprussia', name:'East Prussia',                  lon:21.0, lat:54.0 }
  ];
  var CMP_REGION_CACHE = null;

  function campaignRegions(){
    if(typeof DATA === 'undefined' || !DATA || !DATA.features || !DATA.features.length) return null;
    if(CMP_REGION_CACHE && CMP_REGION_CACHE.n === DATA.features.length) return CMP_REGION_CACHE;
    var regionOf = [], members = {};
    CAMPAIGN_REGIONS.forEach(function(r){ members[r.key] = []; });
    DATA.features.forEach(function(f, i){
      var sx = 0, sy = 0, n = 0;
      function ring(r){ r.forEach(function(p){ sx += p[0]; sy += p[1]; n++; }); }
      var g = f.geometry;
      if(g && g.type === 'Polygon') g.coordinates.forEach(ring);
      else if(g && g.type === 'MultiPolygon') g.coordinates.forEach(function(poly){ poly.forEach(ring); });
      var lon = n ? sx/n : 0, lat = n ? sy/n : 0, best = null, bd = Infinity;
      CAMPAIGN_REGIONS.forEach(function(r){
        var dx = (lon - r.lon) * Math.cos(lat * Math.PI/180), dy = lat - r.lat, d = dx*dx + dy*dy;
        if(d < bd){ bd = d; best = r.key; }
      });
      regionOf.push(best);
      members[best].push(i);
    });
    CMP_REGION_CACHE = { n:DATA.features.length, regionOf:regionOf, members:members };
    return CMP_REGION_CACHE;
  }
  function campaignRegionName(key){
    var r = CAMPAIGN_REGIONS.filter(function(x){ return x.key === key; })[0];
    return r ? r.name : key;
  }

  function campaignSimReady(){
    return typeof window.pruProjectionForSwings === 'function' && window.pruState && window.pruState.parties &&
           window.pruState.parties.length === Object.keys(PRU_UI_PARTY_ORDER).length;
  }
  function campaignPlayerIndex(){
    var pk = state.game && state.game.playerParty, found = -1;
    Object.keys(PRU_UI_PARTY_ORDER).forEach(function(i){ if(PRU_UI_PARTY_ORDER[i] === pk) found = +i; });
    return found;
  }

  function campaignFxDefault(){
    return { strength:0, enthusiasm:0, visibility:0, organization:0, local:{} };
  }
  function campaignMultiplier(fx){
    var T = CAMPAIGN_TUNING;
    return 1 + Math.min(T.orgBonusCap, fx.organization * T.orgBonusPerLevel);
  }
  // National campaign points for the player's party (soft-capped so stacking can never run away).
  function campaignNationalPoints(fx){
    var T = CAMPAIGN_TUNING, raw = fx.enthusiasm + fx.visibility + T.strengthNational * fx.strength;
    return T.nationalCap * Math.tanh(raw / T.nationalCap);
  }

  // Creates the effect containers on state.game.campaign the first time they are needed, and files the
  // starting (no-effects) projection as the campaign baseline.
  function campaignEnsure(){
    var c = state.game && state.game.campaign;
    if(!c) return null;
    if(!c.fx) c.fx = campaignFxDefault();
    if(!c.polls) c.polls = [];
    if(!c.baseline && campaignSimReady()){
      try{ c.baseline = campaignSummary(campaignProject(campaignFxDefault())); }catch(e){}
    }
    return c;
  }

  // The economic engine's own swing for the draft quarter, in simulator party order — identical to what
  // syncPrussiaMap() has always applied to the map.
  function campaignDraftSwings(){
    var priorMetrics = state.history[state.history.length-1].metrics;
    var sw = partySwingPoints(state.draft.metrics, priorMetrics, state.draft.government,
                              getAccountabilityBaselines(state.history, null, state.draft.metrics, state.draft.government));
    return Object.keys(PRU_UI_PARTY_ORDER).map(function(i){ return sw[PRU_UI_PARTY_ORDER[i]].points; });
  }

  // { national: [swing points per simulator party], local: [per-constituency [points per party]] | null }
  function campaignSwingArrays(fx){
    var nat = campaignDraftSwings(), pi = campaignPlayerIndex(), reg = campaignRegions(), local = null;
    if(pi >= 0){
      nat[pi] += campaignNationalPoints(fx);
      if(reg){
        Object.keys(fx.local || {}).forEach(function(rk){
          var pts = fx.local[rk];
          if(!(pts > 0.0001) || !reg.members[rk]) return;
          if(!local) local = [];
          reg.members[rk].forEach(function(i){
            local[i] = [0,0,0,0,0];
            local[i][pi] = pts;
          });
        });
      }
    }
    return { national:nat, local:local };
  }

  function campaignProject(fx){
    var arrs = campaignSwingArrays(fx), out = { arrs:arrs };
    if(campaignSimReady()){
      var p = window.pruProjectionForSwings(arrs.national, arrs.local);
      out.national = p.national; out.constSeats = p.constSeats; out.total = p.total; out.totalSeats = p.totalSeats; out.results = p.results;
    }
    return out;
  }
  function campaignByKey(arr){
    var o = {};
    Object.keys(PRU_UI_PARTY_ORDER).forEach(function(i){ o[PRU_UI_PARTY_ORDER[i]] = Number(arr[i]); });
    return o;
  }
  // Compact, persistable summary of a projection.
  function campaignSummary(p){
    if(!p.national) return null;
    return { national:campaignByKey(p.national), constSeats:campaignByKey(p.constSeats), seats:campaignByKey(p.total), totalSeats:p.totalSeats };
  }

  // Canvass target: the region with the most constituencies within reach of the player's party (trailing the
  // leader by up to 12 points, or leading by under 6), so door-knocking goes where it can change results.
  function campaignPickRegion(fx){
    var reg = campaignRegions(), pi = campaignPlayerIndex();
    if(!reg || pi < 0 || !campaignSimReady()) return null;
    var proj = campaignProject(fx), best = null, bestScore = -1, fallback = null, fallbackMean = -1;
    CAMPAIGN_REGIONS.forEach(function(r){
      var mem = reg.members[r.key];
      if(!mem || !mem.length) return;
      var score = 0, mean = 0;
      mem.forEach(function(i){
        var sh = proj.results[i].shares, w = proj.results[i].winner, mine = sh[pi];
        mean += mine;
        if(w === pi){
          var second = 0;
          sh.forEach(function(v, j){ if(j !== pi && v > second) second = v; });
          var lead = mine - second;
          if(lead < 6) score += 0.5 * (6 - lead) / 6;
        } else {
          var gap = sh[w] - mine;
          if(gap <= 12) score += (12 - gap) / 12;
        }
      });
      mean /= mem.length;
      if(score > bestScore){ bestScore = score; best = r.key; }
      if(mean > fallbackMean){ fallbackMean = mean; fallback = r.key; }
    });
    return bestScore > 0 ? best : fallback;
  }

  // Applies one week's chosen action. Returns the result record stored on the action-log entry.
  function campaignApplyAction(key, week){
    var c = campaignEnsure();
    if(!c) return null;
    var T = CAMPAIGN_TUNING, fx = c.fx;
    var beforeSummary = c.polls.length ? { national:c.polls[c.polls.length-1].shares } : c.baseline;
    var beforeProjection = c.projection || (c.baseline ? c.baseline : null);

    // 1. fade what is short-lived, relax the ground game slightly
    fx.enthusiasm *= T.speechDecay;
    fx.visibility *= T.pressDecay;
    Object.keys(fx.local).forEach(function(rk){ fx.local[rk] *= T.canvassLocalKeep; });

    // 2. apply the action, scaled by the organisation earned so far
    var mult = campaignMultiplier(fx), result = { action:key, mult:+mult.toFixed(3) };
    if(key === 'canvass'){
      var rk = campaignPickRegion(fx);
      fx.strength += T.canvassStrength;
      if(rk){
        var banked = fx.local[rk] || 0, pts = T.canvassLocalPoints * mult / (1 + T.canvassDiminish * banked);
        fx.local[rk] = banked + pts;
        result.region = rk; result.regionName = campaignRegionName(rk); result.localPts = +pts.toFixed(2);
      }
    } else if(key === 'speech'){
      var s = T.speechPoints * mult;
      fx.enthusiasm += s; result.natPts = +s.toFixed(2);
    } else if(key === 'press'){
      var pp = T.pressPoints * mult;
      fx.visibility += pp; result.natPts = +pp.toFixed(2);
    } else if(key === 'organize'){
      fx.organization += 1;
      fx.strength += T.organizeStrength;
      result.orgLevel = fx.organization;
      result.orgMult = +campaignMultiplier(fx).toFixed(3);
    }

    // 3. recompute polling and the projection under the new effects
    var proj = campaignProject(fx), summary = campaignSummary(proj);
    var pk = state.game.playerParty;
    if(summary){
      c.polls.push({ week:week, shares:summary.national });
      c.projection = { week:week, national:summary.national, constSeats:summary.constSeats, seats:summary.seats, totalSeats:summary.totalSeats };
      if(beforeSummary && beforeSummary.national){
        result.shareBefore = +beforeSummary.national[pk].toFixed(2);
        result.shareAfter = +summary.national[pk].toFixed(2);
        result.delta = +(summary.national[pk] - beforeSummary.national[pk]).toFixed(2);
      }
      if(beforeProjection && beforeProjection.seats){
        result.seatsBefore = beforeProjection.seats[pk]; result.seatsAfter = summary.seats[pk];
        result.constBefore = beforeProjection.constSeats[pk]; result.constAfter = summary.constSeats[pk];
      }
    }
    return result;
  }

  // Weekly tracker polls as extra rows for the existing polling graph (campaign phase only). Same deterministic
  // noise recipe as the quarterly polls; week 0 is the campaign-start poll at the draft quarter.
  function campaignPollRows(){
    if(!state.game || state.game.phase !== 'campaign') return [];
    var c = campaignEnsure();
    if(!c || !c.baseline) return [];
    var T = CAMPAIGN_TUNING, N = state.history.length, rows = [];
    var series = [{ week:0, shares:c.baseline.national }].concat(c.polls);
    var lastWeek = series[series.length-1].week;
    series.forEach(function(p){
      var t = N + p.week * T.pollStep;
      var show = p.week === 0 || p.week % 4 === 0 || p.week === lastWeek;
      var row = {
        t: t,
        quarter: show ? (p.week === 0 ? state.draft.quarter : 'Wk ' + p.week) : '',   // x-axis label (blank on most weeks to avoid crowding)
        pollLabel: p.week === 0 ? state.draft.quarter : 'week ' + p.week,               // used by the campaign screen
        quarterIndex: t,
        pollIndex: 0,
        campaignWeek: p.week
      };
      PARTIES.forEach(function(pt, pi){
        var seed = (N + 1 + p.week * 0.37) * 17.31 + 11.73 + (pi + 1) * 7.19;
        var noise = Math.sin(seed) * 0.72 + Math.cos(seed * 1.73) * 0.34 + Math.sin(seed * 0.37 + pi) * 0.22;
        var base = Number(p.shares[pt.key]);
        row[pt.name] = Number(Math.max(0, base + noise * T.pollNoise).toFixed(3));
      });
      rows.push(row);
    });
    return rows;
  }

  // Puts the campaign's effects on the simulator for the map (and switches them off outside the campaign).
  function campaignApplyToMap(){
    if(!window.pruState) return;
    var c = state.game && state.game.phase === 'campaign' ? campaignEnsure() : null;
    if(!c || campaignPlayerIndex() < 0){ window.pruState.localSwings = null; return; }
    var arrs = campaignSwingArrays(c.fx);
    Object.keys(PRU_UI_PARTY_ORDER).forEach(function(idx){ window.pruState.swings[idx] = arrs.national[idx]; });
    window.pruState.localSwings = arrs.local;
  }


  function onCampaignAction(key){
    if(!state.game || state.game.phase !== 'campaign') return;
    var def = CAMPAIGN_ACTIONS.filter(function(a){ return a.key === key; })[0];
    if(!def) return;
    if(!state.game.campaign) state.game.campaign = { actions: [] };
    var entry = { week: state.game.campaignWeek, action: def.key };
    state.game.campaign.actions.push(entry);
    // Phase 2 Step 6: the chosen action now has effects (see the campaign effects block above).
    try{ entry.result = campaignApplyAction(def.key, state.game.campaignWeek); }
    catch(e){ if(window.console && console.warn) console.warn('Campaign effects failed:', e); }
    var leavingCampaign = state.game.campaignWeek >= CAMPAIGN_WEEKS;
    if(leavingCampaign){
      // Week 12's action just got logged above — now hand off to the election phase.
      var idx = GAME_PHASES.indexOf('campaign');
      state.game.phase = GAME_PHASES[idx+1] || 'election';
      state.game.campaignWeek = 0; // mirrors defaultGameState()'s "0 when not in a campaign phase"
    } else {
      state.game.campaignWeek += 1;
    }
    state.updatedAt = Date.now();
    // Staying on the campaign screen for another week: update the map, the
    // polling graph, the week/calendar, the news and the funds/pledge
    // panels in place (see renderCampaignWeekUpdate()) rather than running
    // the full render() — which rebuilds the Control Center behind the
    // overlay and used to make the whole campaign screen visibly flash/
    // rebuild on every End Week. Once the campaign itself ends, fall back
    // to the full render() so the next phase's screen gets built properly.
    if(leavingCampaign) render();
    else renderCampaignWeekUpdate();
    schedulePersist();
  }

  // Lightweight per-week refresh used while staying inside the campaign
  // screen (see onCampaignAction() above). Deliberately does NOT touch
  // #app (the Control Center) or renderPage1() — both are hidden behind
  // the campaign overlay and rebuilding them is both unnecessary and the
  // main source of the old "whole screen reloads" bug.
  function renderCampaignWeekUpdate(){
    syncPrussiaMap();     // repaints the existing map/legend/seat-graph nodes in place
    syncPollingGraph();   // appends this week's tracker poll to the existing polling graph
    renderCampaignScreen(); // updates head/you/actions/news/foot in place; the shell itself is untouched
    // Nudged last, after cmp-news/cmp-you have been refilled: with the news column's height now pinned
    // (see .cmp-lead p / .cmp-chron above) this should mostly be a no-op, but it still ought to measure the
    // week's *final* layout rather than the previous week's, in case anything else ever changes cmp-main's size.
    cmpNudgeResize();
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

      data = data.concat(campaignPollRows());   // Phase 2 Step 6: weekly campaign tracker polls (empty outside the campaign)
      var pollOpts;
      if(state.game && state.game.phase === 'campaign'){
        // Reserve the x-axis space for the *whole* 12-week campaign from week 1 onward, instead of
        // letting updatePollingData() size the axis to only the polls filed so far. Each weekly
        // tracker poll's quarterIndex (state.history.length + week*pollStep) is a fraction of a
        // quarter, so with only a handful of quarters on record that one more week could widen the
        // chart's domain by a visible amount — and since updatePollingData() clears and redraws the
        // entire plot every time, the whole trend (not just the new point) snapped to the new,
        // wider scale each week. Pre-committing to the campaign's final width keeps the scale fixed
        // for its full 12 weeks, so nothing already on the chart moves as new weeks are added.
        pollOpts = { maxT: state.history.length + CAMPAIGN_WEEKS * CAMPAIGN_TUNING.pollStep + 0.22 };
      }
      window.updatePollingData(data, pollOpts);
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
      campaignApplyToMap();   // Phase 2 Step 6: campaign effects on top of the draft swings (campaign phase only)
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
      (s.game && s.game.phase === 'governing' ? '<button type="button" id="btn-begin-campaign">Begin Campaign &rarr;</button>' : '') +
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
    var btnBeginCampaign = document.getElementById('btn-begin-campaign');
    if(btnBeginCampaign) btnBeginCampaign.addEventListener('click', beginCampaign);
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