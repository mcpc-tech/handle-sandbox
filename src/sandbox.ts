/**
 * Sandbox - Simple Deno-based code execution
 *
 * Simplified version of SandboxExecutor with generic handler support
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { type ChildProcess, spawn } from "node:child_process";
import type { Buffer } from "node:buffer";
import { JsonRpcHandler } from "./json-rpc.ts";
import {
  type ExecutionResult,
  type HandlerFunction,
  JsonRpcErrorCode,
  JsonRpcMethod,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type SandboxConfig,
} from "./types.ts";

export class Sandbox {
  private process: ChildProcess | null = null;
  private jsonRpc = new JsonRpcHandler();
  private pendingRequests = new Map<
    string | number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  private handlers = new Map<string, HandlerFunction>();
  private buffer = "";

  constructor(private config: SandboxConfig = {}) {}

  /**
   * Register a handler function that can be called from sandbox code
   */
  registerHandler(name: string, handler: HandlerFunction): void {
    this.handlers.set(name, handler);
  }

  /**
   * Get Deno binary path from npm package
   */
  private getDenoBinaryPath(): string {
    const resolver = (
      import.meta as { resolve?: (specifier: string) => string }
    ).resolve;
    if (!resolver) throw new Error("Cannot resolve deno package");

    const pkgUrl = resolver("deno/package.json");
    const denoDir = path.dirname(fileURLToPath(pkgUrl));
    return path.join(denoDir, "bin.cjs");
  }

  /**
   * Find runtime.ts file path, with fallback locations
   */
  private getRuntimePath(): string {
    const baseDir = path.dirname(fileURLToPath(import.meta.url));

    const candidates = [
      path.join(baseDir, "../runtime/runtime.ts"),
      path.join(baseDir, "../runtime/runtime.mjs"),
      path.join(baseDir, "runtime/runtime.ts"),
      path.join(baseDir, "runtime/runtime.mjs"),
      path.join(baseDir, "runtime.ts"),
      path.join(baseDir, "runtime.mjs"),
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      `Runtime file not found. Tried:\n${
        candidates.map((p) => `  - ${p}`).join("\n")
      }`,
    );
  }

  /**
   * Start Deno sandbox process
   */
  start(): void {
    if (this.process) throw new Error("Sandbox already started");

    const runtimePath = this.getRuntimePath();

    const args = ["run", "--no-prompt"];

    if (this.config.memoryLimit) {
      args.push(`--v8-flags=--max-old-space-size=${this.config.memoryLimit}`);
    }

    if (this.config.permissions) {
      args.push(...this.config.permissions);
    }

    args.push(runtimePath);

    this.process = spawn(this.getDenoBinaryPath(), args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout?.on("data", (data: Buffer) => this.handleStdout(data));
    this.process.stderr?.on(
      "data",
      (data: Buffer) => console.error("Sandbox stderr:", data.toString()),
    );
    this.process.on("error", (error: Error) => {
      console.error("Sandbox error:", error);
      this.cleanup();
    });
    this.process.on("exit", (code: number | null) => {
      console.log("Sandbox exited:", code);
      this.cleanup();
    });
  }

  /**
   * Handle stdout data from sandbox
   */
  private handleStdout(data: Buffer): void {
    this.buffer += data.toString();
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      const message = this.jsonRpc.parseMessage(line);
      if (!message) {
        console.error("Failed to parse message:", line);
        continue;
      }

      if ("result" in message || "error" in message) {
        this.handleResponse(message as JsonRpcResponse);
      } else if ("method" in message) {
        this.handleRequest(message as JsonRpcRequest).catch((err) =>
          console.error("Error handling request:", err)
        );
      }
    }
  }

  /**
   * Handle JSON-RPC response from sandbox
   */
  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.error("Unknown request ID:", response.id);
      return;
    }

    this.pendingRequests.delete(response.id);
    response.error
      ? pending.reject(new Error(response.error.message))
      : pending.resolve(response.result);
  }

  /**
   * Handle JSON-RPC request from sandbox (handler calls)
   */
  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    try {
      if (request.method === JsonRpcMethod.CALL_HANDLER) {
        const params = request.params as { name: string; args: unknown[] };
        const handler = this.handlers.get(params.name);

        if (!handler) {
          throw new Error(`Handler not found: ${params.name}`);
        }

        const result = await handler(...params.args);
        this.sendMessage(this.jsonRpc.createResponse(request.id, result));
      } else {
        this.sendMessage(
          this.jsonRpc.createErrorResponse(
            request.id,
            JsonRpcErrorCode.METHOD_NOT_FOUND,
            `Method not found: ${request.method}`,
          ),
        );
      }
    } catch (error) {
      this.sendMessage(
        this.jsonRpc.createErrorResponse(
          request.id,
          JsonRpcErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : String(error),
        ),
      );
    }
  }

  /**
   * Send message to sandbox
   */
  private sendMessage(message: JsonRpcRequest | JsonRpcResponse): void {
    if (!this.process?.stdin) throw new Error("Sandbox not started");
    this.process.stdin.write(this.jsonRpc.serializeMessage(message) + "\n");
  }

  /**
   * Send request and wait for response
   */
  private sendRequest(
    method: string,
    params?: unknown,
    timeout?: number,
  ): Promise<unknown> {
    if (!this.process) throw new Error("Sandbox not started");

    const request = this.jsonRpc.createRequest(method, params);
    const timeoutMs = timeout || this.config.timeout || 30000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(request.id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      this.sendMessage(request);
    });
  }

  /**
   * Execute code in sandbox
   */
  async execute(
    code: string,
    context?: Record<string, unknown>,
  ): Promise<ExecutionResult> {
    try {
      const result = (await this.sendRequest(JsonRpcMethod.EXECUTE_CODE, {
        code,
        context: context || {},
        handlers: Array.from(this.handlers.keys()),
      })) as ExecutionResult;

      return result;
    } catch (error) {
      return {
        logs: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Stop sandbox process
   */
  stop(): void {
    if (!this.process) return;

    try {
      this.process.stdin?.end();
    } catch {
      /* ignore */
    }
    try {
      this.process.kill("SIGTERM");
    } catch {
      /* ignore */
    }

    this.cleanup();
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.process) {
      this.process.stdout?.removeAllListeners();
      this.process.stderr?.removeAllListeners();
      this.process.removeAllListeners();
      this.process.stdout?.destroy();
      this.process.stderr?.destroy();
      this.process.stdin?.destroy();
    }

    this.process = null;

    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error("Sandbox terminated"));
    }
    this.pendingRequests.clear();
  }
}
