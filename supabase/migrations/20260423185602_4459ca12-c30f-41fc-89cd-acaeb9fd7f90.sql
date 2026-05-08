-- Update handle_new_user to auto-assign 'business' plan to admin email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin BOOLEAN;
  v_plan public.plan_tier;
BEGIN
  v_is_admin := lower(NEW.email) = 'graciochiziane@gmail.com';
  v_plan := CASE WHEN v_is_admin THEN 'business'::public.plan_tier ELSE 'free'::public.plan_tier END;

  INSERT INTO public.profiles (id, email, nome, plano)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nome', ''), v_plan);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN v_is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.subscriptions (user_id, plano, status, provider)
  VALUES (NEW.id, v_plan, 'active', 'manual');

  RETURN NEW;
END;
$function$;

-- Backfill: if admin user already exists, ensure role + business plan
DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = 'graciochiziane@gmail.com' LIMIT 1;
  IF v_uid IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_uid, 'admin'::public.app_role)
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles SET plano = 'business'::public.plan_tier WHERE id = v_uid;
    UPDATE public.subscriptions SET plano = 'business'::public.plan_tier WHERE user_id = v_uid;
  END IF;
END $$;