import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  Crop,
  Trash2,
  Mic,
  RotateCcw,
  HelpCircle,
  BookOpen,
  CheckCircle2,
  Sparkles,
  FileText,
  Video,
  BookMarked,
  Dumbbell,
  BookmarkPlus,
  Send,
  ExternalLink,
  RefreshCw,
  Timer,
  ChevronRight,
  ChevronLeft,
  Keyboard,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import {
  FlowNodeId,
  MathProblemData,
  PracticeItem,
  TemplateKind,
} from '../types/math';
import { callMathApi } from '../lib/mathApi';
import {
  SAMPLE_PROBLEMS,
  generateCoordPractice,
  generateGcdPractice,
  generateQuadPractice,
  makeData,
  normalizeAIProblem,
  parseText,
} from '../lib/mathCore';
import { MathText } from './MathText';
import { MathDiagram } from './MathDiagram';
import { FlowchartMap } from './FlowchartMap';
import { ImageCropModal } from './ImageCropModal';
import { UnitResources } from './UnitResources';
import { EvidenceType, InteractionTurn, SelfReportedDifficulty } from '../types/learningProfile';

interface FlowWorkspaceProps {
  problemData: MathProblemData | null;
  activeNode: FlowNodeId;
  dark: boolean;
  onChangeProblemData: (data: MathProblemData | null) => void;
  onChangeActiveNode: (node: FlowNodeId) => void;
  onSaveMistake: (item: {
    question: string;
    shortAnswer: string;
    concept: string;
    steps: string[];
    source: 'local' | 'ai';
    drawing?: any;
  }) => void;
  personalizationContext?: string;
  onRecordSignal?: (
    concept: string,
    type: EvidenceType,
    payload: {
      summary: string;
      detail?: string;
      isCorrect?: boolean;
      difficulty?: SelfReportedDifficulty;
      errorCategory?: string;
    }
  ) => void;
  /** 記錄與 AI 的對話、練習作答，之後濃縮成個人學習背景 */
  onLogInteraction?: (turn: Omit<InteractionTurn, 'at'>) => void;
  onToast: (msg: string) => void;
  /** 首頁方塊用：錯題本待複習數量與最近加入的題目 */
  bookSummary?: {
    toReview: number;
    concepts: string[];
    recent: Array<{ id: string; question: string; concept: string }>;
  };
  onOpenBook?: () => void;
  onOpenRecent?: (id: string) => void;
}

