package engine

import (
	"strings"
	"unicode"
)

// Stopwords for German and English
var defaultStopwords = map[string]struct{}{
	// German
	"aber": {}, "als": {}, "am": {}, "an": {}, "auch": {}, "auf": {}, "aus": {}, "bei": {},
	"bin": {}, "bis": {}, "bist": {}, "da": {}, "damit": {}, "dann": {}, "das": {}, "dass": {},
	"dein": {}, "deine": {}, "dem": {}, "den": {}, "der": {}, "des": {}, "die": {}, "dies": {},
	"diese": {}, "dieser": {}, "doch": {}, "dort": {}, "du": {}, "durch": {}, "ein": {},
	"eine": {}, "einem": {}, "einen": {}, "einer": {}, "eines": {}, "er": {}, "es": {},
	"für": {}, "hat": {}, "hatte": {}, "hier": {}, "ich": {}, "ihr": {}, "ihre": {}, "im": {},
	"in": {}, "ist": {}, "ja": {}, "jede": {}, "jedem": {}, "jeder": {}, "kann": {}, "können": {},
	"man": {}, "mit": {}, "nach": {}, "nicht": {}, "noch": {}, "nun": {}, "nur": {}, "oder": {},
	"sehr": {}, "sein": {}, "seine": {}, "sich": {}, "sie": {}, "sind": {}, "so": {}, "über": {},
	"um": {}, "und": {}, "uns": {}, "von": {}, "vor": {}, "war": {}, "was": {}, "weiter": {},
	"wie": {}, "wieder": {}, "will": {}, "wir": {}, "wird": {}, "wo": {}, "zu": {}, "zum": {}, "zur": {},

	// English (deduplicated against German: am, an, in, so, was already present)
	"a": {}, "about": {}, "above": {}, "after": {}, "again": {}, "against": {}, "all": {},
	"and": {}, "any": {}, "are": {}, "as": {}, "at": {}, "be": {},
	"because": {}, "been": {}, "before": {}, "being": {}, "below": {}, "between": {},
	"both": {}, "but": {}, "by": {}, "could": {}, "did": {}, "do": {}, "does": {}, "doing": {},
	"down": {}, "during": {}, "each": {}, "few": {}, "for": {}, "from": {}, "further": {},
	"had": {}, "has": {}, "have": {}, "having": {}, "he": {}, "her": {}, "here": {},
	"hers": {}, "herself": {}, "him": {}, "himself": {}, "his": {}, "how": {}, "i": {},
	"if": {}, "into": {}, "is": {}, "it": {}, "its": {}, "itself": {}, "just": {},
	"me": {}, "more": {}, "most": {}, "my": {}, "myself": {}, "no": {}, "nor": {}, "not": {},
	"of": {}, "off": {}, "on": {}, "once": {}, "only": {}, "or": {}, "other": {}, "our": {},
	"ours": {}, "ourselves": {}, "out": {}, "over": {}, "own": {}, "same": {}, "she": {},
	"should": {}, "some": {}, "such": {}, "than": {}, "that": {}, "the": {},
	"their": {}, "theirs": {}, "them": {}, "themselves": {}, "then": {}, "there": {},
	"these": {}, "they": {}, "this": {}, "those": {}, "through": {}, "to": {}, "too": {},
	"under": {}, "until": {}, "up": {}, "very": {}, "we": {}, "were": {},
	"what": {}, "when": {}, "where": {}, "which": {}, "while": {}, "who": {}, "whom": {},
	"why": {}, "with": {}, "would": {}, "you": {}, "your": {}, "yours": {}, "yourself": {},
}

// Tokenize splits text into clean, lowercased alphanumeric tokens, removing stopwords.
func Tokenize(text string) []string {
	var tokens []string
	var current strings.Builder

	flush := func() {
		if current.Len() > 0 {
			word := strings.ToLower(current.String())
			current.Reset()
			if _, isStop := defaultStopwords[word]; !isStop && len([]rune(word)) > 1 {
				tokens = append(tokens, word)
			}
		}
	}

	for _, r := range text {
		if unicode.IsLetter(r) || unicode.IsDigit(r) {
			current.WriteRune(r)
		} else if r == '-' || r == '_' {
			// Keep hyphens/underscores if flanked by letters/digits, e.g. untis-go, aes-256
			current.WriteRune(r)
		} else {
			flush()
		}
	}
	flush()

	return tokens
}

// LevenshteinDistance calculates edit distance between two strings.
func LevenshteinDistance(s1, s2 string) int {
	r1, r2 := []rune(s1), []rune(s2)
	n, m := len(r1), len(r2)

	if n == 0 {
		return m
	}
	if m == 0 {
		return n
	}

	dp := make([][]int, n+1)
	for i := range dp {
		dp[i] = make([]int, m+1)
		dp[i][0] = i
	}
	for j := 0; j <= m; j++ {
		dp[0][j] = j
	}

	for i := 1; i <= n; i++ {
		for j := 1; j <= m; j++ {
			cost := 0
			if r1[i-1] != r2[j-1] {
				cost = 1
			}
			dp[i][j] = min(
				dp[i-1][j]+1,      // deletion
				dp[i][j-1]+1,      // insertion
				dp[i-1][j-1]+cost, // substitution
			)
		}
	}

	return dp[n][m]
}

func min(a, b, c int) int {
	if a <= b && a <= c {
		return a
	}
	if b <= a && b <= c {
		return b
	}
	return c
}
