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
      stripTracking: localStorage.getItem('search_strip_tracking') !== 'false',
      braveKey: localStorage.getItem('search_brave_key') || '',
      searxngURL: localStorage.getItem('search_searxng_url') || ''
    },
    liveCache: new Map()
  };

  // --- Federated Global Web Search APIs ---

  // 1. Wikipedia Full-Text Search API (Searches tens of millions of global pages with CORS origin=*)
  async function fetchWikipediaFull(query, lang = 'de') {
    if (!state.settings.srcWiki || !query) return [];
    const cacheKey = `wikifull_${lang}_${query.toLowerCase()}`;
    if (state.liveCache.has(cacheKey)) return state.liveCache.get(cacheKey);

    try {
      const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=15&utf8=&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.query || !Array.isArray(data.query.search)) return [];

      let hits = data.query.search.map(hit => ({
        title: hit.title,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
        content: stripWikiSnippet(hit.snippet),
        category: 'web',
        badge: 'Wikipedia',
        source: 'Wikipedia',
        isPreHighlighted: true
      }));

      // If German search yields few hits, query English Wikipedia as well for worldwide coverage
      if (lang === 'de' && hits.length < 5) {
        try {
          const enUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=8&utf8=&format=json&origin=*`;
          const enRes = await fetch(enUrl);
          if (enRes.ok) {
            const enData = await enRes.json();
            if (enData.query && Array.isArray(enData.query.search)) {
              const enHits = enData.query.search.map(hit => ({
                title: hit.title,
                url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
                content: stripWikiSnippet(hit.snippet),
                category: 'web',
                badge: 'Wikipedia EN',
                source: 'Wikipedia',
                isPreHighlighted: true
              }));
              hits.push(...enHits);
            }
          }
        } catch (e) {}
      }

      state.liveCache.set(cacheKey, hits);
      return hits;
    } catch (e) {
      return [];
    }
  }

  // 2. Wikipedia Summary API (For the Knowledge Sidebar)
  async function fetchWikipediaCard(query, lang = 'de') {
    if (!state.settings.srcWiki || !query) return null;
    const cacheKey = `wiki_card_${lang}_${query.toLowerCase()}`;
    if (state.liveCache.has(cacheKey)) return state.liveCache.get(cacheKey);

    try {
      const endpoint = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      });
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

  // 3. DuckDuckGo Instant Answers & Deep Topics
  async function fetchDuckDuckGo(query) {
    if (!state.settings.srcDDG || !query) return { card: null, items: [] };
    const cacheKey = `ddg_${query.toLowerCase()}`;
    if (state.liveCache.has(cacheKey)) return state.liveCache.get(cacheKey);

    try {
      const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
      const res = await fetch(endpoint);
      if (!res.ok) return { card: null, items: [] };
      const data = await res.json();

      let card = null;
      if (data.AbstractText && data.Heading) {
        card = {
          title: data.Heading,
          subtitle: data.AbstractSource || 'DuckDuckGo Instant Answer',
          extract: data.AbstractText,
          url: sanitizeURL(data.AbstractURL),
          imageUrl: data.Image,
          source: 'DuckDuckGo'
        };
      }

      const items = [];
      if (Array.isArray(data.RelatedTopics)) {
        data.RelatedTopics.slice(0, 8).forEach(topic => {
          if (topic.Text && topic.FirstURL) {
            const parts = topic.Text.split(' - ');
            items.push({
              title: parts[0],
              url: sanitizeURL(topic.FirstURL),
              content: topic.Text,
              source: 'DuckDuckGo',
              category: 'web',
              badge: 'DuckDuckGo Web',
              tags: ['web']
            });
          }
        });
      }

      const result = { card, items };
      state.liveCache.set(cacheKey, result);
      return result;
    } catch (e) {
      return { card: null, items: [] };
    }
  }

  // 4. Hacker News Algolia Web Search API
  async function fetchHackerNews(query) {
    if (!state.settings.srcHN || !query) return [];
    const cacheKey = `hn_${query.toLowerCase()}`;
    if (state.liveCache.has(cacheKey)) return state.liveCache.get(cacheKey);

    try {
      const endpoint = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=8`;
      const res = await fetch(endpoint);
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

  // 5. OpenStreetMap Nominatim for Places & Cities
  async function fetchOpenStreetMap(query) {
    if (!query || query.length < 3) return [];
    try {
      const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=2`;
      const res = await fetch(endpoint, {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!Array.isArray(data)) return [];

      return data.map(item => ({
        title: item.display_name.split(',')[0] + ' (Karte & Standort)',
        url: `https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}#map=14/${item.lat}/${item.lon}`,
        content: `Standort auf OpenStreetMap: ${item.display_name} (Typ: ${item.type || 'Ort'})`,
        source: 'OpenStreetMap',
        category: 'web',
        badge: 'OpenStreetMap',
        tags: ['karte', 'ort', 'geo']
      }));
    } catch (e) {
      return [];
    }
  }

  // 6. Brave Search API (If user provided custom API key)
  async function fetchBraveSearch(query) {
    if (!state.settings.braveKey || !query) return [];
    try {
      const endpoint = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=8`;
      const res = await fetch(endpoint, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': state.settings.braveKey
        }
      });
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

    executeSearch();
  };

  // --- Primary Search Aggregator ---
  async function executeSearch() {
    const input = document.getElementById('search-input');
    const query = input ? input.value.trim() : '';
    const resultsContainer = document.getElementById('search-results');
    const knowledgeSidebar = document.getElementById('knowledge-sidebar');
    const knowledgeCardEl = document.getElementById('knowledge-card');
    const countBadge = document.getElementById('results-count');
    const latencyBadge = document.getElementById('results-latency');
    const clearBtn = document.getElementById('search-clear');

    if (clearBtn) {
      clearBtn.style.display = query ? 'flex' : 'none';
    }

    updateFallbackLinks(query);

    const startTime = performance.now();

    // 1. Query local in-memory BM25 index over database.json + bookmarks
    const localHits = state.engine.search(query);

    // 2. Query global live web sources simultaneously
    let liveCard = null;
    let liveWebItems = [];

    if (query) {
      const [wikiFull, ddgResult, hnItems, osmItems, braveItems] = await Promise.all([
        fetchWikipediaFull(query, state.lang),
        fetchDuckDuckGo(query),
        fetchHackerNews(query),
        fetchOpenStreetMap(query),
        fetchBraveSearch(query)
      ]);

      if (wikiFull && wikiFull.length) liveWebItems.push(...wikiFull);
      if (ddgResult && ddgResult.items) liveWebItems.push(...ddgResult.items);
      if (hnItems && hnItems.length) liveWebItems.push(...hnItems);
      if (osmItems && osmItems.length) liveWebItems.push(...osmItems);
      if (braveItems && braveItems.length) liveWebItems.push(...braveItems);

      // Top entity knowledge card from Wikipedia
      const topEntity = (wikiFull && wikiFull.length > 0) ? wikiFull[0].title : query;
      const card = await fetchWikipediaCard(topEntity, state.lang);
      liveCard = card || (ddgResult ? ddgResult.card : null);
    }

    const elapsed = performance.now() - startTime;
    if (latencyBadge) {
      latencyBadge.textContent = `⚡ ${elapsed < 1 ? Math.round(elapsed * 1000) + ' µs' : elapsed.toFixed(2) + ' ms'}`;
    }

    // Render Knowledge Card
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

    // 1. Ecosystem hits & curated DB hits
    localHits.forEach(hit => {
      const cleanU = sanitizeURL(hit.doc.url);
      if (!seenURLs.has(cleanU)) {
        seenURLs.add(cleanU);
        combined.push({
          title: hit.doc.title,
          url: cleanU,
          content: hit.snippet || hit.doc.content,
          category: hit.doc.category,
          badge: hit.doc.isBookmark ? 'Lesezeichen' : (hit.doc.category === 'ecosystem' ? 'Jeremy Benz Ökosystem' : 'Web Index'),
          isBookmark: hit.doc.isBookmark,
          rawBM: hit.doc.rawBM,
          isPreHighlighted: false
        });
      }
    });

    // 2. Global Live Web hits
    liveWebItems.forEach(item => {
      const cleanU = sanitizeURL(item.url);
      if (!seenURLs.has(cleanU)) {
        seenURLs.add(cleanU);
        combined.push({
          title: item.title,
          url: cleanU,
          content: item.content,
          category: 'web',
          badge: item.badge || 'Web',
          isBookmark: false,
          isPreHighlighted: Boolean(item.isPreHighlighted)
        });
      }
    });

    if (countBadge) {
      countBadge.textContent = state.lang === 'de' 
        ? `${combined.length} Ergebnisse im Web gefunden` 
        : `${combined.length} web results found`;
    }

    if (!resultsContainer) return;

    if (combined.length === 0) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>${state.lang === 'de' ? 'Keine Treffer gefunden' : 'No results found'}</h3>
          <p>${state.lang === 'de' 
            ? `Für die Abfrage <code>${escapeHTML(query)}</code> wurden keine Treffer ermittelt. Probiere den Google- oder DuckDuckGo-Direktlink oben rechts aus.`
            : `No matching items found for <code>${escapeHTML(query)}</code>. Try one of the direct search links above.`}
          </p>
        </div>
      `;
      return;
    }

    const qTokens = tokenize(query);

    resultsContainer.innerHTML = combined.map(item => {
      const snippetHTML = item.isPreHighlighted ? item.content : highlightSnippet(item.content, qTokens);
      const badgeClass = getBadgeClass(item.badge);
      const domain = getDomain(item.url);

      const bookmarkAction = item.isBookmark
        ? `<button type="button" class="result-action-btn btn-del-bm" data-bmid="${item.rawBM.id}">🗑️ ${state.lang === 'de' ? 'Löschen' : 'Delete'}</button>`
        : `<button type="button" class="result-action-btn btn-save-bm" data-title="${escapeHTML(item.title)}" data-url="${escapeHTML(item.url)}">⭐ ${state.lang === 'de' ? 'Lesezeichen' : 'Bookmark'}</button>`;

      return `
        <article class="result-item">
          <div class="result-header">
            <span class="result-breadcrumb">${escapeHTML(domain)}</span>
            <span class="result-badge ${badgeClass}">${escapeHTML(item.badge)}</span>
          </div>
          <a href="${escapeHTML(item.url)}" class="result-title" target="_blank" rel="noopener noreferrer">
            ${escapeHTML(item.title)}
          </a>
          <p class="result-snippet">${snippetHTML}</p>
          <div class="result-actions">
            ${bookmarkAction}
            <button type="button" class="result-action-btn btn-copy-url" data-url="${escapeHTML(item.url)}">📋 ${state.lang === 'de' ? 'Link kopieren' : 'Copy link'}</button>
            <a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer" class="result-action-btn">↗ ${state.lang === 'de' ? 'Öffnen' : 'Open'}</a>
          </div>
        </article>
      `;
    }).join('');
  }

  function getBadgeClass(badge) {
    if (badge.includes('Ökosystem') || badge.includes('Ecosystem')) return 'badge-ecosystem';
    if (badge.includes('Wikipedia')) return 'badge-wiki';
    if (badge.includes('Hacker News')) return 'badge-hn';
    if (badge.includes('Lesezeichen') || badge.includes('Bookmark')) return 'badge-private';
    return 'badge-web';
  }

  function getDomain(urlStr) {
    try {
      const u = new URL(urlStr);
      return u.hostname + (u.pathname !== '/' ? u.pathname : '');
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

  function updateFallbackLinks(query) {
    const q = query ? encodeURIComponent(query) : '';
    const fbGoogle = document.getElementById('fb-google');
    const fbDDG = document.getElementById('fb-ddg');
    const fbStartpage = document.getElementById('fb-startpage');

    if (fbGoogle) fbGoogle.href = q ? `https://www.google.com/search?q=${q}` : 'https://www.google.com/';
    if (fbDDG) fbDDG.href = q ? `https://duckduckgo.com/?q=${q}` : 'https://duckduckgo.com/';
    if (fbStartpage) fbStartpage.href = q ? `https://www.startpage.com/sp/search?query=${q}` : 'https://www.startpage.com/';
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
        executeSearch();
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

    let debounceTimer = null;
    if (input) {
      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          executeSearch();
        }, 120);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(debounceTimer);
          const dd = document.getElementById('suggestions-dropdown');
          if (dd) dd.style.display = 'none';
          executeSearch();
        }
      });
    }

    if (clearBtn && input) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        const dd = document.getElementById('suggestions-dropdown');
        if (dd) dd.style.display = 'none';
        input.focus();
        executeSearch();
      });
    }

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
            executeSearch();
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
        const stripTracking = document.getElementById('setting-strip-tracking').checked;
        const braveKey = document.getElementById('setting-brave-key').value.trim();
        const searxngURL = document.getElementById('setting-searxng-url').value.trim();

        state.theme = theme;
        applyTheme(theme);

        state.settings = { srcWiki, srcDDG, srcHN, stripTracking, braveKey, searxngURL };
        localStorage.setItem('search_src_wiki', srcWiki);
        localStorage.setItem('search_src_ddg', srcDDG);
        localStorage.setItem('search_src_hn', srcHN);
        localStorage.setItem('search_strip_tracking', stripTracking);
        localStorage.setItem('search_brave_key', braveKey);
        localStorage.setItem('search_searxng_url', searxngURL);

        if (lang !== state.lang) {
          window.setLang(lang);
        } else {
          executeSearch();
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
        executeSearch();
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
          executeSearch();
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
    executeSearch();
  });

})();
