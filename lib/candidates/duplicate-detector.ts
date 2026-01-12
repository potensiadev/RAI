/**
 * 향상된 중복 후보자 감지 유틸리티
 *
 * PRD 요구사항:
 * - 동명이인 구분을 위한 복합 필드 비교
 * - 유사도 임계값 설정 가능
 * - phone_hash, email_hash 외 추가 필드 고려
 */

export interface CandidateForDuplicateCheck {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  last_company?: string | null;
  last_position?: string | null;
  location_city?: string | null;
  created_at: string;
  source_file?: string | null;
}

export interface DuplicatePair {
  candidate1: CandidateForDuplicateCheck;
  candidate2: CandidateForDuplicateCheck;
  similarity: SimilarityResult;
  isDuplicate: boolean;       // 동일인 여부
  isPotentialDuplicate: boolean; // 잠재적 중복 (동명이인 가능)
}

export interface SimilarityResult {
  overall: number;           // 종합 유사도 (0-1)
  nameScore: number;         // 이름 유사도
  emailScore: number;        // 이메일 유사도
  phoneScore: number;        // 전화번호 유사도
  companyScore: number;      // 회사 유사도
  positionScore: number;     // 직책 유사도
  factors: string[];         // 유사도 결정 요인
}

export interface DuplicateThresholds {
  definite: number;          // 확실한 중복 임계값 (기본 0.9)
  potential: number;         // 잠재적 중복 임계값 (기본 0.6)
  nameSimilarity: number;    // 이름 유사도 최소 임계값 (기본 0.7)
}

const DEFAULT_THRESHOLDS: DuplicateThresholds = {
  definite: 0.9,
  potential: 0.6,
  nameSimilarity: 0.7,
};

// 필드별 가중치
const FIELD_WEIGHTS = {
  name: 0.25,
  email: 0.25,
  phone: 0.25,
  company: 0.15,
  position: 0.10,
};

/**
 * 레벤슈타인 거리 기반 문자열 유사도 계산
 */
function levenshteinSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  const len1 = str1.length;
  const len2 = str2.length;

  // 최적화: 길이 차이가 너무 크면 빠르게 낮은 점수 반환
  if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.5) {
    return 0.3;
  }

  // 레벤슈타인 거리 계산
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // 삭제
        matrix[i][j - 1] + 1,      // 삽입
        matrix[i - 1][j - 1] + cost // 치환
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

/**
 * 한국어 이름 특수 처리
 * - 공백 제거
 * - 성과 이름 분리 비교
 */
function koreanNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;

  // 공백 제거 버전 비교
  const n1 = name1.replace(/\s+/g, "").toLowerCase();
  const n2 = name2.replace(/\s+/g, "").toLowerCase();

  if (n1 === n2) return 1;

  // 기본 레벤슈타인
  const baseSimilarity = levenshteinSimilarity(n1, n2);

  // 한글 이름 (2-4자)인 경우 특수 처리
  const isKorean1 = /^[가-힣]{2,4}$/.test(n1);
  const isKorean2 = /^[가-힣]{2,4}$/.test(n2);

  if (isKorean1 && isKorean2) {
    // 성이 같고 이름이 다르면 동명이인 가능성 높음
    if (n1.length >= 2 && n2.length >= 2 && n1[0] === n2[0]) {
      // 성은 같지만 나머지가 다르면 낮은 점수
      if (n1.substring(1) !== n2.substring(1)) {
        return Math.min(baseSimilarity, 0.5);
      }
    }
  }

  return baseSimilarity;
}

/**
 * 이메일 유사도 계산
 * - 도메인 무시, 로컬 파트만 비교 옵션
 */
function emailSimilarity(email1?: string | null, email2?: string | null): number {
  if (!email1 || !email2) return 0;

  const e1 = email1.toLowerCase().trim();
  const e2 = email2.toLowerCase().trim();

  if (e1 === e2) return 1;

  // 로컬 파트만 비교
  const local1 = e1.split("@")[0];
  const local2 = e2.split("@")[0];

  if (local1 === local2) return 0.9; // 도메인만 다르면 높은 유사도

  return levenshteinSimilarity(local1, local2) * 0.8;
}

