-- ============================================
-- PDF URL 컬럼 추가 (PDF 변환 결과 저장용)
-- ============================================
-- DOC, DOCX, HWP 파일을 PDF로 변환 후 Storage에 저장하고
-- 해당 URL을 candidates 테이블에 저장하여 PDF Viewer에서 사용

-- 1. candidates 테이블에 pdf_url 컬럼 추가
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- 2. 컬럼 설명 추가
COMMENT ON COLUMN candidates.pdf_url IS '변환된 PDF 파일의 Storage URL (원본이 PDF가 아닌 경우)';

-- 3. 인덱스 추가 (NULL이 아닌 경우에만)
CREATE INDEX IF NOT EXISTS idx_candidates_pdf_url
ON candidates (pdf_url)
WHERE pdf_url IS NOT NULL;
