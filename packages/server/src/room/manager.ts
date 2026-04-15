// ============================================================
// King of Claws — Room Manager
// ============================================================

import { Room } from './room.js';
import { v4 as uuid } from 'uuid';
import type { RoomSummary } from '@king-of-claws/shared';
import { saveRooms, loadRooms } from './persistence.js';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  constructor() {
    // Load persisted rooms on startup
    this.loadPersistedRooms();
  }

  /**
   * Load rooms from disk on server restart
   */
  private loadPersistedRooms(): void {
    const persistedRooms = loadRooms();
    for (const data of persistedRooms) {
      // Only restore waiting rooms (not playing or finished)
      if (data.status === 'waiting') {
        const room = new Room(data.id, data.name);
        this.rooms.set(data.id, room);
        console.log(`[RoomManager] Restored room: ${data.id} (${data.name})`);
      }
    }
  }

  /**
   * Save current rooms to disk
   */
  private persistRooms(): void {
    const roomData = Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      status: room.getStatus(),
      createdAt: room.createdAt,
      finishedAt: room.getFinishedAt(),
      playerCount: room.getEngine().getPlayerCount(),
    }));
    saveRooms(roomData);
  }

  /**
   * Create a new game room.
   */
  createRoom(name: string): Room {
    const id = uuid().slice(0, 8); // short ID for easy sharing
    const room = new Room(id, name);
    this.rooms.set(id, room);
    console.log(`[RoomManager] Room created: ${id} (${name}). Total rooms: ${this.rooms.size}`);
    this.persistRooms();
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
    const rooms = Array.from(this.rooms.values()).map(r => r.getSummary());
    console.log(`[RoomManager] Listing ${rooms.length} rooms:`, rooms.map(r => `${r.id}(${r.status})`).join(', '));
    return rooms;
  }

  /**
   * Delete a room and clean up resources.
   */
  deleteRoom(id: string): boolean {
    const room = this.rooms.get(id);
    if (!room) return false;
    console.log(`[RoomManager] Deleting room: ${id}. Total rooms before: ${this.rooms.size}`);
    room.destroy();
    this.rooms.delete(id);
    console.log(`[RoomManager] Room deleted: ${id}. Total rooms after: ${this.rooms.size}`);
    this.persistRooms();
    return true;
  }

  /**
   * Clean up finished rooms older than the specified age (ms).
   */
  cleanupFinished(maxAgeMs: number = 5 * 60 * 1000): void {
    const now = Date.now();
    let cleaned = false;
    for (const [id, room] of this.rooms) {
      if (room.getStatus() === 'finished') {
        const finishedAt = room.getFinishedAt();
        // Only cleanup if game finished AND enough time has passed since finish
        if (finishedAt && now - finishedAt > maxAgeMs) {
          console.log(`[RoomManager] Cleaning up finished room ${id} (finished ${Math.round((now - finishedAt) / 1000)}s ago)`);
          room.destroy();
          this.rooms.delete(id);
          cleaned = true;
        }
      }
    }
    if (cleaned) {
      this.persistRooms();
    }
  }
}
