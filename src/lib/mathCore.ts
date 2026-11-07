import {
  AIExplanationData,
  DrawingSpec,
  LiteratureItem,
  MathProblemData,
  PracticeItem,
  SavedMistakeItem,
  TemplateKind,
  VideoResource,
} from '../types/math';

export const ERRORS = [
  '計算錯誤',
  '公式／定理使用錯誤',
  '觀念不清',
  '符號／正負號錯誤',
  '題意理解錯誤',
  '步驟遺漏',
  '其他',
] as const;

export const CONCEPTS: Record<TemplateKind, string> = {
  coord: '直角座標系與點的平移',
  quad: '一元二次方程式',
  gcd: '最大公因數與最小公倍數',
};

export interface TemplateFieldDef {
  id: string;
  label: string;
  defaultValue: number | string;
}

export const TEMPLATES: Record<
  TemplateKind,
  { name: string; fields: TemplateFieldDef[] }
> = {
  coord: {
    name: '座標平移',
    fields: [
      { id: 'x0', label: '起點 x', defaultValue: -1 },
      { id: 'y0', label: '起點 y', defaultValue: 2 },
      { id: 'd1', label: '第一次方向', defaultValue: '下' },
      { id: 'n1', label: '第一次單位數', defaultValue: 1 },
      { id: 'd2', label: '第二次方向', defaultValue: '右' },
      { id: 'n2', label: '第二次單位數', defaultValue: 5 },
    ],
  },
  quad: {
    name: '一元二次方程式',
    fields: [
      { id: 'a', label: 'a：二次項係數', defaultValue: 1 },
      { id: 'b', label: 'b：一次項係數', defaultValue: 1 },
      { id: 'c', label: 'c：常數項', defaultValue: -6 },
    ],
  },
  gcd: {
    name: '最大公因數／最小公倍數',
    fields: [
      { id: 'a', label: '第一個正整數', defaultValue: 24 },
      { id: 'b', label: '第二個正整數', defaultValue: 36 },
    ],
  },
};

const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

export const uid = () =>
  Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);

function primeFactors(n: number): number[] {
  const f: number[] = [];
  for (let p = 2; p * p <= n; p++) {
    while (n % p === 0) {
      f.push(p);
      n /= p;
    }
  }
  if (n > 1) f.push(n);
  return f;
}

export function polyStr(a: number, b: number, c: number): string {
  const parts: string[] = [];
  const add = (coef: number, v: string) => {
    if (coef === 0) return;
    const abs = Math.abs(coef);
    const body = v && abs === 1 ? v : abs + v;
    parts.push((coef < 0 ? '-' : parts.length ? '+' : '') + body);
  };
  add(a, 'x^2');
  add(b, 'x');
  add(c, '');
  return parts.length ? parts.join('') : '0';
}

const fac = (r: number) => (r > 0 ? `(x-${r})` : r < 0 ? `(x+${-r})` : 'x');

function frac(n: number, d: number): string {
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  if (d === 1) return String(n);
  return n < 0 ? `-\\frac{${-n}}{${d}}` : `\\frac{${n}}{${d}}`;
}

function rootsText(r1: number, r2: number): string {
  if (r1 === r2) return `$x=${r1}$（重根）`;
  const lo = Math.min(r1, r2);
  const hi = Math.max(r1, r2);
  return `$x=${lo}$ 或 $x=${hi}$`;
}

export function roots(a: number, b: number, c: number): number[] {
  const D = b * b - 4 * a * c;
  if (D < 0) return [];
  if (D === 0) return [-b / (2 * a) || 0];
  return [(-b - Math.sqrt(D)) / (2 * a), (-b + Math.sqrt(D)) / (2 * a)]
    .map((x) => (x === 0 ? 0 : x))
    .sort((x, y) => x - y);
}

/* ===================== 座標平移 ===================== */
const DIRS: Record<string, [number, number]> = {
  右: [1, 0],
  左: [-1, 0],
  上: [0, 1],
  下: [0, -1],
};

export function buildCoord(
  x0: number,
  y0: number,
  moves: Array<{ dir: string; n: number }>
) {
  let x = x0;
  let y = y0;
  const pts = [{ x, y, label: '起點' }];
  const steps = [`出發點座標是 $(${x0}, ${y0})$。`];
  const used = moves.filter((m) => m.n > 0 && DIRS[m.dir]);

  used.forEach((m, i) => {
    const [ux, uy] = DIRS[m.dir];
    const nx = x + ux * m.n;
    const ny = y + uy * m.n;
    if (ux !== 0) {
      steps.push(
        `第 ${i + 1} 次：向${m.dir}移動 ${m.n} 單位。左右移動只改變 $x$ 座標（${
          ux > 0 ? '向右變大用加的' : '向左變小用減的'
        }）：$x=${x}${ux > 0 ? '+' : '-'}${m.n}=${nx}$，$y$ 座標維持 $${y}$。`
      );
    } else {
      steps.push(
        `第 ${i + 1} 次：向${m.dir}移動 ${m.n} 單位。上下移動只改變 $y$ 座標（${
          uy > 0 ? '向上變大用加的' : '向下變小用減的'
        }）：$y=${y}${uy > 0 ? '+' : '-'}${m.n}=${ny}$，$x$ 座標維持 $${x}$。`
      );
    }
    x = nx;
    y = ny;
    pts.push({ x, y, label: i === used.length - 1 ? '終點' : `第${i + 1}步` });
  });

  if (!used.length) steps.push('沒有任何移動，終點座標維持原處。');
  steps.push(`因此終點座標為 $(${x}, ${y})$。`);
  return { x, y, steps, pts };
}

export function generateCoordPractice(): {
  sameType: PracticeItem;
  extension: PracticeItem;
} {
  const x0 = rnd(-5, 5);
  const y0 = rnd(-5, 5);
  const d1 = pick(['右', '左']);
  const d2 = pick(['上', '下']);
  const n1 = rnd(1, 6);
  const n2 = rnd(1, 6);
  const r = buildCoord(x0, y0, [
    { dir: d1, n: n1 },
    { dir: d2, n: n2 },
  ]);

  const sameType: PracticeItem = {
    q: `從點 $(${x0}, ${y0})$ 出發，先向${d1}移動 ${n1} 單位，再向${d2}移動 ${n2} 單位，請問終點座標是多少？`,
    a: `$(${r.x}, ${r.y})$`,
    steps: r.steps,
    concepts: ['直角座標系與點的平移'],
    source: 'local',
  };

  const tr = pick([
    [3, 4, 5],
    [5, 12, 13],
    [6, 8, 10],
  ]);
  const px = rnd(-4, 4);
  const py = rnd(-4, 4);
  const qx = px + tr[0];
  const qy = py + tr[1];

  const extension: PracticeItem = {
    q: `點 $P(${px}, ${py})$ 先向右移動 ${tr[0]} 單位，再向上移動 ${tr[1]} 單位到達點 $Q$。請問：(1) 點 $Q$ 的座標是多少？ (2) $P$、$Q$ 兩點之間的直線距離是多少？`,
    a: `(1) $Q(${qx}, ${qy})$；(2) 直線距離為 $${tr[2]}$`,
    steps: [
      `先算平移後的座標：$x = ${px} + ${tr[0]} = ${qx}$，$y = ${py} + ${tr[1]} = ${qy}$，所以 $Q(${qx}, ${qy})$。`,
      `水平位移為 $${tr[0]}$ 單位，垂直位移為 $${tr[1]}$ 單位，兩者互相垂直形成直角三角形。`,
      `利用畢氏定理：$\\overline{PQ} = \\sqrt{${tr[0]}^2 + ${tr[1]}^2} = \\sqrt{${
        tr[0] * tr[0] + tr[1] * tr[1]
      }} = ${tr[2]}$。`,
    ],
    concepts: ['直角座標系與點的平移', '畢氏定理與兩點距離'],
    source: 'local',
  };

  return { sameType, extension };
}

