import { GoogleGenAI } from '@google/genai';

/**
 * Gemini key 池與「依功能指定模型」。
 *
 * 金鑰（由高到低，找到就用）：
 *   GEMINI_API_KEYS_<功能>  例如 GEMINI_API_KEYS_SOLVE（只給該功能用）
 *   GEMINI_API_KEYS         所有功能共用的一串 key
 *   GEMINI_API_KEY          舊的單一 key（相容）
 * 格式：JSON 陣列，或用逗號／分號／換行隔開都可以。
 *
 * 模型（由高到低）：
 *   GEMINI_MODELS_<功能>    例如 GEMINI_MODELS_RECOGNIZE=gemini-3.1-flash-lite,gemini-3.5-flash
 *   GEMINI_MODELS           所有功能共用的順序
 *   程式內建的預設順序
 *
 * 每次呼叫：先試功能的第一個模型，把池裡的 key 從隨機位置開始輪流試；
 * 遇到額度用完或塞車（429 / 503）就換下一把 key，整個池都不行才換下一個模型。
 * 失敗的 key 會暫時跳過，避免每個請求都撞同一面牆。日誌只會出現 key 的編號，不會出現內容。
 */

export const POOL_ACTIONS = ['recognize', 'explain', 'solve', 'enrich', 'practice', 'ask', 'distill'] as const;
export type PoolAction = (typeof POOL_ACTIONS)[number];

const DEFAULT_CHAIN = [process.env.GEMINI_MODEL || 'gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview'];

// flash-lite 免費額度大（每天 500 次，主力模型只有 20 次），所有功能都先用它；
// 會考 100 題評測：打字無圖題 92.5%、拍照 74%。Lite 忙碌或額度用完才退到主力模型。
// 想讓某功能改用主力模型，設 GEMINI_MODELS_<功能>（例如 GEMINI_MODELS_SOLVE=gemini-3.8-flash,gemini-3.1-flash-lite）
const LITE = 'gemini-3.1-flash-lite';
const LITE_FIRST = [LITE, ...DEFAULT_CHAIN];
const DEFAULT_MODELS: Record<PoolAction, string[]> = {
  recognize: LITE_FIRST,
  explain: LITE_FIRST,
  solve: LITE_FIRST,
  enrich: LITE_FIRST,
  practice: LITE_FIRST,
  ask: LITE_FIRST,
  distill: LITE_FIRST,
};

const splitList = (raw: string) =>
  raw
    .split(/[,;\r\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const clean = (s: string) => s.replace(/^﻿/, '').trim().replace(/^["']+|["']+$/g, '').trim();

export function parseKeyList(raw: string | undefined): string[] {
  if (!raw) return [];
  const text = raw.replace(/^﻿/, '').trim();
  let items: string[] = [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) items = parsed.map((v) => String(v));
    } catch {
      items = splitList(text.replace(/^\[|\]$/g, ''));
    }
  } else {
    items = splitList(text);
  }
  return items.map(clean).filter((k, i, all) => k && all.indexOf(k) === i);
}

export function keysFor(action: PoolAction): string[] {
  const env = process.env;
  const specific = parseKeyList(env[`GEMINI_API_KEYS_${action.toUpperCase()}`]);
  if (specific.length) return specific;
  const shared = parseKeyList(env.GEMINI_API_KEYS);
  if (shared.length) return shared;
  return parseKeyList(env.GEMINI_API_KEY);
}

export function modelsFor(action: PoolAction): string[] {
  const env = process.env;
  const list = (raw?: string) => (raw ? splitList(raw).map(clean).filter((m, i, all) => m && all.indexOf(m) === i) : []);
  const specific = list(env[`GEMINI_MODELS_${action.toUpperCase()}`]);
  if (specific.length) return specific;
  const shared = list(env.GEMINI_MODELS);
  if (shared.length) return shared;
  return DEFAULT_MODELS[action];
}

export const hasKeys = (action: PoolAction) => keysFor(action).length > 0;

const clients = new Map<string, GoogleGenAI>();
function clientFor(key: string): GoogleGenAI {
  let client = clients.get(key);
  if (!client) {
    client = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    clients.set(key, client);
  }
  return client;
}

const errorText = (err: unknown) => String((err as any)?.message ?? err);

export const isCapacityError = (err: unknown) =>
  /\b(?:429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|quota/i.test(errorText(err));

// key + 模型 暫停使用到什麼時候（毫秒時間戳）；只存在這個執行個體的記憶體裡
const cooldown = new Map<string, number>();

function coolFor(err: unknown): number {
  const text = errorText(err);
  if (/PerDay|per day|daily/i.test(text)) return 60 * 60 * 1000; // 今天的額度用完，一小時內不再試
  if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(text)) return 60 * 1000; // 每分鐘上限
  return 30 * 1000; // 503 塞車
}

type GenerateRequest = Omit<Parameters<GoogleGenAI['models']['generateContent']>[0], 'model'>;

export async function generateFor(action: PoolAction, request: GenerateRequest) {
  const keys = keysFor(action);
  if (!keys.length) throw new Error('NO_KEYS');
  const now = Date.now();
  let lastError: unknown;

  for (const model of modelsFor(action)) {
    const start = Math.floor(Math.random() * keys.length);
    const order = keys.map((_, i) => (start + i) % keys.length);
    const ready = order.filter((i) => (cooldown.get(`${i}|${model}`) ?? 0) <= now);
    // 全部都在冷卻中就還是試一輪，免得完全不給學生用
    const attempts = ready.length ? ready : order;

    for (const i of attempts) {
      try {
        return await clientFor(keys[i]).models.generateContent({ ...request, model });
      } catch (err) {
        lastError = err;
        if (!isCapacityError(err)) throw err;
        cooldown.set(`${i}|${model}`, Date.now() + coolFor(err));
        console.warn(`[aiPool] ${action} key#${i + 1}/${keys.length} ${model} 暫時不可用`);
      }
    }
  }
  throw lastError;
}

// 只回報數量，不含任何 key 內容（排錯用）
export function poolSummary() {
  return Object.fromEntries(
    POOL_ACTIONS.map((a) => [a, { keys: keysFor(a).length, models: modelsFor(a) }])
  );
}
