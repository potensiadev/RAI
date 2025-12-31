# RAI Week 2 재작업: 누락된 기능 구현

## 📋 현재 상황
Week 2 작업물 검토 결과, 다음 항목들이 누락되었습니다:
- API 라우트 전체 미구현
- hooks, providers 폴더 없음
- 인증 로직 미구현 (버튼 클릭 시 아무 동작 없음)
- /dashboard 페이지 없음 (404)
- Root Layout과 Dashboard Layout에 Sidebar 중복
- QueryProvider 미설정
- 컴포넌트들이 여전히 Mock 데이터 사용

## 🎯 수정 작업 (순서대로 진행)

### Task 1: Root Layout 정리
**파일:** `app/layout.tsx`

수정사항:
1. Sidebar import 및 컴포넌트 제거 (dashboard layout에만 있어야 함)
2. QueryProvider 추가
```tsx
// app/layout.tsx 수정 후
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { QueryProvider } from "@/providers/QueryProvider";
import "./globals.css";
import { cn } from "@/lib/utils";

// ... fonts 설정 유지 ...

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={cn(inter.variable, jetbrainsMono.variable, "antialiased bg-deep-space text-foreground min-h-screen font-sans")}>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
```

---

### Task 2: QueryProvider 생성
**파일:** `providers/QueryProvider.tsx` (새로 생성)
```tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1분
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

---

### Task 3: Dashboard 페이지 생성
**파일:** `app/(dashboard)/page.tsx` (새로 생성)
```tsx
"use client";

import { useState } from "react";
import SpotlightSearch from "@/components/dashboard/SpotlightSearch";
import GravityGrid from "@/components/dashboard/GravityGrid";

export default function DashboardPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const isSearchMode = searchQuery.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Candidate Assets</h1>
        <p className="text-slate-400 mt-1">
          AI가 분석한 후보자 자산을 검색하고 관리하세요
        </p>
      </div>

      {/* Search */}
      <SpotlightSearch 
        query={searchQuery} 
        onQueryChange={setSearchQuery} 
      />

      {/* Grid */}
      <GravityGrid isSearchMode={isSearchMode} searchQuery={searchQuery} />
    </div>
  );
}
```

---

### Task 4: 인증 페이지 로직 구현

#### 4-1. Login 페이지
**파일:** `app/(auth)/login/page.tsx`

Supabase 인증 로직 추가:
- useState로 email, password 관리
- handleEmailLogin 함수: supabase.auth.signInWithPassword
- handleGoogleLogin 함수: supabase.auth.signInWithOAuth
- 에러 처리 및 로딩 상태 표시
- 성공 시 /dashboard로 리다이렉트
```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      router.push(next);
      router.refresh();
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${next}`,
      },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-white">HR Screener</h1>
        <p className="text-slate-400 text-sm">헤드헌터 전용 후보자 관리 플랫폼</p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleEmailLogin} className="p-6 rounded-2xl bg-[#0F0F24]/60 backdrop-blur-md border border-white/5 space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <Button className="w-full" size="lg" disabled={isLoading}>
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          로그인
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0F0F24] px-2 text-slate-500">또는</span>
          </div>
        </div>

        <Button type="button" variant="outline" className="w-full" size="lg" onClick={handleGoogleLogin}>
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google로 계속하기
        </Button>
      </form>

      <p className="text-center text-sm text-slate-500">
        계정이 없으신가요?{" "}
        <Link href="/signup" className="text-primary hover:underline">회원가입</Link>
      </p>
    </div>
  );
}
```

#### 4-2. Signup 페이지
**파일:** `app/(auth)/signup/page.tsx`

동일한 패턴으로:
- supabase.auth.signUp 사용
- 성공 시 /consent로 리다이렉트
- 비밀번호 확인 검증 추가

#### 4-3. Consent 페이지
**파일:** `app/(auth)/consent/page.tsx`

handleSubmit 함수 수정:
- Supabase에서 현재 사용자 가져오기
- user_consents 테이블에 동의 기록 저장
- users 테이블의 consents_completed를 true로 업데이트
- 성공 시 /dashboard로 이동
```tsx
const handleSubmit = async () => {
  if (!allRequiredChecked) return;
  setIsSubmitting(true);

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push("/login");
      return;
    }

    const now = new Date().toISOString();
    const version = "2025.01.01";

    // 동의 기록 저장
    const { error: consentError } = await supabase
      .from("user_consents")
      .insert({
        user_id: user.id,
        terms_of_service: true,
        terms_of_service_version: version,
        terms_of_service_agreed_at: now,
        privacy_policy: true,
        privacy_policy_version: version,
        privacy_policy_agreed_at: now,
        third_party_data_guarantee: true,
        third_party_data_guarantee_version: version,
        third_party_data_guarantee_agreed_at: now,
        marketing_consent: consents.marketing,
        marketing_consent_agreed_at: consents.marketing ? now : null,
      });

    if (consentError) throw consentError;

    // 사용자 프로필 업데이트
    const { error: userError } = await supabase
      .from("users")
      .update({
        consents_completed: true,
        consents_completed_at: now,
      })
      .eq("id", user.id);

    if (userError) throw userError;

    router.push("/dashboard");
    router.refresh();
  } catch (error) {
    console.error("Consent error:", error);
    setError("동의 저장에 실패했습니다. 다시 시도해주세요.");
  } finally {
    setIsSubmitting(false);
  }
};
```

