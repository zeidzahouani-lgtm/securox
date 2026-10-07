CREATE TABLE public.app_pins (role text PRIMARY KEY, pin text NOT NULL, failed int NOT NULL DEFAULT 0, locked_until timestamptz);
GRANT ALL ON public.app_pins TO service_role;
ALTER TABLE public.app_pins ENABLE ROW LEVEL SECURITY;
INSERT INTO public.app_pins (role, pin) VALUES ('admin','4826'), ('scanner','1357');

CREATE OR REPLACE FUNCTION public.is_event_scanner(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_scanners WHERE event_id = _event_id AND user_id = _user_id)
      OR public.has_role(_user_id, 'scanner')
$$;

CREATE OR REPLACE FUNCTION public.set_pin(_role text, _pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF _role NOT IN ('admin','scanner') OR _pin !~ '^[0-9]{4,8}$' THEN RAISE EXCEPTION 'PIN invalide (4 à 8 chiffres)'; END IF;
  UPDATE public.app_pins SET pin = _pin, failed = 0, locked_until = NULL WHERE role = _role;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_pin(text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.set_pin(text,text) TO authenticated;

ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.attendees REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.events, public.attendees;