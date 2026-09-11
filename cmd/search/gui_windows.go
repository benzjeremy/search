//go:build windows

package main

import (
	"os/exec"
)

func runNativeGUI(url string, title string) error {
	// Try Edge app mode
	cmd := exec.Command("cmd", "/c", "start", "msedge", "--app="+url)
	if err := cmd.Start(); err == nil {
		return nil
	}

	// Try Chrome app mode
	cmdChrome := exec.Command("cmd", "/c", "start", "chrome", "--app="+url)
	if err := cmdChrome.Start(); err == nil {
		return nil
	}

	// Fallback to default browser
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
}
