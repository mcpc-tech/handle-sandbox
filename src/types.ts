/**
 * Core Types for Sandbox
 */

// Sandbox configuration
export interface SandboxConfig {
  timeout?: number; // Execution timeout in milliseconds (default: 30000)
  memoryLimit?: number; // Memory limit in MB
  permissions?: string[]; // Deno permission flags
}

// Execution result
export interface ExecutionResult {
  logs: string[];
  result?: unknown;
  error?: string;
}

// Handler function type
export type HandlerFunction = (...args: unknown[]) => Promise<unknown>;

// JSON-RPC Protocol Types (internal use)
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

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
} as const;
