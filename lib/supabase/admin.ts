/**
 * Supabase Admin Client (Service Role)
 *
 * API 라우트에서 RLS를 우회하고 고성능 작업을 수행할 때 사용
 * - 싱글톤 패턴으로 연결 재사용
 * - Service Role Key 사용 (RLS 우회)
 *
 * 주의: 이 클라이언트는 서버 사이드에서만 사용해야 함
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types";

let adminClient: SupabaseClient<Database> | null = null;

/**
 * Admin Supabase Client 가져오기 (싱글톤)
 *
 * @returns Supabase Admin Client
 */
export function getAdminClient(): SupabaseClient<Database> {
  if (adminClient) {
    return adminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    // 연결 풀링 설정
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "x-client-info": "rai-admin-client",
      },
    },
  });

  return adminClient;
}

/**
 * RPC 함수 호출 헬퍼 (타입 안전)
 */
export async function callRpc<T>(
  functionName: string,
  params: Record<string, unknown>
): Promise<{ data: T | null; error: Error | null }> {
  const client = getAdminClient();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.rpc as any)(functionName, params);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as T, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * 크레딧 예약 (Atomic)
 */
export async function reserveCredit(
  userId: string,
  jobId?: string,
  description?: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await callRpc<boolean>("reserve_credit", {
    p_user_id: userId,
    p_job_id: jobId || null,
    p_description: description || "이력서 분석 크레딧 예약",
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: data === true };
}

/**
 * 크레딧 예약 해제 (실패 시 롤백)
 */
export async function releaseCreditReservation(
  userId: string,
  jobId?: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await callRpc<boolean>("release_credit_reservation", {
    p_user_id: userId,
    p_job_id: jobId || null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: data === true };
}

/**
 * 동시 업로드 제한 체크
 */
export async function checkConcurrentUploadLimit(
  userId: string,
  maxConcurrent: number = 5
): Promise<{ allowed: boolean; error?: string }> {
  const { data, error } = await callRpc<boolean>("check_concurrent_upload_limit", {
    p_user_id: userId,
    p_max_concurrent: maxConcurrent,
  });

  if (error) {
    // 에러 시 보수적으로 허용 (DB 함수 미존재 대응)
    console.warn("check_concurrent_upload_limit error:", error.message);
    return { allowed: true };
  }

  return { allowed: data === true };
}

/**
 * 트랜잭션 실행 헬퍼
 *
 * Supabase는 직접적인 트랜잭션을 지원하지 않으므로
 * 여러 작업을 순차적으로 실행하고 실패 시 롤백 로직 제공
 */
export async function withRollback<T>(
  operation: () => Promise<T>,
  rollback: () => Promise<void>
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const result = await operation();
    return { data: result, error: null };
  } catch (err) {
    // 롤백 시도
    try {
      await rollback();
    } catch (rollbackErr) {
      console.error("Rollback failed:", rollbackErr);
    }

    return {
      data: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
