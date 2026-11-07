import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { normalizeSaved } from './mathCore';
import type { SavedMistakeItem } from '../types/math';
import type { KnowledgeProfileNode, StudentLearningProfile } from '../types/learningProfile';

/**
 * Firestore 結構：
 *   users/{uid}/book/{itemId}   錯題（data 欄位存 JSON 字串）
 *   users/{uid}/data/profile    學習輪廓（data 欄位存 JSON 字串）
 * 用 JSON 字串存放可以避開 Firestore 不接受 undefined / 巢狀陣列等限制。
 */

function requireDb() {
  if (!db) throw new Error('尚未設定 Firebase');
  return db;
}

const bookCol = (uid: string) => collection(requireDb(), 'users', uid, 'book');
const profileDoc = (uid: string) => doc(requireDb(), 'users', uid, 'data', 'profile');

const fingerprint = (x: SavedMistakeItem) => x.question.replace(/\s/g, '') + '|' + x.concept;

function sortBook(items: SavedMistakeItem[]): SavedMistakeItem[] {
  return items.sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : 0));
}

function parseItem(raw: unknown): SavedMistakeItem | null {
  try {
    return normalizeSaved(JSON.parse(String(raw)));
  } catch {
    return null;
  }
}

/** 寫入錯題本的差異（新增／修改／刪除），每批最多 450 筆 */
export async function writeBookDiff(
  uid: string,
  prev: SavedMistakeItem[],
  next: SavedMistakeItem[]
): Promise<void> {
  const prevMap = new Map(prev.map((x) => [x.id, JSON.stringify(x)]));
  const nextIds = new Set(next.map((x) => x.id));
  const ops: Array<(b: ReturnType<typeof writeBatch>) => void> = [];

  for (const item of next) {
    const json = JSON.stringify(item);
    if (prevMap.get(item.id) !== json) {
      ops.push((b) => b.set(doc(bookCol(uid), item.id), { data: json, added: item.added }));
    }
  }
  for (const id of prevMap.keys()) {
    if (!nextIds.has(id)) ops.push((b) => b.delete(doc(bookCol(uid), id)));
  }

  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(requireDb());
    ops.slice(i, i + 450).forEach((op) => op(batch));
    await batch.commit();
  }
}

export function subscribeBook(uid: string, onChange: (items: SavedMistakeItem[]) => void): Unsubscribe {
  return onSnapshot(bookCol(uid), (snap) => {
    const items = snap.docs
      .map((d) => parseItem(d.get('data')))
      .filter((x): x is SavedMistakeItem => x !== null);
    onChange(sortBook(items));
  });
}

export async function saveProfile(uid: string, profile: StudentLearningProfile): Promise<void> {
  await setDoc(profileDoc(uid), { data: JSON.stringify(profile), updatedAt: profile.updatedAt });
}

export function subscribeProfile(
  uid: string,
  onChange: (profile: StudentLearningProfile) => void
): Unsubscribe {
  return onSnapshot(profileDoc(uid), (snap) => {
    if (!snap.exists()) return;
    try {
      const parsed = JSON.parse(String(snap.get('data')));
      if (parsed?.studentId && parsed.knowledgeProfile) onChange(parsed);
    } catch {
      // ignore broken document
    }
  });
}

/** 各知識點保留最近有作答紀錄的那一份 */
function mergeProfiles(
  cloud: StudentLearningProfile,
  local: StudentLearningProfile
): StudentLearningProfile {
  const byName = new Map<string, [string, KnowledgeProfileNode]>();
  for (const [id, node] of Object.entries(cloud.knowledgeProfile)) byName.set(node.knowledgeName, [id, node]);
  for (const [id, node] of Object.entries(local.knowledgeProfile)) {
    const existing = byName.get(node.knowledgeName);
    if (!existing) {
      byName.set(node.knowledgeName, [id, node]);
    } else if ((node.lastAttemptAt || '') > (existing[1].lastAttemptAt || '')) {
      byName.set(node.knowledgeName, [existing[0], { ...node, knowledgeId: existing[0] }]);
    }
  }
  return {
    ...cloud,
    updatedAt: new Date().toISOString(),
    knowledgeProfile: Object.fromEntries([...byName.values()]),
    learnerNotes: cloud.learnerNotes || local.learnerNotes || null,
    pendingTurns: [...(cloud.pendingTurns || []), ...(local.pendingTurns || [])].slice(-40),
  };
}

const hasActivity = (p: StudentLearningProfile) =>
  Object.values(p.knowledgeProfile).some((n) => n.lastAttemptAt) || Boolean(p.pendingTurns?.length);

/**
 * 首次登入時把「訪客模式」存在這台裝置的資料合併到雲端。
 * 已在雲端的錯題（題目＋觀念相同）不會重複加入。
 */
export async function mergeGuestDataIntoCloud(
  uid: string,
  guestBook: SavedMistakeItem[],
  guestProfile: StudentLearningProfile
): Promise<{ addedItems: number }> {
  const snap = await getDocs(bookCol(uid));
  const cloudBook = snap.docs
    .map((d) => parseItem(d.get('data')))
    .filter((x): x is SavedMistakeItem => x !== null);
  const known = new Set(cloudBook.map(fingerprint));
  const toAdd = guestBook.filter((x) => !known.has(fingerprint(x)));
  if (toAdd.length) await writeBookDiff(uid, [], toAdd);

  const profileSnap = await getDoc(profileDoc(uid));
  let cloudProfile: StudentLearningProfile | null = null;
  if (profileSnap.exists()) {
    try {
      cloudProfile = JSON.parse(String(profileSnap.get('data')));
    } catch {
      cloudProfile = null;
    }
  }
  if (!cloudProfile) {
    await saveProfile(uid, guestProfile);
  } else if (hasActivity(guestProfile)) {
    await saveProfile(uid, mergeProfiles(cloudProfile, guestProfile));
  }

  return { addedItems: toAdd.length };
}
