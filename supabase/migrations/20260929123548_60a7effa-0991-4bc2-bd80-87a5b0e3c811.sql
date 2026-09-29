REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_event_scanner(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_event_client(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_ticket_quota() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_scanner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_client(uuid, uuid) TO authenticated;