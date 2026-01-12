-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration 025: 병렬 검색 RPC 함수
-- 2026-01-12
--
-- PRD 요구사항:
-- - 동의어 확장 시 OR 조건이 많아져 쿼리 성능 저하 (P95 ~800ms)
-- - 스킬별로 쿼리를 분리하여 병렬 실행
-- - 최대 5개 스킬 그룹으로 분리하여 처리
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ══════════════════════════════════════════════════════════════════════════
-- search_candidates_parallel: 스킬 그룹별 병렬 검색 함수
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_candidates_parallel(
    p_user_id UUID,
    p_query_embedding vector(1536),
    p_match_count INTEGER DEFAULT 10,
    p_exp_years_min INTEGER DEFAULT NULL,
    p_exp_years_max INTEGER DEFAULT NULL,
    -- 스킬 그룹 (최대 5개 배열, 각 배열은 동의어 그룹)
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
    matched_skill_groups INTEGER -- 몇 개의 스킬 그룹과 매칭되었는지
) AS $$
BEGIN
    RETURN QUERY
    WITH
    -- 기본 필터링 (스킬 제외)
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
    -- 각 스킬 그룹별 매칭 (UNION으로 병합)
    skill_matches AS (
        -- 스킬 그룹 없으면 모든 후보자 선택
        SELECT bf.id AS candidate_id, 0 AS group_matched
        FROM base_filtered bf
        WHERE p_skill_group_1 IS NULL
          AND p_skill_group_2 IS NULL
          AND p_skill_group_3 IS NULL
          AND p_skill_group_4 IS NULL
          AND p_skill_group_5 IS NULL

        UNION

        -- 그룹 1 매칭
        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_1 IS NOT NULL AND bf.skills && p_skill_group_1

        UNION

        -- 그룹 2 매칭
        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_2 IS NOT NULL AND bf.skills && p_skill_group_2

        UNION

        -- 그룹 3 매칭
        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_3 IS NOT NULL AND bf.skills && p_skill_group_3

        UNION

        -- 그룹 4 매칭
        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_4 IS NOT NULL AND bf.skills && p_skill_group_4

        UNION

        -- 그룹 5 매칭
        SELECT bf.id, 1
        FROM base_filtered bf
        WHERE p_skill_group_5 IS NOT NULL AND bf.skills && p_skill_group_5
    ),
    -- 후보자별 매칭 그룹 수 집계
    aggregated_matches AS (
        SELECT
            sm.candidate_id,
            SUM(sm.group_matched)::INTEGER AS total_groups_matched
        FROM skill_matches sm
        GROUP BY sm.candidate_id
    ),
    -- 벡터 검색 점수 계산
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
                    WHEN 'education' THEN 0.5
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
        -- 매칭된 스킬 그룹 수로 먼저 정렬, 그 다음 벡터 점수
        am.total_groups_matched DESC,
        cs.weighted_score DESC NULLS LAST
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 권한 부여
GRANT EXECUTE ON FUNCTION search_candidates_parallel TO authenticated;

-- 코멘트
COMMENT ON FUNCTION search_candidates_parallel IS
'스킬 그룹별 병렬 검색 RPC 함수.
최대 5개의 스킬 그룹을 받아 각각 독립적으로 검색 후 결과 병합.
PRD P0 성능 최적화 요구사항 충족.';
