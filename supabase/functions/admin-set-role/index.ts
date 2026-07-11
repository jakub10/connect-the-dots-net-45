import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is a creator
    const { data: isCreator } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "creator",
    });
    if (!isCreator) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id, role, action } = await req.json();
    if (!target_user_id || !["vip", "vip_pro_max"].includes(role) || !["grant", "revoke"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cannot modify creators
    const { data: targetIsCreator } = await admin.rpc("has_role", {
      _user_id: target_user_id,
      _role: "creator",
    });
    if (targetIsCreator) {
      return new Response(JSON.stringify({ error: "Cannot modify a creator" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "grant") {
      const rolesToInsert = role === "vip_pro_max"
        ? [{ user_id: target_user_id, role: "vip" }, { user_id: target_user_id, role: "vip_pro_max" }]
        : [{ user_id: target_user_id, role: "vip" }];
      for (const r of rolesToInsert) {
        const { error } = await admin.from("user_roles").insert(r);
        if (error && !error.message.includes("duplicate")) {
          console.error("admin-set-role insert failed:", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      // revoke
      const rolesToDelete = role === "vip_pro_max" ? ["vip_pro_max"] : ["vip", "vip_pro_max"];
      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", target_user_id)
        .in("role", rolesToDelete);
      if (error) {
        console.error("admin-set-role delete failed:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("admin-set-role error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