---

### Task 5: API 라우트 생성

#### 5-1. 후보자 목록
**파일:** `app/api/candidates/route.ts` (새로 생성)
```tsx
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("candidates")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .eq("is_latest", true)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    data,
    total: count,
    page,
    limit,
    hasMore: count ? offset + limit < count : false,
  });
}
```

#### 5-2. 후보자 상세
**파일:** `app/api/candidates/[id]/route.ts` (새로 생성)
```tsx
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const { data, error } = await supabase
    .from("candidates")
    .update(body)
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
```

#### 5-3. 크레딧 조회
**파일:** `app/api/user/credits/route.ts` (새로 생성)
```tsx
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("users")
    .select("credits, credits_used_this_month, plan")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 플랜별 기본 크레딧
  const baseCredits = {
    starter: 50,
    pro: 150,
    enterprise: 300,
  };

  const remaining = (baseCredits[data.plan as keyof typeof baseCredits] || 50) 
    - data.credits_used_this_month 
    + data.credits;

  return NextResponse.json({
    credits: data.credits,
    creditsUsedThisMonth: data.credits_used_this_month,
    plan: data.plan,
    remaining: Math.max(0, remaining),
  });
}
```

#### 5-4. 검색 API
**파일:** `app/api/search/route.ts` (새로 생성)
```tsx
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { query, filters, page = 1, limit = 20 } = body;
  const offset = (page - 1) * limit;

  // 기본 쿼리 빌더
  let queryBuilder = supabase
    .from("candidates")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .eq("is_latest", true)
    .eq("status", "completed");

  // 필터 적용
  if (filters?.expYearsMin) {
    queryBuilder = queryBuilder.gte("exp_years", filters.expYearsMin);
  }
  if (filters?.expYearsMax) {
    queryBuilder = queryBuilder.lte("exp_years", filters.expYearsMax);
  }
  if (filters?.skills?.length > 0) {
    queryBuilder = queryBuilder.overlaps("skills", filters.skills);
  }
  if (filters?.locationCity) {
    queryBuilder = queryBuilder.ilike("location_city", `%${filters.locationCity}%`);
  }

  // 텍스트 검색 (간단한 ILIKE)
  if (query) {
    queryBuilder = queryBuilder.or(
      `name.ilike.%${query}%,last_position.ilike.%${query}%,last_company.ilike.%${query}%,summary.ilike.%${query}%`
    );
  }

  const { data, error, count } = await queryBuilder
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 매칭 스코어 추가 (임시로 confidence_score 사용)
  const resultsWithScore = data?.map((candidate) => ({
    ...candidate,
    matchScore: query ? Math.random() * 30 + 70 : 0, // 실제로는 Vector 검색 결과 사용
  }));

  return NextResponse.json({
    data: resultsWithScore,
    total: count,
    page,
    limit,
    hasMore: count ? offset + limit < count : false,
  });
}
```

---

### Task 6: React Query 훅 생성

#### 6-1. useCandidates
**파일:** `hooks/useCandidates.ts` (새로 생성)
```tsx
import { useQuery } from "@tanstack/react-query";

interface CandidatesOptions {
  page?: number;
  limit?: number;
}

async function fetchCandidates(options: CandidatesOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (options.limit) params.set("limit", String(options.limit));

  const res = await fetch(`/api/candidates?${params}`);
  if (!res.ok) throw new Error("Failed to fetch candidates");
  return res.json();
}

export function useCandidates(options: CandidatesOptions = {}) {
  return useQuery({
    queryKey: ["candidates", options],
    queryFn: () => fetchCandidates(options),
  });
}

async function fetchCandidate(id: string) {
  const res = await fetch(`/api/candidates/${id}`);
  if (!res.ok) throw new Error("Failed to fetch candidate");
  return res.json();
}

export function useCandidate(id: string) {
  return useQuery({
    queryKey: ["candidate", id],
    queryFn: () => fetchCandidate(id),
    enabled: !!id,
  });
}
```

#### 6-2. useSearch
**파일:** `hooks/useSearch.ts` (새로 생성)
```tsx
import { useMutation } from "@tanstack/react-query";

interface SearchRequest {
  query?: string;
  filters?: {
    expYearsMin?: number;
    expYearsMax?: number;
    skills?: string[];
    locationCity?: string;
  };
  page?: number;
  limit?: number;
}

async function searchCandidates(request: SearchRequest) {
  const res = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export function useSearch() {
  return useMutation({
    mutationFn: searchCandidates,
  });
}
```

