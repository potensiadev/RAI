-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Migration 026: 스킬 동의어 테이블
-- 2026-01-12
--
-- PRD 요구사항:
-- - Phase 2: Pre-indexed Synonym Table
-- - OR 조건 대신 JOIN 기반 단일 조건으로 검색 최적화
-- - 동의어 확장 로직을 DB 레벨에서 처리
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ══════════════════════════════════════════════════════════════════════════
-- 1. 스킬 동의어 테이블 생성
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS skill_synonyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_skill VARCHAR(100) NOT NULL,  -- 정규화된 스킬명 (예: React)
    variant VARCHAR(100) NOT NULL,           -- 동의어 (예: ReactJS, react.js, 리액트)
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- 동일한 variant가 여러 canonical_skill에 매핑되지 않도록
    UNIQUE(variant)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_skill_synonyms_variant_lower
    ON skill_synonyms(LOWER(variant));
CREATE INDEX IF NOT EXISTS idx_skill_synonyms_canonical
    ON skill_synonyms(canonical_skill);
CREATE INDEX IF NOT EXISTS idx_skill_synonyms_canonical_lower
    ON skill_synonyms(LOWER(canonical_skill));

-- ══════════════════════════════════════════════════════════════════════════
-- 2. 동의어 데이터 삽입
-- ══════════════════════════════════════════════════════════════════════════

-- JavaScript / TypeScript
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('JavaScript', 'JavaScript'),
    ('JavaScript', 'JS'),
    ('JavaScript', 'javascript'),
    ('JavaScript', 'ECMAScript'),
    ('JavaScript', 'ES6'),
    ('JavaScript', 'ES2015'),
    ('JavaScript', 'ES2020'),
    ('JavaScript', 'ES2021'),
    ('TypeScript', 'TypeScript'),
    ('TypeScript', 'TS'),
    ('TypeScript', 'typescript'),
    ('TypeScript', 'Typescript')
ON CONFLICT (variant) DO NOTHING;

-- Frontend Frameworks
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('React', 'React'),
    ('React', 'React.js'),
    ('React', 'ReactJS'),
    ('React', 'react.js'),
    ('React', 'react'),
    ('React', '리액트'),
    ('Vue', 'Vue'),
    ('Vue', 'Vue.js'),
    ('Vue', 'VueJS'),
    ('Vue', 'vue.js'),
    ('Vue', 'vue'),
    ('Vue', '뷰'),
    ('Angular', 'Angular'),
    ('Angular', 'AngularJS'),
    ('Angular', 'angular'),
    ('Angular', '앵귤러'),
    ('Svelte', 'Svelte'),
    ('Svelte', 'SvelteKit'),
    ('Svelte', 'svelte'),
    ('Next.js', 'Next.js'),
    ('Next.js', 'NextJS'),
    ('Next.js', 'Nextjs'),
    ('Next.js', 'next.js'),
    ('Next.js', 'next'),
    ('Next.js', '넥스트'),
    ('Nuxt.js', 'Nuxt.js'),
    ('Nuxt.js', 'NuxtJS'),
    ('Nuxt.js', 'Nuxt'),
    ('Nuxt.js', 'nuxt.js'),
    ('Nuxt.js', 'nuxt')
ON CONFLICT (variant) DO NOTHING;

-- Backend Languages
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('Python', 'Python'),
    ('Python', 'python'),
    ('Python', 'Python3'),
    ('Python', 'py'),
    ('Python', '파이썬'),
    ('Java', 'Java'),
    ('Java', 'java'),
    ('Java', 'JDK'),
    ('Java', 'J2EE'),
    ('Java', 'JavaSE'),
    ('Java', 'JavaEE'),
    ('Java', '자바'),
    ('Kotlin', 'Kotlin'),
    ('Kotlin', 'kotlin'),
    ('Kotlin', '코틀린'),
    ('Go', 'Go'),
    ('Go', 'Golang'),
    ('Go', 'golang'),
    ('Go', 'go'),
    ('Rust', 'Rust'),
    ('Rust', 'rust'),
    ('Rust', '러스트'),
    ('C#', 'C#'),
    ('C#', 'CSharp'),
    ('C#', 'csharp'),
    ('C#', 'C Sharp'),
    ('C#', '.NET'),
    ('C#', 'dotnet'),
    ('C++', 'C++'),
    ('C++', 'CPP'),
    ('C++', 'cpp'),
    ('C++', '씨플플'),
    ('Ruby', 'Ruby'),
    ('Ruby', 'ruby'),
    ('Ruby', '루비'),
    ('PHP', 'PHP'),
    ('PHP', 'php'),
    ('Scala', 'Scala'),
    ('Scala', 'scala'),
    ('Scala', '스칼라')
