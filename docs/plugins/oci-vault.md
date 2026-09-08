---
summary: "Use Oracle Cloud Infrastructure Vault for OpenClaw SecretRefs"
read_when:
  - You want OpenClaw credentials stored in OCI Vault
  - The Gateway runs on OCI and can use instance principals
title: "OCI Vault SecretRefs"
---

# OCI Vault SecretRefs

The bundled `oci-vault` plugin resolves SecretRefs from Oracle Cloud Infrastructure Vault through Oracle's native Node SDK. On OCI Compute, Instance Principal authentication works without installing the OCI CLI. It keeps the resolved value in OpenClaw's runtime snapshot and leaves only the SecretRef in configuration.

Enable the plugin and inspect its non-secret status:

```bash
openclaw plugins enable oci-vault
openclaw oci-vault status
```

On OCI compute, instance principals avoid storing a user token:

```bash
export OPENCLAW_OCI_AUTH=instance_principal
```

For API-key authentication outside OCI Compute, set `OPENCLAW_OCI_AUTH=api_key` and provide `OCI_CLI_CONFIG_FILE` and `OCI_CLI_PROFILE` as needed. Set `OCI_CLI_REGION` when the secret is outside the instance's default region. Set `OPENCLAW_OCI_BACKEND=cli` explicitly if you need OCI CLI authentication modes such as `resource_principal`, `security_token`, `delegation_token`, or `oke_workload_identity`.

Create and apply a SecretRef plan:

```bash
openclaw oci-vault setup \
  --plan-out ./oci-vault-secrets-plan.json \
  --target models.providers.openai.apiKey=ocid1.secret.oc1... \
openclaw secrets apply --from ./oci-vault-secrets-plan.json --dry-run --allow-exec
openclaw secrets apply --from ./oci-vault-secrets-plan.json --allow-exec
openclaw secrets audit --check --allow-exec
```

Secret IDs are OCI secret OCIDs. If the decoded secret is JSON, append `#field.path` to select a string field. OCI Vault's secret-bundle content is base64-decoded by the resolver. Errors include the secret OCID but never the returned secret value.
