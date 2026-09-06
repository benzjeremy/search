package engine

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"sync"
	"time"
)

// Document represents a searchable record.
type Document struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	URL       string    `json:"url"`
	Content   string    `json:"content"`
	Tags      []string  `json:"tags"`
	Source    string    `json:"source"`
	Timestamp time.Time `json:"timestamp"`
}

// SearchResult represents a scored hit returned to the user.
type SearchResult struct {
	Document Document `json:"document"`
	Score    float64  `json:"score"`
	Snippet  string   `json:"snippet"`
	Matches  []string `json:"matches"`
}

// IndexStats provides telemetry regarding the index size and characteristics.
type IndexStats struct {
	TotalDocuments int     `json:"total_documents"`
	TotalTerms     int     `json:"total_terms"`
	AvgDocLength   float64 `json:"avg_doc_length"`
	TotalWords     int     `json:"total_words"`
}

// InvertedIndex is a concurrent full-text search index with BM25 scoring.
type InvertedIndex struct {
	mu           sync.RWMutex
	docs         map[string]*Document
	index        map[string]map[string]int // term -> docID -> frequency
	docLengths   map[string]int            // docID -> token count
	totalWords   int
	k1           float64 // BM25 term frequency saturation (typically 1.2 - 2.0)
	b            float64 // BM25 document length normalization (typically 0.75)
}

// NewInvertedIndex initializes a thread-safe index with optimal BM25 parameters.
func NewInvertedIndex() *InvertedIndex {
	return &InvertedIndex{
		docs:       make(map[string]*Document),
		index:      make(map[string]map[string]int),
		docLengths: make(map[string]int),
		k1:         1.2,
		b:          0.75,
	}
}

// AddDocument indexes a document into the inverted index.
func (idx *InvertedIndex) AddDocument(doc Document) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	// If document already exists, remove old counts first
	if oldDoc, exists := idx.docs[doc.ID]; exists {
		oldTokens := Tokenize(oldDoc.Title + " " + oldDoc.Content + " " + strings.Join(oldDoc.Tags, " "))
		for _, t := range oldTokens {
			if postings, ok := idx.index[t]; ok {
				delete(postings, doc.ID)
				if len(postings) == 0 {
					delete(idx.index, t)
				}
			}
		}
		idx.totalWords -= idx.docLengths[doc.ID]
		delete(idx.docLengths, doc.ID)
	}

	tokens := Tokenize(doc.Title + " " + doc.Content + " " + strings.Join(doc.Tags, " "))
	tokenCount := len(tokens)
	idx.docLengths[doc.ID] = tokenCount
	idx.totalWords += tokenCount

	for _, token := range tokens {
		if _, ok := idx.index[token]; !ok {
			idx.index[token] = make(map[string]int)
		}
		idx.index[token][doc.ID]++
	}

	docCopy := doc
	idx.docs[doc.ID] = &docCopy
}

// Search queries the inverted index and returns BM25-ranked results.
func (idx *InvertedIndex) Search(query string, tagFilter string, limit int) []SearchResult {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if limit <= 0 {
		limit = 10
	}

	queryTokens := Tokenize(query)
	if len(queryTokens) == 0 {
		return nil
	}

	numDocs := float64(len(idx.docs))
	if numDocs == 0 {
		return nil
	}

	avgdl := float64(idx.totalWords) / numDocs
	if avgdl == 0 {
		avgdl = 1.0
	}

	// Map of docID -> BM25 score
	scores := make(map[string]float64)
	matchedTerms := make(map[string][]string)

	for _, qTerm := range queryTokens {
		postings, exists := idx.index[qTerm]

		// If exact term not found, check for prefix or fuzzy match
		if !exists {
			for term, p := range idx.index {
				if strings.HasPrefix(term, qTerm) || (len(qTerm) >= 4 && LevenshteinDistance(qTerm, term) <= 1) {
					postings = p
					break
				}
			}
		}

		if postings == nil {
			continue
		}

		// Calculate IDF for term: ln(1 + (N - n + 0.5) / (n + 0.5))
		n := float64(len(postings))
		idf := math.Log(1.0 + (numDocs-n+0.5)/(n+0.5))
		if idf < 0 {
			idf = 0.05
		}

		for docID, freq := range postings {
			doc := idx.docs[docID]
			if doc == nil {
				continue
			}

			// Apply tag filter if specified
			if tagFilter != "" {
				matchedTag := false
				for _, t := range doc.Tags {
					if strings.EqualFold(t, tagFilter) {
						matchedTag = true
						break
					}
				}
				if !matchedTag {
					continue
				}
			}

			docLen := float64(idx.docLengths[docID])
			tf := float64(freq)

			// BM25 term weight
			numerator := tf * (idx.k1 + 1.0)
			denominator := tf + idx.k1*(1.0-idx.b+idx.b*(docLen/avgdl))
			termScore := idf * (numerator / denominator)

			// Boost if term appears in title
			if strings.Contains(strings.ToLower(doc.Title), qTerm) {
				termScore *= 2.2
			}

			// Boost if term appears in tags
			for _, tag := range doc.Tags {
				if strings.EqualFold(tag, qTerm) {
					termScore *= 1.8
					break
				}
			}

			scores[docID] += termScore
			matchedTerms[docID] = append(matchedTerms[docID], qTerm)
		}
	}

	var results []SearchResult
	for docID, score := range scores {
		doc := idx.docs[docID]
		if doc == nil {
			continue
		}

		snippet := generateSnippet(doc.Content, queryTokens)
		results = append(results, SearchResult{
			Document: *doc,
			Score:    math.Round(score*100) / 100,
			Snippet:  snippet,
			Matches:  dedup(matchedTerms[docID]),
		})
	}

	// Sort descending by score
	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	if len(results) > limit {
		results = results[:limit]
	}

	return results
}

// Stats returns index statistics.
func (idx *InvertedIndex) Stats() IndexStats {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	totalDocs := len(idx.docs)
	avgdl := 0.0
	if totalDocs > 0 {
		avgdl = float64(idx.totalWords) / float64(totalDocs)
	}

	return IndexStats{
		TotalDocuments: totalDocs,
		TotalTerms:     len(idx.index),
		AvgDocLength:   math.Round(avgdl*10) / 10,
		TotalWords:     idx.totalWords,
	}
}

// generateSnippet creates a contextual preview window around query terms.
func generateSnippet(content string, queryTerms []string) string {
	if len(content) <= 160 {
		return content
	}

	lowerContent := strings.ToLower(content)
	bestPos := -1

	for _, term := range queryTerms {
		pos := strings.Index(lowerContent, term)
		if pos != -1 {
			bestPos = pos
			break
		}
	}

	if bestPos == -1 {
		runes := []rune(content)
		if len(runes) > 160 {
			return string(runes[:160]) + "..."
		}
		return content
	}

	start := bestPos - 60
	if start < 0 {
		start = 0
	}
	end := bestPos + 100
	if end > len(content) {
		end = len(content)
	}

	snippet := content[start:end]
	prefix := "..."
	suffix := "..."
	if start == 0 {
		prefix = ""
	}
	if end == len(content) {
		suffix = ""
	}

	return fmt.Sprintf("%s%s%s", prefix, strings.TrimSpace(snippet), suffix)
}

func dedup(slice []string) []string {
	seen := make(map[string]struct{})
	var result []string
	for _, s := range slice {
		if _, ok := seen[s]; !ok {
			seen[s] = struct{}{}
			result = append(result, s)
		}
	}
	return result
}
