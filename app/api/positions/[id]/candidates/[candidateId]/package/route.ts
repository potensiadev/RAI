/**
 * POST /api/positions/[id]/candidates/[candidateId]/package
 * 후보자 제출 패키지 생성 (P2)
 *
 * 헤드헌터 인터뷰 기반:
 * "후보자 매칭만 해주면, 결국 헤드헌터가 다시 문서 만듦"
 * "JD 기준 매칭 근거 3-5줄 + 리스크 + 확인 질문이 바로 뽑혀야"
 *
 * 기존: Blind Export (PII 제거된 기본 정보만)
 * 개선: JD 컨텍스트 기반 패키지 (매칭 분석 + 리스크 + 면접 질문)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit";
import OpenAI from "openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OpenAI 클라이언트
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

interface RouteParams {
  params: Promise<{ id: string; candidateId: string }>;
}

interface CandidatePackage {
  candidate: {
    name: string;
    lastPosition?: string;
    lastCompany?: string;
    expYears: number;
    skills: string[];
    summary?: string;
    careers: unknown[];
    education: unknown[];
  };
  position: {
    title: string;
    clientCompany?: string;
    requiredSkills: string[];
    minExpYears: number;
    maxExpYears?: number;
  };
  matchAnalysis: {
    overallScore: number;
    matchedSkills: string[];
    missingSkills: string[];
    matchReasons: string[];
    potentialRisks: string[];
  };
  interviewQuestions: {
    technical: string[];
    behavioral: string[];
    cultural: string[];
  };
  generatedAt: string;
}

/**
 * GPT-4로 매칭 분석 및 면접 질문 생성
 */
