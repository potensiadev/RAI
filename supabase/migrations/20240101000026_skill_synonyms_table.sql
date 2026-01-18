-- 2026-01-12
--
-- - Phase 2: Pre-indexed Synonym Table


CREATE TABLE IF NOT EXISTS skill_synonyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_skill VARCHAR(100) NOT NULL,
    variant VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(variant)
);

CREATE INDEX IF NOT EXISTS idx_skill_synonyms_variant_lower
    ON skill_synonyms(LOWER(variant));
CREATE INDEX IF NOT EXISTS idx_skill_synonyms_canonical
    ON skill_synonyms(canonical_skill);
CREATE INDEX IF NOT EXISTS idx_skill_synonyms_canonical_lower
    ON skill_synonyms(LOWER(canonical_skill));


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
    ('Vue', 'Vue'),
    ('Vue', 'Vue.js'),
    ('Vue', 'VueJS'),
    ('Vue', 'vue.js'),
    ('Vue', 'vue'),
    ('Angular', 'Angular'),
    ('Angular', 'AngularJS'),
    ('Angular', 'angular'),
    ('Svelte', 'Svelte'),
    ('Svelte', 'SvelteKit'),
    ('Svelte', 'svelte'),
    ('Next.js', 'Next.js'),
    ('Next.js', 'NextJS'),
    ('Next.js', 'Nextjs'),
    ('Next.js', 'next.js'),
    ('Next.js', 'next'),
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
    ('Java', 'Java'),
    ('Java', 'java'),
    ('Java', 'JDK'),
    ('Java', 'J2EE'),
    ('Java', 'JavaSE'),
    ('Java', 'JavaEE'),
    ('Kotlin', 'Kotlin'),
    ('Kotlin', 'kotlin'),
    ('Go', 'Go'),
    ('Go', 'Golang'),
    ('Go', 'golang'),
    ('Go', 'go'),
    ('Rust', 'Rust'),
    ('Rust', 'rust'),
    ('C#', 'C#'),
    ('C#', 'CSharp'),
    ('C#', 'csharp'),
    ('C#', 'C Sharp'),
    ('C#', '.NET'),
    ('C#', 'dotnet'),
    ('C++', 'C++'),
    ('C++', 'CPP'),
    ('C++', 'cpp'),
    ('Ruby', 'Ruby'),
    ('Ruby', 'ruby'),
    ('PHP', 'PHP'),
    ('PHP', 'php'),
    ('Scala', 'Scala'),
    ('Scala', 'scala')
ON CONFLICT (variant) DO NOTHING;

-- Backend Frameworks
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('Node.js', 'Node.js'),
    ('Node.js', 'NodeJS'),
    ('Node.js', 'Nodejs'),
    ('Node.js', 'node.js'),
    ('Node.js', 'node'),
    ('Express', 'Express'),
    ('Express', 'Express.js'),
    ('Express', 'ExpressJS'),
    ('Express', 'express'),
    ('NestJS', 'NestJS'),
    ('NestJS', 'Nest.js'),
    ('NestJS', 'nest'),
    ('Django', 'Django'),
    ('Django', 'django'),
    ('Flask', 'Flask'),
    ('Flask', 'flask'),
    ('FastAPI', 'FastAPI'),
    ('FastAPI', 'fastapi'),
    ('FastAPI', 'Fast API'),
    ('Spring', 'Spring'),
    ('Spring', 'SpringBoot'),
    ('Spring', 'Spring Boot'),
    ('Ruby on Rails', 'Ruby on Rails'),
    ('Ruby on Rails', 'Rails'),
    ('Ruby on Rails', 'RoR'),
    ('Ruby on Rails', 'rails'),
    ('Laravel', 'Laravel'),
    ('Laravel', 'laravel')
ON CONFLICT (variant) DO NOTHING;

-- Databases
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('PostgreSQL', 'PostgreSQL'),
    ('PostgreSQL', 'Postgres'),
    ('PostgreSQL', 'postgres'),
    ('PostgreSQL', 'psql'),
    ('PostgreSQL', 'PG'),
    ('MySQL', 'MySQL'),
    ('MySQL', 'mysql'),
    ('MySQL', 'MariaDB'),
    ('MySQL', 'mariadb'),
    ('MongoDB', 'MongoDB'),
    ('MongoDB', 'Mongo'),
    ('MongoDB', 'mongo'),
    ('MongoDB', '紐쎄퀬DB'),
    ('MongoDB', '紐쎄퀬'),
    ('Redis', 'Redis'),
    ('Redis', 'redis'),
    ('Elasticsearch', 'Elasticsearch'),
    ('Elasticsearch', 'ES'),
    ('Elasticsearch', 'elastic'),
    ('DynamoDB', 'DynamoDB'),
    ('DynamoDB', 'Dynamo'),
    ('DynamoDB', 'dynamodb'),
    ('Cassandra', 'Cassandra'),
    ('Cassandra', 'cassandra'),
    ('Oracle', 'Oracle'),
    ('Oracle', 'OracleDB'),
    ('Oracle', 'oracle'),
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
    ('GCP', 'GCP'),
    ('GCP', 'Google Cloud Platform'),
    ('GCP', 'Google Cloud'),
    ('GCP', 'gcp'),
    ('Azure', 'Azure'),
    ('Azure', 'Microsoft Azure'),
    ('Azure', 'azure'),
    ('Docker', 'Docker'),
    ('Docker', 'docker'),
    ('Kubernetes', 'Kubernetes'),
    ('Kubernetes', 'K8s'),
    ('Kubernetes', 'k8s'),
    ('Kubernetes', 'kubernetes'),
    ('Terraform', 'Terraform'),
    ('Terraform', 'terraform'),
    ('Jenkins', 'Jenkins'),
    ('Jenkins', 'jenkins'),
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
    ('Flutter', 'Flutter'),
    ('Flutter', 'flutter'),
    ('Swift', 'Swift'),
    ('Swift', 'swift'),
    ('SwiftUI', 'SwiftUI'),
    ('SwiftUI', 'swiftui'),
    ('iOS', 'iOS'),
    ('iOS', 'ios'),
    ('iOS', 'iPhone'),
    ('Android', 'Android'),
    ('Android', 'android')
