CREATE TABLE IF NOT EXISTS auto_payment_type_definition (
  rule_def_id BIGSERIAL PRIMARY KEY,
  type_code VARCHAR(10) NOT NULL UNIQUE,
  type_group VARCHAR(20) NOT NULL DEFAULT '자동지급',
  type_name VARCHAR(100) NOT NULL,
  natural_language_condition TEXT NOT NULL,
  rule_expression TEXT NOT NULL,
  reason_text TEXT NOT NULL,
  priority_order INT NOT NULL,
  reference_columns TEXT NOT NULL,
  active_flag CHAR(1) NOT NULL DEFAULT 'Y',
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  version_no INT NOT NULL DEFAULT 1,
  explanation_template TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_auto_payment_type_active_flag
    CHECK (active_flag IN ('Y', 'N'))
);

CREATE INDEX IF NOT EXISTS idx_auto_payment_type_definition_type_code
  ON auto_payment_type_definition (type_code);

CREATE INDEX IF NOT EXISTS idx_auto_payment_type_definition_active_flag
  ON auto_payment_type_definition (active_flag);
