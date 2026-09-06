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

	"github.com/benzjeremy/search/internal/crawler"
	"github.com/benzjeremy/search/internal/engine"
	"github.com/benzjeremy/search/internal/server"
)

const version = "v1.0"

func main() {
	portFlag := flag.Int("port", 8080, "Port to listen on (strictly bound to 127.0.0.1)")
	dirFlag := flag.String("dir", "", "Optional local directory path to crawl and index")
	queryFlag := flag.String("query", "", "Direct CLI search mode: query the index and exit")
	tagFlag := flag.String("tag", "", "Optional tag filter for CLI search mode")
	tokenFlag := flag.String("token", "", "Pre-shared API token for indexing mutations (auto-generated if empty)")
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

	// 2. Index local directory if specified
	if *dirFlag != "" {
		fmt.Printf("📂 Crawling and indexing local directory: %s ...\n", *dirFlag)
		count, err := crawler.IndexLocalDirectory(idx, *dirFlag)
		if err != nil {
			log.Printf("⚠️ Warning during directory crawl: %v\n", err)
		} else {
			fmt.Printf("✓ Indexed %d local files from %s\n", count, *dirFlag)
		}
	}

	// 3. Direct CLI Search Mode
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

	// 4. Server Mode (Local-First HTTP Daemon)
	srv := server.NewServer(idx, *portFlag, *tokenFlag)

	stats := idx.Stats()
	fmt.Printf("🚀 search %s Engine Ready!\n", version)
	fmt.Printf("📊 Indexed Documents: %d | Terms: %d | Words: %d\n", stats.TotalDocuments, stats.TotalTerms, stats.TotalWords)
	fmt.Printf("🔒 API Auth Token:     %s\n", srv.APIToken())
	fmt.Printf("🌐 Local Endpoint:     http://127.0.0.1:%d\n", *portFlag)
	fmt.Printf("   Endpoints:          GET  /health\n")
	fmt.Printf("                       GET  /api/search?q=...&tag=...&limit=...\n")
	fmt.Printf("                       GET  /api/stats\n")
	fmt.Printf("                       POST /api/index (Bearer Auth required)\n\n")

	// Graceful Shutdown
	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := srv.Start(); err != nil && err.Error() != "http: Server closed" {
			log.Fatalf("Fatal server error: %v", err)
		}
	}()

	<-stopChan
	fmt.Println("\nShutting down search engine gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}
	fmt.Println("Goodbye!")
}
