CREATE OR REPLACE FUNCTION public.resolve_login(_username text)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT email FROM public.profiles
  WHERE lower(username) = lower(trim(_username))
    AND (email LIKE '%@pulsegate.local' OR email LIKE '%@dravox.local')
  LIMIT 1
$$;