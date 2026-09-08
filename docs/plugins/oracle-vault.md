---
summary: "Use Oracle Cloud Infrastructure Vault for OpenClaw SecretRefs"
read_when:
  - You want OpenClaw credentials stored in OCI Vault
  - The Gateway runs on OCI and can use instance principals
title: "Oracle Vault SecretRefs"
---

# Oracle Vault SecretRefs

The bundled `oracle-vault` plugin resolves SecretRefs from Oracle Cloud Infrastructure Vault through the OCI CLI. It keeps the resolved value in OpenClaw's runtime snapshot and leaves only the SecretRef in configuration.

Enable the plugin and inspect its non-secret status:

```bash
openclaw plugins enable oracle-vault
openclaw oracle-vault status
```

On OCI compute, instance principals avoid storing a user token:

```bash
export OPENCLAW_OCI_AUTH=instance_principal
```

The plugin also accepts OCI CLI authentication modes such as `resource_principal`, `security_token`, `delegation_token`, `oke_workload_identity`, and `api_key`. The service environment must contain the corresponding OCI CLI configuration. Set `OCI_CLI_CONFIG_FILE`, `OCI_CLI_PROFILE`, `OCI_CLI_REGION`, or `OPENCLAW_OCI_CLI_PATH` when the defaults do not apply.

Create and apply a SecretRef plan:

```bash
openclaw oracle-vault setup \
  --plan-out ./oracle-vault-secrets-plan.json \
  --target models.providers.openai.apiKey=ocid1.secret.oc1... \
openclaw secrets apply --from ./oracle-vault-secrets-plan.json --dry-run --allow-exec
openclaw secrets apply --from ./oracle-vault-secrets-plan.json --allow-exec
openclaw secrets audit --check --allow-exec
```

Secret IDs are OCI secret OCIDs. If the decoded secret is JSON, append `#field.path` to select a string field. OCI Vault's secret-bundle content is base64-decoded by the resolver. Errors include the secret OCID but never the returned secret value.
