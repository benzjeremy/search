//go:build !windows && (!linux || !cgo)

package main

import (
	"fmt"
	"os/exec"
)

func runNativeGUI(url string, title string) error {
	// Try xdg-open for non-CGO Linux, or open on macOS
	cmd := exec.Command("xdg-open", url)
	if err := cmd.Start(); err == nil {
		return nil
	}
	cmdOpen := exec.Command("open", url)
	if err := cmdOpen.Start(); err == nil {
		return nil
	}
	return fmt.Errorf("no GUI desktop environment supported in standalone stub")
}
