-- Migration: Stress Test Optimization
-- Date: 2026-01-29
-- Purpose: Optimize indexes for 1000+ users, 5M candidates, 2M positions scale
-- Reference: DBA Analysis for large-scale deployment

-- ═══════════════════════════════════════════════════════
-- 1. candidates: 목록 정렬 최적화
-- 용도: 유저별 후보자 목록 조회 시 ORDER BY created_at DESC 최적화
-- 예상 효과: 100ms → 30ms
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_candidates_user_created
ON candidates (user_id, created_at DESC)
WHERE is_latest = true;


-- ═══════════════════════════════════════════════════════
-- 2. position_candidates: 파이프라인 통계 최적화
-- 용도: 대시보드에서 stage별 COUNT 쿼리 최적화
-- 예상 효과: 500ms → 50ms
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_position_candidates_user_stage
ON position_candidates (user_id, stage);


-- ═══════════════════════════════════════════════════════
-- 3. position_activities: 최근 활동 조회 최적화
-- 용도: 유저별 활동 타입별 최근 활동 조회
-- 예상 효과: 300ms → 30ms
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_position_activities_user_type_created
ON position_activities (user_id, activity_type, created_at DESC);


-- ═══════════════════════════════════════════════════════
-- 4. candidate_chunks: user_id 비정규화
-- 용도: Vector 검색 시 user_id 직접 필터링 (JOIN 제거)
-- 주의: 대량 데이터 UPDATE 필요 - 운영 환경에서는 배치로 실행 권장
-- ═══════════════════════════════════════════════════════

-- 4.1 컬럼 추가
ALTER TABLE candidate_chunks
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- 4.2 기존 데이터 백필 (candidates 테이블에서 user_id 복사)
-- 주의: 대량 데이터 시 타임아웃 발생 가능 - 배치 처리 권장
UPDATE candidate_chunks cc
SET user_id = c.user_id
FROM candidates c
WHERE cc.candidate_id = c.id
  AND cc.user_id IS NULL;

-- 4.3 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_candidate_chunks_user_id
ON candidate_chunks (user_id);


-- ═══════════════════════════════════════════════════════
-- 5. candidate_chunks: 복합 인덱스 (Vector 검색 최적화)
-- 용도: candidate_id + chunk_type 조합 조회 최적화
-- 예상 효과: Vector 검색 pre-filter 가속
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_candidate_chunks_candidate_type
ON candidate_chunks (candidate_id, chunk_type);


-- ═══════════════════════════════════════════════════════
-- 추가: candidate_chunks INSERT 트리거 (user_id 자동 설정)
-- 새로 생성되는 chunk에 user_id 자동 복사
-- ═══════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_candidate_chunk_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        SELECT user_id INTO NEW.user_id
        FROM candidates
        WHERE id = NEW.candidate_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_candidate_chunk_user_id ON candidate_chunks;
CREATE TRIGGER trigger_set_candidate_chunk_user_id
    BEFORE INSERT ON candidate_chunks
    FOR EACH ROW
    EXECUTE FUNCTION set_candidate_chunk_user_id();


-- ═══════════════════════════════════════════════════════
-- 검증 쿼리 (마이그레이션 후 실행하여 확인)
-- ═══════════════════════════════════════════════════════

-- 인덱스 생성 확인:
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename IN ('candidates', 'position_candidates', 'position_activities', 'candidate_chunks')
-- ORDER BY tablename, indexname;

-- candidate_chunks user_id 백필 확인:
-- SELECT COUNT(*) as total, COUNT(user_id) as with_user_id
-- FROM candidate_chunks;
