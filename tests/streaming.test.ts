/**
 * Streaming log / stderr integration tests
 */

import { assert, assertEquals } from "@std/assert";
import { Sandbox } from "../mod.ts";

Deno.test({
  name: "streaming: onLog receives logs in order before execute resolves",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const received: string[] = [];

    const sandbox = new Sandbox({
      onLog: (text) => received.push(text),
    });
    sandbox.start();

    const result = await sandbox.execute(`
      console.log("first");
      console.log("second");
      console.log("third");
      return "done";
    `);

    assertEquals(received, ["first", "second", "third"]);
    assertEquals(result.logs, ["first", "second", "third"]);
    assertEquals(result.result, "done");

    sandbox.stop();
  },
});

Deno.test({
  name: "streaming: onLog level is passed correctly",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const received: { text: string; level: string }[] = [];

    const sandbox = new Sandbox({
      onLog: (text, level) => received.push({ text, level }),
    });
    sandbox.start();

    await sandbox.execute(`
      console.log("a log");
      console.warn("a warn");
      console.error("an error");
      console.info("an info");
    `);

    assertEquals(received, [
      { text: "a log", level: "log" },
      { text: "a warn", level: "warn" },
      { text: "an error", level: "error" },
      { text: "an info", level: "info" },
    ]);

    sandbox.stop();
  },
});

Deno.test({
  name:
    "streaming: onLog fires before execute resolves (interleaved with handler)",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const order: string[] = [];

    const sandbox = new Sandbox({
      onLog: (text) => order.push(`log:${text}`),
    });

    sandbox.registerHandler("ping", () => {
      order.push("handler:ping");
      return Promise.resolve("pong");
    });

    sandbox.start();

    const result = await sandbox.execute(`
      console.log("before");
      const r = await ping();
      console.log("after:" + r);
      return r;
    `);

    assertEquals(order, ["log:before", "handler:ping", "log:after:pong"]);
    assertEquals(result.result, "pong");

    sandbox.stop();
  },
});

Deno.test({
  name: "streaming: onStderr receives sandbox stderr output",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const stderrChunks: string[] = [];

    const sandbox = new Sandbox({
      onStderr: (text) => stderrChunks.push(text),
    });
    sandbox.start();

    const result = await sandbox.execute(`
      await Deno.stderr.write(new TextEncoder().encode("sandbox-stderr\\n"));
      return 1;
    `);

    await new Promise((resolve) => setTimeout(resolve, 20));

    assertEquals(result.result, 1);
    assert(stderrChunks.join("").includes("sandbox-stderr"));

    sandbox.stop();
  },
});

Deno.test({
  name: "streaming: cwd option is passed to sandbox process",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const tmpDir = Deno.makeTempDirSync();

    const sandbox = new Sandbox({ cwd: tmpDir });
    sandbox.start();

    // Deno.cwd() inside sandbox should match tmpDir
    const result = await sandbox.execute(`return Deno.cwd()`);

    // Resolve symlinks for comparison (macOS /tmp → /private/tmp)
    const resolvedTmp = await Deno.realPath(tmpDir);
    const resolvedResult = await Deno.realPath(result.result as string);

    assertEquals(resolvedResult, resolvedTmp);

    sandbox.stop();
    await Deno.remove(tmpDir, { recursive: true });
  },
});

Deno.test({
  name: "streaming: env option is passed to sandbox process",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sandbox = new Sandbox({
      env: { ...Deno.env.toObject(), MY_TEST_VAR: "hello_sandbox" },
      permissions: ["--allow-env=MY_TEST_VAR"],
    });
    sandbox.start();

    const result = await sandbox.execute(`return Deno.env.get("MY_TEST_VAR")`);

    assertEquals(result.result, "hello_sandbox");

    sandbox.stop();
  },
});

Deno.test({
  name: "streaming: multiple executions each get independent log streams",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const exec1Logs: string[] = [];
    const exec2Logs: string[] = [];

    // Two separate sandbox instances
    const s1 = new Sandbox({ onLog: (t) => exec1Logs.push(t) });
    const s2 = new Sandbox({ onLog: (t) => exec2Logs.push(t) });

    s1.start();
    s2.start();

    await Promise.all([
      s1.execute(`console.log("from-s1")`),
      s2.execute(`console.log("from-s2")`),
    ]);

    assertEquals(exec1Logs, ["from-s1"]);
    assertEquals(exec2Logs, ["from-s2"]);

    s1.stop();
    s2.stop();
  },
});

Deno.test({
  name: "compat: execute logs preserve legacy level prefixes",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const sandbox = new Sandbox();
    sandbox.start();

    const result = await sandbox.execute(`
      console.log("plain");
      console.warn("warned");
      console.error("errored");
      console.info("infoed");
    `);

    assertEquals(result.logs, [
      "plain",
      "WARN: warned",
      "ERROR: errored",
      "INFO: infoed",
    ]);

    sandbox.stop();
  },
});

Deno.test({
  name:
    "streaming: high-volume onLog is complete and ordered before execute resolves",
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const received: string[] = [];
    const sandbox = new Sandbox({
      onLog: (text) => received.push(text),
    });
    sandbox.start();

    const total = 500;
    const result = await sandbox.execute(`
      for (let i = 0; i < ${total}; i++) {
        console.log("line-" + i);
      }
      return ${total};
    `);

    assertEquals(result.result, total);
    assertEquals(
      received,
      Array.from({ length: total }, (_, i) => `line-${i}`),
    );

    sandbox.stop();
  },
});
