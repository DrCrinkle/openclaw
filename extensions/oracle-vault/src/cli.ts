import path from "node:path";
import { fileURLToPath } from "node:url";
import type { OpenClawConfig } from "openclaw/plugin-sdk/plugin-entry";
import { createPluginSecretRefSetupCli } from "openclaw/plugin-sdk/secret-ref-runtime";
import { pathExists } from "openclaw/plugin-sdk/security-runtime";
import { normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import { resolvePreferredOpenClawTmpDir } from "openclaw/plugin-sdk/temp-path";
import { parseOracleVaultSecretId } from "../oracle-vault-secret-id.js";

const PROVIDER_ALIAS = "oracle-vault";
const setupCli = createPluginSecretRefSetupCli({
  productName: "Oracle Vault",
  secretIdLabel: "OCI secret OCID",
  secretIdPlaceholder: "ocid1.secret.oc1...",
  defaultProviderAlias: PROVIDER_ALIAS,
  pluginIntegration: { pluginId: "oracle-vault", integrationId: "oracle-vault" },
  normalizeSecretId(value: string) {
    parseOracleVaultSecretId(value);
    return value;
  },
  defaultPlanPath: () => path.join(resolvePreferredOpenClawTmpDir(), `openclaw-oracle-vault-${process.pid}.json`),
});

type CommandLike = Parameters<typeof setupCli.registerSetupCommand>[0];

async function resolverPath(): Promise<string> {
  const candidates = [
    fileURLToPath(new URL("../oracle-vault-secret-ref-resolver.js", import.meta.url)),
    fileURLToPath(new URL("./extensions/oracle-vault/oracle-vault-secret-ref-resolver.js", import.meta.url)),
  ];
  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

export function registerOracleVaultCommands(params: { program: CommandLike; config: OpenClawConfig }): void {
  const command = params.program.command("oracle-vault").description("Manage Oracle Vault SecretRefs");
  command.command("status")
    .description("Show Oracle Vault provider status without printing credentials")
    .option("--json", "Print JSON status")
    .action(async (options: { json?: boolean }) => {
      const inspected = setupCli.inspectProvider(params.config);
      const result = {
        providerAlias: PROVIDER_ALIAS,
        provider: inspected.provider,
        resolverScript: await resolverPath(),
        auth: normalizeOptionalString(process.env.OPENCLAW_OCI_AUTH) ?? "instance_principal",
        cli: normalizeOptionalString(process.env.OPENCLAW_OCI_CLI_PATH) ?? "oci",
        region: normalizeOptionalString(process.env.OCI_CLI_REGION),
        profile: normalizeOptionalString(process.env.OCI_CLI_PROFILE),
        configFile: Boolean(normalizeOptionalString(process.env.OCI_CLI_CONFIG_FILE)),
      };
      process.stdout.write(options.json ? `${JSON.stringify(result, null, 2)}\n` :
        `Oracle Vault provider: ${inspected.provider.configured ? "configured" : "not configured"}\n` +
        `Auth: ${result.auth}\nOCI CLI: ${result.cli}\nResolver: ${result.resolverScript}\n`);
    });
  setupCli.registerSetupCommand(command);
}
