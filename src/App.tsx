import React, { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Camera, NotebookPen, Dumbbell, ChartColumn } from 'lucide-react';
import { getRedirectResult, onAuthStateChanged, type User } from 'firebase/auth';
import type { Unsubscribe } from 'firebase/firestore';
import { auth, firebaseEnabled, signInWithGoogle, signOutUser } from './lib/firebase';
import {
  mergeGuestDataIntoCloud,
  saveProfile,
  subscribeBook,
  subscribeProfile,
  writeBookDiff,
} from './lib/cloudSync';
import { AccountMenu, type SyncState } from './components/AccountMenu';
import {
  SAMPLE_PROBLEMS,
  makeData,
  normalizeSaved,
  uid,
} from './lib/mathCore';
import {
  FlowNodeId,
  MathProblemData,
  SavedMistakeItem,
} from './types/math';
import {
  EvidenceType,
  InteractionTurn,
  LearnerNotes,
  SelfReportedDifficulty,
  StudentLearningProfile,
} from './types/learningProfile';
import {
  getOrCreateDefaultProfile,
  recordProfileSignal,
  buildPersonalizedContext,
  clearLocalStudentProfile,
  setProfileLocalPersistence,
  appendInteraction,
  applyLearnerNotes,
  buildProfileStats,
  clearLearnerNotes,
  DISTILL_THRESHOLD,
} from './lib/learningProfile';
import { callMathApi } from './lib/mathApi';
import { FlowWorkspace } from './components/FlowWorkspace';
import { BatchPracticeView } from './components/BatchPracticeView';
import { MistakeBookView } from './components/MistakeBookView';
import { LearningProfileView } from './components/LearningProfileView';
import { MathText } from './components/MathText';

const BOOK_STORAGE_KEY = 'mathnavi_v3_book';
const PREF_STORAGE_KEY = 'mathnavi_v3_prefs';

type MainTab = 'flow' | 'batch' | 'book' | 'profile';

// 訪客模式（未登入）的錯題本存在這台裝置的 localStorage
function readGuestBook(): SavedMistakeItem[] {
  try {
    const raw = localStorage.getItem(BOOK_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.slice(0, 1000).map(normalizeSaved);
      }
    }
  } catch {
    // ignore storage read error
  }
  return [];
}

