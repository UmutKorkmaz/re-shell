// Tiny HTTP service used by scripts/k8s-live-check.sh as the workload under
// test. It needs nothing from its filesystem (so it runs with a read-only root
// filesystem as a non-root user) and serves:
//
//	GET /healthz  -> 200 "ok"   (liveness/readiness probes)
//	GET /         -> "service=<SERVICE_NAME> version=<version>"
//
// The binary is built twice with different link-time variables:
//
//	-X main.version=v1                         a healthy release
//	-X main.version=v2-broken -X main.mode=broken
//	                                           a release that exits at startup
//	                                           (CrashLoopBackOff), standing in
//	                                           for a bad deploy to roll back from.
package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

var (
	mode    = "ok"
	version = "v1"
)

func main() {
	if mode == "broken" {
		log.Fatalf("release %s is broken: refusing to start", version)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprintln(w, "ok")
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, _ *http.Request) {
		fmt.Fprintf(w, "service=%s version=%s\n", os.Getenv("SERVICE_NAME"), version)
	})

	srv := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("serving %s on :%s", version, port)
	log.Fatal(srv.ListenAndServe())
}
