
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiBadRequest, apiInternalError, apiUnauthorized } from "@/lib/api-response";
import { withRateLimit } from "@/lib/rate-limit";
import type { Database } from "@/types";

// GET /api/projects - List all projects for the current user
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return apiUnauthorized();
        }

        const { data: projects, error } = await (supabase
            .from("projects") as any)
            .select("*, project_candidates(count)")
            .eq("user_id", user.id)
            .eq("status", "active")
            .order("updated_at", { ascending: false });

        if (error) {
            console.error("Error fetching projects:", error);
            return apiInternalError();
        }

        // Transform to include candidate count properly if needed, usually supbase returns count as array of objects if not used carefully, 
        // but with newly created tables it should be fine or we might need a transform.
        // For now returning as is.

        return apiSuccess(projects);
    } catch (error) {
        console.error("Projects API Error:", error);
        return apiInternalError();
    }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
    try {
        const rateLimitRes = await withRateLimit(request, "default");
        if (rateLimitRes) return rateLimitRes;

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return apiUnauthorized();
        }

        const body = await request.json();
        const { name, description } = body;

        if (!name || name.trim().length === 0) {
            return apiBadRequest("Project name is required");
        }

        const { data, error } = await (supabase
            .from("projects") as any)
            .insert({
                name: name.trim(),
                description: description?.trim(),
                user_id: user.id
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating project:", error);
            return apiInternalError();
        }

        return apiSuccess(data);

    } catch (error) {
        console.error("Projects Create API Error:", error);
        return apiInternalError();
    }
}
