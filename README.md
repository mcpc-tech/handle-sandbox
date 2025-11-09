# @mcpc/sandbox# @mcpc/plugin-code-execution



[![JSR](https://jsr.io/badges/@mcpc/sandbox)](https://jsr.io/@mcpc/sandbox)[![JSR](https://jsr.io/badges/@mcpc/plugin-code-execution)](https://jsr.io/@mcpc/plugin-code-execution)

[![npm](https://img.shields.io/npm/v/@mcpc-tech/plugin-code-execution)](https://www.npmjs.com/package/@mcpc-tech/plugin-code-execution)

Simple and secure JavaScript code execution using Deno sandbox. Run user code in isolation with custom function injection.

Secure JavaScript code execution sandbox using Deno for MCPC agents. This

## Featurespackage provides a safe environment to execute user-provided JavaScript code

with MCP tool access via JSON-RPC IPC.

- 🔒 **Secure**: Deno's permission system for isolated execution

- 🔌 **Simple IPC**: JSON-RPC over stdin/stdout## Features

- 🎯 **Custom Functions**: Inject any async functions into sandbox

- 📦 **Zero Config**: Auto-locates Deno binary- 🔒 **Secure Sandboxing**: Uses Deno's permission system for isolated code

- 🛡️ **Resource Limits**: Configurable timeouts and memory  execution

- 🔌 **JSON-RPC IPC**: Tool calls are transmitted via JSON-RPC between sandbox

## Installation  and host

- 🚀 **Easy Integration**: Plugin-based integration with MCPC

```bash- 📦 **Zero Config**: Automatically locates Deno binary from npm package

# npm- 🛡️ **Resource Limits**: Configurable timeouts and memory limits

npm install @mcpc/sandbox

## Installation

# jsr

npx jsr add @mcpc/sandbox```bash

deno add @mcpc/sandbox# npm

```npm install @mcpc-tech/plugin-code-execution

pnpm add @mcpc-tech/plugin-code-execution

## Quick Start

# jsr

### Basic Usagenpx jsr add @mcpc/plugin-code-execution

pnpm add jsr:@mcpc/plugin-code-execution

```typescript```

import { Sandbox } from "@mcpc/sandbox";

## Usage

const sandbox = new Sandbox();

sandbox.start();### Basic Usage



// Execute code```typescript

const result = await sandbox.execute(`import { mcpc } from "@mcpc/core";

  console.log("Hello from sandbox!");import { createCodeExecutionPlugin } from "@mcpc/plugin-code-execution/plugin";

  return 1 + 1;

`);const server = await mcpc(

  [{ name: "my-agent", version: "1.0.0" }, {

console.log(result.logs);   // ["Hello from sandbox!"]    capabilities: { tools: {} },

console.log(result.result); // 2  }],

  [{

sandbox.stop();    name: "my-agent",

```    description: `

      An agent that can execute JavaScript code securely.

### With Custom Functions      <tool name="filesystem.read_file"/>

      <tool name="filesystem.write_file"/>

```typescript    `,

const sandbox = new Sandbox();    deps: {

      mcpServers: {

// Register custom functions        "filesystem": {

sandbox.registerHandler("fetchUser", async (userId: number) => {          command: "npx",

  return { id: userId, name: "Alice" };          args: ["-y", "@wonderwhy-er/desktop-commander@latest"],

});          transportType: "stdio",

        },

sandbox.registerHandler("saveData", async (data: any) => {      },

  await db.save(data);    },

  return { success: true };    plugins: [

});      createCodeExecutionPlugin({

        sandbox: {

sandbox.start();          timeout: 30000, // 30 seconds

          memoryLimit: 512, // 512 MB

// Use custom functions in code          permissions: [], // No extra permissions

const result = await sandbox.execute(`        },

  const user = await fetchUser(123);      }),

  console.log("User:", user.name);    ],

      options: {

  await saveData({ userId: user.id, action: "login" });      mode: "custom",

  return user;    },

`);  }],

);

sandbox.stop();```

```

### How It Works

### With Timeout and Memory Limits

The plugin uses bidirectional JSON-RPC communication:

```typescript

const sandbox = new Sandbox({1. Host spawns Deno sandbox subprocess

  timeout: 5000,      // 5 seconds2. Host sends `executeCode` request with user's JavaScript code

  memoryLimit: 256,   // 256 MB3. Sandbox runs the code

  permissions: ["--allow-net=api.example.com"],4. When code calls `callMCPTool(toolName, params)`:

});   - Sandbox sends `callTool` request to host

   - Host executes the actual MCP tool

sandbox.start();   - Host sends response back to sandbox

const result = await sandbox.execute("...");   - Sandbox receives result and continues code execution

sandbox.stop();5. Sandbox returns final execution result to host

```

### Security Model

## API

The Deno sandbox runs with minimal permissions by default. You control access by

### `new Sandbox(config?)`passing Deno permission flags directly:



Create a new sandbox instance.```typescript

// No permissions - can only call MCP tools

**Config Options:**createCodeExecutionPlugin();

- `timeout?: number` - Execution timeout in milliseconds (default: 30000)

- `memoryLimit?: number` - Memory limit in MB// Allow network access to specific domains

- `permissions?: string[]` - Deno permission flagscreateCodeExecutionPlugin({

  sandbox: {

### `sandbox.registerHandler(name, handler)`    permissions: ["--allow-net=github.com,api.example.com"],

  },

Register a function that can be called from sandbox code.});



```typescript// Allow reading specific directories

sandbox.registerHandler("myFunction", async (arg1, arg2) => {createCodeExecutionPlugin({

  return result;  sandbox: {

});    permissions: ["--allow-read=/tmp,/var/log"],

```  },

});

### `sandbox.start()````



Start the Deno subprocess. Call this before executing code.### Configuration Options



### `sandbox.execute(code, context?)````typescript

interface SandboxConfig {

Execute JavaScript code in the sandbox.  timeout?: number; // Execution timeout in ms (default: 30000)

  memoryLimit?: number; // Memory limit in MB (default: unlimited)

**Returns:** `Promise<{ logs: string[], result?: any, error?: string }>`  permissions?: string[]; // Deno flags, e.g., ["--allow-net", "--allow-read=/tmp"]

}

**Parameters:**```

- `code: string` - JavaScript code to execute

- `context?: Record<string, any>` - Additional context (optional)Example with custom permissions:



### `sandbox.stop()````typescript

createCodeExecutionPlugin({

Stop the sandbox and clean up resources.  sandbox: {

    timeout: 60000,

## How It Works    permissions: [

      "--allow-net=api.example.com",

```      "--allow-read=/tmp",

┌─────────────────┐         JSON-RPC          ┌──────────────────┐      "--allow-env=HOME,USER",

│   Your App      │◄─────────────────────────►│  Deno Sandbox    │    ],

│  (Node.js)      │   stdin/stdout (IPC)      │  (Isolated)      │  },

│                 │                            │                  │});

│  registerHandler│                            │  await myFunc()  │```

│  execute(code)  │                            │  console.log()   │

└─────────────────┘                            └──────────────────┘## Architecture

```

```mermaid

1. Your app spawns Deno subprocesssequenceDiagram

2. Sends code to execute via JSON-RPC    participant Host as Host (Node)

3. Sandbox runs code in isolated environment    participant Sandbox as Sandbox (Deno)

4. When code calls registered functions, sandbox sends request back    

5. Your app handles request and sends response    Host->>Sandbox: executeCode("fetch('https://google.com')")

6. Sandbox receives response and continues execution    activate Sandbox

    Note over Sandbox: deno run --no-prompt

## Examples    Sandbox--xHost: PermissionDenied: --allow-net needed

    deactivate Sandbox

See the `examples/` directory:    

- `01-basic.ts` - Simple execution    Host->>Sandbox: executeCode("callMCPTool('http.fetch', ...)")

- `02-custom-functions.ts` - Custom function injection    activate Sandbox

- `03-mcp-integration.ts` - Using with MCP tools    Sandbox->>Host: callTool('http.fetch', {url: 'https://google.com'})

    activate Host

## License    Note over Host: Execute MCP tool

    Host-->>Sandbox: {status: 200, body: "..."}

MIT    deactivate Host

    Sandbox-->>Host: execution result
    deactivate Sandbox
```

**Permission Model**

```typescript
// Sandbox runs WITHOUT permissions by default
// ❌ These operations will fail:
const code = `
  await Deno.readTextFile('/file.txt');        // PermissionDenied: --allow-read needed
  await fetch('https://api.com');               // PermissionDenied: --allow-net needed
  Deno.env.get('SECRET');                       // PermissionDenied: --allow-env needed
`;

// ✅ All operations must go through MCP tools:
const code = `
  await callMCPTool('desktop-commander.read_file', { path: '/file.txt' });
  await callMCPTool('http-client.fetch', { url: 'https://api.com' });
`;

// Or grant specific permissions if needed:
createCodeExecutionPlugin({
  sandbox: {
    permissions: ["--allow-net=api.example.com", "--allow-read=/tmp"],
  },
});
```

## Examples

See `examples/` directory for complete examples:

- `basic-usage.ts` - Simple code execution with plugin integration

## Development

```bash
# Run tests
deno test --allow-all tests/

# Run example
deno run --allow-all examples/basic-usage.ts
```

## License

MIT
