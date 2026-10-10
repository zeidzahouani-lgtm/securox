CREATE TABLE public.media_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  path text NOT NULL,
  mime text NOT NULL DEFAULT '',
  size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_items TO authenticated;
GRANT ALL ON public.media_items TO service_role;
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages media" ON public.media_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  media_ids uuid[] NOT NULL DEFAULT '{}',
  public_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(8),'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.outlets TO authenticated;
GRANT ALL ON public.outlets TO service_role;
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages outlets" ON public.outlets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.outlet_public(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.outlets%ROWTYPE;
BEGIN
  SELECT * INTO o FROM public.outlets WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('name',o.name,'description',o.description,
    'media', COALESCE((SELECT jsonb_agg(jsonb_build_object('name',m.name,'path',m.path,'mime',m.mime) ORDER BY array_position(o.media_ids, m.id))
      FROM public.media_items m WHERE m.id = ANY(o.media_ids)),'[]'::jsonb));
END $$;
GRANT EXECUTE ON FUNCTION public.outlet_public(text) TO anon, authenticated;