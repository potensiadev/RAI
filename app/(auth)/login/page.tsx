"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/candidates";

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${next}`,
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-6">Srchd</h1>
        <p className="text-gray-500 text-base">
          헤드헌터 전용 후보자 관리 플랫폼
        </p>
      </div>

      {/* Login Card */}
      <div className="p-8 rounded-3xl bg-white shadow-2xl shadow-black/5 border border-gray-100 space-y-6">
        {error && (
          <div
            className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm"
            data-testid="login-error"
          >
            {error}
          </div>
        )}

        <div className="text-center space-y-2">
          <p className="text-gray-600 text-sm">
            Google 계정으로 안전하게 로그인하세요
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full h-12 text-base font-medium"
          size="lg"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          data-testid="google-login-button"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
          ) : (
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          Google로 계속하기
        </Button>

        <p className="text-xs text-gray-400 text-center">
          로그인 시{" "}
          <Link href="/terms" className="underline hover:text-gray-600">
            서비스 이용약관
          </Link>
          {" "}및{" "}
          <Link href="/privacy" className="underline hover:text-gray-600">
            개인정보처리방침
          </Link>
          에 동의하게 됩니다.
        </p>
      </div>

      {/* Footer */}
      <p className="text-center text-sm text-gray-500">
        아직 계정이 없으신가요?{" "}
        <Link href="/signup" className="text-primary font-semibold hover:underline">
          회원가입
        </Link>
      </p>
    </div>
  );
}

function LoginLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