/**
 * 전화번호 유사도 계산
 * - 숫자만 추출하여 비교
 */
function phoneSimilarity(phone1?: string | null, phone2?: string | null): number {
  if (!phone1 || !phone2) return 0;

  // 숫자만 추출
  const digits1 = phone1.replace(/\D/g, "");
  const digits2 = phone2.replace(/\D/g, "");

  if (!digits1 || !digits2) return 0;
  if (digits1 === digits2) return 1;

  // 뒷자리 4-8자리 비교 (지역번호 제외)
  const suffix1 = digits1.slice(-8);
  const suffix2 = digits2.slice(-8);

  if (suffix1 === suffix2) return 0.95;

  return levenshteinSimilarity(digits1, digits2);
}

/**
 * 회사명 유사도 계산
 * - 법인격 표시 제거 (주식회사, (주), Inc., Ltd. 등)
 */
function companySimilarity(company1?: string | null, company2?: string | null): number {
  if (!company1 || !company2) return 0;

  // 법인격 표시 제거
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/\(주\)|주식회사|㈜|inc\.?|ltd\.?|corp\.?|llc|co\.?,? ?ltd\.?/gi, "")
      .replace(/\s+/g, " ")
      .trim();

  const c1 = clean(company1);
  const c2 = clean(company2);

  if (c1 === c2) return 1;

  return levenshteinSimilarity(c1, c2);
}

/**
 * 두 후보자 간 종합 유사도 계산
 */
export function calculateSimilarity(
  candidate1: CandidateForDuplicateCheck,
  candidate2: CandidateForDuplicateCheck
): SimilarityResult {
  const factors: string[] = [];

  // 이름 유사도
  const nameScore = koreanNameSimilarity(candidate1.name, candidate2.name);
  if (nameScore >= 0.9) factors.push("exact_name_match");
  else if (nameScore >= 0.7) factors.push("similar_name");

  // 이메일 유사도
  const emailScore = emailSimilarity(candidate1.email, candidate2.email);
  if (emailScore >= 0.9) factors.push("same_email");

  // 전화번호 유사도
  const phoneScore = phoneSimilarity(candidate1.phone, candidate2.phone);
  if (phoneScore >= 0.9) factors.push("same_phone");

  // 회사 유사도
  const companyScore = companySimilarity(candidate1.last_company, candidate2.last_company);
  if (companyScore >= 0.8) factors.push("same_company");

  // 직책 유사도
  const positionScore = levenshteinSimilarity(
    candidate1.last_position || "",
    candidate2.last_position || ""
  );
  if (positionScore >= 0.8) factors.push("same_position");

  // 종합 점수 계산 (가중 평균)
  let weightSum = 0;
  let scoreSum = 0;

  // 이름은 항상 필수
  scoreSum += nameScore * FIELD_WEIGHTS.name;
  weightSum += FIELD_WEIGHTS.name;

  // 이메일/전화가 있으면 가중치 높임
  if (candidate1.email && candidate2.email) {
    scoreSum += emailScore * FIELD_WEIGHTS.email;
    weightSum += FIELD_WEIGHTS.email;
  }
  if (candidate1.phone && candidate2.phone) {
    scoreSum += phoneScore * FIELD_WEIGHTS.phone;
    weightSum += FIELD_WEIGHTS.phone;
  }

  // 회사/직책은 보조 지표
  if (candidate1.last_company && candidate2.last_company) {
    scoreSum += companyScore * FIELD_WEIGHTS.company;
    weightSum += FIELD_WEIGHTS.company;
  }
  if (candidate1.last_position && candidate2.last_position) {
    scoreSum += positionScore * FIELD_WEIGHTS.position;
    weightSum += FIELD_WEIGHTS.position;
  }

  const overall = weightSum > 0 ? scoreSum / weightSum : nameScore;

  return {
    overall,
    nameScore,
    emailScore,
    phoneScore,
    companyScore,
    positionScore,
    factors,
  };
}

