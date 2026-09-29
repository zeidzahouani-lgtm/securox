import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function friendly(msg?: string) {
  const m = (msg ?? "").toLowerCase();
  if (m.includes("weak") || m.includes("easy to guess"))
    return "Mot de passe trop faible ou trop courant. Choisissez-en un plus unique (lettres, chiffres, symboles).";
  if (m.includes("already")) return "Ce nom d'utilisateur est déjà pris";
  return msg || "Création impossible";
}

export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        role: z.enum(["admin", "scanner", "client"]),
        username: z
          .string()
          .trim()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9._-]+$/, "Lettres, chiffres, . _ - uniquement"),
        password: z.string().min(8).max(72),
        fullName: z.string().trim().max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Accès réservé à l'admin");

    const username = data.username.toLowerCase();
    const email = `${username}@dravox.local`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();
    if (taken) return { id: null, error: "Ce nom d'utilisateur est déjà pris" as string | null };

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) return { id: null, error: friendly(error?.message) };

    const id = created.user.id;
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.role });
    await supabaseAdmin
      .from("profiles")
      .upsert({ id, email, full_name: data.fullName || null, username });
    return { id, error: null as string | null };
  });
