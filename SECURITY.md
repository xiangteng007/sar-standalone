# Security and privacy

Use synthetic data only while this pilot remains unvalidated for live operations. Never submit credentials, cookies, private keys, subject allowlists, real case details, photos or location history in public issues or pull requests.

There is no dedicated vulnerability reporting contact established yet. Do not publish exploit details or secrets in a public issue. Use a private GitHub vulnerability report only if the repository explicitly offers that feature; otherwise request a private reporting channel without including sensitive details.

An accidentally committed secret must be revoked at its provider. Deleting a file or rewriting Git history alone does not revoke it. Do not merge private repository history into this public source export.

The runtime verifies Google ID tokens and checks an explicit subject allowlist. Test verifier injection is used only by local test code and is not exposed through any HTTP route or environment bypass flag. Each deployment still requires real identity, transport, host-permission and device acceptance testing.
