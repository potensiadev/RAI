"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  CreditCard,
  Bell,
  LogOut,
  Loader2,
  Check,
  Mail,
  Building2,
  Sparkles,
  ArrowRight,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { useCredits, useInvalidateCredits } from "@/hooks";
import { openCheckout } from "@/lib/paddle/client";
import { PLAN_CONFIG, type PlanId } from "@/lib/paddle/config";
import { useToast } from "@/components/ui/toast";
import { RefundRequestModal, RefundHistory } from "@/components/refund";

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  plan: string;
  created_at: string;
}

function SettingsContent() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "subscription" | "notifications">("profile");
  const [showRefundModal, setShowRefundModal] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");

  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  // Credits from API (synchronized with CreditCounter)
  const { data: creditsData, isLoading: creditsLoading } = useCredits();
  const invalidateCredits = useInvalidateCredits();

  // Handle checkout success
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("결제 완료", "구독이 성공적으로 활성화되었습니다!");
      invalidateCredits(); // Refresh credits data
      // Clean up URL
      router.replace("/settings");
    }
  }, [searchParams, toast, invalidateCredits, router]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // users.id directly references auth.users.id, so we can query by user.id
      // Also select email column explicitly in case RLS is hiding it
      const { data, error } = await supabase
        .from("users")
        .select("id, email, name, company, plan, created_at")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Failed to fetch user profile:", error);
        // If user doesn't exist in public.users, show a helpful message
        setProfile(null);
        return;
      }
      if (!data) {
        console.error("No user data found");
        setProfile(null);
        return;
      }

      const userData = data as { id: string; email: string; name: string | null; company: string | null; plan: string; created_at: string };
      setProfile({
        id: userData.id,
        email: userData.email || user.email || "",
        name: userData.name,
        company: userData.company,
        plan: userData.plan,
        created_at: userData.created_at,
      });
      setName(userData.name || "");
      setCompany(userData.company || "");
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;

    setIsSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("users")
        .update({
          name: name || null,
          company: company || null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      setProfile({ ...profile, name, company });
    } catch (error) {
      console.error("Failed to save profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Paddle 결제 시작
  const handleUpgrade = useCallback(async (planId: PlanId) => {
    if (!profile || isUpgrading) return;

    const targetPlan = PLAN_CONFIG[planId];
    if (!targetPlan.priceId) {
      toast.error("오류", "무료 플랜으로의 다운그레이드는 지원되지 않습니다.");
      return;
    }

    setIsUpgrading(true);

    try {
      // API에서 checkout 정보 가져오기
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "결제 요청 실패");
      }

      const { data } = await response.json();

      // Paddle Checkout 열기
      await openCheckout({
        priceId: data.priceId,
        customerId: data.customerId,
        email: data.email,
      });
    } catch (error) {
      console.error("Upgrade error:", error);
      toast.error("결제 오류", error instanceof Error ? error.message : "결제를 시작할 수 없습니다.");
    } finally {
      setIsUpgrading(false);
    }
  }, [profile, isUpgrading, toast]);

  const tabs = [
    { id: "profile", label: "프로필", icon: User },
    { id: "subscription", label: "구독", icon: CreditCard },
    { id: "notifications", label: "알림", icon: Bell },
  ] as const;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-slate-400">
        프로필을 불러올 수 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">
          계정 설정 및 구독 관리
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors",
                activeTab === tab.id
                  ? "bg-primary/20 text-primary"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
            </button>
          ))}

          <hr className="my-4 border-white/10" />

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            로그아웃
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 rounded-xl bg-white/5 border border-white/10 p-6">
          {/* Profile Tab */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">프로필 설정</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    이메일
                  </label>
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
                    <Mail className="w-5 h-5 text-slate-500" />
                    <span className="text-white">{profile.email}</span>
                    <span className="ml-auto text-xs text-slate-500">변경 불가</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    이름
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="이름을 입력하세요"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                             text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    회사
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="회사명을 입력하세요"
                      className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                               text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90
                           text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  저장
                </button>
              </div>
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === "subscription" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">구독 관리</h2>

              {/* Current Plan */}
              <div className="p-6 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/30">
                {creditsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">현재 플랜</p>
                        <p className="text-2xl font-bold text-white capitalize mt-1">
                          {creditsData?.plan || profile.plan}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">이번 달 사용량</p>
                        <p className="text-2xl font-bold text-white mt-1">
                          {creditsData?.creditsUsedThisMonth ?? 0} / {creditsData?.planBaseCredits ?? 50}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              ((creditsData?.creditsUsedThisMonth ?? 0) / (creditsData?.planBaseCredits ?? 50)) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-slate-400">
                        <span>남은 크레딧: {creditsData?.remainingCredits?.toLocaleString() ?? 0}</span>
                        <span>추가 크레딧: {creditsData?.credits?.toLocaleString() ?? 0}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Plan Options */}
              <div className="space-y-4">
                <h3 className="font-medium text-white">플랜 변경</h3>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(PLAN_CONFIG).map(([id, planConfig]) => {
                    const currentPlan = (creditsData?.plan || profile.plan) as PlanId;
                    const isCurrentPlan = currentPlan === id;
                    const planOrder: PlanId[] = ['starter', 'pro'];
                    const canUpgrade = planOrder.indexOf(id as PlanId) > planOrder.indexOf(currentPlan);

                    return (
                      <div
                        key={id}
                        className={cn(
                          "p-4 rounded-xl border transition-all relative",
                          isCurrentPlan
                            ? "bg-primary/20 border-primary"
                            : canUpgrade
                              ? "bg-white/5 border-white/10 hover:border-primary/50 hover:bg-primary/5"
                              : "bg-white/5 border-white/10 opacity-60"
                        )}
                      >
                        {id === 'pro' && !isCurrentPlan && (
                          <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-gradient-to-r from-primary to-purple-500 rounded-full text-xs font-semibold text-white flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            인기
                          </div>
                        )}

                        <h4 className="font-semibold text-white">{planConfig.name}</h4>
                        <p className="text-xl font-bold text-primary mt-2">{planConfig.priceDisplay}</p>
                        <p className="text-sm text-slate-400 mt-1">월 {planConfig.credits}건</p>

                        {/* Features */}
                        <ul className="mt-3 space-y-1">
                          {planConfig.features.slice(0, 3).map((feature, idx) => (
                            <li key={idx} className="text-xs text-slate-400 flex items-start gap-1">
                              <Check className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        {isCurrentPlan ? (
                          <span className="inline-flex items-center gap-1 mt-4 text-xs text-primary font-medium">
                            <Check className="w-3 h-3" />
                            현재 플랜
                          </span>
                        ) : canUpgrade && planConfig.priceId ? (
                          <button
                            onClick={() => handleUpgrade(id as PlanId)}
                            disabled={isUpgrading}
                            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg
                                     bg-primary hover:bg-primary/90 text-white text-sm font-medium
                                     transition-colors disabled:opacity-50"
                          >
                            {isUpgrading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                업그레이드
                                <ArrowRight className="w-3 h-3" />
                              </>
                            )}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cancel Subscription */}
              {(creditsData?.plan || profile.plan) !== "starter" && (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h3 className="font-medium text-white">구독 취소</h3>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                    <div>
                      <p className="text-white">구독을 취소하시겠습니까?</p>
                      <p className="text-sm text-slate-400 mt-1">
                        취소 시 남은 기간에 대한 비례 환불이 가능합니다.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowRefundModal(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg
                               bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      구독 취소
                    </button>
                  </div>
                </div>
              )}

              {/* Refund History */}
              <div className="pt-4 border-t border-white/10">
                <RefundHistory />
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-white">알림 설정</h2>

              <div className="space-y-4">
                {[
                  { id: "processing", label: "처리 완료 알림", desc: "이력서 분석이 완료되면 알림을 받습니다" },
                  { id: "weekly", label: "주간 리포트", desc: "매주 월요일 분석 통계를 이메일로 받습니다" },
                  { id: "warning", label: "위험 알림", desc: "낮은 신뢰도 후보자가 발생하면 알림을 받습니다" },
                ].map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div>
                      <p className="font-medium text-white">{item.label}</p>
                      <p className="text-sm text-slate-400">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Refund Modal */}
      <RefundRequestModal
        isOpen={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        onSuccess={() => {
          invalidateCredits();
          fetchProfile();
        }}
        plan={creditsData?.plan || profile.plan}
      />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
