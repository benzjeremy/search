package crawler

import (
	"context"
	"fmt"
	"html"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/benzjeremy/search/internal/engine"
)

// SeedKnowledge returns curated default records representing the Jeremy Benz ecosystem.
func SeedKnowledge() []engine.Document {
	return []engine.Document{
		{
			ID:        "root-hub",
			Title:     "Jeremy Benz — Central Hub & Open Source Portfolio",
			URL:       "https://benzjeremy.github.io/",
			Content:   "Offizieller zentraler Hub von Jeremy Benz (@benzjeremy), 17-jähriger Go Systems Developer aus Deutschland. High-Velocity VibeCoding mit kompromisslosen Ingenieursstandards, echter Kryptografie (AES-256-GCM, PBKDF2 ≥100k Iterationen) und ohne Electron-Ballast. Übersicht über alle Projekte und Philosophie.",
			Tags:      []string{"hub", "go", "security", "portfolio", "standards"},
			Source:    "ecosystem",
			Timestamp: time.Now(),
		},
		{
			ID:        "untis-go",
			Title:     "untis-go — Nativer WebUntis Desktop Client in Go",
			URL:       "https://benzjeremy.github.io/untis-go/",
			Content:   "Der blitzschnelle, native WebUntis Desktop Client für Linux und Windows. Synchrones Zeitraster, Live-Countdown bis Schulschluss, Offline-Cache, System-Tray und minimale Ressourcennutzung. Aufgenommen in Awesome-Go (#6660). Lizenziert unter GPL-3.0.",
			Tags:      []string{"go", "desktop", "untis", "gtk", "awesome-go", "linux", "windows"},
			Source:    "ecosystem",
			Timestamp: time.Now(),
		},
		{
			ID:        "docklite",
			Title:     "docklite — Ultra-lightweight Docker Container Monitor",
			URL:       "https://benzjeremy.github.io/docklite/",
			Content:   "Radikal schlanke Portainer-Alternative in Go und Astro. Eine einzige Standalone-Binary, direkte docker.sock Kommunikation ohne Daemon-Overhead und ca. 10–15 MB RAM-Verbrauch. Live Server-Sent Events (SSE) Metriken, Container Logs und Lifecycle-Management. Aufgenommen in Awesome-Go (#6665).",
			Tags:      []string{"go", "docker", "devops", "monitoring", "astro", "awesome-go", "sse"},
			Source:    "ecosystem",
			Timestamp: time.Now(),
		},
		{
			ID:        "spotify-screensaver",
			Title:     "spotify-screensaver — Nativer Desktop Bildschirmschoner",
			URL:       "https://benzjeremy.github.io/spotify-screensaver/",
			Content:   "Eleganter nativer Bildschirmschoner für Spotify unter Linux und Windows. Hardwarebeschleunigter Audio-Visualizer, OLED-Digitaluhr, MPRIS D-Bus Steuerung, 100% Local-First ohne externe Cloud-Abhängigkeiten. Aufgenommen in Awesome-Go (#6675). Lizenziert unter GPL-3.0.",
			Tags:      []string{"go", "spotify", "screensaver", "visualizer", "dbus", "mpris", "awesome-go"},
			Source:    "ecosystem",
			Timestamp: time.Now(),
		},
		{
			ID:        "agi-research",
			Title:     "Functional AGI Research — Empirische Benchmark-Suite & SEAN",
			URL:       "https://benzjeremy.github.io/agi-research/",
			Content:   "Wissenschaftliches Forschungspapier und empirische Benchmark-Suite zum Nachweis funktioneller künstlicher Allgemeinintelligenz (F-AGI). 13 deterministische Benchmarks, Self-Evolving Agent Networks (SEAN), neuro-symbolische Verifikation und Epistemic Robustness.",
			Tags:      []string{"ai", "agi", "research", "benchmarks", "neuro-symbolic", "paper"},
			Source:    "research",
			Timestamp: time.Now(),
		},
		{
			ID:        "wetter-site",
			Title:     "wetter-site — Moderne Wetter-Station & Interaktive Telemetrie",
			URL:       "https://benzjeremy.github.io/wetter-site/",
			Content:   "Blitzschnelle, datenschutzfreundliche Wetter-Station von Jeremy Benz. Live-Wetterdaten via Open-Meteo API, pure Canvas 24h-Temperaturgraphen (°C, °F, K), 7-Tage-Trend und Standortabfrage. 100% client-side ohne Tracking.",
			Tags:      []string{"web", "weather", "open-meteo", "canvas", "telemetry", "privacy"},
			Source:    "ecosystem",
			Timestamp: time.Now(),
		},
		{
			ID:        "binchrii",
			Title:     "binchrii — Gaming & Variety Streamer Showcase",
			URL:       "https://benzjeremy.github.io/binchrii/",
			Content:   "Offizielle Webpräsenz für Streamer binchrii. Twitch-Stream-Einbindung mit 2-Klick-Datenschutz, Sendeplan, interaktive Soundeffekte, Chat-Befehle und Community-Regeln.",
			Tags:      []string{"web", "streaming", "twitch", "gaming", "showcase"},
			Source:    "ecosystem",
			Timestamp: time.Now(),
		},
		{
			ID:        "itsbenzo-tv",
			Title:     "itsbenzo-tv — Gaming & Streaming Hub",
			URL:       "https://benzjeremy.github.io/itsbenzo-tv/",
			Content:   "Offizieller Streaming- und Gaming-Hub von itsbenzo. Sendeplan, Social Links, Soundboard und Community Discord Integration.",
			Tags:      []string{"web", "streaming", "twitch", "community"},
			Source:    "ecosystem",
			Timestamp: time.Now(),
		},
		{
			ID:        "security-standards",
			Title:     "Second Brain Coding & Security Standards — Jeremy Benz",
			URL:       "https://benzjeremy.github.io/#philosophie",
			Content:   "Echte Sicherheit und Zero-Dummy-Security: AES-256-GCM Verschlüsselung, PBKDF2 mit mindestens 100.000 Iterationen, CSRF-Tokens, Strict Local-First Binding (127.0.0.1, niemals 0.0.0.0), DNS-Rebinding Schutz und WebKitGTK anstelle von schwerfälligem Electron.",
			Tags:      []string{"security", "standards", "crypto", "aes-256", "pbkdf2", "architecture"},
			Source:    "standards",
			Timestamp: time.Now(),
		},
		{
			ID:        "search-engine",
			Title:     "search — Ultra-fast Privacy Search Engine in Go",
			URL:       "https://benzjeremy.github.io/search/",
			Content:   "Suchmaschine für lokale Dateien und das Jeremy Benz Ökosystem. BM25 Ranking, invertierter Volltext-Index, Levenshtein Fuzzy-Matching, REST API mit Token-Authentifizierung und Zero Telemetry.",
			Tags:      []string{"search", "go", "bm25", "privacy", "engine", "crawler"},
			Source:    "ecosystem",
			Timestamp: time.Now(),
		},
	}
}

