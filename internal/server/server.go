package server

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/benzjeremy/search/internal/engine"
)

// Server encapsulates the HTTP search engine instance.
type Server struct {
	idx        *engine.InvertedIndex
	apiToken   string
	port       int
	startTime  time.Time
	httpServer *http.Server
}

// SearchAPIResponse is the JSON response structure for search queries.
type SearchAPIResponse struct {
	Query     string                `json:"query"`
	Tag       string                `json:"tag,omitempty"`
	Count     int                   `json:"count"`
	Duration  string                `json:"duration"`
	Micros    int64                 `json:"duration_micros"`
	Results   []engine.SearchResult `json:"results"`
}

// SystemStatsResponse provides server telemetry.
type SystemStatsResponse struct {
	Version      string            `json:"version"`
	Uptime       string            `json:"uptime"`
	UptimeSecs   int64             `json:"uptime_seconds"`
	MemoryAlloc  string            `json:"memory_alloc"`
	NumGoroutine int               `json:"num_goroutine"`
	IndexStats   engine.IndexStats `json:"index_stats"`
}

// NewServer constructs a new search server instance.
func NewServer(idx *engine.InvertedIndex, port int, token string) *Server {
	if token == "" {
		token = GenerateSecureToken()
	}

	return &Server{
		idx:       idx,
		apiToken:  token,
		port:      port,
		startTime: time.Now(),
	}
}

// APIToken returns the configured API token for authenticating mutations.
func (s *Server) APIToken() string {
	return s.apiToken
}

// Routes constructs the mux with security middleware.
func (s *Server) Routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", s.HandleHealth)
	mux.HandleFunc("/api/search", s.HandleSearch)
	mux.HandleFunc("/api/stats", s.HandleStats)
	mux.HandleFunc("/api/index", s.TokenAuthMiddleware(s.HandleIndexDoc))

	// Chain security middleware
	var handler http.Handler = mux
	handler = s.RebindingProtectionMiddleware(handler)
	handler = SecurityHeadersMiddleware(handler)

	return handler
}

// Start runs the server strictly bound to 127.0.0.1.
func (s *Server) Start() error {
	addr := fmt.Sprintf("127.0.0.1:%d", s.port)
	s.httpServer = &http.Server{
		Addr:              addr,
		Handler:           s.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	return s.httpServer.ListenAndServe()
}

// Shutdown gracefully stops the HTTP server.
func (s *Server) Shutdown(ctx context.Context) error {
	if s.httpServer != nil {
		return s.httpServer.Shutdown(ctx)
	}
	return nil
}

// HandleHealth provides a fast liveness probe.
func (s *Server) HandleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": "search",
		"version": "v1.0",
	})
}

// HandleSearch processes full-text queries.
func (s *Server) HandleSearch(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	start := time.Now()
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	tag := strings.TrimSpace(r.URL.Query().Get("tag"))
	limitStr := r.URL.Query().Get("limit")

	limit := 10
	if limitStr != "" {
		if val, err := strconv.Atoi(limitStr); err == nil && val > 0 && val <= 50 {
			limit = val
		}
	}

	results := s.idx.Search(query, tag, limit)
	elapsed := time.Since(start)

	resp := SearchAPIResponse{
		Query:    query,
		Tag:      tag,
		Count:    len(results),
		Duration: elapsed.String(),
		Micros:   elapsed.Microseconds(),
		Results:  results,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// HandleStats returns search engine and system telemetry.
func (s *Server) HandleStats(w http.ResponseWriter, r *http.Request) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	uptime := time.Since(s.startTime)

	stats := SystemStatsResponse{
		Version:      "v1.0",
		Uptime:       uptime.Round(time.Second).String(),
		UptimeSecs:   int64(uptime.Seconds()),
		MemoryAlloc:  fmt.Sprintf("%.2f MB", float64(m.Alloc)/1024/1024),
		NumGoroutine: runtime.NumGoroutine(),
		IndexStats:   s.idx.Stats(),
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(stats)
}

// HandleIndexDoc indexes a single document into the runtime engine.
func (s *Server) HandleIndexDoc(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error":"Method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		ID      string   `json:"id"`
		Title   string   `json:"title"`
		URL     string   `json:"url"`
		Content string   `json:"content"`
		Tags    []string `json:"tags"`
		Source  string   `json:"source"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"Malformed JSON body"}`, http.StatusBadRequest)
		return
	}

	if strings.TrimSpace(req.ID) == "" || strings.TrimSpace(req.Title) == "" || strings.TrimSpace(req.Content) == "" {
		http.Error(w, `{"error":"Missing required fields: id, title, content"}`, http.StatusBadRequest)
		return
	}

	doc := engine.Document{
		ID:        req.ID,
		Title:     req.Title,
		URL:       req.URL,
		Content:   req.Content,
		Tags:      req.Tags,
		Source:    req.Source,
		Timestamp: time.Now(),
	}

	s.idx.AddDocument(doc)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "indexed",
		"id":      doc.ID,
		"title":   doc.Title,
		"doc_len": len(engine.Tokenize(doc.Title + " " + doc.Content)),
	})
}