export default function App() {
  const [mainTab, setMainTab] = useState<MainTab>('flow');
  // 一打開就是首頁（拍照／打字入口），不先塞一道範例題
  const [problemData, setProblemData] = useState<MathProblemData | null>(null);
  const [activeNode, setActiveNode] = useState<FlowNodeId>('photo');

  // 學生學習輪廓資料層 (Learning Profile)
  const [studentProfile, setStudentProfile] = useState<StudentLearningProfile>(() =>
    getOrCreateDefaultProfile()
  );

  const [book, setBook] = useState<SavedMistakeItem[]>(readGuestBook);
  const bookRef = useRef(book);
  bookRef.current = book;

  // 登入與雲端同步
  const [user, setUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('local');
  const cloudReady = useRef(false);
  const remoteProfileStamp = useRef<string | null>(null);

  const [dark, setDark] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(PREF_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.dark === 'boolean') return p.dark;
      }
    } catch {
      // ignore
    }
    return false;
  });

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [printData, setPrintData] = useState<{
    items: Array<{ q: string; a: string; steps?: string[] }>;
    withAnswers: boolean;
    title: string;
  } | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify({ dark }));
    } catch {
      // ignore
    }
  }, [dark]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // 回到訪客模式：改用這台裝置上的資料
  const resetToGuestMode = () => {
    cloudReady.current = false;
    remoteProfileStamp.current = null;
    setProfileLocalPersistence(true);
    setBook(readGuestBook());
    setStudentProfile(getOrCreateDefaultProfile());
    setSyncState('local');
  };

  useEffect(() => {
    if (!auth) return;
    getRedirectResult(auth).catch((err: unknown) => {
      showToast(err instanceof Error ? `登入失敗：${err.message}` : '登入失敗');
    });
    let hadUser = false;
    return onAuthStateChanged(auth, (u) => {
      if (!u && hadUser) resetToGuestMode();
      hadUser = Boolean(u);
      setUser(u);
    });
  }, []);

  // 登入後：合併訪客資料 → 訂閱雲端錯題本與學習輪廓（其他裝置的變更會即時出現）
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const unsubs: Unsubscribe[] = [];
    setSyncState('syncing');
    setProfileLocalPersistence(false);

    (async () => {
      try {
        const { addedItems } = await mergeGuestDataIntoCloud(
          user.uid,
          readGuestBook(),
          getOrCreateDefaultProfile()
        );
        if (cancelled) return;
        // 已上傳到雲端，清掉這台裝置的訪客資料，登出後不會留下個人紀錄
        try {
          localStorage.removeItem(BOOK_STORAGE_KEY);
        } catch {
          // ignore
        }
        clearLocalStudentProfile();
        if (addedItems > 0) showToast(`已把這台裝置上的 ${addedItems} 題錯題同步到你的帳號`);

        cloudReady.current = true;
        unsubs.push(
          subscribeBook(user.uid, (items) => {
            setBook(items);
            setSyncState('synced');
          })
        );
        unsubs.push(
          subscribeProfile(user.uid, (remote) => {
            remoteProfileStamp.current = remote.updatedAt;
            // 只接受比目前新的版本，避免舊的回音蓋掉剛記錄的學習訊號
            setStudentProfile((cur) => (remote.updatedAt >= cur.updatedAt ? remote : cur));
          })
        );
      } catch (err: unknown) {
        if (cancelled) return;
        setSyncState('error');
        showToast(err instanceof Error ? `雲端同步失敗：${err.message}` : '雲端同步失敗');
      }
    })();

    return () => {
      cancelled = true;
      cloudReady.current = false;
      unsubs.forEach((u) => u());
    };
  }, [user?.uid]);

  // 學習輪廓有變動時（稍等一下合併連續操作）寫回雲端
  useEffect(() => {
    if (!user || !cloudReady.current) return;
    if (studentProfile.updatedAt === remoteProfileStamp.current) return;
    const t = setTimeout(() => {
      saveProfile(user.uid, studentProfile).catch(() => setSyncState('error'));
    }, 1200);
    return () => clearTimeout(t);
  }, [studentProfile, user]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      showToast(err instanceof Error ? `登入失敗：${err.message}` : '登入失敗');
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    showToast('已登出，資料仍安全保存在你的帳號中');
  };

  /**
   * 記錄學習輪廓訊號（依權重排序）：
   * 1. 實際答題錯誤
   * 2. 錯誤步驟
   * 3. 重複錯誤
   * 4. 學生主動表示「不會／看不懂」
   * 5. 練習題結果
   * 6. 學習資源觀看
   * 7. 單純點擊
   */
  const handleRecordProfileSignal = (
    concept: string,
    type: EvidenceType,
    payload: {
      summary: string;
      detail?: string;
      isCorrect?: boolean;
      difficulty?: SelfReportedDifficulty;
      errorCategory?: string;
    }
  ) => {
    setStudentProfile((prev) => {
      return recordProfileSignal(prev, concept, type, payload);
    });
  };

  const handleLogInteraction = (turn: Omit<InteractionTurn, 'at'>) => {
    setStudentProfile((prev) => appendInteraction(prev, turn));
  };

  // 互動累積到一定數量，就請 AI 把它們濃縮進學習背景
  const [distilling, setDistilling] = useState(false);
  const distillFailedAt = useRef(0);

  const runDistill = async (manual = false) => {
    const turns = studentProfile.pendingTurns || [];
    if (distilling || !turns.length) return;
    setDistilling(true);
    try {
      const notes = await callMathApi<Omit<LearnerNotes, 'updatedAt' | 'distilledTurns'>>('distill', {
        notes: studentProfile.learnerNotes || null,
        stats: buildProfileStats(studentProfile),
        turns,
      });
      distillFailedAt.current = 0;
      setStudentProfile((cur) => applyLearnerNotes(cur, notes, turns));
      if (manual) showToast('已更新你的 AI 學習背景');
    } catch (err: unknown) {
      distillFailedAt.current = turns.length;
      if (manual) showToast(err instanceof Error ? `更新失敗：${err.message}` : '更新失敗');
    } finally {
      setDistilling(false);
    }
  };

  useEffect(() => {
    const count = studentProfile.pendingTurns?.length || 0;
    if (count < DISTILL_THRESHOLD || distilling) return;
    // 上次失敗後，等再多累積幾筆才重試，避免一直打 API
    if (distillFailedAt.current && count < distillFailedAt.current + DISTILL_THRESHOLD) return;
    if (user && !cloudReady.current) return;
    runDistill();
  }, [studentProfile.pendingTurns?.length, distilling, user]);

  const handleUpdateBook = (nextBook: SavedMistakeItem[]) => {
    const prevBook = bookRef.current;
    bookRef.current = nextBook;
    setBook(nextBook);
    if (user) {
      writeBookDiff(user.uid, prevBook, nextBook).catch(() => setSyncState('error'));
      return;
    }
    try {
      localStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(nextBook));
    } catch {
      // ignore
    }
  };

  const handleSaveMistake = (raw: {
    question: string;
    shortAnswer: string;
    concept: string;
    steps: string[];
    source: 'local' | 'ai';
    drawing?: any;
  }) => {
    try {
      const item = normalizeSaved({
        ...raw,
        id: uid(),
        answer: raw.shortAnswer,
        wrong: 0,
        right: 0,
        streak: 0,
        mastery: 0,
      });
      const fingerprint =
        item.question.replace(/\s/g, '') + '|' + item.concept;
      const exists = book.some(
        (x) => x.question.replace(/\s/g, '') + '|' + x.concept === fingerprint
      );
      if (exists) {
        showToast('這題已經在錯題本裡了！');
        return;
      }
      const next = [item, ...book];
      handleUpdateBook(next);
      showToast('已加入錯題本！可隨時前往錯題本複習。');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : '加入錯題本失敗');
    }
  };

  const handlePrintWorksheet = (
    items: Array<{ q: string; a: string; steps?: string[] }>,
    withAnswers: boolean,
    title: string
  ) => {
    if (!items.length) {
      showToast('目前沒有可列印的題目');
      return;
    }
    setPrintData({ items, withAnswers, title });
    setTimeout(() => {
      window.print();
    }, 120);
  };

  // 從錯題本打開一題，回到解題畫面的詳答
  const openSavedInFlow = (saved: SavedMistakeItem) => {
    setProblemData({
      question: saved.question,
      concept: saved.concept,
      kind: saved.kind,
      source: saved.source,
      explanation: saved.explanation || {
        plainTranslation: `本題屬於「${saved.concept}」單元。`,
        givenConditions: [saved.question],
        targetGoal: '依據題目條件求解。',
        keyTerms: [{ term: saved.concept, meaning: '核心單元概念' }],
        starterHint: saved.thinkTip || '先列式再逐步化簡。',
      },
      shortAnswer: saved.answer,
      thinkTip: saved.thinkTip || '先確認題目條件與所求目標。',
      steps: saved.steps,
      methods: saved.methods,
      principle: saved.principle,
      prequels: saved.prequels,
      sequels: saved.sequels,
      videos: saved.videos || [],
      literature: saved.literature || [],
      sameType: saved.sameType,
      extension: saved.extension,
      drawing: saved.drawing,
    });
    setActiveNode('detailed_answer');
    setMainTab('flow');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 首頁方塊：還沒精熟的錯題數量、涉及的單元與最近加入的題目
  const toReview = book.filter((b) => b.mastery < 100);
  const bookSummary = {
    toReview: toReview.length,
    concepts: [...new Set(toReview.map((b) => b.concept))].slice(0, 2),
    recent: book.slice(0, 2).map((b) => ({ id: b.id, question: b.question, concept: b.concept })),
  };

  const goTab = (tab: MainTab) => {
    // 已經在解題頁時再點一次「解題」就回到首頁
    if (tab === 'flow' && mainTab === 'flow') setActiveNode('photo');
    setMainTab(tab);
    window.scrollTo({ top: 0 });
  };

  const navItems: Array<{ tab: MainTab; label: string; Icon: typeof Camera; badge?: number }> = [
    { tab: 'flow', label: '解題', Icon: Camera },
    { tab: 'book', label: '錯題本', Icon: NotebookPen, badge: toReview.length || undefined },
    { tab: 'batch', label: '練功房', Icon: Dumbbell },
    { tab: 'profile', label: '學習輪廓', Icon: ChartColumn },
  ];

  const themeButton = (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      className="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
      aria-label={dark ? '切換為淺色模式' : '切換為深色模式'}
    >
      {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );

  return (
    <div className={`mathnavi-app min-h-screen lg:flex transition-colors ${dark ? 'bg-[#0B1220] text-slate-100' : 'bg-[#F1F3F6] text-[#111827]'}`}>
      {/* 電腦版：左側欄 */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 h-screen sticky top-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-5 gap-1">
        <a
          href="#flow"
          onClick={(e) => {
            e.preventDefault();
            goTab('flow');
          }}
          className="px-3 pb-4 text-lg font-bold tracking-tight text-slate-900 dark:text-white"
        >
          數學解題通
        </a>
        <button
          type="button"
          onClick={() => {
            // 真的開一題新的：清掉上一題的題目、照片與結果
            setProblemData(null);
            setActiveNode('photo');
            setMainTab('flow');
          }}
          className="mb-3 min-h-11 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Camera className="w-4 h-4" />
          拍新題目
        </button>
        <nav aria-label="主要分頁" className="flex flex-col gap-1">
          {navItems.map(({ tab, label, Icon, badge }) => (
            <button
              key={tab}
              type="button"
              onClick={() => goTab(tab)}
              aria-current={mainTab === tab ? 'page' : undefined}
              className={`min-h-11 rounded-xl px-3 flex items-center gap-3 text-[15px] transition-colors ${
                mainTab === tab
                  ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-bold'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              {label}
              {badge ? (
                <span className="ml-auto text-xs font-bold rounded-full px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center justify-between gap-2 px-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          {firebaseEnabled ? (
            <AccountMenu
              user={user}
              syncState={syncState}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
              placement="up"
            />
          ) : (
            <span />
          )}
          {themeButton}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* 手機版：頂部列 */}
        <header className={`lg:hidden sticky top-0 z-30 h-14 px-4 flex items-center justify-between backdrop-blur-sm ${dark ? 'bg-[#0B1220]/95' : 'bg-[#F1F3F6]/95'}`}>
          <a
            href="#flow"
            onClick={(e) => {
              e.preventDefault();
              goTab('flow');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white"
          >
            數學解題通
          </a>
          <div className="flex items-center gap-1">
            {firebaseEnabled && (
              <AccountMenu user={user} syncState={syncState} onSignIn={handleSignIn} onSignOut={handleSignOut} />
            )}
            {themeButton}
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 lg:pt-8 pb-28 lg:pb-10">
          {mainTab === 'flow' && (
            <FlowWorkspace
              problemData={problemData}
              activeNode={activeNode}
              dark={dark}
              onChangeProblemData={setProblemData}
              onChangeActiveNode={setActiveNode}
              personalizationContext={buildPersonalizedContext(studentProfile, problemData?.concept || '')}
              onSaveMistake={handleSaveMistake}
              onRecordSignal={handleRecordProfileSignal}
              onLogInteraction={handleLogInteraction}
              onToast={showToast}
              bookSummary={bookSummary}
              onOpenBook={() => goTab('book')}
              onOpenRecent={(id) => {
                const saved = book.find((b) => b.id === id);
                if (saved) openSavedInFlow(saved);
              }}
            />
          )}

          {mainTab === 'batch' && (
            <BatchPracticeView
              onLoadProblemToFlow={(data) => {
                setProblemData(data);
                setActiveNode('short_answer');
                setMainTab('flow');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onSaveMistake={handleSaveMistake}
              onRecordPractice={(concept, isCorrect, qText) => {
                handleRecordProfileSignal(concept, 'practice_result', {
                  summary: `自訂練功題自評${isCorrect ? '答對' : '答錯'}`,
                  isCorrect,
                  detail: qText,
                });
              }}
              onPrintWorksheet={handlePrintWorksheet}
              onToast={showToast}
            />
          )}

          {mainTab === 'book' && (
            <MistakeBookView
              book={book}
              dark={dark}
              onUpdateBook={handleUpdateBook}
              onOpenInFlow={openSavedInFlow}
              onRecordReviewSignal={(concept, ok, type, reason, consecutiveWrong) => {
                if (ok) {
                  handleRecordProfileSignal(concept, 'practice_result', {
                    summary: '錯題自評複習答對',
                    isCorrect: true,
                  });
                } else {
                  // 1. 實際答題錯誤 (最高權重強信號)
                  handleRecordProfileSignal(concept, 'actual_answer_wrong', {
                    summary: '錯題複習自評答錯',
                    detail: reason ? `卡點註記：${reason}` : undefined,
                    isCorrect: false,
                  });
                  // 2. 錯誤步驟
                  if (type) {
                    handleRecordProfileSignal(concept, 'error_step', {
                      summary: `錯誤步驟診斷：${type}`,
                      detail: reason,
                      errorCategory: type,
                    });
                  }
                  // 3. 重複錯誤 (連續錯誤 >= 2)
                  if (consecutiveWrong >= 2) {
                    handleRecordProfileSignal(concept, 'consecutive_error', {
                      summary: `同一觀念連續答錯 ${consecutiveWrong} 次`,
                      detail: `持續卡點：${type || '未指定'}`,
                    });
                  }
                }
              }}
              onPrintWorksheet={handlePrintWorksheet}
              onToast={showToast}
            />
          )}

          {mainTab === 'profile' && (
            <LearningProfileView
              profile={studentProfile}
              onResetProfile={() => {
                try {
                  localStorage.removeItem('mathnavi_student_profile_v1');
                } catch {
                  // ignore
                }
                const p = getOrCreateDefaultProfile();
                setStudentProfile(p);
              }}
              distilling={distilling}
              onRefreshNotes={() => runDistill(true)}
              onClearNotes={() => {
                setStudentProfile((cur) => clearLearnerNotes(cur));
                showToast('已清除 AI 學習背景與互動紀錄');
              }}
              onToast={showToast}
            />
          )}
        </main>
      </div>

      {/* 手機版：底部分頁 */}
      <nav
        aria-label="主要分頁"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]"
      >
        {navItems.map(({ tab, label, Icon, badge }) => (
          <button
            key={tab}
            type="button"
            onClick={() => goTab(tab)}
            aria-current={mainTab === tab ? 'page' : undefined}
            className={`relative h-16 flex flex-col items-center justify-center gap-1 text-xs ${
              mainTab === tab ? 'text-sky-700 dark:text-sky-400 font-bold' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Icon className="w-6 h-6" aria-hidden="true" />
            {label}
            {badge ? (
              <span className="absolute top-2 left-1/2 ml-2 min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* Toast 提示 */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold shadow-lg max-w-md text-center"
        >
          {toastMsg}
        </div>
      )}

      {/* A4 列印專用區塊 */}
      {printData && (
        <div id="print-root" className="hidden p-8 text-black bg-white">
          <h1 className="text-2xl font-bold mb-2">
            數學解題通 · {printData.title}
          </h1>
          <p className="text-xs text-slate-600 mb-6 pb-3 border-b border-slate-300">
            姓名：________________　班級：________　日期：____________　共{' '}
            {printData.items.length} 題
          </p>
          <div className="space-y-6">
            {printData.items.map((item, idx) => (
              <div
                key={idx}
                className="pb-5 border-b border-slate-200 break-inside-avoid"
              >
                <div className="text-sm font-medium">
                  <span className="font-mono font-bold mr-2">{idx + 1}.</span>
                  <MathText text={item.q} />
                </div>
                {printData.withAnswers ? (
                  <div className="mt-3 p-3 bg-slate-100 rounded-lg text-xs space-y-1">
                    <div className="font-bold">
                      解答：<MathText text={item.a} />
                    </div>
                    {item.steps &&
                      item.steps.map((s, sIdx) => (
                        <div key={sIdx}>
                          ({sIdx + 1}) <MathText text={s} />
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="h-24" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