ON CONFLICT (variant) DO NOTHING;

-- Backend Frameworks
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('Node.js', 'Node.js'),
    ('Node.js', 'NodeJS'),
    ('Node.js', 'Nodejs'),
    ('Node.js', 'node.js'),
    ('Node.js', 'node'),
    ('Node.js', '노드'),
    ('Express', 'Express'),
    ('Express', 'Express.js'),
    ('Express', 'ExpressJS'),
    ('Express', 'express'),
    ('NestJS', 'NestJS'),
    ('NestJS', 'Nest.js'),
    ('NestJS', 'nest'),
    ('NestJS', '네스트'),
    ('Django', 'Django'),
    ('Django', 'django'),
    ('Django', '장고'),
    ('Flask', 'Flask'),
    ('Flask', 'flask'),
    ('Flask', '플라스크'),
    ('FastAPI', 'FastAPI'),
    ('FastAPI', 'fastapi'),
    ('FastAPI', 'Fast API'),
    ('Spring', 'Spring'),
    ('Spring', 'SpringBoot'),
    ('Spring', 'Spring Boot'),
    ('Spring', '스프링'),
    ('Spring', '스프링부트'),
    ('Ruby on Rails', 'Ruby on Rails'),
    ('Ruby on Rails', 'Rails'),
    ('Ruby on Rails', 'RoR'),
    ('Ruby on Rails', 'rails'),
    ('Laravel', 'Laravel'),
    ('Laravel', 'laravel'),
    ('Laravel', '라라벨')
ON CONFLICT (variant) DO NOTHING;

-- Databases
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('PostgreSQL', 'PostgreSQL'),
    ('PostgreSQL', 'Postgres'),
    ('PostgreSQL', 'postgres'),
    ('PostgreSQL', 'psql'),
    ('PostgreSQL', 'PG'),
    ('PostgreSQL', '포스트그레스'),
    ('MySQL', 'MySQL'),
    ('MySQL', 'mysql'),
    ('MySQL', 'MariaDB'),
    ('MySQL', 'mariadb'),
    ('MongoDB', 'MongoDB'),
    ('MongoDB', 'Mongo'),
    ('MongoDB', 'mongo'),
    ('MongoDB', '몽고DB'),
    ('MongoDB', '몽고'),
    ('Redis', 'Redis'),
    ('Redis', 'redis'),
    ('Redis', '레디스'),
    ('Elasticsearch', 'Elasticsearch'),
    ('Elasticsearch', 'ES'),
    ('Elasticsearch', 'elastic'),
    ('Elasticsearch', '엘라스틱서치'),
    ('DynamoDB', 'DynamoDB'),
    ('DynamoDB', 'Dynamo'),
    ('DynamoDB', 'dynamodb'),
    ('Cassandra', 'Cassandra'),
    ('Cassandra', 'cassandra'),
    ('Cassandra', '카산드라'),
    ('Oracle', 'Oracle'),
    ('Oracle', 'OracleDB'),
    ('Oracle', 'oracle'),
    ('Oracle', '오라클'),
    ('SQL Server', 'SQL Server'),
    ('SQL Server', 'MSSQL'),
    ('SQL Server', 'mssql'),
    ('SQL Server', 'SQLServer')
ON CONFLICT (variant) DO NOTHING;

