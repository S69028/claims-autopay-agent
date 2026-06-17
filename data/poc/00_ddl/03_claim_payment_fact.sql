CREATE TABLE IF NOT EXISTS claim_payment_fact (
  claim_id VARCHAR(20) PRIMARY KEY,
  receipt_no VARCHAR(20) NOT NULL,
  customer_id VARCHAR(20) NOT NULL,
  contract_no VARCHAR(30) NOT NULL,

  claim_month CHAR(7) NOT NULL,
  snapshot_month CHAR(7) NOT NULL,
  snapshot_date DATE NOT NULL,
  receipt_date DATE NOT NULL,
  receipt_channel VARCHAR(20) NOT NULL,

  treatment_type VARCHAR(10) NOT NULL,
  hospital_name VARCHAR(100) NOT NULL,
  hospital_code VARCHAR(20) NOT NULL,
  hospital_type VARCHAR(20) NOT NULL,
  diagnosis_code_primary VARCHAR(20) NOT NULL,
  diagnosis_code_secondary VARCHAR(100) NULL,

  benefit_covered_sum NUMERIC(14,0) NOT NULL,
  benefit_noncovered_sum NUMERIC(14,0) NOT NULL,
  benefit_noncovered_certification_amount NUMERIC(14,0) NOT NULL,
  benefit_noncovered_injection_amount NUMERIC(14,0) NOT NULL,
  total_medical_amount NUMERIC(14,0) NOT NULL,
  noncovered_ratio DECIMAL(5,2) NOT NULL,
  deducted_amount NUMERIC(14,0) NOT NULL,
  paid_amount NUMERIC(14,0) NOT NULL,

  burden_exclusion_flag CHAR(1) NOT NULL,
  other_insurance_flag CHAR(1) NOT NULL,
  field_investigation_flag CHAR(1) NOT NULL,
  contract_status VARCHAR(20) NOT NULL,
  recent_12m_claim_count INT NOT NULL,
  in_exemption_period_flag CHAR(1) NOT NULL,
  length_of_stay_days INT NOT NULL,
  no_secondary_diagnosis_flag CHAR(1) NOT NULL,

  auto_payment_candidate_flag CHAR(1) NOT NULL,
  auto_payment_decision VARCHAR(20) NOT NULL,
  auto_payment_type_code VARCHAR(10) NULL,
  auto_payment_exclusion_code VARCHAR(10) NULL,
  processing_status VARCHAR(20) NOT NULL,
  rule_version VARCHAR(20) NOT NULL,
  confidence_score DECIMAL(5,2) NOT NULL,

  segment_code VARCHAR(20) NOT NULL,
  segment_name VARCHAR(50) NOT NULL,
  segment_before VARCHAR(20) NULL,
  segment_after VARCHAR(20) NULL,
  segment_change_flag CHAR(1) NOT NULL,
  segment_change_reason TEXT NULL,

  batch_id VARCHAR(30) NOT NULL,
  source_system VARCHAR(50) NOT NULL,
  ingested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_claim_payment_burden_exclusion_flag
    CHECK (burden_exclusion_flag IN ('Y', 'N')),
  CONSTRAINT chk_claim_payment_other_insurance_flag
    CHECK (other_insurance_flag IN ('Y', 'N')),
  CONSTRAINT chk_claim_payment_field_investigation_flag
    CHECK (field_investigation_flag IN ('Y', 'N')),
  CONSTRAINT chk_claim_payment_in_exemption_period_flag
    CHECK (in_exemption_period_flag IN ('Y', 'N')),
  CONSTRAINT chk_claim_payment_no_secondary_diagnosis_flag
    CHECK (no_secondary_diagnosis_flag IN ('Y', 'N')),
  CONSTRAINT chk_claim_payment_auto_payment_candidate_flag
    CHECK (auto_payment_candidate_flag IN ('Y', 'N')),
  CONSTRAINT chk_claim_payment_segment_change_flag
    CHECK (segment_change_flag IN ('Y', 'N')),
  CONSTRAINT chk_claim_payment_auto_payment_decision
    CHECK (auto_payment_decision IN ('AUTO_PAY', 'EXCLUDE', 'MANUAL_REVIEW')),
  CONSTRAINT chk_claim_payment_processing_status
    CHECK (processing_status IN ('지급', '부지급', '인심사대기')),
  CONSTRAINT chk_claim_payment_noncovered_ratio
    CHECK (noncovered_ratio >= 0 AND noncovered_ratio <= 1),
  CONSTRAINT chk_claim_payment_confidence_score
    CHECK (confidence_score >= 0 AND confidence_score <= 1),

  CONSTRAINT fk_claim_payment_auto_type
    FOREIGN KEY (auto_payment_type_code)
    REFERENCES auto_payment_type_definition (type_code),
  CONSTRAINT fk_claim_payment_exclusion_type
    FOREIGN KEY (auto_payment_exclusion_code)
    REFERENCES auto_payment_exclusion_type_definition (type_code)
);

CREATE INDEX IF NOT EXISTS idx_claim_payment_fact_claim_month
  ON claim_payment_fact (claim_month);

CREATE INDEX IF NOT EXISTS idx_claim_payment_fact_snapshot_month
  ON claim_payment_fact (snapshot_month);

CREATE INDEX IF NOT EXISTS idx_claim_payment_fact_auto_payment_decision
  ON claim_payment_fact (auto_payment_decision);

CREATE INDEX IF NOT EXISTS idx_claim_payment_fact_auto_payment_type_code
  ON claim_payment_fact (auto_payment_type_code);

CREATE INDEX IF NOT EXISTS idx_claim_payment_fact_auto_payment_exclusion_code
  ON claim_payment_fact (auto_payment_exclusion_code);

CREATE INDEX IF NOT EXISTS idx_claim_payment_fact_segment_code
  ON claim_payment_fact (segment_code);
