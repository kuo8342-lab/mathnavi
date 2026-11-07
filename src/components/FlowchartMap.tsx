import React from 'react';
import { FlowNodeId } from '../types/math';

interface FlowchartMapProps {
  activeNode: FlowNodeId;
  hasProblem: boolean;
  onSelectNode: (node: FlowNodeId) => void;
}

export const FlowchartMap: React.FC<FlowchartMapProps> = ({
  activeNode,
  hasProblem,
  onSelectNode,
}) => {
  const isExplainBranch =
    activeNode === 'dont_understand' ||
    activeNode === 'ai_explain' ||
    activeNode === 'congrats';

  const isDontKnowBranch =
    activeNode === 'dont_know' ||
    activeNode === 'short_answer' ||
    activeNode === 'detailed_answer' ||
    activeNode === 'knowledge_points' ||
    activeNode === 'knowledge_videos' ||
    activeNode === 'knowledge_literature' ||
    activeNode === 'practice_dojo' ||
    activeNode === 'practice_same' ||
    activeNode === 'practice_extension';

  const btnBase =
    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 whitespace-nowrap select-none cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed';

  const getStyle = (ids: FlowNodeId[], variant: 'teal' | 'green' | 'sky' | 'amber' | 'neutral') => {
    const isActive = ids.includes(activeNode);
    if (isActive) {
      switch (variant) {
        case 'teal':
          return 'bg-cyan-700 text-white border-cyan-700 shadow-xs ring-2 ring-cyan-500/30';
        case 'green':
          return 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/30';
        case 'sky':
          return 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-500/30';
        case 'amber':
          return 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-500/30';
        default:
          return 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900';
      }
    }
    switch (variant) {
      case 'teal':
        return 'bg-cyan-50/80 dark:bg-cyan-950/40 text-cyan-900 dark:text-cyan-200 border-cyan-300 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/60';
      case 'green':
        return 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60';
      case 'sky':
        return 'bg-sky-50/80 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/60';
      case 'amber':
        return 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60';
      default:
        return 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-slate-400';
    }
  };

  return (
    <section
      aria-label="數學解題通互動流程圖"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 mb-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold tracking-tight text-rose-800 dark:text-rose-400 border border-slate-300 dark:border-slate-700 px-2.5 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/60">
            數學解題通
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            點擊流程圖節點可直接切換對應功能
          </span>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          目前位置：
          <strong className="text-slate-800 dark:text-slate-200 ml-1">
            {
              {
                photo: '拍照／輸入題目',
                dont_understand: '看不懂 → AI 解釋',
                ai_explain: 'AI 解釋',
                congrats: '恭喜自己學會！',
                dont_know: '不會 → 選擇學習方式',
                short_answer: '不會 → 簡答',
                detailed_answer: '不會 → 詳答',
                knowledge_points: '不會 → 知識點',
                knowledge_videos: '知識點 → 影片',
                knowledge_literature: '知識點 → 文獻',
                practice_dojo: '不會 → 練功房',
                practice_same: '練功房 → 同類型',
                practice_extension: '練功房 → 延伸',
              }[activeNode]
            }
          </strong>
        </div>
      </div>

      {/* 視覺化流程圖結構 */}
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[680px] flex items-start gap-3">
          {/* 左側起點：拍照 */}
          <div className="flex flex-col items-center justify-center pt-9">
            <button
              type="button"
              onClick={() => onSelectNode('photo')}
              className={`${btnBase} px-4 py-2 text-sm ${getStyle(['photo'], 'neutral')}`}
            >
              拍照／題目
            </button>
          </div>

          {/* 分支箭頭 */}
          <div className="flex flex-col justify-between pt-3 pb-8 text-slate-400 dark:text-slate-500 select-none font-mono text-xs">
            <div className="h-8 flex items-center">↗</div>
            <div className="h-12 flex items-center">↘</div>
          </div>

          {/* 中間主幹：看不懂 vs 不會 */}
          <div className="flex-1 flex flex-col gap-4">
            {/* 上方路徑：看不懂 -> AI 解釋 -> 恭喜 (且可往下連到 不會) */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                disabled={!hasProblem}
                onClick={() => onSelectNode('ai_explain')}
                className={`${btnBase} ${getStyle(
                  ['dont_understand', 'ai_explain'],
                  'teal'
                )}`}
              >
                看不懂
              </button>
              <span className="text-slate-400 text-xs font-mono">→</span>
              <div className="relative flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={!hasProblem}
                  onClick={() => onSelectNode('ai_explain')}
                  className={`${btnBase} ${getStyle(['ai_explain'], 'green')}`}
                >
                  AI 解釋
                </button>
                <span className="text-slate-400 text-xs font-mono">→</span>
                <button
                  type="button"
                  disabled={!hasProblem}
                  onClick={() => onSelectNode('congrats')}
                  className={`${btnBase} ${getStyle(['congrats'], 'neutral')}`}
                >
                  恭喜
                </button>
              </div>
              {isExplainBranch && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1">
                  （若看懂題目但仍不會算，可沿下方箭頭進入「不會」）
                </span>
              )}
            </div>

            {/* AI 解釋 指向 不會 的轉折連接線 */}
            <div className="flex items-center pl-20 text-xs text-slate-400 dark:text-slate-500 -my-2">
              <span className="font-mono">┌──────┘</span>
              <span className="ml-2 text-[11px]">還是不會算 ↓</span>
            </div>

            {/* 下方路徑：不會 -> 簡答 / 詳答 / 知識點(影片、文獻) / 練功房(同類型、延伸) */}
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <button
                  type="button"
                  disabled={!hasProblem}
                  onClick={() => onSelectNode('short_answer')}
                  className={`${btnBase} ${getStyle(
                    isDontKnowBranch ? [activeNode] : ['dont_know'],
                    'teal'
                  )}`}
                >
                  不會
                </button>
              </div>

              <div className="text-slate-400 text-xs font-mono pt-2 select-none">→</div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                {/* 1. 簡答 */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={!hasProblem}
                    onClick={() => onSelectNode('short_answer')}
                    className={`${btnBase} w-full justify-center flex ${getStyle(
                      ['short_answer'],
                      'sky'
                    )}`}
                  >
                    簡答
                  </button>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    快速核對最終答案
                  </span>
                </div>

                {/* 2. 詳答 */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={!hasProblem}
                    onClick={() => onSelectNode('detailed_answer')}
                    className={`${btnBase} w-full justify-center flex ${getStyle(
                      ['detailed_answer'],
                      'sky'
                    )}`}
                  >
                    詳答
                  </button>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    完整步驟與圖解
                  </span>
                </div>

                {/* 3. 知識點 -> 影片 / 文獻 */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={!hasProblem}
                    onClick={() => onSelectNode('knowledge_videos')}
                    className={`${btnBase} w-full justify-center flex ${getStyle(
                      ['knowledge_points', 'knowledge_videos', 'knowledge_literature'],
                      'amber'
                    )}`}
                  >
                    知識點
                  </button>
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      disabled={!hasProblem}
                      onClick={() => onSelectNode('knowledge_videos')}
                      className={`${btnBase} px-2 py-1 text-[11px] text-center ${getStyle(
                        ['knowledge_videos'],
                        'neutral'
                      )}`}
                    >
                      影片
                    </button>
                    <button
                      type="button"
                      disabled={!hasProblem}
                      onClick={() => onSelectNode('knowledge_literature')}
                      className={`${btnBase} px-2 py-1 text-[11px] text-center ${getStyle(
                        ['knowledge_literature'],
                        'neutral'
                      )}`}
                    >
                      文獻
                    </button>
                  </div>
                </div>

                {/* 4. 練功房 -> 同類型 / 延伸 */}
                <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={!hasProblem}
                    onClick={() => onSelectNode('practice_same')}
                    className={`${btnBase} w-full justify-center flex ${getStyle(
                      ['practice_dojo', 'practice_same', 'practice_extension'],
                      'amber'
                    )}`}
                  >
                    練功房
                  </button>
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      disabled={!hasProblem}
                      onClick={() => onSelectNode('practice_same')}
                      className={`${btnBase} px-2 py-1 text-[11px] text-center ${getStyle(
                        ['practice_same'],
                        'neutral'
                      )}`}
                    >
                      同類型
                    </button>
                    <button
                      type="button"
                      disabled={!hasProblem}
                      onClick={() => onSelectNode('practice_extension')}
                      className={`${btnBase} px-2 py-1 text-[11px] text-center ${getStyle(
                        ['practice_extension'],
                        'neutral'
                      )}`}
                    >
                      延伸
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