ON CONFLICT (variant) DO NOTHING;

-- Data & ML
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('TensorFlow', 'TensorFlow'),
    ('TensorFlow', 'tensorflow'),
    ('TensorFlow', 'TF'),
    ('PyTorch', 'PyTorch'),
    ('PyTorch', 'pytorch'),
    ('Pandas', 'Pandas'),
    ('Pandas', 'pandas'),
    ('NumPy', 'NumPy'),
    ('NumPy', 'numpy'),
    ('Scikit', 'Scikit'),
    ('Scikit', 'scikit-learn'),
    ('Scikit', 'sklearn'),
    ('Spark', 'Spark'),
    ('Spark', 'Apache Spark'),
    ('Spark', 'PySpark'),
    ('Kafka', 'Kafka'),
    ('Kafka', 'Apache Kafka'),
    ('Kafka', 'kafka'),
    ('Airflow', 'Airflow'),
    ('Airflow', 'Apache Airflow'),
    ('Airflow', 'airflow')
ON CONFLICT (variant) DO NOTHING;

-- Testing
INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    ('Jest', 'Jest'),
    ('Jest', 'jest'),
    ('Mocha', 'Mocha'),
    ('Mocha', 'mocha'),
    ('Mocha', '紐⑥뭅'),
    ('Cypress', 'Cypress'),
    ('Cypress', 'cypress'),
    ('Playwright', 'Playwright'),
    ('Playwright', 'playwright'),
    ('Selenium', 'Selenium'),
    ('Selenium', 'selenium'),
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
    ('REST', 'REST'),
    ('REST', 'RESTful'),
    ('REST', 'REST API'),
    ('REST', 'RESTAPI'),
    ('gRPC', 'gRPC'),
    ('gRPC', 'grpc'),
    ('WebSocket', 'WebSocket'),
    ('WebSocket', 'Websocket'),
    ('WebSocket', 'websocket'),
    ('Linux', 'Linux'),
    ('Linux', 'linux'),
    ('Linux', 'Ubuntu'),
    ('Linux', 'CentOS'),
    ('Linux', 'RHEL'),
    ('Git', 'Git'),
    ('Git', 'git'),
    ('Figma', 'Figma'),
    ('Figma', 'figma'),
    ('Jira', 'Jira'),
    ('Jira', 'jira'),
    ('Confluence', 'Confluence'),
    ('Confluence', 'confluence')
ON CONFLICT (variant) DO NOTHING;


CREATE OR REPLACE FUNCTION get_canonical_skill(p_skill TEXT)
RETURNS TEXT AS $$
    SELECT COALESCE(
        (SELECT canonical_skill FROM skill_synonyms WHERE LOWER(variant) = LOWER(p_skill) LIMIT 1),
        p_skill
    );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_skill_variants(p_skill TEXT)
RETURNS TEXT[] AS $$
    SELECT COALESCE(
        ARRAY_AGG(variant),
        ARRAY[p_skill]
    )
    FROM skill_synonyms
    WHERE canonical_skill = get_canonical_skill(p_skill);
$$ LANGUAGE sql STABLE;


CREATE OR REPLACE FUNCTION search_candidates_by_skills(
    p_user_id UUID,
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
    canonical_skills AS (
        SELECT DISTINCT get_canonical_skill(unnest) AS skill
        FROM unnest(p_skills)
    ),
    all_variants AS (
        SELECT ss.canonical_skill, ss.variant
        FROM skill_synonyms ss
        WHERE ss.canonical_skill IN (SELECT skill FROM canonical_skills)
    ),
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
    ORDER BY
        sm.matched_count DESC,
        bf.confidence_score DESC NULLS LAST
    LIMIT p_match_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_canonical_skill TO authenticated;
GRANT EXECUTE ON FUNCTION get_skill_variants TO authenticated;
GRANT EXECUTE ON FUNCTION search_candidates_by_skills TO authenticated;
GRANT SELECT ON skill_synonyms TO authenticated;