/* ===================== 一元二次方程式 ===================== */
export function solveQuad(a: number, b: number, c: number) {
  const D = b * b - 4 * a * c;
  const steps = [
    `整理成標準式：$${polyStr(a, b, c)}=0$，其中係數 $a=${a}$、$b=${b}$、$c=${c}$。`,
  ];
  const s = Math.round(Math.sqrt(Math.max(0, D)));
  const perfect = D >= 0 && s * s === D;
  let answer = '';
  const vertex = -b / (2 * a);

  if (a === 1 && perfect) {
    const r1 = (-b - s) / 2;
    const r2 = (-b + s) / 2;
    steps.push(
      `使用十字交乘／因式分解：找兩個數相乘等於常數項 $c=${c}$、相加等於一次項係數 $b=${b}$，這兩個數是 $${-r1}$ 與 $${-r2}$。`
    );
    steps.push(`原式分解為 $${polyStr(1, b, c)} = ${fac(r1)}${fac(r2)} = 0$。`);
    steps.push(`令各因式為 0，解得 ${rootsText(r1, r2)}。`);
    answer = rootsText(r1, r2);
  } else {
    steps.push(
      `計算判別式 $D = b^2 - 4ac = (${b})^2 - 4 \\times (${a}) \\times (${c}) = ${D}$。`
    );
    if (D < 0) {
      steps.push('因為 $D < 0$，實數平方不可能為負，此方程式沒有實數解。');
      answer = '沒有實數解';
    } else if (D === 0) {
      const r = frac(-b, 2 * a);
      steps.push(`因為 $D = 0$，方程式有重根：$x = \\frac{-b}{2a} = ${r}$。`);
      answer = `$x=${r}$（重根）`;
    } else if (perfect) {
      const r1 = frac(-b - s, 2 * a);
      const r2 = frac(-b + s, 2 * a);
      steps.push(
        `$D = ${D} > 0$ 且 $\\sqrt{${D}} = ${s}$，代入公式 $x = \\frac{-b \\pm \\sqrt{D}}{2a} = \\frac{${-b} \\pm ${s}}{${
          2 * a
        }}$。`
      );
      const v1 = (-b - s) / (2 * a);
      const v2 = (-b + s) / (2 * a);
      const lo = v1 < v2 ? r1 : r2;
      const hi = v1 < v2 ? r2 : r1;
      steps.push(`化簡後得到兩根：$x=${lo}$ 或 $x=${hi}$。`);
      answer = `$x=${lo}$ 或 $x=${hi}$`;
    } else {
      steps.push(
        `$D = ${D} > 0$，代入公式解得 $x = \\frac{${-b} \\pm \\sqrt{${D}}}{${2 * a}}$。`
      );
      answer = `$x=\\frac{${-b}\\pm\\sqrt{${D}}}{${2 * a}}$`;
    }
  }
  return { steps, answer, vertex, D };
}

export function generateQuadPractice(): {
  sameType: PracticeItem;
  extension: PracticeItem;
} {
  let r1 = rnd(-6, 6);
  let r2 = rnd(-6, 6);
  if (r1 === 0 && r2 === 0) r2 = 4;
  const b = -(r1 + r2);
  const c = r1 * r2;
  const solved = solveQuad(1, b, c);

  const sameType: PracticeItem = {
    q: `解一元二次方程式 $${polyStr(1, b, c)}=0$。`,
    a: rootsText(r1, r2),
    steps: solved.steps,
    concepts: ['一元二次方程式'],
    source: 'local',
  };

  const w = rnd(3, 9);
  const diff = rnd(2, 5);
  const area = w * (w + diff);
  const extension: PracticeItem = {
    q: `有一塊長方形花圃，已知長比寬多 ${diff} 公尺，且面積為 ${area} 平方公尺。若設寬為 $x$ 公尺，請列出一元二次方程式並求出花圃的寬與長。`,
    a: `寬為 $${w}$ 公尺，長為 $${w + diff}$ 公尺`,
    steps: [
      `設寬為 $x$ 公尺，則長為 $(x+${diff})$ 公尺。`,
      `由長方形面積＝長 $\\times$ 寬，列式：$x(x+${diff}) = ${area}$。`,
      `展開並移項整理成標準式：$x^2 + ${diff}x - ${area} = 0$。`,
      `因式分解得 $(x-${w})(x+${w + diff}) = 0$，解得 $x=${w}$ 或 $x=-${w + diff}$（邊長不為負，故負不合）。`,
      `因此寬為 $${w}$ 公尺，長為 $${w}+${diff}=${w + diff}$ 公尺。`,
    ],
    concepts: ['一元二次方程式', '幾何面積應用問題'],
    source: 'local',
  };

  return { sameType, extension };
}

/* ===================== 最大公因數與最小公倍數 ===================== */
function shortDiv(a: number, b: number) {
  const rows: Array<{ d: number; a: number; b: number }> = [];
  let x = a;
  let y = b;
  for (;;) {
    const g = gcd(x, y);
    if (g === 1) break;
    const p = primeFactors(g)[0];
    rows.push({ d: p, a: x, b: y });
    x /= p;
    y /= p;
  }
  return { rows, last: [x, y] as [number, number] };
}

export function buildGcd(a: number, b: number) {
  const sd = shortDiv(a, b);
  const ds = sd.rows.map((r) => r.d);
  const G = ds.reduce((p, d) => p * d, 1);
  const L = G * sd.last[0] * sd.last[1];
  const steps = [
    `將兩數 $${a}$ 與 $${b}$ 並排，找出共同的質因數（如 2、3、5…）進行短除法。`,
  ];
  sd.rows.forEach((r) =>
    steps.push(
      `用共同質因數 $${r.d}$ 去除：$${r.a} \\div ${r.d} = ${r.a / r.d}$，$${r.b} \\div ${
        r.d
      } = ${r.b / r.d}$。`
    )
  );
  steps.push(
    sd.rows.length
      ? `除到最下方的 $${sd.last[0]}$ 與 $${sd.last[1]}$ 互質（沒有大於 1 的公因數）為止。`
      : `$${a}$ 與 $${b}$ 本身已經互質。`
  );
  steps.push(
    `最大公因數 $\\gcd(${a}, ${b})$ ＝ 左側所有除數相乘：${
      ds.length ? `$${ds.join(' \\times ')} = ${G}$` : '$1$'
    }。`
  );
  steps.push(
    `最小公倍數 $\\text{lcm}(${a}, ${b})$ ＝ 左側除數再乘最下方兩數：$${ds
      .concat(sd.last)
      .join(' \\times ')} = ${L}$。`
  );
  return { rows: sd.rows, last: sd.last, G, L, steps };
}

