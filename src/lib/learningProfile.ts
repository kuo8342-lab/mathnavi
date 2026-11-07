import {
  EvidenceType,
  InteractionTurn,
  KnowledgeProfileNode,
  LearnerNotes,
  ProfileEvidence,
  SelfReportedDifficulty,
  StudentLearningProfile,
} from '../types/learningProfile';

const MAX_PENDING_TURNS = 40;
/** 累積幾筆互動就請 AI 更新一次學習背景 */
export const DISTILL_THRESHOLD = 4;

const PROFILE_STORAGE_KEY = 'mathnavi_student_profile_v1';

const DEFAULT_KNOWLEDGE_POINTS: Array<{ id: string; name: string }> = [
  { id: 'quad', name: '一元二次方程式' },
  { id: 'coord', name: '直角座標系與點的平移' },
  { id: 'gcd', name: '最大公因數與最小公倍數' },
  { id: 'linear_system', name: '二元一次聯立方程式' },
  { id: 'pythagorean', name: '畢氏定理與直角三角形' },
  { id: 'arithmetic_seq', name: '等差數列與等差級數' },
];

export function getOrCreateDefaultProfile(): StudentLearningProfile {
  let studentId = 'std_' + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();

  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.studentId === 'string' && parsed.knowledgeProfile) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  const knowledgeProfile: Record<string, KnowledgeProfileNode> = {};
  for (const kp of DEFAULT_KNOWLEDGE_POINTS) {
    knowledgeProfile[kp.id] = {
      knowledgeId: kp.id,
      knowledgeName: kp.name,
      correctCount: 0,
      wrongCount: 0,
      consecutiveWrong: 0,
      lastAttemptAt: null,
      selfReportedDifficulty: 'none',
      viewedResourceCount: 0,
      practiceCount: 0,
      masteryScore: 50, // 預設初始觀念中性評分 50
      evidence: [],
    };
  }

  const profile: StudentLearningProfile = {
    studentId,
    createdAt: now,
    updatedAt: now,
    knowledgeProfile,
  };

  saveStudentProfile(profile);
  return profile;
}

// 登入後學習輪廓改存雲端（見 cloudSync.ts），這時不寫入訪客的本機資料
let persistLocally = true;

export function setProfileLocalPersistence(enabled: boolean): void {
  persistLocally = enabled;
}

