ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_date timestamptz, ADD COLUMN IF NOT EXISTS closed_at timestamptz, ADD COLUMN IF NOT EXISTS report jsonb;

CREATE OR REPLACE FUNCTION public.close_ended_events()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.events%ROWTYPE; n int := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;
  FOR e IN SELECT * FROM public.events
    WHERE closed_at IS NULL AND COALESCE(end_date, date + interval '1 day') <= now() FOR UPDATE
  LOOP
    UPDATE public.events SET closed_at = now(), client_id = NULL,
      report = jsonb_build_object(
        'generated', (SELECT count(*) FROM public.attendees WHERE event_id = e.id),
        'checked_in', (SELECT count(*) FROM public.attendees WHERE event_id = e.id AND status = 'Checked-in'),
        'over_limit', (SELECT count(*) FROM public.attendees WHERE event_id = e.id AND status = 'Over-limit'),
        'attendees', COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'name', guest_name, 'code', ticket_code, 'status', status, 'checked_in_at', checked_in_at)
            ORDER BY checked_in_at NULLS LAST, created_at)
          FROM public.attendees WHERE event_id = e.id), '[]'::jsonb))
    WHERE id = e.id;
    DELETE FROM public.attendees WHERE event_id = e.id;
    DELETE FROM public.event_scanners WHERE event_id = e.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.close_ended_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_ended_events() TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('close-ended-events', '0 * * * *', 'SELECT public.close_ended_events()');