export function generateGcdPractice(): {
  sameType: PracticeItem;
  extension: PracticeItem;
} {
  const g = rnd(3, 9);
  let m = rnd(2, 7);
  let n = rnd(2, 7);
  while (gcd(m, n) !== 1 || m === n) {
    m = rnd(2, 8);
    n = rnd(2, 8);
  }
  const a = g * m;
  const b = g * n;
  const built = buildGcd(a, b);

  const sameType: PracticeItem = {
    q: `求 $${a}$ 與 $${b}$ 的最大公因數與最小公倍數。`,
    a: `最大公因數為 $${built.G}$，最小公倍數為 $${built.L}$`,
    steps: built.steps,
    concepts: ['最大公因數與最小公倍數'],
    source: 'local',
  };

  const extension: PracticeItem = {
    q: `有一張長 $${a}$ 公分、寬 $${b}$ 公分的長方形木板，想裁切成大小相同且邊長為最大整數公分的正方形木塊（不剩下廢料）。請問：(1) 正方形木塊的最大邊長是多少公分？ (2) 共可裁切成幾塊？`,
    a: `(1) 最大邊長 $${built.G}$ 公分；(2) 共 $${(a / built.G) * (b / built.G)}$ 塊`,
    steps: [
      `要將長 $${a}$、寬 $${b}$ 剛好整除且邊長最大，代表正方形邊長是兩數的最大公因數。`,
      `由短除法求得 $\\gcd(${a}, ${b}) = ${built.G}$（公分）。`,
      `長邊可切 $${a} \\div ${built.G} = ${a / built.G}$ 塊，寬邊可切 $${b} \\div ${
        built.G
      } = ${b / built.G}$ 塊。`,
      `總塊數為 $${a / built.G} \\times ${b / built.G} = ${
        (a / built.G) * (b / built.G)
      }$ 塊。`,
    ],
    concepts: ['最大公因數與最小公倍數', '幾何分割應用題'],
    source: 'local',
  };

  return { sameType, extension };
}

/* ===================== 知識點：影片與文獻產生器 ===================== */
function getKnowledgeResources(kind: TemplateKind, concept: string): {
  videos: VideoResource[];
  literature: LiteratureItem[];
} {
  if (kind === 'coord') {
    return {
      videos: [
        {
          title: '直角座標平面：點的座標與象限基礎',
          platform: '均一教育平台',
          durationHint: '約 6 分鐘',
          summary: '從數線延伸到平面座標 $(x, y)$，透過動畫理解水平與鉛直移動如何改變座標。',
          url: 'https://www.junyiacademy.org/search?q=%E7%9B%B4%E8%A7%92%E5%BA%A7%E6%A8%99%E5%B9%B3%E9%9D%A2%E5%B9%B3%E7%A7%BB',
          searchQuery: '直角座標平面 點的平移',
        },
        {
          title: '國中數學七年級：座標平面上點的平移觀念解析',
          platform: 'YouTube 教學精選',
          durationHint: '約 8 分鐘',
          summary: '記住口訣「右加左減看 x、上加下減看 y」，搭配常見考題實戰演練。',
          url: 'https://www.youtube.com/results?search_query=%E5%9C%8B%E4%B8%AD%E6%95%B8%E5%AD%B8+%E5%BA%A7%E6%A8%99%E5%B9%B3%E7%A7%BB',
          searchQuery: '國中數學 座標平移',
        },
        {
          title: 'Coordinate Plane & Translations Interactive Lesson',
          platform: 'Khan Academy',
          durationHint: '約 5 分鐘',
          summary: '互動式視覺化練習，觀察點在四個象限之間移動時的座標變化。',
          url: 'https://www.khanacademy.org/search?page_search_query=coordinate%20plane%20translation',
          searchQuery: 'coordinate plane translation',
        },
      ],
      literature: [
        {
          title: '點的平移核心口訣與座標獨立性',
          category: '核心定義與公式',
          content:
            '在直角座標平面上，任意點 $P(x, y)$ 的移動可拆解為水平方向與鉛直方向：\n• 向右移動 $a$ 單位 $\\Rightarrow (x + a, y)$\n• 向左移動 $a$ 單位 $\\Rightarrow (x - a, y)$\n• 向上移動 $b$ 單位 $\\Rightarrow (x, y + b)$\n• 向下移動 $b$ 單位 $\\Rightarrow (x, y - b)$',
          commonMistake: '常見錯誤：把「向上／向下移動」加減在 $x$ 座標上，或忘記負數加減的性質（例如 $-1 - 2 = -3$ 誤算為 $+1$）。',
        },
        {
          title: '從「起點推終點」到「終點逆推起點」',
          category: '進階解題講義',
          content:
            '若題目反過來給終點 $(x_1, y_1)$ 求起點 $(x_0, y_0)$，只需將移動方向顛倒（原本向右加，逆推回起點就向左減），或直接設起點 $(x, y)$ 列出一元一次方程式求解。',
          commonMistake: '逆推題目時若直接照字面加減，會得到相反方向的點，建議畫簡單的十字座標草圖輔助確認。',
        },
      ],
    };
  }

  if (kind === 'quad') {
    return {
      videos: [
        {
          title: '因式分解法與十字交乘法解一元二次方程式',
          platform: '均一教育平台',
          durationHint: '約 9 分鐘',
          summary: '一步步示範如何將二次三項式拆成兩個一次因式相乘，利用 $A \\times B = 0$ 求出兩根。',
          url: 'https://www.junyiacademy.org/search?q=%E4%B8%80%E5%85%83%E4%BA%8C%E6%AC%A1%E6%96%B9%E7%A8%8B%E5%BC%8F',
          searchQuery: '一元二次方程式 因式分解 公式解',
        },
        {
          title: '一元二次方程式：配方法與公式解完整推導',
          platform: 'YouTube 教學精選',
          durationHint: '約 12 分鐘',
          summary: '詳解判別式 $D = b^2 - 4ac$ 的幾何意義，以及何時該選十字交乘、何時直接代公式解。',
          url: 'https://www.youtube.com/results?search_query=%E5%9C%8B%E4%B8%AD%E6%95%B8%E5%AD%B8+%E4%B8%80%E5%85%83%E4%BA%8C%E6%AC%A1%E6%96%B9%E7%A8%8B%E5%BC%8F+%E5%85%AC%E5%BC%8F%E8%A7%A3',
          searchQuery: '國中數學 一元二次方程式 公式解',
        },
        {
          title: '教育部因材網：八年級一元二次方程式學習路徑',
          platform: '教育部因材網',
          durationHint: '單元課程',
          summary: '結合診斷測驗與概念影片，釐清重根、無實數解與根與係數關係。',
          url: 'https://adl.edu.tw/',
          searchQuery: '一元二次方程式',
        },
      ],
      literature: [
        {
          title: '三大解法比較：因式分解、配方法、公式解',
          category: '核心定義與公式',
          content:
            '標準式 $ax^2 + bx + c = 0$ ($a \\neq 0$)：\n1. 因式分解法：當係數好拆解時最快，化為 $(px+q)(rx+s)=0$。\n2. 配方法：將二次項係數化為 1 後，兩邊同加 $(\\frac{b}{2a})^2$。\n3. 公式解：$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$，適用所有實係數二次方程式。',
          commonMistake: '由 $(x - 2)(x + 3) = 0$ 求根時，記得令括號為 0，所以根是 $x = 2$ 或 $x = -3$（正負號要變號）。',
        },
        {
          title: '判別式 $D = b^2 - 4ac$ 與函數圖形交點',
          category: '觀念統整文獻',
          content:
            '• 當 $D > 0$：有兩相異實根，拋物線 $y = ax^2+bx+c$ 與 $x$ 軸交於相異兩點。\n• 當 $D = 0$：有重根（兩相等實根），拋物線頂點剛好切於 $x$ 軸。\n• 當 $D < 0$：無實數解，拋物線完全在 $x$ 軸上方或下方，不相交。',
          commonMistake: '當 $b$ 為負數或 $c$ 為負數時，計算 $b^2 - 4ac$ 務必加括號，例如 $(-3)^2 - 4(1)(-6) = 9 + 24 = 33$。',
        },
      ],
    };
  }

  return {
    videos: [
      {
        title: '短除法求最大公因數（GCD）與最小公倍數（LCM）',
        platform: '均一教育平台',
        durationHint: '約 7 分鐘',
        summary: '圖解短除法的操作流程，清楚區分為什麼 GCD 只乘左邊、LCM 要連下面一起乘。',
        url: 'https://www.junyiacademy.org/search?q=%E6%9C%80%E5%A4%A7%E5%85%AC%E5%9B%A0%E6%95%B8%E8%88%87%E6%9C%80%E5%B0%8F%E5%85%AC%E5%80%8D%E6%95%B8',
        searchQuery: '最大公因數與最小公倍數 短除法',
      },
      {
        title: '國中數學：最大公因數與最小公倍數素養應用題型',
        platform: 'YouTube 教學精選',
        durationHint: '約 10 分鐘',
        summary: '整理「剪繩子、分裝水果（找因數）」與「公車班次同時發車、排正方形（找倍數）」的判斷技巧。',
        url: 'https://www.youtube.com/results?search_query=%E5%9C%8B%E4%B8%AD%E6%95%B8%E5%AD%B8+%E6%9C%80%E5%A4%A7%E5%85%AC%E5%9B%A0%E6%95%B8+%E6%9C%80%E5%B0%8F%E5%85%AC%E5%80%8D%E6%95%B8',
        searchQuery: '國中數學 最大公因數 最小公倍數',
      },
      {
        title: '標準分解式與公因數、公倍數的指數規則',
        platform: '國家教育研究院／教學資源',
        durationHint: '重點教學',
        summary: '當數字以質因數次方呈現時，如何快速比較次方大小求出 GCD 與 LCM。',
        url: 'https://www.naer.edu.tw/',
        searchQuery: concept,
      },
    ],
    literature: [
      {
        title: '短除法與標準分解式對照整理',
        category: '核心定義與公式',
        content:
          '1. 最大公因數 $\\gcd(a, b)$：兩數共有的最大正因數。在短除法中為「左側所有共同質因數的乘積」；在標準分解式中取「共同質因數的最小次方」。\n2. 最小公倍數 $\\text{lcm}(a, b)$：兩數共有的最小正倍數。在短除法中為「左側除數乘以最下方互質商數」（L 字形相乘）；在標準分解式中取「所有出現質因數的最大次方」。',
        commonMistake: '短除法一定要用「質數」或公因數除到最下面兩數「互質」為止，否則算出的最小公倍數會偏大。',
      },
      {
        title: '應用題情境判斷：何時用公因數？何時用公倍數？',
        category: '解題策略文獻',
        content:
          '• 看到「平分、切割、裁成小段、鋪磁磚不切割」$\\Rightarrow$ 每小單位要比原數小，屬於找「因數」（最大公因數）。\n• 看到「同時再次相遇、最小可排成大正方形、最少幾人分組都剛好」$\\Rightarrow$ 總數要比原數大，屬於找「倍數」（最小公倍數）。',
        commonMistake: '求出邊長（GCD）後，若題目問「共可切成幾塊正方形面積」，記得長邊塊數與寬邊塊數要用「相乘」而非相加！',
      },
    ],
  };
}

