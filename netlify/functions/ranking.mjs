/* ============================================================
   Corridor — categorisation and relevance scoring.
   Deliberately transparent: keywords + recency + source quality.
   No AI, no network, no cost. Fast enough to run on every story.
   ============================================================ */

const K = {
  uae: ['uae','dubai','abu dhabi','sharjah','ajman','ras al khaimah','fujairah','emirati',
        'emirates','dirham','aed','rta','dewa','adnoc','emaar','dp world','mubadala','adia',
        'dfm','adx','jebel ali','etihad','emirates airline','dubai police','mohammed bin rashid'],

  gcc: ['saudi','riyadh','jeddah','neom','qatar','doha','oman','muscat','bahrain','manama',
        'kuwait','gcc','gulf cooperation','aramco','pif','opec','khaleej','arabian gulf'],

  india: ['india','indian','delhi','new delhi','mumbai','bengaluru','bangalore','chennai',
          'kolkata','hyderabad','pune','gujarat','kerala','punjab','maharashtra','tamil nadu',
          'rupee','inr','sensex','nifty','rbi','sebi','modi','reliance','tata','adani','infosys',
          'lok sabha','gst','upi'],

  corridor: ['india uae','uae india','india-uae','uae-india','cepa','bilateral','remittance',
             'indian expat','indian expatriate','indian diaspora','nri','non-resident indian',
             'golden visa','imec','rupee-dirham','indian community','india gulf','gulf india'],

  business: ['market','markets','stocks','shares','equity','bond','yield','inflation',
             'interest rate','central bank','federal reserve','rbi','oil','brent','crude','opec',
             'gold','currency','forex','tariff','tariffs','trade','gdp','earnings','ipo',
             'investors','index','economy','recession','dollar','barrel','real estate','property',
             'revenue','profit','merger','acquisition','startup','funding','valuation'],

  /* Focused: only genuinely consequential credit and corporate-risk events.
     Technical IFRS/ECL/collections vocabulary is deliberately NOT weighted here. */
  credit: ['insolvency','bankruptcy','liquidation','wound up','winding up','receivership',
           'payment default','defaulted','debt restructuring','restructure debt','bounced cheque',
           'cheque bounce','credit bureau','aecb','loan default','bad loans','npa',
           'non-performing','financial distress','creditors','administration','chapter 11',
           'trade credit insurance','credit insurer','lending','bank credit','sme credit',
           'working capital','receivables','fraud','embezzlement','ponzi','collapse of'],

  entertainment: ['film','movie','cinema','bollywood','hollywood','box office','trailer',
                  'streaming','netflix','prime video','disney+','jio','series','season',
                  'actor','actress','director','music','album','concert','festival','award',
                  'oscars','cannes','grammy','emmy','ott','release date','casting','biopic'],

  sports: ['cricket','ipl','odi','test match','t20','football','soccer','premier league',
           'fifa','world cup','olympics','tennis','formula 1','f1','grand prix','golf',
           'badminton','kabaddi','hockey','match','tournament','championship','medal'],

  tech: ['ai','artificial intelligence','chatgpt','openai','google','apple','microsoft','meta',
         'nvidia','chip','semiconductor','smartphone','iphone','android','app','software',
         'cybersecurity','data breach','satellite','space','robotics','electric vehicle','ev',
         'crypto','bitcoin','blockchain','5g','cloud computing']
};

const ESCALATION = ['war','conflict','strike','strikes','airstrike','missile','drone','attack',
  'killed','casualties','troops','invasion','ceasefire','sanctions','blockade','evacuate',
  'escalation','clash','hostage','terror','coup','emergency','disaster','earthquake','crash',
  'strait of hormuz','red sea','shipping disruption','energy security'];

const PROMO = ['sponsored','partner content','advertorial','promoted','in association with',
  'brandpost','press release','paid post','shop now','discount code','best deals','buying guide'];

const FILLER = ['horoscope','astrology','zodiac','recipe','weight loss','skincare','viral video',
  'watch:','netizens','fans react','slams','trolls','breaks silence','spotted at','dating rumours',
  'rumoured','love life','cryptic post','sends internet into','wardrobe malfunction'];

const count = (text, words) => {
  let n = 0;
  for (const w of words) if (text.includes(w)) n++;
  return n;
};

/* Which category a story belongs to. Order matters: corridor and credit are
   narrow and specific, so they get first refusal before broader buckets. */
