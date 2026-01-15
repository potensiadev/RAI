"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Shield, Loader2 } from "lucide-react";

export default function ConsentPage() {
  const router = useRouter();

  const [consents, setConsents] = useState({
    terms: false,
    privacy: false,
    thirdParty: false,
    marketing: false,
  });

  const [viewingDoc, setViewingDoc] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allRequiredChecked =
    consents.terms && consents.privacy && consents.thirdParty;

  const handleCheckAll = () => {
    const newValue = !allRequiredChecked;
    setConsents({
      terms: newValue,
      privacy: newValue,
      thirdParty: newValue,
      marketing: newValue,
    });
  };

  const handleSubmit = async () => {
    if (!allRequiredChecked) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const now = new Date().toISOString();
      const version = "2025.01.01";

      // 먼저 users 테이블에 레코드가 있는지 확인하고, 없으면 생성
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingUser } = await (supabase as any)
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingUser) {
        // users 테이블에 레코드 생성 (기본 필드만 사용)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: createUserError } = await (supabase as any)
          .from("users")
          .insert({
            id: user.id,
            email: user.email,
          });

        if (createUserError) {
          console.error("users insert error:", createUserError);
          throw new Error(`사용자 생성 실패: ${createUserError.message || createUserError.code || JSON.stringify(createUserError)}`);
        }
      }

      // 동의 기록 저장
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: consentError } = await (supabase as any)
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

      if (consentError) {
        console.error("user_consents insert error:", consentError);
        throw new Error(`동의 저장 실패: ${consentError.message || consentError.code || JSON.stringify(consentError)}`);
      }

      // 사용자 프로필 업데이트
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: userError } = await (supabase as any)
        .from("users")
        .update({
          consents_completed: true,
          consents_completed_at: now,
        })
        .eq("id", user.id);

      if (userError) {
        console.error("users update error:", userError);
        throw new Error(`프로필 업데이트 실패: ${userError.message || userError.code || JSON.stringify(userError)}`);
      }

      router.push("/candidates");
      router.refresh();
    } catch (err: unknown) {
      console.error("Consent error:", err);
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);

      // 이미 동의한 경우 (중복)
      if (errorMessage.includes("duplicate") || errorMessage.includes("unique") || errorMessage.includes("already exists") || errorMessage.includes("23505")) {
        router.push("/candidates");
        router.refresh();
        return;
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 mx-auto bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-6">
          <Shield className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">서비스 이용 동의</h1>
        <p className="text-gray-500 text-sm">
          서치드 서비스 이용을 위해 아래 약관에 동의해주세요.
        </p>
      </div>

      <div className="p-8 rounded-3xl bg-white shadow-2xl shadow-black/5 border border-gray-100 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* 전체 동의 */}
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <Checkbox
              checked={allRequiredChecked && consents.marketing}
              onCheckedChange={handleCheckAll}
              className="border-gray-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
            <span className="font-semibold text-gray-900">모두 동의합니다</span>
          </label>
        </div>

        <div className="space-y-3">
          {/* 이용약관 */}
          <ConsentItem
            label="서비스 이용약관"
            required
            checked={consents.terms}
            onCheckedChange={(v) => setConsents({ ...consents, terms: v })}
            onViewClick={() => setViewingDoc("terms")}
          />

          {/* 개인정보처리방침 */}
          <ConsentItem
            label="개인정보 처리방침"
            required
            checked={consents.privacy}
            onCheckedChange={(v) => setConsents({ ...consents, privacy: v })}
            onViewClick={() => setViewingDoc("privacy")}
          />

          <ConsentItem
            label="제3자 개인정보 처리 보증"
            required
            checked={consents.thirdParty}
            onCheckedChange={(v) => setConsents({ ...consents, thirdParty: v })}
            onViewClick={() => setViewingDoc("thirdParty")}
          />

          {/* 제3자 정보 보증 (핵심) */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div className="text-amber-900">
                <p className="font-semibold">중요 안내</p>
                <p className="mt-1 text-amber-700 leading-relaxed">
                  업로드하는 이력서의 정보주체(후보자)로부터 개인정보 수집·이용 동의를 받았음을 보증합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Button
          className="w-full h-12 text-base font-semibold rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
          size="lg"
          disabled={!allRequiredChecked || isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {isSubmitting ? "처리 중..." : "동의하고 시작하기"}
        </Button>
      </div>

      {/* 약관 전문 보기 모달 */}
      <ConsentDocumentModal
        type={viewingDoc}
        onClose={() => setViewingDoc(null)}
      />
    </div>
  );
}

function ConsentItem({
  icon,
  label,
  required,
  checked,
  onCheckedChange,
  onViewClick,
}: {
  icon?: React.ReactNode;
  label: string;
  required: boolean;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onViewClick?: () => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
      <label className="flex items-center gap-3 cursor-pointer flex-1">
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          className="border-gray-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
        />
        <span className="flex items-center gap-2 text-gray-600">
          {icon}
          <span>
            {required && <span className="text-rose-500 font-medium">[필수] </span>}
            {!required && <span className="text-gray-400 font-medium">[선택] </span>}
            <span className={required ? "text-gray-900" : "text-gray-600"}>{label}</span>
          </span>
        </span>
      </label>
      {onViewClick && (
        <Button variant="ghost" size="sm" onClick={onViewClick} className="text-gray-400 hover:text-gray-900 hover:bg-gray-100">
          보기
        </Button>
      )}
    </div>
  );
}

function ConsentDocumentModal({
  type,
  onClose,
}: {
  type: string | null;
  onClose: () => void;
}) {
  const titles: Record<string, string> = {
    terms: "서비스 이용약관",
    privacy: "개인정보 처리방침",
    thirdParty: "제3자 개인정보 처리 보증 약관",
  };

  return (
    <Dialog open={!!type} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] bg-white border-gray-100 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-gray-900">{type && titles[type]}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          {type === "thirdParty" && <ThirdPartyGuaranteeContent />}
          {type === "terms" && <TermsOfServiceContent />}
          {type === "privacy" && <PrivacyPolicyContent />}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function ThirdPartyGuaranteeContent() {
  return (
    <div className="prose prose-sm max-w-none text-gray-600">
      <h3 className="text-gray-900">제3자 개인정보 처리 보증 약관</h3>
      <p><strong>시행일:</strong> 2025년 1월 1일</p>
      <h4 className="text-gray-800">제1조 (목적)</h4>
      <p>본 약관은 서치드 서비스를 이용하여 제3자의 개인정보가 포함된 이력서를 처리하는 과정에서 사용자의 책임과 의무를 명확히 합니다.</p>
      <h4 className="text-gray-800">제2조 (사용자의 보증)</h4>
      <p>사용자는 업로드하는 이력서에 대해 정보주체로부터 개인정보 수집·이용 동의를 받았음을 보증합니다.</p>
      <h4 className="text-gray-800">제3조 (사용자의 책임)</h4>
      <p>본 약관 위반으로 발생하는 모든 법적 책임은 사용자에게 있습니다.</p>
    </div>
  );
}

function TermsOfServiceContent() {
  return (
    <div className="prose prose-sm max-w-none text-gray-600">
      <h3 className="text-gray-900">서비스 이용약관</h3>
      <p><strong>시행일:</strong> 2025년 1월 1일</p>
      <p>서치드 서비스 이용약관입니다.</p>
    </div>
  );
}

function PrivacyPolicyContent() {
  return (
    <div className="prose prose-sm max-w-none text-gray-600">
      <h3 className="text-gray-900">개인정보 처리방침</h3>
      <p><strong>시행일:</strong> 2025년 1월 1일</p>
      <p>서치드 개인정보 처리방침입니다.</p>
    </div>
  );
}
