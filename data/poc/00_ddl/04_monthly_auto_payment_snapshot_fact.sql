CREATE TABLE IF NOT EXISTS monthly_auto_payment_snapshot_fact (
  snapshot_month CHAR(7) PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  data_frozen_flag CHAR(1) NOT NULL DEFAULT 'Y',

  total_claim_count INT NOT NULL,
  auto_payment_candidate_count INT NOT NULL,
  auto_payment_count INT NOT NULL,
  exclusion_count INT NOT NULL,
  manual_review_count INT NOT NULL,

  auto_payment_rate DECIMAL(5,2) NOT NULL,
  prev_month_auto_payment_rate DECIMAL(5,2) NULL,
  auto_payment_rate_change DECIMAL(5,2) NULL,

  processing_efficiency DECIMAL(5,2) NOT NULL,
  prev_month_processing_efficiency DECIMAL(5,2) NULL,
  processing_efficiency_change DECIMAL(5,2) NULL,

  stable_flag CHAR(1) NOT NULL DEFAULT 'N',
  status_label VARCHAR(20) NOT NULL,

  segment_change_summary TEXT NULL,

  report_generated_flag CHAR(1) NOT NULL DEFAULT 'N',
  report_sent_flag CHAR(1) NOT NULL DEFAULT 'N',
  report_archive_id VARCHAR(50) NULL,

  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_monthly_snapshot_data_frozen_flag
    CHECK (data_frozen_flag IN ('Y', 'N')),
  CONSTRAINT chk_monthly_snapshot_stable_flag
    CHECK (stable_flag IN ('Y', 'N')),
  CONSTRAINT chk_monthly_snapshot_report_generated_flag
    CHECK (report_generated_flag IN ('Y', 'N')),
  CONSTRAINT chk_monthly_snapshot_report_sent_flag
    CHECK (report_sent_flag IN ('Y', 'N')),
  CONSTRAINT chk_monthly_snapshot_status_label
    CHECK (status_label IN ('안정', '변화', '미확정')),
  CONSTRAINT chk_monthly_snapshot_rates
    CHECK (
      auto_payment_rate >= 0 AND auto_payment_rate <= 100
      AND processing_efficiency >= 0 AND processing_efficiency <= 100
    )
);

CREATE INDEX IF NOT EXISTS idx_monthly_auto_payment_snapshot_fact_status_label
  ON monthly_auto_payment_snapshot_fact (status_label);

CREATE INDEX IF NOT EXISTS idx_monthly_auto_payment_snapshot_fact_report_sent_flag
  ON monthly_auto_payment_snapshot_fact (report_sent_flag);
