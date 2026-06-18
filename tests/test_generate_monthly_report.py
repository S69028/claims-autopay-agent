from __future__ import annotations

import unittest

from scripts.generate_monthly_report import build_context, confirmed_snapshot, normalize_supabase_base_url


def make_snapshot(month: str, *, status_label: str = "안정", frozen: str = "Y"):
    return {
        "snapshot_month": month,
        "data_frozen_flag": frozen,
        "auto_payment_rate": "72.10",
        "processing_efficiency": "63.40",
        "auto_payment_rate_change": "0.90",
        "processing_efficiency_change": "1.10",
        "status_label": status_label,
    }


class GenerateMonthlyReportTest(unittest.TestCase):
    def setUp(self) -> None:
        self.snapshots = [
            make_snapshot("2025-11", status_label="안정"),
            make_snapshot("2025-12", status_label="변화"),
        ]
        self.current_claims = [
            {
                "receipt_channel": "대면",
                "treatment_type": "통원",
                "auto_payment_decision": "AUTO_PAY",
                "auto_payment_type_code": "A01",
                "segment_before": "SEG-A",
                "segment_after": "SEG-C",
                "segment_change_flag": "Y",
                "segment_change_reason": "표준 심사 세그먼트 조정",
            },
            {
                "receipt_channel": "대면",
                "treatment_type": "통원",
                "auto_payment_decision": "AUTO_PAY",
                "auto_payment_type_code": "A01",
                "segment_before": "SEG-A",
                "segment_after": "SEG-C",
                "segment_change_flag": "N",
                "segment_change_reason": "",
            },
            {
                "receipt_channel": "비대면",
                "treatment_type": "입원",
                "auto_payment_decision": "MANUAL_REVIEW",
                "auto_payment_type_code": "",
                "segment_before": "SEG-B",
                "segment_after": "SEG-B",
                "segment_change_flag": "N",
                "segment_change_reason": "",
            },
            {
                "receipt_channel": "실손24",
                "treatment_type": "통원",
                "auto_payment_decision": "EXCLUDE",
                "auto_payment_type_code": "",
                "segment_before": "SEG-D",
                "segment_after": "SEG-C",
                "segment_change_flag": "N",
                "segment_change_reason": "",
            },
        ]
        self.previous_claims = [
            {
                "receipt_channel": "대면",
                "treatment_type": "통원",
                "auto_payment_decision": "AUTO_PAY",
                "auto_payment_type_code": "A01",
                "segment_before": "SEG-A",
                "segment_after": "SEG-C",
                "segment_change_flag": "Y",
                "segment_change_reason": "표준 심사 세그먼트 조정",
            },
            {
                "receipt_channel": "비대면",
                "treatment_type": "입원",
                "auto_payment_decision": "AUTO_PAY",
                "auto_payment_type_code": "A02",
                "segment_before": "SEG-B",
                "segment_after": "SEG-A",
                "segment_change_flag": "N",
                "segment_change_reason": "",
            },
            {
                "receipt_channel": "실손24",
                "treatment_type": "통원",
                "auto_payment_decision": "MANUAL_REVIEW",
                "auto_payment_type_code": "",
                "segment_before": "SEG-D",
                "segment_after": "SEG-D",
                "segment_change_flag": "N",
                "segment_change_reason": "",
            },
        ]
        self.auto_types = [{"type_code": "A01", "type_name": "비대면 소액 통원"}]
        self.exclusion_types = [{"type_code": "E01", "type_name": "소액 제외"}]

    def test_confirmed_snapshot_uses_requested_month(self) -> None:
        latest, previous = confirmed_snapshot(self.snapshots, "2025-12")

        self.assertEqual(latest["snapshot_month"], "2025-12")
        self.assertEqual(previous["snapshot_month"], "2025-11")

    def test_normalize_supabase_base_url_strips_rest_v1_suffix(self) -> None:
        self.assertEqual(
            normalize_supabase_base_url("https://example.supabase.co/rest/v1/"),
            "https://example.supabase.co",
        )

    def test_build_context_keeps_core_calculations_and_status_note(self) -> None:
        ctx = build_context(
            self.snapshots,
            self.current_claims,
            self.previous_claims,
            self.auto_types,
            self.exclusion_types,
            "2025-12",
        )

        self.assertEqual(ctx["current_auto_count"], 2)
        self.assertEqual(ctx["current_manual_count"], 1)
        self.assertEqual(ctx["current_excluded_count"], 1)
        self.assertEqual(ctx["total_claims"], 4)

        self.assertEqual(ctx["channel_rows"][0]["channel"], "대면")
        self.assertEqual(ctx["channel_rows"][0]["total"], 2)
        self.assertEqual(ctx["channel_rows"][0]["prev_total"], 1)
        self.assertEqual(ctx["channel_rows"][0]["share"], 100.0)
        self.assertEqual(ctx["channel_rows"][0]["prev_share"], 100.0)

        self.assertEqual(ctx["treatment_rows"][0]["treatment"], "통원")
        self.assertEqual(ctx["treatment_rows"][0]["count"], 2)
        self.assertEqual(ctx["treatment_rows"][0]["share"], 100.0)
        self.assertEqual(ctx["treatment_rows"][0]["prev_share"], 50.0)
        self.assertEqual(ctx["treatment_rows"][0]["delta_share"], 50.0)

        self.assertEqual(ctx["auto_type_rows"][0]["code"], "A01")
        self.assertEqual(ctx["auto_type_rows"][0]["count"], 2)
        self.assertEqual(ctx["auto_type_rows"][0]["prev_count"], 1)
        self.assertEqual(ctx["auto_type_rows"][0]["delta_count"], 1)
        self.assertEqual(ctx["auto_type_rows"][0]["delta_pct"], 100.0)

        self.assertEqual(ctx["segment_rows"][0]["before"], "SEG-A")
        self.assertEqual(ctx["segment_rows"][0]["after"], "SEG-C")
        self.assertEqual(ctx["segment_rows"][0]["reason"], "표준 심사 세그먼트 조정")
        self.assertEqual(ctx["segment_rows"][0]["share"], 25.0)
        self.assertEqual(ctx["factor_note"], "전월 대비 자동지급률을 변화시킨 청구 특성 요소를 점검합니다.")
        self.assertGreaterEqual(len(ctx["factor_rows"]), 1)
        self.assertEqual(ctx["factor_rows"][0]["factor"], "접수채널")

        self.assertEqual(
            ctx["status_note"],
            "이번 월은 청구 특성 또는 비율 변화가 커서 운영 해석을 함께 확인할 필요가 있습니다.",
        )


if __name__ == "__main__":
    unittest.main()
