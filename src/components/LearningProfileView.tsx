import React, { useState } from 'react';
import {
  StudentLearningProfile,
  KnowledgeProfileNode,
} from '../types/learningProfile';
import {
  Download,
  AlertTriangle,
  Flame,
  CheckCircle2,
  XCircle,
  Eye,
  FileQuestion,
  HelpCircle,
  Dumbbell,
  MousePointer,
  RotateCcw,
} from 'lucide-react';

import { LearnerNotesCard } from './LearnerNotesCard';

interface LearningProfileViewProps {
  profile: StudentLearningProfile;
  onResetProfile: () => void;
  distilling: boolean;
  onRefreshNotes: () => void;
  onClearNotes: () => void;
  onToast: (msg: string) => void;
}

const PRIORITY_BADGES: Record<
  number,
  { label: string; bg: string; text: string; icon: React.ReactNode }
> = {
  1: {
    label: '1. 實際答題錯誤 (最高權重)',
    bg: 'bg-rose-100 dark:bg-rose-950/60',
    text: 'text-rose-800 dark:text-rose-300',
    icon: <XCircle className="w-3.5 h-3.5 text-rose-600" />,
  },
  2: {
    label: '2. 錯誤步驟診斷',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-400',
    icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />,
  },
  3: {
    label: '3. 重複錯誤 (連續卡點)',
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-800 dark:text-amber-300',
    icon: <Flame className="w-3.5 h-3.5 text-amber-600" />,
  },
  4: {
    label: '4. 主動表示不會／看不懂',
    bg: 'bg-cyan-100 dark:bg-cyan-950/60',
    text: 'text-cyan-800 dark:text-cyan-300',
    icon: <HelpCircle className="w-3.5 h-3.5 text-cyan-600" />,
  },
  5: {
    label: '5. 練功房作答結果',
    bg: 'bg-sky-100 dark:bg-sky-950/60',
    text: 'text-sky-800 dark:text-sky-300',
    icon: <Dumbbell className="w-3.5 h-3.5 text-sky-600" />,
  },
  6: {
    label: '6. 學習資源觀看 (弱訊號)',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    icon: <Eye className="w-3.5 h-3.5 text-slate-500" />,
  },
  7: {
    label: '7. 單純點擊瀏覽 (最弱訊號)',
    bg: 'bg-slate-50 dark:bg-slate-900',
    text: 'text-slate-500 dark:text-slate-500',
    icon: <MousePointer className="w-3.5 h-3.5 text-slate-400" />,
  },
};

