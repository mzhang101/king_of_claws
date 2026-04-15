// ============================================================
// King of Claws — Room Persistence
// ============================================================

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../../data');
const ROOMS_FILE = join(DATA_DIR, 'rooms.json');

interface PersistedRoom {
  id: string;
  name: string;
  status: 'waiting' | 'countdown' | 'playing' | 'finished';
  createdAt: number;
  finishedAt: number | null;
  playerCount: number;
}

/**
 * Save rooms to disk
 */
export function saveRooms(rooms: PersistedRoom[]): void {
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(ROOMS_FILE, JSON.stringify(rooms, null, 2));
    console.log(`[Persistence] Saved ${rooms.length} rooms to disk`);
  } catch (err) {
    console.error('[Persistence] Failed to save rooms:', err);
  }
}

/**
 * Load rooms from disk
 */
export function loadRooms(): PersistedRoom[] {
  try {
    if (!existsSync(ROOMS_FILE)) {
      console.log('[Persistence] No saved rooms found');
      return [];
    }
    const data = readFileSync(ROOMS_FILE, 'utf-8');
    const rooms = JSON.parse(data) as PersistedRoom[];
    console.log(`[Persistence] Loaded ${rooms.length} rooms from disk`);
    return rooms;
  } catch (err) {
    console.error('[Persistence] Failed to load rooms:', err);
    return [];
  }
}