/* ===================== 建立完整題目資料 ===================== */
export function validateValues(
  kind: TemplateKind,
  v: Record<string, number | string>
): Record<string, any> {
  const t = TEMPLATES[kind];
  if (!t || !v || typeof v !== 'object') {
    throw new Error('不支援的題型或條件格式。');
  }
  const out: Record<string, any> = {};
  for (const field of t.fields) {
    const val = v[field.id];
    if (field.id.startsWith('d')) {
      const s = String(val);
      if (!DIRS[s]) throw new Error(`${field.label}不正確。`);
      out[field.id] = s;
    } else {
      const n = Number(val);
      if (!Number.isInteger(n)) throw new Error(`${field.label}請填整數。`);
      out[field.id] = n;
    }
  }
  if (
    kind === 'coord' &&
    (Math.abs(out.x0) > 50 ||
      Math.abs(out.y0) > 50 ||
      out.n1 < 0 ||
      out.n2 < 0 ||
      out.n1 > 50 ||
      out.n2 > 50)
  ) {
    throw new Error('座標絕對值與移動單位數須在 50 以內，單位數不可為負。');
  }
  if (
    kind === 'quad' &&
    (!out.a || Math.abs(out.a) > 50 || Math.abs(out.b) > 50 || Math.abs(out.c) > 200)
  ) {
    throw new Error('a 不可為 0；a、b 的絕對值至多 50，c 至多 200。');
  }
  if (kind === 'gcd' && (out.a < 1 || out.b < 1 || out.a > 9999 || out.b > 9999)) {
    throw new Error('請填 1 到 9999 之間的正整數。');
  }
  return out;
}

