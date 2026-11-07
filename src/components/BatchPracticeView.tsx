import React, { useState } from 'react';
import { Printer, RefreshCw, BookmarkPlus, ArrowRight } from 'lucide-react';
import {
  TEMPLATES,
  TemplateFieldDef,
  batch,
  makeData,
  randomValues,
} from '../lib/mathCore';
import { MathProblemData, PracticeItem, TemplateKind } from '../types/math';
import { MathText } from './MathText';

interface BatchPracticeViewProps {
  onLoadProblemToFlow: (data: MathProblemData) => void;
  onSaveMistake: (item: {
    question: string;
    shortAnswer: string;
    concept: string;
    steps: string[];
    source: 'local' | 'ai';
  }) => void;
  onRecordPractice?: (concept: string, isCorrect: boolean, question: string) => void;
  onPrintWorksheet: (
    items: Array<{ q: string; a: string; steps?: string[] }>,
    withAnswers: boolean,
    title: string
  ) => void;
  onToast: (msg: string) => void;
}

export const BatchPracticeView: React.FC<BatchPracticeViewProps> = ({
  onLoadProblemToFlow,
  onSaveMistake,
  onRecordPractice,
  onPrintWorksheet,
  onToast,
}) => {
  const [tplKind, setTplKind] = useState<TemplateKind>('quad');
  const [tplValues, setTplValues] = useState<Record<string, number | string>>({
    a: 1,
    b: 1,
    c: -6,
  });

  const [batchKind, setBatchKind] = useState<TemplateKind>('quad');
  const [batchLevel, setBatchLevel] = useState<'sameType' | 'extension'>('sameType');
  const [batchCount, setBatchCount] = useState<number>(5);
  const [batchItems, setBatchItems] = useState<PracticeItem[]>(() =>
    batch('quad', 5, 'sameType')
  );

  const handleKindChange = (nextKind: TemplateKind) => {
    setTplKind(nextKind);
    const defaults: Record<string, number | string> = {};
    TEMPLATES[nextKind].fields.forEach((f: TemplateFieldDef) => {
      defaults[f.id] = f.defaultValue;
    });
    setTplValues(defaults);
  };

  const handleRandomizeTpl = () => {
    setTplValues(randomValues(tplKind));
  };

  const handleRunCustom = () => {
    try {
      const data = makeData(tplKind, tplValues);
      onLoadProblemToFlow(data);
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : '參數格式有誤');
    }
  };

  const handleGenerateBatch = () => {
    try {
      const items = batch(batchKind, batchCount, batchLevel);
      setBatchItems(items);
      onToast(
        `已產生 ${items.length} 題「${
          batchLevel === 'sameType' ? '同類型' : '延伸'
        }」練習題`
      );
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : '產生題目失敗');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            練功房
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            自己設定數字出一題，或一次產生多題練習卷，可以印成 A4。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左欄：自訂一題 */}
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            01. 自訂參數建立單題
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            設定題型與係數，直接進入「數學解題通」查看簡答、詳答與圖解。
          </p>

          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            選擇單元題型
          </label>
          <select
            value={tplKind}
            onChange={(e) => handleKindChange(e.target.value as TemplateKind)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white mb-4"
          >
            <option value="quad">一元二次方程式</option>
            <option value="coord">直角座標系與點的平移</option>
            <option value="gcd">最大公因數與最小公倍數</option>
          </select>

          <div className="grid grid-cols-2 gap-3 mb-5">
            {TEMPLATES[tplKind].fields.map((field) => (
              <label key={field.id} className="block">
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {field.label}
                </span>
                {field.id.startsWith('d') ? (
                  <select
                    value={String(tplValues[field.id] ?? field.defaultValue)}
                    onChange={(e) =>
                      setTplValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  >
                    {['右', '左', '上', '下'].map((dir) => (
                      <option key={dir} value={dir}>
                        {dir}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    step="1"
                    value={String(tplValues[field.id] ?? field.defaultValue)}
                    onChange={(e) =>
                      setTplValues((prev) => ({
                        ...prev,
                        [field.id]: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
                  />
                )}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleRunCustom}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap"
            >
              送入解題流程
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRandomizeTpl}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              隨機換一組數字
            </button>
          </div>
        </section>

        {/* 右欄：批次產生練功房試卷 */}
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                02. 批次產生「同類型／延伸」練習卷
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                對應流程圖「練功房 → 同類型 / 延伸」，可一次產生多題並匯出列印。
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                單元題型
              </span>
              <select
                value={batchKind}
                onChange={(e) => setBatchKind(e.target.value as TemplateKind)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="quad">一元二次方程式</option>
                <option value="coord">座標平移</option>
                <option value="gcd">最大公因數／最小公倍數</option>
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                練功房分支
              </span>
              <select
                value={batchLevel}
                onChange={(e) =>
                  setBatchLevel(e.target.value as 'sameType' | 'extension')
                }
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="sameType">同類型（熟練基礎）</option>
                <option value="extension">延伸（跨觀念應用）</option>
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                題數
              </span>
              <select
                value={batchCount}
                onChange={(e) => setBatchCount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
              >
                <option value={3}>3 題</option>
                <option value={5}>5 題</option>
                <option value={10}>10 題</option>
                <option value={20}>20 題</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pb-5 border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleGenerateBatch}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              重新產生題組
            </button>
            <button
              type="button"
              onClick={() => onPrintWorksheet(batchItems, false, '練功房題目卷')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              列印空白題目卷
            </button>
            <button
              type="button"
              onClick={() => onPrintWorksheet(batchItems, true, '練功房解答卷')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              列印含解答卷
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 mt-2">
            {batchItems.map((item, idx) => (
              <article key={idx} className="py-4 first:pt-2 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-relaxed">
                    <span className="font-mono font-bold text-sky-600 dark:text-sky-400 mr-2">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <MathText text={item.q} />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onSaveMistake({
                        question: item.q,
                        shortAnswer: item.a,
                        concept: item.concepts.join(' · ') || '練功房題目',
                        steps: item.steps || [],
                        source: item.source || 'local',
                      })
                    }
                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:border-sky-500 transition-colors whitespace-nowrap"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    加入錯題本
                  </button>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  觀念：{item.concepts.join(' · ')}
                </div>

                <details className="mt-2.5 group">
                  <summary className="text-xs font-semibold text-sky-600 dark:text-sky-400 cursor-pointer select-none">
                    查看簡答與詳解
                  </summary>
                  <div className="mt-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3.5 text-xs space-y-2 border border-slate-200/70 dark:border-slate-800">
                    <div className="font-semibold text-emerald-700 dark:text-emerald-400">
                      簡答：<MathText text={item.a} />
                    </div>
                    {item.steps && item.steps.length > 0 && (
                      <ol className="list-decimal list-inside space-y-1 text-slate-700 dark:text-slate-300">
                        {item.steps.map((s, sIdx) => (
                          <li key={sIdx}>
                            <MathText text={s} />
                          </li>
                        ))}
                      </ol>
                    )}
                    {onRecordPractice && (
                      <div className="pt-2 flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">自評此題：</span>
                        <button
                          type="button"
                          onClick={() => {
                            onRecordPractice(item.concepts[0] || '練功房', true, item.q);
                            onToast('已記錄自評答對，更新至個人學習輪廓！');
                          }}
                          className="px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[11px]"
                        >
                          我答對了
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRecordPractice(item.concepts[0] || '練功房', false, item.q);
                            onToast('已記錄自評答錯，更新至個人學習輪廓！');
                          }}
                          className="px-2 py-1 rounded bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 text-[11px]"
                        >
                          我答錯了
                        </button>
                      </div>
                    )}
                  </div>
                </details>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
