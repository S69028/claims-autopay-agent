# Metrics — 자동심사 현황분석 Agent

> 4단계 `지표 계산 분리`의 기준 문서다.  
> 화면이나 리포트가 아니라, **무슨 입력으로 어떤 숫자를 어떻게 계산하는지**를 고정한다.

## 1) 목적

- 운영모니터링과 월간 리포트에서 쓰는 숫자를 같은 산식으로 계산한다.
- 화면 문구와 리포트 문구가 서로 다른 숫자를 보지 않게 한다.
- 계산 로직을 함수 단위로 분리해 디버깅하기 쉽게 만든다.

## 2) 계산 원칙

- 모든 지표는 `확정된 월말 스냅샷` 기준으로 계산한다.
- 분모와 분자는 문서에 명시한다.
- 비율은 기본적으로 `%` 단위로 표기한다.
- 반올림 규칙은 소수점 2자리로 통일한다.
- 입력이 부족하거나 확정되지 않았으면 `미계산` 또는 `NULL`로 남긴다.
- 숫자 계산과 상태 판정은 분리한다.

## 3) 공통 입력

| 입력 | 의미 | 사용 지표 |
|---|---|---|
| `claim_payment_fact` | 청구 원천 데이터 | 자동지급률, 유형 분석, 제외유형 분석 |
| `monthly_auto_payment_snapshot_fact` | 월말 집계 데이터 | 전월 대비 변화, 처리효율, 상태 문구 |
| `auto_payment_type_definition` | 자동지급유형 정의 | 유형 분석 |
| `auto_payment_exclusion_type_definition` | 자동지급제외유형 정의 | 제외유형 분석 |
| `claim_payment_fact.segment_*` | segment 변경 정보 | segment 변화 설명 |

## 4) 지표 정의

### 4-1. 자동지급률

**정의**
- 자동지급 대상군 중 자동지급 처리된 비율

**공식**
- `자동지급률 = (자동지급 건수 / 자동지급 대상군 건수) * 100`

**입력**
- 분자: `auto_payment_count`
- 분모: `auto_payment_candidate_count`

**예외 규칙**
- 분모가 0이면 `NULL`
- 소수점 2자리로 반올림

### 4-2. 전월 대비 변화

**정의**
- 해당 월 지표와 전월 지표의 차이

**공식**
- `증감값 = 당월값 - 전월값`
- `증감률 = ((당월값 - 전월값) / 전월값) * 100`

**입력**
- 전월/당월 `자동지급률`
- 전월/당월 `처리효율`

**예외 규칙**
- 전월값이 0이면 증감률은 `NULL`
- 전월 데이터가 없으면 계산하지 않음

### 4-3. segment 변화

**정의**
- 월말 스냅샷 기준으로 segment가 이전 월과 비교해 어떻게 바뀌었는지 나타내는 값

**공식**
- `segment_change_flag = (segment_before != segment_after)`
- `segment_change_summary = 변경 전 segment + 변경 후 segment + 변화 사유`

**입력**
- `claim_payment_fact.segment_before`
- `claim_payment_fact.segment_after`
- `claim_payment_fact.segment_change_reason`

**예외 규칙**
- 변경 전/후 값이 없으면 `확인 필요`
- 변경 사유가 없으면 설명은 생성하되 `원인 확인 필요`로 표기

### 4-4. 처리효율

**정의**
- 운영효율을 보여주는 ROI 보고용 지표

**공식**
- 우선 기본형은 `처리효율 = (자동지급 건수 / 총 청구 건수) * 100`
- 필요 시 비용환산형은 별도 보조지표로 확장 가능

**입력**
- `auto_payment_count`
- `total_claim_count`

**예외 규칙**
- 총 청구 건수가 0이면 `NULL`
- 비용환산형을 추가할 때는 별도 컬럼과 산식을 문서에 확정한다

### 4-5. 자동지급 건수 비중

**정의**
- 전체 청구 중 자동지급 건수가 차지하는 비율

**공식**
- `자동지급 비중 = (자동지급 건수 / 총 청구 건수) * 100`

**입력**
- `auto_payment_count`
- `total_claim_count`

**예외 규칙**
- 총 청구 건수가 0이면 `NULL`

## 5) 분석 보조 지표

### 접수채널별 자동지급 비율
- `접수채널별 자동지급 비율 = 각 채널의 자동지급 건수 / 각 채널 전체 청구 건수 * 100`

### 진료구분별 자동지급 비율
- `진료구분별 자동지급 비율 = 각 진료구분의 자동지급 건수 / 각 진료구분 전체 청구 건수 * 100`

### 상위 5개 유형 비중
- `유형별 비중 = 특정 자동지급유형 건수 / 전체 자동지급 건수 * 100`

### 제외유형별 비중
- `제외유형별 비중 = 특정 제외유형 건수 / 전체 제외건수 * 100`

## 6) 함수 분리 기준

- `calcAutoPaymentRate(snapshot)`  
- `calcDelta(current, previous)`  
- `calcSegmentChange(before, after, reason)`  
- `calcProcessingEfficiency(snapshot, config)`  
- `calcChangeThreshold(history6m, fallback, minCap)`  
- `calcTypeShare(facts, typeCode)`  
- `calcExclusionShare(facts, exclusionCode)`  

## 7) 상태 판정 연계

- 상태 판정 임계치는 `docs/status.md`의 규칙을 따른다.
- 기본 계산식은 `임계치 = max(직전 6개월 변화량 표준편차, 0.5pp)`이다.
- 기준월 이전 6개월 데이터가 부족하면 `0.5pp`가 아니라 `1.0pp`를 fallback으로 쓴다.
- `calcChangeThreshold`는 변화량 시계열을 입력받아 최종 임계치를 돌려준다.

## 8) 코드화 전 체크포인트

- 입력 컬럼명과 산식이 일치하는가
- 분모 0 처리 방식이 통일되었는가
- 반올림 자리가 같은가
- 전월이 없는 첫 달 처리 방식이 정해졌는가
- 화면과 리포트가 같은 숫자를 쓰는가