export function makeData(
  kind: TemplateKind,
  rawValues: Record<string, number | string>
): MathProblemData {
  const v = validateValues(kind, rawValues);
  const { videos, literature } = getKnowledgeResources(kind, CONCEPTS[kind]);

  if (kind === 'coord') {
    const r = buildCoord(v.x0, v.y0, [
      { dir: v.d1, n: v.n1 },
      { dir: v.d2, n: v.n2 },
    ]);
    const parts: string[] = [];
    if (v.n1 > 0) parts.push(`先向${v.d1}移動 ${v.n1} 單位`);
    if (v.n2 > 0) parts.push(`再向${v.d2}移動 ${v.n2} 單位`);
    const question = `從點 $(${v.x0}, ${v.y0})$ 出發，${
      parts.join('，') || '不移動'
    }，終點座標是多少？`;

    const explanation: AIExplanationData = {
      plainTranslation: `想像你在方格紙（座標平面）上走路：一開始你站在位置 $(${v.x0}, ${v.y0})$，接著照題目指示${
        parts.join('，然後') || '停在原地'
      }，題目想知道你最後停在哪一個座標位置。`,
      givenConditions: [
        `起點位置在 $(${v.x0}, ${v.y0})$，代表一開始水平位置 $x = ${v.x0}$、垂直位置 $y = ${v.y0}$。`,
        `第一步：向${v.d1}移動 ${v.n1} 單位。`,
        `第二步：向${v.d2}移動 ${v.n2} 單位。`,
      ],
      targetGoal: '求出移動結束後的「終點座標 $(x, y)$」。',
      keyTerms: [
        {
          term: '座標 $(x, y)$',
          meaning: '前面的數字 $x$ 控制左右位置，後面的數字 $y$ 控制上下位置。',
        },
        {
          term: '平移單位',
          meaning: '向右 $x$ 要加、向左 $x$ 要減；向上 $y$ 要加、向下 $y$ 要減。',
        },
      ],
      starterHint: `試著把 $x$ 和 $y$ 分開算！先看這兩步移動裡面，哪一步是左右移動（影響 $x=${v.x0}$），哪一步是上下移動（影響 $y=${v.y0}$）？`,
    };

    const { sameType, extension } = generateCoordPractice();

    return {
      question,
      concept: CONCEPTS.coord,
      kind: 'coord',
      source: 'local',
      explanation,
      shortAnswer: `終點座標是 $(${r.x}, ${r.y})$`,
      thinkTip: '向右 $x$ 變大、向左 $x$ 變小；向上 $y$ 變大、向下 $y$ 變小。將 $x$ 與 $y$ 分開計算最清楚。',
      steps: r.steps,
      methods: [
        { name: '逐步拆解法', steps: r.steps },
        {
          name: 'x、y 分量合成法',
          steps: [
            `起點為 $(${v.x0}, ${v.y0})$。`,
            `總水平位移 $\\Delta x = ${DIRS[v.d1][0] * v.n1} + (${DIRS[v.d2][0] * v.n2}) = ${
              r.x - v.x0
            }$，所以終點 $x = ${v.x0} + (${r.x - v.x0}) = ${r.x}$。`,
            `總垂直位移 $\\Delta y = ${DIRS[v.d1][1] * v.n1} + (${DIRS[v.d2][1] * v.n2}) = ${
              r.y - v.y0
            }$，所以終點 $y = ${v.y0} + (${r.y - v.y0}) = ${r.y}$。`,
            `合併得到終點座標 $(${r.x}, ${r.y})$。`,
          ],
        },
      ],
      principle:
        '在直角座標平面上，水平移動（右加左減）只會改變 $x$ 座標；鉛直移動（上加下減）只會改變 $y$ 座標。兩個方向的變化彼此獨立，可分別加減後再組合。',
      prequels: ['數線與正負數加減', '平面直角座標系與四個象限'],
      sequels: ['二元一次方程式的圖形平移', '兩點距離公式與向量概念'],
      videos,
      literature,
      sameType,
      extension,
      drawing: {
        type: 'points',
        points: r.pts,
        connect: true,
        caption: `從起點 (${v.x0}, ${v.y0}) 平移至終點 (${r.x}, ${r.y}) 的路徑圖`,
      },
    };
  }

  if (kind === 'quad') {
    const r = solveQuad(v.a, v.b, v.c);
    const D = v.b * v.b - 4 * v.a * v.c;
    const rs = roots(v.a, v.b, v.c);
    const question = `解方程式 $${polyStr(v.a, v.b, v.c)}=0$。`;

    const explanation: AIExplanationData = {
      plainTranslation: `題目給了一個含有 $x^2$（$x$ 的平方）的等式 $${polyStr(
        v.a,
        v.b,
        v.c
      )}=0$，要求我們找出「把哪個數字代進 $x$ 裡面，會讓左邊算出來剛好等於 $0$」。`,
      givenConditions: [
        `二次項係數 $a = ${v.a}$（$x^2$ 前面的數字）`,
        `一次項係數 $b = ${v.b}$（$x$ 前面的數字）`,
        `常數項 $c = ${v.c}$（不含 $x$ 的數字），且等號右邊已經整理為 $0$。`,
      ],
      targetGoal: '求出使等式成立的所有未知數 $x$ 的值（稱為方程式的「解」或「根」）。',
      keyTerms: [
        {
          term: '一元二次方程式',
          meaning: '只含一個未知數 $x$，且最高次方為 $2$ 次（$x^2$）的等式，通常會有兩個解、一個重根或無實數解。',
        },
        {
          term: '因式分解／公式解',
          meaning: '若能拆成兩個括號相乘 $=0$ 最快；若不好拆，可代入公式 $x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$。',
        },
      ],
      starterHint:
        v.a === 1
          ? `試著找兩個整數，讓它們「相乘等於 $${v.c}$」而且「相加等於 $${v.b}$」！如果找得到，就能直接拆成兩個括號相乘 $=0$ 喔！`
          : `先算出判別式 $D = b^2 - 4ac = (${v.b})^2 - 4 \\times (${v.a}) \\times (${v.c})$，看看它是正數、0 還是負數！`,
    };

    const formulaSteps = [
      `對照標準式 $ax^2+bx+c=0$，確認 $a=${v.a}$、$b=${v.b}$、$c=${v.c}$。`,
      `計算判別式 $D = b^2 - 4ac = (${v.b})^2 - 4 \\times (${v.a}) \\times (${v.c}) = ${D}$。`,
      D < 0
        ? '因為 $D < 0$，沒有實數解。'
        : `代入公式 $x = \\frac{-b \\pm \\sqrt{D}}{2a}$，整理可得 ${r.answer}。`,
    ];

    const half = frac(Math.abs(v.b), 2 * Math.abs(v.a));
    const shift = v.b === 0 ? 'x' : `x${v.b / v.a < 0 ? '-' : '+'}${half}`;
    const squareSteps = [
      `將等式各項同除以二次項係數 $a=${v.a}$。`,
      `移項並在等號兩邊同加 $(\\frac{b}{2a})^2$，配方整理成 $\\left(${shift}\\right)^2 = ${frac(
        D,
        4 * v.a * v.a
      )}$。`,
      D < 0
        ? '右方為負數，實數平方不為負，因此沒有實數解。'
        : `兩邊開平方根（記得加正負號 $\\pm$）並移項，得到 ${r.answer}。`,
    ];

    const methods = [
      { name: '公式解', steps: formulaSteps },
      { name: '配方法', steps: squareSteps },
    ];

    if (rs.length && rs.every(Number.isInteger)) {
      const factors =
        rs.length === 1 ? `${fac(rs[0])}^2` : `${fac(rs[0])}\\,${fac(rs[1])}`;
      methods.unshift({
        name: '因式分解法',
        steps: [
          `利用十字交乘法將左式分解為 $${v.a === 1 ? '' : v.a}${factors} = 0$。`,
          '因為兩因式相乘等於 0，代表至少其中一個因式為 0。',
          `分別令括號內等於 0，解得 ${r.answer}。`,
        ],
      });
    }

    const { sameType, extension } = generateQuadPractice();
    const xs = rs.concat([-v.b / (2 * v.a), 0]);

    return {
      question,
      concept: CONCEPTS.quad,
      kind: 'quad',
      source: 'local',
      explanation,
      shortAnswer: r.answer,
      thinkTip:
        methods[0].name === '因式分解法'
          ? '先觀察常數項能否拆成兩數相乘、且相加恰為一次項係數；分解後令括號為 0 即可。'
          : '先確認係數 $a, b, c$ 正負號，算出判別式 $D = b^2 - 4ac$ 再代入公式解。',
      steps: methods[0].steps,
      methods,
      principle:
        '解一元二次方程式的核心是「降次」：透過因式分解把二次式變成兩個一次式相乘 $=0$，或透過配方法與公式解化為完全平方式開根號。從圖形來看，方程式的實數根就是二次函數 $y=ax^2+bx+c$ 與 $x$ 軸的交點橫座標。',
      prequels: ['多項式的四則運算', '十字交乘法與因式分解', '平方根與根式化簡'],
      sequels: ['一元二次方程式的應用問題', '二次函數圖形與頂點極值'],
      videos,
      literature,
      sameType,
      extension,
      drawing: {
        type: 'function',
        expr: `(${v.a})*x^2+(${v.b})*x+(${v.c})`,
        xmin: Math.min(...xs) - 2,
        xmax: Math.max(...xs) + 2,
        caption: `二次函數 y = ${polyStr(v.a, v.b, v.c).replace(
          /\^2/g,
          '²'
        )} 圖形（與 x 軸交點即為方程式的實數解）`,
      },
    };
  }

  // gcd
  const r = buildGcd(v.a, v.b);
  const question = `求 $(${v.a}, ${v.b})$ 的最大公因數與最小公倍數。`;
  const explanation: AIExplanationData = {
    plainTranslation: `題目給你兩個正整數 $${v.a}$ 和 $${v.b}$，想要同時找出：\n1. 能同時整除 $${v.a}$ 和 $${v.b}$ 的最大整數（最大公因數）\n2. 同時是 $${v.a}$ 和 $${v.b}$ 的倍數中最小的正整數（最小公倍數）。`,
    givenConditions: [
      `第一個正整數為 $${v.a}$。`,
      `第二個正整數為 $${v.b}$。`,
    ],
    targetGoal: `求出 $${v.a}$ 與 $${v.b}$ 的「最大公因數 (GCD)」以及「最小公倍數 (LCM)」。`,
    keyTerms: [
      {
        term: '最大公因數',
        meaning: '能同時整除兩個數的因數當中，數值最大的那一個（短除法左邊除數相乘）。',
      },
      {
        term: '最小公倍數',
        meaning: '兩個數共同的正倍數當中，數值最小的那一個（短除法左邊除數與最下面商數全部相乘）。',
      },
    ],
    starterHint: `把 $${v.a}$ 和 $${v.b}$ 並排寫好，先想一個最小的質數（例如 2 或 3）可以同時整除它們，開始做短除法！`,
  };

  const { sameType, extension } = generateGcdPractice();

  return {
    question,
    concept: CONCEPTS.gcd,
    kind: 'gcd',
    source: 'local',
    explanation,
    shortAnswer: `最大公因數為 $${r.G}$，最小公倍數為 $${r.L}$`,
    thinkTip: '用共同的質因數持續短除，直到最下面兩個數互質為止；左邊直乘是最大公因數，L 形全乘是最小公倍數。',
    steps: r.steps,
    methods: [
      { name: '短除法', steps: r.steps },
      {
        name: '質因數分解法',
        steps: [
          `將 $${v.a}$ 質因數分解：$${v.a} = ${primeFactors(v.a).join(' \\times ') || '1'}$。`,
          `將 $${v.b}$ 質因數分解：$${v.b} = ${primeFactors(v.b).join(' \\times ') || '1'}$。`,
          `取兩數共同的質因數相乘，得最大公因數 $\\gcd(${v.a}, ${v.b}) = ${r.G}$。`,
          `利用兩數乘積關係 $\\text{lcm}(a, b) = \\frac{a \\times b}{\\gcd(a, b)} = \\frac{${v.a} \\times ${v.b}}{${r.G}} = ${r.L}$。`,
        ],
      },
    ],
    principle:
      '短除法左側的除數是兩數共同的質因數，全部相乘即為最大公因數（GCD）；將左側共同質因數再乘上最下方互質的兩個商數（呈 L 字形），即涵蓋兩數所有的質因數次方，得到最小公倍數（LCM）。此外恆有 $\\gcd(a,b) \\times \\text{lcm}(a,b) = a \\times b$。',
    prequels: ['質數與合數', '因數與倍數判別法', '質因數分解與標準分解式'],
    sequels: ['異分母分數的通分與約分', '公因數與公倍數素養情境應用題'],
    videos,
    literature,
    sameType,
    extension,
    drawing: {
      type: 'shortdiv',
      rows: r.rows,
      last: r.last,
      caption: '短除法示意圖：左側為共同質因數除數，底部為互質的商數',
    },
  };
}

