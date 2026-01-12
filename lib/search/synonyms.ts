/**
 * 스킬 동의어 사전
 * 검색 시 동의어 확장에 사용
 */

// 정규화된 스킬명 -> 동의어 배열
export const SKILL_SYNONYMS: Record<string, string[]> = {
  // JavaScript / TypeScript
  JavaScript: ["JS", "javascript", "ECMAScript", "ES6", "ES2015", "ES2020", "ES2021"],
  TypeScript: ["TS", "typescript", "Typescript"],

  // Frontend Frameworks
  React: ["React.js", "ReactJS", "react.js", "react", "리액트"],
  Vue: ["Vue.js", "VueJS", "vue.js", "vue", "뷰"],
  Angular: ["AngularJS", "angular", "앵귤러"],
  Svelte: ["SvelteKit", "svelte"],
  "Next.js": ["NextJS", "Nextjs", "next.js", "next", "넥스트"],
  "Nuxt.js": ["NuxtJS", "Nuxt", "nuxt.js", "nuxt"],

  // Backend Languages
  Python: ["python", "Python3", "py", "파이썬"],
  Java: ["java", "JDK", "J2EE", "JavaSE", "JavaEE", "자바"],
  Kotlin: ["kotlin", "코틀린"],
  Go: ["Golang", "golang", "go"],
  Rust: ["rust", "러스트"],
  "C#": ["CSharp", "csharp", "C Sharp", ".NET", "dotnet"],
  "C++": ["CPP", "cpp", "씨플플"],
  Ruby: ["ruby", "루비"],
  PHP: ["php"],
  Scala: ["scala", "스칼라"],

  // Backend Frameworks
  "Node.js": ["NodeJS", "Nodejs", "node.js", "node", "노드"],
  Express: ["Express.js", "ExpressJS", "express"],
  NestJS: ["Nest.js", "nest", "네스트"],
  Django: ["django", "장고"],
  Flask: ["flask", "플라스크"],
  FastAPI: ["fastapi", "Fast API"],
  Spring: ["SpringBoot", "Spring Boot", "스프링", "스프링부트"],
  "Ruby on Rails": ["Rails", "RoR", "rails"],
  Laravel: ["laravel", "라라벨"],

  // Databases
  PostgreSQL: ["Postgres", "postgres", "psql", "PG", "포스트그레스"],
  MySQL: ["mysql", "MariaDB", "mariadb"],
  MongoDB: ["Mongo", "mongo", "몽고DB", "몽고"],
  Redis: ["redis", "레디스"],
  Elasticsearch: ["ES", "elastic", "엘라스틱서치"],
  DynamoDB: ["Dynamo", "dynamodb"],
  Cassandra: ["cassandra", "카산드라"],
  Oracle: ["OracleDB", "oracle", "오라클"],
  "SQL Server": ["MSSQL", "mssql", "SQLServer"],

  // Cloud & DevOps
  AWS: ["Amazon Web Services", "aws", "아마존웹서비스"],
  GCP: ["Google Cloud Platform", "Google Cloud", "gcp", "구글클라우드"],
  Azure: ["Microsoft Azure", "azure", "애저"],
  Docker: ["docker", "도커"],
  Kubernetes: ["K8s", "k8s", "kubernetes", "쿠버네티스"],
  Terraform: ["terraform", "테라폼"],
  Jenkins: ["jenkins", "젠킨스"],
  "GitHub Actions": ["GHA", "github actions"],
  CircleCI: ["circleci"],
  ArgoCD: ["Argo CD", "argo"],

  // Mobile
  "React Native": ["ReactNative", "react-native", "RN", "리액트네이티브"],
  Flutter: ["flutter", "플러터"],
  Swift: ["swift", "스위프트"],
  SwiftUI: ["swiftui"],
  iOS: ["ios", "아이폰", "iPhone"],
  Android: ["android", "안드로이드"],

  // Data & ML
  TensorFlow: ["tensorflow", "TF", "텐서플로우"],
  PyTorch: ["pytorch", "파이토치"],
  Pandas: ["pandas", "판다스"],
  NumPy: ["numpy", "넘파이"],
  Scikit: ["scikit-learn", "sklearn", "사이킷런"],
  Spark: ["Apache Spark", "PySpark", "스파크"],
  Kafka: ["Apache Kafka", "kafka", "카프카"],
  Airflow: ["Apache Airflow", "airflow", "에어플로우"],

  // Testing
  Jest: ["jest", "제스트"],
  Mocha: ["mocha", "모카"],
  Cypress: ["cypress", "사이프레스"],
  Playwright: ["playwright"],
  Selenium: ["selenium", "셀레니움"],
  JUnit: ["junit"],
  pytest: ["Pytest", "py.test"],

  // Others
  GraphQL: ["graphql", "그래프큐엘"],
  REST: ["RESTful", "REST API", "RESTAPI"],
  gRPC: ["grpc"],
  WebSocket: ["Websocket", "websocket", "웹소켓"],
  Linux: ["linux", "리눅스", "Ubuntu", "CentOS", "RHEL"],
  Git: ["git", "깃"],
  Figma: ["figma", "피그마"],
  Jira: ["jira", "지라"],
  Confluence: ["confluence", "컨플루언스"],

  // Korean Job Titles (Mixed Language Query Support)
  개발자: ["developer", "Developer", "엔지니어", "Engineer", "프로그래머", "programmer"],
  시니어: ["senior", "Senior", "Sr", "sr.", "경력"],
  주니어: ["junior", "Junior", "Jr", "jr.", "신입"],
  리드: ["lead", "Lead", "팀장", "테크리드", "Tech Lead"],
  프론트엔드: ["frontend", "Frontend", "Front-end", "front-end", "FE", "프론트"],
  백엔드: ["backend", "Backend", "Back-end", "back-end", "BE", "서버"],
  풀스택: ["fullstack", "Fullstack", "Full-stack", "full-stack", "풀스택개발자"],
  데브옵스: ["devops", "DevOps", "SRE", "sre", "인프라"],
  데이터: ["data", "Data", "데이터엔지니어", "Data Engineer"],
  머신러닝: ["ML", "ml", "Machine Learning", "machine learning", "기계학습"],
  인공지능: ["AI", "ai", "Artificial Intelligence", "artificial intelligence"],
};

