CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  max_capacity INTEGER NOT NULL CHECK (max_capacity > 0),
  current_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_code TEXT NOT NULL UNIQUE,
  guest_name TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Checked-in','Over-limit')),
  checked_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendees_event ON public.attendees(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO anon, authenticated;
GRANT ALL ON public.events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendees TO anon, authenticated;
GRANT ALL ON public.attendees TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can manage events" ON public.events FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public can manage attendees" ON public.attendees FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.check_in_ticket(_ticket_code TEXT, _event_id UUID, _force BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.attendees%ROWTYPE;
  e public.events%ROWTYPE;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result','no_event');
  END IF;

  SELECT * INTO a FROM public.attendees
    WHERE ticket_code = _ticket_code AND event_id = _event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('result','invalid');
  END IF;

  IF a.status <> 'Pending' THEN
    RETURN jsonb_build_object('result','already', 'guest_name', a.guest_name, 'ticket_code', a.ticket_code);
  END IF;

  IF e.current_count >= e.max_capacity AND NOT _force THEN
    RETURN jsonb_build_object('result','over_capacity', 'guest_name', a.guest_name, 'ticket_code', a.ticket_code,
      'current_count', e.current_count, 'max_capacity', e.max_capacity);
  END IF;

  UPDATE public.attendees
    SET status = CASE WHEN e.current_count >= e.max_capacity THEN 'Over-limit' ELSE 'Checked-in' END,
        checked_in_at = now()
    WHERE id = a.id;

  UPDATE public.events SET current_count = current_count + 1 WHERE id = e.id;

  RETURN jsonb_build_object(
    'result', CASE WHEN e.current_count >= e.max_capacity THEN 'granted_over' ELSE 'granted' END,
    'guest_name', a.guest_name, 'ticket_code', a.ticket_code,
    'current_count', e.current_count + 1, 'max_capacity', e.max_capacity);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_in_ticket(TEXT, UUID, BOOLEAN) TO anon, authenticated;