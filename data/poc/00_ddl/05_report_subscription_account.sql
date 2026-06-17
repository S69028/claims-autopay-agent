CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.mask_email(input_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
  prefix_len INT;
  suffix_len INT;
  mask_len INT;
BEGIN
  IF input_email IS NULL THEN
    RETURN NULL;
  END IF;

  local_part := split_part(input_email, '@', 1);
  domain_part := split_part(input_email, '@', 2);

  IF domain_part = '' THEN
    RETURN input_email;
  END IF;

  IF length(local_part) <= 6 THEN
    prefix_len := GREATEST(length(local_part) - 2, 1);
    suffix_len := LEAST(2, GREATEST(length(local_part) - prefix_len, 0));
    mask_len := GREATEST(length(local_part) - prefix_len - suffix_len, 4);
  ELSE
    prefix_len := 4;
    suffix_len := 2;
    mask_len := GREATEST(length(local_part) - prefix_len - suffix_len, 4);
  END IF;

  RETURN left(local_part, prefix_len) || repeat('*', mask_len) || right(local_part, suffix_len) || '@' || domain_part;
END;
$$;

CREATE TABLE IF NOT EXISTS private.report_subscription_account (
  subscription_id BIGSERIAL PRIMARY KEY,
  recipient_name VARCHAR(100) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL UNIQUE,
  department VARCHAR(100) NULL,
  active_flag CHAR(1) NOT NULL DEFAULT 'Y',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_report_subscription_account_active_flag
    CHECK (active_flag IN ('Y', 'N'))
);

CREATE TABLE IF NOT EXISTS public.report_subscription_account_public (
  subscription_id BIGINT PRIMARY KEY,
  recipient_name VARCHAR(100) NOT NULL,
  masked_email VARCHAR(255) NOT NULL,
  department VARCHAR(100) NULL,
  active_flag CHAR(1) NOT NULL DEFAULT 'Y',
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  CONSTRAINT chk_report_subscription_account_public_active_flag
    CHECK (active_flag IN ('Y', 'N'))
);

CREATE INDEX IF NOT EXISTS idx_report_subscription_account_active_flag
  ON private.report_subscription_account (active_flag);

CREATE INDEX IF NOT EXISTS idx_report_subscription_account_public_active_flag
  ON public.report_subscription_account_public (active_flag);

ALTER TABLE private.report_subscription_account ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_subscription_account_public ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS report_subscription_account_public_read ON public.report_subscription_account_public;
CREATE POLICY report_subscription_account_public_read
ON public.report_subscription_account_public
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON public.report_subscription_account_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.sync_report_subscription_account_public()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.report_subscription_account_public
    WHERE subscription_id = OLD.subscription_id;
    RETURN OLD;
  END IF;

  INSERT INTO public.report_subscription_account_public (
    subscription_id,
    recipient_name,
    masked_email,
    department,
    active_flag,
    created_at,
    updated_at
  )
  VALUES (
    NEW.subscription_id,
    NEW.recipient_name,
    private.mask_email(NEW.recipient_email),
    NEW.department,
    NEW.active_flag,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (subscription_id) DO UPDATE
    SET recipient_name = EXCLUDED.recipient_name,
        masked_email = EXCLUDED.masked_email,
        department = EXCLUDED.department,
        active_flag = EXCLUDED.active_flag,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_report_subscription_account_public ON private.report_subscription_account;
CREATE TRIGGER trg_sync_report_subscription_account_public
AFTER INSERT OR UPDATE OR DELETE ON private.report_subscription_account
FOR EACH ROW
EXECUTE FUNCTION private.sync_report_subscription_account_public();
