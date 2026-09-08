# OCI Vault SecretRefs

This bundled plugin resolves OpenClaw SecretRefs from Oracle Cloud Infrastructure Vault using Oracle's native Node SDK. On OCI Compute, Instance Principal authentication works without installing the OCI CLI. An explicit CLI backend remains available for OCI CLI-only authentication modes.

Enable it with `openclaw plugins enable oci-vault`, then generate a plan:

```bash
openclaw oci-vault setup \
  --plan-out ./oci-vault-secrets-plan.json \
  --target models.providers.openai.apiKey=ocid1.secret.oc1...
openclaw secrets apply --from ./oci-vault-secrets-plan.json --dry-run --allow-exec
openclaw secrets apply --from ./oci-vault-secrets-plan.json --allow-exec
```

Secret IDs are OCI secret OCIDs. To select a string from JSON stored in the secret, append `#field.path`. Secret payloads are decoded from OCI's base64 secret-bundle content. No credential is written to `openclaw.json`.

Set `OPENCLAW_OCI_AUTH=instance_principal` for OCI Compute. For API-key authentication, set `OPENCLAW_OCI_AUTH=api_key` and provide `OCI_CLI_CONFIG_FILE` and `OCI_CLI_PROFILE` as needed. Set `OCI_CLI_REGION` and `OPENCLAW_OCI_SECRET_STAGE` when the defaults do not apply. Set `OPENCLAW_OCI_BACKEND=cli` explicitly to use the OCI CLI backend.
