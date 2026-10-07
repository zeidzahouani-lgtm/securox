import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function sharedPassword(role: string) {
  const secret = process.env["SHARED_ACCOUNT_SECRET"]!;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`dravox-${role}`));
  return "Dx!" + btoa(String.fromCharCode(...new Uint8Array(sig))).slice(0, 40);
}

export const pinLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ role: z.enum(["admin", "scanner"]), pin: z.string().regex(/^[0-9]{4,8}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("app_pins" as never).select("*").eq("role", data.role).maybeSingle();
    const r = row as { pin: string; failed: number; locked_until: string | null } | null;
    if (!r) return { error: "Configuration manquante" };
    if (r.locked_until && new Date(r.locked_until) > new Date())
      return { error: "Trop d'essais. Réessayez dans quelques minutes." };
    if (r.pin !== data.pin) {
      const failed = r.failed + 1;
      await supabaseAdmin.from("app_pins" as never).update({
        failed: failed >= 5 ? 0 : failed,
        locked_until: failed >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null,
      } as never).eq("role", data.role);
      return { error: "Code PIN incorrect" };
    }
    await supabaseAdmin.from("app_pins" as never).update({ failed: 0 } as never).eq("role", data.role);

    const email = `shared-${data.role}@dravox.local`;
    const password = await sharedPassword(data.role);
    const { data: prof } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!prof) {
      const { data: c, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error || !c.user) return { error: "Création du profil impossible" };
      await supabaseAdmin.from("user_roles").insert({ user_id: c.user.id, role: data.role });
      await supabaseAdmin.from("profiles").upsert({ id: c.user.id, email, full_name: data.role === "admin" ? "Admin" : "Scanner", username: `shared-${data.role}` });
    } else {
      await supabaseAdmin.auth.admin.updateUserById(prof.id, { password });
    }
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const pub = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (i, init) => { const h = new Headers(init?.headers); if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization"); h.set("apikey", key); return fetch(i, { ...init, headers: h }); } },
    });
    const { data: s, error } = await pub.auth.signInWithPassword({ email, password });
    if (error || !s.session) return { error: "Connexion impossible" };
    return { error: null, access_token: s.session.access_token, refresh_token: s.session.refresh_token };
  });
