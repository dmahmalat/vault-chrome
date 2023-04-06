build:
	@rm -f vaultpass.crx
	@openssl genrsa 768 | openssl pkcs8 -topk8 -nocrypt -out key.pem
	@sh package.sh . key.pem
	@rm -f key.pem