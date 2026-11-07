import { ThinkingLevel, Type } from '@google/genai';
import { UNIT_CATALOG, UNIT_IDS } from './unitCatalog';
import { generateFor, hasKeys } from './aiPool';
import { dropCache, normalizeAnswer, readCache, writeCache } from './answerCache';

// 金鑰池與「每個功能用哪些模型」都在 aiPool.ts；這裡只管 prompt 與流程
const generate = generateFor;

// 解題的思考深度（MINIMAL / LOW / MEDIUM / HIGH）；未設定時沿用模型預設
const SOLVE_THINKING = process.env.SOLVE_THINKING_LEVEL as ThinkingLevel | undefined;
const solveThinking = SOLVE_THINKING ? { thinkingConfig: { thinkingLevel: SOLVE_THINKING } } : {};

export const MATH_ACTIONS = ['recognize', 'explain', 'solve', 'enrich', 'practice', 'ask', 'distill'] as const;
export type MathAction = (typeof MATH_ACTIONS)[number];

export function isMathAction(action: unknown): action is MathAction {
  return typeof action === 'string' && (MATH_ACTIONS as readonly string[]).includes(action);
}

export interface HandlerResult {
  status: number;
  body: { ok: boolean; result?: unknown; error?: string; cached?: boolean };
}

const explanationProperties = {
  plainTranslation: { type: Type.STRING },
  givenConditions: { type: Type.ARRAY, items: { type: Type.STRING } },
  targetGoal: { type: Type.STRING },
  keyTerms: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        term: { type: Type.STRING },
        meaning: { type: Type.STRING },
      },
      required: ['term', 'meaning'],
    },
  },
  starterHint: { type: Type.STRING },
};

const explanationRequired = [
  'plainTranslation',
  'givenConditions',
  'targetGoal',
  'keyTerms',
  'starterHint',
];

// 先寫題目、再算步驟、最後才給答案：模型會照欄位順序產生，答案寫在推理之後才不會先猜再硬湊
const practiceItemSchema = {
  type: Type.OBJECT,
  properties: {
    q: { type: Type.STRING, description: '新題目文字，條件完整、答案唯一' },
    steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: '詳解步驟陣列' },
    a: { type: Type.STRING, description: '簡答，必須與 steps 的結論一致' },
    concepts: { type: Type.ARRAY, items: { type: Type.STRING }, description: '涵蓋的觀念標籤' },
  },
  required: ['q', 'steps', 'a', 'concepts'],
  propertyOrdering: ['q', 'steps', 'a', 'concepts'],
};

const PRACTICE_RULES = `出題規則：題目條件必須完整、答案唯一；若是選擇題，四個選項中只能有一個正確答案。先在 steps 完整算出答案，再寫 a，a 必須與 steps 的結論一致。`;

const STEP_RULES = `steps 只寫最終正確的推理過程，不要出現「等等」、「更正」、「重新驗算」等自我修正的文字；若過程中發現算錯，直接寫正確版本即可。`;

// 本 App 給國中生用：解法只能用國中教過的工具，真的超出範圍就誠實說明
const LEVEL_RULES = `範圍限制：使用者是台灣國中生（108 課綱 7～9 年級）。
- 只要國中方法解得出來，解法就只能用國中教過的方法，即使步驟比較長也一樣（例如：方程式、乘法公式、因式分解、根式、畢氏定理、全等與相似、圓、三角形三心、等差數列與級數、一次與二次函數、統計與機率）。
- 不可使用高中以上的工具：三角函數（sin、cos、tan）、正弦定理與餘弦定理、對數、向量、矩陣、排列組合公式（P、C 符號）、微積分、複數。
- 如果題目真的只能用高中以上的知識解出，level 填「超出國中」，並在 levelNote 用一兩句話說明需要哪個高中觀念；不要硬湊一個看似國中、其實不正確的解法。`;

const unitList = UNIT_CATALOG.map((u) => `${u.id}：${u.grade}年級 ${u.title}`).join('\n');