export function clearLocalStudentProfile(): void {
  try {
    localStorage.removeItem(PROFILE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function saveStudentProfile(profile: StudentLearningProfile): void {
  profile.updatedAt = new Date().toISOString();
  if (!persistLocally) return;
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function findOrCreateKnowledgeNode(
  profile: StudentLearningProfile,
  conceptName: string
): KnowledgeProfileNode {
  let matchedId = Object.keys(profile.knowledgeProfile).find(
    (id) =>
      profile.knowledgeProfile[id].knowledgeName === conceptName ||
      conceptName.includes(profile.knowledgeProfile[id].knowledgeName) ||
      profile.knowledgeProfile[id].knowledgeName.includes(conceptName)
  );

  if (!matchedId) {
    matchedId = 'kp_' + Math.random().toString(36).slice(2, 7);
    profile.knowledgeProfile[matchedId] = {
      knowledgeId: matchedId,
      knowledgeName: conceptName,
      correctCount: 0,
      wrongCount: 0,
      consecutiveWrong: 0,
      lastAttemptAt: null,
      selfReportedDifficulty: 'none',
      viewedResourceCount: 0,
      practiceCount: 0,
      masteryScore: 50,
      evidence: [],
    };
  }

  return profile.knowledgeProfile[matchedId];
}

const EVIDENCE_CONFIG: Record<
  EvidenceType,
  { priority: 1 | 2 | 3 | 4 | 5 | 6 | 7; weight: number }
> = {
  actual_answer_wrong: { priority: 1, weight: 5.0 }, // 1. 實際答題錯誤
  error_step: { priority: 2, weight: 4.0 },           // 2. 錯誤步驟
  consecutive_error: { priority: 3, weight: 4.5 },    // 3. 重複錯誤
  self_reported_difficulty: { priority: 4, weight: 3.0 }, // 4. 主動表示「不會／看不懂」
  practice_result: { priority: 5, weight: 3.5 },      // 5. 練習題結果
  resource_viewed: { priority: 6, weight: 1.0 },      // 6. 學習資源觀看 (弱訊號)
  simple_click: { priority: 7, weight: 0.2 },         // 7. 單純點擊 (最弱訊號)
};

/**
 * 核心訊號紀錄函式，嚴格遵照權重排序：
 * 1. 實際答題錯誤 (actual_answer_wrong)
 * 2. 錯誤步驟 (error_step)
 * 3. 重複錯誤 (consecutive_error)
 * 4. 學生主動表示「不會／看不懂」 (self_reported_difficulty)
 * 5. 練習題結果 (practice_result)
 * 6. 學習資源觀看 (resource_viewed - 弱訊號)
 * 7. 單純點擊 (simple_click - 最弱訊號)
 */
export function recordProfileSignal(
  profile: StudentLearningProfile,
  conceptName: string,
  type: EvidenceType,
  payload: {
    summary: string;
    detail?: string;
    isCorrect?: boolean;
    difficulty?: SelfReportedDifficulty;
    errorCategory?: string;
  }
): StudentLearningProfile {
  const node = findOrCreateKnowledgeNode(profile, conceptName);
  const now = new Date().toISOString();
  node.lastAttemptAt = now;

  const cfg = EVIDENCE_CONFIG[type];
  let scoreDelta = 0;

  switch (type) {
    case 'actual_answer_wrong': {
      // 1. 實際答題錯誤 (最高優先級負信號)
      node.wrongCount += 1;
      node.consecutiveWrong += 1;
      scoreDelta = -18;
      node.masteryScore = Math.max(0, Math.min(100, node.masteryScore + scoreDelta));
      break;
    }

    case 'error_step': {
      // 2. 錯誤步驟
      scoreDelta = -8;
      node.masteryScore = Math.max(0, Math.min(100, node.masteryScore + scoreDelta));
      break;
    }

    case 'consecutive_error': {
      // 3. 重複錯誤 (連續答錯)
      scoreDelta = -14;
      node.masteryScore = Math.max(0, Math.min(100, node.masteryScore + scoreDelta));
      break;
    }

    case 'self_reported_difficulty': {
      // 4. 學生主動表示「不會／看不懂」
      if (payload.difficulty) {
        node.selfReportedDifficulty = payload.difficulty;
      }
      // 不會過度扣分，但留下主動卡點紀錄
      scoreDelta = -4;
      node.masteryScore = Math.max(0, Math.min(100, node.masteryScore + scoreDelta));
      break;
    }

    case 'practice_result': {
      // 5. 練習題結果
      node.practiceCount += 1;
      if (payload.isCorrect) {
        node.correctCount += 1;
        node.consecutiveWrong = 0;
        scoreDelta = +12;
      } else {
        node.wrongCount += 1;
        node.consecutiveWrong += 1;
        scoreDelta = -12;
      }
      node.masteryScore = Math.max(0, Math.min(100, node.masteryScore + scoreDelta));
      break;
    }

    case 'resource_viewed': {
      // 6. 學習資源觀看 (弱訊號：僅記錄瀏覽次數與弱正向微調，不作為學會保證)
      node.viewedResourceCount += 1;
      scoreDelta = +1; // 極微小探索分
      node.masteryScore = Math.max(0, Math.min(100, node.masteryScore + scoreDelta));
      break;
    }

    case 'simple_click': {
      // 7. 單純點擊 (最弱訊號：不影響 masteryScore)
      scoreDelta = 0;
      break;
    }
  }

  const evidence: ProfileEvidence = {
    id: 'ev_' + Math.random().toString(36).slice(2, 9),
    type,
    priority: cfg.priority,
    weight: cfg.weight,
    timestamp: now,
    summary: payload.summary,
    detail: payload.detail,
    scoreDelta,
  };

  // 保留最新的 60 筆證據記錄
  node.evidence = [evidence, ...node.evidence].slice(0, 60);

  saveStudentProfile(profile);
  return { ...profile };
}


const clip = (s: string | undefined, n: number) => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n) + '…' : t;
};

/** 記錄一次互動，等累積到 DISTILL_THRESHOLD 筆再交給 AI 濃縮 */
export function appendInteraction(
  profile: StudentLearningProfile,
  turn: Omit<InteractionTurn, 'at'>
): StudentLearningProfile {
  const entry: InteractionTurn = {
    ...turn,
    at: new Date().toISOString(),
    question: clip(turn.question, 300),
    studentText: clip(turn.studentText, 500),
    aiText: turn.aiText ? clip(turn.aiText, 600) : undefined,
  };
  const next: StudentLearningProfile = {
    ...profile,
    pendingTurns: [...(profile.pendingTurns || []), entry].slice(-MAX_PENDING_TURNS),
  };
  saveStudentProfile(next);
  return next;
}

/** 寫入 AI 濃縮後的學習背景，並移除已經被濃縮的互動紀錄 */
export function applyLearnerNotes(
  profile: StudentLearningProfile,
  notes: Omit<LearnerNotes, 'updatedAt' | 'distilledTurns'>,
  consumedTurns: InteractionTurn[]
): StudentLearningProfile {
  const consumed = new Set(consumedTurns.map((t) => t.at));
  const next: StudentLearningProfile = {
    ...profile,
    learnerNotes: {
      ...notes,
      updatedAt: new Date().toISOString(),
      distilledTurns: (profile.learnerNotes?.distilledTurns || 0) + consumedTurns.length,
    },
    pendingTurns: (profile.pendingTurns || []).filter((t) => !consumed.has(t.at)),
  };
  saveStudentProfile(next);
  return next;
}

export function clearLearnerNotes(profile: StudentLearningProfile): StudentLearningProfile {
  const next: StudentLearningProfile = { ...profile, learnerNotes: null, pendingTurns: [] };
  saveStudentProfile(next);
  return next;
}

/** 給 AI 濃縮用的客觀數據：各單元掌握度、正確率、練習耗時 */
export function buildProfileStats(profile: StudentLearningProfile): string {
  const nodes = Object.values(profile.knowledgeProfile)
    .filter((n) => n.lastAttemptAt || n.wrongCount || n.practiceCount)
    .map((n) => {
      const attempts = n.correctCount + n.wrongCount;
      const acc = attempts ? Math.round((n.correctCount / attempts) * 100) + '%' : '無';
      return `- ${n.knowledgeName}：掌握度 ${n.masteryScore}/100，答對 ${n.correctCount}、答錯 ${n.wrongCount}（正確率 ${acc}），連錯 ${n.consecutiveWrong}，練習 ${n.practiceCount} 次，自評難度 ${n.selfReportedDifficulty}`;
    });
  const timed = (profile.pendingTurns || []).filter((t) => t.kind === 'practice' && t.seconds);
  const avgSec = timed.length
    ? Math.round(timed.reduce((s, t) => s + (t.seconds || 0), 0) / timed.length)
    : null;
  return [
    nodes.length ? nodes.join('\n') : '（尚無作答數據）',
    avgSec !== null ? `本批練習平均作答時間：${avgSec} 秒（${timed.length} 題）` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const PACE_TEXT: Record<string, string> = {
  fast: '學得快',
  steady: '穩定進步',
  needs_time: '需要多一點時間',
  unknown: '尚未判斷',
};

/**
 * 只把與目前題目最相關的少量學習背景交給 AI。
 * Learning Profile 是輔助證據，不應覆蓋目前題目的內容。
 */
export function buildPersonalizedContext(
  profile: StudentLearningProfile,
  currentConcept: string,
  limit = 5
): string {
  const concept = currentConcept.trim().toLowerCase();
  const nodes = Object.values(profile.knowledgeProfile)
    .map((node) => {
      const name = node.knowledgeName.toLowerCase();
      const conceptMatch = concept && (name.includes(concept) || concept.includes(name));
      const evidenceScore =
        node.wrongCount * 5 +
        node.consecutiveWrong * 4 +
        (node.selfReportedDifficulty === 'unintelligible' ? 4 :
          node.selfReportedDifficulty === 'high' ? 3 :
          node.selfReportedDifficulty === 'medium' ? 2 : 0) +
        node.practiceCount * 0.5;
      return {
        node,
        priority: (conceptMatch ? 100 : 0) + evidenceScore + (100 - node.masteryScore) * 0.3,
      };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit);

  const notes = profile.learnerNotes;
  const notesLines: string[] = [];
  if (notes) {
    notesLines.push(
      'AI 學習背景（從過去對話與作答濃縮）：',
      `- 整體：${notes.summary}`,
      `- 學習節奏：${PACE_TEXT[notes.pace] || notes.pace}${notes.paceNote ? `（${notes.paceNote}）` : ''}`
    );
    if (notes.preferredStyle) notesLines.push(`- 適合的講解方式：${notes.preferredStyle}`);
    if (notes.strengths.length) notesLines.push(`- 已掌握：${notes.strengths.join('、')}`);
    const related = notes.misconceptions.filter(
      (m) => concept && (m.concept.toLowerCase().includes(concept) || concept.includes(m.concept.toLowerCase()))
    );
    const shown = [...related, ...notes.misconceptions.filter((m) => !related.includes(m))].slice(0, 4);
    if (shown.length) {
      notesLines.push('- 常見迷思：' + shown.map((m) => `${m.concept}：${m.note}`).join('；'));
    }
    if (notes.growthPath.length) {
      notesLines.push('- 目前成長路徑：' + notes.growthPath.slice(0, 3).map((g) => g.concept).join(' → '));
    }
  }

  if (!nodes.length && !notesLines.length) return '';

  const lines = nodes.map(({ node }, index) => {
    const reasons: string[] = [];
    if (node.wrongCount > 0) reasons.push(`答錯 ${node.wrongCount} 次`);
    if (node.consecutiveWrong > 0) reasons.push(`連續錯 ${node.consecutiveWrong} 次`);
    if (node.selfReportedDifficulty !== 'none') reasons.push(`主動回報難度：${node.selfReportedDifficulty}`);
    return `${index + 1}. ${node.knowledgeName}｜掌握度 ${node.masteryScore}/100｜${reasons.join('、') || '目前缺乏強烈負面證據'}`;
  });

  return [
    'PERSONALIZED LEARNING CONTEXT:',
    '以下是學生過去的學習證據，只能用來調整教學方式，不可取代目前題目的判斷。',
    ...lines,
    ...notesLines,
    '若學生對某概念反覆出錯，優先補充必要前置觀念；若已掌握，避免重複過度基礎的說明。',
    '補充內容（知識點、影片關鍵字、文獻、練習題）請針對這位學生的迷思與節奏挑選：節奏慢就拆細步驟、多給先備觀念；節奏快就給延伸挑戰。',
  ].join('\n');
}
