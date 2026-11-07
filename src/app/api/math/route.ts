import { isMathAction, runMathAction } from '../../../../server/mathHandler';
import { bucketFor, checkAndCountUsage } from '../../../../server/usageGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Hobby 方案（fluid compute）允許的上限是 300 秒；模型忙碌時解一題可能超過 60 秒
export const maxDuration = 300;

// 允許從哪些網站跨網域呼叫（GitHub Pages 版的前端在別的網域）。可用 ALLOWED_ORIGINS 覆寫，逗號隔開
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://kuo8342-lab.github.io')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (req: Request, status: number, body: unknown) =>
  Response.json(body, { status, headers: corsHeaders(req) });

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  let parsed: { action?: unknown; payload?: unknown } = {};
  try {
    parsed = await req.json();
  } catch {
    // 空的或壞掉的 body：交給下面的動作檢查回 400
  }
  const { action, payload } = parsed || {};

  if (!isMathAction(action)) {
    return json(req, 400, { ok: false, error: `未知的動作：${String(action)}` });
  }

  const forwarded = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const guard = await checkAndCountUsage(req.headers.get('authorization') || undefined, forwarded, bucketFor(action));
  if (guard.ok === false) {
    return json(req, guard.status, { ok: false, error: guard.error });
  }

  const { status, body } = await runMathAction(action, payload);
  return json(req, status, body);
}
