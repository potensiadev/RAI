
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiBadRequest, apiInternalError, apiUnauthorized } from "@/lib/api-response";

// POST /api/projects/[id]/candidates - Add candidate to project
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { candidateId, notes } = body;

        if (!projectId || !candidateId) {
            return apiBadRequest("Project ID and Candidate ID are required");
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return apiUnauthorized();
        }

        // specific check: verify project ownership before insert (RLS handles this but good to be explicit or catching errors)
        // The RLS policy "Users can add candidates to their projects" already enforces this via the EXISTS clause.

        const { data, error } = await (supabase
            .from("project_candidates") as any)
            .insert({
                project_id: projectId,
                candidate_id: candidateId,
                notes: notes || "",
                status: "saved"
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique violation
                return apiBadRequest("Candidate already in this project");
            }
            console.error("Error adding candidate to project:", error);
            return apiInternalError();
        }

        return apiSuccess(data);

    } catch (error) {
        console.error("Add Candidate API Error:", error);
        return apiInternalError();
    }
}

// DELETE /api/projects/[id]/candidates - Remove candidate from project
// Expects JSON body with candidateId for cleaner URL, strictly not REST standard (should be /[candidateId]) 
// but keeps it simple for M:N relations. Or we can use query param.
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const { searchParams } = new URL(request.url);
        const candidateId = searchParams.get('candidateId');

        if (!projectId || !candidateId) {
            return apiBadRequest("Project ID and Candidate ID are required");
        }

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return apiUnauthorized();
        }

        const { error } = await supabase
            .from("project_candidates")
            .delete()
            .eq("project_id", projectId)
            .eq("candidate_id", candidateId);

        if (error) {
            console.error("Error removing candidate from project:", error);
            return apiInternalError();
        }

        return apiSuccess({ success: true });

    } catch (error) {
        console.error("Remove Candidate API Error:", error);
        return apiInternalError();
    }
}
