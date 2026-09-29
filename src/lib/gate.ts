import { supabase } from "@/integrations/supabase/client";

export type EventRow = {
  id: string;
  title: string;
  date: string;
  max_capacity: number;
  current_count: number;
  created_at: string;
  client_id: string | null;
  invite_token: string;
};

export type AttendeeRow = {
  id: string;
  event_id: string;
  ticket_code: string;
  guest_name: string | null;
  first_name: string | null;
  last_name: string | null;
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

export async function createEvent(input: {
  title: string;
  date: string;
  capacity: number;
}): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: input.title,
      date: new Date(input.date).toISOString(),
      max_capacity: input.capacity,
    })
    .select()
    .single();
  if (error) throw error;
  return data as EventRow;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function addAttendee(eventId: string, firstName: string, lastName: string) {
  const prefix = randomCode().slice(0, 4);
  const { error } = await supabase.from("attendees").insert({
    event_id: eventId,
    first_name: firstName,
    last_name: lastName,
    guest_name: `${firstName} ${lastName}`.trim(),
    ticket_code: `${prefix}-${randomCode()}`,
  });
  if (error) throw error;
}

export async function deleteAttendee(id: string) {
  const { error } = await supabase.from("attendees").delete().eq("id", id);
  if (error) throw error;
}

export async function claimEvent(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("claim_event", { _token: token });
  if (error) throw error;
  return data as string;
}

export type ScannerUser = { id: string; email: string | null; full_name: string | null };

export async function listScanners(): Promise<ScannerUser[]> {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "scanner");
  if (error) throw error;
  const ids = (roles ?? []).map((r) => r.user_id);
  if (!ids.length) return [];
  const { data, error: e2 } = await supabase
    .from("profiles")
    .select("id,email,full_name")
    .in("id", ids);
  if (e2) throw e2;
  return (data ?? []) as ScannerUser[];
}

export interface ClientUser {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
}

export async function listClients(): Promise<ClientUser[]> {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", "client");
  if (error) throw error;
  const ids = (roles ?? []).map((r) => r.user_id);
  if (!ids.length) return [];
  const { data, error: e2 } = await supabase
    .from("profiles")
    .select("id,email,full_name,username")
    .in("id", ids);
  if (e2) throw e2;
  return (data ?? []) as ClientUser[];
}

export async function listAssignments(eventId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("event_scanners")
    .select("user_id")
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []).map((r) => r.user_id);
}

export async function setAssignment(eventId: string, userId: string, on: boolean) {
  const { error } = on
    ? await supabase.from("event_scanners").insert({ event_id: eventId, user_id: userId })
    : await supabase.from("event_scanners").delete().eq("event_id", eventId).eq("user_id", userId);
  if (error) throw error;
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
