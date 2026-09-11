package web

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed index.html style.css app.js favicon.svg database.json
var content embed.FS

// Handler returns an http.Handler serving the embedded static web assets.
func Handler() http.Handler {
	sub, err := fs.Sub(content, ".")
	if err != nil {
		return http.FileServer(http.FS(content))
	}
	return http.FileServer(http.FS(sub))
}
