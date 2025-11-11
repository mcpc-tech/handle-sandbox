/**
 * Deno Sandbox Runtime
 *
 * Runs inside Deno sandbox and executes user code.
 * Communicates with host via JSON-RPC over stdin/stdout.
 */

import { JsonRpcMethod, type JsonRpcRequest } from "../src/types.ts";

// Global state
const logs: string[] = [];
const pendingResponses = new Map<
  string | number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();
let messageBuffer = "";

/**
 * Send JSON-RPC request to host and wait for response
 */
async function sendRequest(method: string, params?: unknown): Promise<unknown> {
  const encoder = new TextEncoder();
  const requestId = crypto.randomUUID();

  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: requestId,
    method,
    params,
  }) + "\n";

  await Deno.stdout.write(encoder.encode(request));

  return new Promise((resolve, reject) => {
    pendingResponses.set(requestId, { resolve, reject });
  });
}

/**
 * Format value for logging
 */
function formatValue(value: unknown): string {
  return typeof value === "object" && value !== null
    ? JSON.stringify(value, null, 2)
    : String(value);
}

/**
 * Execute user code in sandbox
 */
async function executeCode(
  code: string,
  handlers: string[],
): Promise<{ logs: string[]; result?: unknown; error?: string }> {
  logs.length = 0;

  // Console that captures output
  const console = {
    log: (...args: unknown[]) => logs.push(args.map(formatValue).join(" ")),
    error: (...args: unknown[]) =>
      logs.push("ERROR: " + args.map(formatValue).join(" ")),
    warn: (...args: unknown[]) =>
      logs.push("WARN: " + args.map(formatValue).join(" ")),
    info: (...args: unknown[]) =>
      logs.push("INFO: " + args.map(formatValue).join(" ")),
  };

  // Create handler functions dynamically
  const handlerFunctions: Record<
    string,
    (...args: unknown[]) => Promise<unknown>
  > = {};
  for (const handlerName of handlers) {
    handlerFunctions[handlerName] = async (...args: unknown[]) => {
      return await sendRequest(JsonRpcMethod.CALL_HANDLER, {
        name: handlerName,
        args,
      });
    };
  }

  try {
    const fn = new Function(
      "console",
      ...handlers,
      `return (async () => { ${code} })();`,
    );
    const result = await fn(console, ...Object.values(handlerFunctions));
    return { logs: [...logs], result };
  } catch (error) {
    return {
      logs: [...logs],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Process incoming message line
 */
function processMessage(line: string) {
  try {
    const message = JSON.parse(line);

    // Check if it's a response to a handler call
    if ("result" in message || "error" in message) {
      const pending = pendingResponses.get(message.id);
      if (pending) {
        pendingResponses.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // It's a request to execute code
    if (message.method === JsonRpcMethod.EXECUTE_CODE) {
      handleExecuteRequest(message);
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      console.error("Error processing message:", error);
    }
  }
}

/**
 * Handle EXECUTE_CODE request
 */
async function handleExecuteRequest(request: JsonRpcRequest) {
  const encoder = new TextEncoder();
  const params = request.params as {
    code: string;
    context: Record<string, unknown>;
    handlers: string[];
  };

  const result = await executeCode(params.code, params.handlers);

  const response = JSON.stringify({
    jsonrpc: "2.0",
    id: request.id,
    result,
  }) + "\n";

  await Deno.stdout.write(encoder.encode(response));
}

/**
 * Main message loop
 */
async function main() {
  const decoder = new TextDecoder();
  const buffer = new Uint8Array(65536);

  while (true) {
    const n = await Deno.stdin.read(buffer);
    if (n === null) break;

    const data = decoder.decode(buffer.subarray(0, n));
    messageBuffer += data;

    const lines = messageBuffer.split("\n");
    messageBuffer = lines.pop() || "";

    for (const line of lines) {
      if (line.trim()) {
        processMessage(line);
      }
    }
  }
}

main().catch((error) => {
  console.error("Fatal error in sandbox:", error);
  Deno.exit(1);
});
