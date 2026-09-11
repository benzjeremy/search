package bookmarks

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/benzjeremy/search/internal/engine"
)

// Bookmark represents a private, local user bookmark or resource.
type Bookmark struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	URL       string    `json:"url"`
	Tags      []string  `json:"tags"`
	Notes     string    `json:"notes"`
	CreatedAt time.Time `json:"created_at"`
}

// Store handles thread-safe persistence of local bookmarks.
type Store struct {
	mu        sync.RWMutex
	filePath  string
	bookmarks map[string]Bookmark
}

// DefaultStorePath returns the standard local-first data directory for search.
func DefaultStorePath() string {
	dataHome := os.Getenv("XDG_DATA_HOME")
	if dataHome == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "bookmarks.json"
		}
		dataHome = filepath.Join(home, ".local", "share")
	}
	return filepath.Join(dataHome, "search", "bookmarks.json")
}

// NewStore initializes a new bookmark store at the given path.
func NewStore(path string) (*Store, error) {
	if path == "" {
		path = DefaultStorePath()
	}

	s := &Store{
		filePath:  path,
		bookmarks: make(map[string]Bookmark),
	}

	if err := s.load(); err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("failed to load bookmarks: %w", err)
	}

	return s, nil
}

// load reads the bookmarks from the JSON file.
func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return err
	}

	var list []Bookmark
	if err := json.Unmarshal(data, &list); err != nil {
		return fmt.Errorf("corrupt bookmark json: %w", err)
	}

	s.bookmarks = make(map[string]Bookmark, len(list))
	for _, b := range list {
		s.bookmarks[b.ID] = b
	}

	return nil
}

// save writes the current bookmarks atomically to disk.
func (s *Store) save() error {
	dir := filepath.Dir(s.filePath)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dir, err)
	}

	list := make([]Bookmark, 0, len(s.bookmarks))
	for _, b := range s.bookmarks {
		list = append(list, b)
	}

	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal bookmarks: %w", err)
	}

	tmpFile := fmt.Sprintf("%s.tmp.%d", s.filePath, time.Now().UnixNano())
	if err := os.WriteFile(tmpFile, data, 0600); err != nil {
		return fmt.Errorf("failed to write tmp file: %w", err)
	}

	if err := os.Rename(tmpFile, s.filePath); err != nil {
		os.Remove(tmpFile)
		return fmt.Errorf("atomic rename failed: %w", err)
	}

	return nil
}

// Add creates or updates a bookmark.
func (s *Store) Add(title, url, notes string, tags []string) (*Bookmark, error) {
	if title == "" {
		title = url
	}
	if url == "" {
		return nil, fmt.Errorf("url cannot be empty")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if URL already exists
	var existingID string
	for id, b := range s.bookmarks {
		if b.URL == url {
			existingID = id
			break
		}
	}

	if existingID == "" {
		buf := make([]byte, 8)
		if _, err := rand.Read(buf); err != nil {
			return nil, fmt.Errorf("crypto rand error: %w", err)
		}
		existingID = hex.EncodeToString(buf)
	}

	bm := Bookmark{
		ID:        existingID,
		Title:     title,
		URL:       url,
		Tags:      tags,
		Notes:     notes,
		CreatedAt: time.Now().UTC(),
	}

	s.bookmarks[existingID] = bm
	if err := s.save(); err != nil {
		return nil, err
	}

	return &bm, nil
}

// Delete removes a bookmark by ID.
func (s *Store) Delete(id string) (bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.bookmarks[id]; !exists {
		return false, nil
	}

	delete(s.bookmarks, id)
	if err := s.save(); err != nil {
		return false, err
	}

	return true, nil
}

// List returns a snapshot of all saved bookmarks.
func (s *Store) List() []Bookmark {
	s.mu.RLock()
	defer s.mu.RUnlock()

	res := make([]Bookmark, 0, len(s.bookmarks))
	for _, b := range s.bookmarks {
		res = append(res, b)
	}
	return res
}

// IndexAll imports all bookmarks into the search inverted index.
func (s *Store) IndexAll(idx *engine.InvertedIndex) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	count := 0
	for _, b := range s.bookmarks {
		doc := engine.Document{
			ID:      "bookmark:" + b.ID,
			Title:   b.Title,
			URL:     b.URL,
			Content: fmt.Sprintf("%s %s %s", b.Title, b.URL, b.Notes),
			Tags:    append([]string{"bookmark", "private"}, b.Tags...),
		}
		idx.AddDocument(doc)
		count++
	}
	return count
}
