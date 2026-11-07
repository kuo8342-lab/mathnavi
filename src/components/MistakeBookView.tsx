import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Download,
  Upload,
  Printer,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { ERRORS, recordReview } from '../lib/mathCore';
import { SavedMistakeItem } from '../types/math';
import { MathText } from './MathText';
import { MathDiagram } from './MathDiagram';

interface MistakeBookViewProps {
  book: SavedMistakeItem[];
  dark: boolean;
  onUpdateBook: (nextBook: SavedMistakeItem[]) => void;
  onOpenInFlow: (item: SavedMistakeItem) => void;
  onRecordReviewSignal?: (
    concept: string,
    ok: boolean,
    type: string | null,
    reason: string,
    consecutiveWrong: number
  ) => void;
  onPrintWorksheet: (
    items: Array<{ q: string; a: string; steps?: string[] }>,
    withAnswers: boolean,
    title: string
  ) => void;
  onToast: (msg: string) => void;
}

export const MistakeBookView: React.FC<MistakeBookViewProps> = ({
  book,
  dark,
  onUpdateBook,
  onOpenInFlow,
  onRecordReviewSignal,
  onPrintWorksheet,
  onToast,
}) => {
  const [reviewQueue, setReviewQueue] = useState<string[]>([]);
  const [currentReviewId, setCurrentReviewId] = useState<string | null>(null);
  const [phase, setPhase] = useState<
    'idle' | 'question' | 'revealed' | 'diagnosis' | 'recorded' | 'graduated'
  >('idle');
  const [workText, setWorkText] = useState('');
  const [errorType, setErrorType] = useState('');
  const [errorReason, setErrorReason] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const startRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentItem = book.find((q) => q.id === currentReviewId) || null;

  useEffect(() => {
    if (!currentItem || !['question', 'revealed', 'diagnosis'].includes(phase)) {
      return;
    }
    const timer = setInterval(() => {
      setElapsedSec(Math.floor((performance.now() - startRef.current) / 1000));
    }, 300);
    return () => clearInterval(timer);
  }, [currentItem, phase]);

  const formatTime = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    return (
      String(Math.floor(s / 60)).padStart(2, '0') +
      ':' +
      String(s % 60).padStart(2, '0')
    );
  };

  const startReview = (targetId?: string) => {
    if (!book.length) {
      onToast('錯題本目前是空的，請先在解題或練功房將題目加入錯題本。');
      return;
    }
    const sorted = [...book]
      .sort(
        (a, b) =>
          b.wrong * 3 - a.wrong * 3 + (a.mastery - b.mastery) + (a.streak - b.streak)
      )
      .map((q) => q.id);
    setReviewQueue(sorted);
    const firstId = targetId || sorted[0];
    setCurrentReviewId(firstId);
    setPhase('question');
    setWorkText('');
    setErrorType('');
    setErrorReason('');
    setElapsedSec(0);
    startRef.current = performance.now();
  };

  const handleFinishRecord = (ok: boolean, chosenErrorType: string | null) => {
    if (!currentItem) return;
    try {
      const sec = (performance.now() - startRef.current) / 1000;
      const { item: updated, graduated } = recordReview(
        currentItem,
        ok,
        chosenErrorType,
        sec,
        workText,
        errorReason
      );
      const nextBook = book.map((q) => (q.id === updated.id ? updated : q));
      onUpdateBook(nextBook);
      setPhase(graduated ? 'graduated' : 'recorded');

      if (onRecordReviewSignal) {
        onRecordReviewSignal(
          currentItem.concept,
          ok,
          chosenErrorType,
          errorReason,
          updated.consecutiveWrong || 0
        );
      }

      onToast(ok ? '已記錄答對！連續答對與熟練度已更新。' : `已記錄錯誤原因：${chosenErrorType}`);
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : '記錄失敗');
    }
  };

  const handleNextReview = () => {
    const remaining = reviewQueue.filter((id) => id !== currentReviewId);
    setReviewQueue(remaining);
    const nextId = remaining.find((id) => book.some((q) => q.id === id));
    if (nextId) {
      setCurrentReviewId(nextId);
      setPhase('question');
      setWorkText('');
      setErrorType('');
      setErrorReason('');
      setElapsedSec(0);
      startRef.current = performance.now();
    } else {
      setCurrentReviewId(null);
      setPhase('idle');
      onToast('這輪錯題複習已完成！');
    }
  };

  const handleExportJSON = () => {
    const payload = {
      format: 'MathNavi',
      version: 3,
      exportedAt: new Date().toISOString(),
      questions: book,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `數學解題通_錯題備份_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    onToast('已匯出錯題本 JSON 備份檔');
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const raw = JSON.parse(await file.text());
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.questions)
        ? raw.questions
        : null;
      if (!list) throw new Error('不支援的 JSON 備份格式');
      const existingKeys = new Set(
        book.map((q) => q.question.replace(/\s/g, '') + '|' + q.concept)
      );
      const merged = [...book];
      let added = 0;
      for (const item of list) {
        const key =
          String(item.question || item.q || '').replace(/\s/g, '') +
          '|' +
          String(item.concept || '');
        if (!existingKeys.has(key) && item.question) {
          existingKeys.add(key);
          merged.push(item);
          added++;
        }
      }
      onUpdateBook(merged);
      onToast(`成功匯入 ${added} 題錯題紀錄`);
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : '匯入 JSON 失敗');
    }
  };

  // Concept stats
  const conceptGroups = new Map<string, SavedMistakeItem[]>();
  book.forEach((q) => {
    const list = conceptGroups.get(q.concept) || [];
    list.push(q);
    conceptGroups.set(q.concept, list);
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            錯題本
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            連續三次自己算對，這題就算學會了。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => startReview()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            開始錯題複習
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            匯出備份
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            匯入備份
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              handleImportFile(e.target.files?.[0]);
              e.currentTarget.value = '';
            }}
          />
          {book.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onPrintWorksheet(
                  book.map((b) => ({ q: b.question, a: b.answer, steps: b.steps })),
                  false,
                  '個人錯題複習卷'
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              列印錯題卷
            </button>
          )}
        </div>
      </div>

      {/* 互動複習面板 */}
      {phase !== 'idle' && currentItem && (
        <section className="rounded-2xl border-2 border-sky-500/70 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                錯題自評複習 · {currentItem.concept}
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                先自己算算看，再核對答案
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                {formatTime(elapsedSec)}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPhase('idle');
                  setCurrentReviewId(null);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                結束複習
              </button>
            </div>
          </div>

          <div className="my-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 text-base font-medium text-slate-900 dark:text-slate-100">
            <MathText text={currentItem.question} />
          </div>

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            寫下你的計算過程或答案
          </label>
          <textarea
            rows={3}
            value={workText}
            disabled={phase !== 'question'}
            onChange={(e) => setWorkText(e.target.value)}
            placeholder="在這裡記錄你的列式與答案..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-sm text-slate-900 dark:text-white mb-4"
          />

          {phase === 'question' && (
            <button
              type="button"
              onClick={() => setPhase('revealed')}
              className="px-5 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors"
            >
              看標準解答並自評
            </button>
          )}

          {phase !== 'question' && (
            <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60">
                <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                  標準解答
                </div>
                <div className="text-base font-bold text-slate-900 dark:text-white">
                  <MathText text={currentItem.answer} />
                </div>
                {currentItem.steps.length > 0 && (
                  <ol className="list-decimal list-inside space-y-1 mt-3 text-xs text-slate-700 dark:text-slate-300">
                    {currentItem.steps.map((s, idx) => (
                      <li key={idx}>
                        <MathText text={s} />
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {currentItem.drawing && (
                <MathDiagram drawing={currentItem.drawing} dark={dark} />
              )}

              {phase === 'revealed' && (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleFinishRecord(true, null)}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    我算對了！
                  </button>
                  <button
                    type="button"
                    onClick={() => setPhase('diagnosis')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    我算錯了（記錄卡點）
                  </button>
                </div>
              )}

              {phase === 'diagnosis' && (
                <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-3">
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    找出這次卡住的原因，下次就不容易再錯
                  </h3>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      錯誤類型
                    </label>
                    <select
                      value={errorType}
                      onChange={(e) => setErrorType(e.target.value)}
                      className="w-full sm:w-72 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="">請選擇錯誤類型...</option>
                      {ERRORS.map((err) => (
                        <option key={err} value={err}>
                          {err}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      給自己的提醒筆記（選填）
                    </label>
                    <input
                      type="text"
                      value={errorReason}
                      onChange={(e) => setErrorReason(e.target.value)}
                      placeholder="例如：移項忘記變號、公式負號沒括號..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!errorType}
                      onClick={() => handleFinishRecord(false, errorType)}
                      className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold disabled:opacity-40"
                    >
                      儲存錯誤診斷
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhase('revealed')}
                      className="px-3 py-2 rounded-lg text-xs text-slate-600 dark:text-slate-400"
                    >
                      返回
                    </button>
                  </div>
                </div>
              )}

              {phase === 'graduated' && (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong className="text-sm font-bold text-emerald-900 dark:text-emerald-200 block">
                      恭喜！這題已經連續答對 3 次！
                    </strong>
                    <span className="text-xs text-emerald-700 dark:text-emerald-300">
                      要把這題從錯題本移出（畢業），還是繼續保留？
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateBook(book.filter((q) => q.id !== currentItem.id));
                        onToast('已將熟練題目移出錯題本！');
                        handleNextReview();
                      }}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                    >
                      移出錯題本
                    </button>
                    <button
                      type="button"
                      onClick={handleNextReview}
                      className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      繼續保留並下一題
                    </button>
                  </div>
                </div>
              )}

              {phase === 'recorded' && (
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleNextReview}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors"
                  >
                    下一題複習 →
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 學習統計與錯題清單 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              各單元熟練度統計
            </h2>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              共 {book.length} 題
            </span>
          </div>

          {conceptGroups.size === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              尚未加入任何題目。在「數學解題通」或「練功房」點擊「加入錯題本」即可在此追蹤。
            </p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {[...conceptGroups.entries()].map(([concept, items]) => {
                const avgMastery = Math.round(
                  items.reduce((acc, q) => acc + q.mastery, 0) / items.length
                );
                const totalAttempts = items.reduce((acc, q) => acc + q.attempts, 0);
                return (
                  <div key={concept} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1.5">
                      <span>{concept}</span>
                      <span className="font-mono tabular-nums text-sky-600 dark:text-sky-400">
                        {avgMastery}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-1.5">
                      <div
                        className="h-full bg-sky-600 rounded-full transition-all"
                        style={{ width: `${avgMastery}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {items.length} 題 · 累計練習 {totalAttempts} 次
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            收藏題目列表
          </h2>
          {book.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              錯題本目前沒有題目，快去「數學解題通」試試拍照或解題吧！
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {book.map((item) => (
                <article key={item.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    <span>{item.concept}</span>
                    <span className="mx-1.5">·</span>
                    <span className="font-mono tabular-nums">連對 {item.streak} 次</span>
                    <span className="mx-1.5">·</span>
                    <span className="font-mono tabular-nums">
                      對 {item.right} / 錯 {item.wrong}
                    </span>
                    {item.lastErrorType && (
                      <>
                        <span className="mx-1.5">·</span>
                        <span className="text-rose-600 dark:text-rose-400">
                          上次卡點：{item.lastErrorType}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 my-2">
                    <MathText text={item.question} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => onOpenInFlow(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 text-xs font-semibold hover:bg-sky-100 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      在解題通開啟
                    </button>
                    <button
                      type="button"
                      onClick={() => startReview(item.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      單題複習
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateBook(book.filter((q) => q.id !== item.id));
                        onToast('已刪除該題紀錄');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      移除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
