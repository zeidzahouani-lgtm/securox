CREATE OR REPLACE FUNCTION public.invite_get(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.events%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.events WHERE invite_token = _token;
  IF NOT FOUND OR e.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Lien invalide ou événement terminé'; END IF;
  RETURN jsonb_build_object('id',e.id,'title',e.title,'date',e.date,'end_date',e.end_date,'max_capacity',e.max_capacity,
    'attendees', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'ticket_code',ticket_code,'first_name',first_name,
      'last_name',last_name,'guest_name',guest_name,'status',status) ORDER BY created_at)
      FROM public.attendees WHERE event_id = e.id),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.invite_add(_token text, _first text, _last text, _count int DEFAULT 1)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.events%ROWTYPE; n int; i int; alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; nm text;
BEGIN
  SELECT * INTO e FROM public.events WHERE invite_token = _token FOR UPDATE;
  IF NOT FOUND OR e.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Lien invalide ou événement terminé'; END IF;
  IF _count < 1 OR _count > 500 THEN RAISE EXCEPTION 'Nombre invalide'; END IF;
  SELECT count(*) INTO n FROM public.attendees WHERE event_id = e.id;
  IF n + _count > e.max_capacity THEN RAISE EXCEPTION 'Il reste seulement % QR code(s)', e.max_capacity - n; END IF;
  nm := NULLIF(trim(concat_ws(' ', NULLIF(trim(left(_first,60)),''), NULLIF(trim(left(_last,60)),''))),'');
  FOR i IN 1.._count LOOP
    LOOP
      code := '';
      FOR j IN 1..10 LOOP code := code || substr(alpha, 1 + floor(random()*32)::int, 1); END LOOP;
      code := substr(code,1,4) || '-' || substr(code,5,6);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.attendees WHERE ticket_code = code);
    END LOOP;
    INSERT INTO public.attendees (event_id, ticket_code, first_name, last_name, guest_name)
    VALUES (e.id, code, NULLIF(trim(left(_first,60)),''), NULLIF(trim(left(_last,60)),''), nm);
  END LOOP;
  RETURN _count;
END $$;

CREATE OR REPLACE FUNCTION public.invite_delete(_token text, _id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.attendees a USING public.events e
  WHERE a.id = _id AND a.event_id = e.id AND e.invite_token = _token AND e.closed_at IS NULL AND a.status = 'Pending';
END $$;

GRANT EXECUTE ON FUNCTION public.invite_get(text), public.invite_add(text,text,text,int), public.invite_delete(text,uuid) TO anon, authenticated;