export type EvidenceType =
  | 'actual_answer_wrong'      // 1. 實際答題錯誤 (最高權重強信號)
  | 'error_step'               // 2. 錯誤步驟 (診斷之特定卡點)
  | 'consecutive_error'        // 3. 重複錯誤 (連續答錯，顯示概念未通)
  | 'self_reported_difficulty' // 4. 學生主動表示「不會／看不懂」
  | 'practice_result'          // 5. 練習題結果 (練功房作答)
  | 'resource_viewed'          // 6. 學習資源觀看 (影片或文獻，弱信號)
  | 'simple_click';            // 7. 單純點擊 (瀏覽知識點，最弱信號)

export interface ProfileEvidence {
  id: string;
  type: EvidenceType;
  priority: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  weight: number;
  timestamp: string;
  summary: string;
  detail?: string;
  scoreDelta?: number;
}

export type SelfReportedDifficulty = 'none' | 'low' | 'medium' | 'high' | 'unintelligible';

export interface KnowledgeProfileNode {
  knowledgeId: string;
  knowledgeName: string;
  correctCount: number;
  wrongCount: number;
  consecutiveWrong: number;
  lastAttemptAt: string | null;
  selfReportedDifficulty: SelfReportedDifficulty;
  viewedResourceCount: number;
  practiceCount: number;
  masteryScore: number; // 0 - 100
  evidence: ProfileEvidence[];
}

/** 學生與 AI 的一次互動（對話追問、練習作答…），累積後交給 AI 濃縮成學習背景 */
export interface InteractionTurn {
  at: string;
  kind: 'ask' | 'explain_request' | 'practice';
  concept: string;
  question: string;
  studentText: string;
  aiText?: string;
  isCorrect?: boolean;
  seconds?: number;
}

export type LearningPace = 'fast' | 'steady' | 'needs_time' | 'unknown';

/** AI 從互動紀錄濃縮出的學習背景（類似一份不斷更新的個人學習筆記） */
export interface LearnerNotes {
  summary: string;
  pace: LearningPace;
  paceNote: string;
  preferredStyle: string;
  strengths: string[];
  misconceptions: Array<{ concept: string; note: string }>;
  growthPath: Array<{ concept: string; reason: string }>;
  updatedAt: string;
  distilledTurns: number;
}

export interface StudentLearningProfile {
  studentId: string;
  createdAt: string;
  updatedAt: string;
  knowledgeProfile: Record<string, KnowledgeProfileNode>;
  learnerNotes?: LearnerNotes | null;
  pendingTurns?: InteractionTurn[];
}