-- Cloud & DevOps
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('AWS', 'AWS'),
    ('AWS', 'Amazon Web Services'),
    ('AWS', 'aws'),
    ('AWS', '아마존웹서비스'),
    ('GCP', 'GCP'),
    ('GCP', 'Google Cloud Platform'),
    ('GCP', 'Google Cloud'),
    ('GCP', 'gcp'),
    ('GCP', '구글클라우드'),
    ('Azure', 'Azure'),
    ('Azure', 'Microsoft Azure'),
    ('Azure', 'azure'),
    ('Azure', '애저'),
    ('Docker', 'Docker'),
    ('Docker', 'docker'),
    ('Docker', '도커'),
    ('Kubernetes', 'Kubernetes'),
    ('Kubernetes', 'K8s'),
    ('Kubernetes', 'k8s'),
    ('Kubernetes', 'kubernetes'),
    ('Kubernetes', '쿠버네티스'),
    ('Terraform', 'Terraform'),
    ('Terraform', 'terraform'),
    ('Terraform', '테라폼'),
    ('Jenkins', 'Jenkins'),
    ('Jenkins', 'jenkins'),
    ('Jenkins', '젠킨스'),
    ('GitHub Actions', 'GitHub Actions'),
    ('GitHub Actions', 'GHA'),
    ('GitHub Actions', 'github actions'),
    ('CircleCI', 'CircleCI'),
    ('CircleCI', 'circleci'),
    ('ArgoCD', 'ArgoCD'),
    ('ArgoCD', 'Argo CD'),
    ('ArgoCD', 'argo')
ON CONFLICT (variant) DO NOTHING;

-- Mobile
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('React Native', 'React Native'),
    ('React Native', 'ReactNative'),
    ('React Native', 'react-native'),
    ('React Native', 'RN'),
    ('React Native', '리액트네이티브'),
    ('Flutter', 'Flutter'),
    ('Flutter', 'flutter'),
    ('Flutter', '플러터'),
    ('Swift', 'Swift'),
    ('Swift', 'swift'),
    ('Swift', '스위프트'),
    ('SwiftUI', 'SwiftUI'),
    ('SwiftUI', 'swiftui'),
    ('iOS', 'iOS'),
    ('iOS', 'ios'),
    ('iOS', '아이폰'),
    ('iOS', 'iPhone'),
    ('Android', 'Android'),
    ('Android', 'android'),
    ('Android', '안드로이드')
ON CONFLICT (variant) DO NOTHING;

-- Data & ML
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('TensorFlow', 'TensorFlow'),
    ('TensorFlow', 'tensorflow'),
    ('TensorFlow', 'TF'),
    ('TensorFlow', '텐서플로우'),
    ('PyTorch', 'PyTorch'),
    ('PyTorch', 'pytorch'),
    ('PyTorch', '파이토치'),
    ('Pandas', 'Pandas'),
    ('Pandas', 'pandas'),
    ('Pandas', '판다스'),
    ('NumPy', 'NumPy'),
    ('NumPy', 'numpy'),
    ('NumPy', '넘파이'),
    ('Scikit', 'Scikit'),
    ('Scikit', 'scikit-learn'),
    ('Scikit', 'sklearn'),
    ('Scikit', '사이킷런'),
    ('Spark', 'Spark'),
    ('Spark', 'Apache Spark'),
    ('Spark', 'PySpark'),
    ('Spark', '스파크'),
    ('Kafka', 'Kafka'),
    ('Kafka', 'Apache Kafka'),
    ('Kafka', 'kafka'),
    ('Kafka', '카프카'),
    ('Airflow', 'Airflow'),
    ('Airflow', 'Apache Airflow'),
    ('Airflow', 'airflow'),
    ('Airflow', '에어플로우')
ON CONFLICT (variant) DO NOTHING;

-- Testing
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('Jest', 'Jest'),
    ('Jest', 'jest'),
    ('Jest', '제스트'),
    ('Mocha', 'Mocha'),
    ('Mocha', 'mocha'),
    ('Mocha', '모카'),
    ('Cypress', 'Cypress'),
    ('Cypress', 'cypress'),
    ('Cypress', '사이프레스'),
    ('Playwright', 'Playwright'),
    ('Playwright', 'playwright'),
    ('Selenium', 'Selenium'),
    ('Selenium', 'selenium'),
    ('Selenium', '셀레니움'),
    ('JUnit', 'JUnit'),
    ('JUnit', 'junit'),
    ('pytest', 'pytest'),
    ('pytest', 'Pytest'),
    ('pytest', 'py.test')
ON CONFLICT (variant) DO NOTHING;

