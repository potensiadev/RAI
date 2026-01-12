/**
 * GET /api/candidates/duplicates
 * 중복 후보자 감지 (phone_hash, email_hash, similar_name 기반)
 *
 * Query Params:
 * - includeSimilarNames: true/false (기본 false) - 유사 이름 중복 포함 여부
 * - nameThreshold: 0.0-1.0 (기본 0.7) - 유사 이름 임계값
 * - enhanced: true/false (기본 false) - 향상된 중복 감지 (동명이인 구분)
 * - definiteThreshold: 0.0-1.0 (기본 0.9) - 확실한 중복 임계값
 * - potentialThreshold: 0.0-1.0 (기본 0.6) - 잠재적 중복 임계값
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiUnauthorized, apiInternalError } from "@/lib/api-response";
import {
  findDuplicateGroups,
  explainDuplicate,
  type CandidateForDuplicateCheck,
  type DuplicatePair,
} from "@/lib/candidates/duplicate-detector";

interface DuplicateGroup {
  hash: string;
  type: "phone" | "email" | "similar_name";
  candidates: {
    id: string;
    name: string;
    last_position: string | null;
    last_company: string | null;
    created_at: string;
    source_file: string | null;
    similarity_score?: number;
  }[];
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiUnauthorized();
    }

    // Query params 파싱
    const { searchParams } = new URL(request.url);
    const includeSimilarNames = searchParams.get("includeSimilarNames") === "true";
    const nameThresholdParam = searchParams.get("nameThreshold");
    const nameThreshold = nameThresholdParam ? parseFloat(nameThresholdParam) : 0.7;

    // 향상된 중복 감지 모드 (동명이인 구분)
    const enhanced = searchParams.get("enhanced") === "true";
    const definiteThreshold = parseFloat(searchParams.get("definiteThreshold") || "0.9");
    const potentialThreshold = parseFloat(searchParams.get("potentialThreshold") || "0.6");

    // 향상된 모드: 복합 필드 비교로 동명이인 구분
    if (enhanced) {
      return handleEnhancedDuplicateDetection(
        supabase,
        user.id,
        { definite: definiteThreshold, potential: potentialThreshold, nameSimilarity: nameThreshold }
      );
    }

    // 전화번호 해시 기준 중복 조회
    const { data: phoneData, error: phoneError } = await supabase
      .from("candidates")
      .select("id, name, last_position, last_company, created_at, source_file, phone_hash")
      .eq("user_id", user.id)
      .eq("is_latest", true)
      .eq("status", "completed")
      .not("phone_hash", "is", null);

    if (phoneError) {
      console.error("Phone duplicates error:", phoneError);
      return apiInternalError();
    }

    // 이메일 해시 기준 중복 조회
    const { data: emailData, error: emailError } = await supabase
      .from("candidates")
      .select("id, name, last_position, last_company, created_at, source_file, email_hash")
      .eq("user_id", user.id)
      .eq("is_latest", true)
      .eq("status", "completed")
      .not("email_hash", "is", null);

    if (emailError) {
      console.error("Email duplicates error:", emailError);
      return apiInternalError();
    }

    // 중복 그룹화 함수
    function groupByHash<T extends Record<string, unknown>>(
      data: T[],
      hashField: string,
      type: "phone" | "email"
    ): DuplicateGroup[] {
      const hashMap = new Map<string, T[]>();

      for (const item of data) {
        const hash = item[hashField] as string;
        if (hash) {
          if (!hashMap.has(hash)) {
            hashMap.set(hash, []);
          }
          hashMap.get(hash)!.push(item);
        }
      }

      const duplicates: DuplicateGroup[] = [];
      for (const [hash, items] of hashMap) {
        if (items.length > 1) {
          duplicates.push({
            hash,
            type,
            candidates: items.map((item) => ({
              id: item.id as string,
              name: item.name as string,
              last_position: item.last_position as string | null,
              last_company: item.last_company as string | null,
              created_at: item.created_at as string,
              source_file: item.source_file as string | null,
            })),
          });
        }
      }

      return duplicates;
    }

    const phoneDuplicates = groupByHash(phoneData || [], "phone_hash", "phone");
    const emailDuplicates = groupByHash(emailData || [], "email_hash", "email");

    // 중복 해시 제거 (phone과 email이 같은 그룹일 수 있음)
    const seenHashes = new Set<string>();
    const allDuplicates: DuplicateGroup[] = [];

    for (const group of phoneDuplicates) {
      if (!seenHashes.has(group.hash)) {
        seenHashes.add(group.hash);
        allDuplicates.push(group);
      }
    }

    for (const group of emailDuplicates) {
      if (!seenHashes.has(group.hash)) {
        seenHashes.add(group.hash);
        allDuplicates.push(group);
      }
    }

    // 유사 이름 중복 감지 (pg_trgm 기반)
    let similarNameDuplicates: DuplicateGroup[] = [];
    if (includeSimilarNames) {
      // 모든 후보자 조회
      const { data: allCandidatesRaw } = await supabase
        .from("candidates")
        .select("id, name, last_position, last_company, created_at, source_file")
        .eq("user_id", user.id)
        .eq("is_latest", true)
        .eq("status", "completed")
        .not("name", "is", null);

      const allCandidates = allCandidatesRaw as {
        id: string;
        name: string;
        last_position: string | null;
        last_company: string | null;
        created_at: string;
        source_file: string | null;
      }[] | null;

      if (allCandidates && allCandidates.length > 0) {
        // 이미 hash로 중복 처리된 ID 제외
        const hashDuplicateIds = new Set<string>();
        for (const group of allDuplicates) {
          for (const c of group.candidates) {
            hashDuplicateIds.add(c.id);
          }
        }

        // 유사 이름 그룹 찾기
        const processedNames = new Set<string>();
        const nameGroups: DuplicateGroup[] = [];

        for (const candidate of allCandidates) {
          if (hashDuplicateIds.has(candidate.id)) continue;
          if (!candidate.name || processedNames.has(candidate.name.toLowerCase())) continue;

          // pg_trgm으로 유사 이름 검색
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: similarData } = await (supabase as any).rpc("search_similar_names", {
            p_user_id: user.id,
            p_name: candidate.name,
            p_threshold: nameThreshold,
            p_limit: 10,
          });

          if (similarData && similarData.length > 1) {
            // 자기 자신 제외하고 2명 이상이면 중복 그룹
            const groupCandidates = similarData
              .filter((c: { id: string }) => !hashDuplicateIds.has(c.id))
              .map((c: {
                id: string;
                name: string;
                last_position: string | null;
                last_company: string | null;
                created_at: string;
                source_file: string | null;
                similarity_score: number;
              }) => ({
                id: c.id,
                name: c.name,
                last_position: c.last_position,
                last_company: c.last_company,
                created_at: c.created_at,
                source_file: c.source_file,
                similarity_score: c.similarity_score,
              }));

            if (groupCandidates.length > 1) {
              nameGroups.push({
                hash: `name:${candidate.name.toLowerCase()}`,
                type: "similar_name",
                candidates: groupCandidates,
              });

              // 처리된 이름들 기록
              for (const c of groupCandidates) {
                processedNames.add(c.name.toLowerCase());
              }
            }
          }
        }

        similarNameDuplicates = nameGroups;
      }
    }

    // 모든 중복 합치기
    const finalDuplicates = [...allDuplicates, ...similarNameDuplicates];

    // 가장 많은 중복부터 정렬
    finalDuplicates.sort((a, b) => b.candidates.length - a.candidates.length);

    return apiSuccess({
      duplicates: finalDuplicates,
      summary: {
        totalGroups: finalDuplicates.length,
        totalDuplicates: finalDuplicates.reduce((acc, g) => acc + g.candidates.length, 0),
        byPhone: phoneDuplicates.length,
        byEmail: emailDuplicates.length,
        bySimilarName: similarNameDuplicates.length,
      },
    });
  } catch (error) {
    console.error("Duplicates API error:", error);
    return apiInternalError();
  }
}

/**
 * 향상된 중복 감지 핸들러 (동명이인 구분)
 */
