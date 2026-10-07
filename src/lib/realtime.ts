import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Refreshes events/attendees queries whenever the database changes. */
export function useLiveGate() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel(`gate-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () =>
        qc.invalidateQueries({ queryKey: ["events"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "attendees" }, () =>
        qc.invalidateQueries({ queryKey: ["attendees"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}
