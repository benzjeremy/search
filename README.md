<div align="center">

# ⚡ search — Ultra-Fast, Privacy-First Search Engine in Go

**High-Performance Inverted Full-Text Index · BM25 Ranking · Typo Tolerance · Local-First Daemon**

[![Release](https://img.shields.io/badge/release-v1.1%20[Pre--Release]-38bdf8?style=flat-square)](https://github.com/benzjeremy/search/releases)
[![Status: Pre-Release](https://img.shields.io/badge/status-pre--release%20%2F%20WIP-orange.svg?style=flat-square)](https://github.com/benzjeremy/search)
[![Go Version](https://img.shields.io/badge/go-1.22+-00add8?style=flat-square&logo=go)](https://golang.org)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](https://github.com/benzjeremy/search/blob/main/LICENSE)
[![Zero Telemetry](https://img.shields.io/badge/telemetry-zero-success?style=flat-square)](https://github.com/benzjeremy/search)
[![Website](https://img.shields.io/badge/showcase-web-purple?style=flat-square)](https://benzjeremy.github.io/search/)

</div>

> [!IMPORTANT]
> ### 🚧 Pre-Release / Active Development Notice
> **This software is not yet finished and is under active development.**  
> All releases, binaries, and API formats are **Pre-Releases** (Work in Progress), even if released under standard tags. Full-text indexing, BM25 tuning, and crawler integration are undergoing continuous updates and optimization.

---

## 📖 About the Project

`search` is an autonomous, memory-efficient, and privacy-first search engine engineered by **Jeremy Benz** (@benzjeremy). Designed for local file systems, document archives, and the broader Jeremy Benz software ecosystem.

Unlike monolithic search clusters (Elasticsearch, Meilisearch) requiring massive Java or Node runtimes, `search` starts up in under **5 milliseconds**, consumes less than **8 MB RAM** at idle, and delivers BM25-ranked query matches typically in under **100 microseconds** ($\mu s$).

### 🚀 Core Features

- **Inverted Full-Text Index & BM25 Ranking**: Exact implementation of the Okapi BM25 formula ($k_1 = 1.2$, $b = 0.75$) with dynamic IDF dampening and title/tag weighting.
- **Multilingual Tokenization**: Intelligent unicode tokenization, boundary analysis, and stopword filtering for English and German.
- **Typo Tolerance (Fuzzy Matching)**: Fast Levenshtein distance fallback for misspelled search terms.
- **Zero Dummy Security & Local-First**:
  - Strictly binds to `127.0.0.1` by default (never `0.0.0.0`).
  - **DNS Rebinding Protection**: Validates the HTTP `Host` header against cross-origin browser attacks.
  - **Cryptographic Token Authentication**: Secure 256-bit API tokens generated via `crypto/rand` with constant-time validation (`crypto/subtle`).
- **Dual Operating Modes**:
  - **CLI Mode**: Instant command-line queries (`search -query="docker"`).
  - **Server Mode**: Lightweight HTTP daemon providing a REST API for frontend and script automation.
- **Web Showcase**: Interactive frontend featuring live search in signature glassmorphic design.

---

## 🛠️ Quick Start & Installation

### Option 1: Install via Go
```bash
go install github.com/benzjeremy/search/cmd/search@latest
```

### Option 2: Build from Source
```bash
git clone https://github.com/benzjeremy/search.git
cd search
make build
```

---

## 💻 Usage

### 1. Direct CLI Query
```bash
# Query keywords across the ecosystem
./bin/search -query="docklite"

# Query with tag filter
./bin/search -query="desktop" -tag="go"

# Index local folder and execute query
./bin/search -dir="/home/user/Documents" -query="invoice"

# Crawl web resource and export index (v1.1)
./bin/search -crawl-url="https://go.dev/doc/" -export="index.json"

# Crawl curated whitelist and export index as JSON (v1.1)
./bin/search -crawl-whitelist -export="index.json"

# Import pre-calculated index and query (v1.1)
./bin/search -import="index.json" -query="concurrency"
```

### 2. Run as Local HTTP Daemon
```bash
./bin/search -port=8080 -dir="/home/user/Projects"
```

Console output:
```text
🚀 search v1.0 Engine Ready!
📊 Indexed Documents: 42 | Terms: 1350 | Words: 8420
🔒 API Auth Token:     9f4a6b2c...
🌐 Local Endpoint:     http://127.0.0.1:8080
```

---

## 📡 REST API Endpoints

All endpoints bind strictly to `127.0.0.1`.

| Method | Path | Authentication | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | None | Liveness & version check |
| `GET` | `/api/search?q=...&tag=...&limit=...` | None | BM25 full-text search with match snippets |
| `GET` | `/api/stats` | None | Engine and memory telemetry |
| `POST` | `/api/index` | `Bearer <Token>` | Dynamically index a new document |

### Example: Query via `curl`
```bash
curl "http://127.0.0.1:8080/api/search?q=docker"
```

Response:
```json
{
  "query": "docker",
  "count": 1,
  "duration": "94.2µs",
  "duration_micros": 94,
  "results": [
    {
      "document": {
        "id": "docklite",
        "title": "docklite — Ultra-lightweight Docker Container Monitor",
        "url": "https://benzjeremy.github.io/docklite/",
        "tags": ["go", "docker", "devops", "astro"]
      },
      "score": 11.64,
      "snippet": "Radically lightweight Portainer alternative in Go and Astro...",
      "matches": ["docker"]
    }
  ]
}
```

---

## 🧪 Tests

```bash
make test
```

---

## 📜 License & Author

This project is open-source software licensed under the **GNU General Public License, Version 3 (GPL-3.0)**.

- **Author**: Jeremy Benz ([@benzjeremy](https://github.com/benzjeremy))
- **Website & Ecosystem**: [benzjeremy.github.io](https://benzjeremy.github.io/)
