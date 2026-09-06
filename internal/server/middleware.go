package server

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"net"
	"net/http"
	"strings"
)

// GenerateSecureToken generates a cryptographically secure 256-bit token.
func GenerateSecureToken() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed to generate secure entropy: " + err.Error())
	}
	return hex.EncodeToString(b)
}

// isHostAllowed checks if the incoming Host header matches localhost or 127.0.0.1.
// Strictly prevents DNS Rebinding attacks.
func isHostAllowed(hostHeader string) bool {
	host, _, err := net.SplitHostPort(hostHeader)
	if err != nil {
		host = hostHeader // Port was omitted
	}

	host = strings.Trim(host, "[]")
	if host == "localhost" || host == "127.0.0.1" || host == "::1" {
		return true
	}

	return false
}

// RebindingProtectionMiddleware blocks malicious Host headers from external domains.
func (s *Server) RebindingProtectionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !isHostAllowed(r.Host) {
			http.Error(w, `{"error":"Forbidden: DNS Rebinding Protection blocked invalid Host header"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// SecurityHeadersMiddleware attaches standard security headers to every response.
func SecurityHeadersMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-XSS-Protection", "1; mode=block")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';")
		next.ServeHTTP(w, r)
	})
}

// TokenAuthMiddleware verifies the Bearer token using constant-time comparison.
func (s *Server) TokenAuthMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, `{"error":"Unauthorized: Missing or malformed Bearer token"}`, http.StatusUnauthorized)
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if subtle.ConstantTimeCompare([]byte(token), []byte(s.apiToken)) != 1 {
			http.Error(w, `{"error":"Unauthorized: Invalid API token"}`, http.StatusUnauthorized)
			return
		}

		next(w, r)
	}
}