export function randomValues(kind: TemplateKind): Record<string, number | string> {
  if (kind === 'coord') {
    return {
      x0: rnd(-5, 5),
      y0: rnd(-5, 5),
      d1: pick(Object.keys(DIRS)),
      n1: rnd(1, 6),
      d2: pick(Object.keys(DIRS)),
      n2: rnd(1, 6),
    };
  }
  if (kind === 'quad') {
    const r1 = rnd(-6, 6);
    const r2 = rnd(-6, 6);
    return { a: 1, b: -(r1 + r2), c: r1 * r2 };
  }
  const g = rnd(2, 9);
  return { a: g * rnd(2, 9), b: g * rnd(2, 9) };
}

export function kindOf(concept: string): TemplateKind | null {
  if (/座標|平移/.test(concept)) return 'coord';
  if (/二次/.test(concept)) return 'quad';
  if (/公因數|公倍數|短除/.test(concept)) return 'gcd';
  return null;
}

export function parseText(
  text: string
): { kind: TemplateKind; values: Record<string, any> } | null {
  if (typeof text !== 'string' || text.length > 500) return null;
  const s = text
    .replace(/[−–]/g, '-')
    .replace(/²/g, '^2')
    .replace(/[（）]/g, (x) => (x === '（' ? '(' : ')'))
    .replace(/\s|\$/g, '');

  const eq = s.replace(/^(?:請)?解(?:一元二次)?(?:方程式)?[：:]?/, '').replace(/[。?？]$/, '');
  if (/^[+\-\d*x^]+=-?\d+$/.test(eq)) {
    const [lhs, rhs] = eq.split('=');
    let a = 0;
    let b = 0;
    let c = -Number(rhs);
    let seen = '';
    for (const part of lhs.match(/[+-]?[^+-]+/g) || []) {
      seen += part;
      const m = part.match(/^([+-]?\d*)\*?x(\^2)?$/);
      if (m) {
        const k =
          m[1] === '' || m[1] === '+' ? 1 : m[1] === '-' ? -1 : Number(m[1]);
        if (m[2]) a += k;
        else b += k;
      } else if (/^[+-]?\d+$/.test(part)) {
        c += Number(part);
      } else {
        return null;
      }
    }
    if (seen !== lhs || !a) return null;
    try {
      return { kind: 'quad', values: validateValues('quad', { a, b, c }) };
    } catch {
      return null;
    }
  }

  const g = s.match(
    /^(?:求)?\(?(\d+)(?:與|和|,|，)(\d+)\)?的?(?:最大公因數|GCD)(?:(?:與|和|及)(?:最小公倍數|LCM))?[。?？]?$/i
  );
  if (g) {
    try {
      return {
        kind: 'gcd',
        values: validateValues('gcd', { a: Number(g[1]), b: Number(g[2]) }),
      };
    } catch {
      return null;
    }
  }

  const p = s.match(/^(?:從)?(?:點)?\((-?\d+)[,，](-?\d+)\)(?:出發)?[,，]?(.*)$/);
  if (p) {
    const ms = [...p[3].matchAll(/向([右左上下])(?:移動)?(\d+)(?:單位|格)?/g)];
    const rest = p[3]
      .replace(/向([右左上下])(?:移動)?(\d+)(?:單位|格)?/g, '')
      .replace(/先|再|[,，]|請問|求|終點|座標|是多少|為何|[。?？]/g, '');
    if (ms.length === 2 && !rest) {
      try {
        return {
          kind: 'coord',
          values: validateValues('coord', {
            x0: Number(p[1]),
            y0: Number(p[2]),
            d1: ms[0][1],
            n1: Number(ms[0][2]),
            d2: ms[1][1],
            n2: Number(ms[1][2]),
          }),
        };
      } catch {
        return null;
      }
    }
  }
  return null;
}

