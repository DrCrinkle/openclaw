const OCID_PATTERN = /^ocid1\.secret\.oc[0-9a-z.-]+\.[A-Za-z0-9._:/+-]+(?:#[A-Za-z][A-Za-z0-9_.-]*)?$/;

export function parseOracleVaultSecretId(id) {
  if (typeof id !== "string" || !OCID_PATTERN.test(id)) {
    throw new Error(`Oracle Vault SecretRef id must be an OCI secret OCID, optionally followed by #json.path.`);
  }
  const [secretId, ...selectorParts] = id.split("#");
  return { secretId, selector: selectorParts.join("#") || undefined };
}
