package engine

import (
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
