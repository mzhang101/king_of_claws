// ============================================================
// King of Claws — Credits Economy System
// ============================================================

import { addCredits } from './account.js';

// Credit rewards
export const CREDITS = {
  FIRST_PLACE: 500,
  SECOND_PLACE: 200,
  THIRD_PLACE: 100,
  KILL_REWARD: 50,
  DAILY_LOGIN: 100,
  AIRDROP_COST: 200,
};

// Award match completion rewards
export function awardMatchRewards(
  playerTokens: Map<string, string>, // agentId -> token
  rankings: string[] // agentIds in order of finish (1st, 2nd, 3rd...)
): void {
  if (rankings.length === 0) return;

  // Award placement rewards
  const rewards = [CREDITS.FIRST_PLACE, CREDITS.SECOND_PLACE, CREDITS.THIRD_PLACE];

  for (let i = 0; i < Math.min(rankings.length, 3); i++) {
    const agentId = rankings[i];
    const token = playerTokens.get(agentId);

    if (token) {
      const reward = rewards[i];
      addCredits(token, reward);
      console.log(`[Credits] Awarded ${reward} credits to ${agentId} (place ${i + 1})`);
    }
  }
}

// Award kill reward
export function awardKillReward(killerToken: string): void {
  addCredits(killerToken, CREDITS.KILL_REWARD);
  console.log(`[Credits] Awarded ${CREDITS.KILL_REWARD} credits for kill`);
}
