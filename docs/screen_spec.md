# Screen Spec — 자동심사 현황분석 Agent Dashboard Meta Prompt

## 목적
- `자동심사 현황분석 Agent`의 대시보드 디자인을 생성하기 위한 메타프롬프트를 정리한다.
- 참고 레퍼런스는 `refero.design stellate.co`처럼 전문적인 B2B metrics console 느낌이다.
- 동일 그룹사 내 다른 보험사 화면과 같은 UI framework를 유지하되, 더 정제되고 고급스러운 인상을 목표로 한다.
- 화면은 `운영모니터링`과 `리포트보관함`의 두 뷰로 구성한다.

## 디자인 방향
- enterprise analytics dashboard
- premium B2B SaaS console
- calm, trustworthy, data-dense, structured
- dark navy shell + light content canvas
- restrained blue accents
- crisp tables, compact KPI cards, minimal charts
- 운영관리자가 빠르게 읽는 화면

## 폰트 정책
### 제목
- Samsung PT 사용
- 우선 파일: `/Users/jyun/Documents/회사업무/삼성생명/폰트/SECPTB_0.TTF`
- 보조적으로 필요한 경우: `/Users/jyun/Documents/회사업무/삼성생명/폰트/SECPTL_1.TTF`

### 본문/하위 레벨
- Samsung Gothic 사용
- 우선 파일:
  - `/Users/jyun/Documents/회사업무/삼성생명/폰트/삼성긴고딕 Regular.ttf`
  - `/Users/jyun/Documents/회사업무/삼성생명/폰트/삼성긴고딕 Medium.ttf`
  - `/Users/jyun/Documents/회사업무/삼성생명/폰트/삼성긴고딕 Bold.ttf`
- 권장 사용 규칙:
  - 제목: Bold 또는 ExtraBold 계열
  - 섹션 헤더: Bold
  - 라벨/필터: Medium
  - 본문/보조설명: Regular

## 핵심 레이아웃
- left sidebar navigation
- top bar with compact filters for `기준년월` and `조회기간`
- main content area with:
  - KPI summary cards
  - auto-payment trend chart
  - segment change explanation panel
  - stability status badge
  - monthly report archive/download table
  - read-only subscription account list sourced from private CSV
  - report archive topbar with title and subtitle only
  - filter controls for timeframe and month selection
  - PoC용 특정년월 발송테스트 트리거

## 보여줘야 할 정보
- 자동지급률
- 처리효율
- 자동지급 건수
- 제외/인심사 건수
- 전월 대비 변화
- segment 변화 설명
- 안정 상태 / 변화 상태 / 미확정 상태
- 월간 리포트 자동 생성 상태
- 월간 리포트 발송 및 재다운로드 이력
- 월간 리포트 파일명 다운로드 링크
- 구독계정 문의 안내와 private CSV 기반 구독계정 목록
- 특정년월을 선택한 뒤 발송테스트를 실행하는 PoC 트리거

## 시각 스타일
- navy top bar and sidebar
- white or very light gray main canvas
- subtle shadows and soft borders
- blue as primary analytical color
- coral or pink only for alerts / negative deviation
- tables should be highly legible and compact
- charts should be functional, not decorative
- badges should be soft and modern

## 인터랙션 톤
- filters look practical and active
- tables support sorting and scanning
- report rows support download and traceability
- hover and focus states stay subtle
- the screen should feel like a real working operations tool

## 반드시 지킬 것
- 자동지급 상태를 운영관리자 관점에서 읽기 쉽게 보여준다.
- 월말 스냅샷 기준의 전월 대비 변화가 핵심이다.
- 변화가 없더라도 지표는 계속 노출하고 상태는 `안정`으로 보여준다.
- 성과는 판단값이 아니라 ROI 보고용으로 표현한다.
- 리포트보관함의 파일명은 다운로드 가능한 링크로 보여준다.
- 구독계정 관리는 화면 편집이 아니라 private CSV 기준 읽기 전용 목록으로 보여준다.
- 청구유형 분류, 최종 지급 확정, 지급금액 단독 확정은 넣지 않는다.
- 너무 장난스럽거나 마케팅스러운 느낌은 피한다.

