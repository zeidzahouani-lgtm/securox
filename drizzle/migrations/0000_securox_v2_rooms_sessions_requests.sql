ALTER TABLE public.events ADD COLUMN IF NOT EXISTS room text;
ALTER TABLE public.attendees ADD COLUMN IF NOT EXISTS email text, ADD COLUMN IF NOT EXISTS phone text;

CREATE TABLE public.event_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_sessions TO authenticated;
GRANT ALL ON public.event_sessions TO service_role;
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages sessions" ON public.event_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Scanner reads sessions" ON public.event_sessions FOR SELECT TO authenticated
  USING (public.is_event_scanner(event_id, auth.uid()));

CREATE TABLE public.passages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.event_sessions(id) ON DELETE SET NULL,
  agent text,
  scanned_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX passages_once_per_session ON public.passages(attendee_id, session_id) WHERE session_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.passages TO authenticated;
GRANT ALL ON public.passages TO service_role;
ALTER TABLE public.passages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages passages" ON public.passages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Scanner reads passages" ON public.passages FOR SELECT TO authenticated
  USING (public.is_event_scanner(event_id, auth.uid()));

CREATE TABLE public.capacity_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  extra integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.capacity_requests TO authenticated;
GRANT ALL ON public.capacity_requests TO service_role;
ALTER TABLE public.capacity_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages requests" ON public.capacity_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.passages REPLICA IDENTITY FULL;
ALTER TABLE public.capacity_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.passages, public.capacity_requests;

-- Client requests extra places: now pending admin approval
CREATE OR REPLACE FUNCTION public.invite_extend(_token text, _extra integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.events%ROWTYPE;
BEGIN
  IF _extra < 1 OR _extra > 1000 THEN RAISE EXCEPTION 'Nombre invalide (1 à 1000)'; END IF;
  SELECT * INTO e FROM public.events WHERE invite_token = _token;
  IF NOT FOUND OR e.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Lien invalide ou événement terminé'; END IF;
  INSERT INTO public.capacity_requests (event_id, extra) VALUES (e.id, _extra);
  RETURN e.max_capacity;
END $$;

CREATE OR REPLACE FUNCTION public.decide_capacity_request(_id uuid, _approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.capacity_requests%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  SELECT * INTO r FROM public.capacity_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Demande déjà traitée'; END IF;
  UPDATE public.capacity_requests SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END, decided_at = now() WHERE id = _id;
  IF _approve THEN
    UPDATE public.events SET max_capacity = max_capacity + r.extra, extra_capacity = extra_capacity + r.extra WHERE id = r.event_id;
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.decide_capacity_request(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.invite_get(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.events%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.events WHERE invite_token = _token;
  IF NOT FOUND OR e.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Lien invalide ou événement terminé'; END IF;
  RETURN jsonb_build_object('id',e.id,'title',e.title,'room',e.room,'date',e.date,'end_date',e.end_date,
    'max_capacity',e.max_capacity,'extra_capacity',e.extra_capacity,'current_count',e.current_count,
    'pending_requests', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'extra',extra,'status',status,'created_at',created_at) ORDER BY created_at DESC)
      FROM public.capacity_requests WHERE event_id = e.id),'[]'::jsonb),
    'attendees', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'ticket_code',ticket_code,'first_name',first_name,
      'last_name',last_name,'guest_name',guest_name,'status',status,'checked_in_at',checked_in_at) ORDER BY created_at)
      FROM public.attendees WHERE event_id = e.id),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.invite_import(_token text, _rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.events%ROWTYPE; n int; total int; r jsonb; alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; f text; l text;
BEGIN
  SELECT * INTO e FROM public.events WHERE invite_token = _token FOR UPDATE;
  IF NOT FOUND OR e.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Lien invalide ou événement terminé'; END IF;
  total := jsonb_array_length(_rows);
  IF total < 1 OR total > 2000 THEN RAISE EXCEPTION 'Nombre de lignes invalide'; END IF;
  SELECT count(*) INTO n FROM public.attendees WHERE event_id = e.id;
  IF n + total > e.max_capacity THEN RAISE EXCEPTION 'Il reste seulement % QR code(s)', e.max_capacity - n; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(_rows) LOOP
    f := NULLIF(trim(left(r->>'first',60)),''); l := NULLIF(trim(left(r->>'last',60)),'');
    LOOP
      code := '';
      FOR j IN 1..10 LOOP code := code || substr(alpha, 1 + floor(random()*32)::int, 1); END LOOP;
      code := substr(code,1,4) || '-' || substr(code,5,6);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.attendees WHERE ticket_code = code);
    END LOOP;
    INSERT INTO public.attendees (event_id, ticket_code, first_name, last_name, guest_name, email, phone)
    VALUES (e.id, code, f, l, NULLIF(concat_ws(' ', f, l),''), NULLIF(trim(left(r->>'email',120)),''), NULLIF(trim(left(r->>'phone',40)),''));
  END LOOP;
  RETURN total;
