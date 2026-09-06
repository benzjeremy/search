package crawler

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
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
