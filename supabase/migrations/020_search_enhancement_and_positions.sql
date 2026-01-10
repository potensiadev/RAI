-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration 020: 검색 고도화 + 포지션 매칭 기능
-- 2026-01-10
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ══════════════════════════════════════════════════════════════════════════
-- PART 1: 검색 고도화 (Task 1 P0)
-- ══════════════════════════════════════════════════════════════════════════

-- 1.1 pg_trgm 확장 활성화 (Fuzzy 매칭용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1.2 candidates 테이블에 추가 인덱스
CREATE INDEX IF NOT EXISTS idx_candidates_last_company ON candidates(last_company);
CREATE INDEX IF NOT EXISTS idx_candidates_education_level ON candidates(education_level);
CREATE INDEX IF NOT EXISTS idx_candidates_updated_at ON candidates(updated_at);

-- 1.3 Immutable 래퍼 함수 (인덱스용)
CREATE OR REPLACE FUNCTION skills_to_text(skills TEXT[])
RETURNS TEXT AS $$
    SELECT array_to_string(skills, ' ')
$$ LANGUAGE SQL IMMUTABLE PARALLEL SAFE;

-- 1.4 트라이그램 인덱스 (Fuzzy 스킬 매칭용)
CREATE INDEX IF NOT EXISTS idx_candidates_skills_trgm ON candidates
  USING GIN (skills_to_text(skills) gin_trgm_ops);

-- 1.5 search_candidates 함수 업데이트 (회사 필터 추가)
CREATE OR REPLACE FUNCTION search_candidates(
    p_user_id UUID,
    p_query_embedding vector(1536),
    p_match_count INTEGER DEFAULT 10,
    p_exp_years_min INTEGER DEFAULT NULL,
    p_exp_years_max INTEGER DEFAULT NULL,
    p_skills TEXT[] DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    -- 신규 파라미터
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
          -- 기존 필터
          AND (p_exp_years_min IS NULL OR c.exp_years >= p_exp_years_min)
          AND (p_exp_years_max IS NULL OR c.exp_years <= p_exp_years_max)
          AND (p_skills IS NULL OR c.skills && p_skills)
          AND (p_location IS NULL OR c.location_city ILIKE '%' || p_location || '%')
          -- 신규 필터: 회사 포함
          AND (p_companies IS NULL OR EXISTS (
              SELECT 1 FROM unnest(p_companies) AS comp
              WHERE c.last_company ILIKE '%' || comp || '%'
          ))
          -- 신규 필터: 회사 제외
          AND (p_exclude_companies IS NULL OR NOT EXISTS (
              SELECT 1 FROM unnest(p_exclude_companies) AS comp
              WHERE c.last_company ILIKE '%' || comp || '%'
          ))
          -- 신규 필터: 학력
          AND (p_education_level IS NULL OR c.education_level = p_education_level)
    ),
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

-- ══════════════════════════════════════════════════════════════════════════
-- PART 2: 포지션 매칭 기능 (Task 2 P0)
-- ══════════════════════════════════════════════════════════════════════════

-- 2.1 positions 테이블
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- 기본 정보
    title TEXT NOT NULL,
    client_company TEXT,
    department TEXT,

    -- 상세 설명
    description TEXT,
    summary TEXT,

    -- 필수 요건
    required_skills TEXT[] DEFAULT '{}',
    preferred_skills TEXT[] DEFAULT '{}',
    min_exp_years INTEGER DEFAULT 0,
    max_exp_years INTEGER,

    -- 학력 요건
    required_education_level TEXT,
    preferred_majors TEXT[] DEFAULT '{}',

    -- 근무 조건
    location_city TEXT,
    job_type TEXT DEFAULT 'full-time',
    salary_min INTEGER,
    salary_max INTEGER,

    -- 벡터 검색용
    embedding vector(1536),

    -- 상태 관리
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'paused', 'closed', 'filled')),
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
    deadline DATE,

    -- 메타데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 positions 인덱스
CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
CREATE INDEX IF NOT EXISTS idx_positions_status ON positions(status);
CREATE INDEX IF NOT EXISTS idx_positions_priority ON positions(priority);
CREATE INDEX IF NOT EXISTS idx_positions_skills ON positions USING GIN(required_skills);
CREATE INDEX IF NOT EXISTS idx_positions_deadline ON positions(deadline);

-- 2.3 positions 벡터 인덱스
CREATE INDEX IF NOT EXISTS idx_positions_embedding ON positions
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 2.4 position_candidates 테이블 (매칭 결과)
CREATE TABLE IF NOT EXISTS position_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,

    -- 매칭 점수 (0-1)
    overall_score FLOAT NOT NULL,
    skill_score FLOAT,
    experience_score FLOAT,
    education_score FLOAT,
    semantic_score FLOAT,

    -- 매칭 상세
    matched_skills TEXT[] DEFAULT '{}',
    missing_skills TEXT[] DEFAULT '{}',
    match_explanation JSONB DEFAULT '{}',

    -- 상태 관리
    stage TEXT DEFAULT 'matched' CHECK (stage IN (
        'matched', 'reviewed', 'contacted', 'interviewing',
        'offered', 'placed', 'rejected', 'withdrawn'
    )),
    rejection_reason TEXT,
    notes TEXT,

    -- 타임스탬프
    matched_at TIMESTAMPTZ DEFAULT NOW(),
    stage_updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(position_id, candidate_id)
);

-- 2.5 position_candidates 인덱스
CREATE INDEX IF NOT EXISTS idx_position_candidates_position ON position_candidates(position_id);
CREATE INDEX IF NOT EXISTS idx_position_candidates_candidate ON position_candidates(candidate_id);
CREATE INDEX IF NOT EXISTS idx_position_candidates_stage ON position_candidates(stage);
CREATE INDEX IF NOT EXISTS idx_position_candidates_score ON position_candidates(overall_score DESC);

-- 2.6 position_activities 테이블 (활동 로그)
CREATE TABLE IF NOT EXISTS position_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,

    activity_type TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_position_activities_position ON position_activities(position_id);
CREATE INDEX IF NOT EXISTS idx_position_activities_created ON position_activities(created_at DESC);

-- ══════════════════════════════════════════════════════════════════════════
-- PART 3: RLS 정책
-- ══════════════════════════════════════════════════════════════════════════

-- 3.1 positions RLS
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS positions_select_own ON positions;
CREATE POLICY positions_select_own ON positions
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS positions_insert_own ON positions;
CREATE POLICY positions_insert_own ON positions
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS positions_update_own ON positions;
CREATE POLICY positions_update_own ON positions
    FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS positions_delete_own ON positions;
CREATE POLICY positions_delete_own ON positions
    FOR DELETE USING (user_id = auth.uid());

-- 3.2 position_candidates RLS
ALTER TABLE position_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS position_candidates_access ON position_candidates;
CREATE POLICY position_candidates_access ON position_candidates
    FOR ALL USING (
        position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
    );

-- 3.3 position_activities RLS
ALTER TABLE position_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS position_activities_access ON position_activities;
CREATE POLICY position_activities_access ON position_activities
    FOR ALL USING (
        position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
    );

-- ══════════════════════════════════════════════════════════════════════════
-- PART 4: 매칭 알고리즘 RPC 함수
-- ══════════════════════════════════════════════════════════════════════════

-- 4.1 포지션에 대한 후보자 매칭 함수
CREATE OR REPLACE FUNCTION match_candidates_to_position(
    p_position_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_min_score FLOAT DEFAULT 0.0
)
RETURNS TABLE (
    candidate_id UUID,
    candidate_name TEXT,
    last_position TEXT,
    last_company TEXT,
    exp_years INTEGER,
    skills TEXT[],
    photo_url TEXT,
    overall_score FLOAT,
    skill_score FLOAT,
    experience_score FLOAT,
    education_score FLOAT,
    semantic_score FLOAT,
    matched_skills TEXT[],
    missing_skills TEXT[]
) AS $$
DECLARE
    v_position RECORD;
    v_required_skills_count INTEGER;