export const FlowWorkspace: React.FC<FlowWorkspaceProps> = ({
  problemData,
  activeNode,
  dark,
  onChangeProblemData,
  onChangeActiveNode,
  onSaveMistake,
  personalizationContext,
  onRecordSignal,
  onLogInteraction,
  onToast,
  bookSummary,
  onOpenBook,
  onOpenRecent,
}) => {
  const [inputText, setInputText] = useState<string>(problemData?.question || '');
  const [showTyping, setShowTyping] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [showDiagram, setShowDiagram] = useState(false);
  // 題目被截成四行時才顯示「看完整題目」
  const questionRef = useRef<HTMLDivElement | null>(null);
  const [questionClamped, setQuestionClamped] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);

  // 詳答控制
  const [methodIdx, setMethodIdx] = useState(0);
  const [visibleSteps, setVisibleSteps] = useState(1);

  // AI 解釋與詳答追問
  const [studentScratch, setStudentScratch] = useState('');
  const [showCongratsAnswer, setShowCongratsAnswer] = useState(false);
  const [followUpQuery, setFollowUpQuery] = useState('');
  const [followUpReply, setFollowUpReply] = useState('');
  const [askingFollowUp, setAskingFollowUp] = useState(false);

  // 練功房互動狀態
  const [practiceWork, setPracticeWork] = useState('');
  const [showPracticeAns, setShowPracticeAns] = useState(false);
  const [practiceSec, setPracticeSec] = useState(0);
  const [practiceTimerRunning, setPracticeTimerRunning] = useState(false);
  const [generatingPractice, setGeneratingPractice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const problemRef = useRef(problemData);
  problemRef.current = problemData;

  // 只在換了一道題時才重置畫面狀態；背景補上知識點與練功房時不清掉學生正在看的內容
  const problemKey = problemData ? `${problemData.question}\u0000${problemData.shortAnswer}` : '';

  useEffect(() => {
    if (problemData) {
      // 只解釋過題意的照片題沒有真正的題目文字，不要把佔位文字蓋進輸入框
      if (!(problemData.explainOnly && imageUri)) setInputText(problemData.question);
      setMethodIdx(0);
      const firstMethodSteps =
        problemData.methods?.[0]?.steps?.length || problemData.steps.length || 1;
      setVisibleSteps(firstMethodSteps);
      setFollowUpReply('');
      setFollowUpQuery('');
      setStudentScratch('');
      setShowCongratsAnswer(false);
      setQuestionOpen(false);
    } else {
      // 開新題目（拍新題目、清空）：上一題的文字與照片一起清掉
      setInputText('');
      setImageUri(null);
      setShowTyping(false);
    }
  }, [problemKey]);

  useEffect(() => {
    setPracticeWork('');
    setShowPracticeAns(false);
    setPracticeSec(0);
    setPracticeTimerRunning(false);
  }, [activeNode, problemKey]);

  useEffect(() => {
    if (!practiceTimerRunning) return;
    const t = setInterval(() => {
      setPracticeSec((s) => s + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [practiceTimerRunning]);

  // 支援 Ctrl+V 貼上題目截圖
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = [...(e.clipboardData?.items || [])];
      const imgItem = items.find((x) => x.type.startsWith('image/'));
      if (imgItem) {
        const file = imgItem.getAsFile();
        if (file) {
          e.preventDefault();
          handleImageFile(file);
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const buildProfileContext = () => personalizationContext?.trim() || '';

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      onToast('圖片請小於 10 MB');
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('讀取圖片失敗'));
        reader.readAsDataURL(file);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('圖片解碼失敗'));
        i.src = dataUrl;
      });

      const ratio = Math.min(1, 1600 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.width * ratio));
      cv.height = Math.max(1, Math.round(img.height * ratio));
      const ctx = cv.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
      }
      const compressed = cv.toDataURL('image/jpeg', 0.88);
      setImageUri(compressed);
      // 換了新照片：輸入框若還是上一題的文字就清掉，免得新照片配舊題目一起送出
      setInputText((prev) =>
        prev.trim() && prev.trim() === (problemRef.current?.question || '').trim() ? '' : prev
      );
      // 在解題結果頁貼上圖片時也回到首頁，讓學生看得到照片預覽與按鈕
      onChangeActiveNode('photo');
      onToast('已載入題目照片！按「解題」或「看不懂題目」繼續。');
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : '圖片處理失敗');
    }
  };

  // 解析或呼叫 AI 取得題目完整資料，並切換到指定流程圖節點
  const resolveProblemAndNavigate = async (targetNode: FlowNodeId) => {
    const trimmed = inputText.trim();
    if (!trimmed && !imageUri) {
      onToast('請先拍照／上傳題目圖片，或輸入題目文字！');
      return;
    }

    if (loadingMsg) return;

    if (targetNode === 'ai_explain' || targetNode === 'dont_understand') {
      onRecordSignal?.(
        problemData?.concept || '待分類題目',
        'self_reported_difficulty',
        {
          summary: '學生主動表示看不懂題意，請求 AI 解釋',
          difficulty: 'unintelligible',
          detail: trimmed,
        }
      );
      onLogInteraction?.({
        kind: 'explain_request',
        concept: problemData?.concept || '待分類題目',
        question: trimmed || '（圖片題目）',
        studentText: '',
      });
    } else if (
      targetNode === 'short_answer' ||
      targetNode === 'dont_know' ||
      targetNode === 'detailed_answer'
    ) {
      onRecordSignal?.(
        problemData?.concept || '待分類題目',
        'self_reported_difficulty',
        {
          summary: '學生表示不會解題，進入解題模組',
          difficulty: 'high',
          detail: trimmed,
        }
      );
    } else if (
      targetNode === 'knowledge_points' ||
      targetNode === 'knowledge_videos' ||
      targetNode === 'knowledge_literature'
    ) {
      onRecordSignal?.(problemData?.concept || '知識點', 'simple_click', {
        summary: '點擊瀏覽知識點（弱訊號）',
      });
    }

    // 已有相同題目的解析結果時，直接切換，不重複呼叫 AI。
    if (
      problemData &&
      !problemData.explainOnly &&
      problemData.question.trim() === trimmed &&
      !imageUri &&
      targetNode !== 'ai_explain' &&
      targetNode !== 'dont_understand'
    ) {
      onChangeActiveNode(targetNode);
      return;
    }

    // 先嘗試本機可驗證題型；不需要 AI 的題目不浪費網路請求。
    const parsedLocal =
      targetNode !== 'ai_explain' && targetNode !== 'dont_understand'
        ? parseText(trimmed)
        : null;
    if (parsedLocal && !imageUri) {
      const data = makeData(parsedLocal.kind, parsedLocal.values);
      onChangeProblemData(data);
      onChangeActiveNode(targetNode);
      return;
    }

    setLoadingMsg(
      imageUri
        ? targetNode === 'ai_explain' || targetNode === 'dont_understand'
          ? '正在讀取照片並用 AI 解釋題意…'
          : '正在讀取照片並辨識題目、整理解題流程…'
        : '正在整理題目並產生解題流程…'
    );

    try {
      let questionForAI = trimmed;
      let imagePayload: Record<string, unknown> | undefined;
      if (imageUri) {
        const comma = imageUri.indexOf(',');
        const header = comma >= 0 ? imageUri.slice(5, comma) : 'image/jpeg';
        imagePayload = {
          mime: header.replace(';base64', '') || 'image/jpeg',
          data: comma >= 0 ? imageUri.slice(comma + 1) : imageUri,
        };
      }

      if (targetNode === 'ai_explain' || targetNode === 'dont_understand') {
        const result = await callMathApi<{
          plainTranslation: string;
          givenConditions: string[];
          targetGoal: string;
          keyTerms: Array<{ term: string; meaning: string }>;
          starterHint: string;
        }>('explain', {
          question: questionForAI,
          image: imagePayload,
          profileContext: buildProfileContext(),
        });
        // 同一題（沒換照片、文字相同）才沿用已有的解題結果；新題目一律從頭建立，避免帶到上一題的答案
        const reuse = Boolean(problemData && !imageUri && problemData.question.trim() === trimmed);
        const base = reuse && problemData ? problemData : normalizeAIProblem(
          {
            question: questionForAI || '圖片中的數學題目',
            concept: '國中數學題意理解',
            explanation: result,
            shortAnswer: '請先完成題意理解，再進入解題。',
            thinkTip: result.starterHint,
            methods: [{ name: '題意拆解', steps: [result.starterHint] }],
            principle: '先理解條件與目標，再選擇適合的數學方法。',
            prequels: [],
            sequels: [],
          },
          questionForAI
        );
        onChangeProblemData({
          ...base,
          question: questionForAI || base.question,
          explanation: result,
          explainOnly: reuse ? base.explainOnly : true,
        });
        onChangeActiveNode(targetNode);
        return;
      }

      const result = await callMathApi<MathProblemData>('solve', {
        question: questionForAI,
        image: imagePayload,
        profileContext: buildProfileContext(),
      });
      // 知識點與練功房等學生點開時才產生，只看簡答、詳答的人不必多花一次 AI 額度
      onChangeProblemData({ ...normalizeAIProblem(result, questionForAI), enrichState: 'idle' });
      onChangeActiveNode(targetNode);
      // 照片已經辨識成題目文字了，清掉照片，下一題才不會被舊照片帶著走
      setImageUri(null);
      return;
    } catch (error) {
      // AI 失敗時仍保留本機題型與通用引導，Demo 不會整頁失效。
      if (trimmed) {
        const parsedLocal = parseText(trimmed);
        if (parsedLocal) {
          const data = makeData(parsedLocal.kind, parsedLocal.values);
          onChangeProblemData(data);
          onChangeActiveNode(targetNode);
          onToast('AI 暫時無法連線，已切換本機數學引擎。');
          return;
        }
      }
      onToast(
        error instanceof Error
          ? `${error.message}，已使用本機引導。`
          : 'AI 暫時無法連線，已使用本機引導。'
      );
    } finally {
      setLoadingMsg(null);
    }

    const fallback = normalizeAIProblem(
      {
        question: trimmed || '相片或輸入之題目',
        concept: 'AI 暫時忙碌',
        explanation: {
          plainTranslation: `⚠️ AI 目前負載過高，無法即時解析這道題目。\n\n你可以用下方「💬 追問 AI」輸入框，直接把題目貼進去問 AI，追問功能比完整解析輕量，通常能正常回應。`,
          givenConditions: [
            '請稍後再按一次「解題」重新嘗試。',
            '或使用下方追問功能直接問 AI：把題目貼進追問框，例如「幫我解釋並示範解法」。',
          ],
          targetGoal: '等 AI 恢復後，重新按「解題」就能看到完整步驟。',
          keyTerms: [],
          starterHint: '現在可以先用追問框問 AI：把題目貼上去，例如「請幫我解這題並說明步驟」。',
        },
        shortAnswer: '⚠️ AI 暫時無法回應，請用追問功能或稍後重試。',
        thinkTip: '用追問框把題目貼給 AI，通常幾秒就能回應。',
        methods: [{ name: '暫時使用追問功能', steps: ['在下方追問輸入框貼上題目文字。', '問 AI「請幫我示範解法」。', '等 AI 恢復後再按「解題」取得完整步驟。'] }],
        principle: 'AI 服務（gemini-3.8-flash）目前遭遇高流量，完整 JSON 解析需要較多資源，追問功能使用資源較少，通常仍可正常回應。',
        prequels: [],
        sequels: [],
      },
      trimmed
    );
    onChangeProblemData(fallback);
    onChangeActiveNode(targetNode);
    setLoadingMsg(null);
  };

  // 只做過題意解釋時，簡答與詳答還是佔位內容：先真的解題，再切到指定分頁
  const goSolved = (node: FlowNodeId) => {
    if (problemData?.explainOnly) void resolveProblemAndNavigate(node);
    else onChangeActiveNode(node);
  };

  const saveCurrentMistake = () => {
    if (!problemData) return;
    if (problemData.explainOnly) {
      onToast('這題還沒解出答案，先按「解題」再加入錯題本');
      return;
    }
    onSaveMistake({
      question: problemData.question,
      shortAnswer: problemData.shortAnswer,
      concept: problemData.concept,
      steps: problemData.steps,
      source: problemData.source,
      drawing: problemData.drawing,
    });
  };

  // 簡答與詳解先顯示，知識點、影片、文獻與練功房題目另外補上
  const runEnrich = async (base: MathProblemData) => {
    onChangeProblemData({ ...base, enrichState: 'loading' });
    const isStale = () => problemRef.current?.question !== base.question;
    try {
      const extra = await callMathApi<Partial<MathProblemData>>('enrich', {
        question: base.question,
        concept: base.concept,
        shortAnswer: base.shortAnswer,
        profileContext: buildProfileContext(),
      });
      if (isStale()) return;
      onChangeProblemData({
        ...normalizeAIProblem({ ...base, ...extra }, base.question),
        enrichState: 'ready',
      });
    } catch {
      if (isStale()) return;
      onChangeProblemData({ ...base, enrichState: 'failed' });
    }
  };

  const handleLoadSample = (sample: (typeof SAMPLE_PROBLEMS)[number]) => {
    setImageUri(null);
    setInputText(sample.question);
    const data = makeData(sample.kind, sample.values);
    onChangeProblemData(data);
    onChangeActiveNode('photo');
    onToast(`已載入範例：${sample.label}，按「解題」或「看不懂題目」繼續`);
  };

  const handleVoiceInput = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      onToast('目前瀏覽器不支援語音輸入，請直接輸入文字或拍照上傳。');
      return;
    }
    const r = new SR();
    r.lang = 'zh-TW';
    r.interimResults = false;
    r.onresult = (e: any) => {
      const transcript = e.results?.[0]?.[0]?.transcript;
      if (transcript) {
        setInputText(transcript);
        onToast('已完成語音輸入！');
      }
    };
    r.onerror = () => onToast('語音辨識未完成，請重試。');
    r.start();
  };

  const handleAskFollowUp = async () => {
    const q = followUpQuery.trim();
    if (!q || !problemData) return;
    setAskingFollowUp(true);
    try {
      const result = await callMathApi<{ message: string }>('ask', {
        question: problemData.question,
        context: `${problemData.concept}
${problemData.principle || ''}`,
        query: q,
        profileContext: buildProfileContext(),
      });
      setFollowUpReply(result.message || 'AI 暫時沒有產生回覆。');
      if (result.message) {
        onLogInteraction?.({
          kind: 'ask',
          concept: problemData.concept,
          question: problemData.question,
          studentText: q,
          aiText: result.message,
        });
      }
    } catch {
      setFollowUpReply(
        `目前 AI 暫時無法連線。你可以先依照提示思考：${problemData.thinkTip || '先找出已知條件與所求。'}`
      );
      onToast('AI 暫時無法連線，已保留本機引導。');
    } finally {
      setAskingFollowUp(false);
    }
  };

  const handleRefreshPractice = async (mode: 'sameType' | 'extension') => {
    if (!problemData) return;
    setGeneratingPractice(true);
    setPracticeWork('');
    setShowPracticeAns(false);
    setPracticeSec(0);
    setPracticeTimerRunning(false);
    try {
      const result = await callMathApi<PracticeItem>('practice', {
        question: problemData.question,
        concept: problemData.concept,
        mode,
        profileContext: buildProfileContext(),
      });
      onChangeProblemData({
        ...problemData,
        sameType: mode === 'sameType' ? result : problemData.sameType,
        extension: mode === 'extension' ? result : problemData.extension,
      });
      onToast(`AI 已產生新的「${mode === 'sameType' ? '同類型' : '延伸'}」練習題！`);
    } catch {
      const kind: TemplateKind | null | undefined = problemData.kind;
      const gen =
        kind === 'coord'
          ? generateCoordPractice()
          : kind === 'gcd'
          ? generateGcdPractice()
          : generateQuadPractice();
      onChangeProblemData({
        ...problemData,
        sameType: mode === 'sameType' ? gen.sameType : problemData.sameType,
        extension: mode === 'extension' ? gen.extension : problemData.extension,
      });
      onToast('AI 暫時無法連線，已改用本機練習題。');
    } finally {
      setGeneratingPractice(false);
    }
  };

  const activeMethods = problemData?.methods?.length
    ? problemData.methods
    : [{ name: '標準詳解', steps: problemData?.steps || [] }];
  const currentMethodSteps =
    activeMethods[methodIdx]?.steps || problemData?.steps || [];

  const isDontKnowHub =
    activeNode === 'dont_know' ||
    activeNode === 'short_answer' ||
    activeNode === 'detailed_answer' ||
    activeNode === 'knowledge_points' ||
    activeNode === 'knowledge_videos' ||
    activeNode === 'knowledge_literature' ||
    activeNode === 'practice_dojo' ||
    activeNode === 'practice_same' ||
    activeNode === 'practice_extension';

  const currentPracticeItem: PracticeItem | null = problemData
    ? activeNode === 'practice_extension'
      ? problemData.extension
      : problemData.sameType
    : null;

  const enrichPending =
    problemData?.enrichState === 'idle' ||
    problemData?.enrichState === 'loading' ||
    problemData?.enrichState === 'failed';
  const isEnrichNode =
    activeNode === 'knowledge_points' ||
    activeNode === 'knowledge_videos' ||
    activeNode === 'knowledge_literature' ||
    activeNode === 'practice_dojo' ||
    activeNode === 'practice_same' ||
    activeNode === 'practice_extension';

  useEffect(() => {
    if (isEnrichNode && problemData?.enrichState === 'idle') void runEnrich(problemData);
  }, [isEnrichNode, problemData?.enrichState]);

  useEffect(() => {
    const el = questionRef.current;
    setQuestionClamped(Boolean(el && !questionOpen && el.scrollHeight > el.clientHeight + 1));
  }, [problemKey, questionOpen, activeNode]);

  // 首頁（還沒開始解題）與解題結果是兩個畫面，手機上各自一屏放完
  const isHome = !problemData || activeNode === 'photo';
  const hasInput = Boolean(imageUri || inputText.trim());
  // 正在輸入題目時把拍照方塊縮小、收起範例題，手機上仍然一屏放完
  const composing = hasInput || showTyping;
  const tile =
    'rounded-[18px] bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800';
  const tileButton = `${tile} p-4 flex flex-col justify-between items-start text-left hover:border-sky-400 dark:hover:border-sky-700 transition-colors`;

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleImageFile(e.target.files?.[0])}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleImageFile(e.target.files?.[0])}
      />

      {/* ==================== 首頁：方塊式入口 ==================== */}
      {isHome && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleImageFile(e.dataTransfer.files?.[0]);
            }}
            className={`col-span-2 rounded-[20px] bg-sky-700 hover:bg-sky-800 text-white text-left transition-colors ${
              composing
                ? 'min-h-14 px-4 flex items-center gap-3'
                : 'lg:row-span-2 min-h-[176px] lg:min-h-[264px] p-5 sm:p-6 flex flex-col justify-between items-start'
            }`}
          >
            <Camera className={composing ? 'w-6 h-6' : 'w-9 h-9'} aria-hidden="true" />
            {composing ? (
              <span className="text-base font-bold">{imageUri ? '重新拍照' : '改用拍照'}</span>
            ) : (
              <span>
                <span className="block text-2xl font-bold">拍照解題</span>
                <span className="block text-sm text-white/90 mt-1 leading-relaxed">
                  對準一道題目拍一張，就能看簡答和詳解。電腦上也可以把圖片拖進來，或按 Ctrl+V 貼上截圖。
                </span>
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setShowTyping(true);
              setTimeout(() => textAreaRef.current?.focus(), 0);
            }}
            className={`${tileButton} ${composing ? 'hidden' : 'min-h-[96px]'}`}
          >
            <Keyboard className="w-6 h-6 text-slate-500" aria-hidden="true" />
            <span className="text-base font-bold text-slate-900 dark:text-white">打字輸入</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`${tileButton} ${composing ? 'hidden' : 'min-h-[96px]'}`}
          >
            <ImageIcon className="w-6 h-6 text-slate-500" aria-hidden="true" />
            <span className="text-base font-bold text-slate-900 dark:text-white">從相簿選</span>
          </button>

          {(hasInput || showTyping) && (
            <section aria-labelledby="questionTileHeading" className={`${tile} col-span-2 p-4 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <h2 id="questionTileHeading" className="text-sm font-bold text-slate-900 dark:text-white">
                  題目
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleVoiceInput}
                    className="inline-flex items-center gap-1 px-2.5 min-h-9 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    語音
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText('');
                      setImageUri(null);
                      setShowTyping(false);
                      onChangeProblemData(null);
                      onChangeActiveNode('photo');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 min-h-9 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    清空
                  </button>
                </div>
              </div>

              {imageUri && (
                <div className="flex items-start gap-3">
                  <img
                    src={imageUri}
                    alt="題目照片預覽"
                    className="max-h-36 max-w-[60%] object-contain rounded-lg bg-white border border-slate-200 dark:border-slate-700"
                  />
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsCropOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 min-h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-sky-500"
                    >
                      <Crop className="w-3.5 h-3.5" />
                      裁切／轉正
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageUri(null)}
                      className="inline-flex items-center gap-1.5 px-3 min-h-10 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      移除照片
                    </button>
                  </div>
                </div>
              )}

              <label htmlFor="problemTextInput" className="sr-only">
                題目文字
              </label>
              <textarea
                ref={textAreaRef}
                id="problemTextInput"
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={imageUri ? '照片辨識出的文字會出現在這裡，也可以自己修改' : '例如：解方程式 x² + x − 6 = 0'}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-[15px] text-slate-900 dark:text-white focus:border-sky-500 transition-colors"
              />

              {loadingMsg ? (
                <div className="flex items-center gap-3 min-h-11 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <div className="w-5 h-5 rounded-full border-2 border-sky-600 border-t-transparent animate-spin" />
                  <span>{loadingMsg}</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!hasInput}
                    onClick={() => resolveProblemAndNavigate('ai_explain')}
                    className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    看不懂題目
                  </button>
                  <button
                    type="button"
                    disabled={!hasInput}
                    onClick={() => resolveProblemAndNavigate('short_answer')}
                    className="min-h-11 rounded-xl bg-sky-700 text-white text-sm font-bold hover:bg-sky-800 disabled:opacity-40"
                  >
                    解題
                  </button>
                </div>
              )}
            </section>
          )}

          <button
            type="button"
            onClick={onOpenBook}
            className={`${tile} col-span-2 p-4 flex items-center gap-3 text-left hover:border-sky-400 dark:hover:border-sky-700 transition-colors`}
          >
            <span className="w-12 h-12 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center text-xl font-bold">
              {bookSummary?.toReview ?? 0}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-base font-bold text-slate-900 dark:text-white">錯題本</span>
              <span className="block text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                {bookSummary?.toReview
                  ? `還有 ${bookSummary.toReview} 題要複習${bookSummary.concepts.length ? `：${bookSummary.concepts.join('、')}` : ''}`
                  : '還沒有要複習的題目，解題後可以加入錯題本'}
              </span>
            </span>
            <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
          </button>

          <section className={`${tile} col-span-2 p-4 ${composing ? 'hidden lg:block' : ''}`}>
            {bookSummary?.recent.length ? (
              <>
                <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">最近加入錯題本</h2>
                {bookSummary.recent.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onOpenRecent?.(r.id)}
                    className="w-full flex items-center justify-between gap-3 min-h-11 py-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800 text-left"
                  >
                    <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
                      <MathText text={r.question.slice(0, 40)} />
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400 shrink-0">{r.concept}</span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <h2 className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">先試試範例題</h2>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_PROBLEMS.map((sample) => (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleLoadSample(sample)}
                      className="px-3 min-h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {/* ==================== 解題結果：左邊題目、右邊分頁內容 ==================== */}
      {!isHome && problemData && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5 items-start">
        <div className="lg:col-span-4 space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="回首頁"
              onClick={() => onChangeActiveNode('photo')}
              className="w-11 h-11 -ml-2 shrink-0 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="flex-1 min-w-0 text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
              {problemData.concept}
            </h1>
            <button
              type="button"
              onClick={saveCurrentMistake}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 min-h-10 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:border-sky-500"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              加入錯題本
            </button>
          </div>

          <section className={`${tile} p-4`}>
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">題目</div>
            <div
              ref={questionRef}
              className={`text-sm leading-relaxed text-slate-800 dark:text-slate-200 ${questionOpen ? '' : 'line-clamp-4 lg:line-clamp-none'}`}
            >
              <MathText text={problemData.question} />
            </div>
            {(questionClamped || questionOpen) && (
              <button
                type="button"
                onClick={() => setQuestionOpen((v) => !v)}
                className="lg:hidden mt-1 px-2 -ml-2 min-h-11 text-xs font-semibold text-sky-700 dark:text-sky-400"
              >
                {questionOpen ? '收起題目' : '看完整題目'}
              </button>
            )}
          </section>

          {/* 簡答以外的分頁也看得到最終答案（手機上做成一行，不佔太多空間） */}
          {isDontKnowHub &&
            !problemData.explainOnly &&
            activeNode !== 'short_answer' &&
            activeNode !== 'dont_know' && (
              <section className={`${tile} px-4 py-3 lg:p-4 flex items-baseline gap-3 lg:block`}>
                <div className="text-xs text-slate-600 dark:text-slate-400 shrink-0">最終答案</div>
                <div className="text-lg lg:text-2xl font-bold text-sky-700 dark:text-sky-400 lg:mt-1 min-w-0">
                  <MathText text={problemData.shortAnswer} />
                </div>
              </section>
            )}
        </div>

        <div className="lg:col-span-8 space-y-3 sm:space-y-4">
          {loadingMsg && (
            <div className={`${tile} p-8 flex items-center justify-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200`}>
              <div className="w-5 h-5 rounded-full border-2 border-sky-600 border-t-transparent animate-spin" />
              <span>{loadingMsg}</span>
            </div>
          )}

          {/* ==================== 分支一：看不懂 -> AI 解釋 ==================== */}
          {!loadingMsg &&
            problemData &&
            (activeNode === 'dont_understand' || activeNode === 'ai_explain') && (
              <section className="rounded-2xl border-2 border-emerald-500/70 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      流程分支：拍照 → 看不懂 → AI 解釋
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      AI 題意白話解釋（不直接暴雷答案）
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    單元：{problemData.concept}
                  </span>
                </div>

                {/* 原題目顯示 */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200">
                  <span className="text-xs font-semibold text-slate-500 block mb-1">
                    目前題目：
                  </span>
                  <MathText text={problemData.question} />
                </div>

                {/* 1. 白話翻譯 */}
                <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
                  <h3 className="text-xs font-bold text-emerald-900 dark:text-emerald-300 mb-1.5">
                    一、題目白話翻譯（這題到底在說什麼？）
                  </h3>
                  <div className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    <MathText text={problemData.explanation.plainTranslation} />
                  </div>
                </div>

                {/* 2. 已知條件與目標 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                      二、題目給了哪些已知條件？
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {problemData.explanation.givenConditions.map((cond, i) => (
                        <li key={i}>
                          <MathText text={cond} />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                      三、最後真正要找的目標
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      <MathText text={problemData.explanation.targetGoal} />
                    </p>
                    {problemData.explanation.keyTerms.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
                        <span className="block text-[11px] font-semibold text-slate-500">
                          關鍵名詞小字典：
                        </span>
                        {problemData.explanation.keyTerms.map((kt, idx) => (
                          <div key={idx} className="text-xs">
                            <strong className="text-slate-900 dark:text-white">
                              <MathText text={kt.term} />：
                            </strong>
                            <span className="text-slate-600 dark:text-slate-300">
                              <MathText text={kt.meaning} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. 第一步思考起點 */}
                <div className="p-4 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60">
                  <h3 className="text-xs font-bold text-sky-900 dark:text-sky-300 mb-1">
                    四、給你的第一步破題提示
                  </h3>
                  <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <MathText text={problemData.explanation.starterHint} />
                  </div>
                </div>

                {/* 試算草稿區 */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    看懂題意後，在這裡試著自己算算看（選填）：
                  </label>
                  <textarea
                    rows={2}
                    value={studentScratch}
                    onChange={(e) => setStudentScratch(e.target.value)}
                    placeholder="寫下你的列式或算出來的答案..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-white"
                  />
                </div>

                {/* 流程圖雙出口：1. 前往「恭喜」 2. 前往「不會」 */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-3">
                    讀完 AI 解釋後，請選擇你的下一步（對應流程圖分支）：
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        onRecordSignal?.(
                          problemData.concept,
                          'practice_result',
                          {
                            summary: '學生看懂題意後自行計算出結果，前往恭喜',
                            isCorrect: true,
                            detail: studentScratch,
                          }
                        );
                        if (studentScratch.trim()) {
                          onLogInteraction?.({
                            kind: 'practice',
                            concept: problemData.concept,
                            question: problemData.question,
                            studentText: studentScratch,
                            isCorrect: true,
                          });
                        }
                        onChangeActiveNode('congrats');
                      }}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      看懂了，我自己算出來了！（前往「恭喜」）
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onRecordSignal?.(
                          problemData.concept,
                          'self_reported_difficulty',
                          {
                            summary: '看懂題意但仍不會算，轉入「不會」中樞',
                            difficulty: 'high',
                          }
                        );
                        onLogInteraction?.({
                          kind: 'practice',
                          concept: problemData.concept,
                          question: problemData.question,
                          studentText: studentScratch.trim() || '（看懂題意但不知道怎麼列式）',
                          isCorrect: false,
                        });
                        goSolved('short_answer');
                      }}
                      className="inline-flex items-center gap-2 px-5 min-h-11 rounded-xl bg-sky-700 text-white text-sm font-bold hover:bg-sky-800 transition-colors shadow-xs cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      看懂題目了，但還是不會算
                    </button>
                  </div>
                </div>
              </section>
            )}

          {/* ==================== 節點：恭喜 (Congrats) ==================== */}
          {!loadingMsg && problemData && activeNode === 'congrats' && (
            <section className="rounded-2xl border-2 border-emerald-500 bg-white dark:bg-slate-900 p-8 text-center space-y-5 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  拍照 → 看不懂 → AI 解釋 → 恭喜
                </span>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  恭喜你！靠自己把題目想通了！
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-lg mx-auto">
                  有時候不是不會算，只是被題目的文字卡住了。透過看懂題意並自己推導出結果，記憶會最深刻！
                </p>
              </div>

              {studentScratch.trim() && (
                <div className="max-w-md mx-auto p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-left text-xs">
                  <span className="font-semibold text-slate-500 block mb-1">
                    你的試算紀錄：
                  </span>
                  <div className="text-sm text-slate-900 dark:text-white font-mono">
                    {studentScratch}
                  </div>
                </div>
              )}

              <div className="max-w-md mx-auto">
                {!showCongratsAnswer ? (
                  <button
                    type="button"
                    onClick={() =>
                      problemData.explainOnly ? goSolved('short_answer') : setShowCongratsAnswer(true)
                    }
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    核對這題的標準簡答
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                    <span className="text-xs text-emerald-700 dark:text-emerald-300 block mb-1">
                      標準簡答：
                    </span>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      <MathText text={problemData.shortAnswer} />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => goSolved('practice_same')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                >
                  <Dumbbell className="w-4 h-4" />
                  去「練功房」做一題同類型鞏固
                </button>
                <button
                  type="button"
                  onClick={() => goSolved('detailed_answer')}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  看完整詳答步驟
                </button>
                <button
                  type="button"
                  onClick={saveCurrentMistake}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <BookmarkPlus className="w-4 h-4" />
                  收藏至錯題本
                </button>
              </div>
            </section>
          )}

          {/* ==================== 分支二：不會 -> 四大功能中樞 ==================== */}
          {!loadingMsg && problemData && isDontKnowHub && (
            <div className="space-y-5">
              {problemData.level === '超出國中' && (
                <div className="rounded-2xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 p-4 text-sm text-sky-900 dark:text-sky-200">
                  <strong className="block mb-1">這題超出國中範圍</strong>
                  <MathText
                    text={problemData.levelNote || '這題需要高中才會學到的觀念，下面的解法可能用到你還沒學過的方法。'}
                  />
                </div>
              )}
              {/* 「不會」四個分頁：簡答 / 詳答 / 知識點 / 練功房 */}
              <nav
                aria-label="解題內容"
                className="sticky top-14 lg:top-4 z-10 p-1 rounded-[14px] bg-slate-200/80 dark:bg-slate-800 backdrop-blur-sm grid grid-cols-4 gap-1"
              >
                {[
                  {
                    label: '簡答',
                    on: activeNode === 'short_answer' || activeNode === 'dont_know',
                    go: () => onChangeActiveNode('short_answer'),
                  },
                  {
                    label: '詳答',
                    on: activeNode === 'detailed_answer',
                    go: () => onChangeActiveNode('detailed_answer'),
                  },
                  {
                    label: '知識點',
                    on:
                      activeNode === 'knowledge_points' ||
                      activeNode === 'knowledge_videos' ||
                      activeNode === 'knowledge_literature',
                    go: () => {
                      onRecordSignal?.(problemData.concept, 'simple_click', {
                        summary: '點擊知識點選單',
                      });
                      onChangeActiveNode('knowledge_videos');
                    },
                  },
                  {
                    label: '練功房',
                    on:
                      activeNode === 'practice_dojo' ||
                      activeNode === 'practice_same' ||
                      activeNode === 'practice_extension',
                    go: () => onChangeActiveNode('practice_same'),
                  },
                ].map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    aria-current={t.on ? 'page' : undefined}
                    onClick={t.go}
                    className={`min-h-10 rounded-[10px] text-sm transition-colors ${
                      t.on
                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-bold shadow-xs'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </nav>

              {/* ---------- 子分支 1：簡答 ---------- */}
              {(activeNode === 'short_answer' || activeNode === 'dont_know') && (
                <div className="grid grid-cols-2 gap-3">
                  <section className={`${tile} col-span-2 p-5`}>
                    <div className="text-xs text-slate-600 dark:text-slate-400">最終答案</div>
                    <div className="text-3xl sm:text-4xl font-bold text-sky-700 dark:text-sky-400 tracking-tight mt-1">
                      <MathText text={problemData.shortAnswer} />
                    </div>
                  </section>

                  {problemData.thinkTip && (
                    <section className={`${tile} col-span-2 p-4`}>
                      <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">破題提示</div>
                      <div className="text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 mt-1">
                        <MathText text={problemData.thinkTip} />
                      </div>
                    </section>
                  )}

                  <button
                    type="button"
                    onClick={() => onChangeActiveNode('detailed_answer')}
                    className={`${tileButton} min-h-[96px]`}
                  >
                    <BookOpen className="w-6 h-6 text-slate-500" aria-hidden="true" />
                    <span className="text-[15px] font-bold text-slate-900 dark:text-white">
                      看詳答 {problemData.methods?.[0]?.steps?.length || problemData.steps.length || ''} 步
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeActiveNode('practice_same')}
                    className={`${tileButton} min-h-[96px]`}
                  >
                    <Dumbbell className="w-6 h-6 text-slate-500" aria-hidden="true" />
                    <span className="text-[15px] font-bold text-slate-900 dark:text-white">練一題同類型</span>
                  </button>
                </div>
              )}

              {/* ---------- 子分支 2：詳答 ---------- */}
              {activeNode === 'detailed_answer' && (
                <section className="rounded-[18px] border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">詳細步驟</h2>

                    {activeMethods.length > 1 && (
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        {activeMethods.map((m, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setMethodIdx(idx);
                              setVisibleSteps(m.steps.length);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                              methodIdx === idx
                                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 破題思考提示（手機上簡答頁已經有，這裡不重複） */}
                  <div className="hidden sm:block p-4 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60">
                    <span className="text-xs font-bold text-sky-800 dark:text-sky-300 block mb-1">
                      破題關鍵思考
                    </span>
                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      <MathText text={problemData.thinkTip} />
                    </div>
                  </div>

                  {/* 逐步詳解清單 */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        解題步驟（已顯示 {Math.min(visibleSteps, currentMethodSteps.length)} /{' '}
                        {currentMethodSteps.length} 步）
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setVisibleSteps(1)}
                          disabled={visibleSteps <= 1}
                          className="px-3 min-h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 disabled:opacity-40"
                        >
                          從第一步開始
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleSteps((v) =>
                              Math.min(currentMethodSteps.length, v + 1)
                            )
                          }
                          disabled={visibleSteps >= currentMethodSteps.length}
                          className="px-3 min-h-10 rounded-lg bg-sky-700 text-white text-xs font-semibold disabled:opacity-40"
                        >
                          下一步
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisibleSteps(currentMethodSteps.length)}
                          disabled={visibleSteps >= currentMethodSteps.length}
                          className="px-3 min-h-10 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 disabled:opacity-40"
                        >
                          顯示全部
                        </button>
                      </div>
                    </div>

                    <ol className="space-y-2.5">
                      {currentMethodSteps
                        .slice(0, visibleSteps)
                        .map((stepText, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200"
                          >
                            <span className="shrink-0 w-6 h-6 rounded-lg bg-sky-600 text-white font-mono text-xs font-bold flex items-center justify-center mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="leading-relaxed">
                              <MathText text={stepText} />
                            </div>
                          </li>
                        ))}
                    </ol>
                  </div>

                  {/* 互動圖解：手機上點開才顯示，避免整頁拉很長 */}
                  {problemData.drawing && (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowDiagram((v) => !v)}
                        className="sm:hidden w-full min-h-11 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100"
                      >
                        {showDiagram ? '收起圖解' : '看圖解'}
                      </button>
                      <div className={showDiagram ? '' : 'hidden sm:block'}>
                        <MathDiagram drawing={problemData.drawing} dark={dark} />
                      </div>
                    </>
                  )}

                  {/* 對步驟追問 AI */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      對哪一個步驟有疑問？直接問 AI 老師：
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={followUpQuery}
                        onChange={(e) => setFollowUpQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAskFollowUp();
                        }}
                        placeholder="例如：為什麼第二步移項之後要變號？"
                        className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={askingFollowUp || !followUpQuery.trim()}
                        onClick={handleAskFollowUp}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 disabled:opacity-45 whitespace-nowrap"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {askingFollowUp ? '思考中...' : '提問'}
                      </button>
                    </div>
                    {followUpReply && (
                      <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        <MathText text={followUpReply} />
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* 均一的真實資源只需要解題時就有的 unitIds，不必等 AI 補充內容 */}
              {enrichPending &&
                problemData.unitIds &&
                problemData.unitIds.length > 0 &&
                (activeNode === 'knowledge_points' ||
                  activeNode === 'knowledge_videos' ||
                  activeNode === 'knowledge_literature') && (
                  <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-3">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Video className="w-4 h-4 text-amber-600" />
                      教學影片、練習與歷屆會考題
                    </h2>
                    <UnitResources
                      unitIds={problemData.unitIds}
                      onOpen={(title, url) =>
                        onRecordSignal?.(problemData.concept, 'resource_viewed', {
                          summary: `開啟教學資源：${title}（弱訊號）`,
                          detail: url,
                        })
                      }
                    />
                  </section>
                )}

              {/* ---------- 知識點與練功房內容還在背景產生 ---------- */}
              {enrichPending && isEnrichNode && (
                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 flex flex-col items-center justify-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {problemData.enrichState !== 'failed' ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-sky-600 border-t-transparent animate-spin" />
                      <span>正在準備知識點、影片與練功房題目…</span>
                    </div>
                  ) : (
                    <>
                      <span>知識點與練功房內容暫時無法產生。</span>
                      <button
                        type="button"
                        onClick={() => void runEnrich(problemData)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        重新產生
                      </button>
                    </>
                  )}
                </section>
              )}

              {/* ---------- 子分支 3：知識點 -> 影片 / 文獻 ---------- */}
              {!enrichPending &&
                (activeNode === 'knowledge_points' ||
                activeNode === 'knowledge_videos' ||
                activeNode === 'knowledge_literature') && (
                <section className="rounded-[18px] border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">觀念與資源</h2>

                    {/* 知識點子分支切換：影片 vs 文獻 */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          onRecordSignal?.(problemData.concept, 'simple_click', {
                            summary: '點擊切換至影片標籤',
                          });
                          onChangeActiveNode('knowledge_videos');
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                          activeNode !== 'knowledge_literature'
                            ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Video className="w-3.5 h-3.5" />
                        影片資源
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onRecordSignal?.(problemData.concept, 'simple_click', {
                            summary: '點擊切換至文獻標籤',
                          });
                          onChangeActiveNode('knowledge_literature');
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                          activeNode === 'knowledge_literature'
                            ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <BookMarked className="w-3.5 h-3.5" />
                        AI 整理重點
                      </button>
                    </div>
                  </div>

                  {/* 原理與前後知識點脈絡 */}
                  <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 space-y-3">
                    <div>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-300 block mb-1">
                        核心數學原理
                      </span>
                      <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        <MathText text={problemData.principle} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-xs">
                      <div>
                        <span className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          先備基礎知識：
                        </span>
                        <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-0.5">
                          {problemData.prequels.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                          後續延伸單元：
                        </span>
                        <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-0.5">
                          {problemData.sequels.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {problemData.highSchoolNote && (
                      <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        <span className="font-semibold text-sky-700 dark:text-sky-400 block mb-1">
                          延伸：高中會學到
                        </span>
                        <MathText text={problemData.highSchoolNote.replace(/^高中會學到[:：]\s*/, '')} />
                      </div>
                    )}
                  </div>

                  {/* 分支 3A：知識點 -> 影片（有對應單元時用均一的真實影片、練習與歷屆會考題） */}
                  {activeNode !== 'knowledge_literature' && problemData.unitIds?.length ? (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Video className="w-4 h-4 text-amber-600" />
                        教學影片、練習與歷屆會考題
                      </h3>
                      <UnitResources
                        unitIds={problemData.unitIds}
                        onOpen={(title, url) =>
                          onRecordSignal?.(problemData.concept, 'resource_viewed', {
                            summary: `開啟教學資源：${title}（弱訊號）`,
                            detail: url,
                          })
                        }
                      />
                    </div>
                  ) : null}

                  {/* 沒有對應單元時（例如本機題型）只提供搜尋連結，不顯示 AI 猜的片長與摘要 */}
                  {activeNode !== 'knowledge_literature' && !problemData.unitIds?.length && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Video className="w-4 h-4 text-amber-600" />
                        搜尋相關教學影片
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {problemData.videos.map((v, idx) => (
                          <article
                            key={idx}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                                在 {v.platform} 搜尋
                              </div>
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                {v.searchQuery || v.title}
                              </h4>
                            </div>
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                onRecordSignal?.(
                                  problemData.concept,
                                  'resource_viewed',
                                  {
                                    summary: `觀看教學影片：${v.title}（弱訊號）`,
                                    detail: `${v.platform} - ${v.url}`,
                                  }
                                );
                              }}
                              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors whitespace-nowrap"
                            >
                              搜尋影片
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 分支 3B：知識點 -> 文獻 */}
                  {activeNode === 'knowledge_literature' && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <BookMarked className="w-4 h-4 text-amber-600" />
                        AI 整理的觀念重點
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        以下由 AI 整理，不是正式文獻，僅供參考；正式教材請看「影片資源」裡的均一教育平台連結。
                      </p>
                      <div className="space-y-3">
                        {problemData.literature.map((lit, idx) => (
                          <article
                            key={idx}
                            onMouseEnter={() => {
                              onRecordSignal?.(
                                problemData.concept,
                                'resource_viewed',
                                {
                                  summary: `研讀重點文獻：${lit.title}（弱訊號）`,
                                }
                              );
                            }}
                            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2"
                          >
                            <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                              {lit.category}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {lit.title}
                            </h4>
                            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              <MathText text={lit.content} />
                            </div>
                            {lit.commonMistake && (
                              <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-700 text-xs text-rose-700 dark:text-rose-300">
                                <strong>易錯提醒：</strong>
                                <MathText text={lit.commonMistake} />
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* ---------- 子分支 4：練功房 -> 同類型 / 延伸 ---------- */}
              {!enrichPending &&
                (activeNode === 'practice_dojo' ||
                activeNode === 'practice_same' ||
                activeNode === 'practice_extension') &&
                currentPracticeItem && (
                  <section className="rounded-[18px] border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">{activeNode === 'practice_extension' ? '延伸挑戰' : '同類型練習'}</h2>

                      {/* 練功房子分支切換：同類型 vs 延伸 */}
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            onRecordSignal?.(problemData.concept, 'simple_click', {
                              summary: '點擊同類型練習標籤',
                            });
                            onChangeActiveNode('practice_same');
                          }}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                            activeNode !== 'practice_extension'
                              ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Dumbbell className="w-3.5 h-3.5" />
                          同類型練習
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRecordSignal?.(problemData.concept, 'simple_click', {
                              summary: '點擊延伸挑戰標籤',
                            });
                            onChangeActiveNode('practice_extension');
                          }}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                            activeNode === 'practice_extension'
                              ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" />
                          延伸挑戰題
                        </button>
                      </div>
                    </div>

                    {/* 題目資訊列與計時器 */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <div>
                        涵蓋觀念：
                        <span className="text-slate-800 dark:text-slate-200 font-medium ml-1">
                          {currentPracticeItem.concepts.join(' · ') || problemData.concept}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                          {formatTimer(practiceSec)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPracticeTimerRunning((r) => !r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Timer className="w-3.5 h-3.5" />
                          {practiceTimerRunning ? '暫停計時' : '開始計時'}
                        </button>
                      </div>
                    </div>

                    {/* 練功房題目框 */}
                    <div className="p-5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 text-base font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                      <MathText text={currentPracticeItem.q} />
                    </div>

                    {/* 作答區 */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        你的計算過程與答案：
                      </label>
                      <textarea
                        rows={3}
                        value={practiceWork}
                        onChange={(e) => setPracticeWork(e.target.value)}
                        placeholder="先在這裡寫下你的列式與答案，再點下方核對解答..."
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-white"
                      />
                    </div>

                    {/* 操作按鈕列 */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowPracticeAns((v) => !v);
                          setPracticeTimerRunning(false);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors"
                      >
                        {showPracticeAns ? '隱藏解答' : '核對答案與詳解'}
                      </button>

                      <button
                        type="button"
                        disabled={generatingPractice}
                        onClick={() =>
                          handleRefreshPractice(
                            activeNode === 'practice_extension'
                              ? 'extension'
                              : 'sameType'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-45"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            generatingPractice ? 'animate-spin' : ''
                          }`}
                        />
                        {activeNode === 'practice_extension'
                          ? '再換一題延伸題'
                          : '再換一題同類型'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onSaveMistake({
                            question: currentPracticeItem.q,
                            shortAnswer: currentPracticeItem.a,
                            concept:
                              currentPracticeItem.concepts.join(' · ') ||
                              problemData.concept,
                            steps: currentPracticeItem.steps || [],
                            source: currentPracticeItem.source || problemData.source,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        加入錯題本
                      </button>
                    </div>

                    {/* 解答與步驟展開 */}
                    {showPracticeAns && (
                      <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-2.5">
                        <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                          參考答案：<MathText text={currentPracticeItem.a} />
                        </div>
                        {currentPracticeItem.steps &&
                          currentPracticeItem.steps.length > 0 && (
                            <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/50">
                              {currentPracticeItem.steps.map((s, idx) => (
                                <li key={idx}>
                                  <MathText text={s} />
                                </li>
                              ))}
                            </ol>
                          )}
                        <div className="pt-2 flex items-center gap-2">
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">
                            這題你算對了嗎？
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onRecordSignal?.(
                                problemData.concept,
                                'practice_result',
                                {
                                  summary: `練功房${
                                    activeNode === 'practice_extension'
                                      ? '延伸題'
                                      : '同類型題'
                                  }自評答對`,
                                  isCorrect: true,
                                  detail: currentPracticeItem.q,
                                }
                              );
                              onLogInteraction?.({
                                kind: 'practice',
                                concept: problemData.concept,
                                question: currentPracticeItem.q,
                                studentText: practiceWork.trim() || '（未寫過程）',
                                isCorrect: true,
                                seconds: practiceSec || undefined,
                              });
                              onToast('已記錄自評答對，更新至個人學習輪廓！');
                            }}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-semibold"
                          >
                            答對了
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onRecordSignal?.(
                                problemData.concept,
                                'practice_result',
                                {
                                  summary: `練功房${
                                    activeNode === 'practice_extension'
                                      ? '延伸題'
                                      : '同類型題'
                                  }自評答錯`,
                                  isCorrect: false,
                                  detail: currentPracticeItem.q,
                                }
                              );
                              onLogInteraction?.({
                                kind: 'practice',
                                concept: problemData.concept,
                                question: currentPracticeItem.q,
                                studentText: practiceWork.trim() || '（未寫過程）',
                                isCorrect: false,
                                seconds: practiceSec || undefined,
                              });
                              onToast('已記錄自評答錯，更新至個人學習輪廓！');
                            }}
                            className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-[11px] font-semibold"
                          >
                            算錯了
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 圖片裁切與旋轉 Modal */}
      <ImageCropModal
        imageSrc={imageUri}
        isOpen={isCropOpen}
        onClose={() => setIsCropOpen(false)}
        onApply={(croppedUrl) => {
          setImageUri(croppedUrl);
          onToast('已套用裁切後的題目圖片');
        }}
      />
    </div>
  );
};
