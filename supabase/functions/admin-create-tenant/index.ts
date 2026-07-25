import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  try {
    const { nome, email, plano, nuit, contact_email } = await req.json();
    if (!nome || !email) {
      return new Response(JSON.stringify({ error: "nome e email obrigatorios" }), { status: 400 });
    }

    const authHeader = req.headers.get("Authorization");
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify admin
    const userRes = await adminClient.auth.getUser(authHeader?.replace("Bearer ", ""));
    const userId = userRes.data.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!roles?.some((r: { role: string }) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403 });
    }

    // Create user via Auth Admin API
    const { data: newUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { empresa: nome },
    });
    if (authError || !newUser.user) {
      return new Response(JSON.stringify({ error: authError?.message || "Failed to create user" }), { status: 500 });
    }

    const newUserId = newUser.user.id;
    const slug = "org-" + newUserId.slice(0, 8);

    // Create org
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .insert({ nome, slug, plano: plano || "free", nuit: nuit || '', contact_email: contact_email || email })
      .select()
      .single();
    if (orgError || !org) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: orgError?.message || "Failed to create org" }), { status: 500 });
    }

    // Add user as owner of org
    const { error: memberError } = await adminClient
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: newUserId, role: "owner" });
    if (memberError) {
      await adminClient.from("organizations").delete().eq("id", org.id);
      await adminClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: memberError.message }), { status: 500 });
    }

    // Audit log
    await adminClient.from("admin_audit_log").insert({
      admin_id: userId,
      action: "tenant_create",
      target_table: "organizations",
      target_id: org.id,
      target_owner_id: newUserId,
      target_snapshot: { nome, email, plano, slug, nuit, contact_email },
    });

    return new Response(JSON.stringify({ success: true, org_id: org.id, user_id: newUserId }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
