import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// App Router Route Segment Config: Allow large file uploads
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Note: For Vercel body size limit, use vercel.json or check plan limits
// The FUNCTION_PAYLOAD_TOO_LARGE error means file exceeds Vercel's 4.5MB limit
// Solution: Use direct-to-storage upload pattern instead of server upload

// Worker URL (환경 변수로 설정)
const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000";

// 지원하는 파일 확장자
const ALLOWED_EXTENSIONS = [".hwp", ".hwpx", ".doc", ".docx", ".pdf"];

// 최대 파일 크기 (50MB)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface UploadResponse {
  success: boolean;
  jobId?: string;
  candidateId?: string;
  message?: string;
  error?: string;
}

interface ProcessResult {
  success: boolean;
  candidate_id?: string;  // Worker가 저장한 candidate ID
  data?: CandidateData;
  confidence_score?: number;
  field_confidence?: Record<string, number>;
  analysis_warnings?: Array<{ type: string; field: string; message: string; severity: string }>;
  pii_count?: number;
  pii_types?: string[];
  privacy_warnings?: string[];
  encrypted_fields?: string[];
  chunk_count?: number;
  chunks_saved?: number;  // 실제 저장된 청크 수
  chunks_summary?: ChunkSummary[];
  embedding_tokens?: number;
  processing_time_ms?: number;
  mode?: string;
  error?: string;
}

interface CandidateData {
  name?: string;
  birth_year?: number;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  location_city?: string;
  exp_years?: number;
  last_company?: string;
  last_position?: string;
  careers?: Career[];
  skills?: string[];
  education_level?: string;
  education_school?: string;
  education_major?: string;
  educations?: Education[];
  projects?: Project[];
  summary?: string;
  strengths?: string[];
  portfolio_url?: string;
  github_url?: string;
  linkedin_url?: string;
}

interface Career {
  company: string;
  position?: string;
  department?: string;
  start_date?: string;
  end_date?: string;
  is_current: boolean;
  description?: string;
}

interface Education {
  school: string;
  degree?: string;
  major?: string;
  graduation_year?: number;
  is_graduated: boolean;
}

interface Project {
  name: string;
  role?: string;
  period?: string;
  description?: string;
  technologies?: string[];
}

interface ChunkSummary {
  type: string;
  index: number;
  content_preview: string;
  has_embedding: boolean;
  embedding?: number[];
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    const supabase = await createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabaseAny = supabase as any;

    // 인증 확인
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 크레딧 확인 (email로 조회 - auth.users.id와 public.users.id가 다를 수 있음)
    if (!user.email) {
      return NextResponse.json(
        { success: false, error: "User email not found" },
        { status: 400 }
      );
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, credits, credits_used_this_month, plan")
      .eq("email", user.email)
      .single();

    if (userError || !userData) {
      console.error("[Upload] User not found:", userError, "email:", user.email);
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // public.users의 ID 사용 (auth.users.id와 다를 수 있음)
    const publicUserId = (userData as { id: string }).id;

    // 크레딧 계산
    const baseCredits: Record<string, number> = {
      starter: 50,
      pro: 150,
      enterprise: 300,
    };
    const userInfo = userData as { credits: number; credits_used_this_month: number; plan: string };
    const remaining =
      (baseCredits[userInfo.plan] || 50) -
      userInfo.credits_used_this_month +
      userInfo.credits;

    if (remaining <= 0) {
      return NextResponse.json(
        { success: false, error: "Insufficient credits" },
        { status: 402 }
      );
    }

    // FormData 파싱
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // 파일 확장자 확인
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // 파일 크기 확인
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File size exceeds 50MB limit" },
        { status: 400 }
      );
    }

    // processing_jobs 레코드 생성 (publicUserId 사용)
    const { data: job, error: jobError } = await supabaseAny
      .from("processing_jobs")
      .insert({
        user_id: publicUserId,
        file_name: file.name,
        file_size: file.size,
        file_type: ext.replace(".", ""),
        status: "queued",
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error("Failed to create job:", jobError);
      return NextResponse.json(
        { success: false, error: "Failed to create processing job" },
        { status: 500 }
      );
    }

    const jobData = job as { id: string };

    // Supabase Storage에 파일 업로드
    // 한글 파일명 문제 방지: UUID + 확장자로 저장
    const safeFileName = `${jobData.id}${ext}`;
    const storagePath = `uploads/${user.id}/${safeFileName}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(storagePath, fileBuffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      // 업로드 실패 시 job 상태 업데이트
      await supabaseAny
        .from("processing_jobs")
        .update({ status: "failed", error_message: uploadError.message })
        .eq("id", jobData.id);

      console.error("Storage upload failed:", uploadError);
      return NextResponse.json(
        { success: false, error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // ─────────────────────────────────────────────────
    // 3. candidates 테이블에 초기 레코드 생성 (즉시 조회용)
    // ─────────────────────────────────────────────────
    const { data: candidate, error: candidateError } = await supabaseAny
      .from("candidates")
      .insert({
        user_id: publicUserId,
        name: file.name, // 임시 이름 (파일명)
        status: "processing", // 처리 중 상태
        is_latest: true,
        version: 1,
        source_file: storagePath, // Add source file path
        file_type: ext.replace(".", ""), // Add file type
      })
      .select()
      .single();

    if (candidateError || !candidate) {
      console.error("Failed to create candidate:", candidateError);
      // 실패해도 진행은 가능하지만, UI 즉시 반영은 안됨. 로그만 남김.
    }

    const candidateId = candidate?.id;

    // processing_jobs에 candidate_id 업데이트
    if (candidateId) {
      await supabaseAny
        .from("processing_jobs")
        .update({ candidate_id: candidateId })
        .eq("id", jobData.id);
    }

    // ─────────────────────────────────────────────────
    // Worker에 비동기 처리 요청 (fire-and-forget)
    // Vercel 타임아웃 방지를 위해 응답을 기다리지 않음
    // Worker가 백그라운드에서 파싱 → 분석 → DB 저장 → 크레딧 차감
    // ─────────────────────────────────────────────────

    // Worker 전체 파이프라인 호출 (비동기, 응답 대기 안함)
    const workerPayload = {
      file_url: storagePath,
      file_name: file.name,
      user_id: publicUserId,
      job_id: jobData.id,
      candidate_id: candidateId, // 생성된 candidate ID 전달
      mode: userInfo.plan === "enterprise" ? "phase_2" : "phase_1",
    };

    // Fire-and-forget: Worker에 요청 보내고 응답 기다리지 않음
    fetch(`${WORKER_URL}/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workerPayload),
    }).catch((error) => {
      // 연결 실패 시 로그만 남김 (이미 사용자에게 응답함)
      console.error("Worker pipeline request failed:", error);
    });

    // 즉시 응답 반환 - Worker가 백그라운드에서 처리
    return NextResponse.json({
      success: true,
      jobId: jobData.id,
      message: "파일이 업로드되었습니다. 백그라운드에서 분석 중입니다.",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET: 업로드 상태 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabaseAny = supabase as any;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (jobId) {
    // 특정 job 조회
    const { data, error } = await supabaseAny
      .from("processing_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  }

  // 최근 job 목록 조회
  const { data, error } = await supabaseAny
    .from("processing_jobs")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
