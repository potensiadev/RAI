-- 2026-01-14
-- Raw text chunk types for semantic search
-- PRD: prd_aisemantic_search_v0.1.md
-- Weights: raw_full(0.7), raw_section(0.65)


ALTER TYPE chunk_type ADD VALUE IF NOT EXISTS 'raw_full';
ALTER TYPE chunk_type ADD VALUE IF NOT EXISTS 'raw_section';


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
BEGIN
    RETURN QUERY
    WITH filtered_candidates AS (
        SELECT c.*
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
    ),
    chunk_scores AS (
        SELECT
            cc.candidate_id,
            -- Chunk type weighted scoring (raw types added)
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
        WHERE cc.candidate_id IN (SELECT fc.id FROM filtered_candidates fc)
        GROUP BY cc.candidate_id
    )
    SELECT
        fc.id,
        fc.name,
        fc.last_position,
        fc.last_company,
        fc.exp_years,
        fc.skills,
        fc.photo_url,
        fc.summary,
        fc.confidence_score,
        fc.requires_review,
        fc.risk_level::TEXT,
        fc.created_at,
        fc.updated_at,
        COALESCE(cs.weighted_score, 0) AS match_score
    FROM filtered_candidates fc
    LEFT JOIN chunk_scores cs ON fc.id = cs.candidate_id
    ORDER BY match_score DESC
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION search_candidates_parallel(
    p_user_id UUID,
    p_query_embedding vector(1536),
    p_match_count INTEGER DEFAULT 10,
    p_exp_years_min INTEGER DEFAULT NULL,
    p_exp_years_max INTEGER DEFAULT NULL,
    -- Skill groups (max 5 arrays, each array is OR group)
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
BEGIN
    RETURN QUERY
    WITH
    -- Base filtering (excluding skills)
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
    ),
    -- Per skill group matching
    skill_matches AS (
        -- If no skill groups, select all candidates
        SELECT bf.id AS candidate_id, 0 AS group_matched
        FROM base_filtered bf
        WHERE p_skill_group_1 IS NULL
          AND p_skill_group_2 IS NULL
          AND p_skill_group_3 IS NULL
          AND p_skill_group_4 IS NULL
          AND p_skill_group_5 IS NULL

        UNION

        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_1 IS NOT NULL AND bf.skills && p_skill_group_1

        UNION

        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_2 IS NOT NULL AND bf.skills && p_skill_group_2

        UNION

        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_3 IS NOT NULL AND bf.skills && p_skill_group_3

        UNION

        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_4 IS NOT NULL AND bf.skills && p_skill_group_4

        UNION

        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_5 IS NOT NULL AND bf.skills && p_skill_group_5
    ),
    -- Aggregate matched group count per candidate
    aggregated_matches AS (
        SELECT
            sm.candidate_id,
            SUM(sm.group_matched)::INTEGER AS total_groups_matched
        FROM skill_matches sm
        GROUP BY sm.candidate_id
    ),
    -- Vector score calculation (raw type weights added)
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
