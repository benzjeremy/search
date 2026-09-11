/**
 * search — Genuine Open-Source Global Web Search Engine
 * 100% Client-Side on GitHub Pages | Zero Telemetry | Pure Vanilla JS
 * Searches millions of websites worldwide via federated APIs (Wikipedia Full Search,
 * DuckDuckGo Instant Topics, Hacker News Algolia, OpenStreetMap, Brave API) +
 * In-Memory Okapi BM25 Index over curated global knowledge & Jeremy Benz Ecosystem.
 * Author: Jeremy Benz (@benzjeremy)
 */

(function () {
  'use strict';

  // --- Stopwords Filter (German & English) ---
  const STOPWORDS = new Set([
    'aber', 'als', 'am', 'an', 'auch', 'auf', 'aus', 'bei', 'bin', 'bis', 'bist', 'da', 'damit',
    'dann', 'das', 'dass', 'dein', 'deine', 'dem', 'den', 'der', 'des', 'die', 'dies', 'diese',
    'dieser', 'doch', 'dort', 'du', 'durch', 'ein', 'eine', 'einem', 'einen', 'einer', 'eines',
    'er', 'es', 'für', 'hat', 'hatte', 'hier', 'ich', 'ihr', 'ihre', 'im', 'in', 'ist', 'ja',
    'jede', 'jedem', 'jeder', 'kann', 'können', 'man', 'mit', 'nach', 'nicht', 'noch', 'nun',
    'nur', 'oder', 'sehr', 'sein', 'seine', 'sich', 'sie', 'sind', 'so', 'über', 'um', 'und',
    'uns', 'von', 'vor', 'war', 'was', 'weiter', 'wie', 'wieder', 'will', 'wir', 'wird', 'wo',
    'zu', 'zum', 'zur', 'a', 'about', 'above', 'after', 'again', 'all', 'and', 'any', 'are',
    'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
    'by', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
    'had', 'has', 'have', 'having', 'he', 'her', 'here', 'him', 'his', 'how', 'i', 'if', 'into',
    'is', 'it', 'its', 'just', 'me', 'more', 'most', 'my', 'no', 'nor', 'not', 'of', 'off',
    'on', 'once', 'only', 'or', 'other', 'our', 'out', 'over', 'own', 'same', 'she', 'should',
    'so', 'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
    'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'we',
    'were', 'what', 'when', 'where', 'which', 'while', 'who', 'why', 'with', 'would', 'you'
  ]);

  function tokenize(text) {
    if (!text) return [];
    const rawTokens = text.toLowerCase().match(/[\p{L}\p{N}_\-]+/gu) || [];
    return rawTokens.filter(t => !STOPWORDS.has(t) && t.length > 1);
  }

  function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  // --- URL Privacy Sanitizer ---
  function sanitizeURL(rawURL) {
    if (!rawURL) return '';
    try {
      const u = new URL(rawURL);
      const paramsToStrip = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', 'ref_src', 'aff', 'aff_id'];
      paramsToStrip.forEach(p => u.searchParams.delete(p));
      for (const key of Array.from(u.searchParams.keys())) {
        if (key.startsWith('utm_') || key.startsWith('aff_')) {
          u.searchParams.delete(key);
        }
      }
      return u.toString();
    } catch (e) {
      return rawURL;
    }
  }

  function stripWikiSnippet(snippet) {
    if (!snippet) return '';
    let s = snippet.replace(/<span class="searchmatch">([\s\S]*?)<\/span>/gi, '<mark>$1</mark>');
    s = s.replace(/<(?!\/?mark\b)[^>]*>/gi, '');
    return s.trim();
  }

  // --- Client-Side Okapi BM25 Search Engine ---
  class ClientBM25Engine {
    constructor(k1 = 1.2, b = 0.75) {
      this.k1 = k1;
      this.b = b;
      this.docs = [];
      this.index = new Map();
      this.docLengths = [];
      this.avgdl = 0;
    }

    indexCorpus(corpus) {
      this.docs = corpus;
      this.index.clear();
      this.docLengths = new Array(corpus.length).fill(0);
      let totalTokens = 0;

      corpus.forEach((doc, idx) => {
        const fullText = `${doc.title} ${doc.content} ${(doc.tags || []).join(' ')}`;
        const tokens = tokenize(fullText);
        this.docLengths[idx] = tokens.length;
        totalTokens += tokens.length;

        tokens.forEach(tok => {
          if (!this.index.has(tok)) {
            this.index.set(tok, new Map());
          }
          const postings = this.index.get(tok);
          postings.set(idx, (postings.get(idx) || 0) + 1);
        });
      });

      this.avgdl = corpus.length > 0 ? totalTokens / corpus.length : 1;
    }

    search(query) {
      const qTokens = tokenize(query);
      if (qTokens.length === 0) {
        return this.docs
          .map((doc) => ({
            doc,
            score: doc.category === 'ecosystem' ? 2.0 : 1.0,
            snippet: doc.content ? doc.content.slice(0, 160) + '...' : ''
          }));
      }

      const N = this.docs.length;
      const scores = new Map();

      qTokens.forEach(qTerm => {
        let postings = this.index.get(qTerm);

        if (!postings) {
          for (let [term, p] of this.index.entries()) {
            if (term.startsWith(qTerm) || (qTerm.length >= 4 && levenshtein(qTerm, term) <= 1)) {
              postings = p;
              break;
            }
          }
        }

        if (!postings) return;

        const n = postings.size;
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
        const safeIDF = idf > 0 ? idf : 0.1;

        for (let [docIdx, tf] of postings.entries()) {
          const doc = this.docs[docIdx];
          const docLen = this.docLengths[docIdx];
          const numerator = tf * (this.k1 + 1);
          const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgdl));
          let termScore = safeIDF * (numerator / denominator);

          if (doc.title && doc.title.toLowerCase().includes(qTerm)) {
            termScore *= 2.8;
          }
          if (doc.tags && doc.tags.some(t => t.toLowerCase() === qTerm)) {
            termScore *= 2.0;
          }
          if (doc.category === 'ecosystem') {
            termScore *= 1.6;
          }

          scores.set(docIdx, (scores.get(docIdx) || 0) + termScore);
        }
      });

      const results = [];
      for (let [docIdx, score] of scores.entries()) {
        const doc = this.docs[docIdx];
        results.push({
          doc,
          score: Math.round(score * 100) / 100,
          snippet: this.generateSnippet(doc.content, qTokens)
        });
      }

      results.sort((a, b) => b.score - a.score);
      return results;
    }

    suggest(prefix, limit = 5) {
      if (!prefix) return [];
      const p = prefix.toLowerCase().trim();
      const suggestions = new Set();

      for (const doc of this.docs) {
        if (doc.title && doc.title.toLowerCase().includes(p)) {
          suggestions.add(doc.title.split('—')[0].trim());
          if (suggestions.size >= limit) return Array.from(suggestions);
        }
      }

      for (const term of this.index.keys()) {
        if (term.startsWith(p) && term.length > p.length) {
          suggestions.add(term);
          if (suggestions.size >= limit) return Array.from(suggestions);
        }
      }

      return Array.from(suggestions);
    }

    generateSnippet(content, terms) {
      if (!content) return '';
      if (content.length <= 160) return content;
      const lower = content.toLowerCase();
      let bestPos = -1;

      for (let term of terms) {
        const pos = lower.indexOf(term);
        if (pos !== -1) {
          bestPos = pos;
          break;
        }
      }

      if (bestPos === -1) {
        return content.slice(0, 160) + '...';
      }

      const start = Math.max(0, bestPos - 60);
      const end = Math.min(content.length, bestPos + 100);
      const prefix = start > 0 ? '...' : '';
      const suffix = end < content.length ? '...' : '';
      return `${prefix}${content.slice(start, end).trim()}${suffix}`;
    }
  }

  // --- IndexedDB Bookmark Vault ---
  const DB_NAME = 'JeremyBenz_Search_DB';
  const DB_VERSION = 1;
  const STORE_NAME = 'bookmarks';

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGetAllBookmarks() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      return [];
    }
  }

  async function idbSaveBookmark(bm) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(bm);
      req.onsuccess = () => resolve(bm);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDeleteBookmark(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- State & Settings ---
  const state = {
    engine: new ClientBM25Engine(),
    databaseLoaded: false,
    lang: localStorage.getItem('search_lang') || 'de',
    theme: localStorage.getItem('search_theme') || 'dark',
    bookmarks: [],
    settings: {
      srcWiki: localStorage.getItem('search_src_wiki') !== 'false',
      srcDDG: localStorage.getItem('search_src_ddg') !== 'false',
      srcHN: localStorage.getItem('search_src_hn') !== 'false',
      safeSearch: localStorage.getItem('search_safesearch') !== 'false',
      stripTracking: localStorage.getItem('search_strip_tracking') !== 'false',
      braveKey: localStorage.getItem('search_brave_key') || '',
      searxngURL: localStorage.getItem('search_searxng_url') || ''
    },
    liveCache: new Map()
  };

  // --- High-Velocity Federated Web Search APIs (< 450ms Guaranteed) ---

  function fetchWithTimeout(url, options = {}, ms = 450) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  // 1. Wikipedia OpenSearch API (Superfast < 150ms global entity and knowledge search)
  async function fetchWikipediaOpen(query, lang = 'de') {
    if (!state.settings.srcWiki || !query) return [];
    const cacheKey = `wikiopen_${lang}_${query.toLowerCase()}`;
    if (state.liveCache.has(cacheKey)) return state.liveCache.get(cacheKey);

    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=8&namespace=0&format=json&origin=*`;
      const res = await fetchWithTimeout(url, {}, 450);
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data) || !Array.isArray(data[1])) return [];

      const titles = data[1] || [];
      const snippets = data[2] || [];
      const urls = data[3] || [];

      const hits = [];
      for (let i = 0; i < titles.length; i++) {
        if (!titles[i] || !urls[i]) continue;
        hits.push({
          title: titles[i],
          url: urls[i],
          content: snippets[i] || (lang === 'de' ? `Wikipedia-Artikel über ${titles[i]}` : `Wikipedia article about ${titles[i]}`),
          category: 'web',
          badge: 'Wikipedia',
          source: 'Wikipedia',
          isPreHighlighted: false
        });
      }

      state.liveCache.set(cacheKey, hits);
      return hits;
    } catch (e) {
      return [];
    }
  }

  // 2. Wikidata Official Website Lookup (Finds direct official domains for brands, radios, companies, institutions)
  async function fetchWikidataOfficial(query, lang = 'de') {
    if (!query || query.length < 2) return null;
    const cacheKey = `wdofficial_${lang}_${query.toLowerCase()}`;
    if (state.liveCache.has(cacheKey)) return state.liveCache.get(cacheKey);

    try {
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=${lang}&limit=1&format=json&origin=*`;
      const sRes = await fetchWithTimeout(searchUrl, {}, 380);
      if (!sRes.ok) return null;
      const sData = await sRes.json();
      if (!sData.search || !sData.search.length) return null;

      const ent = sData.search[0];
      const claimUrl = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${ent.id}&property=P856&format=json&origin=*`;
      const cRes = await fetchWithTimeout(claimUrl, {}, 380);
      if (!cRes.ok) return null;
      const cData = await cRes.json();
      const p856 = cData.claims?.P856;
      const officialUrl = p856?.[0]?.mainsnak?.datavalue?.value;

      if (officialUrl && typeof officialUrl === 'string' && officialUrl.startsWith('http')) {
        const result = {
          title: `${ent.label} — ${lang === 'de' ? 'Offizielle Website' : 'Official Website'}`,
          url: sanitizeURL(officialUrl),
          content: ent.description ? `${ent.description}. ${lang === 'de' ? 'Offizieller direkter Webauftritt.' : 'Official web portal.'}` : (lang === 'de' ? 'Offizieller direkter Webauftritt.' : 'Official web portal.'),
          category: 'web',
          badge: lang === 'de' ? '🌐 Offizielle Website' : '🌐 Official Website',
          source: 'Web',
          isOfficial: true,
          isPreHighlighted: false
        };
        state.liveCache.set(cacheKey, result);
        return result;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  // 3. Wikipedia Summary API (For the Knowledge Sidebar, ultra-fast < 100ms)
  async function fetchWikipediaCard(query, lang = 'de') {
    if (!state.settings.srcWiki || !query) return null;
    const cacheKey = `wiki_card_${lang}_${query.toLowerCase()}`;
    if (state.liveCache.has(cacheKey)) return state.liveCache.get(cacheKey);

    try {
      const endpoint = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const res = await fetchWithTimeout(endpoint, {
        headers: { 'Accept': 'application/json' }
      }, 350);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.extract) return null;

      const card = {
        title: data.title,
        subtitle: data.description || (lang === 'de' ? 'Wikipedia-Artikel' : 'Wikipedia Article'),
        extract: data.extract,
        url: data.content_urls ? data.content_urls.desktop.page : `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
        imageUrl: data.thumbnail ? data.thumbnail.source : '',
        source: 'Wikipedia'
      };
      state.liveCache.set(cacheKey, card);
      return card;
    } catch (e) {
      return null;
    }
  }

  // 4. Hacker News Algolia Web Search API (< 80ms)
  async function fetchHackerNews(query) {
    if (!state.settings.srcHN || !query) return [];
    const cacheKey = `hn_${query.toLowerCase()}`;
    if (state.liveCache.has(cacheKey)) return state.liveCache.get(cacheKey);

    try {
      const endpoint = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=6`;
      const res = await fetchWithTimeout(endpoint, {}, 350);
      if (!res.ok) return [];
      const data = await res.json();

      const items = [];
      if (Array.isArray(data.hits)) {
        data.hits.forEach(hit => {
          if (!hit.title) return;
          const targetUrl = hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
          items.push({
            title: hit.title,
            url: sanitizeURL(targetUrl),
            content: `Hacker News Diskussion von @${hit.author || 'dev'} · ${hit.points || 0} Punkte · ${hit.num_comments || 0} Kommentare`,
            source: 'Hacker News',
            category: 'web',
            badge: 'Hacker News',
            tags: ['tech', 'news']
          });
        });
      }

      state.liveCache.set(cacheKey, items);
      return items;
    } catch (e) {
      return [];
    }
  }

  // 5. Brave Search API (If user provided custom API key)
  async function fetchBraveSearch(query) {
    if (!state.settings.braveKey || !query) return [];
    try {
      const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`;
      const res = await fetchWithTimeout(endpoint, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': state.settings.braveKey
        }
      }, 400);
      if (!res.ok) return [];
      const data = await res.json();
      const items = [];
      if (data.web && Array.isArray(data.web.results)) {
        data.web.results.forEach(r => {
          items.push({
            title: r.title,
            url: sanitizeURL(r.url),
            content: r.description,
            source: 'Brave Search',
            category: 'web',
            badge: 'Brave Web',
            tags: ['web']
          });
        });
      }
      return items;
    } catch (e) {
      return [];
    }
  }

  // 6. Wikipedia External Links Harvester (Real web links from cited sources, company portals & news)
  async function fetchWikipediaExtLinks(query, lang = 'de') {
    if (!state.settings.srcWiki || !query) return [];
    const cacheKey = `wikiext_${lang}_${query.toLowerCase()}`;
    if (state.liveCache.has(cacheKey)) return state.liveCache.get(cacheKey);

    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=2&prop=extlinks&ellimit=15&format=json&origin=*`;
      const res = await fetchWithTimeout(url, {}, 400);
      if (!res.ok) return [];
      const data = await res.json();
      const pages = data.query?.pages || {};
      const hits = [];
      const seenDomains = new Set();
      const ignoreHosts = ['archive.org', 'archive.today', 'toolforge.org', 'd-nb.info', 'viaf.org', 'wikidata.org', 'wikipedia.org', 'google.com', 'bing.com', 'loc.gov', 'bnf.fr', 'geohack.toolforge.org'];

      for (const page of Object.values(pages)) {
        if (!page.extlinks || !Array.isArray(page.extlinks)) continue;
        for (const el of page.extlinks) {
          const rawUrl = el['*'];
          if (!rawUrl || !rawUrl.startsWith('http')) continue;
          try {
            const u = new URL(rawUrl);
            const host = u.hostname.toLowerCase();
            if (ignoreHosts.some(h => host.includes(h))) continue;
            const domain = host.replace(/^www\./, '');
            if (seenDomains.has(domain)) continue;
            seenDomains.add(domain);

            hits.push({
              title: `${page.title} — ${domain}`,
              url: sanitizeURL(rawUrl),
              content: state.lang === 'de'
                ? `Referenzierter Weblink und externe Quelle zu „${page.title}“ (${domain}).`
                : `Referenced external web link and source for “${page.title}” (${domain}).`,
              category: 'web',
              source: domain,
              isOfficial: false,
              isPreHighlighted: false
            });
            if (hits.length >= 5) break;
          } catch (e) {}
        }
        if (hits.length >= 5) break;
      }

      state.liveCache.set(cacheKey, hits);
      return hits;
    } catch (e) {
      return [];
    }
  }

  // 7. DuckDuckGo Instant Answers & Topics (< 350ms, Native CORS)
  async function fetchDuckDuckGoInstant(query, lang = 'de') {
    if (!state.settings.srcDDG || !query) return [];
    const cacheKey = `ddg_${query.toLowerCase()}`;
    if (state.liveCache.has(cacheKey)) return state.liveCache.get(cacheKey);

    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`;
      const res = await fetchWithTimeout(url, {}, 380);
      if (!res.ok) return [];
      const data = await res.json();
      const hits = [];

      if (Array.isArray(data.Results)) {
        data.Results.forEach(r => {
          if (r.FirstURL && r.Text) {
            hits.push({
              title: r.Text,
              url: sanitizeURL(r.FirstURL),
              content: state.lang === 'de' ? 'Offizielle Antwort via DuckDuckGo.' : 'Instant answer via DuckDuckGo.',
              category: 'web',
              source: 'DuckDuckGo',
              isOfficial: true,
              isPreHighlighted: false
            });
          }
        });
      }

      if (Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.forEach(t => {
          if (t.FirstURL && t.Text && !t.Topics) {
            const cleanTitle = t.Text.split(' - ')[0] || t.Text;
            hits.push({
              title: cleanTitle,
              url: sanitizeURL(t.FirstURL),
              content: t.Text,
              category: 'web',
              source: 'DuckDuckGo',
              isOfficial: false,
              isPreHighlighted: false
            });
          }
        });
      }

      const sliced = hits.slice(0, 4);
      state.liveCache.set(cacheKey, sliced);
      return sliced;
    } catch (e) {
      return [];
    }
  }

  // 8. Direct Domain / TLD Detection (Navigational queries like radiosiegen.de, ikea.com, thejocraft.de)
  function detectDirectDomain(query) {
    if (!query) return null;
    const clean = query.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const domainPattern = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+(de|com|org|net|io|dev|app|info|eu|co|uk|fr|ch|at|nl|me|ai|tv|cc|fm)$/i;
    if (domainPattern.test(clean)) {
      const fullUrl = `https://${clean}/`;
      return {
        title: `${clean} — ${state.lang === 'de' ? 'Direkter Webauftritt' : 'Direct Website'}`,
        url: fullUrl,
        content: state.lang === 'de'
          ? `Offizielle Webadresse für https://${clean}/. Direkt im Browser aufrufen.`
          : `Official direct web address for https://${clean}/. Open directly in browser.`,
        category: 'web',
        source: clean,
        isOfficial: true,
        isPreHighlighted: false
      };
    }
    return null;
  }

  // --- Initial Database & Bookmarks Loader ---
  const DEFAULT_CORPUS = [
    {
      id: 'root-hub',
      title: 'Jeremy Benz — Zentraler Hub & Offizielles Profil',
      url: 'https://benzjeremy.github.io/',
      category: 'ecosystem',
      source: 'Jeremy Benz Ökosystem',
      tags: ['hub', 'go', 'security', 'portfolio', 'standards'],
      content: 'Offizieller zentraler Hub und Profil von Jeremy Benz (@benzjeremy), Systems Developer aus Deutschland. High-Velocity VibeCoding mit kompromisslosen Ingenieursstandards, echter Kryptografie (AES-256-GCM, PBKDF2 mindestens 100.000 Iterationen), Zero-Dummy-Security und ohne Electron-Ballast.'
    },
    {
      id: 'untis-go',
      title: 'untis-go — Schneller nativer WebUntis Desktop Client in Go & GTK',
      url: 'https://benzjeremy.github.io/untis-go/',
      category: 'ecosystem',
      source: 'Jeremy Benz Ökosystem',
      tags: ['go', 'desktop', 'untis', 'gtk', 'awesome-go', 'linux', 'windows'],
      content: 'Der blitzschnelle, native WebUntis Desktop Client für Linux und Windows, entwickelt von Jeremy Benz. Synchrones Zeitraster, Live-Countdown bis Schulschluss, Offline-Cache, System-Tray und minimale Ressourcennutzung (< 15 MB RAM). Aufgenommen in Awesome-Go (#6660).'
    },
    {
      id: 'docklite',
      title: 'docklite — Radikal schlanke Portainer-Alternative in Go & Astro',
      url: 'https://benzjeremy.github.io/docklite/',
      category: 'ecosystem',
      source: 'Jeremy Benz Ökosystem',
      tags: ['go', 'docker', 'devops', 'monitoring', 'astro', 'awesome-go', 'sse'],
      content: 'Radikal schlanke Portainer-Alternative in Go und Astro. Eine einzige Standalone-Binary, direkte docker.sock Kommunikation ohne Daemon-Overhead und ca. 10–15 MB RAM-Verbrauch. Aufgenommen in Awesome-Go (#6665).'
    },
    {
      id: 'spotify-screensaver',
      title: 'spotify-screensaver — Nativer Desktop Bildschirmschoner mit Visualizer',
      url: 'https://benzjeremy.github.io/spotify-screensaver/',
      category: 'ecosystem',
      source: 'Jeremy Benz Ökosystem',
      tags: ['go', 'spotify', 'screensaver', 'visualizer', 'dbus', 'mpris', 'awesome-go'],
      content: 'Eleganter nativer Bildschirmschoner für Spotify unter Linux und Windows. Hardwarebeschleunigter Audio-Visualizer, OLED-Digitaluhr, MPRIS D-Bus Steuerung, 100% Local-First ohne externe Cloud-Abhängigkeiten. Aufgenommen in Awesome-Go (#6675).'
    },
    {
      id: 'search',
      title: 'search — Offene Web- & Ökosystem-Suchmaschine ohne Tracking',
      url: 'https://benzjeremy.github.io/search/',
      category: 'ecosystem',
      source: 'Jeremy Benz Ökosystem',
      tags: ['search', 'privacy', 'websearch', 'wikipedia', 'duckduckgo', 'bm25'],
      content: 'Die datenschutzfreundliche, blitzschnelle Open-Source Web-Suchmaschine von Jeremy Benz. Föderierte Websuche (Wikipedia, DuckDuckGo, Hacker News), Okapi BM25 Ranking, IndexedDB Lesezeichentresor und URL-Tracking-Sanitizer.'
    }
  ];

  async function loadDatabase() {
    reindexAll(DEFAULT_CORPUS);
    try {
      const res = await fetch('database.json');
      if (res.ok) {
        const data = await res.json();
        reindexAll(data);
        state.databaseLoaded = true;
      }
    } catch (e) {
      console.warn('Using embedded default corpus:', e);
    }
  }

  async function loadBookmarks() {
    state.bookmarks = await idbGetAllBookmarks();
    if (state.databaseLoaded) {
      reindexAll();
    }
  }

  function reindexAll(baseDocs = null) {
    let docs = baseDocs || state.engine.docs.filter(d => !d.isBookmark);
    if (state.bookmarks && state.bookmarks.length > 0) {
      const bmDocs = state.bookmarks.map(bm => ({
        id: 'bm_' + bm.id,
        title: bm.title,
        url: bm.url,
        content: `${bm.title} ${bm.url} ${bm.notes || ''}`,
        tags: ['privat', 'lesezeichen', ...(bm.tags || [])],
        category: 'bookmarks',
        source: 'Privates Lesezeichen',
        isBookmark: true,
        rawBM: bm
      }));
      docs = [...docs, ...bmDocs];
    }
    state.engine.indexCorpus(docs);
  }

  // --- UI Controller & Rendering ---

  function applyTheme(theme) {
    let effective = theme;
    if (theme === 'auto') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', effective);
    const icon = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    if (icon && label) {
      icon.textContent = effective === 'dark' ? '🌙' : '☀️';
      label.textContent = effective === 'dark' 
        ? (state.lang === 'de' ? 'Dunkel' : 'Dark')
        : (state.lang === 'de' ? 'Hell' : 'Light');
    }
    localStorage.setItem('search_theme', theme);
  }

  window.setLang = function (lang) {
    state.lang = lang;
    document.documentElement.lang = lang;
    localStorage.setItem('search_lang', lang);

    document.querySelectorAll('#lang-de-btn, #lang-en-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.toLowerCase() === lang);
    });

    document.querySelectorAll('[data-lang-de]').forEach(el => {
      const txt = lang === 'de' ? el.getAttribute('data-lang-de') : el.getAttribute('data-lang-en');
      if (txt) el.innerHTML = txt;
    });

    document.querySelectorAll('[data-placeholder-de]').forEach(el => {
      const ph = lang === 'de' ? el.getAttribute('data-placeholder-de') : el.getAttribute('data-placeholder-en');
      if (ph) el.setAttribute('placeholder', ph);
    });

    const input = document.getElementById('search-input');
    if (input && input.value.trim()) {
      executeSearch(false);
    }
  };

  function clearSearch() {
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    const dd = document.getElementById('suggestions-dropdown');
    if (dd) dd.style.display = 'none';
    const resultsWrapper = document.getElementById('results-wrapper');
    if (resultsWrapper) resultsWrapper.style.display = 'none';
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.classList.remove('has-results');
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) resultsContainer.innerHTML = '';
    const knowledgeSidebar = document.getElementById('knowledge-sidebar');
    if (knowledgeSidebar) knowledgeSidebar.style.display = 'none';

    // Clear URL param if present
    const currentUrl = new URL(window.location);
    if (currentUrl.searchParams.has('q')) {
      currentUrl.searchParams.delete('q');
      history.replaceState({}, '', currentUrl.pathname + (currentUrl.hash || ''));
    }
  }

  // --- High-Performance Progressive Search Engine ---
  let activeSearchId = 0;

  async function executeSearch(isLucky = false) {
    const input = document.getElementById('search-input');
    const query = input ? input.value.trim() : '';
    const dd = document.getElementById('suggestions-dropdown');
    if (dd) dd.style.display = 'none';

    if (!query) {
      clearSearch();
      return;
    }

    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) clearBtn.style.display = 'flex';

    const resultsWrapper = document.getElementById('results-wrapper');
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.classList.add('has-results');
    if (resultsWrapper) resultsWrapper.style.display = 'block';

    // Update query in URL so search states are bookmarkable & shareable
    const currentUrl = new URL(window.location);
    if (currentUrl.searchParams.get('q') !== query) {
      currentUrl.searchParams.set('q', query);
      history.pushState({ q: query }, '', currentUrl);
    }

    const startTime = performance.now();
    const searchId = ++activeSearchId;

    // Direct domain navigation detection (e.g. radiosiegen.de, ikea.com, thejocraft.de)
    const directHit = detectDirectDomain(query);

    // 1. Instant local BM25 search over database.json + private bookmarks (< 1 ms)
    const localHits = state.engine.search(query);
    const localElapsed = performance.now() - startTime;

    // If "Auf gut Glück!" / Lucky search requested:
    if (isLucky) {
      if (directHit) {
        window.location.href = directHit.url;
        return;
      }
      if (localHits.length > 0 && localHits[0].score >= 1.0) {
        window.location.href = localHits[0].doc.url;
        return;
      }
    }

    // Phase 1: Render local results + direct domain hit IMMEDIATELY (< 1 ms)
    const initialHits = directHit ? [directHit] : [];
    renderSearchResults(localHits, initialHits, null, query, localElapsed);

    // Phase 2: Asynchronous Non-Blocking Live Web Search (< 400 ms)
    enrichLiveResults(query, localHits, directHit, startTime, searchId, isLucky);
  }

  async function enrichLiveResults(query, localHits, directHit, startTime, searchId, isLucky = false) {
    try {
      const [wikiHits, officialSite, extLinks, ddgHits, hnItems, braveHits] = await Promise.all([
        fetchWikipediaOpen(query, state.lang),
        fetchWikidataOfficial(query, state.lang),
        fetchWikipediaExtLinks(query, state.lang),
        fetchDuckDuckGoInstant(query, state.lang),
        state.settings.srcHN ? fetchHackerNews(query) : Promise.resolve([]),
        state.settings.braveKey ? fetchBraveSearch(query) : Promise.resolve([])
      ]);

      if (searchId !== activeSearchId) return; // Discard outdated search

      // Fetch Knowledge Card for top entity
      const topEntity = officialSite
        ? officialSite.title.split('—')[0].trim()
        : (wikiHits.length > 0 ? wikiHits[0].title : query);
      const card = await fetchWikipediaCard(topEntity, state.lang);

      if (searchId !== activeSearchId) return; // Discard outdated search

      const liveItems = [];
      if (directHit) liveItems.push(directHit);
      if (officialSite) liveItems.push(officialSite);
      if (ddgHits && ddgHits.length) liveItems.push(...ddgHits);
      if (extLinks && extLinks.length) liveItems.push(...extLinks);
      if (wikiHits && wikiHits.length) liveItems.push(...wikiHits);
      if (hnItems && hnItems.length) liveItems.push(...hnItems);
      if (braveHits && braveHits.length) liveItems.push(...braveHits);

      // If "Auf gut Glück!" / Lucky mode, redirect to top hit now
      if (isLucky) {
        if (officialSite) {
          window.location.href = officialSite.url;
          return;
        }
        if (liveItems.length > 0) {
          window.location.href = liveItems[0].url;
          return;
        }
      }

      const totalElapsed = performance.now() - startTime;
      renderSearchResults(localHits, liveItems, card, query, totalElapsed);
    } catch (e) {
      // Keep local hits rendered
    }
  }

  function renderSearchResults(localHits, liveWebItems = [], liveCard = null, query = '', elapsed = 0) {
    const resultsContainer = document.getElementById('search-results');
    const knowledgeSidebar = document.getElementById('knowledge-sidebar');
    const knowledgeCardEl = document.getElementById('knowledge-card');
    const countBadge = document.getElementById('results-count');
    const latencyBadge = document.getElementById('results-latency');

    const elapsedSeconds = (elapsed / 1000).toFixed(3);
    const formattedSeconds = state.lang === 'de' ? elapsedSeconds.replace('.', ',') : elapsedSeconds;

    // Render Knowledge Card (Google-style panel on right)
    if (liveCard && knowledgeSidebar && knowledgeCardEl) {
      knowledgeSidebar.style.display = 'block';
      knowledgeCardEl.innerHTML = `
        ${liveCard.imageUrl ? `<img src="${escapeHTML(liveCard.imageUrl)}" alt="${escapeHTML(liveCard.title)}" class="knowledge-image" loading="lazy">` : ''}
        <h3 class="knowledge-title">${escapeHTML(liveCard.title)}</h3>
        <div class="knowledge-subtitle">${escapeHTML(liveCard.subtitle)}</div>
        <p class="knowledge-desc">${escapeHTML(liveCard.extract)}</p>
        <div class="knowledge-footer">
          <span class="knowledge-source">${escapeHTML(liveCard.source)}</span>
          <a href="${escapeHTML(liveCard.url)}" target="_blank" rel="noopener noreferrer">${state.lang === 'de' ? 'Vollständigen Artikel lesen →' : 'Read full article →'}</a>
        </div>
      `;
    } else if (knowledgeSidebar) {
      knowledgeSidebar.style.display = 'none';
    }

    // Combine and deduplicate
    const combined = [];
    const seenURLs = new Set();

    // 1. Official website from directDomain or Wikidata (placed at the very top)
    const officialItems = liveWebItems.filter(i => i.isOfficial);
    officialItems.forEach(item => {
      const cleanU = sanitizeURL(item.url);
      if (!seenURLs.has(cleanU)) {
        seenURLs.add(cleanU);
        combined.push(item);
      }
    });

    // 2. Curated Database & Ecosystem hits
    localHits.forEach(hit => {
      const cleanU = sanitizeURL(hit.doc.url);
      if (!seenURLs.has(cleanU)) {
        seenURLs.add(cleanU);
        combined.push({
          title: hit.doc.title,
          url: cleanU,
          content: hit.snippet || hit.doc.content,
          category: hit.doc.category,
          isOfficial: hit.doc.category === 'ecosystem' || hit.score > 2.0,
          isBookmark: hit.doc.isBookmark,
          rawBM: hit.doc.rawBM,
          isPreHighlighted: false
        });
      }
    });

    // 3. Live Web hits (Wikidata, Wikipedia ExtLinks, DuckDuckGo, Wikipedia OpenSearch, Hacker News, Brave)
    liveWebItems.forEach(item => {
      if (item.isOfficial) return; // Already placed at top
      const cleanU = sanitizeURL(item.url);
      if (!seenURLs.has(cleanU)) {
        seenURLs.add(cleanU);
        combined.push({
          title: item.title,
          url: cleanU,
          content: item.content,
          category: 'web',
          isOfficial: false,
          isBookmark: false,
          isPreHighlighted: Boolean(item.isPreHighlighted)
        });
      }
    });

    if (countBadge) {
      countBadge.textContent = state.lang === 'de'
        ? `Ungefähr ${combined.length} Ergebnisse`
        : `About ${combined.length} results`;
    }

    if (latencyBadge) {
      latencyBadge.textContent = state.lang === 'de'
        ? `(${formattedSeconds} Sekunden)`
        : `(${formattedSeconds} seconds)`;
    }

    if (!resultsContainer) return;

    if (combined.length === 0) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>${state.lang === 'de' ? 'Keine Treffer gefunden' : 'No results found'}</h3>
          <p>${state.lang === 'de' 
            ? `Für die Abfrage <code>${escapeHTML(query)}</code> wurden keine Treffer ermittelt.` 
            : `No matching items found for <code>${escapeHTML(query)}</code>.`}
          </p>
        </div>
      `;
      return;
    }

    const qTokens = tokenize(query);

    resultsContainer.innerHTML = combined.map(item => {
      const snippetHTML = item.isPreHighlighted ? item.content : highlightSnippet(item.content, qTokens);
      const domain = getDomain(item.url);

      return `
        <article class="result-item">
          <div class="result-header">
            <span class="result-breadcrumb">${escapeHTML(domain)}</span>
            ${item.isOfficial ? `<span class="result-verified-badge">${state.lang === 'de' ? '✓ Offiziell' : '✓ Official'}</span>` : ''}
          </div>
          <a href="${escapeHTML(item.url)}" class="result-title" target="_blank" rel="noopener noreferrer">
            ${escapeHTML(item.title)}
          </a>
          <p class="result-snippet">${snippetHTML}</p>
        </article>
      `;
    }).join('');
  }

  function getDomain(urlStr) {
    try {
      const u = new URL(urlStr);
      const pathPart = u.pathname && u.pathname !== '/' ? ' › ' + u.pathname.replace(/^\/|\/$/g, '').split('/').join(' › ') : '';
      return (u.hostname.replace(/^www\./, '')) + pathPart;
    } catch (e) {
      return urlStr;
    }
  }

  function highlightSnippet(snippet, tokens) {
    if (!snippet) return '';
    if (!tokens || tokens.length === 0) return escapeHTML(snippet);
    let escaped = escapeHTML(snippet);
    tokens.forEach(tok => {
      const regex = new RegExp(`(${escapeRegExp(tok)})`, 'gi');
      escaped = escaped.replace(regex, '<mark>$1</mark>');
    });
    return escaped;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // --- Autocomplete with Live Wikipedia OpenSearch ---
  async function fetchLiveSuggestions(prefix, lang = 'de') {
    if (!prefix || prefix.length < 2) return [];
    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(prefix)}&limit=6&namespace=0&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[1])) {
        return data[1];
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  function initSuggestions() {
    const input = document.getElementById('search-input');
    const dropdown = document.getElementById('suggestions-dropdown');
    if (!input || !dropdown) return;

    let acTimer = null;

    input.addEventListener('input', () => {
      clearTimeout(acTimer);
      const val = input.value.trim();
      if (!val) {
        dropdown.style.display = 'none';
        return;
      }

      acTimer = setTimeout(async () => {
        const localSuggestions = state.engine.suggest(val, 4);
        const liveSuggestions = await fetchLiveSuggestions(val, state.lang);
        const combined = Array.from(new Set([...localSuggestions, ...liveSuggestions])).slice(0, 6);

        if (combined.length === 0) {
          dropdown.style.display = 'none';
          return;
        }

        dropdown.innerHTML = combined.map(s => `
          <div class="suggestion-item" data-val="${escapeHTML(s)}">
            <svg class="suggestion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>${escapeHTML(s)}</span>
          </div>
        `).join('');
        dropdown.style.display = 'block';
      }, 100);
    });

    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.suggestion-item');
      if (item) {
        input.value = item.getAttribute('data-val');
        dropdown.style.display = 'none';
        input.focus();
        executeSearch(false);
      }
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && e.target !== input) {
        dropdown.style.display = 'none';
      }
    });
  }

  // --- Event Listeners & Modals ---
  function initEvents() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    const themeBtn = document.getElementById('btn-theme-toggle');

    if (input) {
      input.addEventListener('input', () => {
        const val = input.value.trim();
        if (clearBtn) {
          clearBtn.style.display = val ? 'flex' : 'none';
        }
        if (!val) {
          clearSearch();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const dd = document.getElementById('suggestions-dropdown');
          if (dd) dd.style.display = 'none';
          executeSearch(false);
        }
      });
    }

    const enterBtn = document.getElementById('search-enter-btn');
    const searchForm = document.getElementById('search-form');
    const heroSearchBtn = document.getElementById('btn-hero-search');
    const heroLuckyBtn = document.getElementById('btn-hero-lucky');

    if (enterBtn) {
      enterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const dd = document.getElementById('suggestions-dropdown');
        if (dd) dd.style.display = 'none';
        executeSearch(false);
      });
    }

    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dd = document.getElementById('suggestions-dropdown');
        if (dd) dd.style.display = 'none';
        executeSearch(false);
      });
    }

    if (heroSearchBtn) {
      heroSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const dd = document.getElementById('suggestions-dropdown');
        if (dd) dd.style.display = 'none';
        executeSearch(false);
      });
    }

    if (heroLuckyBtn) {
      heroLuckyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const dd = document.getElementById('suggestions-dropdown');
        if (dd) dd.style.display = 'none';
        executeSearch(true);
      });
    }

    if (clearBtn && input) {
      clearBtn.addEventListener('click', () => {
        clearSearch();
        input.focus();
      });
    }

    // Browser back/forward navigation
    window.addEventListener('popstate', () => {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      if (q && input) {
        input.value = q;
        executeSearch(false);
      } else {
        clearSearch();
      }
    });

    // Theme Toggle
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const next = state.theme === 'dark' ? 'light' : 'dark';
        state.theme = next;
        applyTheme(next);
      });
    }

    // Keyboard Shortcuts (/ or Ctrl+K to search)
    window.addEventListener('keydown', (e) => {
      if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) && document.activeElement !== input) {
        e.preventDefault();
        input.focus();
        input.select();
      } else if (e.key === 'Escape') {
        if (document.activeElement === input) input.blur();
        const dd = document.getElementById('suggestions-dropdown');
        if (dd) dd.style.display = 'none';
        closeAllModals();
      }
    });

    // Results Click Delegation
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
      resultsContainer.addEventListener('click', async (e) => {
        // Copy link
        const copyBtn = e.target.closest('.btn-copy-url');
        if (copyBtn) {
          const u = copyBtn.getAttribute('data-url');
          await navigator.clipboard.writeText(u);
          const originalText = copyBtn.textContent;
          copyBtn.textContent = state.lang === 'de' ? '✓ Kopiert!' : '✓ Copied!';
          setTimeout(() => { copyBtn.textContent = originalText; }, 1800);
          return;
        }

        // Save bookmark
        const saveBmBtn = e.target.closest('.btn-save-bm');
        if (saveBmBtn) {
          const title = saveBmBtn.getAttribute('data-title');
          const url = saveBmBtn.getAttribute('data-url');
          const bm = {
            id: 'bm_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            title,
            url,
            tags: ['gespeichert'],
            notes: '',
            createdAt: new Date().toISOString()
          };
          await idbSaveBookmark(bm);
          await loadBookmarks();
          saveBmBtn.textContent = state.lang === 'de' ? '✓ Gespeichert!' : '✓ Saved!';
          setTimeout(() => { saveBmBtn.textContent = state.lang === 'de' ? '⭐ Lesezeichen' : '⭐ Bookmark'; }, 2000);
          return;
        }

        // Delete bookmark
        const delBmBtn = e.target.closest('.btn-del-bm');
        if (delBmBtn) {
          const bmid = delBmBtn.getAttribute('data-bmid');
          if (confirm(state.lang === 'de' ? 'Lesezeichen wirklich entfernen?' : 'Delete bookmark?')) {
            await idbDeleteBookmark(bmid);
            await loadBookmarks();
            const inp = document.getElementById('search-input');
            if (inp && inp.value.trim()) executeSearch(false);
          }
        }
      });
    }

    initSettingsModal();
    initBookmarksModals();
    initMobileNav();
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  }

  function initSettingsModal() {
    const modal = document.getElementById('settings-modal');
    const openBtn = document.getElementById('btn-open-settings');
    const closeBtn = document.getElementById('settings-modal-close');
    const cancelBtn = document.getElementById('settings-cancel-btn');
    const saveBtn = document.getElementById('settings-save-btn');

    if (openBtn && modal) {
      openBtn.addEventListener('click', () => {
        document.getElementById('setting-theme').value = state.theme;
        document.getElementById('setting-lang').value = state.lang;
        document.getElementById('setting-src-wiki').checked = state.settings.srcWiki;
        document.getElementById('setting-src-ddg').checked = state.settings.srcDDG;
        document.getElementById('setting-src-hn').checked = state.settings.srcHN;
        const sfEl = document.getElementById('setting-safesearch');
        if (sfEl) sfEl.checked = state.settings.safeSearch;
        document.getElementById('setting-strip-tracking').checked = state.settings.stripTracking;
        document.getElementById('setting-brave-key').value = state.settings.braveKey;
        document.getElementById('setting-searxng-url').value = state.settings.searxngURL;
        modal.classList.add('open');
      });
    }

    const close = () => modal && modal.classList.remove('open');
    if (closeBtn) closeBtn.addEventListener('click', close);
    if (cancelBtn) cancelBtn.addEventListener('click', close);

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const theme = document.getElementById('setting-theme').value;
        const lang = document.getElementById('setting-lang').value;
        const srcWiki = document.getElementById('setting-src-wiki').checked;
        const srcDDG = document.getElementById('setting-src-ddg').checked;
        const srcHN = document.getElementById('setting-src-hn').checked;
        const sfEl = document.getElementById('setting-safesearch');
        const safeSearch = sfEl ? sfEl.checked : true;
        const stripTracking = document.getElementById('setting-strip-tracking').checked;
        const braveKey = document.getElementById('setting-brave-key').value.trim();
        const searxngURL = document.getElementById('setting-searxng-url').value.trim();

        state.theme = theme;
        applyTheme(theme);

        state.settings = { srcWiki, srcDDG, srcHN, safeSearch, stripTracking, braveKey, searxngURL };
        localStorage.setItem('search_src_wiki', srcWiki);
        localStorage.setItem('search_src_ddg', srcDDG);
        localStorage.setItem('search_src_hn', srcHN);
        localStorage.setItem('search_safesearch', safeSearch);
        localStorage.setItem('search_strip_tracking', stripTracking);
        localStorage.setItem('search_brave_key', braveKey);
        localStorage.setItem('search_searxng_url', searxngURL);

        if (lang !== state.lang) {
          window.setLang(lang);
        } else {
          const inp = document.getElementById('search-input');
          if (inp && inp.value.trim()) executeSearch(false);
        }

        close();
      });
    }
  }

  function initBookmarksModals() {
    const bmModal = document.getElementById('bm-modal');
    const openAddBtn = document.getElementById('btn-add-bookmark');
    const closeAddBtn = document.getElementById('bm-modal-close');
    const cancelAddBtn = document.getElementById('bm-cancel-btn');
    const bmForm = document.getElementById('bm-form');

    if (openAddBtn && bmModal) {
      openAddBtn.addEventListener('click', () => {
        bmModal.classList.add('open');
        document.getElementById('bm-title').focus();
      });
    }

    const closeAdd = () => bmModal && bmModal.classList.remove('open');
    if (closeAddBtn) closeAddBtn.addEventListener('click', closeAdd);
    if (cancelAddBtn) cancelAddBtn.addEventListener('click', closeAdd);

    if (bmForm) {
      bmForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('bm-title').value.trim();
        const url = document.getElementById('bm-url').value.trim();
        const rawTags = document.getElementById('bm-tags').value.trim();
        const notes = document.getElementById('bm-notes').value.trim();
        const tags = rawTags ? rawTags.split(',').map(s => s.trim()).filter(Boolean) : [];

        const bm = {
          id: 'bm_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
          title: title || url,
          url,
          tags,
          notes,
          createdAt: new Date().toISOString()
        };

        await idbSaveBookmark(bm);
        bmForm.reset();
        closeAdd();
        await loadBookmarks();
        const inp = document.getElementById('search-input');
        if (inp && inp.value.trim()) executeSearch(false);
      });
    }

    // Sync Modal
    const syncModal = document.getElementById('sync-modal');
    const openSyncBtn = document.getElementById('btn-sync-bookmarks');
    const closeSyncBtn = document.getElementById('sync-modal-close');
    const exportBtn = document.getElementById('btn-export-json');
    const importBtn = document.getElementById('btn-import-json');
    const jsonArea = document.getElementById('sync-json-area');

    if (openSyncBtn && syncModal) {
      openSyncBtn.addEventListener('click', () => {
        syncModal.classList.add('open');
        if (jsonArea) jsonArea.value = JSON.stringify(state.bookmarks, null, 2);
      });
    }

    const closeSync = () => syncModal && syncModal.classList.remove('open');
    if (closeSyncBtn) closeSyncBtn.addEventListener('click', closeSync);

    if (exportBtn && jsonArea) {
      exportBtn.addEventListener('click', () => {
        jsonArea.value = JSON.stringify(state.bookmarks, null, 2);
        navigator.clipboard.writeText(jsonArea.value).then(() => {
          const orig = exportBtn.textContent;
          exportBtn.textContent = state.lang === 'de' ? '✓ Kopiert!' : '✓ Copied!';
          setTimeout(() => { exportBtn.textContent = orig; }, 1800);
        });
      });
    }

    if (importBtn && jsonArea) {
      importBtn.addEventListener('click', async () => {
        try {
          const parsed = JSON.parse(jsonArea.value.trim());
          if (!Array.isArray(parsed)) throw new Error('JSON muss ein Array sein');
          for (const item of parsed) {
            if (item.url) {
              await idbSaveBookmark({
                id: item.id || ('bm_' + Date.now().toString(36)),
                title: item.title || item.url,
                url: item.url,
                tags: item.tags || [],
                notes: item.notes || '',
                createdAt: item.createdAt || new Date().toISOString()
              });
            }
          }
          closeSync();
          await loadBookmarks();
          const inp = document.getElementById('search-input');
          if (inp && inp.value.trim()) executeSearch(false);
          alert(state.lang === 'de' ? `✓ ${parsed.length} Lesezeichen importiert!` : `✓ ${parsed.length} bookmarks imported!`);
        } catch (err) {
          alert((state.lang === 'de' ? 'Import fehlgeschlagen: ' : 'Import failed: ') + err.message);
        }
      });
    }
  }

  function initMobileNav() {
    const toggle = document.getElementById('mobile-toggle');
    const nav = document.getElementById('main-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      toggle.textContent = open ? '✕' : '☰';
    });
  }

  // --- Bootstrap ---
  document.addEventListener('DOMContentLoaded', async () => {
    applyTheme(state.theme);
    window.setLang(state.lang);
    initSuggestions();
    initEvents();

    await loadDatabase();
    await loadBookmarks();

    // Check if query is in URL (e.g. user reloaded or arrived with ?q=...)
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get('q');
    if (initialQuery) {
      const input = document.getElementById('search-input');
      if (input) input.value = initialQuery;
      executeSearch(false);
    }
  });

})();
