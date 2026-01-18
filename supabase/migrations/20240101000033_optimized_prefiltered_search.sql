-- 2026-01-14
-- Optimized pre-filtered search functions
-- PRD: prd_aisemantic_search_v0.1.md


CREATE OR REPLACE FUNCTION search_candidates(
    p_user_id UUID,
    p_query_embedding vector(1536),
    p_match_count INTEGER DEFAULT 10,
    p_exp_years_min INTEGER DEFAULT NULL,
    p_exp_years_max INTEGER DEFAULT NULL,
    p_skills TEXT[] DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_companies TEXT[] DEFAULT NULL,
    p_exclude_companies TEXT[] DEFAULT NULL,
    p_education_level TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    last_position TEXT,
    last_company TEXT,
    exp_years INTEGER,
    skills TEXT[],
    photo_url TEXT,
    summary TEXT,
    confidence_score FLOAT,
    requires_review BOOLEAN,
    risk_level TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    match_score FLOAT
) AS $$
DECLARE
    v_candidate_limit INTEGER;
BEGIN
    -- Candidate limit for vector search (performance optimization)
    -- More restrictive when filter conditions exist, looser otherwise
    v_candidate_limit := CASE
        WHEN p_skills IS NOT NULL OR p_companies IS NOT NULL THEN p_match_count * 5
        ELSE p_match_count * 10
    END;

    RETURN QUERY
    WITH
    -- Step 1: Pre-filter - Extract candidate IDs with RDB conditions (fast)
    -- Index: candidates(user_id, is_latest, status)
    prefiltered_ids AS (
        SELECT c.id
        FROM candidates c
        WHERE c.user_id = p_user_id
          AND c.is_latest = true
          AND c.status = 'completed'
          AND (p_exp_years_min IS NULL OR c.exp_years >= p_exp_years_min)
          AND (p_exp_years_max IS NULL OR c.exp_years <= p_exp_years_max)
          AND (p_skills IS NULL OR c.skills && p_skills)
          AND (p_location IS NULL OR c.location_city ILIKE '%' || p_location || '%')
          AND (p_companies IS NULL OR EXISTS (
              SELECT 1 FROM unnest(p_companies) AS comp
              WHERE c.last_company ILIKE '%' || comp || '%'
          ))
          AND (p_exclude_companies IS NULL OR NOT EXISTS (
              SELECT 1 FROM unnest(p_exclude_companies) AS comp
              WHERE c.last_company ILIKE '%' || comp || '%'
          ))
          AND (p_education_level IS NULL OR c.education_level = p_education_level)
        -- Candidate limit (prevent excessive vector search)
        LIMIT v_candidate_limit
    ),
    -- Step 2: Vector Search - Search only filtered candidate chunks
    -- Index: candidate_chunks(candidate_id), HNSW(embedding)
    -- Optimized structure: priority chunks (summary, career, skill)
    chunk_scores AS (
        SELECT
            cc.candidate_id,
            MAX(
                (1 - (cc.embedding <=> p_query_embedding)) *
                CASE cc.chunk_type
                    WHEN 'summary' THEN 1.0
                    WHEN 'career' THEN 0.9
                    WHEN 'skill' THEN 0.85
                    WHEN 'project' THEN 0.8
                    WHEN 'raw_full' THEN 0.7
                    WHEN 'raw_section' THEN 0.65
                    WHEN 'education' THEN 0.5
                    ELSE 0.5
                END
            ) AS weighted_score,
            -- Matched chunk types (for debugging)
            ARRAY_AGG(DISTINCT cc.chunk_type::TEXT) AS matched_types
        FROM candidate_chunks cc
        WHERE cc.candidate_id IN (SELECT pid.id FROM prefiltered_ids pid)
        GROUP BY cc.candidate_id
    ),
    -- Step 3: Join - Combine metadata
    ranked_results AS (
        SELECT
            c.id,
            c.name,
            c.last_position,
            c.last_company,
            c.exp_years,
            c.skills,
            c.photo_url,
            c.summary,
            c.confidence_score,
            c.requires_review,
            c.risk_level::TEXT,
            c.created_at,
            c.updated_at,
            COALESCE(cs.weighted_score, 0) AS match_score,
            -- Candidates without chunks go to the end
            ROW_NUMBER() OVER (
                ORDER BY
                    CASE WHEN cs.weighted_score IS NULL THEN 1 ELSE 0 END,
                    cs.weighted_score DESC
            ) AS rank
        FROM candidates c
        INNER JOIN prefiltered_ids pid ON c.id = pid.id
        LEFT JOIN chunk_scores cs ON c.id = cs.candidate_id
    )
    SELECT
        rr.id,
        rr.name,
        rr.last_position,
        rr.last_company,
        rr.exp_years,
        rr.skills,
        rr.photo_url,
        rr.summary,
        rr.confidence_score,
        rr.requires_review,
        rr.risk_level,
        rr.created_at,
        rr.updated_at,
        rr.match_score
    FROM ranked_results rr
    WHERE rr.rank <= p_match_count
    ORDER BY rr.match_score DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION search_candidates_parallel(
    p_user_id UUID,
    p_query_embedding vector(1536),
    p_match_count INTEGER DEFAULT 10,
    p_exp_years_min INTEGER DEFAULT NULL,
    p_exp_years_max INTEGER DEFAULT NULL,
    p_skill_group_1 TEXT[] DEFAULT NULL,
    p_skill_group_2 TEXT[] DEFAULT NULL,
    p_skill_group_3 TEXT[] DEFAULT NULL,
    p_skill_group_4 TEXT[] DEFAULT NULL,
    p_skill_group_5 TEXT[] DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_companies TEXT[] DEFAULT NULL,
    p_exclude_companies TEXT[] DEFAULT NULL,
    p_education_level TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    last_position TEXT,
    last_company TEXT,
    exp_years INTEGER,
    skills TEXT[],
    photo_url TEXT,
    summary TEXT,
    confidence_score FLOAT,
    requires_review BOOLEAN,
    risk_level TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    match_score FLOAT,
    matched_skill_groups INTEGER
) AS $$
DECLARE
    v_candidate_limit INTEGER := p_match_count * 10;