/* ===================== 安全數學表達式繪圖求值器 ===================== */
export function evaluator(expr: string): (x: number) => number {
  if (typeof expr !== 'string' || expr.length > 256) {
    throw new Error('算式過長。');
  }
  const s = expr.replace(/\s/g, '').replace(/(\d|\))x/g, '$1*x');
  if (!s || !/^[\dx.+\-*/^()]+$/.test(s)) {
    throw new Error('不支援的算式。');
  }
  const ts = s.match(/\d+(?:\.\d+)?|x|[+\-*/^()]/g) || [];
  if (ts.join('') !== s || ts.length > 160) {
    throw new Error('算式格式不正確。');
  }
  let i = 0;
  let depth = 0;
  type Node =
    | { op: 'n'; v: number }
    | { op: 'x' }
    | { op: 'neg' | 'pos'; l: Node }
    | { op: '+' | '-' | '*' | '/' | '^'; l: Node; r: Node };

  function atom(): Node {
    if (++depth > 32) throw new Error('算式過於複雜。');
    let n: Node;
    const t = ts[i++];
    if (t === '(') {
      n = add();
      if (ts[i++] !== ')') throw new Error('括號未配對。');
    } else if (t === 'x') {
      n = { op: 'x' };
    } else if (t && /^\d/.test(t)) {
      n = { op: 'n', v: Number(t) };
    } else {
      throw new Error('無法讀取算式。');
    }
    depth--;
    return n;
  }
  function power(): Node {
    let n = atom();
    if (ts[i] === '^') {
      i++;
      n = { op: '^', l: n, r: unary() };
    }
    return n;
  }
  function unary(): Node {
    if (ts[i] === '+' || ts[i] === '-') {
      const op = ts[i++];
      return { op: op === '-' ? 'neg' : 'pos', l: unary() };
    }
    return power();
  }
  function mul(): Node {
    let n = unary();
    while (ts[i] === '*' || ts[i] === '/') {
      const op = ts[i++] as '*' | '/';
      n = { op, l: n, r: unary() };
    }
    return n;
  }
  function add(): Node {
    let n = mul();
    while (ts[i] === '+' || ts[i] === '-') {
      const op = ts[i++] as '+' | '-';
      n = { op, l: n, r: mul() };
    }
    return n;
  }
  const root = add();
  if (i !== ts.length) throw new Error('算式尚有未解析部分。');

  function run(n: Node, x: number): number {
    if (n.op === 'n') return n.v;
    if (n.op === 'x') return x;
    const a = run(n.l, x);
    if (n.op === 'neg') return -a;
    if (n.op === 'pos') return a;
    const b = run((n as { op: '+' | '-' | '*' | '/' | '^'; l: Node; r: Node }).r, x);
    return n.op === '+'
      ? a + b
      : n.op === '-'
      ? a - b
      : n.op === '*'
      ? a * b
      : n.op === '/'
      ? a / b
      : Math.pow(a, b);
  }
  return (x: number) => run(root, x);
}

export function cleanDrawing(s: any): DrawingSpec | null {
  if (!s || typeof s !== 'object') return null;
  const caption = typeof s.caption === 'string' ? s.caption.slice(0, 300) : '';
  if (s.type === 'points' && Array.isArray(s.points)) {
    const points = s.points
      .slice(0, 16)
      .filter(
        (p: any) =>
          p &&
          typeof p.x === 'number' &&
          typeof p.y === 'number' &&
          Number.isFinite(p.x) &&
          Number.isFinite(p.y)
      )
      .map((p: any) => ({
        x: p.x,
        y: p.y,
        label: typeof p.label === 'string' ? p.label.slice(0, 40) : '',
      }));
    return points.length
      ? { type: 'points', points, connect: Boolean(s.connect), caption }
      : null;
  }
  if (s.type === 'function' && typeof s.expr === 'string') {
    try {
      evaluator(s.expr);
      const xmin = typeof s.xmin === 'number' ? s.xmin : -6;
      const xmax = typeof s.xmax === 'number' ? s.xmax : 6;
      if (!(xmax > xmin)) return null;
      return { type: 'function', expr: s.expr, xmin, xmax, caption };
    } catch {
      return null;
    }
  }
  if (s.type === 'shortdiv' && Array.isArray(s.rows) && Array.isArray(s.last)) {
    return {
      type: 'shortdiv',
      rows: s.rows,
      last: [Number(s.last[0]) || 1, Number(s.last[1]) || 1],
      caption,
    };
  }
  return null;
}

/* ===================== AI 回傳正規化（無驗證干擾） ===================== */
export function normalizeAIProblem(raw: any, originalQuestion?: string): MathProblemData {
  const question = String(raw?.question || originalQuestion || '數學題目').trim();
  const concept = String(raw?.concept || '國中數學核心觀念').trim();
  const kind = kindOf(concept);
  const defaultRes = getKnowledgeResources(kind || 'quad', concept);

  const explanation: AIExplanationData = {
    plainTranslation: String(
      raw?.explanation?.plainTranslation ||
        `這題屬於「${concept}」，請先看清楚題目給的已知數字與最後要計算的目標。`
    ),
    givenConditions: Array.isArray(raw?.explanation?.givenConditions)
      ? raw.explanation.givenConditions.map(String)
      : ['請參考題目敘述中的已知條件與數據'],
    targetGoal: String(raw?.explanation?.targetGoal || '求出題目所詢問的未知數或結果'),
    keyTerms: Array.isArray(raw?.explanation?.keyTerms)
      ? raw.explanation.keyTerms.map((k: any) => ({
          term: String(k?.term || concept),
          meaning: String(k?.meaning || '本題核心數學概念'),
        }))
      : [{ term: concept, meaning: '國中數學重要解題概念' }],
    starterHint: String(
      raw?.explanation?.starterHint ||
        raw?.thinkTip ||
        '先把已知條件列成算式，再一步步化簡求解。'
    ),
  };

  const methods =
    Array.isArray(raw?.methods) && raw.methods.length > 0
      ? raw.methods.map((m: any) => ({
          name: String(m?.name || '標準解法'),
          steps: Array.isArray(m?.steps) ? m.steps.map(String) : [],
        }))
      : [
          {
            name: '逐步詳解',
            steps: Array.isArray(raw?.steps)
              ? raw.steps.map(String)
              : ['根據題意列出關係式並化簡求解。'],
          },
        ];

  const videos: VideoResource[] =
    Array.isArray(raw?.videos) && raw.videos.length > 0
      ? raw.videos.map((v: any) => {
          const q = encodeURIComponent(String(v?.searchQuery || v?.title || concept));
          const platform = String(v?.platform || '均一教育平台');
          const url = platform.includes('YouTube')
            ? `https://www.youtube.com/results?search_query=${q}`
            : platform.includes('Khan')
            ? `https://www.khanacademy.org/search?page_search_query=${q}`
            : `https://www.junyiacademy.org/search?q=${q}`;
          return {
            title: String(v?.title || `${concept} 觀念教學影片`),
            platform,
            durationHint: String(v?.durationHint || '約 8 分鐘'),
            summary: String(v?.summary || `講解 ${concept} 的核心觀念與例題。`),
            url,
            searchQuery: String(v?.searchQuery || concept),
          };
        })
      : defaultRes.videos;

  const literature: LiteratureItem[] =
    Array.isArray(raw?.literature) && raw.literature.length > 0
      ? raw.literature.map((l: any) => ({
          title: String(l?.title || `${concept} 重點講義`),
          category: String(l?.category || '核心觀念文獻'),
          content: String(l?.content || String(raw?.principle || '')),
          commonMistake: l?.commonMistake ? String(l.commonMistake) : undefined,
        }))
      : defaultRes.literature;

  const sameType: PracticeItem = raw?.sameType?.q
    ? {
        q: String(raw.sameType.q),
        a: String(raw.sameType.a || ''),
        steps: Array.isArray(raw.sameType.steps) ? raw.sameType.steps.map(String) : [],
        concepts: Array.isArray(raw.sameType.concepts)
          ? raw.sameType.concepts.map(String)
          : [concept],
        source: 'ai',
      }
    : generateQuadPractice().sameType;

  const extension: PracticeItem = raw?.extension?.q
    ? {
        q: String(raw.extension.q),
        a: String(raw.extension.a || ''),
        steps: Array.isArray(raw.extension.steps) ? raw.extension.steps.map(String) : [],
        concepts: Array.isArray(raw.extension.concepts)
          ? raw.extension.concepts.map(String)
          : [concept, '進階應用'],
        source: 'ai',
      }
    : generateQuadPractice().extension;

  return {
    question,
    concept,
    kind,
    source: 'ai',
    explanation,
    shortAnswer: String(raw?.shortAnswer || '請參考詳答步驟'),
    thinkTip: String(raw?.thinkTip || explanation.starterHint),
    steps: methods[0]?.steps || [],
    methods,
    principle: String(
      raw?.principle || `掌握「${concept}」的定義與等量公理，即可穩定推導出正確解答。`
    ),
    prequels: Array.isArray(raw?.prequels) ? raw.prequels.map(String) : ['代數運算基礎'],
    sequels: Array.isArray(raw?.sequels) ? raw.sequels.map(String) : ['進階綜合應用題'],
    videos,
    literature,
    sameType,
    extension,
    drawing: cleanDrawing(raw?.drawing),
    level: raw?.level === '超出國中' ? '超出國中' : raw?.level === '國中' ? '國中' : undefined,
    levelNote: raw?.levelNote ? String(raw.levelNote) : undefined,
    unitIds: Array.isArray(raw?.unitIds) ? raw.unitIds.map(String).slice(0, 2) : undefined,
    highSchoolNote: raw?.highSchoolNote ? String(raw.highSchoolNote) : undefined,
  };
}

