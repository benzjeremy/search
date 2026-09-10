package engine

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestTokenizer(t *testing.T) {
	text := "Untis-Go ist ein ultraschneller WebUntis Desktop-Client in Go!"
	tokens := Tokenize(text)

	expectedFound := []string{"untis-go", "ultraschneller", "webuntis", "desktop-client", "go"}
	for _, exp := range expectedFound {
		found := false
		for _, tok := range tokens {
			if tok == exp {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected token %q to be found in %v", exp, tokens)
		}
	}
}

func TestLevenshteinDistance(t *testing.T) {
	cases := []struct {
		s1, s2   string
		expected int
	}{
		{"docklite", "docklite", 0},
		{"docklite", "docklit", 1},
		{"untis", "untiss", 1},
		{"search", "serach", 2},
		{"", "test", 4},
	}

	for _, c := range cases {
		d := LevenshteinDistance(c.s1, c.s2)
		if d != c.expected {
			t.Errorf("LevenshteinDistance(%q, %q) = %d, expected %d", c.s1, c.s2, d, c.expected)
		}
	}
}

func TestInvertedIndexBM25(t *testing.T) {
	idx := NewInvertedIndex()

	idx.AddDocument(Document{
		ID:        "doc1",
		Title:     "untis-go WebUntis Client",
		URL:       "https://benzjeremy.github.io/untis-go/",
		Content:   "Nativer WebUntis Desktop Client für Stundenpläne und Vertretungen mit Offline-Cache und GTK-Oberfläche.",
		Tags:      []string{"go", "desktop", "gtk", "untis"},
		Source:    "ecosystem",
		Timestamp: time.Now(),
	})

	idx.AddDocument(Document{
		ID:        "doc2",
		Title:     "docklite Docker Monitor",
		URL:       "https://benzjeremy.github.io/docklite/",
		Content:   "Ultra-lightweight Portainer Alternative in Go und Astro. Standalone Binary mit direkter Docker Socket Kommunikation.",
		Tags:      []string{"go", "docker", "devops", "astro"},
		Source:    "ecosystem",
		Timestamp: time.Now(),
	})

	idx.AddDocument(Document{
		ID:        "doc3",
		Title:     "Functional AGI Research",
		URL:       "https://benzjeremy.github.io/agi-research/",
		Content:   "Empirische Benchmark Suite zum Nachweis von F-AGI mittels SEAN Architektur und Neuro-Symbolik.",
		Tags:      []string{"ai", "agi", "research", "benchmarks"},
		Source:    "research",
		Timestamp: time.Now(),
	})

	// Test exact query
	res := idx.Search("docklite docker", "", 5)
	if len(res) == 0 {
		t.Fatalf("Expected results for 'docklite docker', got 0")
	}
	if res[0].Document.ID != "doc2" {
		t.Errorf("Expected first result to be doc2, got %s", res[0].Document.ID)
	}

	// Test tag filter
	aiRes := idx.Search("benchmark", "ai", 5)
	if len(aiRes) == 0 {
		t.Fatalf("Expected results for 'benchmark' with tag 'ai'")
	}
	if aiRes[0].Document.ID != "doc3" {
		t.Errorf("Expected doc3 for AI tag filter, got %s", aiRes[0].Document.ID)
	}

	// Test stats
	stats := idx.Stats()
	if stats.TotalDocuments != 3 {
		t.Errorf("Expected 3 documents in stats, got %d", stats.TotalDocuments)
	}
}

func TestExportImportJSON(t *testing.T) {
	idx := NewInvertedIndex()

	doc := Document{
		ID:        "doc-json-1",
		Title:     "Zero-Dummy-Security Standards",
		URL:       "https://benzjeremy.github.io/#standards",
		Content:   "Vollständige AES-256-GCM Verschlüsselung und PBKDF2 Hashing ohne Dummy-Sicherheit.",
		Tags:      []string{"security", "crypto"},
		Source:    "test",
		Timestamp: time.Now(),
	}
	idx.AddDocument(doc)

	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, "test_index.json")

	// Test Export
	if err := idx.ExportJSON(tmpFile); err != nil {
		t.Fatalf("ExportJSON failed: %v", err)
	}

	// Verify file exists
	info, err := os.Stat(tmpFile)
	if err != nil || info.Size() == 0 {
		t.Fatalf("Expected non-empty exported JSON file, err: %v", err)
	}

	// Test Import into fresh index
	freshIdx := NewInvertedIndex()
	count, err := freshIdx.ImportJSON(tmpFile)
	if err != nil {
		t.Fatalf("ImportJSON failed: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected 1 document imported, got %d", count)
	}

	// Verify search works on imported index
	results := freshIdx.Search("aes-256-gcm", "", 5)
	if len(results) != 1 {
		t.Fatalf("Expected 1 search result after import, got %d", len(results))
	}
	if results[0].Document.ID != "doc-json-1" {
		t.Errorf("Expected doc-json-1, got %s", results[0].Document.ID)
	}
}