export const LearningProfileView: React.FC<LearningProfileViewProps> = ({
  profile,
  onResetProfile,
  distilling,
  onRefreshNotes,
  onClearNotes,
  onToast,
}) => {
  const [selectedKpId, setSelectedKpId] = useState<string>(() => {
    return Object.keys(profile.knowledgeProfile)[0] || '';
  });

  const nodes = Object.values(profile.knowledgeProfile);
  const activeNode: KnowledgeProfileNode | undefined =
    profile.knowledgeProfile[selectedKpId] || nodes[0];

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `學生學習輪廓_${profile.studentId}_${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    onToast('已匯出個人學習輪廓 JSON 資料');
  };

  return (
    <div className="space-y-8">
      {/* 標題與簡介 */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            學習輪廓
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            依照你實際答對、答錯的紀錄整理出強項和弱點，不是看你點了幾次。
            各項訊號依真實認知權重排序記錄。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            匯出學習輪廓 JSON
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm('確定重設目前學生的學習輪廓資料？')) {
                onResetProfile();
                onToast('已重設學習輪廓資料');
              }
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置資料
          </button>
        </div>
      </div>

      <LearnerNotesCard
        profile={profile}
        distilling={distilling}
        onRefresh={onRefreshNotes}
        onClear={onClearNotes}
      />

      {/* 學生資訊與權重規則說明 */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400 space-x-3">
            <span>
              學生代號：
              <strong className="text-slate-900 dark:text-white font-mono text-sm ml-1">
                {profile.studentId}
              </strong>
            </span>
            <span>·</span>
            <span>
              追蹤單元數：
              <strong className="text-slate-900 dark:text-white ml-1">
                {nodes.length}
              </strong>
            </span>
            <span>·</span>
            <span>
              最後更新：
              <span className="font-mono ml-1">
                {new Date(profile.updatedAt).toLocaleString('zh-TW')}
              </span>
            </span>
          </div>
        </div>

        {/* 權重規則卡片 */}
        <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2">
          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-600" />
            個人學習輪廓訊號權重原則（避免看過次數的假性熟練）：
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
              <strong className="text-rose-600 dark:text-rose-400 block mb-0.5">
                優先權 1~3（最高權重強訊號）
              </strong>
              實際答題錯誤、錯誤步驟、連續答錯
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
              <strong className="text-cyan-700 dark:text-cyan-400 block mb-0.5">
                優先權 4（主動認知回饋）
              </strong>
              主動點選「看不懂」或「不會」之難度宣告
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
              <strong className="text-sky-600 dark:text-sky-400 block mb-0.5">
                優先權 5（實作檢驗）
              </strong>
              練功房同類型／延伸題作答結果
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
              <strong className="text-slate-500 block mb-0.5">
                優先權 6~7（弱訊號）
              </strong>
              觀看教學影片、閱讀文獻或單純點擊瀏覽
            </div>
          </div>
        </div>
      </section>

      {/* 知識點選擇與詳細輪廓 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 左欄：知識點輪廓清單 */}
        <section className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
            各單元知識點輪廓
          </h2>

          <div className="space-y-2">
            {nodes.map((node) => {
              const isSelected = node.knowledgeId === activeNode?.knowledgeId;
              return (
                <button
                  key={node.knowledgeId}
                  type="button"
                  onClick={() => setSelectedKpId(node.knowledgeId)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40 ring-1 ring-sky-500'
                      : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-800/40 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                    <span>{node.knowledgeName}</span>
                    <span className="font-mono text-sky-600 dark:text-sky-400 text-sm">
                      {node.masteryScore} 分
                    </span>
                  </div>

                  {/* 熟練度長條 */}
                  <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2">
                    <div
                      className={`h-full rounded-full transition-all ${
                        node.masteryScore >= 75
                          ? 'bg-emerald-500'
                          : node.masteryScore >= 45
                          ? 'bg-sky-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${node.masteryScore}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>
                      對 {node.correctCount} / 錯 {node.wrongCount}
                    </span>
                    {node.consecutiveWrong > 0 && (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        連錯 {node.consecutiveWrong} 次
                      </span>
                    )}
                    <span>練 {node.practiceCount} 題</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 右欄：所選知識點的深入指標與證據流 (evidence[]) */}
        {activeNode && (
          <section className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs text-sky-600 dark:text-sky-400 font-semibold">
                  知識點代碼：{activeNode.knowledgeId}
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {activeNode.knowledgeName}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">目前計算熟練度</span>
                <span className="text-2xl font-bold font-mono text-sky-600 dark:text-sky-400">
                  {activeNode.masteryScore}
                  <small className="text-xs font-normal text-slate-400"> / 100</small>
                </span>
              </div>
            </div>

            {/* 各項指標數據卡 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-center">
                <span className="text-[11px] text-slate-500 block mb-0.5">
                  累計答對 / 答錯
                </span>
                <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100">
                  {activeNode.correctCount} / {activeNode.wrongCount}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-center">
                <span className="text-[11px] text-slate-500 block mb-0.5">
                  連續答錯計數
                </span>
                <span
                  className={`text-sm font-bold font-mono ${
                    activeNode.consecutiveWrong > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {activeNode.consecutiveWrong} 次
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-center">
                <span className="text-[11px] text-slate-500 block mb-0.5">
                  主動回報難度
                </span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {
                    {
                      none: '無主動標記',
                      low: '簡單',
                      medium: '中等',
                      high: '困難（不會）',
                      unintelligible: '題意看不懂',
                    }[activeNode.selfReportedDifficulty]
                  }
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-center">
                <span className="text-[11px] text-slate-500 block mb-0.5">
                  練功題數 / 資源閱覽
                </span>
                <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100">
                  {activeNode.practiceCount} 題 / {activeNode.viewedResourceCount} 次
                </span>
              </div>
            </div>

            {/* 證據清單：evidence[] */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  學習行為證據日誌 (evidence[])
                </h4>
                <span className="text-xs text-slate-500 font-mono">
                  共 {activeNode.evidence.length} 筆加權紀錄
                </span>
              </div>

              {activeNode.evidence.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  此知識點目前尚無作答或學習行為紀錄。
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {activeNode.evidence.map((ev) => {
                    const badge = PRIORITY_BADGES[ev.priority] || PRIORITY_BADGES[7];
                    return (
                      <div
                        key={ev.id}
                        className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${badge.bg} ${badge.text}`}
                            >
                              {badge.icon}
                              {badge.label}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              權重比重：{ev.weight.toFixed(1)}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {ev.summary}
                          </p>
                          {ev.detail && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                              備註：{ev.detail}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          {ev.scoreDelta !== undefined && ev.scoreDelta !== 0 && (
                            <span
                              className={`font-mono font-bold text-xs ${
                                ev.scoreDelta > 0
                                  ? 'text-emerald-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {ev.scoreDelta > 0 ? `+${ev.scoreDelta}` : ev.scoreDelta}
                            </span>
                          )}
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {new Date(ev.timestamp).toLocaleTimeString('zh-TW', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
