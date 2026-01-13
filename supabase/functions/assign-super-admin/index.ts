import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge function to assign super_admin role to user if their email matches SUPER_ADMIN_EMAIL.
 * Should be called right after user registration.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const superAdminEmail = Deno.env.get("SUPER_ADMIN_EMAIL");

    if (!superAdminEmail) {
      console.log("SUPER_ADMIN_EMAIL not configured, skipping role assignment");
      return new Response(
        JSON.stringify({ assigned: false, reason: "not_configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's auth to get their info
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email matches super admin email
    if (user.email?.toLowerCase() !== superAdminEmail.toLowerCase()) {
      console.log("User email does not match super admin email");
      return new Response(
        JSON.stringify({ assigned: false, reason: "email_mismatch" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to insert into user_roles (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if role already exists
    const { data: existingRole } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (existingRole) {
      console.log("Super admin role already assigned to user:", user.id);
      return new Response(
        JSON.stringify({ assigned: true, reason: "already_exists" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Assign super_admin role
    const { error: insertError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: user.id,
        role: "super_admin",
      });

    if (insertError) {
      console.error("Error assigning super admin role:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to assign role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Super admin role assigned to user:", user.id);
    return new Response(
      JSON.stringify({ assigned: true, reason: "success" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in assign-super-admin:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
