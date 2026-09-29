import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createScannerAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Création impossible");

    const id = created.user.id;
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: "scanner" });
    await supabaseAdmin
      .from("profiles")
      .upsert({ id, email: data.email, full_name: data.fullName ?? null });
    return { id };
  });

export const createClientAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
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
    const email = `${username}@pulsegate.local`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) {
      if (error?.message?.toLowerCase().includes("already"))
        throw new Error("Ce nom d'utilisateur est déjà pris");
      throw new Error(error?.message ?? "Création impossible");
    }

    const id = created.user.id;
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: "client" });
    await supabaseAdmin
      .from("profiles")
      .upsert({ id, email, full_name: data.fullName ?? null, username });
    return { id };
  });
