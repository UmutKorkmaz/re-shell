package main

import (
	"fmt"

	"github.com/acme/gateway/client"
)

func main() {
	fmt.Println(client.Ping())
}
