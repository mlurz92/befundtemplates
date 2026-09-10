#!/usr/bin/env python3
"""Startet die Anwendung auf http://localhost:8000 und oeffnet den Browser."""
import http.server, socketserver, os, sys, threading, webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "app"))

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
    def log_message(self, *a):
        pass

with socketserver.TCPServer(("127.0.0.1", PORT), H) as httpd:
    url = "http://localhost:%d/" % PORT
    print("Befundatlas laeuft auf " + url + "   (Beenden mit Strg+C)")
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nBeendet.")
