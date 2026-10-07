ALTER TABLE public.events ADD COLUMN IF NOT EXISTS extra_capacity integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.invite_extend(_token text, _extra int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.events%ROWTYPE;
BEGIN
  IF _extra < 1 OR _extra > 1000 THEN RAISE EXCEPTION 'Nombre invalide (1 à 1000)'; END IF;
  SELECT * INTO e FROM public.events WHERE invite_token = _token FOR UPDATE;
  IF NOT FOUND OR e.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Lien invalide ou événement terminé'; END IF;
  UPDATE public.events SET max_capacity = max_capacity + _extra, extra_capacity = extra_capacity + _extra WHERE id = e.id;
  RETURN e.max_capacity + _extra;
END $$;
GRANT EXECUTE ON FUNCTION public.invite_extend(text,int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.invite_get(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e public.events%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.events WHERE invite_token = _token;
  IF NOT FOUND OR e.closed_at IS NOT NULL THEN RAISE EXCEPTION 'Lien invalide ou événement terminé'; END IF;
  RETURN jsonb_build_object('id',e.id,'title',e.title,'date',e.date,'end_date',e.end_date,'max_capacity',e.max_capacity,'extra_capacity',e.extra_capacity,
    'attendees', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'ticket_code',ticket_code,'first_name',first_name,
      'last_name',last_name,'guest_name',guest_name,'status',status) ORDER BY created_at)
      FROM public.attendees WHERE event_id = e.id),'[]'::jsonb));
END $$;