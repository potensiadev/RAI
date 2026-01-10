# RAI 기능 고도화 기획서
**작성일:** 2026-01-10
**버전:** 1.0

---

## 목차
1. [Task 1: 후보자 검색 효율화 고도화](#task-1-후보자-검색-효율화-고도화)
2. [Task 2: 포지션-후보자 매칭 기능](#task-2-포지션-후보자-매칭-기능)

---

# Task 1: 후보자 검색 효율화 고도화

## 1.1 현재 구현 분석

### 현재 아키텍처
```
사용자 쿼리
    ↓
    ├─→ 10자 이상: Semantic Search (Vector)
    │       ↓
    │   OpenAI Embedding (text-embedding-3-small, 1536차원)
    │       ↓
    │   search_candidates RPC
    │       ├─→ RDB 필터: user_id, status, is_latest
    │       ├─→ RDB 필터: exp_years, skills, location
    │       ├─→ 청크별 cosine similarity 계산
    │       └─→ 가중치 적용 후 상위 N개 반환
    │
    └─→ 10자 미만: Keyword Search (RDB)
            ↓
        ILIKE 검색 (skills, position, company, name)
```

### 주요 파일
| 파일 | 역할 |
|------|------|
| `/app/api/search/route.ts` | 검색 API (348줄) |
| `/supabase/migrations/001_initial_schema.sql` | DB 스키마 및 RPC 함수 |
| `/hooks/useSearch.ts` | 프론트엔드 검색 훅 |
| `/lib/openai/embedding.ts` | 임베딩 생성 서비스 |

### 현재 필터
| 필터 | 구현 상태 | 비고 |
|------|----------|------|
| `expYearsMin/Max` | ✅ 완료 | RPC에서 처리 |
| `skills[]` | ✅ 완료 | 배열 교집합 |
| `location` | ✅ 완료 | ILIKE 매칭 |
| `educationLevel` | ❌ 미구현 | 타입만 정의됨 |
| `company` | ❌ 미구현 | 타입만 정의됨 |

### 청크 타입별 가중치
```typescript
CHUNK_WEIGHTS = {
  summary: 1.0,    // 최고 우선순위
  career: 0.9,
  skill: 0.85,
  project: 0.8,
  education: 0.5   // 최저 우선순위
}
```

---

## 1.2 현재 한계점

### 1.2.1 검색 품질 이슈

| 문제 | 설명 | 영향도 |
|------|------|--------|
| **쿼리 길이 휴리스틱** | 10자 기준 시맨틱/키워드 전환은 임의적 | 중 |
| **Fuzzy 매칭 없음** | "Pyton" → "Python" 매칭 불가 | 상 |
| **동의어 처리 없음** | "JS" ≠ "JavaScript", "React.js" ≠ "ReactJS" | 상 |
| **고정 가중치** | 기술 검색 시 skill 청크가 summary보다 중요할 수 있음 | 중 |
| **피드백 미활용** | search_feedback 수집만 하고 랭킹에 반영 안함 | 중 |

### 1.2.2 필터 부족

| 누락 필터 | 헤드헌터 필요성 |
|-----------|----------------|
| 학력 필터 | "석사 이상" 조건 JD 빈번 |
| 회사 필터 | "삼성 출신", "스타트업 경험자" 검색 |
| 기간 필터 | "최근 1년 내 업데이트된 이력서" |
| 현직 여부 | "현재 재직중" vs "구직중" |

### 1.2.3 UX 이슈

| 문제 | 설명 |
|------|------|
| **Facet 미제공** | 스킬/회사/지역별 집계 카운트 없음 |
| **매칭 이유 미설명** | 왜 이 후보자가 상위인지 알 수 없음 |
| **저장된 검색 없음** | 자주 쓰는 검색 조건 저장 불가 |
| **검색 히스토리 없음** | 이전 검색 재실행 불가 |

### 1.2.4 성능 이슈

| 문제 | 현재 상태 | 개선 방안 |
|------|----------|----------|
| OpenAI API 지연 | 검색당 1회 호출 | 쿼리 임베딩 캐싱 |
| IVFFlat 고정 설정 | lists=100 하드코딩 | 데이터량 기반 동적 조정 |
| 페이지네이션 | 앱 레벨에서만 처리 | RPC에 offset 추가 |

---

## 1.3 고도화 기획

### 1.3.1 Phase 1: 필수 필터 추가

**목표:** 헤드헌터 실무에서 자주 사용하는 필터 완성

#### 추가할 필터

```typescript
interface SearchFilters {
  // 기존
  expYearsMin?: number;
  expYearsMax?: number;
  skills?: string[];
  location?: string;

  // 신규 추가
  educationLevel?: 'high_school' | 'associate' | 'bachelor' | 'master' | 'doctorate';
  companies?: string[];           // 특정 회사 출신 검색
  excludeCompanies?: string[];    // 특정 회사 제외
  isCurrentlyEmployed?: boolean;  // 현재 재직중 여부
  updatedAfter?: string;          // 최근 업데이트 기준 (ISO date)
  hasPhoto?: boolean;             // 사진 보유 여부
}
```

#### DB 스키마 변경
```sql
-- candidates 테이블에 인덱스 추가
CREATE INDEX idx_candidates_education_level ON candidates(education_level);
CREATE INDEX idx_candidates_updated_at ON candidates(updated_at);

-- is_currently_employed 컬럼 추가 (careers JSONB에서 파생)
ALTER TABLE candidates ADD COLUMN is_currently_employed BOOLEAN
  GENERATED ALWAYS AS (
    EXISTS (SELECT 1 FROM jsonb_array_elements(careers) AS c WHERE c->>'isCurrent' = 'true')
  ) STORED;
```

#### RPC 함수 수정
```sql
-- search_candidates 파라미터 확장
CREATE OR REPLACE FUNCTION search_candidates(
  p_user_id UUID,
  p_query_embedding vector(1536),
  p_match_count INTEGER DEFAULT 10,
  -- 기존
  p_exp_years_min INTEGER DEFAULT NULL,
  p_exp_years_max INTEGER DEFAULT NULL,
  p_skills TEXT[] DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  -- 신규
  p_education_level TEXT DEFAULT NULL,
  p_companies TEXT[] DEFAULT NULL,
  p_exclude_companies TEXT[] DEFAULT NULL,
  p_is_currently_employed BOOLEAN DEFAULT NULL,
  p_updated_after TIMESTAMPTZ DEFAULT NULL
)
```

---

### 1.3.2 Phase 2: 검색 품질 개선

#### 2.1 동의어 사전 (Synonym Dictionary)

```typescript
// /lib/search/synonyms.ts
const SKILL_SYNONYMS: Record<string, string[]> = {
  'JavaScript': ['JS', 'javascript', 'ECMAScript', 'ES6', 'ES2015'],
  'TypeScript': ['TS', 'typescript'],
  'React': ['React.js', 'ReactJS', 'react.js'],
  'Vue': ['Vue.js', 'VueJS', 'vue.js'],
  'Python': ['python', 'Python3', 'py'],
  'Java': ['java', 'JDK', 'J2EE'],
  'PostgreSQL': ['Postgres', 'psql', 'PG'],
  'MongoDB': ['Mongo', 'mongo'],
  // ... 확장
};

function expandQuery(query: string): string[] {
  // 쿼리에서 스킬 키워드 추출 후 동의어로 확장
}
```

**적용 방식:**
- 키워드 검색 시: OR 조건으로 동의어 포함
- 시맨틱 검색 시: 쿼리 전처리로 정규화

#### 2.2 Fuzzy 매칭 (PostgreSQL pg_trgm)

```sql
-- Extension 활성화
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 트라이그램 인덱스 추가
CREATE INDEX idx_candidates_skills_trgm ON candidates
  USING GIN (array_to_string(skills, ' ') gin_trgm_ops);

-- 유사도 검색 함수
CREATE FUNCTION fuzzy_skill_match(
  p_skills TEXT[],
  p_query TEXT,
  p_threshold FLOAT DEFAULT 0.3
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM unnest(p_skills) AS skill
    WHERE similarity(skill, p_query) > p_threshold
  );
END;
$$ LANGUAGE plpgsql;
```

**예시:**
- 쿼리: "Pyton" → "Python" (similarity: 0.67)
- 쿼리: "Recat" → "React" (similarity: 0.6)

#### 2.3 쿼리 의도 분류 (Query Intent Classification)

현재 10자 기준 대신 의도 기반 분류:

```typescript
type QueryIntent = 'skill_search' | 'name_search' | 'company_search' | 'semantic_search';

function classifyQueryIntent(query: string): QueryIntent {
  // 패턴 기반 분류
  if (/^[가-힣]{2,4}$/.test(query)) return 'name_search';           // 한글 이름
  if (KNOWN_COMPANIES.has(query)) return 'company_search';          // 회사명
  if (KNOWN_SKILLS.has(query.toLowerCase())) return 'skill_search'; // 기술 스택
  return 'semantic_search';                                         // 자연어
}
```

**검색 경로:**
- `name_search`: 이름 필드 exact/prefix 매칭
- `company_search`: 회사 필드 ILIKE + 동의어
- `skill_search`: 스킬 배열 검색 + fuzzy + 동의어
- `semantic_search`: 벡터 검색

#### 2.4 적응형 청크 가중치

쿼리 의도에 따라 가중치 조정:

```typescript
function getChunkWeights(intent: QueryIntent): ChunkWeights {
  switch (intent) {
    case 'skill_search':
      return { summary: 0.6, career: 0.8, skill: 1.0, project: 0.9, education: 0.3 };
    case 'company_search':
      return { summary: 0.7, career: 1.0, skill: 0.5, project: 0.6, education: 0.4 };
    default:
      return { summary: 1.0, career: 0.9, skill: 0.85, project: 0.8, education: 0.5 };
  }
}
```

---

### 1.3.3 Phase 3: UX 개선

#### 3.1 Faceted Search 결과

```typescript
interface SearchResponse {
  results: CandidateSearchResult[];
  total: number;
  facets: {
    skills: FacetItem[];      // { value: "Python", count: 45 }
    companies: FacetItem[];   // { value: "삼성전자", count: 12 }
    locations: FacetItem[];   // { value: "서울", count: 89 }
    expYears: {               // 경력 분포
      '0-3': number;
      '3-5': number;
      '5-10': number;
      '10+': number;
    };
  };
}
```

**구현:**
```sql
-- Facet 집계 쿼리 (별도 RPC)
CREATE FUNCTION get_search_facets(
  p_user_id UUID,
  p_base_filters JSONB
) RETURNS JSONB AS $$
  -- 필터 적용 후 각 필드별 GROUP BY + COUNT
$$;
```

#### 3.2 매칭 이유 설명 (Match Explanation)

```typescript
interface CandidateSearchResult {
  // 기존 필드...
  matchScore: number;

  // 신규: 매칭 이유
  matchExplanation: {
    topMatchedChunks: {
      type: ChunkType;
      content: string;      // 하이라이트된 매칭 부분
      score: number;
    }[];
    matchedSkills: string[];           // 쿼리와 일치한 스킬
    experienceMatch: 'exact' | 'over' | 'under' | null;
  };
}
```

**UI 표시:**
> **매칭 이유:** Python (스킬 일치), 5년 경력 (요건 충족), "대규모 트래픽 처리 경험" (프로젝트에서 발견)

#### 3.3 저장된 검색 (Saved Searches)

```sql
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  query TEXT,
  filters JSONB DEFAULT '{}',

  -- 알림 설정
  notify_on_new_match BOOLEAN DEFAULT false,
  last_notified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**기능:**
- 현재 검색 조건 저장
- 저장된 검색 빠른 실행
- 새 후보자 매칭 시 알림 (선택적)

---

### 1.3.4 Phase 4: 피드백 기반 랭킹 최적화

#### 4.1 피드백 데이터 활용

현재 수집되는 피드백:
```typescript
feedbackType: 'relevant' | 'not_relevant' | 'clicked' | 'contacted'
```

**랭킹 보정 공식:**
```typescript
function adjustedScore(baseScore: number, candidateId: string, userId: string): number {
  const feedback = await getFeedbackHistory(candidateId, userId);

  let adjustment = 0;
  if (feedback.contacted) adjustment += 0.1;  // 연락한 적 있음 → 선호
  if (feedback.relevant) adjustment += 0.05;  // 관련있다고 표시
  if (feedback.notRelevant) adjustment -= 0.15; // 관련없다고 표시

  return Math.min(1, Math.max(0, baseScore + adjustment));
}
```

#### 4.2 검색 분석 대시보드

```typescript
interface SearchAnalytics {
  // 검색 품질 지표
  totalSearches: number;
  zeroResultRate: number;          // 결과 없는 검색 비율
  avgResultsPerSearch: number;

  // 사용자 행동
  clickThroughRate: number;        // 결과 클릭률
  contactRate: number;             // 연락 전환률

  // 인기 검색
  topQueries: { query: string; count: number }[];
  topSkills: { skill: string; count: number }[];
}
```

---

## 1.4 구현 우선순위

| 우선순위 | 항목 | 이유 |
|---------|------|------|
| **P0** | 회사 필터 | 헤드헌터 필수 요건 "삼성 출신" |
| **P0** | 동의어 처리 | JS/JavaScript 불일치 해결 |
| **P1** | Fuzzy 매칭 | 오타 허용으로 UX 개선 |
| **P1** | 학력 필터 | "석사 이상" 조건 빈번 |
| **P1** | 매칭 이유 설명 | 왜 이 후보자인지 신뢰도 |
| **P2** | Faceted Search | 필터 탐색 용이 |
| **P2** | 저장된 검색 | 반복 검색 효율화 |
| **P2** | 적응형 가중치 | 검색 정확도 향상 |
| **P3** | 검색 분석 | 장기 최적화 |
| **P3** | 피드백 랭킹 | ML 기반 개인화 |

---

# Task 2: 포지션-후보자 매칭 기능

## 2.1 기능 개요

### 헤드헌터 워크플로우
```
1. 고객사로부터 JD(Job Description) 수령
2. JD 분석하여 필요 조건 파악
3. 보유 후보자 풀에서 적합한 후보자 검색
4. 후보자별 적합도 평가
5. 고객사에 추천
```

### RAI가 자동화할 부분
```
JD 등록 → 조건 자동 추출 → 후보자 자동 매칭 → 적합도 점수 & 설명 제공
```

---

## 2.2 데이터 모델

### 2.2.1 positions 테이블

```sql
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 기본 정보
  title TEXT NOT NULL,                    -- 포지션명: "시니어 백엔드 개발자"
  client_company TEXT,                    -- 고객사명 (선택)
  department TEXT,                        -- 부서명

  -- 상세 설명
  description TEXT,                       -- JD 원문
  summary TEXT,                           -- AI 요약

  -- 필수 요건
  required_skills TEXT[] DEFAULT '{}',    -- 필수 스킬
  preferred_skills TEXT[] DEFAULT '{}',   -- 우대 스킬
  min_exp_years INTEGER DEFAULT 0,        -- 최소 경력
  max_exp_years INTEGER,                  -- 최대 경력 (NULL = 무관)

  -- 학력 요건
  required_education_level TEXT,          -- 최소 학력
  preferred_majors TEXT[] DEFAULT '{}',   -- 선호 전공

  -- 근무 조건
  location_city TEXT,                     -- 근무지
  job_type TEXT DEFAULT 'full-time',      -- full-time, contract, freelance
  salary_min INTEGER,                     -- 연봉 하한 (만원)
  salary_max INTEGER,                     -- 연봉 상한 (만원)

  -- 벡터 검색용
  embedding vector(1536),                 -- JD 임베딩

  -- 상태 관리
  status TEXT DEFAULT 'open',             -- open, paused, closed, filled
  priority TEXT DEFAULT 'normal',         -- urgent, high, normal, low
  deadline DATE,                          -- 마감일

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_skills ON positions USING GIN(required_skills);
CREATE INDEX idx_positions_embedding ON positions
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

### 2.2.2 position_candidates 테이블 (매칭 결과)

```sql
CREATE TABLE position_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,

  -- 매칭 점수 (0-100)
  overall_score FLOAT NOT NULL,
  skill_score FLOAT,                      -- 스킬 매칭 점수
  experience_score FLOAT,                 -- 경력 매칭 점수
  education_score FLOAT,                  -- 학력 매칭 점수
  semantic_score FLOAT,                   -- 시맨틱 유사도

  -- 매칭 상세
  matched_skills TEXT[] DEFAULT '{}',     -- 일치하는 스킬
  missing_skills TEXT[] DEFAULT '{}',     -- 부족한 필수 스킬
  match_explanation JSONB DEFAULT '{}',   -- AI 생성 매칭 설명

  -- 상태 관리
  stage TEXT DEFAULT 'matched',           -- matched, reviewed, contacted, interviewing, offered, placed, rejected
  rejection_reason TEXT,                  -- 제외 사유
  notes TEXT,                             -- 헤드헌터 메모

  -- 타임스탬프
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  stage_updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(position_id, candidate_id)
);

-- 인덱스
CREATE INDEX idx_position_candidates_position ON position_candidates(position_id);
CREATE INDEX idx_position_candidates_stage ON position_candidates(stage);
CREATE INDEX idx_position_candidates_score ON position_candidates(overall_score DESC);
```

### 2.2.3 position_activities 테이블 (활동 로그)

```sql
CREATE TABLE position_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,

  activity_type TEXT NOT NULL,            -- stage_change, note_added, contacted, etc.
  description TEXT,
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);
```

---

## 2.3 매칭 알고리즘

### 2.3.1 점수 계산 공식

```
Overall Score = (Skill × 0.40) + (Experience × 0.25) + (Education × 0.15) + (Semantic × 0.20)
```

#### Skill Score (40%)
```typescript
function calculateSkillScore(candidate: Candidate, position: Position): number {
  const required = position.requiredSkills;
  const preferred = position.preferredSkills;
  const candidateSkills = candidate.skills.map(s => s.toLowerCase());

  // 필수 스킬 매칭 (70% 비중)
  const requiredMatched = required.filter(s =>
    candidateSkills.includes(s.toLowerCase()) ||
    hasSynonymMatch(s, candidateSkills)
  );
  const requiredScore = required.length > 0
    ? requiredMatched.length / required.length
    : 1;

  // 우대 스킬 매칭 (30% 비중)
  const preferredMatched = preferred.filter(s =>
    candidateSkills.includes(s.toLowerCase())
  );
  const preferredScore = preferred.length > 0
    ? preferredMatched.length / preferred.length
    : 0;

  return (requiredScore * 0.7) + (preferredScore * 0.3);
}
```

#### Experience Score (25%)
```typescript
function calculateExperienceScore(candidate: Candidate, position: Position): number {
  const exp = candidate.expYears;
  const min = position.minExpYears;
  const max = position.maxExpYears;

  if (exp < min) {
    // 경력 부족: 부족한 만큼 감점 (최소 0.3)
    return Math.max(0.3, 1 - (min - exp) * 0.15);
  }
  if (max && exp > max) {
    // 경력 초과: 약간 감점 (오버스펙)
    return Math.max(0.7, 1 - (exp - max) * 0.05);
  }
  return 1.0; // 적정 범위
}
```

#### Education Score (15%)
```typescript
const EDUCATION_LEVELS = {
  'high_school': 1,
  'associate': 2,
  'bachelor': 3,
  'master': 4,
  'doctorate': 5
};

function calculateEducationScore(candidate: Candidate, position: Position): number {
  if (!position.requiredEducationLevel) return 1.0;

  const required = EDUCATION_LEVELS[position.requiredEducationLevel];
  const actual = EDUCATION_LEVELS[candidate.educationLevel] || 3;

  if (actual >= required) return 1.0;
  if (actual === required - 1) return 0.7; // 한 단계 낮음
  return 0.4; // 두 단계 이상 낮음
}
```

#### Semantic Score (20%)
```typescript
async function calculateSemanticScore(
  candidate: Candidate,
  position: Position
): Promise<number> {
  // 후보자의 summary 청크와 포지션 임베딩 간 유사도
  const candidateChunks = await getCandidateChunks(candidate.id, 'summary');
  const positionEmbedding = position.embedding;

  const similarities = candidateChunks.map(chunk =>
    cosineSimilarity(chunk.embedding, positionEmbedding)
  );

  return Math.max(...similarities);
}
```

### 2.3.2 RPC 함수

```sql
CREATE OR REPLACE FUNCTION match_candidates_to_position(
  p_position_id UUID,
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_min_score FLOAT DEFAULT 0.0
)
RETURNS TABLE (
  candidate_id UUID,
  candidate_name TEXT,
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
BEGIN
  -- 포지션 정보 조회
  SELECT * INTO v_position FROM positions
  WHERE id = p_position_id AND user_id = p_user_id;

  RETURN QUERY
  WITH skill_analysis AS (
    SELECT
      c.id,
      c.name,
      c.skills,
      c.exp_years,
      c.education_level,
      -- 스킬 매칭
      array_agg(DISTINCT s) FILTER (WHERE s = ANY(c.skills)) as matched,
      array_agg(DISTINCT s) FILTER (WHERE s != ALL(c.skills)) as missing
    FROM candidates c
    CROSS JOIN unnest(v_position.required_skills) AS s
    WHERE c.user_id = p_user_id
      AND c.status = 'completed'
      AND c.is_latest = true
    GROUP BY c.id, c.name, c.skills, c.exp_years, c.education_level
  ),
  semantic_scores AS (
    SELECT
      cc.candidate_id,
      MAX(1 - (cc.embedding <=> v_position.embedding)) as semantic_score
    FROM candidate_chunks cc
    WHERE cc.candidate_id IN (SELECT id FROM skill_analysis)
      AND cc.chunk_type = 'summary'
    GROUP BY cc.candidate_id
  )
  SELECT
    sa.id,
    sa.name,
    -- Overall Score 계산
    (
      (COALESCE(array_length(sa.matched, 1), 0)::FLOAT /
       NULLIF(array_length(v_position.required_skills, 1), 0) * 0.4) +
      (CASE
        WHEN sa.exp_years < v_position.min_exp_years THEN 0.5
        WHEN v_position.max_exp_years IS NULL OR sa.exp_years <= v_position.max_exp_years THEN 1.0
        ELSE 0.8
      END * 0.25) +
      (1.0 * 0.15) + -- education simplified
      (COALESCE(ss.semantic_score, 0.5) * 0.20)
    ) as overall_score,
    -- 개별 점수들
    COALESCE(array_length(sa.matched, 1), 0)::FLOAT /
      NULLIF(array_length(v_position.required_skills, 1), 0),
    CASE
      WHEN sa.exp_years < v_position.min_exp_years THEN 0.5
      WHEN v_position.max_exp_years IS NULL OR sa.exp_years <= v_position.max_exp_years THEN 1.0
      ELSE 0.8
    END,
    1.0,
    COALESCE(ss.semantic_score, 0.5),
    sa.matched,
    sa.missing
  FROM skill_analysis sa
  LEFT JOIN semantic_scores ss ON sa.id = ss.candidate_id
  WHERE (
    (COALESCE(array_length(sa.matched, 1), 0)::FLOAT /
     NULLIF(array_length(v_position.required_skills, 1), 0) * 0.4) +
    (CASE
      WHEN sa.exp_years < v_position.min_exp_years THEN 0.5
      WHEN v_position.max_exp_years IS NULL OR sa.exp_years <= v_position.max_exp_years THEN 1.0
      ELSE 0.8
    END * 0.25) +
    (1.0 * 0.15) +
    (COALESCE(ss.semantic_score, 0.5) * 0.20)
  ) >= p_min_score
  ORDER BY overall_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 2.4 API 설계

### 2.4.1 포지션 CRUD

```typescript
// POST /api/positions
interface CreatePositionRequest {
  title: string;
  clientCompany?: string;
  description: string;
  requiredSkills: string[];
  preferredSkills?: string[];
  minExpYears: number;
  maxExpYears?: number;
  requiredEducationLevel?: string;
  locationCity?: string;
  salaryMin?: number;
  salaryMax?: number;
  deadline?: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
}

interface CreatePositionResponse {
  position: Position;
  initialMatches: PositionCandidate[]; // 상위 10명 즉시 매칭
}

// GET /api/positions
// GET /api/positions/:id
// PATCH /api/positions/:id
// DELETE /api/positions/:id
```

### 2.4.2 매칭 API

```typescript
// GET /api/positions/:id/matches
interface GetMatchesRequest {
  limit?: number;           // default: 50
  minScore?: number;        // 최소 점수 필터
  stage?: string;           // 단계 필터
  sortBy?: 'score' | 'recent';
}

interface GetMatchesResponse {
  matches: PositionCandidate[];
  total: number;
  scoreDistribution: {
    excellent: number;  // 80-100
    good: number;       // 60-80
    fair: number;       // 40-60
    low: number;        // 0-40
  };
}

// POST /api/positions/:id/matches/refresh
// 새 후보자 추가 시 재매칭

// PATCH /api/positions/:positionId/matches/:candidateId
interface UpdateMatchRequest {
  stage?: string;
  notes?: string;
  rejectionReason?: string;
}
```

---

## 2.5 UI/UX 설계

### 2.5.1 포지션 목록 페이지 (`/positions`)

```
┌─────────────────────────────────────────────────────────────┐
│  📋 포지션 관리                              [+ 새 포지션]  │
├─────────────────────────────────────────────────────────────┤
│  필터: [상태 ▼] [우선순위 ▼] [마감일순 ▼]                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔴 [긴급] 시니어 백엔드 개발자                      │   │
│  │ 삼성전자 | Python, Django, PostgreSQL               │   │
│  │ 5-10년 | 서울                                       │   │
│  │ 매칭: 23명 | 인터뷰: 3명 | 마감: 2026-01-20        │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🟢 프론트엔드 개발자                                │   │
│  │ 네이버 | React, TypeScript                          │   │
│  │ 3-7년 | 판교                                        │   │
│  │ 매칭: 45명 | 인터뷰: 1명 | 마감: 2026-02-15        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.5.2 포지션 상세/매칭 페이지 (`/positions/:id`)

```
┌─────────────────────────────────────────────────────────────┐
│  ← 시니어 백엔드 개발자 @ 삼성전자         [수정] [닫기]   │
├─────────────────────────────────────────────────────────────┤
│  [요건]  [매칭 후보자 (23)]  [진행 현황]  [활동 로그]      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌── 점수 분포 ──────────────────────────────────────────┐ │
│  │  🟢 Excellent (80+): 5명                              │ │
│  │  🟡 Good (60-80): 12명                                │ │
│  │  🟠 Fair (40-60): 6명                                 │ │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⭐ 92점 | 김철수 | 백엔드 개발자 @ 카카오            │   │
│  │ ✓ Python ✓ Django ✓ PostgreSQL ✗ AWS               │   │
│  │ 경력 7년 | 서울대 컴공 석사                          │   │
│  │ 📝 "대규모 트래픽 처리 경험, MSA 전환 프로젝트 리드" │   │
│  │ [상세보기] [연락하기] [제외]                         │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⭐ 87점 | 이영희 | 시니어 개발자 @ 라인              │   │
│  │ ✓ Python ✓ Django ✗ PostgreSQL ✓ AWS               │   │
│  │ 경력 6년 | 고려대 컴공                               │   │
│  │ 📝 "결제 시스템 개발, 일 1억건 트랜잭션 처리"       │   │
│  │ [상세보기] [연락하기] [제외]                         │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.5.3 칸반 보드 뷰 (`/positions/:id/pipeline`)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  매칭됨 (23)    검토중 (8)    연락함 (5)    인터뷰 (3)    최종 (1)     │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────┐       ┌─────┐       ┌─────┐       ┌─────┐       ┌─────┐      │
│  │김철수│  →   │박민수│  →   │이영희│  →   │최지원│  →   │정우성│      │
│  │ 92점│       │ 85점│       │ 87점│       │ 82점│       │ 79점│      │
│  └─────┘       └─────┘       └─────┘       └─────┘       └─────┘      │
│  ┌─────┐       ┌─────┐       ┌─────┐       ┌─────┐                    │
│  │박지영│       │송민호│       │한소희│       │김태리│                    │
│  │ 88점│       │ 81점│       │ 84점│       │ 80점│                    │
│  └─────┘       └─────┘       └─────┘       └─────┘                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.5.4 포지션 생성 폼

```
┌─────────────────────────────────────────────────────────────┐
│  새 포지션 등록                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  포지션명 *                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 시니어 백엔드 개발자                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  고객사명                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 삼성전자                                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  JD 상세 설명                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ (JD 붙여넣기 또는 직접 입력)                         │   │
│  │                                                       │   │
│  │ [AI 자동 추출] ← 클릭 시 스킬/경력 자동 파싱         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  필수 스킬                                                  │
│  [Python] [Django] [PostgreSQL] [+ 추가]                   │
│                                                             │
│  우대 스킬                                                  │
│  [AWS] [Docker] [+ 추가]                                   │
│                                                             │
│  경력        [5년] ~ [10년]                                │
│  학력        [학사 이상 ▼]                                  │
│  근무지      [서울 ▼]                                       │
│  연봉 (만원) [8000] ~ [12000]                              │
│  마감일      [2026-01-20]                                  │
│  우선순위    [🔴 긴급 ▼]                                    │
│                                                             │
│           [취소]  [저장 및 매칭 시작]                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2.6 JD 자동 파싱 (AI)

### 2.6.1 JD에서 요건 추출

```typescript
interface JDParseResult {
  suggestedTitle: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minExpYears: number;
  maxExpYears?: number;
  educationLevel?: string;
  locationCity?: string;
  summary: string;
  confidence: number;
}

async function parseJD(description: string): Promise<JDParseResult> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{
      role: 'system',
      content: `JD에서 다음 정보를 추출하세요:
        - 포지션명
        - 필수 스킬 (배열)
        - 우대 스킬 (배열)
        - 최소/최대 경력
        - 요구 학력
        - 근무지
        JSON 형식으로 응답.`
    }, {
      role: 'user',
      content: description
    }],
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}
```

### 2.6.2 임베딩 생성

포지션 저장 시 description으로 임베딩 생성:

```typescript
async function savePosition(data: CreatePositionRequest, userId: string) {
  // 1. JD 임베딩 생성
  const embedding = await generateEmbedding(data.description);

  // 2. 포지션 저장
  const { data: position } = await supabase
    .from('positions')
    .insert({
      ...data,
      user_id: userId,
      embedding
    })
    .select()
    .single();

  // 3. 초기 매칭 실행
  const matches = await matchCandidates(position.id, userId);

  return { position, matches };
}
```

---

## 2.7 알림 시스템

### 2.7.1 알림 트리거

| 이벤트 | 알림 내용 |
|--------|----------|
| 새 후보자 업로드 | "진행중인 포지션 [X]에 적합한 새 후보자가 등록되었습니다" |
| 마감일 임박 | "[포지션명] 마감 3일 전입니다" |
| 고득점 매칭 | "[후보자명]이 90점 이상으로 매칭되었습니다" |

### 2.7.2 알림 테이블

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type TEXT NOT NULL,           -- new_match, deadline_reminder, high_score_match
  title TEXT NOT NULL,
  message TEXT,

  -- 연관 엔티티
  position_id UUID REFERENCES positions(id),
  candidate_id UUID REFERENCES candidates(id),

  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 2.8 구현 우선순위

| 우선순위 | 항목 | 이유 |
|---------|------|------|
| **P0** | positions 테이블 | 핵심 데이터 모델 |
| **P0** | 포지션 CRUD API | 기본 기능 |
| **P0** | 매칭 알고리즘 RPC | 핵심 가치 |
| **P1** | 포지션 목록/상세 UI | 사용자 인터페이스 |
| **P1** | 매칭 결과 UI | 핵심 UX |
| **P1** | JD 자동 파싱 | 입력 편의성 |
| **P2** | 칸반 파이프라인 | 진행 관리 |
| **P2** | 알림 시스템 | 실시간 업데이트 |
| **P3** | 활동 로그 | 추적성 |
| **P3** | 통계 대시보드 | 인사이트 |

---

# 부록: 마이그레이션 스크립트 템플릿

## A. 검색 고도화 마이그레이션 (020_search_enhancement.sql)

```sql
-- 1. pg_trgm 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. candidates 테이블 컬럼 추가
ALTER TABLE candidates
ADD COLUMN IF NOT EXISTS is_currently_employed BOOLEAN
  GENERATED ALWAYS AS (
    EXISTS (SELECT 1 FROM jsonb_array_elements(careers) AS c WHERE c->>'isCurrent' = 'true')
  ) STORED;

-- 3. 추가 인덱스
CREATE INDEX IF NOT EXISTS idx_candidates_education_level ON candidates(education_level);
CREATE INDEX IF NOT EXISTS idx_candidates_updated_at ON candidates(updated_at);
CREATE INDEX IF NOT EXISTS idx_candidates_skills_trgm ON candidates
  USING GIN (array_to_string(skills, ' ') gin_trgm_ops);

-- 4. saved_searches 테이블
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT,
  filters JSONB DEFAULT '{}',
  notify_on_new_match BOOLEAN DEFAULT false,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS 정책
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_searches_user_policy ON saved_searches
  FOR ALL USING (user_id = auth.uid());
```

## B. 포지션 매칭 마이그레이션 (021_positions.sql)

```sql
-- 1. positions 테이블
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  client_company TEXT,
  department TEXT,
  description TEXT,
  summary TEXT,
  required_skills TEXT[] DEFAULT '{}',
  preferred_skills TEXT[] DEFAULT '{}',
  min_exp_years INTEGER DEFAULT 0,
  max_exp_years INTEGER,
  required_education_level TEXT,
  preferred_majors TEXT[] DEFAULT '{}',
  location_city TEXT,
  job_type TEXT DEFAULT 'full-time',
  salary_min INTEGER,
  salary_max INTEGER,
  embedding vector(1536),
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 인덱스
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_positions_status ON positions(status);
CREATE INDEX idx_positions_skills ON positions USING GIN(required_skills);
CREATE INDEX idx_positions_embedding ON positions
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 3. position_candidates 테이블
CREATE TABLE position_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  overall_score FLOAT NOT NULL,
  skill_score FLOAT,
  experience_score FLOAT,
  education_score FLOAT,
  semantic_score FLOAT,
  matched_skills TEXT[] DEFAULT '{}',
  missing_skills TEXT[] DEFAULT '{}',
  match_explanation JSONB DEFAULT '{}',
  stage TEXT DEFAULT 'matched',
  rejection_reason TEXT,
  notes TEXT,
  matched_at TIMESTAMPTZ DEFAULT NOW(),
  stage_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(position_id, candidate_id)
);

-- 4. RLS 정책
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE position_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY positions_user_policy ON positions
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY position_candidates_user_policy ON position_candidates
  FOR ALL USING (
    position_id IN (SELECT id FROM positions WHERE user_id = auth.uid())
  );
```

---

# 다음 단계

1. **기획 리뷰** - 이 문서 검토 및 피드백
2. **우선순위 확정** - P0 항목 최종 선정
3. **마이그레이션 작성** - DB 스키마 변경
4. **API 개발** - 백엔드 구현
5. **UI 개발** - 프론트엔드 구현
6. **테스트** - 통합 테스트
7. **배포** - 프로덕션 적용
