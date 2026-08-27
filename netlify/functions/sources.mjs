/* ============================================================
   Corridor — fixed server-side source allowlist.
   Nothing here is user-controllable. The function will refuse
   any URL that is not in this file.

   method: 'rss'             direct publisher feed
           'google-news-rss' publisher-filtered Google News query
   weight: source-quality multiplier applied during ranking
   ============================================================ */

const GN = (query, locale = 'AE') => {
  const loc = locale === 'IN'
    ? 'hl=en-IN&gl=IN&ceid=IN%3Aen'
    : locale === 'US'
      ? 'hl=en-US&gl=US&ceid=US%3Aen'
      : 'hl=en-AE&gl=AE&ceid=AE%3Aen';
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${loc}`;
};

export const SOURCES = [
  /* ---------------- UAE ---------------- */
  { name: 'The National', region: 'uae', weight: 1.35, method: 'rss',
    url: 'https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml' },

  { name: 'Khaleej Times', region: 'uae', weight: 1.35, method: 'google-news-rss',
    url: GN('site:khaleejtimes.com') },
  { name: 'Khaleej Times', region: 'uae', weight: 1.3, method: 'google-news-rss',
    url: GN('site:khaleejtimes.com UAE business') },
  { name: 'Khaleej Times', region: 'corridor', weight: 1.4, method: 'google-news-rss',
    url: GN('site:khaleejtimes.com India UAE') },
  { name: 'Khaleej Times', region: 'uae', weight: 1.0, method: 'google-news-rss',
    hint: 'entertainment', url: GN('site:khaleejtimes.com entertainment') },

  { name: 'Gulf News', region: 'uae', weight: 1.35, method: 'google-news-rss',
    url: GN('site:gulfnews.com') },
  { name: 'Gulf News', region: 'uae', weight: 1.3, method: 'google-news-rss',
    url: GN('site:gulfnews.com UAE business') },
  { name: 'Gulf News', region: 'corridor', weight: 1.4, method: 'google-news-rss',
    url: GN('site:gulfnews.com India UAE') },
  { name: 'Gulf News', region: 'uae', weight: 1.0, method: 'google-news-rss',
    hint: 'entertainment', url: GN('site:gulfnews.com entertainment') },

  { name: 'Gulf Today', region: 'uae', weight: 1.1, method: 'rss',
    url: 'https://www.gulftoday.ae/rss' },
  { name: 'Gulf Today', region: 'uae', weight: 1.05, method: 'google-news-rss',
    url: GN('site:gulftoday.ae UAE') },

  /* ---------------- GCC ---------------- */
  { name: 'AGBI', region: 'gcc', weight: 1.3, method: 'rss',
    url: 'https://www.agbi.com/feed/' },
  { name: 'Gulf Business', region: 'gcc', weight: 1.2, method: 'rss',
    url: 'https://gulfbusiness.com/feed/' },
  { name: 'Arab News', region: 'gcc', weight: 1.15, method: 'rss',
    url: 'https://www.arabnews.com/rss.xml' },
  { name: 'Zawya', region: 'gcc', weight: 1.1, method: 'google-news-rss',
    url: GN('site:zawya.com Gulf business') },

  /* ---------------- India ---------------- */
  { name: 'Times of India', region: 'india', weight: 1.15, method: 'rss',
    url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
  { name: 'Times of India', region: 'world', weight: 1.1, method: 'rss',
    url: 'https://timesofindia.indiatimes.com/rssfeeds/296589292.cms' },
  { name: 'Economic Times', region: 'india', weight: 1.25, method: 'rss',
    url: 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms' },
  { name: 'Economic Times', region: 'india', weight: 1.25, method: 'rss',
    url: 'https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms' },
  { name: 'Business Standard', region: 'india', weight: 1.2, method: 'rss',
    url: 'https://www.business-standard.com/rss/markets-106.rss' },
  { name: 'The Hindu', region: 'world', weight: 1.2, method: 'rss',
    url: 'https://www.thehindu.com/news/international/feeder/default.rss' },
  { name: 'The Hindu', region: 'india', weight: 1.2, method: 'rss',
    url: 'https://www.thehindu.com/business/feeder/default.rss' },

  /* ---------------- India–Gulf corridor ---------------- */
  { name: 'Corridor Wire', region: 'corridor', weight: 1.45, method: 'google-news-rss',
    url: GN('India UAE trade OR CEPA OR remittance OR investment') },
  { name: 'Corridor Wire', region: 'corridor', weight: 1.35, method: 'google-news-rss',
    url: GN('Indian expatriates UAE visa OR jobs OR flights', 'IN') },

  /* ---------------- World ---------------- */
  { name: 'BBC World', region: 'world', weight: 1.3, method: 'rss',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'BBC Business', region: 'world', weight: 1.25, method: 'rss',
    url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { name: 'Al Jazeera', region: 'world', weight: 1.2, method: 'rss',
    url: 'https://www.aljazeera.com/xml/rss/all.xml' },

  /* ---------------- Credit & corporate risk ---------------- */
  { name: 'Credit Wire', region: 'gcc', weight: 1.25, method: 'google-news-rss',
    hint: 'credit', url: GN('UAE OR Gulf corporate insolvency OR liquidation OR payment default OR bounced cheque') },
  { name: 'Credit Wire', region: 'india', weight: 1.2, method: 'google-news-rss',
    hint: 'credit', url: GN('India corporate default OR insolvency OR IBC OR bank lending OR SME credit', 'IN') },

  /* ---------------- Entertainment ---------------- */
  { name: 'Variety', region: 'world', weight: 1.15, method: 'rss',
    hint: 'entertainment', url: 'https://variety.com/feed/' },
  { name: 'The Hollywood Reporter', region: 'world', weight: 1.15, method: 'rss',
    hint: 'entertainment', url: 'https://www.hollywoodreporter.com/feed/' },
  { name: 'BBC Culture', region: 'world', weight: 1.1, method: 'rss',
    hint: 'entertainment', url: 'https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml' },
  { name: 'Indian Express', region: 'india', weight: 1.1, method: 'rss',
    hint: 'entertainment', url: 'https://indianexpress.com/section/entertainment/feed/' },
  { name: 'The Hindu', region: 'india', weight: 1.1, method: 'rss',
    hint: 'entertainment', url: 'https://www.thehindu.com/entertainment/feeder/default.rss' },
  { name: 'Hindustan Times', region: 'india', weight: 1.05, method: 'rss',
    hint: 'entertainment', url: 'https://www.hindustantimes.com/feeds/rss/entertainment/rssfeed.xml' },
  { name: 'Bollywood Wire', region: 'india', weight: 1.05, method: 'google-news-rss',
    hint: 'entertainment', url: GN('Bollywood OR "Indian cinema" release OR casting OR trailer', 'IN') },

  /* ---------------- Sports ---------------- */
  { name: 'BBC Sport', region: 'world', weight: 1.15, method: 'rss',
    hint: 'sports', url: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { name: 'Sports Wire', region: 'india', weight: 1.1, method: 'google-news-rss',
    hint: 'sports', url: GN('India cricket OR IPL OR football UAE', 'IN') },

  /* ---------------- Technology ---------------- */
  { name: 'BBC Technology', region: 'world', weight: 1.15, method: 'rss',
    hint: 'tech', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml' },
  { name: 'The Verge', region: 'world', weight: 1.1, method: 'rss',
    hint: 'tech', url: 'https://www.theverge.com/rss/index.xml' }
];

/* Publisher names used to strip the " - Publisher" suffix Google News appends. */
export const PUBLISHERS = [
  'Khaleej Times', 'Gulf News', 'Gulf Today', 'The National', 'Arab News', 'Zawya',
  'AGBI', 'Gulf Business', 'Arabian Business', 'Times of India', 'The Times of India',
  'Economic Times', 'The Economic Times', 'Business Standard', 'The Hindu',
  'Hindustan Times', 'Indian Express', 'The Indian Express', 'Mint', 'Livemint',
  'Reuters', 'Bloomberg', 'BBC', 'BBC News', 'Al Jazeera', 'CNN', 'CNBC',
  'Variety', 'The Hollywood Reporter', 'Deadline', 'NDTV', 'Moneycontrol',
  'Financial Times', 'The Guardian', 'Associated Press', 'AP News', 'Sky News',
  'Firstpost', 'News18', 'India Today', 'Bollywood Hungama', 'Pinkvilla', 'Zee News',
  'The New Indian Express', 'Deccan Herald', 'Telegraph India', 'Republic World',
  'ESPNcricinfo', 'The Verge', 'Engadget', 'TechCrunch', 'Emirates 24|7'
];

export const ALLOWED_HOSTS = new Set(
  SOURCES.map(s => {
    try { return new URL(s.url).hostname; } catch { return null; }
  }).filter(Boolean)
);
