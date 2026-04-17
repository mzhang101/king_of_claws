// ============================================================
// King of Claws — Gemini Flash Client (Tactical AI Model)
// ============================================================

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
const TACTICAL_TIMEOUT_MS = 2000;

let ai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  if (!GEMINI_API_KEY) return null;
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return ai;
}

export interface TacticalResponse {
  action: 'move' | 'bomb' | 'wait';
  direction?: 'up' | 'down' | 'left' | 'right';
  reasoning?: string;
}

/**
 * Call Gemini Flash for a tactical decision.
 * Returns null on any failure (timeout, bad response, no API key).
 */
export async function generateTacticalDecision(
  prompt: string,
): Promise<TacticalResponse | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TACTICAL_TIMEOUT_MS);

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3,
        maxOutputTokens: 150,
      },
    });

    clearTimeout(timeout);

    const text = response.text?.trim();
    if (!text) return null;

    const parsed = JSON.parse(text);

    // Validate response shape
    if (parsed.action === 'move' && ['up', 'down', 'left', 'right'].includes(parsed.direction)) {
      return { action: 'move', direction: parsed.direction, reasoning: parsed.reasoning };
    }
    if (parsed.action === 'bomb') {
      return { action: 'bomb', reasoning: parsed.reasoning };
    }
    if (parsed.action === 'wait') {
      return { action: 'wait', reasoning: parsed.reasoning };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if Gemini API is configured.
 */
export function isGeminiConfigured(): boolean {
  return GEMINI_API_KEY.length > 0;
}
