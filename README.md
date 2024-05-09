# KIOO Airdrop

KIOO's airdrop webapp

## Running Locally

1. Clone the repository

   ```bash
   git clone https://github.com/KIOO-Official/kioo-airdrop.git
   ```

1. Intall the requirements

   - Install Golang: <https://go.dev/doc/install>
   - Install `air` command for live reload

      ```bash
      go install github.com/cosmtrek/air@latest
      ```

1. Start the development server

   Run the app with live reload

   ```bash
   air
   ```

   Run the app

   ```bash
   go run main.go
   ```

   Build the app

   ```bash
   goreleaser release --snapshot --clean
   ```

## Contributing

```txt
(a) Create a git branch
(b) Comment the commit by adding the issue id(#xx)
(c) Push your code
(d) Create a pull request and assign to reviewer
```
