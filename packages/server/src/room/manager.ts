// ============================================================
// King of Claws — Room Manager
// ============================================================

import { Room } from './room.js';
import { v4 as uuid } from 'uuid';
import type { RoomSummary } from '@king-of-claws/shared';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  /**
   * Create a new game room.
   */
  createRoom(name: string): Room {
    const id = uuid().slice(0, 8); // short ID for easy sharing
    const room = new Room(id, name);
    this.rooms.set(id, room);
    return room;
  }

  /**
   * Get a room by ID.
   */
  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  /**
   * List all active rooms.
   */
  listRooms(): RoomSummary[] {
    return Array.from(this.rooms.values()).map(r => r.getSummary());
  }

  /**
   * Delete a room and clean up resources.
   */
  deleteRoom(id: string): boolean {
    const room = this.rooms.get(id);
    if (!room) return false;
    room.destroy();
    this.rooms.delete(id);
    return true;
  }

  /**
   * Clean up finished rooms older than the specified age (ms).
   */
  cleanupFinished(maxAgeMs: number = 5 * 60 * 1000): void {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      if (room.getStatus() === 'finished' && now - room.createdAt > maxAgeMs) {
        room.destroy();
        this.rooms.delete(id);
      }
    }
  }
}