// IndexLocalDirectory walks a local path and indexes Markdown, text, and source code files.
func IndexLocalDirectory(idx *engine.InvertedIndex, rootPath string) (int, error) {
	count := 0
	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}

		// Skip hidden dirs and heavy build artifacts
		if d.IsDir() {
			name := d.Name()
			if strings.HasPrefix(name, ".") || name == "node_modules" || name == "vendor" || name == "dist" || name == "build" {
				return filepath.SkipDir
			}
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if ext != ".md" && ext != ".txt" && ext != ".go" && ext != ".html" && ext != ".json" {
			return nil
		}

		info, err := d.Info()
		if err != nil || info.Size() > 512*1024 { // max 512 KB per file
			return nil
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return nil
		}

		relPath, _ := filepath.Rel(rootPath, path)
		title := filepath.Base(path)
		content := string(data)

		// Simple title extraction if markdown # Title
		lines := strings.Split(content, "\n")
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if strings.HasPrefix(trimmed, "# ") {
				title = strings.TrimPrefix(trimmed, "# ")
				break
			}
		}

		tags := []string{strings.TrimPrefix(ext, ".")}
		if strings.Contains(path, "obsidian_vault") {
			tags = append(tags, "vault", "second-brain")
		}

		idx.AddDocument(engine.Document{
			ID:        relPath,
			Title:     title,
			URL:       "file://" + path,
			Content:   content,
			Tags:      tags,
			Source:    "local-fs",
			Timestamp: info.ModTime(),
		})

		count++
		return nil
	})

	return count, err
}

