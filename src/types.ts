/**
 * Core Types for Sandbox
 */

// Sandbox configuration
export interface SandboxConfig {
  timeout?: number; // Execution timeout in milliseconds (default: 30000)
  memoryLimit?: number; // Memory limit in MB
  permissions?: string[]; // Deno permission flags
  extraArgs?: string[]; // Extra Deno CLI args (e.g. ["--quiet"])
  cwd?: string; // Working directory for the sandbox process
  env?: Record<string, string | undefined>; // Environment variables for the sandbox process
  onLog?: (text: string, level: LogLevel) => void; // Streaming log callback
  onStderr?: (text: string) => void; // Streaming stderr callback
}

export type LogLevel = "log" | "error" | "warn" | "info";

// Execution result
export interface ExecutionResult {
  logs: string[];
  result?: unknown;
  error?: string;
}

// Handler function type
export type HandlerFunction = (...args: unknown[]) => Promise<unknown>;

// JSON-RPC Protocol Types (internal use)
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

export interface JsonRpcRequest extends JsonRpcNotification {
  id: string | number;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse;

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export const JsonRpcErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export const JsonRpcMethod = {
  CALL_HANDLER: "callHandler",
  EXECUTE_CODE: "executeCode",
  LOG: "log",
} as const;
