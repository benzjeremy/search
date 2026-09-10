package crawler

import (
	"strings"
	"testing"
)

func TestExtractHTMLMetadata(t *testing.T) {
	sampleHTML := `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>docklite — Ultra-lightweight Docker Container Monitor</title>
  <meta name="description" content="Radikal schlanke Portainer-Alternative in Go und Astro. Standalone-Binary mit minimalem RAM.">
  <style>body { background: #000; }</style>
  <script>console.log("tracker");</script>
</head>
<body>
  <header>
    <nav><a href="/">Home</a></nav>
  </header>
  <main>
    <h1>Container Dashboard</h1>
    <p>Live Server-Sent Events (SSE) Metriken, Container Logs und Lifecycle-Management.</p>
  </main>
  <footer>
    <p>© 2026 Jeremy Benz</p>
  </footer>
</body>
</html>`

	title, desc, cleanText := ExtractHTMLMetadata(sampleHTML)

	expectedTitle := "docklite — Ultra-lightweight Docker Container Monitor"
	if title != expectedTitle {
		t.Errorf("Expected title %q, got %q", expectedTitle, title)
	}

	expectedDesc := "Radikal schlanke Portainer-Alternative in Go und Astro. Standalone-Binary mit minimalem RAM."
	if desc != expectedDesc {
		t.Errorf("Expected desc %q, got %q", expectedDesc, desc)
	}

	if strings.Contains(cleanText, "tracker") {
		t.Errorf("Expected script content to be stripped, but found 'tracker'")
	}
	if strings.Contains(cleanText, "background: #000") {
		t.Errorf("Expected style content to be stripped, but found styles")
	}
	if !strings.Contains(cleanText, "Container Dashboard") {
		t.Errorf("Expected main text to contain 'Container Dashboard'")
	}
	if !strings.Contains(cleanText, "Server-Sent Events") {
		t.Errorf("Expected main text to contain 'Server-Sent Events'")
	}
}

func TestDefaultWhitelist(t *testing.T) {
	list := DefaultWhitelist()
	if len(list) < 5 {
		t.Errorf("Expected at least 5 default whitelist entries, got %d", len(list))
	}
	foundHub := false
	for _, u := range list {
		if u == "https://benzjeremy.github.io/" {
			foundHub = true
			break
		}
	}
	if !foundHub {
		t.Errorf("Expected default whitelist to contain root hub URL")
	}
}
