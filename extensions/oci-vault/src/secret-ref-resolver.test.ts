import { spawn } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const resolverPath = fileURLToPath(new URL("../oci-vault-secret-ref-resolver.js", import.meta.url));
const tempPaths: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempPaths.splice(0).map((target) => rm(target, { force: true, recursive: true })),
  );
});

describe("OCI Vault SecretRef resolver", () => {
  it("decodes OCI base64 content and selects JSON fields without exposing the value to config", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "openclaw-oci-vault-test-"));
    tempPaths.push(dir);
    const fakeOci = path.join(dir, "oci");
    await writeFile(
      fakeOci,
      `#!/usr/bin/env node\nprocess.stdout.write(Buffer.from(JSON.stringify({apiKey: "fixture-secret"})).toString("base64"));\n`,
    );
    await chmod(fakeOci, 0o700);
    const result = await new Promise<{ code: number | null; stdout: string }>((resolve, reject) => {
      const child = spawn(process.execPath, [resolverPath], {
        env: {
          ...process.env,
          OPENCLAW_OCI_BACKEND: "cli",
          OPENCLAW_OCI_CLI_PATH: fakeOci,
          OPENCLAW_OCI_AUTH: "instance_principal",
        },
        stdio: ["pipe", "pipe", "ignore"],
      });
      let stdout = "";
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += String(chunk);
      });
      child.once("error", reject);
      child.once("close", (code) => resolve({ code, stdout }));
      child.stdin.end(JSON.stringify({ ids: ["ocid1.secret.oc1.phx.fixture#apiKey"] }));
    });
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout).values).toEqual({
      "ocid1.secret.oc1.phx.fixture#apiKey": "fixture-secret",
    });
  });
});