#### 6-3. useCredits
**파일:** `hooks/useCredits.ts` (새로 생성)
```tsx
import { useQuery } from "@tanstack/react-query";

async function fetchCredits() {
  const res = await fetch("/api/user/credits");
  if (!res.ok) throw new Error("Failed to fetch credits");
  return res.json();
}

export function useCredits() {
  return useQuery({
    queryKey: ["credits"],
    queryFn: fetchCredits,
    refetchInterval: 30000, // 30초마다 갱신
  });
}
```

---

### Task 7: 컴포넌트 데이터 연동

#### 7-1. GravityGrid 수정
**파일:** `components/dashboard/GravityGrid.tsx`
```tsx
"use client";

import { useCandidates } from "@/hooks/useCandidates";
import { useSearch } from "@/hooks/useSearch";
import { useEffect } from "react";
import LevitatingCard from "./LevitatingCard";
import { Loader2 } from "lucide-react";

interface GravityGridProps {
  isSearchMode?: boolean;
  searchQuery?: string;
}

export default function GravityGrid({ isSearchMode = false, searchQuery = "" }: GravityGridProps) {
  const { data: candidatesData, isLoading: isCandidatesLoading } = useCandidates();
  const searchMutation = useSearch();

  // 검색 모드일 때 검색 실행
  useEffect(() => {
    if (isSearchMode && searchQuery) {
      const timer = setTimeout(() => {
        searchMutation.mutate({ query: searchQuery });
      }, 300); // 디바운스
      return () => clearTimeout(timer);
    }
  }, [searchQuery, isSearchMode]);

  const isLoading = isCandidatesLoading || searchMutation.isPending;
  const candidates = isSearchMode && searchMutation.data?.data 
    ? searchMutation.data.data 
    : candidatesData?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <p>등록된 후보자가 없습니다.</p>
        <p className="text-sm mt-1">이력서를 업로드하여 시작하세요.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
      {candidates.map((candidate: any, index: number) => (
        <LevitatingCard
          key={candidate.id}
          data={{
            id: candidate.id,
            name: candidate.name,
            role: candidate.last_position || "직책 미상",
            company: candidate.last_company || "",
            expYears: candidate.exp_years || 0,
            skills: candidate.skills || [],
            photoUrl: candidate.photo_url,
            summary: candidate.summary,
            aiConfidence: Math.round((candidate.confidence_score || 0) * 100),
            matchScore: candidate.matchScore || 0,
            riskLevel: candidate.warnings?.length > 0 ? "high" : "low",
          }}
          index={index}
          isSearchMode={isSearchMode}
        />
      ))}
    </div>
  );
}
```

#### 7-2. CreditCounter 수정
**파일:** `components/layout/CreditCounter.tsx`
```tsx
"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { useCredits } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";

function SimpleRollingNumber({ value }: { value: number }) {
  const spring = useSpring(value, { mass: 0.8, stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => Math.round(current));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}

export default function CreditCounter({ className }: { className?: string }) {
  const { data, isLoading } = useCredits();
  const credits = data?.remaining ?? 0;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
        Credits
      </span>
      <div className="flex items-center gap-2 font-mono text-xl text-primary font-bold">
        {isLoading ? (
          <span className="text-slate-500">...</span>
        ) : (
          <SimpleRollingNumber value={credits} />
        )}
        <span className="text-xs text-slate-500 font-normal">AVAL</span>
      </div>
    </div>
  );
}
```

---

## ✅ 완료 체크리스트

각 Task 완료 후 체크해주세요:
□ Task 1: Root Layout 정리 (Sidebar 제거, QueryProvider 추가)
□ Task 2: providers/QueryProvider.tsx 생성
□ Task 3: app/(dashboard)/page.tsx 생성
□ Task 4-1: Login 페이지 인증 로직
□ Task 4-2: Signup 페이지 인증 로직
□ Task 4-3: Consent 페이지 저장 로직
□ Task 5-1: /api/candidates/route.ts
□ Task 5-2: /api/candidates/[id]/route.ts
□ Task 5-3: /api/user/credits/route.ts
□ Task 5-4: /api/search/route.ts
□ Task 6-1: hooks/useCandidates.ts
□ Task 6-2: hooks/useSearch.ts
□ Task 6-3: hooks/useCredits.ts
□ Task 7-1: GravityGrid 데이터 연동
□ Task 7-2: CreditCounter 데이터 연동
□ 빌드 테스트: pnpm build

## 주의사항
1. 기존 UI 스타일과 애니메이션은 유지하세요
2. types/ 폴더의 타입 정의를 활용하세요
3. lib/supabase/ 클라이언트를 사용하세요
4. LevitatingCard의 TalentProps 인터페이스와 호환되게 데이터를 매핑하세요

Task 1부터 순서대로 진행해주세요.