export function categorise(story, hint) {
  const t = `${story.title} ${story.summary}`.toLowerCase();

  const s = {
    corridor: count(t, K.corridor) * 3,
    credit: count(t, K.credit) * 2,
    entertainment: count(t, K.entertainment),
    sports: count(t, K.sports),
    tech: count(t, K.tech),
    uae: count(t, K.uae),
    gcc: count(t, K.gcc),
    india: count(t, K.india),
    business: count(t, K.business)
  };

  /* A feed that only ever carries one kind of story nudges its own bucket,
     but never overrides clear textual evidence of something else. */
  if (hint && s[hint] !== undefined) s[hint] += 2;

  const india = s.india, gulf = s.uae + s.gcc;

  /* genuine corridor stories mention both shores */
  if (s.corridor > 0 || (india >= 1 && gulf >= 1)) return 'corridor';

  let best = 'world', bestScore = 0;
  for (const [k, v] of Object.entries(s)) {
    if (v > bestScore) { best = k; bestScore = v; }
  }
  if (bestScore === 0) return 'world';

  /* business/uae/india overlap constantly — prefer the place over the theme
     unless the business signal is clearly dominant */
  if (best === 'business' && (s.uae >= 2 || s.india >= 2 || s.gcc >= 2)) {
    if (s.uae >= s.india && s.uae >= s.gcc) return 'uae';
    if (s.gcc >= s.india) return 'gcc';
    return 'india';
  }
  return best;
}

export function scoreStory(story, source) {
  const t = `${story.title} ${story.summary}`.toLowerCase();

  const indiaImpact = Math.min(5, count(t, K.india) + count(t, K.corridor) * 2);
  const gulfImpact = Math.min(5, count(t, K.uae) + count(t, K.gcc) + count(t, K.corridor) * 2);
  const escalation = Math.min(5, count(t, ESCALATION));

  const ageHours = Math.max(0, (Date.now() - new Date(story.publishedAt).getTime()) / 36e5);
  const recency = Math.exp(-ageHours / 20) * 10;          // ~half-life of 14h

  let relevance =
      recency
    + gulfImpact * 2.4
    + indiaImpact * 2.0
    + count(t, K.corridor) * 4.0
    + count(t, K.business) * 1.1
    + count(t, K.credit) * 1.6
    + escalation * 1.8;

  relevance *= (source?.weight ?? 1);

  /* demote the things the brief explicitly does not want */
  if (count(t, PROMO) > 0) relevance -= 25;
  if (count(t, FILLER) > 0) relevance -= 8;

  return {
    relevanceScore: Math.round(relevance * 100) / 100,
    indiaImpact, gulfImpact, escalation
  };
}

export const isPromotional = text => count(String(text).toLowerCase(), PROMO) > 0;
export const isFiller = text => count(String(text).toLowerCase(), FILLER) > 0;

/* ------------------------------------------------------------
   "For You" — ranking guidance, not rigid quotas.
   Stories are drawn from per-category queues in proportion to the
   target mix, but anything with a very high relevance score jumps
   the queue so breaking news is never held back by its bucket.
   ------------------------------------------------------------ */
export const FEED_MIX = {
  uae: 0.16, gcc: 0.09, india: 0.20, corridor: 0.10, world: 0.10,
  business: 0.15, credit: 0.10, entertainment: 0.05, sports: 0.03, tech: 0.02
};

export function balanceFeed(stories, limit = 90) {
  const ranked = [...stories].sort((a, b) => b.relevanceScore - a.relevanceScore);
  if (!ranked.length) return [];

  /* breaking news bypasses the mix entirely */
  const cutoff = ranked[0].relevanceScore * 0.82;
  const urgent = ranked.filter(s => s.relevanceScore >= cutoff && s.escalation >= 2).slice(0, 6);
  const urgentIds = new Set(urgent.map(s => s.id));

  const queues = {};
  for (const s of ranked) {
    if (urgentIds.has(s.id)) continue;
    (queues[s.category] ||= []).push(s);
  }

  const out = [...urgent];
  const debt = {};
  for (const c of Object.keys(FEED_MIX)) debt[c] = 0;

  while (out.length < limit) {
    let picked = false;
    /* each pass, take from the category currently furthest below its target */
    const order = Object.keys(FEED_MIX).sort((a, b) => {
      const aHave = out.filter(s => s.category === a).length / Math.max(out.length, 1);
      const bHave = out.filter(s => s.category === b).length / Math.max(out.length, 1);
      return (FEED_MIX[b] - bHave) - (FEED_MIX[a] - aHave);
    });
    for (const c of order) {
      if (queues[c]?.length) { out.push(queues[c].shift()); picked = true; break; }
    }
    if (!picked) break;   // every queue drained
  }

  /* top up with whatever is left if the mix ran dry before the limit */
  if (out.length < limit) {
    const have = new Set(out.map(s => s.id));
    for (const s of ranked) {
      if (out.length >= limit) break;
      if (!have.has(s.id)) out.push(s);
    }
  }
  return out;
}