/**
 * 두 후보자가 중복인지 판단
 */
export function detectDuplicate(
  candidate1: CandidateForDuplicateCheck,
  candidate2: CandidateForDuplicateCheck,
  thresholds: Partial<DuplicateThresholds> = {}
): DuplicatePair {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const similarity = calculateSimilarity(candidate1, candidate2);

  // 이름이 너무 다르면 동일인 아님
  if (similarity.nameScore < t.nameSimilarity) {
    return {
      candidate1,
      candidate2,
      similarity,
      isDuplicate: false,
      isPotentialDuplicate: false,
    };
  }

  // 확실한 중복: 이메일 또는 전화번호 일치 + 이름 유사
  const hasContactMatch =
    (similarity.emailScore >= 0.9 || similarity.phoneScore >= 0.9);

  // 동명이인 가능성: 이름만 유사하고 연락처 다름
  const isPotentialHomonym =
    similarity.nameScore >= 0.8 &&
    similarity.emailScore < 0.5 &&
    similarity.phoneScore < 0.5 &&
    similarity.companyScore < 0.6;

  return {
    candidate1,
    candidate2,
    similarity,
    isDuplicate: hasContactMatch && similarity.overall >= t.definite,
    isPotentialDuplicate:
      !isPotentialHomonym &&
      similarity.overall >= t.potential &&
      similarity.overall < t.definite,
  };
}

/**
 * 후보자 목록에서 중복 그룹 찾기
 */
export function findDuplicateGroups(
  candidates: CandidateForDuplicateCheck[],
  thresholds: Partial<DuplicateThresholds> = {}
): {
  definite: DuplicatePair[];
  potential: DuplicatePair[];
  homonyms: DuplicatePair[]; // 동명이인 (이름만 유사)
} {
  const definite: DuplicatePair[] = [];
  const potential: DuplicatePair[] = [];
  const homonyms: DuplicatePair[] = [];

  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };

  // 모든 쌍 비교 (O(n^2) - 대규모에서는 최적화 필요)
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const pair = detectDuplicate(candidates[i], candidates[j], t);

      if (pair.isDuplicate) {
        definite.push(pair);
      } else if (pair.isPotentialDuplicate) {
        potential.push(pair);
      } else if (pair.similarity.nameScore >= t.nameSimilarity) {
        // 이름만 유사하면 동명이인
        homonyms.push(pair);
      }
    }
  }

  // 유사도 높은 순 정렬
  definite.sort((a, b) => b.similarity.overall - a.similarity.overall);
  potential.sort((a, b) => b.similarity.overall - a.similarity.overall);
  homonyms.sort((a, b) => b.similarity.nameScore - a.similarity.nameScore);

  return { definite, potential, homonyms };
}

/**
 * 중복 판단 결과 설명 생성
 */
export function explainDuplicate(pair: DuplicatePair): string {
  const { similarity, isDuplicate, isPotentialDuplicate } = pair;
  const parts: string[] = [];

  if (isDuplicate) {
    parts.push("🔴 확실한 중복:");
  } else if (isPotentialDuplicate) {
    parts.push("🟡 잠재적 중복:");
  } else {
    parts.push("🟢 동명이인 가능:");
  }

  if (similarity.factors.includes("same_email")) {
    parts.push("이메일 일치");
  }
  if (similarity.factors.includes("same_phone")) {
    parts.push("전화번호 일치");
  }
  if (similarity.factors.includes("exact_name_match")) {
    parts.push("이름 동일");
  } else if (similarity.factors.includes("similar_name")) {
    parts.push("이름 유사");
  }
  if (similarity.factors.includes("same_company")) {
    parts.push("동일 회사");
  }

  parts.push(`(유사도: ${Math.round(similarity.overall * 100)}%)`);

  return parts.join(" ");
}
