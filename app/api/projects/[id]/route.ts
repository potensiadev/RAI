
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiBadRequest, apiInternalError, apiUnauthorized, apiNotFound } from "@/lib/api-response";
// Fixed import from shared lib
import { toSearchResult } from "@/lib/search/utils";

// GET /api/projects/[id] - Get project details and candidates
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) return apiBadRequest("Project ID is required");

        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return apiUnauthorized();
        }

        // Fetch project metadata
        const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("*")
            .eq("id", id)
            .eq("user_id", user.id)
            .single();

        if (projectError || !project) {
            if (projectError?.code === 'PGRST116') return apiNotFound("Project not found");
            console.error("Error fetching project:", projectError);
            return apiInternalError();
        }

        // Fetch candidates in this project
        const { data: relations, error: candidatesError } = await supabase
            .from("project_candidates")
            .select(`
        *,
        candidates:candidate_id (*)
      `)
            .eq("project_id", id)
            .order("created_at", { ascending: false });

        if (candidatesError) {
            console.error("Error fetching project candidates:", candidatesError);
            return apiInternalError();
        }

        // Transform to CandidateSearchResult
        // Note: 'candidates' in the join result is an object because of the foreign key
        const results = relations.map((rel: any) => {
            const candidateData = rel.candidates;
            // Mocking score for now as saved items don't strictly have a search score
            return {
                ...candidateData,
                role: candidateData.last_position || "",
                company: candidateData.last_company || "",
                expYears: candidateData.exp_years || 0,
                skills: candidateData.skills || [],
                // Important: map DB boolean 'requires_review' to standard prop
                requiresReview: candidateData.requires_review || false,
                // Include project-specific metadata
                savedAt: rel.created_at,
                projectStatus: rel.status,
                notes: rel.notes
            };
        }).map(c => ({
            id: c.id,
            name: c.name,
            role: c.role,
            company: c.company,
            expYears: c.expYears,
            skills: c.skills,
            photoUrl: c.photo_url,
            summary: c.summary,
            aiConfidence: Math.round((c.confidence_score || 0) * 100),
            matchScore: 100, // Default to 100 for saved items
            riskLevel: c.risk_level || "low",
            requiresReview: c.requires_review,
            createdAt: c.created_at,
            updatedAt: c.updated_at
        }));

        return apiSuccess({
            project,
            candidates: results
        });

    } catch (error) {
        console.error("Project Detail API Error:", error);
        return apiInternalError();
    }
}