-- Others
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('GraphQL', 'GraphQL'),
    ('GraphQL', 'graphql'),
    ('GraphQL', '그래프큐엘'),
    ('REST', 'REST'),
    ('REST', 'RESTful'),
    ('REST', 'REST API'),
    ('REST', 'RESTAPI'),
    ('gRPC', 'gRPC'),
    ('gRPC', 'grpc'),
    ('WebSocket', 'WebSocket'),
    ('WebSocket', 'Websocket'),
    ('WebSocket', 'websocket'),
    ('WebSocket', '웹소켓'),
    ('Linux', 'Linux'),
    ('Linux', 'linux'),
    ('Linux', '리눅스'),
    ('Linux', 'Ubuntu'),
    ('Linux', 'CentOS'),
    ('Linux', 'RHEL'),
    ('Git', 'Git'),
    ('Git', 'git'),
    ('Git', '깃'),
    ('Figma', 'Figma'),
    ('Figma', 'figma'),
    ('Figma', '피그마'),
    ('Jira', 'Jira'),
    ('Jira', 'jira'),
    ('Jira', '지라'),
    ('Confluence', 'Confluence'),
    ('Confluence', 'confluence'),
    ('Confluence', '컨플루언스')
ON CONFLICT (variant) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════
-- 3. 스킬 검색 최적화 함수
-- ══════════════════════════════════════════════════════════════════════════

-- 스킬 variant를 canonical로 변환하는 함수
CREATE OR REPLACE FUNCTION get_canonical_skill(p_skill TEXT)
RETURNS TEXT AS $$
    SELECT COALESCE(
        (SELECT canonical_skill FROM skill_synonyms WHERE LOWER(variant) = LOWER(p_skill) LIMIT 1),
        p_skill
    );
$$ LANGUAGE sql STABLE;

-- 스킬에 대한 모든 variant 반환
CREATE OR REPLACE FUNCTION get_skill_variants(p_skill TEXT)
RETURNS TEXT[] AS $$
    SELECT COALESCE(
        ARRAY_AGG(variant),
        ARRAY[p_skill]
    )
    FROM skill_synonyms
    WHERE canonical_skill = get_canonical_skill(p_skill);
$$ LANGUAGE sql STABLE;

-- ══════════════════════════════════════════════════════════════════════════
-- 4. JOIN 기반 검색 RPC 함수
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_candidates_by_skills(
    p_user_id UUID,
    p_skills TEXT[],               -- 검색할 스킬 배열 (variant도 가능)
    p_match_count INTEGER DEFAULT 50,
    p_exp_years_min INTEGER DEFAULT NULL,
    p_exp_years_max INTEGER DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_companies TEXT[] DEFAULT NULL,
    p_exclude_companies TEXT[] DEFAULT NULL
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
    matched_skills_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH
    -- 입력 스킬을 canonical 스킬로 변환
    canonical_skills AS (
        SELECT DISTINCT get_canonical_skill(unnest) AS skill
        FROM unnest(p_skills)
    ),
    -- 각 canonical 스킬의 모든 variant 가져오기
    all_variants AS (
        SELECT ss.canonical_skill, ss.variant
        FROM skill_synonyms ss
        WHERE ss.canonical_skill IN (SELECT skill FROM canonical_skills)
    ),
    -- 기본 필터링된 후보자
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
    ),
    -- 후보자별 매칭 스킬 수 계산 (JOIN 활용)
    skill_matches AS (
        SELECT
            bf.id AS candidate_id,
            COUNT(DISTINCT av.canonical_skill)::INTEGER AS matched_count
        FROM base_filtered bf
        CROSS JOIN all_variants av
        WHERE av.variant = ANY(bf.skills)
        GROUP BY bf.id
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
        COALESCE(sm.matched_count, 0) AS matched_skills_count
    FROM base_filtered bf
    LEFT JOIN skill_matches sm ON bf.id = sm.candidate_id
    WHERE sm.matched_count > 0  -- 최소 1개 스킬 매칭
    ORDER BY
        sm.matched_count DESC,
        bf.confidence_score DESC NULLS LAST
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 권한 부여
GRANT EXECUTE ON FUNCTION get_canonical_skill TO authenticated;
GRANT EXECUTE ON FUNCTION get_skill_variants TO authenticated;
GRANT EXECUTE ON FUNCTION search_candidates_by_skills TO authenticated;
GRANT SELECT ON skill_synonyms TO authenticated;

-- 코멘트
COMMENT ON TABLE skill_synonyms IS
'스킬 동의어 매핑 테이블. 검색 시 JOIN 기반 동의어 확장에 사용.';

COMMENT ON FUNCTION search_candidates_by_skills IS
'스킬 기반 후보자 검색 RPC. skill_synonyms 테이블과 JOIN하여 동의어 자동 확장.
PRD Phase 2 성능 최적화 요구사항 충족.';
