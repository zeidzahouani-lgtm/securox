CREATE TYPE public.app_role AS ENUM ('admin','scanner','client');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Own roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles readable" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.events
  ADD COLUMN client_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN invite_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(12),'hex');

ALTER TABLE public.attendees
  ADD COLUMN first_name text,
  ADD COLUMN last_name text;

CREATE TABLE public.event_scanners (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.event_scanners TO authenticated;
GRANT ALL ON public.event_scanners TO service_role;
ALTER TABLE public.event_scanners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages assignments" ON public.event_scanners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Scanner sees own assignments" ON public.event_scanners FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_event_scanner(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_scanners WHERE event_id = _event_id AND user_id = _user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_event_client(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND client_id = _user_id)
$$;

-- Replace open policies
DROP POLICY IF EXISTS "Public can manage events" ON public.events;
DROP POLICY IF EXISTS "Public can manage attendees" ON public.attendees;
REVOKE ALL ON public.events FROM anon;
REVOKE ALL ON public.attendees FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendees TO authenticated;
GRANT ALL ON public.events TO service_role;
GRANT ALL ON public.attendees TO service_role;

CREATE POLICY "Admin manages events" ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Client reads own events" ON public.events FOR SELECT TO authenticated
  USING (client_id = auth.uid());
CREATE POLICY "Scanner reads assigned events" ON public.events FOR SELECT TO authenticated
  USING (public.is_event_scanner(id, auth.uid()));

CREATE POLICY "Admin manages attendees" ON public.attendees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Client manages own attendees" ON public.attendees FOR ALL TO authenticated
  USING (public.is_event_client(event_id, auth.uid()))
  WITH CHECK (public.is_event_client(event_id, auth.uid()));
CREATE POLICY "Scanner reads assigned attendees" ON public.attendees FOR SELECT TO authenticated
  USING (public.is_event_scanner(event_id, auth.uid()));

-- Ticket quota trigger
CREATE OR REPLACE FUNCTION public.enforce_ticket_quota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap int; n int;
BEGIN
  SELECT max_capacity INTO cap FROM public.events WHERE id = NEW.event_id FOR UPDATE;
  SELECT count(*) INTO n FROM public.attendees WHERE event_id = NEW.event_id;
  IF n >= cap THEN
    RAISE EXCEPTION 'Nombre maximum de QR codes atteint (%)', cap;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendees_quota BEFORE INSERT ON public.attendees
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ticket_quota();

-- Role bootstrap: first user = admin, others = client
CREATE OR REPLACE FUNCTION public.ensure_my_role()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); r text; em text;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO em FROM auth.users WHERE id = uid;
  INSERT INTO public.profiles (id, email) VALUES (uid, em) ON CONFLICT (id) DO NOTHING;
  SELECT role::text INTO r FROM public.user_roles WHERE user_id = uid
    ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'scanner' THEN 2 ELSE 3 END LIMIT 1;
  IF r IS NOT NULL THEN RETURN r; END IF;
  PERFORM pg_advisory_xact_lock(4242);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin'); RETURN 'admin';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'client'); RETURN 'client';
END $$;
REVOKE EXECUTE ON FUNCTION public.ensure_my_role() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_my_role() TO authenticated;

-- Client claims an event from an invite link
CREATE OR REPLACE FUNCTION public.claim_event(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.events%ROWTYPE; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Non connecté'; END IF;
  SELECT * INTO e FROM public.events WHERE invite_token = _token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lien invalide'; END IF;
  IF e.client_id IS NOT NULL AND e.client_id <> uid THEN
    RAISE EXCEPTION 'Cet événement est déjà attribué à un autre client';
  END IF;
  UPDATE public.events SET client_id = uid WHERE id = e.id;
  RETURN e.id;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_event(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_event(text) TO authenticated;

-- Secure check-in
CREATE OR REPLACE FUNCTION public.check_in_ticket(_ticket_code text, _event_id uuid, _force boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE a public.attendees%ROWTYPE; e public.events%ROWTYPE;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.is_event_scanner(_event_id, auth.uid())) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','no_event'); END IF;
  SELECT * INTO a FROM public.attendees WHERE ticket_code = _ticket_code AND event_id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','invalid'); END IF;
  IF a.status <> 'Pending' THEN
    RETURN jsonb_build_object('result','already','guest_name',a.guest_name,'ticket_code',a.ticket_code);
  END IF;
  IF e.current_count >= e.max_capacity AND NOT _force THEN
    RETURN jsonb_build_object('result','over_capacity','guest_name',a.guest_name,'ticket_code',a.ticket_code,
      'current_count',e.current_count,'max_capacity',e.max_capacity);
  END IF;
  UPDATE public.attendees SET status = CASE WHEN e.current_count >= e.max_capacity THEN 'Over-limit' ELSE 'Checked-in' END,
    checked_in_at = now() WHERE id = a.id;
  UPDATE public.events SET current_count = current_count + 1 WHERE id = e.id;
  RETURN jsonb_build_object('result', CASE WHEN e.current_count >= e.max_capacity THEN 'granted_over' ELSE 'granted' END,
    'guest_name',a.guest_name,'ticket_code',a.ticket_code,'current_count',e.current_count + 1,'max_capacity',e.max_capacity);
END; $function$;
REVOKE EXECUTE ON FUNCTION public.check_in_ticket(text, uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(text, uuid, boolean) TO authenticated;