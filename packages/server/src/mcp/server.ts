// ============================================================
// King of Claws — MCP Server Factory (Per-Player Instances)
// ============================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerGameTools } from './tools.js';
import type { GameEngine } from '../game/engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameInstructions = readFileSync(join(__dirname, 'game-instructions.md'), 'utf-8');

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

  // Add game instructions tool
  server.tool(
    'get_game_instructions',
    'Get complete instructions on how to play King of Claws battle royale game. Read this FIRST before taking any actions to understand the game mechanics, strategy tips, and how to use the tools effectively.',
    {},
    async () => ({
      content: [{
        type: 'text' as const,
        text: gameInstructions,
      }],
    })
  );

  registerGameTools(server, playerId, getEngine);

  return server;
}