// 第三層把關：國中題的詳解裡出現高中工具就重做一次
const HIGH_SCHOOL_PATTERN =
  /\\(?:sin|cos|tan|cot|sec|csc|log|ln|lim|int|vec|binom)(?![A-Za-z])|\b(?:sin|cos|tan|log)(?![A-Za-z])\s*[(\\{0-9A-Za-z_^]|[CP]\^\{?\d+\}?_\{?\d+\}?|[CP]_\{?\d+\}?\^\{?\d+\}?|餘弦定理|正弦定理|三角函數|向量|矩陣|微積分|導數|微分|積分/;

function highSchoolHit(result: any): string | null {
  const text = [result?.shortAnswer, ...(result?.methods || []).flatMap((m: any) => m?.steps || [])].join('\n');
  return text.match(HIGH_SCHOOL_PATTERN)?.[0] || null;
}

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

// 模型偶爾把 LaTeX 的反斜線當成 JSON 跳脫字元（\times 變成 Tab + "imes"、\frac 變成換頁 + "rac"），
// 控制字元後面直接接英文字母時一律還原成反斜線
function repairLatex(value: any): any {
  if (typeof value === 'string') {
    return value
      .replace(/\t(?=[A-Za-z])/g, '\\t')
      .replace(/\f(?=[A-Za-z])/g, '\\f')
      .replace(/\x08(?=[A-Za-z])/g, '\\b')
      .replace(/\v(?=[A-Za-z])/g, '\\v')
      .replace(/\r(?=[A-Za-z])/g, '\\r')
      .replace(/\n(?=(?:eq|e|abla|ot|u|i)(?![A-Za-z]))/g, '\\n');
  }
  if (Array.isArray(value)) return value.map(repairLatex);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, repairLatex(v)]));
  }
  return value;
}

const parseJson = (text: string | undefined) => repairLatex(JSON.parse((text || '{}').trim()));

function imagePart(image: any): Part[] {
  if (!image?.data) return [];
  return [{ inlineData: { mimeType: image.mime || 'image/jpeg', data: image.data } }];
}

