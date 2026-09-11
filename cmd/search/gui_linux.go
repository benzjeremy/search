//go:build linux && cgo

package main

/*
#cgo pkg-config: webkit2gtk-4.1 gtk+-3.0
#include <stdlib.h>
#include <gtk/gtk.h>
#include <webkit2/webkit2.h>

static int check_display() {
    int argc = 0;
    char **argv = NULL;
    return gtk_init_check(&argc, &argv) ? 1 : 0;
}

static void on_window_destroy(GtkWidget *widget, gpointer data) {
    gtk_main_quit();
}

static gboolean on_key_press(GtkWidget *widget, GdkEventKey *event, gpointer data) {
    if (event->keyval == GDK_KEY_Escape) {
        gtk_widget_destroy(widget);
        return TRUE;
    }
    return FALSE;
}

static gboolean on_context_menu(WebKitWebView *web_view, WebKitContextMenu *context_menu, GdkEvent *event, WebKitHitTestResult *hit_test_result, gpointer user_data) {
    return TRUE; // Suppress default browser context menu
}

static void create_and_run_gtk_window(const char *url, const char *title) {
    GtkWidget *window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    gtk_window_set_title(GTK_WINDOW(window), title);
    gtk_window_set_default_size(GTK_WINDOW(window), 1024, 720);
    gtk_window_set_position(GTK_WINDOW(window), GTK_WIN_POS_CENTER);

    g_signal_connect(window, "destroy", G_CALLBACK(on_window_destroy), NULL);
    g_signal_connect(window, "key-press-event", G_CALLBACK(on_key_press), NULL);

    WebKitWebView *web_view = WEBKIT_WEB_VIEW(webkit_web_view_new());
    WebKitSettings *settings = webkit_web_view_get_settings(web_view);
    webkit_settings_set_enable_developer_extras(settings, FALSE);
    webkit_settings_set_hardware_acceleration_policy(settings, WEBKIT_HARDWARE_ACCELERATION_POLICY_ALWAYS);

    g_signal_connect(web_view, "context-menu", G_CALLBACK(on_context_menu), NULL);

    gtk_container_add(GTK_CONTAINER(window), GTK_WIDGET(web_view));
    webkit_web_view_load_uri(web_view, url);

    gtk_widget_show_all(window);
    gtk_main();
}
*/
import "C"
import (
	"fmt"
	"unsafe"
)

func runNativeGUI(url string, title string) error {
	if C.check_display() == 0 {
		return fmt.Errorf("no X11 or Wayland DISPLAY found; falling back to headless daemon mode")
	}

	cURL := C.CString(url)
	defer C.free(unsafe.Pointer(cURL))
	cTitle := C.CString(title)
	defer C.free(unsafe.Pointer(cTitle))

	C.create_and_run_gtk_window(cURL, cTitle)
	return nil
}
