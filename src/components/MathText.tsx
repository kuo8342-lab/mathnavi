import React, { useMemo } from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
  as?: 'div' | 'span' | 'p';
}

export const MathText: React.FC<MathTextProps> = ({
  text,
  className = '',
  as: Component = 'span',
}) => {
  const segments = useMemo(() => {
    const raw = String(text || '').slice(0, 14000);
    const rx = /\$\$([\s\S]*?)\$\$|\$([^$]*?)\$|\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g;
    const out: Array<{ type: 'text' | 'math'; value: string; display?: boolean }> = [];
    let pos = 0;
    let m: RegExpExecArray | null;

    while ((m = rx.exec(raw)) !== null) {
      if (m.index > pos) {
        out.push({ type: 'text', value: raw.slice(pos, m.index) });
      }
      const latex = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
      const display = m[1] !== undefined || m[4] !== undefined;
      out.push({ type: 'math', value: latex, display });
      pos = rx.lastIndex;
    }

    if (pos < raw.length) {
      out.push({ type: 'text', value: raw.slice(pos) });
    }
    return out;
  }, [text]);

  return (
    <Component className={`whitespace-pre-wrap break-words ${className}`}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return <React.Fragment key={idx}>{seg.value}</React.Fragment>;
        }
        try {
          const html = katex.renderToString(seg.value, {
            displayMode: Boolean(seg.display),
            throwOnError: false,
            trust: false,
            strict: 'ignore',
          });
          return (
            <span
              key={idx}
              className="inline-block max-w-full overflow-x-auto align-middle px-0.5"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return (
            <code key={idx} className="text-rose-600 font-mono text-sm">
              {seg.value}
            </code>
          );
        }
      })}
    </Component>
  );
};
