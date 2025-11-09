/**
 * Simple JSON-RPC 2.0 utilities
 */

import type { JsonRpcRequest, JsonRpcResponse } from "./types.ts";

export class JsonRpcHandler {
  private requestId = 0;

  createRequest(method: string, params?: unknown): JsonRpcRequest {
    return { jsonrpc: "2.0", id: ++this.requestId, method, params };
  }

  createResponse(id: string | number, result?: unknown): JsonRpcResponse {
    return { jsonrpc: "2.0", id, result };
  }

  createErrorResponse(
    id: string | number,
    code: number,
    message: string,
  ): JsonRpcResponse {
    return { jsonrpc: "2.0", id, error: { code, message } };
  }

  parseMessage(data: string): JsonRpcRequest | JsonRpcResponse | null {
    try {
      const msg = JSON.parse(data);
      if (msg?.jsonrpc === "2.0") return msg;
    } catch {
      // Invalid JSON
    }
    return null;
  }

  serializeMessage(message: JsonRpcRequest | JsonRpcResponse): string {
    return JSON.stringify(message);
  }
}
