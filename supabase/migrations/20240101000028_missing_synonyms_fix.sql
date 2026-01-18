-- 2026-01-13
-- Missing synonyms fix - Job roles, additional framework synonyms

INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- Job Roles
    ('Data Engineer', 'DE'),
    ('Data Scientist', 'DS'),
    ('Data Analyst', 'DA'),
    ('Analytics Engineer', 'AE'),
    ('Analytics Engineer', 'Analytics Engineer'),
    ('Technical PM', 'TPM'),
    ('Technical PM', 'Technical PM'),
    ('Program Manager', 'PgM'),
    ('Program Manager', 'Program Manager'),
    ('SRE', 'SRE'),
    ('SRE', 'Site Reliability Engineer'),
    ('Frontend Developer', 'FE')
ON CONFLICT (variant) DO NOTHING;


INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- Accessibility
    ('Accessibility', 'WAI-ARIA'),
    ('Accessibility', 'ARIA'),
    ('Accessibility', 'Web Accessibility'),
    ('Web Standards', 'Web Standards'),
    ('Web Standards', 'W3C')
ON CONFLICT (variant) DO NOTHING;


INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- Next.js variants
    ('Next.js', 'NEXT'),

    -- Vue variants
    ('Vue', 'Vue3'),
    ('Vue', 'vue3'),
    ('Vue', 'Vue2'),

    -- Angular variants
    ('Angular', 'Angular2'),
    ('Angular', 'Angular4'),
    ('Angular', 'ng'),

    -- Docker
    ('Docker', 'docker-compose'),

    -- AWS services
    ('AWS', 'amazon'),
    ('AWS', 'Amazon'),
    ('AWS', 'EC2'),
    ('AWS', 'S3'),

    -- GCP
    ('GCP', 'GCE'),
    ('GCP', 'Cloud Functions'),

    -- CI/CD
    ('CI/CD', 'CI/CD'),
    ('CI/CD', 'CICD'),
    ('CI/CD', 'CI CD'),
    ('CI/CD', 'Continuous Integration'),
    ('CI/CD', 'Continuous Deployment')
ON CONFLICT (variant) DO NOTHING;


INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- React State
    ('Context API', 'Context API'),
    ('Context API', 'React Context'),

    -- Build Tools
    ('Rollup', 'Rollup'),
    ('esbuild', 'esbuild'),
    ('SWC', 'SWC'),
    ('SWC', 'swc'),

    -- Testing
    ('Vitest', 'Vitest'),

    -- UI Libraries
    ('Bootstrap', 'Bootstrap'),
    ('Material UI', 'Material UI'),
    ('Material UI', 'MUI'),
    ('Chakra UI', 'Chakra UI'),
    ('Ant Design', 'Ant Design'),
    ('Ant Design', 'antd'),

    -- API Tools
    ('OpenAPI', 'OpenAPI'),
    ('OpenAPI', 'Swagger'),
    ('Postman', 'Postman'),

    -- Auth
    ('OAuth', 'OAuth'),
    ('OAuth', 'OAuth2'),
    ('JWT', 'JWT'),
    ('JWT', 'JSON Web Token'),

    -- Git Platforms
    ('Git', 'GitHub'),
    ('Git', 'GitLab'),
    ('Git', 'Bitbucket'),

    -- Collaboration
    ('Slack', 'Slack'),
    ('Discord', 'Discord'),
    ('Asana', 'Asana'),
    ('Trello', 'Trello'),
    ('Monday', 'Monday'),
    ('Monday', 'monday.com'),
    ('ClickUp', 'ClickUp')
ON CONFLICT (variant) DO NOTHING;


INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- Experience Level
    ('Experienced', 'Experienced'),
    ('Entry Level', 'Entry Level'),
    ('Entry Level', 'Fresh'),

    -- Employment Type
    ('Full-time', 'Full-time'),
    ('Full-time', 'FTE'),
    ('Freelance', 'Freelance'),
    ('Intern', 'Intern'),
    ('Intern', 'Internship'),

    -- Work Type
    ('Remote', 'Remote'),
    ('Remote', 'Work from Home'),
    ('Remote', 'WFH'),
    ('Hybrid', 'Hybrid')
ON CONFLICT (variant) DO NOTHING;