var (
	titleRegex      = regexp.MustCompile(`(?i)<title[^>]*>([^<]+)</title>`)
	metaDescRegex   = regexp.MustCompile(`(?i)<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']`)
	metaOgDescRegex = regexp.MustCompile(`(?i)<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']`)
	scriptRegex     = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	styleRegex      = regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`)
	noscriptRegex   = regexp.MustCompile(`(?is)<noscript[^>]*>.*?</noscript>`)
	navRegex        = regexp.MustCompile(`(?is)<nav[^>]*>.*?</nav>`)
	footerRegex     = regexp.MustCompile(`(?is)<footer[^>]*>.*?</footer>`)
	tagRegex        = regexp.MustCompile(`(?s)<[^>]+>`)
	spaceRegex      = regexp.MustCompile(`\s+`)
)

// ExtractHTMLMetadata parses HTML text, returning Title, Description, and cleaned body content.
func ExtractHTMLMetadata(rawHTML string) (title, description, cleanText string) {
	// 1. Extract <title>
	if matches := titleRegex.FindStringSubmatch(rawHTML); len(matches) > 1 {
		title = strings.TrimSpace(html.UnescapeString(matches[1]))
	}

	// 2. Extract <meta description>
	if matches := metaDescRegex.FindStringSubmatch(rawHTML); len(matches) > 1 {
		description = strings.TrimSpace(html.UnescapeString(matches[1]))
	} else if matches := metaOgDescRegex.FindStringSubmatch(rawHTML); len(matches) > 1 {
		description = strings.TrimSpace(html.UnescapeString(matches[1]))
	}

	// 3. Strip non-content blocks (scripts, stylesheets, navigations, footers)
	noCode := scriptRegex.ReplaceAllString(rawHTML, " ")
	noCode = styleRegex.ReplaceAllString(noCode, " ")
	noCode = noscriptRegex.ReplaceAllString(noCode, " ")
	noCode = navRegex.ReplaceAllString(noCode, " ")
	noCode = footerRegex.ReplaceAllString(noCode, " ")

	// 4. Strip HTML tags
	noTags := tagRegex.ReplaceAllString(noCode, " ")

	// 5. Unescape HTML entities & normalize multiple whitespace/newlines
	unescaped := html.UnescapeString(noTags)
	cleanText = strings.TrimSpace(spaceRegex.ReplaceAllString(unescaped, " "))

	return title, description, cleanText
}

// CrawlURL fetches a remote HTTP/HTTPS resource and transforms it into a searchable Document.
func CrawlURL(ctx context.Context, targetURL string) (*engine.Document, error) {
	parsedURL, err := url.Parse(targetURL)
	if err != nil || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return nil, fmt.Errorf("invalid web URL: %s", targetURL)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", targetURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; search-indexer/1.1; +https://benzjeremy.github.io/search/)")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	client := &http.Client{
		Timeout: 12 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP GET failed for %s: %w", targetURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP %d received for %s", resp.StatusCode, targetURL)
	}

	// Read up to 2 MB of HTML content to prevent memory exhaustion
	limitReader := io.LimitReader(resp.Body, 2*1024*1024)
	bodyBytes, err := io.ReadAll(limitReader)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body from %s: %w", targetURL, err)
	}

	title, desc, bodyText := ExtractHTMLMetadata(string(bodyBytes))
	if title == "" {
		title = parsedURL.Host + parsedURL.Path
	}

	// Limit body text to 100k characters for indexing efficiency
	if len(bodyText) > 100000 {
		bodyText = bodyText[:100000]
	}

	fullContent := title
	if desc != "" {
		fullContent += " — " + desc
	}
	if bodyText != "" {
		fullContent += "\n" + bodyText
	}

	// Derive search tags from hostname and path
	tags := []string{"web", parsedURL.Host}
	segments := strings.Split(strings.Trim(parsedURL.Path, "/"), "/")
	for _, seg := range segments {
		cleanSeg := strings.ToLower(strings.TrimSpace(seg))
		if cleanSeg != "" && len(cleanSeg) > 2 && len(cleanSeg) < 20 {
			tags = append(tags, cleanSeg)
		}
	}

	docID := strings.TrimPrefix(targetURL, "https://")
	docID = strings.TrimPrefix(docID, "http://")
	docID = strings.TrimRight(docID, "/")

	return &engine.Document{
		ID:        docID,
		Title:     title,
		URL:       targetURL,
		Content:   fullContent,
		Tags:      tags,
		Source:    "web-crawler",
		Timestamp: time.Now(),
	}, nil
}

// CrawlWhitelist crawls a given set of URLs concurrently and returns all successfully extracted Documents.
func CrawlWhitelist(ctx context.Context, urls []string) ([]engine.Document, error) {
	var (
		mu      sync.Mutex
		results []engine.Document
		wg      sync.WaitGroup
		sem     = make(chan struct{}, 4) // Max 4 concurrent HTTP requests
	)

	for _, u := range urls {
		target := strings.TrimSpace(u)
		if target == "" {
			continue
		}

		wg.Add(1)
		go func(targetURL string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			doc, err := CrawlURL(ctx, targetURL)
			if err != nil {
				return
			}

			mu.Lock()
			results = append(results, *doc)
			mu.Unlock()
		}(target)
	}

	wg.Wait()
	return results, nil
}

// DefaultWhitelist returns curated official developer & project documentation URLs.
func DefaultWhitelist() []string {
	return []string{
		"https://benzjeremy.github.io/",
		"https://benzjeremy.github.io/untis-go/",
		"https://benzjeremy.github.io/docklite/",
		"https://benzjeremy.github.io/spotify-screensaver/",
		"https://benzjeremy.github.io/wetter-site/",
		"https://benzjeremy.github.io/search/",
		"https://pkg.go.dev/",
		"https://go.dev/doc/",
		"https://open-meteo.com/",
	}
}
