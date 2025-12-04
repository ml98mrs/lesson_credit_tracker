-- 1) Ensure credit_lot_events_type_check matches dev
--    (harmless to allow duplicate_detected even though we don't currently use it)

ALTER TABLE public.credit_lot_events
  DROP CONSTRAINT IF EXISTS credit_lot_events_type_check;

ALTER TABLE public.credit_lot_events
  ADD CONSTRAINT credit_lot_events_type_check
  CHECK (
    event_type = ANY (
      ARRAY[
        'created'::text,
        'duplicate_detected'::text,
        'settle_overdraft'::text,
        'minutes_adjusted'::text,
        'lot_closed'::text,
        'lot_expired'::text
      ]
    )
  );


-- 2) Drop any old overload of rpc_import_invoice with the legacy signature
--    (uuid,text,integer,integer,date,text,text,length_cat,date,expiry_policy,integer,integer,numeric)

DROP FUNCTION IF EXISTS public.rpc_import_invoice(
  uuid,
  text,
  integer,
  integer,
  date,
  text,
  text,
  length_cat,
  date,
  expiry_policy,
  integer,
  integer,
  numeric
);


-- 3) Canonical rpc_import_invoice used by the app
--    Signature: (uuid,text,integer,date,text,text,text,text,date,integer,integer,numeric,integer)

CREATE OR REPLACE FUNCTION public.rpc_import_invoice(
  p_student_id uuid,
  p_external_ref text,
  p_minutes_granted integer,
  p_start_date date,
  p_delivery_restriction text,
  p_tier_restriction text,
  p_length_restriction text,
  p_expiry_policy text,
  p_expiry_date date,
  p_lessons_per_month integer,
  p_duration_per_lesson_mins integer,
  p_buffer numeric,
  p_amount_pennies integer
)
RETURNS public.credit_lots
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row            public.credit_lots%rowtype;
  v_expiry         date;
  v_months_final   integer;
  v_buf            numeric;
  v_extref         text;               -- raw, trimmed
  v_extref_norm    text;               -- uppercase-trim
  v_delivery       public.delivery;    -- enum cast targets
  v_tier           public.tier;
  v_length         public.length_cat;      -- enum cast target for length_restriction
  v_expiry_policy  public.expiry_policy;   -- enum cast target for expiry_policy
  v_actor          uuid;