async function handleEnhancedDuplicateDetection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  thresholds: { definite: number; potential: number; nameSimilarity: number }
) {
  try {
    // 모든 후보자 조회 (중복 감지에 필요한 필드만)
    const { data: candidates, error } = await supabase
      .from("candidates")
      .select("id, name, email, phone, last_company, last_position, location_city, created_at, source_file")
      .eq("user_id", userId)
      .eq("is_latest", true)
      .eq("status", "completed")
      .not("name", "is", null);

    if (error) {
      console.error("Enhanced duplicates query error:", error);
      return apiInternalError();
    }

    if (!candidates || candidates.length === 0) {
      return apiSuccess({
        enhanced: true,
        definite: [],
        potential: [],
        homonyms: [],
        summary: {
          totalCandidates: 0,
          definiteCount: 0,
          potentialCount: 0,
          homonymCount: 0,
        },
      });
    }

    // 중복 그룹 찾기
    const { definite, potential, homonyms } = findDuplicateGroups(
      candidates as CandidateForDuplicateCheck[],
      thresholds
    );

    // 결과 포맷팅
    const formatPair = (pair: DuplicatePair) => ({
      candidate1: {
        id: pair.candidate1.id,
        name: pair.candidate1.name,
        last_company: pair.candidate1.last_company,
        last_position: pair.candidate1.last_position,
        created_at: pair.candidate1.created_at,
      },
      candidate2: {
        id: pair.candidate2.id,
        name: pair.candidate2.name,
        last_company: pair.candidate2.last_company,
        last_position: pair.candidate2.last_position,
        created_at: pair.candidate2.created_at,
      },
      similarity: {
        overall: Math.round(pair.similarity.overall * 100),
        name: Math.round(pair.similarity.nameScore * 100),
        email: Math.round(pair.similarity.emailScore * 100),
        phone: Math.round(pair.similarity.phoneScore * 100),
        company: Math.round(pair.similarity.companyScore * 100),
      },
      explanation: explainDuplicate(pair),
    });

    return apiSuccess({
      enhanced: true,
      definite: definite.map(formatPair),
      potential: potential.map(formatPair),
      homonyms: homonyms.slice(0, 50).map(formatPair), // 동명이인은 최대 50개만
      summary: {
        totalCandidates: candidates.length,
        definiteCount: definite.length,
        potentialCount: potential.length,
        homonymCount: homonyms.length,
      },
    });
  } catch (error) {
    console.error("Enhanced duplicates error:", error);
    return apiInternalError();
  }
}