async function generatePackageContent(
  candidate: Record<string, unknown>,
  position: Record<string, unknown>,
  matchedSkills: string[],
  missingSkills: string[]
): Promise<{
  matchReasons: string[];
  potentialRisks: string[];
  interviewQuestions: {
    technical: string[];
    behavioral: string[];
    cultural: string[];
  };
}> {
  const openai = getOpenAIClient();

  const prompt = `당신은 전문 헤드헌터입니다. 후보자와 포지션 정보를 분석하여 제출 패키지를 작성해주세요.

## 후보자 정보
- 이름: ${candidate.name}
- 현재 직책: ${candidate.last_position || "미기재"}
- 현재 회사: ${candidate.last_company || "미기재"}
- 경력: ${candidate.exp_years}년
- 보유 스킬: ${(candidate.skills as string[])?.join(", ") || "미기재"}
- 요약: ${candidate.summary || "미기재"}

## 포지션 정보
- 포지션: ${position.title}
- 회사: ${position.client_company || "미기재"}
- 필수 스킬: ${(position.required_skills as string[])?.join(", ")}
- 필요 경력: ${position.min_exp_years}년 ~ ${position.max_exp_years || "무관"}년

## 매칭 분석
- 매칭된 스킬: ${matchedSkills.join(", ") || "없음"}
- 부족한 스킬: ${missingSkills.join(", ") || "없음"}

다음 형식으로 JSON을 반환해주세요:
{
  "matchReasons": ["매칭 이유 1", "매칭 이유 2", ...],  // 3-5개, 이 후보자가 이 포지션에 적합한 구체적 이유
  "potentialRisks": ["리스크 1", "리스크 2", ...],      // 2-3개, 채용 시 확인해야 할 잠재적 리스크
  "interviewQuestions": {
    "technical": ["기술 질문 1", ...],    // 3-5개, 부족한 스킬이나 검증 필요한 기술 역량 확인
    "behavioral": ["행동 질문 1", ...],   // 2-3개, 과거 경험 기반 행동 패턴 확인
    "cultural": ["문화 질문 1", ...]      // 2개, 조직 적합성 확인
  }
}

매칭 이유는 구체적인 근거와 함께 작성하세요 (예: "결제 도메인 5년 경력으로 JD 요구사항 충족")
리스크는 객관적이고 확인 가능한 것 위주로 작성하세요 (예: "리더십 경험 부족 - 팀 리드 역할 검증 필요")
면접 질문은 실제 면접에서 사용할 수 있는 구체적인 질문으로 작성하세요.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 1500,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("GPT 응답을 받지 못했습니다.");
  }

  const parsed = JSON.parse(content);

  return {
    matchReasons: Array.isArray(parsed.matchReasons)
      ? parsed.matchReasons.slice(0, 5)
      : [],
    potentialRisks: Array.isArray(parsed.potentialRisks)
      ? parsed.potentialRisks.slice(0, 3)
      : [],
    interviewQuestions: {
      technical: Array.isArray(parsed.interviewQuestions?.technical)
        ? parsed.interviewQuestions.technical.slice(0, 5)
        : [],
      behavioral: Array.isArray(parsed.interviewQuestions?.behavioral)
        ? parsed.interviewQuestions.behavioral.slice(0, 3)
        : [],
      cultural: Array.isArray(parsed.interviewQuestions?.cultural)
        ? parsed.interviewQuestions.cultural.slice(0, 2)
        : [],
    },
  };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await withRateLimit(request, "default");
    if (rateLimitResponse) return rateLimitResponse;

    const { id: positionId, candidateId } = await params;
    const supabase = await createClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다." },
        { status: 401 }
      );
    }

    // 포지션 조회 및 소유권 확인
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: position, error: positionError } = await (supabase as any)
      .from("positions")
      .select("*")
      .eq("id", positionId)
      .eq("user_id", user.id)
      .single();

    if (positionError || !position) {
      return NextResponse.json(
        { success: false, error: "포지션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 후보자 조회 및 소유권 확인
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: candidate, error: candidateError } = await (supabase as any)
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .eq("user_id", user.id)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { success: false, error: "후보자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 매칭 정보 조회 (있는 경우)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matchData } = await (supabase as any)
      .from("position_candidates")
      .select("*")
      .eq("position_id", positionId)
      .eq("candidate_id", candidateId)
      .single();

    // 매칭 정보가 없으면 직접 계산
    let matchedSkills: string[] = [];
    let missingSkills: string[] = [];
    let overallScore = 0;

    if (matchData) {
      matchedSkills = (matchData.matched_skills as string[]) || [];
      missingSkills = (matchData.missing_skills as string[]) || [];
      overallScore = Math.round(((matchData.overall_score as number) || 0) * 100);
    } else {
      // 스킬 매칭 계산
      const candidateSkills = new Set(
        ((candidate.skills as string[]) || []).map((s) => s.toLowerCase())
      );
      const requiredSkills = (position.required_skills as string[]) || [];

      for (const skill of requiredSkills) {
        if (candidateSkills.has(skill.toLowerCase())) {
          matchedSkills.push(skill);
        } else {
          missingSkills.push(skill);
        }
      }

      overallScore = requiredSkills.length > 0
        ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
        : 50;
    }

    // GPT-4로 패키지 콘텐츠 생성
    const generatedContent = await generatePackageContent(
      candidate as Record<string, unknown>,
      position as Record<string, unknown>,
      matchedSkills,
      missingSkills
    );

    // 패키지 구성
    const pkg: CandidatePackage = {
      candidate: {
        name: candidate.name as string,
        lastPosition: candidate.last_position as string | undefined,
        lastCompany: candidate.last_company as string | undefined,
        expYears: (candidate.exp_years as number) || 0,
        skills: (candidate.skills as string[]) || [],
        summary: candidate.summary as string | undefined,
        careers: (candidate.careers as unknown[]) || [],
        education: (candidate.education as unknown[]) || [],
      },
      position: {
        title: position.title as string,
        clientCompany: position.client_company as string | undefined,
        requiredSkills: (position.required_skills as string[]) || [],
        minExpYears: (position.min_exp_years as number) || 0,
        maxExpYears: position.max_exp_years as number | undefined,
      },
      matchAnalysis: {
        overallScore,
        matchedSkills,
        missingSkills,
        matchReasons: generatedContent.matchReasons,
        potentialRisks: generatedContent.potentialRisks,
      },
      interviewQuestions: generatedContent.interviewQuestions,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: pkg,
    });
  } catch (error) {
    console.error("Generate package error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "패키지 생성에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
