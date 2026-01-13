import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Creates the admin user with all roles if they don't exist.
 * This is a one-time setup function.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const superAdminEmail = Deno.env.get("SUPER_ADMIN_EMAIL");

    if (!superAdminEmail) {
      return new Response(
        JSON.stringify({ error: "SUPER_ADMIN_EMAIL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get parameters from request body
    const body = await req.json().catch(() => ({}));
    const { password, createTeam, teamName } = body;

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === superAdminEmail.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      console.log("Admin user already exists:", existingUser.id);
      userId = existingUser.id;
    } else {
      // Create the admin user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: superAdminEmail,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          display_name: "Super Admin",
        },
      });

      if (createError) {
        console.error("Error creating admin user:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create user", details: createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Created admin user:", newUser.user.id);
      userId = newUser.user.id;
    }

    // Assign all roles
    const rolesToAssign = ["admin", "super_admin", "user"] as const;
    const assignedRoles: string[] = [];

    for (const role of rolesToAssign) {
      // Check if role already exists
      const { data: existingRole } = await adminClient
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role", role)
        .maybeSingle();

      if (existingRole) {
        console.log(`Role ${role} already assigned`);
        assignedRoles.push(role);
        continue;
      }

      // Assign role
      const { error: insertError } = await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (insertError) {
        console.error(`Error assigning ${role} role:`, insertError);
      } else {
        console.log(`Role ${role} assigned`);
        assignedRoles.push(role);
      }
    }

    // Create team if requested
    let teamData = null;
    if (createTeam && teamName) {
      // Check if team already exists
      const { data: existingTeam } = await adminClient
        .from("teams")
        .select("id, name")
        .eq("name", teamName)
        .maybeSingle();

      if (existingTeam) {
        console.log("Team already exists:", existingTeam.id);
        teamData = existingTeam;
      } else {
        // Create team
        const { data: newTeam, error: teamError } = await adminClient
          .from("teams")
          .insert({
            name: teamName,
            created_by: userId,
            balance: 1000,
          })
          .select()
          .single();

        if (teamError) {
          console.error("Error creating team:", teamError);
        } else {
          console.log("Created team:", newTeam.id);
          teamData = newTeam;

          // Add user as team owner
          const { error: memberError } = await adminClient
            .from("team_members")
            .insert({
              team_id: newTeam.id,
              user_id: userId,
              role: "owner",
              status: "approved",
            });

          if (memberError) {
            console.error("Error adding team member:", memberError);
          } else {
            console.log("Added user as team owner");
          }

          // Create team pricing
          await adminClient
            .from("team_pricing")
            .insert({ team_id: newTeam.id });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        email: superAdminEmail,
        roles: assignedRoles,
        team: teamData,
        message: "Admin user setup complete. You can now login.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in setup-admin-user:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