BEGIN
    -- 포지션 정보 조회
    SELECT p.* INTO v_position
    FROM positions p
    WHERE p.id = p_position_id AND p.user_id = p_user_id;

    IF v_position IS NULL THEN
        RAISE EXCEPTION 'Position not found or access denied';
    END IF;

    v_required_skills_count := COALESCE(array_length(v_position.required_skills, 1), 0);

    RETURN QUERY
    WITH candidate_skill_match AS (
        SELECT
            c.id AS cid,
            c.name,
            c.last_position,
            c.last_company,
            c.exp_years,
            c.skills,
            c.photo_url,
            c.education_level,
            -- 매칭된 스킬
            ARRAY(
                SELECT s FROM unnest(v_position.required_skills) AS s
                WHERE s = ANY(c.skills)
            ) AS matched,
            -- 부족한 스킬
            ARRAY(
                SELECT s FROM unnest(v_position.required_skills) AS s
                WHERE NOT (s = ANY(c.skills))
            ) AS missing
        FROM candidates c
        WHERE c.user_id = p_user_id
          AND c.status = 'completed'
          AND c.is_latest = true
    ),
    scores AS (
        SELECT
            csm.cid,
            csm.name,
            csm.last_position,
            csm.last_company,
            csm.exp_years,
            csm.skills,
            csm.photo_url,
            csm.matched,
            csm.missing,
            -- Skill Score (0-1)
            CASE
                WHEN v_required_skills_count = 0 THEN 1.0
                ELSE COALESCE(array_length(csm.matched, 1), 0)::FLOAT / v_required_skills_count
            END AS s_score,
            -- Experience Score (0-1)
            CASE
                WHEN csm.exp_years < v_position.min_exp_years THEN
                    GREATEST(0.3, 1.0 - (v_position.min_exp_years - csm.exp_years) * 0.15)
                WHEN v_position.max_exp_years IS NOT NULL AND csm.exp_years > v_position.max_exp_years THEN
                    GREATEST(0.7, 1.0 - (csm.exp_years - v_position.max_exp_years) * 0.05)
                ELSE 1.0
            END AS e_score,
            -- Education Score (0-1)
            CASE
                WHEN v_position.required_education_level IS NULL THEN 1.0
                WHEN csm.education_level = v_position.required_education_level THEN 1.0
                WHEN csm.education_level IN ('master', 'doctorate') AND v_position.required_education_level = 'bachelor' THEN 1.0
                WHEN csm.education_level = 'doctorate' AND v_position.required_education_level = 'master' THEN 1.0
                WHEN csm.education_level = 'bachelor' AND v_position.required_education_level IN ('master', 'doctorate') THEN 0.7
                ELSE 0.5
            END AS edu_score
        FROM candidate_skill_match csm
    ),
    semantic_scores AS (
        SELECT
            cc.candidate_id,
            MAX(1 - (cc.embedding <=> v_position.embedding)) AS sem_score
        FROM candidate_chunks cc
        WHERE cc.candidate_id IN (SELECT cid FROM scores)
          AND cc.chunk_type = 'summary'
          AND v_position.embedding IS NOT NULL
        GROUP BY cc.candidate_id
    ),
    final_scores AS (
        SELECT
            s.cid,
            s.name,
            s.last_position,
            s.last_company,
            s.exp_years,
            s.skills,
            s.photo_url,
            s.matched,
            s.missing,
            s.s_score,
            s.e_score,
            s.edu_score,
            COALESCE(ss.sem_score, 0.5) AS sem_score,
            -- Overall Score = Skill(40%) + Experience(25%) + Education(15%) + Semantic(20%)
            (s.s_score * 0.40 + s.e_score * 0.25 + s.edu_score * 0.15 + COALESCE(ss.sem_score, 0.5) * 0.20) AS overall
        FROM scores s
        LEFT JOIN semantic_scores ss ON s.cid = ss.candidate_id
    )
    SELECT
        fs.cid,
        fs.name,
        fs.last_position,
        fs.last_company,
        fs.exp_years,
        fs.skills,
        fs.photo_url,
        fs.overall,
        fs.s_score,
        fs.e_score,
        fs.edu_score,
        fs.sem_score,
        fs.matched,
        fs.missing
    FROM final_scores fs
    WHERE fs.overall >= p_min_score
    ORDER BY fs.overall DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 매칭 결과 저장 함수