## 메타프롬프트
```text
Create a professional enterprise dashboard UI for an insurance claims operations product named “자동심사 현황분석 Agent”.
The dashboard is for operations managers, with a serious, high-trust, productized SaaS feel similar to a polished metrics console.

Design direction:
- Use a refined enterprise analytics style: dark navy shell, light content canvas, restrained blue accents, subtle borders, soft shadows, and clean typography.
- The mood should feel like a premium internal platform for operations monitoring, not a consumer app and not a flashy marketing page.
- Borrow the structural discipline of a metrics tool: compact navigation, strong information hierarchy, data-dense panels, and clearly separated modules.
- The design should feel professional like a modern B2B dashboard with the visual confidence of a product used by analysts and operators every day.

Typography:
- Use Samsung PT for titles and key headlines.
  - Title font file: /Users/jyun/Documents/회사업무/삼성생명/폰트/SECPTB_0.TTF
  - Use the lighter Samsung PT file only if needed for secondary large headings: /Users/jyun/Documents/회사업무/삼성생명/폰트/SECPTL_1.TTF
- Use Samsung Gothic for all body text, labels, table text, filters, captions, and secondary UI.
  - Preferred files:
    - /Users/jyun/Documents/회사업무/삼성생명/폰트/삼성긴고딕 Regular.ttf
    - /Users/jyun/Documents/회사업무/삼성생명/폰트/삼성긴고딕 Medium.ttf
    - /Users/jyun/Documents/회사업무/삼성생명/폰트/삼성긴고딕 Bold.ttf
- Titles should feel authoritative and compact.
- Body text should be highly readable and neutral.
- Use weight hierarchy carefully: bold for section headers, medium for labels, regular for supporting text.
- Keep numeric display crisp and aligned for fast scanning.

Core layout:
- Left sidebar navigation with icons and labels
- Dashboard top bar with `기준년월` and `조회기간`
- Archive top bar with title and subtitle only
- Main dashboard area with:
  - KPI summary cards
  - Line chart or trend chart for auto-payment rate and monthly movement
  - Segment change explanation panel
  - Stability status / anomaly status badge
  - Monthly report status area
  - Recent report archive / download table
  - Read-only subscription account list
  - Filter controls for timeframe and month selection
- The layout must support dense operational reading without feeling cluttered

Content and product behavior:
- The dashboard is for monitoring “자동지급” status, monthly change, segment change, and operational efficiency reporting
- Show automatic payment rate, processed volume, stable vs changed status, and month-over-month comparison
- Include explanatory language for change summaries, but keep it concise and operational
- Include a report archive section for generated monthly reports and re-download actions
- Make report file names clickable download links, using the latest version available for each month
- Include a read-only subscription account section sourced from private CSV data
- Make it clear that this is for operational reporting and ROI-style management visibility, not for final approval automation
- Avoid features for claim-type classification or final payment decision automation

Visual system:
- Dark navy top/side shell with a lighter main canvas
- Use blue as the primary data accent, with neutral grays and subtle status colors
- Use pink or coral only sparingly for alerts or negative deviation
- Use clear numeric hierarchy: large KPI values, medium labels, small secondary annotations
- Tables should be crisp, compact, and highly legible
- Charts should be minimal and functional, not decorative
- Status chips should be soft, modern, and easy to scan
- Spacing should be balanced and enterprise-like, with a polished B2B product finish

Interaction cues:
- Filters should look active and practical
- Tables should support sorting and status scanning
- Report items should look downloadable and traceable
- Subscription account rows should feel informational, not editable
- Use subtle hover and focus states
- Make the dashboard feel like a real operations tool that can scale

Style keywords:
enterprise dashboard, metrics console, operations monitoring, B2B SaaS, refined, trustworthy, premium, structured, data-dense, calm, professional, crisp, compact, modern

Important constraints:
- The UI must feel like an internal insurance operations platform
- It should match the existing UI framework of the sibling insurance dashboard, but appear more polished and higher-end
- Do not make it playful, toy-like, overly colorful, or overly marketing-driven
- Do not add unnecessary complexity
- Keep the dashboard realistic and implementable
- The overall impression should be “this is a serious tool used by operations managers”
```
