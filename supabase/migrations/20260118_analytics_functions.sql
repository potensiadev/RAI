-- ------------------------------------------------------------------------
-- Migration 035: Analytics RPC Functions
-- 2026-01-18
-- Purpose: Server-side aggregations for analytics dashboard performance
-- ------------------------------------------------------------------------

-- ══════════════════════════════════════════════════════════════════════════
-- FUNCTION 1: get_analytics_summary
-- Returns: total_candidates, this_month_count, last_month_count, total_exports
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_analytics_summary()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_now TIMESTAMPTZ := NOW();
    v_this_month_start DATE;
    v_last_month_start DATE;
    v_last_month_end DATE;
    v_result JSON;
BEGIN
    -- Calculate month boundaries
    v_this_month_start := DATE_TRUNC('month', v_now)::DATE;
    v_last_month_start := (DATE_TRUNC('month', v_now) - INTERVAL '1 month')::DATE;
    v_last_month_end := v_this_month_start - INTERVAL '1 day';

    SELECT json_build_object(
        'total_candidates', (
            SELECT COUNT(*)
            FROM candidates
            WHERE user_id = v_user_id
              AND status = 'completed'
              AND is_latest = true
        ),
        'this_month_count', (
            SELECT COUNT(*)
            FROM candidates
            WHERE user_id = v_user_id
              AND status = 'completed'
              AND is_latest = true
              AND created_at >= v_this_month_start
        ),
        'last_month_count', (
            SELECT COUNT(*)
            FROM candidates
            WHERE user_id = v_user_id
              AND status = 'completed'
              AND is_latest = true
              AND created_at >= v_last_month_start
              AND created_at < v_this_month_start
        ),
        'total_exports', (
            SELECT COUNT(*)
            FROM blind_exports
            WHERE user_id = v_user_id
        ),
        'active_positions', (
            SELECT COUNT(*)
            FROM positions
            WHERE user_id = v_user_id
              AND status = 'open'
        ),
        'urgent_positions', (
            SELECT COUNT(*)
            FROM positions
            WHERE user_id = v_user_id
              AND status = 'open'
              AND priority = 'urgent'
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_analytics_summary IS 'Returns summary KPI metrics for analytics dashboard';

-- ══════════════════════════════════════════════════════════════════════════
-- FUNCTION 2: get_pipeline_stats
-- Returns: stage counts, total_in_pipeline, conversion_rates from activities
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_pipeline_stats()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    WITH user_positions AS (
        SELECT id FROM positions WHERE user_id = v_user_id
    ),
    -- Current stage counts
    stage_counts AS (
        SELECT
            pc.stage,
            COUNT(*) as count
        FROM position_candidates pc
        WHERE pc.position_id IN (SELECT id FROM user_positions)
          AND pc.stage NOT IN ('rejected', 'withdrawn')
        GROUP BY pc.stage
    ),
    -- Stage transition counts from activities for true conversion rates
    stage_transitions AS (
        SELECT
            (pa.metadata->>'old_stage')::TEXT as from_stage,
            (pa.metadata->>'new_stage')::TEXT as to_stage,
            COUNT(*) as transition_count
        FROM position_activities pa
        WHERE pa.position_id IN (SELECT id FROM user_positions)
          AND pa.activity_type = 'stage_changed'
          AND pa.metadata->>'old_stage' IS NOT NULL
          AND pa.metadata->>'new_stage' IS NOT NULL
        GROUP BY pa.metadata->>'old_stage', pa.metadata->>'new_stage'
    ),
    -- Calculate entries into each stage (for conversion rate denominator)
    stage_entries AS (
        SELECT
            to_stage as stage,
            SUM(transition_count) as entries
        FROM stage_transitions
        GROUP BY to_stage
    ),
    -- Calculate exits from each stage to next stage (for conversion rate numerator)
    stage_exits AS (
        SELECT
            from_stage as stage,
            SUM(transition_count) as exits
        FROM stage_transitions
        WHERE to_stage NOT IN ('rejected', 'withdrawn')
        GROUP BY from_stage
    ),
    -- Pipeline stages in order
    ordered_stages AS (
        SELECT stage, ordinality as stage_order
        FROM UNNEST(ARRAY['matched', 'reviewed', 'contacted', 'interviewing', 'offered', 'placed']) 
        WITH ORDINALITY AS t(stage, ordinality)
    ),
    -- Combine all data
    pipeline_data AS (
        SELECT
            os.stage,
            os.stage_order,
            COALESCE(sc.count, 0) as current_count,
            COALESCE(se.entries, 0) as total_entered,
            COALESCE(sx.exits, 0) as total_exited_forward
        FROM ordered_stages os
        LEFT JOIN stage_counts sc ON os.stage = sc.stage
        LEFT JOIN stage_entries se ON os.stage = se.stage
        LEFT JOIN stage_exits sx ON os.stage = sx.stage
    )
    SELECT json_build_object(
        'stages', (
            SELECT json_agg(
                json_build_object(
                    'stage', stage,
                    'count', current_count,
                    'total_entered', total_entered,
                    'total_exited_forward', total_exited_forward
                ) ORDER BY stage_order
            )
            FROM pipeline_data
        ),
        'total_in_pipeline', (
            SELECT COALESCE(SUM(current_count), 0)
            FROM pipeline_data
        ),
        'placed_count', (
            SELECT COALESCE(current_count, 0)
            FROM pipeline_data
            WHERE stage = 'placed'
        ),
        -- Stage-to-stage conversion details
        'conversions', (
            SELECT json_agg(
                json_build_object(
                    'from_stage', from_stage,
                    'to_stage', to_stage,
                    'count', transition_count
                )
            )
            FROM stage_transitions
            WHERE from_stage IN ('matched', 'reviewed', 'contacted', 'interviewing', 'offered')
              AND to_stage IN ('reviewed', 'contacted', 'interviewing', 'offered', 'placed')
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_pipeline_stats IS 'Returns pipeline stage counts and conversion metrics';

-- ══════════════════════════════════════════════════════════════════════════
-- FUNCTION 3: get_talent_pool_stats
-- Returns: exp_distribution, top_skills (10), top_companies (8)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_talent_pool_stats()
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'exp_distribution', (
            SELECT json_build_object(
                'entry', COUNT(*) FILTER (WHERE exp_years IS NULL OR exp_years < 2),
                'junior', COUNT(*) FILTER (WHERE exp_years >= 2 AND exp_years < 5),
                'middle', COUNT(*) FILTER (WHERE exp_years >= 5 AND exp_years < 8),
                'senior', COUNT(*) FILTER (WHERE exp_years >= 8 AND exp_years < 12),
                'lead', COUNT(*) FILTER (WHERE exp_years >= 12)
            )
            FROM candidates
            WHERE user_id = v_user_id
              AND status = 'completed'
              AND is_latest = true
        ),
        'top_skills', (
            SELECT json_agg(skill_data ORDER BY skill_count DESC)
            FROM (
                SELECT 
                    skill as name,
                    COUNT(*) as skill_count
                FROM candidates, UNNEST(skills) as skill
                WHERE user_id = v_user_id
                  AND status = 'completed'
                  AND is_latest = true
                  AND skill IS NOT NULL
                  AND skill != ''
                GROUP BY skill
                ORDER BY skill_count DESC
                LIMIT 10
            ) skill_data
        ),
        'top_companies', (
            SELECT json_agg(company_data ORDER BY company_count DESC)
            FROM (
                SELECT 
                    last_company as name,
                    COUNT(*) as company_count
                FROM candidates
                WHERE user_id = v_user_id
                  AND status = 'completed'
                  AND is_latest = true
                  AND last_company IS NOT NULL
                  AND last_company != ''
                GROUP BY last_company
                ORDER BY company_count DESC
                LIMIT 8
            ) company_data
        ),
        'monthly_candidates', (
            SELECT json_agg(monthly_data ORDER BY month_key)
            FROM (
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') as month_key,
                    TO_CHAR(DATE_TRUNC('month', created_at), 'MM') || '월' as month_label,
                    COUNT(*) as count
                FROM candidates
                WHERE user_id = v_user_id
                  AND status = 'completed'
                  AND is_latest = true
                  AND created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
                GROUP BY DATE_TRUNC('month', created_at)
                ORDER BY month_key
            ) monthly_data
        ),
        'monthly_placements', (
            SELECT json_agg(monthly_data ORDER BY month_key)
            FROM (
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', pc.stage_updated_at), 'YYYY-MM') as month_key,
                    TO_CHAR(DATE_TRUNC('month', pc.stage_updated_at), 'MM') || '월' as month_label,
                    COUNT(*) as count
                FROM position_candidates pc
                JOIN positions p ON pc.position_id = p.id
                WHERE p.user_id = v_user_id
                  AND pc.stage = 'placed'
                  AND pc.stage_updated_at >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
                GROUP BY DATE_TRUNC('month', pc.stage_updated_at)
                ORDER BY month_key
            ) monthly_data
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_talent_pool_stats IS 'Returns talent pool statistics including experience distribution and top skills/companies';

-- ══════════════════════════════════════════════════════════════════════════
-- FUNCTION 4: get_position_health
-- Returns: positions with health scores, sorted by urgency
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_position_health(p_limit INTEGER DEFAULT 10)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_now TIMESTAMPTZ := NOW();
    v_result JSON;
BEGIN
    SELECT json_agg(position_data ORDER BY health_order, days_open DESC)
    FROM (
        SELECT
            p.id,
            p.title,
            p.client_company,
            p.status,
            p.priority,
            p.created_at,
            p.deadline,
            EXTRACT(DAY FROM v_now - p.created_at)::INTEGER as days_open,
            -- Match count
            (
                SELECT COUNT(*)
                FROM position_candidates pc
                WHERE pc.position_id = p.id
                  AND pc.stage NOT IN ('rejected', 'withdrawn')
            ) as match_count,
            -- Stuck count (in matched/reviewed for > 7 days)
            (
                SELECT COUNT(*)
                FROM position_candidates pc
                WHERE pc.position_id = p.id
                  AND pc.stage IN ('matched', 'reviewed')
                  AND pc.stage_updated_at < v_now - INTERVAL '7 days'
            ) as stuck_count,
            -- Health status calculation
            CASE
                WHEN (
                    SELECT COUNT(*) FROM position_candidates pc 
                    WHERE pc.position_id = p.id AND pc.stage NOT IN ('rejected', 'withdrawn')
                ) = 0 
                AND EXTRACT(DAY FROM v_now - p.created_at) > 14 
                THEN 'critical'
                WHEN EXTRACT(DAY FROM v_now - p.created_at) > 30 
                OR (
                    SELECT COUNT(*) FROM position_candidates pc
                    WHERE pc.position_id = p.id
                      AND pc.stage IN ('matched', 'reviewed')
                      AND pc.stage_updated_at < v_now - INTERVAL '7 days'
                ) > 3
                THEN 'warning'
                WHEN (
                    SELECT COUNT(*) FROM position_candidates pc 
                    WHERE pc.position_id = p.id AND pc.stage NOT IN ('rejected', 'withdrawn')
                ) = 0 
                AND EXTRACT(DAY FROM v_now - p.created_at) > 7 
                THEN 'warning'
                ELSE 'good'
            END as health_status,
            -- Sort order for health
            CASE
                WHEN (
                    SELECT COUNT(*) FROM position_candidates pc 
                    WHERE pc.position_id = p.id AND pc.stage NOT IN ('rejected', 'withdrawn')
                ) = 0 
                AND EXTRACT(DAY FROM v_now - p.created_at) > 14 
                THEN 0
                WHEN EXTRACT(DAY FROM v_now - p.created_at) > 30 
                OR (
                    SELECT COUNT(*) FROM position_candidates pc
                    WHERE pc.position_id = p.id
                      AND pc.stage IN ('matched', 'reviewed')
                      AND pc.stage_updated_at < v_now - INTERVAL '7 days'
                ) > 3
                THEN 1
                WHEN (
                    SELECT COUNT(*) FROM position_candidates pc 
                    WHERE pc.position_id = p.id AND pc.stage NOT IN ('rejected', 'withdrawn')
                ) = 0 
                AND EXTRACT(DAY FROM v_now - p.created_at) > 7 
                THEN 1
                ELSE 2
            END as health_order
        FROM positions p
        WHERE p.user_id = v_user_id
          AND p.status = 'open'
        LIMIT p_limit
    ) position_data
    INTO v_result;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_position_health IS 'Returns open positions with health scores sorted by urgency';

-- ══════════════════════════════════════════════════════════════════════════
-- FUNCTION 5: get_recent_activities
-- Returns: recent activities for the analytics feed
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_recent_activities(p_limit INTEGER DEFAULT 10)
RETURNS JSON AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_result JSON;
BEGIN
    SELECT json_agg(activity_data ORDER BY created_at DESC)
    FROM (
        SELECT
            pa.id,
            pa.activity_type,
            pa.description,
            pa.created_at,
            pa.metadata,
            CASE
                WHEN pa.activity_type = 'stage_changed' 
                     AND pa.metadata->>'new_stage' = 'placed' 
                THEN 'placement'
                WHEN pa.activity_type = 'position_created' THEN 'position_created'
                WHEN pa.activity_type = 'stage_changed' THEN 'stage_change'
                ELSE 'other'
            END as display_type
        FROM position_activities pa
        JOIN positions p ON pa.position_id = p.id
        WHERE p.user_id = v_user_id
        ORDER BY pa.created_at DESC
        LIMIT p_limit
    ) activity_data
    INTO v_result;

    RETURN COALESCE(v_result, '[]'::JSON);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION get_recent_activities IS 'Returns recent position activities for analytics feed';

-- ══════════════════════════════════════════════════════════════════════════
-- Grant execute permissions
-- ══════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION get_analytics_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION get_pipeline_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_talent_pool_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_position_health(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_activities(INTEGER) TO authenticated;
