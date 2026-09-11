package bookmarks

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/benzjeremy/search/internal/engine"
)

func TestBookmarkStore(t *testing.T) {
	tmpDir := t.TempDir()
	storePath := filepath.Join(tmpDir, "test-bookmarks.json")

	store, err := NewStore(storePath)
	if err != nil {
		t.Fatalf("failed to create store: %v", err)
	}

	// 1. Add Bookmark
	bm, err := store.Add("Go Documentation", "https://go.dev/doc/", "Official Go docs", []string{"go", "lang"})
	if err != nil {
		t.Fatalf("Add failed: %v", err)
	}

	if bm.ID == "" || bm.Title != "Go Documentation" {
		t.Errorf("unexpected bookmark: %+v", bm)
	}

	// 2. List
	list := store.List()
	if len(list) != 1 {
		t.Fatalf("expected 1 bookmark, got %d", len(list))
	}

	// 3. IndexAll
	idx := engine.NewInvertedIndex()
	indexed := store.IndexAll(idx)
	if indexed != 1 {
		t.Fatalf("expected 1 indexed, got %d", indexed)
	}

	results := idx.Search("Documentation", "", 5)
	if len(results) == 0 {
		t.Fatalf("expected to find indexed bookmark")
	}

	// 4. Persistence Reload
	store2, err := NewStore(storePath)
	if err != nil {
		t.Fatalf("reload failed: %v", err)
	}
	if len(store2.List()) != 1 {
		t.Fatalf("expected 1 reloaded bookmark, got %d", len(store2.List()))
	}

	// 5. Delete
	deleted, err := store.Delete(bm.ID)
	if err != nil || !deleted {
		t.Fatalf("delete failed: %v", err)
	}
	if len(store.List()) != 0 {
		t.Errorf("expected 0 bookmarks after delete")
	}

	// Check file on disk
	if _, err := os.Stat(storePath); err != nil {
		t.Errorf("store file should exist: %v", err)
	}
}
