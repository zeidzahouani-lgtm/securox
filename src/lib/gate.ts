import { supabase } from "@/integrations/supabase/client";

export type EventRow = {
  id: string;
  title: string;
  date: string;
  max_capacity: number;
  current_count: number;
  created_at: string;
};

export type AttendeeRow = {
  id: string;
  event_id: string;
  ticket_code: string;
  guest_name: string | null;
  status: "Pending" | "Checked-in" | "Over-limit";
  checked_in_at: string | null;
  created_at: string;
};

export type ScanResult = {
  result:
    | "granted"
    | "granted_over"
    | "over_capacity"
    | "already"
    | "invalid"
    | "no_event";
  guest_name?: string | null;
  ticket_code?: string;
  current_count?: number;
  max_capacity?: number;
};

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function listEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export async function listAttendees(eventId: string): Promise<AttendeeRow[]> {
  const { data, error } = await supabase
    .from("attendees")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AttendeeRow[];
}

export async function createEventWithTickets(input: {
  title: string;
  date: string;
  capacity: number;
  batchSize: number;
}): Promise<EventRow> {
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      title: input.title,
      date: new Date(input.date).toISOString(),
      max_capacity: input.capacity,
    })
    .select()
    .single();
  if (error) throw error;

  const prefix = randomCode().slice(0, 4);
  const tickets = Array.from({ length: input.batchSize }, (_, i) => ({
    event_id: (event as EventRow).id,
    ticket_code: `${prefix}-${String(i + 1).padStart(4, "0")}-${randomCode().slice(0, 3)}`,
  }));

  const { error: ticketError } = await supabase.from("attendees").insert(tickets);
  if (ticketError) throw ticketError;

  return event as EventRow;
}

export async function renameGuest(id: string, guestName: string) {
  const { error } = await supabase
    .from("attendees")
    .update({ guest_name: guestName || null })
    .eq("id", id);
  if (error) throw error;
}

export async function scanTicket(
  ticketCode: string,
  eventId: string,
  force = false,
): Promise<ScanResult> {
  const { data, error } = await supabase.rpc("check_in_ticket", {
    _ticket_code: ticketCode.trim().toUpperCase(),
    _event_id: eventId,
    _force: force,
  });
  if (error) throw error;
  return data as unknown as ScanResult;
}
