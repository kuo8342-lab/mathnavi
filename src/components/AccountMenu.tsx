import React, { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { Cloud, CloudOff, LogIn, LogOut, RefreshCw } from 'lucide-react';

export type SyncState = 'local' | 'syncing' | 'synced' | 'error';

interface AccountMenuProps {
  user: User | null;
  syncState: SyncState;
  onSignIn: () => void;
  onSignOut: () => void;
  /** 選單往下（頂部列）或往上（電腦版側欄底部）展開 */
  placement?: 'down' | 'up';
}

const STATUS_TEXT: Record<SyncState, string> = {
  local: '資料只存在這台裝置',
  syncing: '正在同步…',
  synced: '已與雲端同步',
  error: '同步失敗，恢復連線後會自動重試',
};

export const AccountMenu: React.FC<AccountMenuProps> = ({ user, syncState, onSignIn, onSignOut, placement = 'down' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap cursor-pointer"
        title="用 Google 帳號登入，手機和電腦的錯題本、學習輪廓會自動同步"
      >
        <LogIn className="w-4 h-4" />
        登入同步
      </button>
    );
  }

  const StatusIcon = syncState === 'syncing' ? RefreshCw : syncState === 'error' ? CloudOff : Cloud;
  const name = user.displayName || user.email || '已登入';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center rounded-full border border-slate-200 dark:border-slate-700 hover:ring-2 hover:ring-sky-200 dark:hover:ring-sky-900 transition cursor-pointer"
        aria-label={`帳號：${name}，${STATUS_TEXT[syncState]}`}
        aria-expanded={open}
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-sky-600 text-white text-sm font-bold flex items-center justify-center">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span
          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 ${
            syncState === 'error' ? 'text-red-500' : 'text-sky-600 dark:text-sky-400'
          }`}
        >
          <StatusIcon className={`w-3 h-3 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
        </span>
      </button>

      {open && (
        <div className={`absolute ${placement === 'up' ? 'left-0 bottom-full mb-2' : 'right-0 mt-2'} w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-3 z-40 text-xs`}>
          <div className="font-semibold text-slate-900 dark:text-white truncate">{user.displayName || '已登入'}</div>
          {user.email && <div className="text-slate-500 dark:text-slate-400 truncate">{user.email}</div>}
          <div
            className={`mt-2 flex items-center gap-1.5 ${
              syncState === 'error' ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <StatusIcon className={`w-3.5 h-3.5 ${syncState === 'syncing' ? 'animate-spin' : ''}`} />
            {STATUS_TEXT[syncState]}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            登出
          </button>
        </div>
      )}
    </div>
  );
};