/* ===================== 批次練功房題庫產生器 ===================== */
export function batch(
  kind: TemplateKind,
  count: number,
  level: 'sameType' | 'extension' = 'sameType'
): PracticeItem[] {
  const seen = new Set<string>();
  const out: PracticeItem[] = [];
  let tries = 0;
  while (out.length < count && tries++ < count * 40) {
    const d = makeData(kind, randomValues(kind));
    const item: PracticeItem =
      level === 'sameType'
        ? {
            q: d.question,
            a: d.shortAnswer,
            steps: d.steps,
            concepts: [d.concept],
            source: 'local',
          }
        : d.extension;
    if (!seen.has(item.q)) {
      seen.add(item.q);
      out.push(item);
    }
  }
  return out;
}

/* ===================== 錯題本資料正規化與記錄 ===================== */
export function normalizeSaved(x: any): SavedMistakeItem {
  if (!x || typeof x !== 'object') throw new Error('錯題格式不正確。');
  const question = String(x.question || x.q || '').trim();
  const answer = String(x.answer || x.a || x.shortAnswer || '').trim();
  if (!question || !answer) throw new Error('錯題缺少題目或答案。');
  const concept = String(x.concept || '國中數學').trim();
  const kind = kindOf(concept) || 'quad';
  const fallbackData = makeData(kind, randomValues(kind));

  return {
    id: String(x.id || uid()),
    question,
    answer,
    concept,
    steps: Array.isArray(x.steps) ? x.steps.map(String) : [],
    methods: Array.isArray(x.methods) && x.methods.length
      ? x.methods
      : [{ name: '詳解', steps: Array.isArray(x.steps) ? x.steps.map(String) : [] }],
    thinkTip: String(x.thinkTip || ''),
    principle: String(x.principle || fallbackData.principle),
    prequels: Array.isArray(x.prequels) ? x.prequels.map(String) : fallbackData.prequels,
    sequels: Array.isArray(x.sequels) ? x.sequels.map(String) : fallbackData.sequels,
    drawing: cleanDrawing(x.drawing),
    source: x.source === 'ai' ? 'ai' : 'local',
    kind,
    wrong: Math.max(0, Number(x.wrong) || 0),
    right: Math.max(0, Number(x.right) || 0),
    streak: Math.max(0, Number(x.streak ?? x.correctCount) || 0),
    consecutiveWrong: Math.max(0, Number(x.consecutiveWrong) || 0),
    attempts: Math.max(0, Number(x.attempts) || 0),
    totalTime: Math.max(0, Number(x.totalTime) || 0),
    mastery: Math.min(100, Math.max(0, Number(x.mastery) || 0)),
    errorTypes: Array.isArray(x.errorTypes) ? x.errorTypes.map(String) : [],
    lastErrorType: x.lastErrorType ? String(x.lastErrorType) : null,
    lastErrorReason: String(x.lastErrorReason || ''),
    added: String(x.added || new Date().toISOString()),
    history: Array.isArray(x.history) ? x.history : [],
    sameType: x.sameType?.q ? x.sameType : fallbackData.sameType,
    extension: x.extension?.q ? x.extension : fallbackData.extension,
    explanation: x.explanation || fallbackData.explanation,
    videos: x.videos || fallbackData.videos,
    literature: x.literature || fallbackData.literature,
  };
}

export function recordReview(
  q: SavedMistakeItem,
  ok: boolean,
  type: string | null,
  seconds: number,
  work = '',
  reason = ''
): { item: SavedMistakeItem; graduated: boolean } {
  if (!ok && !type) {
    throw new Error('請先選擇錯誤原因類型。');
  }
  const n = normalizeSaved(q);
  n.attempts += 1;
  n.totalTime += Math.max(0, seconds);
  if (ok) {
    n.right += 1;
    n.streak += 1;
    n.consecutiveWrong = 0;
    n.lastErrorType = null;
    n.lastErrorReason = '';
  } else {
    n.wrong += 1;
    n.streak = 0;
    n.consecutiveWrong = (n.consecutiveWrong || 0) + 1;
    n.lastErrorType = type;
    n.lastErrorReason = reason;
    if (type) n.errorTypes = [...n.errorTypes.slice(-49), type];
  }
  n.mastery = Math.round(Math.min(100, Math.max(0, n.mastery + (ok ? 25 : -25))));
  n.history = [
    ...n.history.slice(-99),
    {
      ok,
      sec: Math.max(0, seconds),
      type: ok ? null : type,
      at: new Date().toISOString(),
      work,
      reason: ok ? '' : reason,
    },
  ];
  return { item: n, graduated: ok && n.streak >= 3 };
}

/* ===================== 內建快速題目範例（含模擬拍照題卡） ===================== */
export const SAMPLE_PROBLEMS: Array<{
  id: string;
  label: string;
  tag: string;
  question: string;
  kind: TemplateKind;
  values: Record<string, number | string>;
}> = [
  {
    id: 'quad-sample',
    label: '一元二次方程式',
    tag: '八年級代數',
    question: '解方程式 $x^2 + x - 6 = 0$。',
    kind: 'quad',
    values: { a: 1, b: 1, c: -6 },
  },
  {
    id: 'coord-sample',
    label: '直角座標點平移',
    tag: '七年級座標',
    question: '從點 $(-1, 2)$ 出發，先向下移動 1 單位，再向右移動 5 單位，終點座標是多少？',
    kind: 'coord',
    values: { x0: -1, y0: 2, d1: '下', n1: 1, d2: '右', n2: 5 },
  },
  {
    id: 'gcd-sample',
    label: '最大公因數與最小公倍數',
    tag: '七年級數論',
    question: '求 $(24, 36)$ 的最大公因數與最小公倍數。',
    kind: 'gcd',
    values: { a: 24, b: 36 },
  },
];
