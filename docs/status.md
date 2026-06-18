# Status — 자동심사 현황분석 Agent

> 5단계 `상태 판정 분리`의 기준 문서다.  
> 숫자 계산 결과를 보고 `안정 / 변화 / 미확정` 상태를 어떻게 정할지 고정한다.

## 1) 목적

- 운영관리자와 월간 리포트가 같은 상태 라벨을 보게 한다.
- 숫자 계산과 상태 판정을 분리해 유지보수를 쉽게 한다.
- 상태가 바뀌는 이유를 설명 가능하게 만든다.

## 2) 상태 라벨

### `안정`
- 전월 대비 변화가 없거나 허용 범위 내인 상태

### `변화`
- 전월 대비 유의미한 변동이 있는 상태

### `미확정`
- 해당 월의 월말 스냅샷이 아직 확정되지 않은 상태
- 또는 전월 비교가 불가능한 상태

## 3) 판정 우선순위

1. 월말 스냅샷이 확정되었는지 확인한다.
2. 전월 비교가 가능한지 확인한다.
3. 자동지급률 전월차의 임계치를 계산한다.
4. 최종 상태를 결정한다.

## 4) 기본 판정 규칙

### 4-1. `미확정`

아래 중 하나면 `미확정`이다.
- 당월 스냅샷이 확정되지 않음
- 전월 스냅샷이 없어 비교 불가
- 필수 입력이 누락됨

### 4-2. `변화`

아래 중 하나면 `변화`다.
- 자동지급률 전월차 절대값이 기준치 초과

### 4-3. `안정`

- 위 조건에 해당하지 않으면 `안정`으로 본다.

## 5) 기본 임계치

| 항목 | 기본값 | 설명 |
|---|---|---|
| 자동지급률 변화 임계치 | `max(2.0 × 직전 최대 6개월 표준편차, 1.0pp)` | 기준월 이전 최대 6개월의 자동지급률 전월차 표준편차를 쓰되, 최소 1.0pp를 보장한다 |
| fallback 임계치 | 3.0pp | 전월차 이력이 3개월 미만일 때 사용한다 |

- 기본 임계치는 운영 중 조정 가능하다.
- 임계치를 바꿀 때는 `docs/progress.md`와 `docs/metrics.md`의 기준도 함께 확인한다.
- 3개월 미만의 전월차 이력은 동적 임계치 대신 fallback을 쓴다.

## 6) 입력값

| 입력 | 출처 | 용도 |
|---|---|---|
| `auto_payment_rate_change` | `monthly_auto_payment_snapshot_fact` | 상태 변동 판단 |
| `snapshot_date` | `monthly_auto_payment_snapshot_fact` | 확정 여부 확인 |
| `prev_month_auto_payment_rate` | `monthly_auto_payment_snapshot_fact` | 전월 비교 가능 여부 |
| `auto_payment_rate_change_history_6m` | `monthly_auto_payment_snapshot_fact` | 자동지급률 임계치 산정 |

## 7) 판정 함수 분리 기준

- `isConfirmedMonth(snapshot)`  
- `hasComparablePreviousMonth(snapshot)`  
- `calcRollingStdDev(history6m)`  
- `calcChangeThreshold(history6m, k, floor, fallback)`  
- `detectChange(statusInputs, threshold)`  
- `classifyStatus(snapshot, threshold)`  

## 8) 예외 규칙

- 상태를 판단할 수 없으면 `미확정`으로 둔다.
- 숫자는 있어도 전월 비교가 없으면 `미확정`으로 둔다.
- 상태가 애매하면 `안정`보다 `미확정`을 우선한다.
- 전월차 이력이 3개월 미만이면 임계치는 3.0pp를 사용한다.
- 운영자가 임계치를 바꾸면 판정 결과도 함께 재검토한다.

## 9) 코드화 전 체크포인트

- `미확정`이 먼저 걸러지는가
- 전월 비교 불가 시 상태가 흔들리지 않는가
- 기본 임계치가 문서와 코드에서 동일한가
- 화면과 리포트가 같은 상태 라벨을 쓰는가

## 10) 판정 의사코드

```text
function classifyStatus(snapshot, previousSnapshot, history6m, thresholds):
    if snapshot is not confirmed:
        return "미확정"

    if previousSnapshot is missing:
        return "미확정"

    if required inputs are missing:
        return "미확정"

    rateThreshold = calcChangeThreshold(history6m.auto_payment_rate_changes, 2.0, 1.0pp, 3.0pp)

    if abs(auto_payment_rate_change) > rateThreshold:
        return "변화"

    return "안정"
```

## 11) 테스트 케이스 초안

| # | 시나리오 | 입력 요약 | 기대 상태 |
|---|---|---|---|
| 1 | 확정월 + 전월 비교 가능 + 변화 없음 | 스냅샷 확정, 전월 존재, 변화량이 임계치 미만 | `안정` |
| 2 | 확정월 + 자동지급률 급변 | 스냅샷 확정, 전월 존재, 자동지급률 변화량이 임계치 초과 | `변화` |
| 3 | 월말 스냅샷 미확정 | 당월 스냅샷 미확정 | `미확정` |
| 4 | 전월 데이터 없음 | 당월은 확정되었지만 전월 스냅샷 없음 | `미확정` |
| 5 | 6개월 히스토리 부족 | 확정월이지만 6개월 변화량 이력 부족, 변화량이 3.0pp 이하 | `안정` |
| 6 | 6개월 히스토리 부족 + 급변 | 확정월이지만 6개월 변화량 이력 부족, 변화량이 3.0pp 초과 | `변화` |
| 7 | 필수 입력 누락 | 비교에 필요한 입력 일부 누락 | `미확정` |
