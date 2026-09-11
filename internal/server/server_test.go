package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/benzjeremy/search/internal/bookmarks"
	"github.com/benzjeremy/search/internal/engine"
)

func setupTestServer() (*Server, *engine.InvertedIndex) {
	idx := engine.NewInvertedIndex()
	idx.AddDocument(engine.Document{
		ID:        "doc1",
		Title:     "untis-go WebUntis Client",
		URL:       "https://benzjeremy.github.io/untis-go/",
		Content:   "Schneller nativer Desktop Client für WebUntis in Go mit GTK.",
		Tags:      []string{"go", "desktop", "untis"},
		Source:    "ecosystem",
		Timestamp: time.Now(),
	})

	srv := NewServer(idx, 8085, "test-secret-token-12345")
	return srv, idx
}

func TestHealthEndpoint(t *testing.T) {
	srv, _ := setupTestServer()
	handler := srv.Routes()

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Host = "127.0.0.1:8085"
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected HTTP 200, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("Failed to decode JSON: %v", err)
	}

	if body["status"] != "healthy" {
		t.Errorf("Expected status healthy, got %s", body["status"])
	}
}

func TestDNSRebindingProtection(t *testing.T) {
	srv, _ := setupTestServer()
	handler := srv.Routes()

	// Malicious host header should be blocked
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.Host = "attacker-domain.evil.com"
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("Expected HTTP 403 Forbidden for spoofed Host header, got %d", rec.Code)
	}
}

func TestSearchAPI(t *testing.T) {
	srv, _ := setupTestServer()
	handler := srv.Routes()

	req := httptest.NewRequest(http.MethodGet, "/api/search?q=webuntis", nil)
	req.Host = "127.0.0.1:8085"
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected HTTP 200, got %d", rec.Code)
	}

	var resp SearchAPIResponse
	if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
		t.Fatalf("Failed to decode JSON response: %v", err)
	}

	if resp.Count != 1 {
		t.Errorf("Expected 1 result for 'webuntis', got %d", resp.Count)
	}
	if len(resp.Results) > 0 && resp.Results[0].Document.ID != "doc1" {
		t.Errorf("Expected doc1, got %s", resp.Results[0].Document.ID)
	}
}

func TestIndexAuth(t *testing.T) {
	srv, _ := setupTestServer()
	handler := srv.Routes()

	docPayload := map[string]interface{}{
		"id":      "new-doc",
		"title":   "Docklite Portainer Alternative",
		"url":     "https://benzjeremy.github.io/docklite/",
		"content": "Ultra-lightweight Docker monitor.",
		"tags":    []string{"docker", "go"},
	}
	payloadBytes, _ := json.Marshal(docPayload)

	// 1. Without Auth Header -> 401
	reqUnauth := httptest.NewRequest(http.MethodPost, "/api/index", bytes.NewReader(payloadBytes))
	reqUnauth.Host = "localhost:8085"
	recUnauth := httptest.NewRecorder()
	handler.ServeHTTP(recUnauth, reqUnauth)

	if recUnauth.Code != http.StatusUnauthorized {
		t.Fatalf("Expected HTTP 401 for missing token, got %d", recUnauth.Code)
	}

	// 2. With Wrong Auth Header -> 401
	reqWrong := httptest.NewRequest(http.MethodPost, "/api/index", bytes.NewReader(payloadBytes))
	reqWrong.Host = "localhost:8085"
	reqWrong.Header.Set("Authorization", "Bearer invalid-token")
	recWrong := httptest.NewRecorder()
	handler.ServeHTTP(recWrong, reqWrong)

	if recWrong.Code != http.StatusUnauthorized {
		t.Fatalf("Expected HTTP 401 for invalid token, got %d", recWrong.Code)
	}

	// 3. With Valid Auth Header -> 201 Created
	reqValid := httptest.NewRequest(http.MethodPost, "/api/index", bytes.NewReader(payloadBytes))
	reqValid.Host = "localhost:8085"
	reqValid.Header.Set("Authorization", "Bearer test-secret-token-12345")
	recValid := httptest.NewRecorder()
	handler.ServeHTTP(recValid, reqValid)

	if recValid.Code != http.StatusCreated {
		t.Fatalf("Expected HTTP 201 Created, got %d", recValid.Code)
	}
}

func TestBookmarksAPI(t *testing.T) {
	srv, _ := setupTestServer()
	tmpDir := t.TempDir()
	store, err := bookmarks.NewStore(tmpDir + "/test-bm.json")
	if err != nil {
		t.Fatalf("failed to init bm store: %v", err)
	}
	srv.SetBookmarkStore(store)

	handler := srv.Routes()

	// 1. GET Bookmarks (empty)
	req := httptest.NewRequest(http.MethodGet, "/api/bookmarks", nil)
	req.Host = "127.0.0.1:8085"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	// 2. POST Bookmark
	bmJSON := `{"title":"Go Dev","url":"https://go.dev","notes":"Official Go site","tags":["go"]}`
	reqPost := httptest.NewRequest(http.MethodPost, "/api/bookmarks", bytes.NewReader([]byte(bmJSON)))
	reqPost.Host = "127.0.0.1:8085"
	recPost := httptest.NewRecorder()
	handler.ServeHTTP(recPost, reqPost)

	if recPost.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", recPost.Code, recPost.Body.String())
	}

	var created bookmarks.Bookmark
	if err := json.NewDecoder(recPost.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode created bookmark: %v", err)
	}

	// 3. Search query should find the newly indexed bookmark
	reqSearch := httptest.NewRequest(http.MethodGet, "/api/search?q=Official", nil)
	reqSearch.Host = "127.0.0.1:8085"
	recSearch := httptest.NewRecorder()
	handler.ServeHTTP(recSearch, reqSearch)

	if recSearch.Code != http.StatusOK {
		t.Fatalf("search failed: %d", recSearch.Code)
	}
	var searchResp SearchAPIResponse
	_ = json.NewDecoder(recSearch.Body).Decode(&searchResp)
	if searchResp.Count == 0 {
		t.Errorf("expected to find indexed bookmark in search API")
	}

	// 4. DELETE Bookmark
	reqDel := httptest.NewRequest(http.MethodDelete, "/api/bookmarks?id="+created.ID, nil)
	reqDel.Host = "127.0.0.1:8085"
	recDel := httptest.NewRecorder()
	handler.ServeHTTP(recDel, reqDel)

	if recDel.Code != http.StatusOK {
		t.Fatalf("expected 200 on delete, got %d", recDel.Code)
	}
}

func TestStaticWebServing(t *testing.T) {
	srv, _ := setupTestServer()
	handler := srv.Routes()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Host = "127.0.0.1:8085"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 for embedded static web root, got %d", rec.Code)
	}
}