CREATE OR REPLACE FUNCTION save_position_matches(
    p_position_id UUID,
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50,
    p_min_score FLOAT DEFAULT 0.3
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_match RECORD;
BEGIN
    -- 기존 'matched' 상태의 매칭만 삭제 (진행중인 것은 유지)
    DELETE FROM position_candidates
    WHERE position_id = p_position_id
      AND stage = 'matched';

    -- 새 매칭 저장
    FOR v_match IN
        SELECT * FROM match_candidates_to_position(p_position_id, p_user_id, p_limit, p_min_score)
    LOOP
        INSERT INTO position_candidates (
            position_id,
            candidate_id,
            overall_score,
            skill_score,
            experience_score,
            education_score,
            semantic_score,
            matched_skills,
            missing_skills,
            stage
        ) VALUES (
            p_position_id,
            v_match.candidate_id,
            v_match.overall_score,
            v_match.skill_score,
            v_match.experience_score,
            v_match.education_score,
            v_match.semantic_score,
            v_match.matched_skills,
            v_match.missing_skills,
            'matched'
        )
        ON CONFLICT (position_id, candidate_id) DO UPDATE SET
            overall_score = EXCLUDED.overall_score,
            skill_score = EXCLUDED.skill_score,
            experience_score = EXCLUDED.experience_score,
            education_score = EXCLUDED.education_score,
            semantic_score = EXCLUDED.semantic_score,
            matched_skills = EXCLUDED.matched_skills,
            missing_skills = EXCLUDED.missing_skills;

        v_count := v_count + 1;
    END LOOP;

    -- 활동 로그 기록
    INSERT INTO position_activities (position_id, activity_type, description, metadata, created_by)
    VALUES (
        p_position_id,
        'matches_refreshed',
        v_count || '명의 후보자가 매칭되었습니다.',
        jsonb_build_object('match_count', v_count, 'min_score', p_min_score),
        p_user_id
    );

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.3 positions updated_at 트리거
CREATE OR REPLACE FUNCTION update_positions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_positions_updated_at ON positions;
CREATE TRIGGER trigger_positions_updated_at
    BEFORE UPDATE ON positions
    FOR EACH ROW
    EXECUTE FUNCTION update_positions_updated_at();

-- 4.4 position_candidates stage 변경 트리거
CREATE OR REPLACE FUNCTION update_position_candidates_stage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
        NEW.stage_updated_at = NOW();

        -- 활동 로그 기록
        INSERT INTO position_activities (position_id, candidate_id, activity_type, description, metadata)
        VALUES (
            NEW.position_id,
            NEW.candidate_id,
            'stage_changed',
            '상태가 ' || OLD.stage || '에서 ' || NEW.stage || '로 변경되었습니다.',
            jsonb_build_object('old_stage', OLD.stage, 'new_stage', NEW.stage)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_position_candidates_stage ON position_candidates;
CREATE TRIGGER trigger_position_candidates_stage
    BEFORE UPDATE ON position_candidates
    FOR EACH ROW
    EXECUTE FUNCTION update_position_candidates_stage_timestamp();

-- ══════════════════════════════════════════════════════════════════════════
-- PART 5: 코멘트
-- ══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE positions IS '헤드헌터가 관리하는 채용 포지션 (JD)';
COMMENT ON TABLE position_candidates IS '포지션-후보자 매칭 결과 및 진행 상태';
COMMENT ON TABLE position_activities IS '포지션 관련 활동 로그';
COMMENT ON FUNCTION match_candidates_to_position IS '포지션에 적합한 후보자 매칭 (스킬40% + 경력25% + 학력15% + 시맨틱20%)';
COMMENT ON FUNCTION save_position_matches IS '매칭 결과를 position_candidates 테이블에 저장';
