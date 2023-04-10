.DEFAULT_GOAL:=help

##@ Help
.PHONY: help
help: ## Display this help screen
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Build CRX
.PHONY: build
build: ## Package the application to a Chrome Extension file (.crx)
	@rm -f vaultpass.crx
	@openssl genrsa 768 | openssl pkcs8 -topk8 -nocrypt -out key.pem
	@sh package.sh . key.pem
	@rm -f key.pem