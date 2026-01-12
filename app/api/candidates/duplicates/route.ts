/**
 * GET /api/candidates/duplicates
 * 중복 후보자 감지 (phone_hash, email_hash, similar_name 기반)
 *
 * Query Params:
 * - includeSimilarNames: true/false (기본 false) - 유사 이름 중복 포함 여부
 * - nameThreshold: 0.0-1.0 (기본 0.7) - 유사 이름 임계값
 */

import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiSuccess, apiUnauthorized, apiInternalError } from "@/lib/api-response";

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
