<div align="center">

# ⚡ search — Ultra-Fast, Privacy-First Search Engine in Go

**High-Performance Inverted Full-Text Index · BM25 Ranking · Typo Tolerance · Local-First Daemon**

[![Release](https://img.shields.io/badge/release-v1.0-38bdf8?style=flat-square)](https://github.com/benzjeremy/search/releases)
[![Go Version](https://img.shields.io/badge/go-1.22+-00add8?style=flat-square&logo=go)](https://golang.org)
[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](https://github.com/benzjeremy/search/blob/main/LICENSE)
[![Zero Telemetry](https://img.shields.io/badge/telemetry-zero-success?style=flat-square)](https://github.com/benzjeremy/search)
[![Website](https://img.shields.io/badge/showcase-web-purple?style=flat-square)](https://benzjeremy.github.io/search/)

</div>

---

## 📖 Über das Projekt

`search` ist eine eigenständige, speichereffiziente und datenschutzorientierte Suchmaschine, entwickelt von **Jeremy Benz** (@benzjeremy). Entwickelt für lokale Dateisysteme, Dokumentenarchive und das gesamte Jeremy-Benz-Ökosystem.

Im Gegensatz zu monolithischen Suchservern (Elasticsearch, Meilisearch) mit schwerem Java-/Node-Overhead startet `search` in unter **5 Millisekunden**, verbraucht im Leerlauf unter **8 MB RAM** und liefert BM25-gewertete Suchergebnisse typischerweise in unter **100 Mikrosekunden** ($\mu s$).

### 🚀 Kern-Features

- **Invertierter Volltext-Index & BM25-Ranking**: Exakte Implementierung der Okapi BM25-Formel ($k_1 = 1.2$, $b = 0.75$) mit dynamischer IDF-Dämpfung und Title-/Tag-Boosting.
- **Multilinguale Tokenisierung**: Intelligente Bereinigung, Unicode-Wortgrenzen und Stopwort-Filterung für Deutsch und Englisch.
- **Tippfehler-Toleranz (Fuzzy Matching)**: Schneller Levenshtein-Distanz-Fallback für vertippte Begriffe.
- **Zero Dummy Security & Local-First**:
  - Bindet standardmäßig ausschließlich an `127.0.0.1` (niemals `0.0.0.0`).
  - **DNS-Rebinding-Schutz**: Verifiziert den `Host`-Header gegen Rebinding-Angriffe aus dem Browser.
  - **Kryptografische Token-Authentifizierung**: Sichere API-Tokens (256-bit via `crypto/rand`) mit Constant-Time-Prüfung (`crypto/subtle`).
- **Doppelter Modus**:
  - **CLI-Modus**: Schnelle Direktabfrage auf der Kommandozeile (`search -query="docker"`).
  - **Server-Modus**: Lokaler HTTP-Daemon mit REST-API für Frontend- und Script-Integration.
- **Web-Showcase**: Interaktives Frontend mit Live-Suche im untis-go / docklite Signature-Design.

---

## 🛠️ Schnellstart & Installation

### Option 1: Mit Go installieren
```bash
go install github.com/benzjeremy/search/cmd/search@latest
```

### Option 2: Aus Quellcode kompilieren
```bash
git clone https://github.com/benzjeremy/search.git
cd search
make build
```

---

## 💻 Benutzung

### 1. Direktabfrage über CLI
```bash
# Suche nach Begriffen im Ökosystem
./bin/search -query="docklite"

# Suche mit Tag-Filter
./bin/search -query="desktop" -tag="go"

# Lokales Verzeichnis indizieren und durchsuchen
./bin/search -dir="/home/user/Dokumente" -query="rechnung"
```

### 2. Als lokaler HTTP-Daemon starten
```bash
./bin/search -port=8080 -dir="/home/user/Projekte"
```

Ausgabe:
```text
🚀 search v1.0 Engine Ready!
📊 Indexed Documents: 42 | Terms: 1350 | Words: 8420
🔒 API Auth Token:     9f4a6b2c...
🌐 Local Endpoint:     http://127.0.0.1:8080
```

---

## 📡 REST-API Endpunkte

Alle Schnittstellen binden strikt an `127.0.0.1`.

| Methode | Pfad | Authentifizierung | Beschreibung |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Keine | Liveness & Version-Check |
| `GET` | `/api/search?q=...&tag=...&limit=...` | Keine | BM25-Volltextsuche mit Snippets |
| `GET` | `/api/stats` | Keine | Engine- & Speicher-Telemetrie |
| `POST` | `/api/index` | `Bearer <Token>` | Neues Dokument dynamisch indizieren |

### Beispiel: Suche via `curl`
```bash
curl "http://127.0.0.1:8080/api/search?q=docker"
```

Antwort:
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
      "snippet": "Radikal schlanke Portainer-Alternative in Go und Astro...",
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

## 📜 Lizenz & Autor

Dieses Projekt ist freie Open-Source-Software und lizenziert unter der **GNU General Public License, Version 3 (GPL-3.0)**.

- **Autor**: Jeremy Benz ([@benzjeremy](https://github.com/benzjeremy))
- **Website & Ökosystem**: [benzjeremy.github.io](https://benzjeremy.github.io/)