END $$;
GRANT EXECUTE ON FUNCTION public.invite_import(text, jsonb) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.check_in_ticket(text, uuid, boolean);
CREATE FUNCTION public.check_in_ticket(_ticket_code text, _event_id uuid, _force boolean DEFAULT false, _session_id uuid DEFAULT NULL, _agent text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a public.attendees%ROWTYPE; e public.events%ROWTYPE; o public.events%ROWTYPE; s public.event_sessions%ROWTYPE; first_entry boolean;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.is_event_scanner(_event_id, auth.uid())) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','no_event'); END IF;
  SELECT * INTO a FROM public.attendees WHERE ticket_code = _ticket_code FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('result','invalid','ticket_code',_ticket_code); END IF;
  IF a.event_id <> _event_id THEN
    SELECT * INTO o FROM public.events WHERE id = a.event_id;
    RETURN jsonb_build_object('result','wrong_event','guest_name',a.guest_name,'ticket_code',a.ticket_code,
      'expected_event',o.title,'expected_room',o.room);
  END IF;
  IF _session_id IS NOT NULL THEN
    SELECT * INTO s FROM public.event_sessions WHERE id = _session_id AND event_id = _event_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('result','no_event'); END IF;
    IF now() < s.starts_at OR now() > s.ends_at THEN
      RETURN jsonb_build_object('result','off_session','guest_name',a.guest_name,'ticket_code',a.ticket_code,'session',s.name);
    END IF;
    IF EXISTS (SELECT 1 FROM public.passages WHERE attendee_id = a.id AND session_id = _session_id) THEN
      RETURN jsonb_build_object('result','duplicate_session','guest_name',a.guest_name,'ticket_code',a.ticket_code,'session',s.name);
    END IF;
  ELSIF a.status <> 'Pending' THEN
    RETURN jsonb_build_object('result','already','guest_name',a.guest_name,'ticket_code',a.ticket_code);
  END IF;
  first_entry := a.status = 'Pending';
  IF first_entry AND e.current_count >= e.max_capacity AND NOT _force THEN
    RETURN jsonb_build_object('result','over_capacity','guest_name',a.guest_name,'ticket_code',a.ticket_code,
      'current_count',e.current_count,'max_capacity',e.max_capacity);
  END IF;
  IF first_entry THEN
    UPDATE public.attendees SET status = CASE WHEN e.current_count >= e.max_capacity THEN 'Over-limit' ELSE 'Checked-in' END,
      checked_in_at = now() WHERE id = a.id;
    UPDATE public.events SET current_count = current_count + 1 WHERE id = e.id;
  END IF;
  INSERT INTO public.passages (attendee_id, event_id, session_id, agent) VALUES (a.id, e.id, _session_id, left(_agent,60));
  RETURN jsonb_build_object('result', CASE WHEN first_entry AND e.current_count >= e.max_capacity THEN 'granted_over' ELSE 'granted' END,
    'guest_name',a.guest_name,'ticket_code',a.ticket_code,'session',s.name,
    'current_count',e.current_count + CASE WHEN first_entry THEN 1 ELSE 0 END,'max_capacity',e.max_capacity);
END $$;
GRANT EXECUTE ON FUNCTION public.check_in_ticket(text, uuid, boolean, uuid, text) TO authenticated;