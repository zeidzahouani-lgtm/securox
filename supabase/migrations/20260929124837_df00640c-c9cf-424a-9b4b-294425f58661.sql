ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.resolve_login(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles
  WHERE lower(username) = lower(trim(_username))
    AND email LIKE '%@pulsegate.local'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolve_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_login(text) TO anon, authenticated;