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
  end_date: string | null;
  closed_at: string | null;
  report: EventReport | null;
  extra_capacity?: number;
  room?: string | null;
};

export type EventReport = {
  generated: number;
  checked_in: number;
  over_limit: number;
  attendees: { name: string | null; code: string; status: string; checked_in_at: string | null }[];
};

export async function closeEndedEvents() {
  await supabase.rpc("close_ended_events");
}

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
    | "no_event"
    | "wrong_event"
    | "off_session"
    | "duplicate_session";
  expected_event?: string | null;
  expected_room?: string | null;
  session?: string | null;
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
  return (data ?? []) as unknown as EventRow[];
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
  room?: string;
  date: string;
  endDate: string;
  capacity: number;
}): Promise<EventRow> {
  if (new Date(input.endDate) <= new Date(input.date)) throw new Error("La fin doit être après le début");
  const { data, error } = await supabase
    .from("events")
    .insert({
      title: input.title,
      room: input.room || null,
      date: new Date(input.date).toISOString(),
      end_date: new Date(input.endDate).toISOString(),
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

export type ScannerUser = { id: string; email: string | null; full_name: string | null; username?: string | null };

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
    .select("id,email,full_name,username")
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
  return listByRole("client");
}

export async function listAdmins(): Promise<ClientUser[]> {
  return listByRole("admin");
}

async function listByRole(role: "client" | "admin"): Promise<ClientUser[]> {
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", role);
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

export type InviteData = {
  id: string; title: string; room: string | null; date: string; end_date: string | null; max_capacity: number; extra_capacity: number;
  current_count: number;
  pending_requests: { id: string; extra: number; status: string; created_at: string }[];
  attendees: Pick<AttendeeRow, "id" | "ticket_code" | "first_name" | "last_name" | "guest_name" | "status" | "checked_in_at">[];
};
export async function inviteGet(token: string): Promise<InviteData> {
  const { data, error } = await (supabase.rpc as any)("invite_get", { _token: token });
  if (error) throw error;
  return data as InviteData;
}
export async function inviteAdd(token: string, first: string, last: string, count: number) {
  const { error } = await (supabase.rpc as any)("invite_add", { _token: token, _first: first, _last: last, _count: count });
  if (error) throw error;
}
export async function inviteDelete(token: string, id: string) {
  const { error } = await (supabase.rpc as any)("invite_delete", { _token: token, _id: id });
  if (error) throw error;
}

export async function inviteExtend(token: string, extra: number) {
  const { error } = await (supabase.rpc as any)("invite_extend", { _token: token, _extra: extra });
  if (error) throw error;
}

export const MASTER_PREFIX = "SECUROX-EVENT:";

export type SessionRow = { id: string; event_id: string; name: string; starts_at: string; ends_at: string };
export async function listSessions(eventId: string): Promise<SessionRow[]> {
  const { data, error } = await supabase.from("event_sessions").select("*").eq("event_id", eventId).order("starts_at");
  if (error) throw error;
  return (data ?? []) as SessionRow[];
}
export async function addSession(eventId: string, name: string, starts: string, ends: string) {
  if (new Date(ends) <= new Date(starts)) throw new Error("La fin de la session doit être après le début");
  const { error } = await supabase.from("event_sessions").insert({
    event_id: eventId, name, starts_at: new Date(starts).toISOString(), ends_at: new Date(ends).toISOString(),
  });
  if (error) throw error;
}
export async function deleteSession(id: string) {
  const { error } = await supabase.from("event_sessions").delete().eq("id", id);
  if (error) throw error;
}

export type CapacityRequest = { id: string; event_id: string; extra: number; status: string; created_at: string };
export async function listRequests(): Promise<CapacityRequest[]> {
  const { data, error } = await supabase.from("capacity_requests").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CapacityRequest[];
}
export async function decideRequest(id: string, approve: boolean) {
  const { error } = await supabase.rpc("decide_capacity_request", { _id: id, _approve: approve });
  if (error) throw error;
}

export async function updateEventRoom(id: string, room: string) {
  const { error } = await supabase.from("events").update({ room: room || null }).eq("id", id);
  if (error) throw error;
}
export async function closeEventNow(id: string) {
  const { error } = await supabase.from("events").update({ end_date: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  await closeEndedEvents();
}

export type ImportRow = { first: string; last: string; email?: string | undefined; phone?: string | undefined };
export async function inviteImport(token: string, rows: ImportRow[]) {
  const { error } = await (supabase.rpc as any)("invite_import", { _token: token, _rows: rows });
  if (error) throw error;
}

export async function scanTicketV2(ticketCode: string, eventId: string, force: boolean, sessionId: string | null, agent: string | null): Promise<ScanResult> {
  const { data, error } = await (supabase.rpc as any)("check_in_ticket", {
    _ticket_code: ticketCode.trim().toUpperCase(), _event_id: eventId, _force: force,
    _session_id: sessionId, _agent: agent,
  });
  if (error) throw error;
  return data as ScanResult;
}
