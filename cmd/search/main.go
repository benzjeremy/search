package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/benzjeremy/search/internal/bookmarks"
	"github.com/benzjeremy/search/internal/crawler"
	"github.com/benzjeremy/search/internal/engine"
	"github.com/benzjeremy/search/internal/server"
)

const version = "v1.2"

func main() {
	portFlag := flag.Int("port", 8080, "Port to listen on (strictly bound to 127.0.0.1)")
	dirFlag := flag.String("dir", "", "Optional local directory path to crawl and index")
	queryFlag := flag.String("query", "", "Direct CLI search mode: query the index and exit")
	tagFlag := flag.String("tag", "", "Optional tag filter for CLI search mode")
	tokenFlag := flag.String("token", "", "Pre-shared API token for indexing mutations (auto-generated if empty)")
	exportFlag := flag.String("export", "", "Export index documents to a JSON file (e.g. index.json)")
	importFlag := flag.String("import", "", "Import precomputed index from a JSON file")
	crawlURLFlag := flag.String("crawl-url", "", "Crawl a specific HTTP/HTTPS URL and index its content")
	crawlWhitelistFlag := flag.Bool("crawl-whitelist", false, "Crawl official curated developer & project documentation URLs")
	guiFlag := flag.Bool("gui", false, "Launch native desktop UI window (WebKitGTK / Edge / Chrome)")
	serveFlag := flag.Bool("serve", false, "Run strictly in background server daemon mode without GUI")
	bmPathFlag := flag.String("bookmarks-file", "", "Custom path to local bookmarks JSON storage")
	versionFlag := flag.Bool("version", false, "Print version information and exit")
	flag.Parse()

	if *versionFlag {
		fmt.Printf("search %s · Jeremy Benz (@benzjeremy) · GPL-3.0\n", version)
		os.Exit(0)
	}

	idx := engine.NewInvertedIndex()

	// 1. Seed with Jeremy Benz Ecosystem Knowledge
	seeds := crawler.SeedKnowledge()
	for _, doc := range seeds {
		idx.AddDocument(doc)
	}

	// 2. Import precomputed index if specified
	if *importFlag != "" {
		fmt.Printf("📥 Importing precomputed index from: %s ...\n", *importFlag)
		count, err := idx.ImportJSON(*importFlag)
		if err != nil {
			log.Printf("⚠️ Warning during index import: %v\n", err)
		} else {
			fmt.Printf("✓ Imported %d documents from %s\n", count, *importFlag)
		}
	}

	// 3. Load private local bookmarks
	bmStore, err := bookmarks.NewStore(*bmPathFlag)
	if err != nil {
		log.Printf("⚠️ Warning: could not initialize bookmarks store: %v\n", err)
	} else {
		bmCount := bmStore.IndexAll(idx)
		if bmCount > 0 {
			fmt.Printf("🔒 Loaded and indexed %d private local bookmarks\n", bmCount)
		}
	}

	// 4. Index local directory if specified
	if *dirFlag != "" {
		fmt.Printf("📂 Crawling and indexing local directory: %s ...\n", *dirFlag)
		count, err := crawler.IndexLocalDirectory(idx, *dirFlag)
		if err != nil {
			log.Printf("⚠️ Warning during directory crawl: %v\n", err)
		} else {
			fmt.Printf("✓ Indexed %d local files from %s\n", count, *dirFlag)
		}
	}

	// 5. Crawl single web URL if specified
	if *crawlURLFlag != "" {
		fmt.Printf("🌐 Crawling web resource: %s ...\n", *crawlURLFlag)
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		doc, err := crawler.CrawlURL(ctx, *crawlURLFlag)
		cancel()
		if err != nil {
			log.Printf("⚠️ Warning during web crawl: %v\n", err)
		} else {
			idx.AddDocument(*doc)
			fmt.Printf("✓ Successfully indexed %q (%s)\n", doc.Title, doc.URL)
		}
	}

	// 6. Crawl curated whitelist if requested
	if *crawlWhitelistFlag {
		fmt.Println("🌐 Crawling official curated developer whitelist ...")
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		docs, err := crawler.CrawlWhitelist(ctx, crawler.DefaultWhitelist())
		cancel()
		if err != nil {
			log.Printf("⚠️ Warning during whitelist crawl: %v\n", err)
		} else {
			for _, doc := range docs {
				idx.AddDocument(doc)
			}
			fmt.Printf("✓ Indexed %d web pages from curated whitelist\n", len(docs))
		}
	}

	// 7. Export index to JSON file if specified
	if *exportFlag != "" {
		fmt.Printf("💾 Exporting full search index to: %s ...\n", *exportFlag)
		if err := idx.ExportJSON(*exportFlag); err != nil {
			log.Fatalf("Fatal error exporting index: %v", err)
		}
		stats := idx.Stats()
		fmt.Printf("✓ Export complete! %d documents, %d terms written to %s\n", stats.TotalDocuments, stats.TotalTerms, *exportFlag)
		if *queryFlag == "" {
			os.Exit(0)
		}
	}

	// 8. Direct CLI Search Mode
	if *queryFlag != "" {
		start := time.Now()
		results := idx.Search(*queryFlag, *tagFlag, 10)
		elapsed := time.Since(start)

		fmt.Printf("\n🔍 Search Results for: %q (in %s, %d matches)\n", *queryFlag, elapsed, len(results))
		fmt.Println("================================================================================")
		if len(results) == 0 {
			fmt.Println("No documents matched your query.")
			os.Exit(0)
		}

		for i, res := range results {
			fmt.Printf("[%d] %s (Score: %.2f)\n", i+1, res.Document.Title, res.Score)
			fmt.Printf("    URL:     %s\n", res.Document.URL)
			fmt.Printf("    Tags:    %v\n", res.Document.Tags)
			fmt.Printf("    Snippet: %s\n\n", res.Snippet)
		}
		os.Exit(0)
	}

	// 9. Server Mode (Local-First HTTP Daemon + Embedded Web UI)
	srv := server.NewServer(idx, *portFlag, *tokenFlag)
	if bmStore != nil {
		srv.SetBookmarkStore(bmStore)
	}

	stats := idx.Stats()
	localURL := fmt.Sprintf("http://127.0.0.1:%d", *portFlag)

	fmt.Printf("\n╔══════════════════════════════════════════════════════════════╗\n")
	fmt.Printf("║  🔍 search %s · High-Velocity Local-First Search Engine    ║\n", version)
	fmt.Printf("╚══════════════════════════════════════════════════════════════╝\n")
	fmt.Printf("📊 Indexed Documents: %d | Terms: %d | Words: %d\n", stats.TotalDocuments, stats.TotalTerms, stats.TotalWords)
	if bmStore != nil {
		fmt.Printf("🔒 Private Bookmarks:  %d stored locally\n", len(bmStore.List()))
	}
	fmt.Printf("🔒 API Auth Token:     %s\n", srv.APIToken())
	fmt.Printf("🌐 Local Endpoint:     %s\n", localURL)
	fmt.Printf("   Endpoints:          GET  /health\n")
	fmt.Printf("                       GET  /api/search?q=...&tag=...&limit=...\n")
	fmt.Printf("                       GET  /api/stats\n")
	fmt.Printf("                       GET  /api/bookmarks\n")
	fmt.Printf("                       POST /api/bookmarks (Local/Token Auth)\n")
	fmt.Printf("                       POST /api/index (Bearer Auth required)\n\n")

	// Graceful Shutdown
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := srv.Start(); err != nil && err.Error() != "http: Server closed" {
			log.Fatalf("Fatal server error: %v", err)
		}
	}()

	// Desktop GUI Mode
	shouldLaunchGUI := *guiFlag || (!*serveFlag && os.Getenv("DISPLAY") != "")
	if shouldLaunchGUI {
		go func() {
			time.Sleep(150 * time.Millisecond) // Wait for HTTP server bind
			title := fmt.Sprintf("search %s · Jeremy Benz", version)
			if err := runNativeGUI(localURL, title); err != nil {
				log.Printf("Desktop GUI note: %v\n", err)
			} else {
				// User closed the desktop window
				stopChan <- os.Interrupt
			}
		}()
	}

	<-stopChan
	fmt.Println("\nShutting down search engine gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}
	fmt.Println("Goodbye!")
}
