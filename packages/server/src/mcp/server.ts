// ============================================================
// King of Claws — MCP Server Factory (Per-Player Instances)
// ============================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGameTools } from './tools.js';
import type { GameEngine } from '../game/engine.js';

/**
 * Create a new MCP server instance for a specific player.
 * Each player gets their own McpServer so tool calls are identity-scoped.
 */
export function createPlayerMcpServer(
  playerId: string,
  roomId: string,
  getEngine: () => GameEngine,
): McpServer {
  const server = new McpServer({
    name: `king-of-claws-${roomId}`,
    version: '1.0.0',
  });

  registerGameTools(server, playerId, getEngine);

  return server;
}
