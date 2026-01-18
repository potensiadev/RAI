-- 2026-01-13
-- Extended skill synonyms - State Management, Build Tools, CSS, etc.

INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- State Management
    ('Redux', 'Redux'),
    ('Redux', 'Redux Toolkit'),
    ('Redux', 'RTK'),
    ('MobX', 'MobX'),
    ('MobX', 'mobx-state-tree'),
    ('Zustand', 'Zustand'),
    ('Recoil', 'Recoil'),
    ('React Query', 'React Query'),
    ('React Query', 'TanStack Query'),
    ('SWR', 'SWR'),
    ('SWR', 'stale-while-revalidate'),

    -- Build Tools
    ('Webpack', 'Webpack'),
    ('Vite', 'Vite'),
    ('Babel', 'Babel'),
    ('ESLint', 'ESLint'),
    ('Prettier', 'Prettier'),

    -- CSS
    ('SCSS', 'SCSS'),
    ('SCSS', 'Sass'),
    ('Tailwind', 'Tailwind'),
    ('Tailwind', 'TailwindCSS'),
    ('styled-components', 'styled-components'),
    ('Emotion', 'Emotion'),
    ('Emotion', '@emotion'),

    -- Testing
    ('Testing Library', 'Testing Library'),
    ('Testing Library', 'RTL'),
    ('Storybook', 'Storybook'),

    -- Concepts
    ('SSR', 'SSR'),
    ('SSR', 'Server Side Rendering'),
    ('SSG', 'SSG'),
    ('SSG', 'Static Site Generation'),
    ('CSR', 'CSR'),
    ('CSR', 'Client Side Rendering'),
    ('SPA', 'SPA'),
    ('SPA', 'Single Page Application'),
    ('PWA', 'PWA'),
    ('PWA', 'Progressive Web App'),
    ('SEO', 'SEO'),
    ('SEO', 'Search Engine Optimization'),

    -- Accessibility
    ('Accessibility', 'Accessibility'),
    ('Accessibility', 'a11y'),
    ('Accessibility', 'WCAG'),

    -- Performance
    ('Performance', 'Performance'),
    ('Performance', 'Lazy Loading'),

    -- Design System
    ('Design System', 'Design System'),
    ('Micro Frontend', 'Micro Frontend'),
    ('Micro Frontend', 'MFE')
ON CONFLICT (variant) DO NOTHING;


INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- Languages
    ('Elixir', 'Elixir'),
    ('Clojure', 'Clojure'),
    ('Haskell', 'Haskell'),
    ('Groovy', 'Groovy'),

    -- Frameworks
    ('Koa', 'Koa'),
    ('Fastify', 'Fastify'),
    ('Gin', 'Gin'),
    ('Echo', 'Echo'),
    ('Fiber', 'Fiber'),
    ('Actix', 'Actix'),
    ('Ktor', 'Ktor'),
    ('Quarkus', 'Quarkus'),
    ('Micronaut', 'Micronaut'),

    -- Databases
    ('Neo4j', 'Neo4j'),
    ('InfluxDB', 'InfluxDB'),
    ('TimescaleDB', 'TimescaleDB'),
    ('CockroachDB', 'CockroachDB'),
    ('Supabase', 'Supabase'),
    ('Memcached', 'Memcached'),

    -- Message Queue
    ('RabbitMQ', 'RabbitMQ'),
    ('ActiveMQ', 'ActiveMQ'),
    ('SQS', 'SQS'),
    ('SQS', 'Amazon SQS'),
    ('NATS', 'NATS'),

    -- Architecture
    ('Serverless', 'Serverless'),
    ('Serverless', 'Lambda'),

    -- API Gateway
    ('Kong', 'Kong'),
    ('Kong', 'API Gateway'),
    ('Nginx', 'Nginx')
ON CONFLICT (variant) DO NOTHING;


INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- Data Processing
    ('Flink', 'Flink'),
    ('Flink', 'Apache Flink'),
    ('Presto', 'Presto'),
    ('Presto', 'Trino'),
    ('Hive', 'Hive'),
    ('dbt', 'dbt'),
    ('Dagster', 'Dagster'),
    ('Prefect', 'Prefect'),
    ('Databricks', 'Databricks'),
    ('Snowflake', 'Snowflake'),
    ('BigQuery', 'BigQuery'),
    ('Redshift', 'Redshift'),

    -- ML/AI
    ('Keras', 'Keras'),
    ('XGBoost', 'XGBoost'),
    ('LightGBM', 'LightGBM'),
    ('MLflow', 'MLflow'),
    ('Kubeflow', 'Kubeflow'),
    ('SageMaker', 'SageMaker'),
    ('Hugging Face', 'Hugging Face'),
    ('Hugging Face', 'HF'),
    ('LangChain', 'LangChain'),
    ('LlamaIndex', 'LlamaIndex'),
    ('RAG', 'RAG'),
    ('RAG', 'Retrieval Augmented Generation'),
    ('LLM', 'LLM'),
    ('LLM', 'Large Language Model'),
    ('NLP', 'NLP'),
    ('Deep Learning', 'Deep Learning'),
    ('Deep Learning', 'DL'),
    ('Transformer', 'Transformer'),
    ('BERT', 'BERT'),

    -- Analytics
    ('Tableau', 'Tableau'),
    ('Power BI', 'Power BI'),
    ('Looker', 'Looker'),
    ('Metabase', 'Metabase'),
    ('Superset', 'Superset'),
    ('Superset', 'Apache Superset'),
    ('Amplitude', 'Amplitude'),
    ('Mixpanel', 'Mixpanel'),
    ('GA4', 'GA4'),
    ('GA4', 'Google Analytics'),
    ('Segment', 'Segment')
ON CONFLICT (variant) DO NOTHING;


INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- iOS
    ('UIKit', 'UIKit'),
    ('Objective-C', 'Objective-C'),
    ('Objective-C', 'ObjC'),
    ('CocoaPods', 'CocoaPods'),
    ('Core Data', 'Core Data'),
    ('Realm', 'Realm'),
    ('Combine', 'Combine'),
    ('RxSwift', 'RxSwift'),
    ('Alamofire', 'Alamofire'),
    ('SnapKit', 'SnapKit'),

    -- Android
    ('Jetpack Compose', 'Jetpack Compose'),
    ('Jetpack Compose', 'Compose'),
    ('Room', 'Room'),
    ('Retrofit', 'Retrofit'),
    ('Dagger', 'Dagger'),
    ('Dagger', 'Dagger2'),
    ('Dagger', 'Hilt'),
    ('Koin', 'Koin'),
    ('Coroutines', 'Coroutines'),
    ('Coroutines', 'Kotlin Coroutines'),
    ('LiveData', 'LiveData'),
    ('ViewModel', 'ViewModel'),

    -- Cross Platform
    ('Expo', 'Expo'),
    ('Ionic', 'Ionic'),
    ('Capacitor', 'Capacitor'),
    ('KMM', 'KMM'),
    ('KMM', 'Kotlin Multiplatform Mobile'),

    -- Common
    ('Fastlane', 'Fastlane'),
    ('Deep Link', 'Deep Link'),
    ('Deep Link', 'Universal Link'),
    ('Push Notification', 'Push Notification'),
    ('Push Notification', 'FCM'),
    ('Push Notification', 'APNs'),
    ('In-App Purchase', 'In-App Purchase'),
    ('In-App Purchase', 'IAP')
ON CONFLICT (variant) DO NOTHING;


INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- Container
    ('containerd', 'containerd'),
    ('Podman', 'Podman'),
    ('EKS', 'EKS'),
    ('EKS', 'Amazon EKS'),
    ('GKE', 'GKE'),
    ('GKE', 'Google GKE'),
    ('AKS', 'AKS'),
    ('AKS', 'Azure AKS'),
    ('OpenShift', 'OpenShift'),
    ('Rancher', 'Rancher'),
    ('Nomad', 'Nomad'),
    ('Nomad', 'HashiCorp Nomad'),
    ('ECS', 'ECS'),
    ('ECS', 'Amazon ECS'),
    ('Fargate', 'Fargate'),

    -- CI/CD
    ('Flux', 'Flux'),
    ('Flux', 'FluxCD'),
    ('Spinnaker', 'Spinnaker'),
    ('Tekton', 'Tekton'),
    ('Harness', 'Harness'),
    ('GitOps', 'GitOps'),
    ('Blue-Green', 'Blue-Green'),
    ('Blue-Green', 'Blue-Green Deployment'),
    ('Canary', 'Canary'),
    ('Canary', 'Canary Deployment'),

    -- IaC
    ('Pulumi', 'Pulumi'),
    ('CloudFormation', 'CloudFormation'),
    ('CloudFormation', 'CFN'),
    ('CDK', 'CDK'),
    ('CDK', 'AWS CDK'),
    ('Packer', 'Packer'),
    ('Vagrant', 'Vagrant'),
    ('Crossplane', 'Crossplane'),

    -- Monitoring
    ('Loki', 'Loki'),
    ('Jaeger', 'Jaeger'),
    ('Zipkin', 'Zipkin'),
    ('OpenTelemetry', 'OpenTelemetry'),
    ('OpenTelemetry', 'OTel'),
    ('PagerDuty', 'PagerDuty'),
    ('Sentry', 'Sentry'),
    ('Dynatrace', 'Dynatrace'),
    ('Splunk', 'Splunk'),
    ('ELK', 'ELK'),
    ('ELK', 'Elasticsearch, Logstash, Kibana')
ON CONFLICT (variant) DO NOTHING;


INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- PM
    ('Product Manager', 'Product Manager'),
    ('Product Manager', 'PM'),
    ('Product Owner', 'Product Owner'),
    ('Product Owner', 'PO'),
    ('PRD', 'PRD'),
    ('PRD', 'Product Requirements Document'),
    ('OKR', 'OKR'),
    ('OKR', 'Objectives Key Results'),
    ('KPI', 'KPI'),
    ('KPI', 'Key Performance Indicator'),
    ('Agile', 'Agile'),
    ('Scrum', 'Scrum'),
    ('Kanban', 'Kanban'),
    ('Notion', 'Notion'),
    ('Linear', 'Linear'),

    -- UX/UI
    ('Product Designer', 'Product Designer'),
    ('Product Designer', 'PD'),
    ('Framer', 'Framer'),
    ('ProtoPie', 'ProtoPie'),
    ('InVision', 'InVision'),
    ('Wireframe', 'Wireframe'),
    ('Prototype', 'Prototype'),
    ('Usability Test', 'Usability Test'),
    ('Usability Test', 'UT'),
    ('Design Thinking', 'Design Thinking'),
    ('Design Sprint', 'Design Sprint')
ON CONFLICT (variant) DO NOTHING;


INSERT INTO skill_synonyms (canonical_skill, variant) VALUES
    -- Frontend
    ('Frontend Developer', 'Frontend Developer'),
    ('Frontend Developer', 'Web Developer'),

    -- Backend
    ('Backend Developer', 'Backend Developer'),
    ('Backend Developer', 'Server Developer'),

    -- Data
    ('Data Engineer', 'Data Engineer'),
    ('Data Engineer', 'DE'),
    ('Data Scientist', 'Data Scientist'),
    ('Data Scientist', 'DS'),
    ('Data Analyst', 'Data Analyst'),
    ('Data Analyst', 'DA'),

    -- DevOps
    ('Infra Engineer', 'Infra Engineer'),
    ('Cloud Engineer', 'Cloud Engineer'),
    ('Platform Engineer', 'Platform Engineer'),

    -- Seniority
    ('Senior', 'Senior'),
    ('Senior', 'Sr'),
    ('Senior', 'Sr.'),
    ('Fullstack', 'Fullstack'),
    ('Fullstack', 'Full-stack'),
    ('Architect', 'Architect')
ON CONFLICT (variant) DO NOTHING;
