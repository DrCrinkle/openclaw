#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseOciVaultSecretId } from "./oci-vault-secret-id.js";

const execFileAsync = promisify(execFile);
const MAX_OUTPUT_BYTES = 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;

function readStdin() {
  return new Promise((resolve, reject) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { input += String(chunk); });
    process.stdin.on("error", reject);
    process.stdin.on("end", () => resolve(input));
  });
}

function authArgs() {
  const auth = (process.env.OPENCLAW_OCI_AUTH?.trim() || "instance_principal");
  const allowed = new Set(["api_key", "instance_principal", "resource_principal", "security_token", "delegation_token", "oke_workload_identity"]);
  if (!allowed.has(auth)) {
    throw new Error(`OPENCLAW_OCI_AUTH must be one of: ${[...allowed].join(", ")}.`);
  }
  return ["--auth", auth];
}

function selectorValue(value, selector) {
  if (!selector) {
    return value;
  }
  let parsed;
  try { parsed = JSON.parse(value); } catch { throw new Error(`OCI secret content is not JSON; cannot select #${selector}.`); }
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

async function readSecret(id) {
  const { secretId, selector } = parseOciVaultSecretId(id);
  const args = [
    "secrets", "secret-bundle", "get",
    "--secret-id", secretId,
    "--stage", process.env.OPENCLAW_OCI_SECRET_STAGE?.trim() || "CURRENT",
    ...authArgs(),
    "--query", "data.\"secret-bundle-content\".content",
    "--raw-output",
  ];
  const command = process.env.OPENCLAW_OCI_CLI_PATH?.trim() || "oci";
  try {
    const { stdout } = await execFileAsync(command, args, {
      env: process.env,
      timeout: Number(process.env.OPENCLAW_OCI_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
      maxBuffer: MAX_OUTPUT_BYTES,
      windowsHide: true,
    });
    const encoded = stdout.trim();
    if (!encoded) {
      throw new Error("OCI returned an empty secret bundle.");
    }
    return selectorValue(Buffer.from(encoded, "base64").toString("utf8"), selector);
  } catch (error) {
    const message = error?.killed ? "OCI Vault request timed out." : error instanceof Error ? error.message : String(error);
    throw new Error(`OCI Vault secret read failed for ${secretId}: ${message.slice(0, 240)}`, { cause: error });
  }
}

async function main() {
  const request = JSON.parse(await readStdin());
  if (!request || !Array.isArray(request.ids)) {
    throw new Error("invalid exec SecretRef request");
  }
  const result = { protocolVersion: 1, values: {}, errors: {} };
  await Promise.all(request.ids.filter((id) => typeof id === "string" && id).map(async (id) => {
    try { result.values[id] = await readSecret(id); }
    catch (error) { result.errors[id] = { message: error instanceof Error ? error.message : String(error) }; }
  }));
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.exitCode = 1;
  process.stdout.write(`${JSON.stringify({ protocolVersion: 1, values: {}, errors: { request: { message: error instanceof Error ? error.message : String(error) } } })}\n`);
});
