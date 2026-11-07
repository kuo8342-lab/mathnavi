export type TemplateKind = 'coord' | 'quad' | 'gcd';

export type FlowNodeId =
  | 'photo'
  | 'dont_understand'
  | 'ai_explain'
  | 'congrats'
  | 'dont_know'
  | 'short_answer'
  | 'detailed_answer'
  | 'knowledge_points'
  | 'knowledge_videos'
  | 'knowledge_literature'
  | 'practice_dojo'
  | 'practice_same'
  | 'practice_extension';

export interface KeyTermExplanation {
  term: string;
  meaning: string;
}

export interface AIExplanationData {
  plainTranslation: string;
  givenConditions: string[];
  targetGoal: string;
  keyTerms: KeyTermExplanation[];
  starterHint: string;
}

export interface SolutionMethod {
  name: string;
  steps: string[];
}

export interface VideoResource {
  title: string;
  platform: string;
  durationHint?: string;
  summary: string;
  url: string;
  searchQuery?: string;
}

export interface LiteratureItem {
  title: string;
  category: string;
  content: string;
  commonMistake?: string;
  referenceUrl?: string;
}

export interface PracticeItem {
  q: string;
  a: string;
  steps: string[];
  concepts: string[];
  source?: 'local' | 'ai';
}

export type DrawingPoint = {
  x: number;
  y: number;
  label: string;
};

export type DrawingShortDivRow = {
  d: number;
  a: number;
  b: number;
};

export type DrawingSpec =
  | {
      type: 'points';
      points: DrawingPoint[];
      connect?: boolean;
      caption?: string;
    }
  | {
      type: 'function';
      expr: string;
      xmin: number;
      xmax: number;
      caption?: string;
    }
  | {
      type: 'shortdiv';
      rows: DrawingShortDivRow[];
      last: [number, number];
      caption?: string;
    };

export interface MathProblemData {
  id?: string;
  question: string;
  concept: string;
  kind?: TemplateKind | null;
  source: 'local' | 'ai';
  explanation: AIExplanationData;
  shortAnswer: string;
  thinkTip: string;
  steps: string[];
  methods: SolutionMethod[];
  principle: string;
  prequels: string[];
  sequels: string[];
  videos: VideoResource[];
  literature: LiteratureItem[];
  sameType: PracticeItem;
  extension: PracticeItem;
  drawing?: DrawingSpec | null;
  /** 只做過「看不懂」題意解釋、還沒真的解題（簡答、詳答是佔位內容） */
  explainOnly?: boolean;
  /** 題目是否能用國中方法解；「超出國中」時 levelNote 說明需要的高中觀念 */
  level?: '國中' | '超出國中';
  levelNote?: string;
  /** 對應 src/data/units.json 的均一單元 id，用來顯示真實影片、練習與歷屆會考題 */
  unitIds?: string[];
  /** 高中才會學到、較簡單的做法（只出現在知識點延伸，不放進簡答與詳答） */
  highSchoolNote?: string;
  /** AI 解題後，知識點與練功房內容的狀態（idle = 學生點開時才產生）；沒有這個欄位代表內容已完整 */
  enrichState?: 'idle' | 'loading' | 'ready' | 'failed';
}

export interface ReviewHistoryEntry {
  ok: boolean;
  sec: number;
  type: string | null;
  at: string;
  work: string;
  reason: string;
}

export interface SavedMistakeItem {
  id: string;
  question: string;
  answer: string;
  concept: string;
  steps: string[];
  methods: SolutionMethod[];
  thinkTip: string;
  principle: string;
  prequels: string[];
  sequels: string[];
  drawing?: DrawingSpec | null;
  source: 'local' | 'ai';
  kind?: TemplateKind | null;
  wrong: number;
  right: number;
  streak: number;
  consecutiveWrong?: number;
  attempts: number;
  totalTime: number;
  mastery: number;
  errorTypes: string[];
  lastErrorType: string | null;
  lastErrorReason: string;
  added: string;
  history: ReviewHistoryEntry[];
  sameType: PracticeItem;
  extension: PracticeItem;
  explanation?: AIExplanationData;
  videos?: VideoResource[];
  literature?: LiteratureItem[];
}
