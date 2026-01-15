
import {
    CandidateSearchResult,
    SearchFacets,
    FacetItem,
    ExpYearsFacet,
    RiskLevel,
    ChunkType,
    getConfidenceLevel
} from "@/types";
import { sanitizeSkillsArray, sanitizeSkill, MAX_SKILLS_ARRAY_SIZE } from "@/lib/search/sanitize";

// ─────────────────────────────────────────────────
// Facet 계산 유틸리티
// ─────────────────────────────────────────────────

/**
 * 검색 결과에서 facet 데이터 계산
 * 필터 적용 후 결과 기준으로 계산하여 일관성 보장
 */
export function calculateFacets(results: CandidateSearchResult[]): SearchFacets {
    const skillsMap = new Map<string, number>();
    const companiesMap = new Map<string, number>();
    const locationsMap = new Map<string, number>();
    const expYears: ExpYearsFacet = {
        "0-3": 0,
        "3-5": 0,
        "5-10": 0,
        "10+": 0,
    };

    for (const candidate of results) {
        // Skills facet - sanitizeSkill 유틸 함수 사용
        if (candidate.skills && Array.isArray(candidate.skills)) {
            for (const skill of candidate.skills.slice(0, MAX_SKILLS_ARRAY_SIZE)) {
                const normalizedSkill = sanitizeSkill(skill);
                if (normalizedSkill) {
                    skillsMap.set(normalizedSkill, (skillsMap.get(normalizedSkill) || 0) + 1);
                }
            }
        }

        // Companies facet (from last company)
        if (candidate.company) {
            const normalizedCompany = candidate.company.trim();
            if (normalizedCompany) {
                companiesMap.set(normalizedCompany, (companiesMap.get(normalizedCompany) || 0) + 1);
            }
        }

        // Experience years facet
        const exp = candidate.expYears || 0;
        if (exp < 3) {
            expYears["0-3"]++;
        } else if (exp < 5) {
            expYears["3-5"]++;
        } else if (exp < 10) {
            expYears["5-10"]++;
        } else {
            expYears["10+"]++;
        }
    }

    // Map을 FacetItem 배열로 변환 (count 내림차순 정렬)
    const sortByCount = (a: FacetItem, b: FacetItem) => b.count - a.count;

    const skills: FacetItem[] = Array.from(skillsMap.entries())
        .map(([value, count]) => ({ value, count }))
        .sort(sortByCount)
        .slice(0, 30); // 상위 30개

    const companies: FacetItem[] = Array.from(companiesMap.entries())
        .map(([value, count]) => ({ value, count }))
        .sort(sortByCount)
        .slice(0, 20); // 상위 20개

    const locations: FacetItem[] = Array.from(locationsMap.entries())
        .map(([value, count]) => ({ value, count }))
        .sort(sortByCount)
        .slice(0, 15); // 상위 15개

    return {
        skills,
        companies,
        locations,
        expYears,
    };
}

// ─────────────────────────────────────────────────
// 변환 유틸리티
// ─────────────────────────────────────────────────

/**
 * DB row를 CandidateSearchResult로 변환
 */
export function toSearchResult(
    row: Record<string, unknown>,
    matchScore: number,
    matchedChunks: { type: ChunkType; content: string; score: number }[] = []
): CandidateSearchResult {
    const confidence = (row.confidence_score as number) ?? 0;
    const confidencePercent = Math.round(confidence * 100);

    return {
        id: row.id as string,
        name: row.name as string,
        role: (row.last_position as string) ?? "",
        company: (row.last_company as string) ?? "",
        expYears: (row.exp_years as number) ?? 0,
        skills: sanitizeSkillsArray(row.skills),
        photoUrl: row.photo_url as string | undefined,
        summary: row.summary as string | undefined,
        aiConfidence: confidencePercent,
        confidenceLevel: getConfidenceLevel(confidencePercent),
        riskLevel: (row.risk_level as RiskLevel) ?? "low",
        requiresReview: (row.requires_review as boolean) ?? false,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        matchScore: Math.round(matchScore * 100),
        matchedChunks,
    };
}

/**
 * ILIKE 패턴에서 특수문자 이스케이프 (SQL Injection 방지)
 * PostgreSQL ILIKE에서 특수 의미를 가진 문자: %, _, \
 */
export function escapeILikePattern(value: string): string {
    return value
        .replace(/\\/g, "\\\\")  // \ -> \\
        .replace(/%/g, "\\%")    // % -> \%
        .replace(/_/g, "\\_");   // _ -> \_
}

/**
 * 배열 필터용 값 살균 (중괄호 제거)
 */
export function sanitizeArrayValue(value: string): string {
    return value.replace(/[{}]/g, "").trim();
}