BEGIN
    RETURN QUERY
    WITH
    -- Step 1: Pre-filter - Filter candidates with basic conditions
    base_filtered AS (
        SELECT c.*
        FROM candidates c
        WHERE c.user_id = p_user_id
          AND c.is_latest = true
          AND c.status = 'completed'
          AND (p_exp_years_min IS NULL OR c.exp_years >= p_exp_years_min)
          AND (p_exp_years_max IS NULL OR c.exp_years <= p_exp_years_max)
          AND (p_location IS NULL OR c.location_city ILIKE '%' || p_location || '%')
          AND (p_companies IS NULL OR EXISTS (
              SELECT 1 FROM unnest(p_companies) AS comp
              WHERE c.last_company ILIKE '%' || comp || '%'
          ))
          AND (p_exclude_companies IS NULL OR NOT EXISTS (
              SELECT 1 FROM unnest(p_exclude_companies) AS comp
              WHERE c.last_company ILIKE '%' || comp || '%'
          ))
          AND (p_education_level IS NULL OR c.education_level = p_education_level)
        LIMIT v_candidate_limit
    ),
    -- Step 2: Per skill group matching (parallel processing)
    skill_matches AS (
        -- If no skill groups, select all candidates
        SELECT bf.id AS candidate_id, 0 AS group_matched
        FROM base_filtered bf
        WHERE p_skill_group_1 IS NULL
          AND p_skill_group_2 IS NULL
          AND p_skill_group_3 IS NULL
          AND p_skill_group_4 IS NULL
          AND p_skill_group_5 IS NULL

        UNION ALL

        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_1 IS NOT NULL AND bf.skills && p_skill_group_1

        UNION ALL

        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_2 IS NOT NULL AND bf.skills && p_skill_group_2

        UNION ALL

        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_3 IS NOT NULL AND bf.skills && p_skill_group_3

        UNION ALL

        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_4 IS NOT NULL AND bf.skills && p_skill_group_4

        UNION ALL

        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_5 IS NOT NULL AND bf.skills && p_skill_group_5
    ),
    aggregated_matches AS (
        SELECT
            sm.candidate_id,
            SUM(sm.group_matched)::INTEGER AS total_groups_matched
        FROM skill_matches sm
        GROUP BY sm.candidate_id
    ),
    -- Step 3: Vector Search - Only search matched candidates
    chunk_scores AS (
        SELECT
            cc.candidate_id,
            MAX(
                (1 - (cc.embedding <=> p_query_embedding)) *
                CASE cc.chunk_type
                    WHEN 'summary' THEN 1.0
                    WHEN 'career' THEN 0.9
                    WHEN 'skill' THEN 0.85
                    WHEN 'project' THEN 0.8
                    WHEN 'raw_full' THEN 0.7
                    WHEN 'raw_section' THEN 0.65
                    WHEN 'education' THEN 0.5
                    ELSE 0.5
                END
            ) AS weighted_score
        FROM candidate_chunks cc
        WHERE cc.candidate_id IN (SELECT am.candidate_id FROM aggregated_matches am)
        GROUP BY cc.candidate_id
    )
    SELECT
        bf.id,
        bf.name,
        bf.last_position,
        bf.last_company,
        bf.exp_years,
        bf.skills,
        bf.photo_url,
        bf.summary,
        bf.confidence_score,
        bf.requires_review,
        bf.risk_level::TEXT,
        bf.created_at,
        bf.updated_at,
        COALESCE(cs.weighted_score, 0) AS match_score,
        COALESCE(am.total_groups_matched, 0) AS matched_skill_groups
    FROM base_filtered bf
    INNER JOIN aggregated_matches am ON bf.id = am.candidate_id
    LEFT JOIN chunk_scores cs ON bf.id = cs.candidate_id
    ORDER BY
        am.total_groups_matched DESC,
        cs.weighted_score DESC NULLS LAST
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE INDEX IF NOT EXISTS idx_candidates_prefilter
ON candidates (user_id, is_latest, status, exp_years)
WHERE is_latest = true AND status = 'completed';

CREATE INDEX IF NOT EXISTS idx_candidate_chunks_candidate_id
ON candidate_chunks (candidate_id);