BEGIN
  -- Normalise inputs
  v_extref      := btrim(p_external_ref);
  v_extref_norm := upper(v_extref);
  v_actor       := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;

  -- Validation
  IF p_student_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'student_id is required';
  END IF;

  IF coalesce(v_extref, '') = '' THEN
    RAISE EXCEPTION USING MESSAGE = 'external_ref is required (e.g., Xero invoice number)';
  END IF;

  IF p_minutes_granted IS NULL OR p_minutes_granted <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'minutes_granted must be a positive integer';
  END IF;

  IF p_start_date IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'start_date is required';
  END IF;

  IF p_delivery_restriction IS NOT NULL
     AND p_delivery_restriction NOT IN ('online','f2f') THEN
    RAISE EXCEPTION USING MESSAGE = 'delivery_restriction must be online or f2f';
  END IF;

  IF p_tier_restriction IS NOT NULL
     AND p_tier_restriction NOT IN ('basic','premium','elite') THEN
    RAISE EXCEPTION USING MESSAGE = 'tier_restriction must be basic, premium, or elite';
  END IF;

  IF p_length_restriction IS NOT NULL
     AND p_length_restriction NOT IN ('60','90','120','none') THEN
    RAISE EXCEPTION USING MESSAGE = 'length_restriction must be 60, 90, 120, or none';
  END IF;

  IF p_expiry_policy IS NULL
     OR p_expiry_policy NOT IN ('none','mandatory','advisory') THEN
    RAISE EXCEPTION USING MESSAGE = 'expiry_policy must be none, mandatory, or advisory';
  END IF;

  IF p_amount_pennies IS NULL OR p_amount_pennies <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'amount_pennies must be a positive integer (pennies)';
  END IF;

  -- Cast enums
  v_delivery := CASE
                  WHEN p_delivery_restriction IS NULL THEN NULL
                  ELSE p_delivery_restriction::public.delivery
                END;

  v_tier := CASE
              WHEN p_tier_restriction IS NULL THEN NULL
              ELSE p_tier_restriction::public.tier
            END;

  v_length := CASE
                WHEN p_length_restriction IS NULL THEN NULL
                ELSE p_length_restriction::public.length_cat
              END;

  v_expiry_policy := p_expiry_policy::public.expiry_policy;

  -- Expiry calculation (consistent with credit_lots_expiry_guard)
  v_buf := coalesce(p_buffer, 0.5);

  IF p_expiry_policy = 'none' THEN
    v_expiry := NULL;
  ELSE
    IF p_expiry_date IS NOT NULL THEN
      v_expiry := p_expiry_date;

    ELSIF p_lessons_per_month IS NOT NULL
          AND p_duration_per_lesson_mins IS NOT NULL
          AND p_lessons_per_month > 0
          AND p_duration_per_lesson_mins > 0 THEN

      v_months_final :=
        ceil(
          (p_minutes_granted::numeric / p_duration_per_lesson_mins::numeric)
          / p_lessons_per_month::numeric
          * (1 + v_buf)
        )::int;

      IF v_months_final < 1 THEN
        v_months_final := 1;
      END IF;

      v_expiry := (p_start_date + make_interval(months => v_months_final))::date;
    ELSE
      v_expiry := (p_start_date + interval '12 months')::date;
    END IF;
  END IF;

  IF v_expiry IS NOT NULL AND v_expiry < p_start_date THEN
    RAISE EXCEPTION USING MESSAGE = 'expiry_date cannot be before start_date';
  END IF;

  -- Insert invoice lot (idempotent on student+source+external_ref_norm)
  INSERT INTO public.credit_lots (
    id,
    student_id,
    source_type,
    award_reason_code,
    external_ref,
    minutes_granted,
    delivery_restriction,
    tier_restriction,
    length_restriction,
    start_date,
    expiry_policy,
    expiry_date,
    state,
    created_at,
    amount_pennies
  )
  VALUES (
    gen_random_uuid(),
    p_student_id,
    'invoice',
    NULL,
    v_extref,
    p_minutes_granted,
    v_delivery,
    v_tier,
    v_length,
    p_start_date,
    v_expiry_policy,
    v_expiry,
    'open',
    now(),
    p_amount_pennies
  )
  ON CONFLICT ON CONSTRAINT uq_credit_lots_student_source_extrefnorm
  DO NOTHING
  RETURNING * INTO v_row;

  -- Duplicate invoice → raise error so UI shows failure
  IF v_row.id IS NULL THEN
    SELECT *
      INTO v_row
    FROM public.credit_lots
    WHERE student_id = p_student_id
      AND source_type = 'invoice'
      AND external_ref_norm = v_extref_norm;

    RAISE EXCEPTION USING
      MESSAGE = 'Invoice already exists for this student; no new credit added.',
      DETAIL  = format('student_id=%s, external_ref=%s', p_student_id::text, v_extref);
  END IF;

  -- Audit creation of new lot
  INSERT INTO public.credit_lot_events (credit_lot_id, event_type, actor_id, details)
  VALUES (
    v_row.id,
    'created',
    v_actor,
    jsonb_build_object(
      'external_ref', v_extref,
      'external_ref_norm', v_extref_norm,
      'minutes_granted', p_minutes_granted,
      'start_date', p_start_date,
      'expiry_policy', p_expiry_policy,
      'expiry_date', v_expiry,
      'delivery_restriction', p_delivery_restriction,
      'tier_restriction', p_tier_restriction,
      'length_restriction', p_length_restriction,
      'lessons_per_month', p_lessons_per_month,
      'duration_per_lesson_mins', p_duration_per_lesson_mins,
      'buffer', v_buf,
      'amount_pennies', p_amount_pennies
    )
  );

  RETURN v_row;
END;
$$;
