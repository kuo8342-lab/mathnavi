import crypto from 'crypto';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

/**
 * AI 使用量控管：
 * - 已登入（Firebase ID token）每天 AI_DAILY_LIMIT_USER 次
 * - 訪客依 IP 每天 AI_DAILY_LIMIT_GUEST 次
 * - 學習背景分析（distill）另外計算，不佔用解題次數
 * - 解題後自動補充的教學內容（enrich）另外計算，上限與解題相同，不會讓一題扣兩次
 * 計數存放在 Firestore 的 aiUsage 集合（前端無法讀寫，見 firestore.rules）。
 */

export type UsageBucket = 'ai' | 'enrich' | 'distill';

const AI_LIMITS = {
  user: Number(process.env.AI_DAILY_LIMIT_USER || 30),
  guest: Number(process.env.AI_DAILY_LIMIT_GUEST || 5),
};

const LIMITS: Record<UsageBucket, { user: number; guest: number }> = {
  ai: AI_LIMITS,
  enrich: AI_LIMITS,
  distill: {
    user: Number(process.env.DISTILL_DAILY_LIMIT_USER || 12),
    guest: Number(process.env.DISTILL_DAILY_LIMIT_GUEST || 2),
  },
};

export function bucketFor(action: string): UsageBucket {
  return action === 'distill' ? 'distill' : action === 'enrich' ? 'enrich' : 'ai';
}

let adminApp: App | null | undefined;

export function getAdminApp(): App | null {
  if (adminApp !== undefined) return adminApp;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    adminApp = null;
    return adminApp;
  }
  try {
    const sa = JSON.parse(raw.replace(/^﻿/, '').trim());
    adminApp = getApps()[0] || initializeApp({ credential: cert(sa) });
  } catch (err) {
    console.error('FIREBASE_SERVICE_ACCOUNT 格式錯誤：', err);
    adminApp = null;
  }
  return adminApp;
}

export type GuardResult =
  | { ok: true; remaining: number | null }
  | { ok: false; status: number; error: string };

function taipeiDate(): string {
  // en-CA 會輸出 YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
}

export async function checkAndCountUsage(
  authorization: string | undefined,
  clientIp: string,
  bucket: UsageBucket = 'ai'
): Promise<GuardResult> {
  const app = getAdminApp();
  if (!app) {
    // 正式環境沒設定好就不開放 AI，避免額度被濫用；本機開發則不限制
    if (process.env.VERCEL) {
      return { ok: false, status: 503, error: '伺服器尚未完成 AI 使用量設定' };
    }
    return { ok: true, remaining: null };
  }

  let key: string;
  let limit: number;
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (token) {
    try {
      const decoded = await getAuth(app).verifyIdToken(token);
      key = `u_${decoded.uid}`;
      limit = LIMITS[bucket].user;
    } catch {
      return { ok: false, status: 401, error: '登入已過期，請重新登入' };
    }
  } else {
    const ipHash = crypto.createHash('sha256').update(clientIp || 'unknown').digest('hex').slice(0, 24);
    key = `ip_${ipHash}`;
    limit = LIMITS[bucket].guest;
  }

  const db = getFirestore(app);
  const ref = db.collection('aiUsage').doc(`${key}_${bucket}_${taipeiDate()}`);

  const used = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = (snap.exists ? (snap.get('count') as number) : 0) || 0;
    if (current >= limit) return null;
    tx.set(
      ref,
      {
        count: FieldValue.increment(1),
        // 可在 Firestore 對 expireAt 開啟 TTL，自動清掉舊紀錄
        expireAt: Timestamp.fromMillis(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      { merge: true }
    );
    return current + 1;
  });

  if (used === null) {
    if (bucket === 'distill') {
      return { ok: false, status: 429, error: '今天的學習背景分析次數已用完，明天會再更新' };
    }
    return {
      ok: false,
      status: 429,
      error: token
        ? `今天的 AI 使用次數（${limit} 次）已用完，明天再來`
        : `訪客今天的 AI 使用次數（${limit} 次）已用完，登入後可使用更多次`,
    };
  }
  return { ok: true, remaining: limit - used };
}
