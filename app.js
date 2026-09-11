/**
 * search — High-Velocity Ecosystem & Local Full-Text Search Engine
 * Pure Vanilla JavaScript | Zero External Dependencies
 * Matches the Go BM25 Engine Logic (Okapi BM25, k1=1.2, b=0.75)
 * Author: Jeremy Benz (@benzjeremy)
 */

(function () {
  'use strict';

  // --- Search Corpus (Jeremy Benz Ecosystem & Knowledge) ---
  const CORPUS = [
    {
      id: 'root-hub',
      title: 'Jeremy Benz — Zentraler Hub & Open-Source Profil',
      url: 'https://benzjeremy.github.io/',
      category: 'hub',
      tags: ['hub', 'go', 'security', 'portfolio', 'standards'],
      content: 'Offizielle Hauptseite von Jeremy Benz (@benzjeremy), 17-jähriger Go Systems Developer aus Deutschland. High-Velocity VibeCoding mit kompromisslosen Ingenieursstandards, echter Kryptografie (AES-256-GCM, PBKDF2 mindestens 100.000 Iterationen) und ohne Electron-Ballast. Übersicht über alle Projekte und Philosophie.'
    },
    {
      id: 'untis-go',
      title: 'untis-go — Schneller nativer WebUntis Desktop Client in Go',
      url: 'https://benzjeremy.github.io/untis-go/',
      category: 'tools',
      tags: ['go', 'desktop', 'untis', 'gtk', 'awesome-go', 'linux', 'windows'],
      content: 'Der blitzschnelle, native WebUntis Desktop Client für Linux und Windows. Synchrones Zeitraster, Live-Countdown bis Schulschluss, Offline-Cache, System-Tray und minimale Ressourcennutzung. Aufgenommen in Awesome-Go (#6660). Lizenziert unter GPL-3.0.'
    },
    {
      id: 'docklite',
      title: 'docklite — Radikal schlanke Portainer-Alternative in Go & Astro',
      url: 'https://benzjeremy.github.io/docklite/',
      category: 'tools',
      tags: ['go', 'docker', 'devops', 'monitoring', 'astro', 'awesome-go', 'sse'],
      content: 'Radikal schlanke Portainer-Alternative in Go und Astro. Eine einzige Standalone-Binary, direkte docker.sock Kommunikation ohne Daemon-Overhead und ca. 10–15 MB RAM-Verbrauch. Live Server-Sent Events (SSE) Metriken, Container Logs und Lifecycle-Management. Aufgenommen in Awesome-Go (#6665).'
    },
    {
      id: 'spotify-screensaver',
      title: 'spotify-screensaver — Nativer Desktop Bildschirmschoner',
      url: 'https://benzjeremy.github.io/spotify-screensaver/',
      category: 'tools',
      tags: ['go', 'spotify', 'screensaver', 'visualizer', 'dbus', 'mpris', 'awesome-go'],
      content: 'Eleganter nativer Bildschirmschoner für Spotify unter Linux und Windows. Hardwarebeschleunigter Audio-Visualizer, OLED-Digitaluhr, MPRIS D-Bus Steuerung, 100% Local-First ohne externe Cloud-Abhängigkeiten. Aufgenommen in Awesome-Go (#6675). Lizenziert unter GPL-3.0.'
    },
    {
      id: 'agi-research',
      title: 'Functional AGI Research — Empirische Benchmark-Suite & SEAN',
      url: 'https://benzjeremy.github.io/agi-research/',
      category: 'research',
      tags: ['ai', 'agi', 'research', 'benchmarks', 'neuro-symbolic', 'paper'],
      content: 'Wissenschaftliches Forschungspapier und empirische Benchmark-Suite zum Nachweis funktioneller künstlicher Allgemeinintelligenz (F-AGI). 13 deterministische Benchmarks, Self-Evolving Agent Networks (SEAN), neuro-symbolische Verifikation und Epistemic Robustness.'
    },
    {
      id: 'wetter-site',
      title: 'wetter-site — Moderne Wetter-Station & Telemetrie',
      url: 'https://benzjeremy.github.io/wetter-site/',
      category: 'showcases',
      tags: ['web', 'weather', 'open-meteo', 'canvas', 'telemetry', 'privacy'],
      content: 'Blitzschnelle, datenschutzfreundliche Wetter-Station von Jeremy Benz. Live-Wetterdaten via Open-Meteo API, pure Canvas 24h-Temperaturgraphen (°C, °F, K), 7-Tage-Trend und Standortabfrage. 100% client-side ohne Tracking.'
    },
    {
      id: 'binchrii',
      title: 'binchrii — Gaming & Variety Streamer Showcase',
      url: 'https://benzjeremy.github.io/binchrii/',
      category: 'showcases',
      tags: ['web', 'streaming', 'twitch', 'gaming', 'showcase'],
      content: 'Offizielle Webpräsenz für Streamer binchrii. Twitch-Stream-Einbindung mit 2-Klick-Datenschutz, Sendeplan, interaktive Soundeffekte, Chat-Befehle und Community-Regeln.'
    },
    {
      id: 'itsbenzo-tv',
      title: 'itsbenzo-tv — Gaming & Streaming Hub',
      url: 'https://benzjeremy.github.io/itsbenzo-tv/',
      category: 'showcases',
      tags: ['web', 'streaming', 'twitch', 'community'],
      content: 'Offizieller Streaming- und Gaming-Hub von itsbenzo. Sendeplan, Social Links, Soundboard und Community Discord Integration.'
    },
    {
      id: 'security-standards',
      title: 'Second Brain Coding & Security Standards — Jeremy Benz',
      url: 'https://benzjeremy.github.io/#philosophie',
      category: 'security',
      tags: ['security', 'standards', 'crypto', 'aes-256', 'pbkdf2', 'architecture'],
      content: 'Echte Sicherheit und Zero-Dummy-Security: AES-256-GCM Verschlüsselung, PBKDF2 mit mindestens 100.000 Iterationen, CSRF-Tokens, Strict Local-First Binding (127.0.0.1, niemals 0.0.0.0), DNS-Rebinding Schutz und WebKitGTK anstelle von schwerfälligem Electron.'
    },
    {
      id: 'search-engine',
      title: 'search — Ultra-fast Privacy Search Engine in Go',
      url: 'https://benzjeremy.github.io/search/',
      category: 'tools',
      tags: ['search', 'go', 'bm25', 'privacy', 'engine', 'crawler'],
      content: 'Suchmaschine für lokale Dateien und das Jeremy Benz Ökosystem. BM25 Ranking, invertierter Volltext-Index, Levenshtein Fuzzy-Matching, REST API mit Token-Authentifizierung und Zero Telemetry.'
    }
  ];

  // Stopwords
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

  // --- BM25 Engine Implementation ---
  class ClientBM25Engine {
    constructor(k1 = 1.2, b = 0.75) {
      this.k1 = k1;
      this.b = b;
      this.docs = [];
      this.index = new Map(); // term -> Map(docIndex -> count)
      this.docLengths = [];
      this.avgdl = 0;
    }

    indexCorpus(corpus) {
      this.docs = corpus;
      this.index.clear();
      this.docLengths = new Array(corpus.length).fill(0);
      let totalTokens = 0;

      corpus.forEach((doc, idx) => {
        const fullText = `${doc.title} ${doc.content} ${doc.tags.join(' ')}`;
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

    search(query, categoryFilter = '') {
      const qTokens = tokenize(query);
      if (qTokens.length === 0) {
        // If empty query, show all or filtered items by default
        return this.docs
          .map((doc, idx) => ({ doc, score: 1.0, matches: [], snippet: doc.content.slice(0, 160) + '...' }))
          .filter(item => !categoryFilter || item.doc.category === categoryFilter);
      }

      const N = this.docs.length;
      const scores = new Map();
      const matchMap = new Map();

      qTokens.forEach(qTerm => {
        let postings = this.index.get(qTerm);

        // Prefix match fallback if exact term isn't indexed
        if (!postings) {
          for (let [term, p] of this.index.entries()) {
            if (term.startsWith(qTerm)) {
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
          if (categoryFilter && doc.category !== categoryFilter) {
            continue;
          }

          const docLen = this.docLengths[docIdx];
          const numerator = tf * (this.k1 + 1);
          const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / this.avgdl));
          let termScore = safeIDF * (numerator / denominator);

          // Boost if in title
          if (doc.title.toLowerCase().includes(qTerm)) {
            termScore *= 2.2;
          }

          // Boost if in tags
          if (doc.tags.some(t => t.toLowerCase() === qTerm)) {
            termScore *= 1.8;
          }

          scores.set(docIdx, (scores.get(docIdx) || 0) + termScore);

          if (!matchMap.has(docIdx)) matchMap.set(docIdx, new Set());
          matchMap.get(docIdx).add(qTerm);
        }
      });

      const results = [];
      for (let [docIdx, score] of scores.entries()) {
        const doc = this.docs[docIdx];
        const matches = Array.from(matchMap.get(docIdx) || []);
        results.push({
          doc,
          score: Math.round(score * 100) / 100,
          matches,
          snippet: this.generateSnippet(doc.content, qTokens)
        });
      }

      results.sort((a, b) => b.score - a.score);
      return results;
    }

    generateSnippet(content, terms) {
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

  // --- IndexedDB Local Bookmark Vault ---
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
    } catch(err) {
      console.warn('IndexedDB not accessible:', err);
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

  // --- UI Controller ---
  const engine = new ClientBM25Engine();
  let activeCategory = '';
  let privateModeActive = localStorage.getItem('search_private_mode') === 'true';
  let privateBookmarks = [];

  function reindexCorpus() {
    let combined = [...CORPUS];
    if (privateModeActive) {
      const converted = privateBookmarks.map(bm => ({
        id: 'bm-' + bm.id,
        title: bm.title,
        url: bm.url,
        category: 'private',
        tags: ['privat', 'lesezeichen', ...(bm.tags || [])],
        content: `${bm.title} ${bm.url} ${bm.notes || ''}`,
        isPrivate: true,
        rawBM: bm
      }));
      combined = [...combined, ...converted];
    }
    engine.indexCorpus(combined);
    executeSearch();
  }

  async function reloadPrivateBookmarks() {
    privateBookmarks = await idbGetAllBookmarks();
    reindexCorpus();
  }

  document.addEventListener('DOMContentLoaded', async () => {
    initSearchUI();
    initMobileNav();
    initKeyboardShortcuts();
    initQuickQueries();
    initCopyButtons();
    initPrivateModeUI();
    await reloadPrivateBookmarks();
  });

  function initSearchUI() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    const categoryPills = document.querySelectorAll('.category-pill');

    if (input) {
      input.addEventListener('input', () => {
        if (clearBtn) {
          clearBtn.style.display = input.value.trim() ? 'flex' : 'none';
        }
        executeSearch();
      });
    }

    if (clearBtn && input) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        input.focus();
        executeSearch();
      });
    }

    categoryPills.forEach(pill => {
      pill.addEventListener('click', () => {
        categoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeCategory = pill.getAttribute('data-cat') || '';
        executeSearch();
      });
    });
  }

  function executeSearch() {
    const input = document.getElementById('search-input');
    const resultsContainer = document.getElementById('search-results');
    const countBadge = document.getElementById('results-count');
    const latencyBadge = document.getElementById('results-latency');
    if (!resultsContainer) return;

    const query = input ? input.value.trim() : '';
    const startTime = performance.now();
    const results = engine.search(query, activeCategory);
    const elapsed = performance.now() - startTime;

    if (latencyBadge) {
      const displayTime = elapsed < 1 ? `${Math.round(elapsed * 1000)} µs` : `${elapsed.toFixed(2)} ms`;
      latencyBadge.textContent = `⚡ ${displayTime}`;
    }

    if (countBadge) {
      countBadge.textContent = `${results.length} Treffer`;
    }

    if (results.length === 0) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>Keine Suchergebnisse gefunden</h3>
          <p>Für die Abfrage <code>${escapeHTML(query)}</code> wurden im Ökosystem keine Treffer ermittelt. Versuche allgemeinere Begriffe oder filtere nach Kategorien.</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = results.map(res => {
      const highlightedSnippet = highlightSnippet(res.snippet, query ? tokenize(query) : []);
      const tagsHTML = res.doc.tags.map(t => `<span class="res-tag">#${escapeHTML(t)}</span>`).join(' ');
      const privateBadge = res.doc.isPrivate ? `<span class="p-badge-private">🔒 Privat / Lesezeichen</span>` : '';
      const privateClass = res.doc.isPrivate ? ' is-private' : '';
      const deleteBtn = res.doc.isPrivate ? `<button type="button" class="btn-delete-bm" data-bmid="${res.doc.rawBM.id}" title="Lesezeichen löschen">🗑️ Löschen</button>` : '';

      return `
        <article class="search-result-card${privateClass}">
          <div class="card-top">
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <a href="${escapeHTML(res.doc.url)}" class="result-title" target="_blank" rel="noopener">
                ${escapeHTML(res.doc.title)}
                <svg class="external-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
              ${privateBadge}
            </div>
            <span class="score-pill" title="Okapi BM25 Ranking Score">BM25: ${res.score.toFixed(2)}</span>
          </div>
          <div class="result-url">${escapeHTML(res.doc.url)}</div>
          <p class="result-snippet">${highlightedSnippet}</p>
          <div class="card-meta">
            <div class="tags-container">${tagsHTML}</div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${deleteBtn}
              <a href="${escapeHTML(res.doc.url)}" target="_blank" rel="noopener" class="direct-link-btn">Öffnen →</a>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function highlightSnippet(snippet, tokens) {
    if (!tokens || tokens.length === 0) return escapeHTML(snippet);
    let escaped = escapeHTML(snippet);
    tokens.forEach(tok => {
      const regex = new RegExp(`(${escapeRegExp(tok)})`, 'gi');
      escaped = escaped.replace(regex, '<mark>$1</mark>');
    });
    return escaped;
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, tag => ({
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

  function initKeyboardShortcuts() {
    const input = document.getElementById('search-input');
    window.addEventListener('keydown', (e) => {
      if ((e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key === 'k')) && document.activeElement !== input) {
        e.preventDefault();
        input.focus();
        input.select();
      } else if (e.key === 'Escape' && document.activeElement === input) {
        input.blur();
      }
    });
  }

  function initQuickQueries() {
    document.querySelectorAll('.quick-query-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.getAttribute('data-q');
        const input = document.getElementById('search-input');
        if (input) {
          input.value = query;
          const clearBtn = document.getElementById('search-clear');
          if (clearBtn) clearBtn.style.display = 'flex';
          input.focus();
          executeSearch();
        }
      });
    });
  }

  function initCopyButtons() {
    document.querySelectorAll('.copy-cmd-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-copy-target');
        const el = document.getElementById(targetId);
        if (!el) return;
        navigator.clipboard.writeText(el.textContent.trim()).then(() => {
          const orig = btn.textContent;
          btn.textContent = '✓ Kopiert!';
          setTimeout(() => { btn.textContent = orig; }, 2000);
        });
      });
    });
  }

  function initMobileNav() {
    const toggleBtn = document.getElementById('mobile-toggle');
    const mainNav = document.getElementById('main-nav');
    if (!toggleBtn || !mainNav) return;

    toggleBtn.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('open');
      toggleBtn.setAttribute('aria-expanded', isOpen);
      toggleBtn.innerHTML = isOpen ? '✕' : '☰';
    });

    mainNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (mainNav.classList.contains('open')) {
          mainNav.classList.remove('open');
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.innerHTML = '☰';
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (mainNav.classList.contains('open') && !mainNav.contains(e.target) && !toggleBtn.contains(e.target)) {
        mainNav.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.innerHTML = '☰';
      }
    });
  }

  function initPrivateModeUI() {
    const toggleBtn = document.getElementById('btn-private-mode');
    const statusText = document.getElementById('private-mode-status');

    function updateToggleUI() {
      if (!toggleBtn || !statusText) return;
      toggleBtn.classList.toggle('active', privateModeActive);
      statusText.textContent = privateModeActive ? 'Aktiv' : 'Inaktiv';
      localStorage.setItem('search_private_mode', privateModeActive ? 'true' : 'false');
    }

    if (toggleBtn) {
      updateToggleUI();
      toggleBtn.addEventListener('click', () => {
        privateModeActive = !privateModeActive;
        updateToggleUI();
        reindexCorpus();
      });
    }

    // Modal 1: Add Bookmark
    const bmModal = document.getElementById('bm-modal');
    const openAddBtn = document.getElementById('btn-open-add-bm');
    const closeAddBtn = document.getElementById('bm-modal-close');
    const cancelAddBtn = document.getElementById('bm-cancel-btn');
    const bmForm = document.getElementById('bm-form');

    if (openAddBtn && bmModal) {
      openAddBtn.addEventListener('click', () => {
        bmModal.classList.add('open');
        const titleInput = document.getElementById('bm-title');
        if (titleInput) titleInput.focus();
      });
    }
    const closeBmModal = () => { if (bmModal) bmModal.classList.remove('open'); };
    if (closeAddBtn) closeAddBtn.addEventListener('click', closeBmModal);
    if (cancelAddBtn) cancelAddBtn.addEventListener('click', closeBmModal);

    if (bmForm) {
      bmForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('bm-title').value.trim();
        const url = document.getElementById('bm-url').value.trim();
        const tagsRaw = document.getElementById('bm-tags').value.trim();
        const notes = document.getElementById('bm-notes').value.trim();

        const tags = tagsRaw ? tagsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
        const bm = {
          id: 'bm_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          title: title || url,
          url,
          tags,
          notes,
          createdAt: new Date().toISOString()
        };

        await idbSaveBookmark(bm);
        bmForm.reset();
        closeBmModal();

        if (!privateModeActive) {
          privateModeActive = true;
          updateToggleUI();
        }
        await reloadPrivateBookmarks();
      });
    }

    // Event delegation for delete buttons in search results
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
      resultsContainer.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.btn-delete-bm');
        if (delBtn) {
          const bmid = delBtn.getAttribute('data-bmid');
          if (bmid && confirm('Möchtest du dieses private Lesezeichen wirklich löschen?')) {
            await idbDeleteBookmark(bmid);
            await reloadPrivateBookmarks();
          }
        }
      });
    }

    // Modal 2: Sync / Export / Import
    const syncModal = document.getElementById('sync-modal');
    const openSyncBtn = document.getElementById('btn-open-sync-bm');
    const closeSyncBtn = document.getElementById('sync-modal-close');
    const exportBtn = document.getElementById('btn-export-json');
    const importBtn = document.getElementById('btn-import-json');
    const jsonArea = document.getElementById('sync-json-area');

    if (openSyncBtn && syncModal) {
      openSyncBtn.addEventListener('click', () => {
        syncModal.classList.add('open');
        if (jsonArea) {
          jsonArea.value = JSON.stringify(privateBookmarks, null, 2);
        }
      });
    }
    const closeSync = () => { if (syncModal) syncModal.classList.remove('open'); };
    if (closeSyncBtn) closeSyncBtn.addEventListener('click', closeSync);

    if (exportBtn && jsonArea) {
      exportBtn.addEventListener('click', () => {
        jsonArea.value = JSON.stringify(privateBookmarks, null, 2);
        navigator.clipboard.writeText(jsonArea.value).then(() => {
          const orig = exportBtn.textContent;
          exportBtn.textContent = '✓ Kopiert!';
          setTimeout(() => { exportBtn.textContent = orig; }, 2000);
        });
      });
    }

    if (importBtn && jsonArea) {
      importBtn.addEventListener('click', async () => {
        try {
          const parsed = JSON.parse(jsonArea.value.trim());
          if (!Array.isArray(parsed)) {
            alert('Ungültiges Format: JSON muss ein Array von Lesezeichen sein.');
            return;
          }
          for (const item of parsed) {
            if (item.url) {
              await idbSaveBookmark({
                id: item.id || ('bm_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)),
                title: item.title || item.url,
                url: item.url,
                tags: item.tags || [],
                notes: item.notes || '',
                createdAt: item.createdAt || new Date().toISOString()
              });
            }
          }
          closeSync();
          if (!privateModeActive) {
            privateModeActive = true;
            updateToggleUI();
          }
          await reloadPrivateBookmarks();
          alert(`✓ ${parsed.length} Lesezeichen erfolgreich importiert!`);
        } catch(err) {
          alert('Fehler beim Importieren: ' + err.message);
        }
      });
    }
  }

  // Language switch
  window.setLang = function(lang) {
    document.querySelectorAll('[data-lang]').forEach(el => {
      el.classList.toggle('visible', el.getAttribute('data-lang') === lang);
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.trim().toLowerCase() === lang);
    });
    document.documentElement.lang = lang;
    try { localStorage.setItem('pref_lang', lang); } catch(e) {}
  };

  try {
    const saved = localStorage.getItem('pref_lang');
    if (saved && (saved === 'de' || saved === 'en')) {
      window.setLang(saved);
    }
  } catch(e) {}

})();
