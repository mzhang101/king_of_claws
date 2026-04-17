// ============================================================
// King of Claws — Gemini Flash Client (Tactical AI Model)
// ============================================================

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
const TACTICAL_TIMEOUT_MS = 2000;
const GEMINI_DEBUG = process.env.GEMINI_DEBUG === '1';

let ai: GoogleGenAI | null = null;

export interface GeminiDiagnostics {
  configured: boolean;
  model: string;
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  timeoutCalls: number;
  noKeySkips: number;
  lastLatencyMs: number | null;
  lastCallAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastError: string | null;
  lastResponsePreview: string | null;
}

const diagnostics: GeminiDiagnostics = {
  configured: GEMINI_API_KEY.length > 0,
  model: GEMINI_MODEL,
  totalCalls: 0,
  successCalls: 0,
  failedCalls: 0,
  timeoutCalls: 0,
  noKeySkips: 0,
  lastLatencyMs: null,
  lastCallAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: null,
  lastResponsePreview: null,
};

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

function getResponseText(response: unknown): Promise<string> | string {
  if (response && typeof response === 'object' && 'text' in response) {
    const textValue = (response as { text?: unknown }).text;
    if (typeof textValue === 'function') {
      return (textValue as () => Promise<string>)();
    }
    if (typeof textValue === 'string') {
      return textValue;
    }
  }
  return '';
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Call Gemini Flash for a tactical decision.
 * Returns null on any failure (timeout, bad response, no API key).
 */
export async function generateTacticalDecision(
  prompt: string,
): Promise<TacticalResponse | null> {
  const client = getClient();
  diagnostics.configured = GEMINI_API_KEY.length > 0;
  diagnostics.model = GEMINI_MODEL;
  diagnostics.lastCallAt = Date.now();
  diagnostics.totalCalls++;

  if (!client) {
    diagnostics.noKeySkips++;
    diagnostics.lastError = 'GEMINI_API_KEY not configured';
    diagnostics.lastFailureAt = Date.now();
    return null;
  }

  try {
    const startTime = Date.now();
    if (GEMINI_DEBUG) {
      console.log(`[Gemini] Request start model=${GEMINI_MODEL} promptChars=${prompt.length}`);
    }

    const response = await Promise.race([
      client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 150,
        },
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Gemini timeout after ${TACTICAL_TIMEOUT_MS}ms`)), TACTICAL_TIMEOUT_MS);
      }),
    ]);

    const text = (await getResponseText(response)).trim();
    if (!text) return null;

    const parsed = JSON.parse(text);
    diagnostics.successCalls++;
    diagnostics.lastLatencyMs = Date.now() - startTime;
    diagnostics.lastSuccessAt = Date.now();
    diagnostics.lastError = null;
    diagnostics.lastResponsePreview = text.slice(0, 200);

    if (GEMINI_DEBUG) {
      console.log(`[Gemini] Request success latency=${diagnostics.lastLatencyMs}ms response=${diagnostics.lastResponsePreview}`);
    }

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
  } catch (error) {
    const message = getErrorMessage(error);
    diagnostics.failedCalls++;
    diagnostics.lastFailureAt = Date.now();
    diagnostics.lastError = message;
    diagnostics.lastLatencyMs = null;
    if (message.includes('timeout')) {
      diagnostics.timeoutCalls++;
    }
    if (GEMINI_DEBUG) {
      console.error(`[Gemini] Request failed: ${message}`);
    }
    return null;
  }
}

/**
 * Check if Gemini API is configured.
 */
export function isGeminiConfigured(): boolean {
  return GEMINI_API_KEY.length > 0;
}

export function getGeminiDiagnostics(): GeminiDiagnostics {
  return { ...diagnostics };
}
