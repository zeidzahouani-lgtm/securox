import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Role = "admin" | "scanner" | "client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  const role = useQuery({
    queryKey: ["role", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("ensure_my_role");
      if (error) throw error;
      return data as Role;
    },
  });

  return { session, ready, role: role.data ?? null, roleLoading: role.isLoading };
}

export async function signOut() {
  await supabase.auth.signOut();
}
