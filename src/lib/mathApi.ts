import { getAuthHeaders } from './firebase';

export async function callMathApi<T>(action: string, payload: Record<string, unknown>): Promise<T> {
  // 網站放在 GitHub Pages 時沒有伺服器，AI 請求改打 NEXT_PUBLIC_API_BASE（Vercel 上的網址）
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE || ''}/api/math`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
    body: JSON.stringify({ action, payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) {
    throw new Error(data?.error || 'AI 服務目前無法使用');
  }
  return data.result as T;
}
