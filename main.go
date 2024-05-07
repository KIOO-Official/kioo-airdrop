package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
)

//go:embed spa
var spa embed.FS

func main() {
	root, _ := fs.Sub(spa, "spa")
	http.Handle("/", http.FileServer(http.FS(root)))
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	addr := fmt.Sprintf(":%s", port)
	fmt.Println("Application is running on port", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