// 동의어 -> 정규화된 스킬명 역방향 매핑
const reverseSynonymMap: Map<string, string> = new Map();

// 역방향 매핑 초기화
for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
  // 정규화된 이름도 추가 (소문자)
  reverseSynonymMap.set(canonical.toLowerCase(), canonical);
  for (const synonym of synonyms) {
    reverseSynonymMap.set(synonym.toLowerCase(), canonical);
  }
}

/**
 * 스킬명을 정규화된 이름으로 변환
 * @param skill 원본 스킬명
 * @returns 정규화된 스킬명 (없으면 원본 반환)
 */
export function normalizeSkill(skill: string): string {
  return reverseSynonymMap.get(skill.toLowerCase()) || skill;
}

/**
 * 스킬명에 대한 모든 동의어 반환 (자기 자신 포함)
 * @param skill 스킬명
 * @returns 동의어 배열
 */
export function getSkillSynonyms(skill: string): string[] {
  const normalized = normalizeSkill(skill);
  const synonyms = SKILL_SYNONYMS[normalized] || [];
  return [normalized, ...synonyms];
}

/**
 * 검색 쿼리에서 스킬 키워드를 확장
 * @param query 검색 쿼리
 * @returns 확장된 스킬 키워드 배열
 */
export function expandQuerySkills(query: string): string[] {
  const words = query.split(/[\s,]+/).filter(Boolean);
  const expanded: Set<string> = new Set();

  for (const word of words) {
    const synonyms = getSkillSynonyms(word);
    for (const s of synonyms) {
      expanded.add(s);
    }
  }

  return Array.from(expanded);
}

/**
 * 두 스킬이 동의어 관계인지 확인
 * @param skill1 첫 번째 스킬
 * @param skill2 두 번째 스킬
 * @returns 동의어 여부
 */
export function areSkillsSynonyms(skill1: string, skill2: string): boolean {
  return normalizeSkill(skill1) === normalizeSkill(skill2);
}

/**
 * 스킬 배열에서 동의어가 있는지 확인
 * @param candidateSkills 후보자 스킬 배열
 * @param searchSkill 검색할 스킬
 * @returns 동의어 매칭 여부
 */
export function hasSkillWithSynonym(
  candidateSkills: string[],
  searchSkill: string
): boolean {
  const normalizedSearch = normalizeSkill(searchSkill);
  return candidateSkills.some(
    (skill) => normalizeSkill(skill) === normalizedSearch
  );
}

/**
 * 후보자 스킬과 요구 스킬 간 매칭 결과 반환
 * @param candidateSkills 후보자 스킬 배열
 * @param requiredSkills 요구 스킬 배열
 * @returns { matched: string[], missing: string[] }
 */
export function matchSkillsWithSynonyms(
  candidateSkills: string[],
  requiredSkills: string[]
): { matched: string[]; missing: string[] } {
  const matched: string[] = [];
  const missing: string[] = [];

  for (const required of requiredSkills) {
    if (hasSkillWithSynonym(candidateSkills, required)) {
      matched.push(required);
    } else {
      missing.push(required);
    }
  }

  return { matched, missing };
}
