#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  ConfigFileAuthenticationDetailsProvider,
  InstancePrincipalsAuthenticationDetailsProviderBuilder,
} from "oci-common";
import { SecretsClient } from "oci-secrets";
import { parseOciVaultSecretId } from "./oci-vault-secret-id.js";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_CONCURRENCY = 8;
const envString = (name) => process.env[name]?.trim() || undefined;
const timeoutMs = () => {
  const value = Number(envString("OPENCLAW_OCI_TIMEOUT_MS") || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 120000) : DEFAULT_TIMEOUT_MS;
};

function selectorValue(value, selector) {
  if (!selector) {
    return value;
  }
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`OCI secret content is not JSON; cannot select #${selector}.`);
  }
  for (const part of selector.split(".")) {
    if (!part || parsed === null || typeof parsed !== "object" || !(part in parsed)) {
      throw new Error(`OCI secret JSON does not contain field #${selector}.`);
    }
    parsed = parsed[part];
  }
  if (typeof parsed !== "string") {
    throw new Error(`OCI secret field #${selector} must be a string.`);
  }
  return parsed;
}

function authMode() {
  return envString("OPENCLAW_OCI_AUTH") || "instance_principal";
}

async function createSdkClient() {
  const mode = authMode();
  if (!["instance_principal", "api_key"].includes(mode)) {
    throw new Error(
      `Native OCI SDK supports instance_principal or api_key; use OPENCLAW_OCI_BACKEND=cli for other OCI CLI auth modes.`,
    );
  }
  const provider =
    mode === "instance_principal"
      ? await InstancePrincipalsAuthenticationDetailsProviderBuilder.builder().build()
      : new ConfigFileAuthenticationDetailsProvider(
          envString("OCI_CLI_CONFIG_FILE"),
          envString("OCI_CLI_PROFILE"),
        );
  const client = new SecretsClient({ authenticationDetailsProvider: provider });
  const region = envString("OCI_CLI_REGION");
  if (region) {
    client.regionId = region;
  }
  return client;
}

async function readSecretSdk(client, id) {
  const { secretId, selector } = parseOciVaultSecretId(id);
  const response = await client.getSecretBundle({
    secretId,
    stage: envString("OPENCLAW_OCI_SECRET_STAGE") || "CURRENT",
  });
  const encoded = response.secretBundle?.secretBundleContent?.content;
  if (typeof encoded !== "string" || !encoded) {
    throw new Error("OCI returned an empty secret bundle.");
  }
  return selectorValue(Buffer.from(encoded, "base64").toString("utf8"), selector);
}

async function readSecretCli(id) {
  const { secretId, selector } = parseOciVaultSecretId(id);
  const auth = authMode();
  const allowed = new Set([
    "api_key",
    "instance_principal",
    "resource_principal",
    "security_token",
    "delegation_token",
    "oke_workload_identity",
  ]);
  if (!allowed.has(auth)) {
    throw new Error(`OPENCLAW_OCI_AUTH is not a supported OCI CLI auth mode: ${auth}.`);
  }
  const args = [
    "secrets",
    "secret-bundle",
    "get",
    "--secret-id",
    secretId,
    "--stage",
    envString("OPENCLAW_OCI_SECRET_STAGE") || "CURRENT",
    "--auth",
    auth,
    "--query",
    'data."secret-bundle-content".content',
    "--raw-output",
  ];
  const { stdout } = await execFileAsync(envString("OPENCLAW_OCI_CLI_PATH") || "oci", args, {
    env: process.env,
    timeout: timeoutMs(),
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
  });
  const encoded = stdout.trim();
  if (!encoded) {
    throw new Error("OCI returned an empty secret bundle.");
  }
  return selectorValue(Buffer.from(encoded, "base64").toString("utf8"), selector);
}

async function mapWithLimit(items, limit, fn) {
  const output = Array.from({ length: items.length });
  let next = 0;
  async function worker() {
    while (true) {
      const index = next++;
      if (index >= items.length) {
        return;
      }
      output[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function safeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replaceAll(/\bocid1\.[^\s,;]+/gu, "[secret-ocid]").slice(0, 240);
}

async function main() {
  const request = JSON.parse(
    await new Promise((resolve, reject) => {
      let input = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => {
        input += String(chunk);
      });
      process.stdin.on("error", reject);
      process.stdin.on("end", () => resolve(input));
    }),
  );
  if (!request || !Array.isArray(request.ids)) {
    throw new Error("invalid exec SecretRef request");
  }
  const result = { protocolVersion: 1, values: {}, errors: {} };
  const ids = request.ids.filter((id) => typeof id === "string" && id);
  const useCli = (envString("OPENCLAW_OCI_BACKEND") || "sdk") === "cli";
  const client = useCli ? undefined : await createSdkClient();
  await mapWithLimit(ids, MAX_CONCURRENCY, async (id) => {
    try {
      result.values[id] = useCli ? await readSecretCli(id) : await readSecretSdk(client, id);
    } catch (error) {
      result.errors[id] = { message: safeError(error) };
    }
  });
  client?.close?.();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.exitCode = 1;
  process.stdout.write(
    `${JSON.stringify({ protocolVersion: 1, values: {}, errors: { request: { message: safeError(error) } } })}\n`,
  );
});
