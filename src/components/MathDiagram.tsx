import React, { useEffect, useRef, useState } from 'react';
import { Play, Square } from 'lucide-react';
import { DrawingSpec } from '../types/math';
import { cleanDrawing, evaluator } from '../lib/mathCore';

interface MathDiagramProps {
  drawing: DrawingSpec | null | undefined;
  dark?: boolean;
}

export const MathDiagram: React.FC<MathDiagramProps> = ({ drawing, dark = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const [animating, setAnimating] = useState(false);

  const spec = cleanDrawing(drawing);

  const renderCanvas = (movingPoint?: { x: number; y: number } | null) => {
    const canvas = canvasRef.current;
    if (!canvas || !spec) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const ink = dark ? '#CBD5E1' : '#334155';
    const line = dark ? '#1E293B' : '#E2E8F0';
    const blue = dark ? '#38BDF8' : '#0284C7';
    const green = dark ? '#34D399' : '#059669';

    ctx.clearRect(0, 0, w, h);
    ctx.font = '12px "Plus Jakarta Sans", "Noto Sans TC", sans-serif';
    ctx.textBaseline = 'middle';

    if (spec.type === 'shortdiv') {
      const rows = spec.rows;
      const x = 110;
      const y = 38;
      const rh = Math.min(34, (h - 70) / (rows.length + 1));
      ctx.font = '600 15px "JetBrains Mono", monospace';
      ctx.fillStyle = ink;

      rows.forEach((r, i) => {
        const yy = y + i * rh;
        ctx.textAlign = 'right';
        ctx.fillStyle = blue;
        ctx.fillText(String(r.d), x - 16, yy);
        ctx.fillStyle = ink;
        ctx.textAlign = 'center';
        ctx.fillText(String(r.a), x + 65, yy);
        ctx.fillText(String(r.b), x + 155, yy);
        ctx.strokeStyle = dark ? '#475569' : '#94A3B8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, yy - rh / 2);
        ctx.lineTo(x, yy + rh / 2);
        ctx.lineTo(x + 210, yy + rh / 2);
        ctx.stroke();
      });

      ctx.textAlign = 'center';
      ctx.fillStyle = green;
      ctx.fillText(String(spec.last[0]), x + 65, y + rows.length * rh);
      ctx.fillText(String(spec.last[1]), x + 155, y + rows.length * rh);

      if (!rows.length) {
        ctx.font = '13px "Noto Sans TC", sans-serif';
        ctx.fillStyle = ink;
        ctx.fillText('兩數互質，不需短除；最大公因數 = 1', w / 2, h - 42);
      }
      return;
    }

    let xmin: number;
    let xmax: number;
    let ymin: number;
    let ymax: number;
    let fn: ((x: number) => number) | undefined;
    const pts = spec.type === 'points' ? spec.points : [];

    if (spec.type === 'points') {
      xmin = Math.min(0, ...pts.map((p) => p.x)) - 2;
      xmax = Math.max(0, ...pts.map((p) => p.x)) + 2;
      ymin = Math.min(0, ...pts.map((p) => p.y)) - 2;
      ymax = Math.max(0, ...pts.map((p) => p.y)) + 2;
    } else {
      fn = evaluator(spec.expr);
      xmin = Math.min(spec.xmin, 0);
      xmax = Math.max(spec.xmax, 0);
      const ys: number[] = [];
      for (let i = 0; i <= 120; i++) {
        const y = fn(xmin + ((xmax - xmin) * i) / 120);
        if (Number.isFinite(y) && Math.abs(y) < 1e8) ys.push(y);
      }
      const minY = Math.min(0, ...ys);
      const maxY = Math.max(0, ...ys);
      ymin = Math.max(minY - 1, -(xmax - xmin) * 1.4);
      ymax = Math.min(maxY + 1, (xmax - xmin) * 1.4);
      if (ymax - ymin < 2) {
        ymin -= 1;
        ymax += 1;
      }
    }

    const pad = 36;
    const scale = Math.min((w - 2 * pad) / (xmax - xmin), (h - 2 * pad) / (ymax - ymin));
    const cx = (xmin + xmax) / 2;
    const cy = (ymin + ymax) / 2;
    const px = (x: number) => w / 2 + (x - cx) * scale;
    const py = (y: number) => h / 2 - (y - cy) * scale;
    const minX = cx - (w / 2 - pad) / scale;
    const maxX = cx + (w / 2 - pad) / scale;
    const minY = cy - (h / 2 - pad) / scale;
    const maxY = cy + (h / 2 - pad) / scale;

    const step = ((range: number) => {
      const base = Math.pow(10, Math.floor(Math.log10(range / 9)));
      const ratio = range / 9 / base;
      return base * (ratio > 5 ? 10 : ratio > 2 ? 5 : ratio > 1 ? 2 : 1);
    })(Math.max(maxX - minX, maxY - minY));

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad - 4, pad - 4, w - 2 * pad + 8, h - 2 * pad + 8);
    ctx.clip();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = line;
    for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
      ctx.beginPath();
      ctx.moveTo(px(x), py(minY));
      ctx.lineTo(px(x), py(maxY));
      ctx.stroke();
    }
    for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
      ctx.beginPath();
      ctx.moveTo(px(minX), py(y));
      ctx.lineTo(px(maxX), py(y));
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pad, py(0));
    ctx.lineTo(w - pad + 7, py(0));
    ctx.moveTo(px(0), h - pad);
    ctx.lineTo(px(0), pad - 7);
    ctx.stroke();

    const drawArrow = (x: number, y: number, angle: number, color: string) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-7, -3.5);
      ctx.lineTo(-7, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    drawArrow(w - pad + 7, py(0), 0, ink);
    drawArrow(px(0), pad - 7, -Math.PI / 2, ink);
    ctx.textAlign = 'left';
    ctx.fillText('x', w - pad + 10, py(0));
    ctx.fillText('y', px(0) + 10, pad - 7);
    ctx.fillText('O', px(0) + 5, py(0) + 12);

    ctx.font = '10px "JetBrains Mono", monospace';
    for (let x = Math.ceil(minX / step) * step; x <= maxX; x += step) {
      if (Math.abs(x) > step * 0.01) {
        ctx.textAlign = 'center';
        ctx.fillText(String(Number(x.toPrecision(4))), px(x), Math.min(h - 12, py(0) + 15));
      }
    }
    for (let y = Math.ceil(minY / step) * step; y <= maxY; y += step) {
      if (Math.abs(y) > step * 0.01) {
        ctx.textAlign = 'right';
        ctx.fillText(String(Number(y.toPrecision(4))), Math.max(28, px(0) - 6), py(y));
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(pad, pad, w - 2 * pad, h - 2 * pad);
    ctx.clip();
    ctx.strokeStyle = blue;
    ctx.lineWidth = 2.4;

    if (fn) {
      ctx.beginPath();
      let prev = false;
      for (let i = 0; i <= 500; i++) {
        const x = minX + ((maxX - minX) * i) / 500;
        const y = fn(x);
        if (!Number.isFinite(y) || Math.abs(y) > 1e8) {
          prev = false;
          continue;
        }
        if (!prev) {
          ctx.moveTo(px(x), py(y));
          prev = true;
        } else {
          ctx.lineTo(px(x), py(y));
        }
      }
      ctx.stroke();
    } else if (spec.type === 'points') {
      if (spec.connect && pts.length > 1) {
        pts.slice(1).forEach((p, i) => {
          const prev = pts[i];
          ctx.beginPath();
          ctx.moveTo(px(prev.x), py(prev.y));
          ctx.lineTo(px(p.x), py(p.y));
          ctx.stroke();
          const angle = Math.atan2(py(p.y) - py(prev.y), px(p.x) - px(prev.x));
          if (p.x !== prev.x || p.y !== prev.y) {
            drawArrow(
              px(p.x) - Math.cos(angle) * 7,
              py(p.y) - Math.sin(angle) * 7,
              angle,
              blue
            );
          }
        });
      }
      pts.forEach((p, i) => {
        ctx.fillStyle = i === pts.length - 1 ? green : blue;
        ctx.beginPath();
        ctx.arc(px(p.x), py(p.y), 5, 0, Math.PI * 2);
        ctx.fill();
      });
      if (movingPoint) {
        ctx.fillStyle = '#D97706';
        ctx.beginPath();
        ctx.arc(px(movingPoint.x), py(movingPoint.y), 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    if (spec.type === 'points') {
      ctx.font = '600 11px "Plus Jakarta Sans", "Noto Sans TC", sans-serif';
      ctx.fillStyle = ink;
      pts.forEach((p, i) => {
        ctx.textAlign = p.x > cx ? 'right' : 'left';
        ctx.fillText(
          `${p.label || 'P' + i} (${p.x}, ${p.y})`,
          px(p.x) + (p.x > cx ? -9 : 9),
          Math.max(14, py(p.y) - 11 - (i % 2) * 13)
        );
      });
    }
  };

  useEffect(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    setAnimating(false);
    renderCanvas(null);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [drawing, dark]);

  const toggleAnimation = () => {
    if (!spec || spec.type !== 'points' || spec.points.length < 2) return;
    if (animating) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      setAnimating(false);
      renderCanvas(null);
      return;
    }

    setAnimating(true);
    const start = performance.now();
    const pts = spec.points;
    const duration = 1100;

    const tick = (now: number) => {
      const t = (now - start) / duration;
      const index = Math.min(pts.length - 2, Math.floor(t));
      const p = Math.min(1, t - index);
      const a = pts[index];
      const b = pts[index + 1];
      renderCanvas({
        x: a.x + (b.x - a.x) * p,
        y: a.y + (b.y - a.y) * p,
      });
      if (t < pts.length - 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        animRef.current = null;
        setAnimating(false);
        renderCanvas(null);
      }
    };

    animRef.current = requestAnimationFrame(tick);
  };

  if (!spec) return null;

  return (
    <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
          互動數學視覺圖解
        </span>
        {spec.type === 'points' && spec.points.length >= 2 && (
          <button
            type="button"
            onClick={toggleAnimation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:border-sky-500 transition-colors whitespace-nowrap"
          >
            {animating ? (
              <>
                <Square className="w-3.5 h-3.5 text-amber-600" />
                停止移動動畫
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-sky-600" />
                播放點的移動
              </>
            )}
          </button>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 p-3 flex flex-col items-center">
        <canvas
          ref={canvasRef}
          width={480}
          height={290}
          className="w-full max-w-[480px] h-auto rounded-lg"
          aria-label="題目的數學示意圖"
        />
        {spec.caption && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">
            {spec.caption}
          </p>
        )}
      </div>
    </div>
  );
};
