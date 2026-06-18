from __future__ import annotations

import unittest

from scripts.monthly_snapshot_metrics import (
    calcAutoPaymentRate,
    calcChangeThreshold,
    calcProcessingEfficiency,
    classifySnapshotStatus,
)


class MonthlySnapshotMetricsTest(unittest.TestCase):
    def test_calc_auto_payment_rate_uses_total_claim_count(self) -> None:
        snapshot = {"total_claim_count": 200, "auto_payment_count": 50}

        self.assertEqual(calcAutoPaymentRate(snapshot), 25.0)

    def test_calc_processing_efficiency_uses_auto_plus_exclusion_over_total(self) -> None:
        snapshot = {"total_claim_count": 200, "auto_payment_count": 50, "exclusion_count": 30}

        self.assertEqual(calcProcessingEfficiency(snapshot), 40.0)

    def test_calc_change_threshold_uses_dynamic_k_and_fallback(self) -> None:
        self.assertEqual(calcChangeThreshold([0.2, 0.4]), 3.0)
        self.assertAlmostEqual(calcChangeThreshold([0.5, 0.7, 0.9], k=2.0, floor=1.0, fallback=3.0), 1.0)

    def test_classify_snapshot_status_marks_first_month_as_unconfirmed(self) -> None:
        snapshot = {"data_frozen_flag": "Y", "auto_payment_rate_change": "0.80"}

        self.assertEqual(classifySnapshotStatus(snapshot, [], has_previous=False), ("N", "미확정", None))
