/**
 * Runtime resolution tests
 */

import { assertEquals } from "@std/assert";
import { fileURLToPath } from "node:url";
import { Sandbox } from "../mod.ts";

const sandboxModuleUrl = new URL("../mod.ts", import.meta.url).href;
const runtimeFileUrl = new URL("../runtime/runtime.ts", import.meta.url);
const runtimeFilePath = fileURLToPath(runtimeFileUrl);
const decoder = new TextDecoder();

type SandboxWithRuntimePath = {
  getRuntimePath(): string;
};

async function resolveRuntimeWithImportMap(
  imports: Record<string, string>,
): Promise<string> {
  const tempDir = await Deno.makeTempDir({
    dir: Deno.cwd(),
    prefix: ".runtime-resolution-",
  });

  try {
    const importMapPath = `${tempDir}/import-map.json`;
    await Deno.writeTextFile(importMapPath, JSON.stringify({ imports }));

    const script = `
      import { Sandbox } from ${JSON.stringify(sandboxModuleUrl)};
      const sandbox = new Sandbox() as unknown as { getRuntimePath(): string };
      console.log(sandbox.getRuntimePath());
    `;

    const result = await new Deno.Command(Deno.execPath(), {
      cwd: Deno.cwd(),
      args: ["eval", `--import-map=${importMapPath}`, script],
      stdout: "piped",
      stderr: "piped",
    }).output();

    const stderr = decoder.decode(result.stderr).trim();
    if (!result.success) {
      throw new Error(stderr || `Subprocess exited with code ${result.code}`);
    }

    return decoder.decode(result.stdout).trim();
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
}

Deno.test("getRuntimePath resolves local runtime file by default", () => {
  const sandbox = new Sandbox() as unknown as SandboxWithRuntimePath;

  assertEquals(sandbox.getRuntimePath(), runtimeFilePath);
});

Deno.test("getRuntimePath preserves jsr specifiers returned by resolver", async () => {
  const runtimePath = await resolveRuntimeWithImportMap({
    "@mcpc/handle-sandbox/runtime": "jsr:@std/assert@^1.0.0",
  });

  assertEquals(runtimePath, "jsr:@std/assert@^1.0.0");
});

Deno.test("getRuntimePath falls back to npm package export name", async () => {
  const runtimePath = await resolveRuntimeWithImportMap({
    "@mcpc-tech/handle-sandbox/runtime": runtimeFileUrl.href,
  });

  assertEquals(runtimePath, runtimeFilePath);
});
