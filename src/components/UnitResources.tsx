import React, { useEffect, useState } from 'react';
import { CirclePlay, ClipboardList, ExternalLink, FileText } from 'lucide-react';

type ResourceLink = { title: string; url: string };
type Unit = {
  id: string;
  grade: number;
  chapter: string;
  title: string;
  url: string;
  videos: ResourceLink[];
  exercises: ResourceLink[];
};
type PastExam = {
  year: string;
  no: number;
  unitIds: string[];
  passrate: number | null;
  url: string;
};

interface UnitResourcesProps {
  unitIds: string[];
  onOpen?: (title: string, url: string) => void;
}

/**
 * 真實資源：均一教育平台的單元影片與練習（src/data/units.json，已逐一確認連結存在），
 * 以及同單元的歷屆會考題與全國答對率（src/data/pastExams.json）。資料只在點開知識點時才下載。
 */
export const UnitResources: React.FC<UnitResourcesProps> = ({ unitIds, onOpen }) => {
  const [data, setData] = useState<{ units: Unit[]; exams: PastExam[] } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([import('../data/units.json'), import('../data/pastExams.json')])
      .then(([u, p]) => {
        if (alive) setData({ units: u.default.units as Unit[], exams: p.default.items as PastExam[] });
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (failed) {
    return <p className="text-xs text-slate-500">教學資源暫時載入失敗，請重新整理頁面。</p>;
  }
  if (!data) {
    return <p className="text-xs text-slate-500">正在載入教學資源…</p>;
  }

  const units = unitIds
    .map((id) => data.units.find((u) => u.id === id))
    .filter((u): u is Unit => Boolean(u));
  const exams = data.exams
    .filter((e) => e.unitIds.some((id) => unitIds.includes(id)))
    .sort((a, b) => Number(b.year) - Number(a.year) || a.no - b.no);

  if (!units.length) {
    return <p className="text-xs text-slate-500">這題沒有對應到國中單元，暫時沒有推薦資源。</p>;
  }

  const linkClass =
    'flex items-start gap-2 p-2.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs text-slate-700 dark:text-slate-200 transition-colors';

  return (
    <div className="space-y-4">
      {units.map((u) => (
        <article
          key={u.id}
          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                均一教育平台 · {u.grade} 年級 {u.chapter}
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{u.title}</h4>
            </div>
            <a
              href={u.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onOpen?.(u.title, u.url)}
              className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              整個單元
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="grid grid-cols-1 gap-0.5">
            {u.videos.map((v) => (
              <a key={v.url} href={v.url} target="_blank" rel="noopener noreferrer" onClick={() => onOpen?.(v.title, v.url)} className={linkClass}>
                <CirclePlay className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{v.title}</span>
              </a>
            ))}
            {u.exercises.map((x) => (
              <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer" onClick={() => onOpen?.(x.title, x.url)} className={linkClass}>
                <ClipboardList className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>練習：{x.title}</span>
              </a>
            ))}
          </div>
        </article>
      ))}

      {exams.length > 0 && (
        <article className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-600" />
            這個單元的歷屆會考題
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            題目來自國中教育會考官網，答對率是當年全國考生的實際數據。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {exams.map((e) => (
              <a
                key={`${e.year}-${e.no}`}
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => onOpen?.(`${e.year} 年會考第 ${e.no} 題`, e.url)}
                className={linkClass}
              >
                <span className="font-semibold">
                  {e.year} 年第 {e.no} 題
                </span>
                {e.passrate != null && (
                  <span className="text-slate-500 dark:text-slate-400">全國答對率 {Math.round(e.passrate * 100)}%</span>
                )}
              </a>
            ))}
          </div>
        </article>
      )}
    </div>
  );
};
