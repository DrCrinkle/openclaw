import { definePluginEntry, type OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "oracle-vault",
  name: "Oracle Vault",
  description: "Oracle Cloud Infrastructure Vault SecretRef provider integration.",
  register(api: OpenClawPluginApi) {
    api.registerCli(async ({ program, config }) => {
      const { registerOracleVaultCommands } = await import("./src/cli.js");
      registerOracleVaultCommands({ program, config });
    }, { descriptors: [{ name: "oracle-vault", description: "Manage Oracle Vault SecretRefs", hasSubcommands: true }] });
  },
});
