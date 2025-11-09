/**
 * Basic execution tests
 */

import { assertEquals, assertExists } from "@std/assert";
import { Sandbox } from "../mod.ts";

Deno.test({
  name: "execute simple code",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sandbox = new Sandbox();
    sandbox.start();

    const result = await sandbox.execute("return 1 + 2");

    assertEquals(result.result, 3);
    assertEquals(result.error, undefined);

    sandbox.stop();
  },
});

Deno.test({
  name: "capture console logs",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sandbox = new Sandbox();
    sandbox.start();

    const result = await sandbox.execute(`
    console.log("test");
    return 42;
  `);

    assertEquals(result.logs, ["test"]);
    assertEquals(result.result, 42);

    sandbox.stop();
  },
});

Deno.test({
  name: "handle errors",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sandbox = new Sandbox();
    sandbox.start();

    const result = await sandbox.execute(`throw new Error("test")`);

    assertExists(result.error);

    sandbox.stop();
  },
});
