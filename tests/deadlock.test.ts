/**
 * Test for deadlock issue when calling handlers multiple times
 */

import { assertEquals } from "@std/assert";
import { Sandbox } from "../mod.ts";

Deno.test({
  name: "no deadlock when second execution starts before first finishes",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sandbox = new Sandbox();

    sandbox.registerHandler("slowDouble", async (n: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return (n as number) * 2;
    });

    sandbox.start();

    // Start first execution (takes 200ms)
    const promise1 = sandbox.execute("return await slowDouble(5)");

    // Start second execution immediately, before first finishes
    const promise2 = sandbox.execute("return await slowDouble(10)");

    // Wait for both to complete
    const [result1, result2] = await Promise.all([promise1, promise2]);

    assertEquals(result1.result, 10);
    assertEquals(result2.result, 20);

    sandbox.stop();
  },
});
