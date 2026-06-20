import https from 'https';
import http from 'http';
import { URL } from 'url';

const API_KEY = process.env.BIZROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
const API_BASE = process.env.BIZROUTER_BASE_URL || 'https://api.openai.com/v1';
const API_MODEL = process.env.BIZROUTER_MODEL || process.env.REPORT_NARRATIVE_MODEL || 'gpt-4o-mini';

const FACTOR_ANALYSIS_SYSTEM_PROMPT = `너는 "자동심사 현황분석 Agent"의 factor 분석 전문가다.

역할:
- 입력된 facts(청구 factor 변화)만 바탕으로 운영관리자용 분석을 작성한다.
- 숫자 계산, 판정 변경, 원인 추정은 하지 않는다.
- 운영관리자가 빠르게 읽고 판단할 수 있게 짧고 명확하게 쓴다.

중요 원칙:
1. 숫자와 판정은 절대 새로 만들지 말고 입력된 facts만 사용한다.
2. 추정이 필요하면 "추정이지만" 또는 "추정" 표시를 한다.
3. 불확실하면 단정하지 말고 "확인 필요"라고 쓴다.
4. 변화가 없으면 억지로 의미를 만들지 말고 "안정" 또는 "변화 없음"을 명시한다.
5. 운영관리자 관점에서만 쓴다. 과도한 기술 설명은 피한다.
6. 자동지급률, 처리효율, 안정 상태, factor 변화의 해석을 우선한다.
7. 사람 심사가 필요한 건을 자동지급처럼 보이게 쓰지 않는다.
8. 민감정보나 원문 전체를 다시 노출하지 않는다.

작성규칙:
1. 변화 설명 (1~3문장)
   - 이번 달과 전월의 차이를 사실 중심으로 요약한다.
   - 가장 중요한 변화 1개를 먼저 쓴다.
   - 수치가 있으면 수치를 포함한다.
   - 변화가 작으면 "변화 폭이 크지 않음" 또는 "안정"을 포함한다.

2. 운영 해석 (1~2문장)
   - 이 변화가 운영관리자에게 어떤 의미인지 쓴다.
   - 판단이 강하지 않으면 "운영상 추가 확인이 필요하다"처럼 보수적으로 쓴다.
   - ROI 보고용이면 운영효율 관점으로 해석한다.
   - 원인 단정은 하지 않는다.

3. 다음 조치 (1~3개, 행동 중심)
   - 지금 바로 할 일을 제안한다.
   - 점검, 확인, 모니터링, 기준 재검토, segment 이력 확인 같은 행동 중심이다.
   - "우선 확인"으로 시작한다면 불확실함을 표현한 것이다.
   - 자동화 확정, 최종 지급 확정, 강한 승인은 쓰지 않는다.

출력 형식 (JSON):
{
  "change_summary": "...",
  "operational_interpretation": "...",
  "next_actions_draft": ["...", "...", "..."],
  "confidence": "high | medium | low",
  "uncertainty_notes": ["..."]
}`;

function callLLM(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      model: API_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 600,
      top_p: 1,
    });

    const apiUrl = new URL(API_BASE);
    if (!apiUrl.pathname.includes('/chat/completions')) {
      apiUrl.pathname = '/v1/chat/completions';
    }

    const options = {
      hostname: apiUrl.hostname,
      port: apiUrl.port || (apiUrl.protocol === 'https:' ? 443 : 80),
      path: apiUrl.pathname + apiUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody),
        Authorization: `Bearer ${API_KEY}`,
      },
    };

    const requester = apiUrl.protocol === 'https:' ? https : http;

    const req = requester.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          } else {
            const content = parsed.choices?.[0]?.message?.content || '';
            resolve(content);
          }
        } catch (err) {
          reject(new Error(`Failed to parse LLM response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(requestBody);
    req.end();
  });
}

function buildUserMessage(factorData) {
  const {
    factor_type,
    factor_title,
    current_month,
    previous_month,
    comparisons = [],
    top_factor,
    additional_context = '',
  } = factorData;

  const comparisonText = comparisons
    .map((c) => {
      const direction = c.delta > 0 ? '상승' : c.delta < 0 ? '하락' : '변화 없음';
      return `  • ${c.value}: ${c.previous_rate.toFixed(1)}% → ${c.current_rate.toFixed(1)}% (${direction} ${c.delta >= 0 ? '+' : ''}${c.delta.toFixed(1)}pp) [${c.current_total}건 중 ${c.current_auto}건]`;
    })
    .join('\n');

  const topFactorText = top_factor
    ? `  최대 변화: ${top_factor.value} (${top_factor.delta >= 0 ? '+' : ''}${top_factor.delta.toFixed(1)}pp, ${top_factor.direction})`
    : '  최대 변화: 충분한 데이터 없음';

  const message = `다음 factor 변화를 분석해주세요.

[Factor 정보]
이름: ${factor_title} (${factor_type})
기준기간: ${previous_month} → ${current_month}

[전월 대비 변화]
${comparisonText}

${topFactorText}

[추가 정보]
${additional_context || '(없음)'}

위 facts를 바탕으로:
1. 변화 설명 - 가장 중요한 변화를 수치와 함께 1~3문장으로
2. 운영 해석 - 운영관리자 입장에서 이 변화의 의미를 1~2문장으로
3. 다음 조치 - 바로 할 수 있는 행동 1~3개를 제안

JSON 형식으로 응답하고, 형식 밖의 설명은 하지 않아주세요.`;

  return message;
}

export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!API_KEY) {
    res.status(500).json({ error: 'API_KEY not configured (BIZROUTER_API_KEY or OPENAI_API_KEY)' });
    return;
  }

  try {
    const factorData = req.body;
    const userMessage = buildUserMessage(factorData);

    const llmResponse = await callLLM(FACTOR_ANALYSIS_SYSTEM_PROMPT, userMessage);

    let analysis = {};
    try {
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseErr) {
      // 응답이 JSON이 아니면 텍스트로 처리
      analysis = {
        change_summary: llmResponse,
        operational_interpretation: '(해석 데이터 파싱 오류)',
        next_actions_draft: [],
        confidence: 'low',
        uncertainty_notes: [`응답 파싱 오류: ${parseErr.message}`],
      };
    }

    res.status(200).json({
      success: true,
      factor_type: factorData.factor_type,
      analysis,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Factor analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
