ALTER TABLE public.events ADD COLUMN IF NOT EXISTS menu_path text;
CREATE POLICY "Menus readable" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'menus');
CREATE POLICY "Admin uploads menus" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'menus' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin updates menus" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'menus' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin deletes menus" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'menus' AND public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.guest_menu(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  SELECT e.title, e.room, e.menu_path, e.date, a.guest_name INTO r
  FROM public.attendees a JOIN public.events e ON e.id = a.event_id
  WHERE a.ticket_code = upper(trim(_code)) AND e.closed_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('title',r.title,'room',r.room,'menu_path',r.menu_path,'date',r.date,'guest_name',r.guest_name);
END $$;
GRANT EXECUTE ON FUNCTION public.guest_menu(text) TO anon, authenticated;