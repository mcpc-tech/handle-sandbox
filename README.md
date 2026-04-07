# @mcpc/handle-sandbox

[![JSR](https://jsr.io/badges/@mcpc/handle-sandbox)](https://jsr.io/@mcpc/handle-sandbox)

Simple and secure JavaScript execution in an isolated Deno subprocess. Register
async host functions, run untrusted code with explicit permissions, and
optionally stream logs and stderr back to the host in real time.

## Features

- **Secure sandboxing** with Deno permissions
- **JSON-RPC IPC** between host and sandbox process
- **Async host handlers** exposed directly inside sandboxed code
- **Streaming logs** via `onLog(text, level)` before `execute()` resolves
- **Streaming stderr** via `onStderr(text)`
- **Process controls** for timeout, memory, permissions, `cwd`, `env`, and extra
  Deno CLI args
- **Zero-config runtime discovery** from the bundled `deno` package

## Installation

```bash
# npm
npm install @mcpc-tech/handle-sandbox

# jsr
npx jsr add @mcpc/handle-sandbox
deno add @mcpc/handle-sandbox --allow-scripts=npm:deno
```

## Quick Start

### Basic usage

```ts
import { Sandbox } from "@mcpc/handle-sandbox";

const sandbox = new Sandbox();
sandbox.start();

const result = await sandbox.execute(`
  console.log("Hello from sandbox!");
  return 1 + 1;
`);

console.log(result.logs); // ["Hello from sandbox!"]
console.log(result.result); // 2
console.log(result.error); // undefined

sandbox.stop();
```

### Register host handlers

Registered handlers are available inside sandboxed code by the same name.

```ts
import { Sandbox } from "@mcpc/handle-sandbox";

const sandbox = new Sandbox();

sandbox.registerHandler("fetchUser", async (userId) => {
  return { id: userId, name: "Alice" };
});

sandbox.registerHandler("saveAuditLog", async (payload) => {
  return { ok: true, payload };
});

sandbox.start();

const result = await sandbox.execute(`
  const user = await fetchUser(123);
  await saveAuditLog({ action: "login", userId: user.id });
  console.log("User:", user.name);
  return user;
`);

console.log(result.result); // { id: 123, name: "Alice" }
console.log(result.logs); // ["User: Alice"]

sandbox.stop();
```

### Stream logs and stderr

```ts
import { type LogLevel, Sandbox } from "@mcpc/handle-sandbox";

const sandbox = new Sandbox({
  onLog: (text: string, level: LogLevel) => {
    console.log(`[sandbox:${level}]`, text);
  },
  onStderr: (text) => {
    process.stderr.write(`[sandbox:stderr] ${text}`);
  },
});

sandbox.start();

const result = await sandbox.execute(`
  console.log("step 1");
  console.warn("step 2");
  await Deno.stderr.write(new TextEncoder().encode("warning from stderr\n"));
  return "done";
`);

console.log(result.result); // "done"

sandbox.stop();
```

### Configure permissions and process options

```ts
import { Sandbox } from "@mcpc/handle-sandbox";

const sandbox = new Sandbox({
  timeout: 5_000,
  memoryLimit: 256,
  permissions: ["--allow-net=api.example.com", "--allow-env=API_TOKEN"],
  cwd: process.cwd(),
  env: {
    ...process.env,
    API_TOKEN: "example-token",
  },
  extraArgs: ["--quiet"],
});

sandbox.start();

const result = await sandbox.execute(`
  return {
    cwd: Deno.cwd(),
    tokenAvailable: Boolean(Deno.env.get("API_TOKEN")),
  };
`);

console.log(result.result);

sandbox.stop();
```

## API

### `new Sandbox(config?)`

Create a sandbox instance.

#### Config options

- `timeout?: number` - Execution timeout in milliseconds. Default: `30000`
- `memoryLimit?: number` - V8 max old space size in MB
- `permissions?: string[]` - Deno permission flags such as
  `"--allow-net=api.example.com"`
- `extraArgs?: string[]` - Additional Deno CLI args such as `"--quiet"`
- `cwd?: string` - Working directory for the sandbox subprocess
- `env?: Record<string, string | undefined>` - Environment variables for the
  sandbox subprocess
- `onLog?: (text: string, level: LogLevel) => void` - Streaming console output
  callback
- `onStderr?: (text: string) => void` - Streaming stderr callback

### `sandbox.registerHandler(name, handler)`

Register an async host function that sandboxed code can call directly by name.

```ts
sandbox.registerHandler("double", async (value) => {
  return Number(value) * 2;
});

const result = await sandbox.execute(`
  return await double(21);
`);
```

### `sandbox.start()`

Start the Deno subprocess. Call this before `execute()`.

### `sandbox.execute(code, context?)`

Execute JavaScript code inside the sandbox.

#### Parameters

- `code: string` - JavaScript source to run
- `context?: Record<string, unknown>` - Optional execution context

#### Returns

```ts
Promise<{
  logs: string[];
  result?: unknown;
  error?: string;
}>;
```

### `sandbox.stop()`

Stop the sandbox process and clean up resources.

### `LogLevel`

```ts
type LogLevel = "log" | "error" | "warn" | "info";
```

## How it works

1. The host starts a Deno subprocess.
2. The host sends user code to the subprocess over JSON-RPC.
3. The sandbox executes the code in an isolated environment.
4. Registered handlers are exposed as async functions inside the sandbox.
5. Console output is returned in the final result and can also be streamed via
   `onLog`.
6. The subprocess stderr stream can be observed via `onStderr`.

## Security model

The sandbox runs with minimal Deno permissions by default. Grant only the
permissions your use case needs.

```ts
// No permissions by default
new Sandbox();

// Allow network access to specific domains
new Sandbox({
  permissions: ["--allow-net=github.com,api.example.com"],
});

// Allow reading specific directories
new Sandbox({
  permissions: ["--allow-read=/tmp,/var/log"],
});

// Allow access to selected environment variables
new Sandbox({
  permissions: ["--allow-env=API_TOKEN"],
});
```

Without the corresponding Deno permission flags, operations like file access,
network access, and reading environment variables will fail.

## Development

```bash
# format
deno fmt

# test
deno test --allow-all tests/
```

## License

MIT
