import crypto from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from './usageGuard';

/**
 * 解題答案快取（只有伺服器能讀寫，見 firestore.rules）。
 *
 * 品質把關：模型第一次解出的答案只是「候選」，不會直接當成標準答案。
 * 下一個問同一題的人會重新解一次，簡答一致才升級成「已驗證」，之後的人直接拿快取、不再呼叫模型；
 * 兩次不一致就丟掉候選，避免把錯答案存下來。
 * 只存題目文字與解答，不存是誰問的。
 */

export type CacheEntry = { status: 'candidate' | 'verified'; result: any };

const COLLECTION = 'answerCache';

// 只留文字內容：統一全形半形、去掉空白與常見標點，同一題不同排版會得到同一個鍵
export function normalizeQuestion(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s​　]+/g, '')
    .replace(/[，。,.;；:：、]/g, '')
    .replace(/\$/g, '');
}

export const questionKey = (text: string) =>
  crypto.createHash('sha256').update(normalizeQuestion(text)).digest('hex').slice(0, 40);

export const normalizeAnswer = (text: unknown) =>
  normalizeQuestion(String(text ?? '')).replace(/[()（）]/g, '');

function db() {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

export async function readCache(question: string): Promise<CacheEntry | null> {
  const store = db();
  if (!store || !normalizeQuestion(question)) return null;
  try {
    const snap = await store.collection(COLLECTION).doc(questionKey(question)).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    if (!data?.result) return null;
    return { status: data.status === 'verified' ? 'verified' : 'candidate', result: data.result };
  } catch (err) {
    console.warn('[answerCache] 讀取失敗，改為直接解題');
    return null;
  }
}

export async function writeCache(question: string, status: CacheEntry['status'], result: any) {
  const store = db();
  if (!store || !normalizeQuestion(question)) return;
  try {
    await store
      .collection(COLLECTION)
      .doc(questionKey(question))
      .set({ status, result, updatedAt: Date.now() });
  } catch {
    console.warn('[answerCache] 寫入失敗（不影響解題）');
  }
}

export async function dropCache(question: string) {
  const store = db();
  if (!store) return;
  try {
    await store.collection(COLLECTION).doc(questionKey(question)).delete();
  } catch {
    /* 忽略 */
  }
}
