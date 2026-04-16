// ============================================================
// King of Claws — Test Bot (Simple MCP Client)
// ============================================================
// Usage: npx tsx scripts/test-bot.ts <roomId> [botName]
// This bot connects to the game via MCP SSE, calls tools in a loop.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const ROOM_ID = process.argv[2] || 'test';
const BOT_NAME = process.argv[3] || 'RandomBot';
const SERVER_BASE = process.env.SERVER_URL || 'http://localhost:3001';
const SERVER_URL = `${SERVER_BASE}/mcp/${ROOM_ID}/sse`;

async function main() {
  console.log(`[${BOT_NAME}] Connecting to ${SERVER_URL}...`);

  const transport = new SSEClientTransport(new URL(SERVER_URL));
  const client = new Client({
    name: BOT_NAME,
    version: '1.0.0',
  });

  await client.connect(transport);
  console.log(`[${BOT_NAME}] Connected! Available tools:`);

  // List tools
  const tools = await client.listTools();
  for (const tool of tools.tools) {
    console.log(`  - ${tool.name}: ${tool.description?.slice(0, 60)}...`);
  }

  // Game loop
  console.log(`[${BOT_NAME}] Starting game loop...`);
  let running = true;

  while (running) {
    try {
      // 1. Get status
      const statusResult = await client.callTool({
        name: 'get_my_status',
        arguments: {},
      });
      const status = JSON.parse((statusResult.content as any)[0].text);

      if (status.gameStatus === 'waiting') {
        console.log(`[${BOT_NAME}] Waiting for game to start...`);
        await sleep(2000);
        continue;
      }

      if (status.gameStatus === 'finished') {
        console.log(`[${BOT_NAME}] Game over!`);
        running = false;
        break;
      }

      if (!status.alive) {
        console.log(`[${BOT_NAME}] I'm dead! Watching...`);
        await sleep(3000);
        continue;
      }

      // 2. Random strategy
      const directions = ['up', 'down', 'left', 'right'] as const;
      const availableDirs = directions.filter(d => status.availableMoves[d]);

      // Avoid bombs: if there's a nearby bomb at our position, move away
      const bombAtPos = status.nearbyBombs.find(
        (b: any) => b.dangerDirections.length > 0 || (status.position.x === b.x && status.position.y === b.y)
      );

      if (bombAtPos && availableDirs.length > 0) {
        // Run away from bomb
        const dir = availableDirs[Math.floor(Math.random() * availableDirs.length)];
        const moveResult = await client.callTool({
          name: 'move',
          arguments: { direction: dir },
        });
        const move = JSON.parse((moveResult.content as any)[0].text);
        console.log(`[${BOT_NAME}] Tick ${status.currentTick}: FLEE ${dir} (bomb nearby!) → ${move.message}`);
      } else if (Math.random() < 0.3 && status.canPlaceBomb) {
        // Place bomb 30% of the time
        const bombResult = await client.callTool({
          name: 'place_bomb',
          arguments: {},
        });
        const bomb = JSON.parse((bombResult.content as any)[0].text);
        console.log(`[${BOT_NAME}] Tick ${status.currentTick}: BOMB → ${bomb.message}`);

        // Move away after placing bomb
        await sleep(200);
        if (availableDirs.length > 0) {
          const dir = availableDirs[Math.floor(Math.random() * availableDirs.length)];
          await client.callTool({
            name: 'move',
            arguments: { direction: dir },
          });
          console.log(`[${BOT_NAME}] Tick ${status.currentTick}: MOVE ${dir} (escape bomb)`);
        }
      } else if (availableDirs.length > 0) {
        // Move randomly
        const dir = availableDirs[Math.floor(Math.random() * availableDirs.length)];
        const moveResult = await client.callTool({
          name: 'move',
          arguments: { direction: dir },
        });
        const move = JSON.parse((moveResult.content as any)[0].text);
        console.log(`[${BOT_NAME}] Tick ${status.currentTick}: MOVE ${dir} → ${move.message}`);
      } else {
        console.log(`[${BOT_NAME}] Tick ${status.currentTick}: STUCK (no available moves)`);
      }

      // Wait a bit between decisions (simulate LLM thinking time)
      await sleep(300 + Math.random() * 500);

    } catch (err: any) {
      console.error(`[${BOT_NAME}] Error:`, err.message);
      await sleep(2000);
    }
  }

  await client.close();
  console.log(`[${BOT_NAME}] Disconnected.`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
