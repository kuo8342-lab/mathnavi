import React from 'react';
import { Brain, RefreshCw, Trash2, Route, AlertTriangle, CheckCircle2, Gauge, Lightbulb } from 'lucide-react';
import type { StudentLearningProfile } from '../types/learningProfile';
import { DISTILL_THRESHOLD } from '../lib/learningProfile';

interface LearnerNotesCardProps {
  profile: StudentLearningProfile;
  distilling: boolean;
  onRefresh: () => void;
  onClear: () => void;
}

const PACE_LABEL: Record<string, { text: string; cls: string }> = {
  fast: { text: '學得快', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
  steady: { text: '穩定進步', cls: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300' },
  needs_time: { text: '需要多一點時間', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  unknown: { text: '資料還不夠', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

export const LearnerNotesCard: React.FC<LearnerNotesCardProps> = ({ profile, distilling, onRefresh, onClear }) => {
  const notes = profile.learnerNotes;
  const pending = profile.pendingTurns?.length || 0;
  const pace = PACE_LABEL[notes?.pace || 'unknown'] || PACE_LABEL.unknown;

  return (
    <section className="rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Brain className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            AI 學習背景
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            AI 會分析你的提問與作答，整理出你的節奏、卡點和下一步。之後的講解、知識點補充和練習題都會依此調整。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={distilling || pending === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${distilling ? 'animate-spin' : ''}`} />
            {distilling ? '分析中…' : '立即更新'}
          </button>
          {(notes || pending > 0) && (
            <button
              type="button"
              onClick={() => {
                if (confirm('確定清除 AI 學習背景和尚未分析的互動紀錄？')) onClear();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清除
            </button>
          )}
        </div>
      </div>

      {!notes ? (
        <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 p-4 text-sm text-slate-700 dark:text-slate-300">
          還沒有學習背景。用「AI 解釋」、向 AI 追問，或在練功房寫下算式並自評之後，
          每累積 {DISTILL_THRESHOLD} 筆互動，AI 就會自動整理一次。
          <div className="mt-2 text-xs text-violet-700 dark:text-violet-300 font-semibold">
            目前已累積 {pending} / {DISTILL_THRESHOLD} 筆
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{notes.summary}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <Gauge className="w-3.5 h-3.5" />
                學習節奏
              </span>
              <span className={`px-2 py-0.5 rounded-full font-semibold ${pace.cls}`}>{pace.text}</span>
              {notes.paceNote && <span className="text-slate-500 dark:text-slate-400">{notes.paceNote}</span>}
            </div>
            {notes.preferredStyle && (
              <div className="flex gap-2 text-xs text-slate-700 dark:text-slate-300">
                <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>
                  <strong>適合你的講解方式：</strong>
                  {notes.preferredStyle}
                </span>
              </div>
            )}
            {notes.strengths.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  已經掌握
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {notes.strengths.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {notes.misconceptions.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  目前的卡點
                </div>
                <ul className="space-y-1">
                  {notes.misconceptions.map((m, i) => (
                    <li key={i} className="text-xs text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-white">{m.concept}</strong>：{m.note}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">
              <Route className="w-3.5 h-3.5" />
              你的成長路徑
            </div>
            {notes.growthPath.length ? (
              <ol className="relative border-l-2 border-violet-200 dark:border-violet-900 ml-2 space-y-3">
                {notes.growthPath.map((g, i) => (
                  <li key={i} className="pl-4 relative">
                    <span className="absolute -left-[9px] top-0.5 w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{g.concept}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{g.reason}</div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">再多練習幾題，AI 就能排出建議路徑。</p>
            )}
          </div>
        </div>
      )}

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
        {notes && <span>上次更新：{new Date(notes.updatedAt).toLocaleString('zh-TW')}</span>}
        {notes && <span>已分析 {notes.distilledTurns} 筆互動</span>}
        <span>待分析 {pending} 筆</span>
        <span>這份背景只用來調整 AI 的講解方式，只有你自己看得到，可以隨時清除。</span>
      </div>
    </section>
  );
};
