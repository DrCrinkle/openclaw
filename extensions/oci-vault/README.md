# OCI Vault SecretRefs

This bundled plugin resolves OpenClaw SecretRefs from Oracle Cloud Infrastructure Vault using the OCI CLI. It supports the OCI CLI authentication modes `instance_principal`, `resource_principal`, `security_token`, `delegation_token`, `oke_workload_identity`, and `api_key`.

Enable it with `openclaw plugins enable oci-vault`, then generate a plan:

```bash
openclaw oci-vault setup \
  --plan-out ./oci-vault-secrets-plan.json \
  --target models.providers.openai.apiKey=ocid1.secret.oc1... 
openclaw secrets apply --from ./oci-vault-secrets-plan.json --dry-run --allow-exec
openclaw secrets apply --from ./oci-vault-secrets-plan.json --allow-exec
```

Secret IDs are OCI secret OCIDs. To select a string from JSON stored in the secret, append `#field.path`. Secret payloads are decoded from OCI's base64 secret-bundle content. The OCI CLI and its authentication configuration must be available to the Gateway service; no credential is written to `openclaw.json`.

Set `OPENCLAW_OCI_AUTH=instance_principal` for this common server setup. `OPENCLAW_OCI_CLI_PATH`, `OCI_CLI_CONFIG_FILE`, `OCI_CLI_PROFILE`, `OCI_CLI_REGION`, and `OPENCLAW_OCI_SECRET_STAGE` are also supported.
