import React from 'react';

/** 任何畫面在渲染時出錯都會讓 React 卸載整個 App 變成一片空白；這裡接住錯誤，改顯示可恢復的提示 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('MathNavi 畫面錯誤：', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F8FAFC] text-[#0F172A]">
        <div className="max-w-sm w-full rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-4">
          <h1 className="text-lg font-bold">畫面發生錯誤</h1>
          <p className="text-sm text-slate-600">
            你的錯題本和學習紀錄都還在。請重新整理頁面；如果一直出現，換一題再試試看。
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2.5 rounded-xl bg-[#0284C7] text-white text-sm font-semibold"
          >
            重新整理
          </button>
        </div>
      </div>
    );
  }
}