export async function runMathAction(action: unknown, payload: any, _retry = 0): Promise<HandlerResult> {
  if (!isMathAction(action)) {
    return { status: 400, body: { ok: false, error: `未知的動作：${String(action)}` } };
  }

  if (!hasKeys(action)) {
    return {
      status: 503,
      body: { ok: false, error: '伺服器尚未設定 GEMINI_API_KEYS（或 GEMINI_API_KEY），已自動切換為本機解題引擎。' },
    };
  }

  try {
    if (action === 'recognize') {
      const image = payload?.image;
      const hint = payload?.hint || '';
      if (!image?.data) {
        return { status: 400, body: { ok: false, error: '缺少圖片資料。' } };
      }

      const response = await generate(action, {
        contents: {
          parts: [
            ...imagePart(image),
            {
              text: `請將這張數學題目圖片完整辨識為繁體中文題目文字，數學公式請使用 $...$ LaTeX 格式表示。只輸出題目本身的文字，不要加上額外解釋。${
                hint ? `參考提示：${hint}` : ''
              }`,
            },
          ],
        },
      });

      return { status: 200, body: { ok: true, result: { text: (response.text || '').trim() } } };
    }

    if (action === 'explain') {
      const question = String(payload?.question || '').trim();
      const parts: Part[] = [...imagePart(payload?.image)];
      parts.push({
        text: `學生看到這道國中數學題目時表示「看不懂題目在問什麼」。
請用國中生容易理解的白話繁體中文，幫學生做「題意解釋」（注意：不要直接算出最終答案，而是幫助學生看懂題目在說什麼、有哪些已知條件、目標要算什麼，以及第一步可以怎麼想）。
數學式請用 $...$ 包裹。只用國中學過的觀念來說明；如果題目需要高中觀念，直接告訴學生這題超出國中範圍。

${payload?.profileContext ? `學生過去學習背景（僅作教學個人化參考）：\n${payload.profileContext}\n` : ''}
題目：${question || '（請見附圖）'}`,
      });

      const response = await generate(action, {
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              plainTranslation: {
                type: Type.STRING,
                description: '用白話文翻譯題目的意思，讓看不懂題目的國中生一下子明白題目情境',
              },
              givenConditions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '題目給出的已知條件清單（2~4項）',
              },
              targetGoal: {
                type: Type.STRING,
                description: '題目最後真正要求我們找出的目標是什麼',
              },
              keyTerms: {
                ...explanationProperties.keyTerms,
                description: '題目中可能讓學生卡住的數學名詞或關鍵字解釋',
              },
              starterHint: {
                type: Type.STRING,
                description: '不直接給答案的破題第一步提示，引導學生自己試著列式或計算',
              },
            },
            required: explanationRequired,
          },
        },
      });

      return { status: 200, body: { ok: true, result: parseJson(response.text) } };
    }

    // solve 只產生學生馬上要看的部分（簡答、詳解），其餘教學內容交給 enrich 背景補上
    if (action === 'solve') {
      const question = String(payload?.question || '').trim();
      const solveOnce = async (retryHint: string) => {
        const parts: Part[] = [...imagePart(payload?.image)];
        parts.push({
          text: `請解以下國中數學題目，用繁體中文回答（數學符號請使用 $...$ LaTeX 格式），依序產生：
1. question: 題目完整文字（若是圖片，請把題目與選項完整轉成文字）
2. concept: 核心數學單元名稱
3. unitIds: 這題對應的國中單元 1~2 個，只能從下方「單元清單」挑 id
4. level: 「國中」或「超出國中」
5. levelNote: 只有 level 為「超出國中」時才填，說明需要哪個高中觀念
6. thinkTip: 破題思考提示（不要直接說出答案）
7. methods: 1~2 種解法，每種含 name 與 steps 陣列，請在這裡完整推理出答案
8. shortAnswer: 簡答，必須與 methods 推出的結論一致；選擇題請寫成「(B) 9」的格式（選項代號加上數值）

${LEVEL_RULES}
${STEP_RULES}
${retryHint}

${payload?.profileContext ? `學生過去學習背景（只用來調整教學策略，不可覆蓋本題）：\n${payload.profileContext}\n` : ''}
單元清單：
${unitList}

題目：${question || '（請見附圖）'}`,
        });

        const response = await generate(action, {
          contents: { parts },
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                concept: { type: Type.STRING },
                unitIds: { type: Type.ARRAY, items: { type: Type.STRING, enum: UNIT_IDS } },
                level: { type: Type.STRING, enum: ['國中', '超出國中'] },
                levelNote: { type: Type.STRING },
                thinkTip: { type: Type.STRING },
                methods: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      steps: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ['name', 'steps'],
                    propertyOrdering: ['name', 'steps'],
                  },
                },
                shortAnswer: { type: Type.STRING },
              },
              required: ['question', 'concept', 'unitIds', 'level', 'thinkTip', 'methods', 'shortAnswer'],
              propertyOrdering: ['question', 'concept', 'unitIds', 'level', 'levelNote', 'thinkTip', 'methods', 'shortAnswer'],
            },
            ...solveThinking,
          },
        });
        return parseJson(response.text);
      };

      const solveFresh = async () => {
        let fresh = await solveOnce('');
        const hit = fresh?.level !== '超出國中' ? highSchoolHit(fresh) : null;
        if (hit) {
          fresh = await solveOnce(
            `注意：上一版解法用到了高中工具「${hit}」。這題請改用國中方法重新解；如果真的只能用高中方法，level 請填「超出國中」。`
          );
        }
        return fresh;
      };

      // 只有純文字題才走快取（圖片每次辨識都略有不同，不適合比對）
      const cacheable = !payload?.image?.data && question.length > 0;
      const cached = cacheable ? await readCache(question) : null;

      // 已驗證：直接回傳，不消耗模型額度
      if (cached?.status === 'verified') {
        return { status: 200, body: { ok: true, result: cached.result, cached: true } };
      }

      const result = await solveFresh();

      if (cacheable) {
        if (!cached) {
          await writeCache(question, 'candidate', result);
        } else if (normalizeAnswer(cached.result?.shortAnswer) === normalizeAnswer(result?.shortAnswer)) {
          // 兩次獨立解出同樣的簡答，升級為已驗證
          await writeCache(question, 'verified', result);
        } else {
          // 兩次不一致：答案不可信，不存
          await dropCache(question);
        }
      }
      return { status: 200, body: { ok: true, result } };
    }

    if (action === 'enrich') {
      const question = String(payload?.question || '').trim();
      const concept = String(payload?.concept || '').trim();
      const shortAnswer = String(payload?.shortAnswer || '').trim();
      if (!question) {
        return { status: 400, body: { ok: false, error: '缺少題目文字。' } };
      }
      const response = await generate(action, {
        contents: `以下國中數學題目已經解完，請用繁體中文補上其餘教學內容（數學符號請使用 $...$ LaTeX 格式）：
1. explanation: 給「看不懂題目」學生的白話題意解釋（plainTranslation、givenConditions、targetGoal、keyTerms、starterHint，不要直接給答案）
2. principle: 核心知識點原理說明
3. prequels: 先備基礎知識點陣列（2~3個）
4. sequels: 後續延伸知識點陣列（2~3個）
5. literature: 觀念重點整理（2~3筆，含 title、category、content、commonMistake）
6. highSchoolNote: 如果這題有「高中才會學到、而且明顯更簡單」的做法，用兩三句話簡短介紹，開頭寫「高中會學到：」；沒有就留空字串
7. sameType: 練功房「同類型」練習題（結構相同、更換數字）
8. extension: 練功房「延伸」進階應用題（結合情境或兩個以上相關觀念）

${LEVEL_RULES}
除了 highSchoolNote 以外，原理說明與練習題都必須在國中範圍內。
${PRACTICE_RULES}
${STEP_RULES}

${payload?.profileContext ? `學生過去學習背景（只用來調整教學策略，不可覆蓋本題）：\n${payload.profileContext}\n` : ''}
題目：${question}
單元：${concept}
本題答案：${shortAnswer}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              explanation: {
                type: Type.OBJECT,
                properties: explanationProperties,
                required: explanationRequired,
              },
              principle: { type: Type.STRING },
              prequels: { type: Type.ARRAY, items: { type: Type.STRING } },
              sequels: { type: Type.ARRAY, items: { type: Type.STRING } },
              literature: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    content: { type: Type.STRING },
                    commonMistake: { type: Type.STRING },
                  },
                  required: ['title', 'category', 'content'],
                },
              },
              highSchoolNote: { type: Type.STRING },
              sameType: practiceItemSchema,
              extension: practiceItemSchema,
            },
            required: [
              'explanation',
              'principle',
              'prequels',
              'sequels',
              'literature',
              'highSchoolNote',
              'sameType',
              'extension',
            ],
          },
        },
      });

      return { status: 200, body: { ok: true, result: parseJson(response.text) } };
    }

    if (action === 'practice') {
      const { question, concept, mode } = payload || {};
      const isExtension = mode === 'extension';
      const response = await generate(action, {
        contents: `請根據以下原題與數學觀念，用繁體中文出一道全新的「${
          isExtension ? '延伸挑戰題（結合情境或兩個以上相關觀念）' : '同類型練習題（結構相同、更換數字）'
        }」。公式請用 $...$ LaTeX 格式。
${LEVEL_RULES}
${PRACTICE_RULES}
${STEP_RULES}
原題：${question}
觀念：${concept}
${payload?.profileContext ? `學生過去學習背景（僅供調整難度與提示方式）：\n${payload.profileContext}` : ''}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: practiceItemSchema,
        },
      });

      return { status: 200, body: { ok: true, result: parseJson(response.text) } };
    }

    if (action === 'distill') {
      const turns: any[] = Array.isArray(payload?.turns) ? payload.turns.slice(-40) : [];
      if (!turns.length) {
        return { status: 400, body: { ok: false, error: '沒有可分析的互動紀錄。' } };
      }
      const turnText = turns
        .map((t, i) => {
          const head = `#${i + 1} [${t.kind}]｜觀念：${t.concept || '未分類'}｜題目：${t.question || ''}`;
          if (t.kind === 'practice') {
            return `${head}\n學生作答：${t.studentText || '（未寫過程）'}\n自評：${
              t.isCorrect ? '答對' : '答錯'
            }${t.seconds ? `｜用時 ${t.seconds} 秒` : ''}`;
          }
          if (t.kind === 'explain_request') {
            return `${head}\n學生表示看不懂題意`;
          }
          return `${head}\n學生問：${t.studentText}\nAI 答：${t.aiText || ''}`;
        })
        .join('\n\n');

      const response = await generate(action, {
        contents: `你是國中數學的學習診斷老師。請閱讀這位學生「先前的學習背景」、「客觀作答數據」與「最新的互動紀錄」，
更新出一份精簡的學習背景，之後其他 AI 會依此為這位學生客製化講解與補充內容。

規則：
- 以證據為準：從學生的提問用語、作答過程、答錯的地方推斷他的卡點與迷思，不要憑空猜測；證據不足就保留先前的判斷。
- 新的證據若與先前判斷矛盾（例如原本的迷思已經答對），要更新或移除。
- 學習節奏 pace 依作答時間、正確率變化與提問深度判斷：fast / steady / needs_time，資料太少用 unknown。
- growthPath 依先備關係排序：先補卡住的前置觀念，再往延伸單元走，最多 5 項。
- 用繁體中文，每一項都要短，不要寫出學生的個人資料，也不要評價學生的人格。

先前的學習背景：
${payload?.notes ? JSON.stringify(payload.notes) : '（尚無）'}

客觀作答數據：
${String(payload?.stats || '（尚無）')}

最新互動紀錄：
${turnText}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: '2~3 句話描述這位學生目前的整體學習狀況' },
              pace: { type: Type.STRING, enum: ['fast', 'steady', 'needs_time', 'unknown'] },
              paceNote: { type: Type.STRING, description: '判斷學習節奏的依據，一句話' },
              preferredStyle: { type: Type.STRING, description: '對這位學生有效的講解方式，例如需要圖像、步驟拆細、先給例子' },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING }, description: '已掌握的觀念，最多 5 項' },
              misconceptions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    concept: { type: Type.STRING },
                    note: { type: Type.STRING, description: '具體的卡點或迷思' },
                  },
                  required: ['concept', 'note'],
                },
                description: '最多 6 項',
              },
              growthPath: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    concept: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['concept', 'reason'],
                },
              },
            },
            required: ['summary', 'pace', 'paceNote', 'preferredStyle', 'strengths', 'misconceptions', 'growthPath'],
          },
        },
      });

      const parsed = parseJson(response.text);
      return {
        status: 200,
        body: {
          ok: true,
          result: {
            summary: String(parsed.summary || ''),
            pace: ['fast', 'steady', 'needs_time'].includes(parsed.pace) ? parsed.pace : 'unknown',
            paceNote: String(parsed.paceNote || ''),
            preferredStyle: String(parsed.preferredStyle || ''),
            strengths: (parsed.strengths || []).slice(0, 5).map(String),
            misconceptions: (parsed.misconceptions || []).slice(0, 6),
            growthPath: (parsed.growthPath || []).slice(0, 5),
          },
        },
      };
    }

    // action === 'ask'
    const { question, context, query } = payload || {};
    const response = await generate(action, {
      contents: `你是親切的國中數學輔導老師。請用簡單好懂的繁體中文回答學生的追問（數學式用 $...$ 包裹）。只用國中學過的方法解釋，不要用三角函數、對數、向量、排列組合公式等高中工具；如果學生問的內容需要高中觀念，直接說明這是高中才會學到的：
目前題目：${question}
背景資訊：${context || ''}
學生提問：${query}
${payload?.profileContext ? `學生過去學習背景（僅供個人化教學）：\n${payload.profileContext}` : ''}`,
    });

    return { status: 200, body: { ok: true, result: { message: (response.text || '').trim() } } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI 處理發生錯誤';
    const is503 = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
    if (is503 && _retry < 2) {
      await new Promise((r) => setTimeout(r, 2500 * (_retry + 1)));
      return runMathAction(action, payload, _retry + 1);
    }
    // 所有模型都用完或都塞車時，給學生看得懂的說明，不要顯示原始錯誤 JSON
    if (/\b429\b|RESOURCE_EXHAUSTED|quota/i.test(msg)) {
      return { status: 503, body: { ok: false, error: '今天的免費 AI 次數已經用完，大約明天下午 3 點恢復' } };
    }
    if (is503) {
      return { status: 503, body: { ok: false, error: 'AI 目前太忙，請過幾分鐘再試一次' } };
    }
    return { status: 500, body: { ok: false, error: msg } };
  }
}
