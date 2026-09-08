import { definePluginEntry, type OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-entry";

export default definePluginEntry({
  id: "oci-vault",
  name: "OCI Vault",
  description: "Oracle Cloud Infrastructure Vault SecretRef provider integration.",
  register(api: OpenClawPluginApi) {
    api.registerCli(async ({ program, config }) => {
      const { registerOciVaultCommands } = await import("./src/cli.js");
      registerOciVaultCommands({ program, config });
    }, { descriptors: [{ name: "oci-vault", description: "Manage OCI Vault SecretRefs", hasSubcommands: true }] });
  },
});
