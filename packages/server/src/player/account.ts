// ============================================================
// King of Claws — Player Account Management
// ============================================================

import { randomBytes } from 'crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { PlayerAccount } from '@king-of-claws/shared';

const ACCOUNTS_FILE = join(process.cwd(), 'data', 'player-accounts.json');
const INITIAL_CREDITS = 1000;
const DAILY_LOGIN_BONUS = 100;

// In-memory store
const accounts = new Map<string, PlayerAccount>();

// Load accounts from disk on startup
export function loadAccounts() {
  try {
    if (existsSync(ACCOUNTS_FILE)) {
      const data = JSON.parse(readFileSync(ACCOUNTS_FILE, 'utf-8'));
      for (const account of data) {
        accounts.set(account.token, account);
      }
      console.log(`[PlayerAccount] Loaded ${accounts.size} accounts from disk`);
    }
  } catch (err) {
    console.error('[PlayerAccount] Failed to load accounts:', err);
  }
}

// Save accounts to disk
export function saveAccounts() {
  try {
    const dir = dirname(ACCOUNTS_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const data = Array.from(accounts.values());
    writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[PlayerAccount] Failed to save accounts:', err);
  }
}

// Generate a new player account
export function createPlayerAccount(agentId: string, roomId: string): PlayerAccount {
  const token = randomBytes(32).toString('hex');
  const now = Date.now();

  const account: PlayerAccount = {
    id: randomBytes(16).toString('hex'),
    token,
    credits: INITIAL_CREDITS,
    agentId,
    roomId,
    createdAt: now,
    lastLogin: now,
    lastAirdropTick: -999, // Allow immediate first airdrop
  };

  accounts.set(token, account);
  saveAccounts();

  console.log(`[PlayerAccount] Created account for agent ${agentId} in room ${roomId}`);
  return account;
}

// Get account by token
export function getAccountByToken(token: string): PlayerAccount | null {
  return accounts.get(token) || null;
}

// Get account by agent ID
export function getAccountByAgentId(agentId: string): PlayerAccount | null {
  for (const account of accounts.values()) {
    if (account.agentId === agentId) {
      return account;
    }
  }
  return null;
}

// Update last login and give daily bonus
export function updateLogin(token: string): boolean {
  const account = accounts.get(token);
  if (!account) return false;

  const now = Date.now();
  const lastLoginDate = new Date(account.lastLogin).toDateString();
  const todayDate = new Date(now).toDateString();

  // Give daily bonus if it's a new day
  if (lastLoginDate !== todayDate) {
    account.credits += DAILY_LOGIN_BONUS;
    console.log(`[PlayerAccount] Daily bonus +${DAILY_LOGIN_BONUS} credits for ${account.id}`);
  }

  account.lastLogin = now;
  saveAccounts();
  return true;
}

// Deduct credits
export function deductCredits(token: string, amount: number): boolean {
  const account = accounts.get(token);
  if (!account || account.credits < amount) return false;

  account.credits -= amount;
  saveAccounts();
  return true;
}

// Add credits
export function addCredits(token: string, amount: number): boolean {
  const account = accounts.get(token);
  if (!account) return false;

  account.credits += amount;
  saveAccounts();
  return true;
}

// Update last airdrop tick
export function updateLastAirdropTick(token: string, tick: number): boolean {
  const account = accounts.get(token);
  if (!account) return false;

  account.lastAirdropTick = tick;
  saveAccounts();
  return true;
}

// Initialize on import
loadAccounts();

// Auto-save every 30 seconds
setInterval(saveAccounts, 30000);
