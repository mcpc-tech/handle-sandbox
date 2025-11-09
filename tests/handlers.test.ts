/**
 * Custom handlers tests
 */

import { assertEquals } from "@std/assert";
import { Sandbox } from "../mod.ts";

Deno.test({
  name: "call custom handler",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sandbox = new Sandbox();

    sandbox.registerHandler("double", async (n: unknown) => {
      return (n as number) * 2;
    });

    sandbox.start();

    const result = await sandbox.execute(`return await double(21)`);

    assertEquals(result.result, 42);

    sandbox.stop();
  },
});

Deno.test({
  name: "multiple handlers",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sandbox = new Sandbox();

    sandbox.registerHandler("add", async (a: unknown, b: unknown) => {
      return (a as number) + (b as number);
    });

    sandbox.registerHandler("mul", async (a: unknown, b: unknown) => {
      return (a as number) * (b as number);
    });

    sandbox.start();

    const result = await sandbox.execute(`
    const sum = await add(2, 3);
    const prod = await mul(4, 5);
    return { sum, prod };
  `);

    assertEquals(result.result, { sum: 5, prod: 20 });

    sandbox.stop();
  },
});
