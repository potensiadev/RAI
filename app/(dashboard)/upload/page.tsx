"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle, AlertTriangle, ArrowRight, X, FileText, Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import GravityDropZone from "@/components/upload/GravityDropZone";
import ProcessingVisualization, { ProcessingPhase } from "@/components/upload/ProcessingVisualization";
import { cn } from "@/lib/utils";

const ALLOWED_EXTENSIONS = [".hwp", ".hwpx", ".doc", ".docx", ".pdf"];
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 30;

type FileStatus = "pending" | "uploading" | "processing" | "success" | "error";

interface UploadFile {
  id: string;
  file: File;
  status: FileStatus;
  phase: ProcessingPhase;
  error?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [activeProcessingFile, setActiveProcessingFile] = useState<UploadFile | null>(null);

  // 파일 유효성 검사
  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `지원하지 않는 파일 형식입니다. HWP, HWPX, DOC, DOCX, PDF 파일만 업로드할 수 있습니다.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return "파일 크기가 50MB를 초과합니다. 더 작은 파일을 선택해주세요.";
    }
    return null;
  };

  // 파일 추가
  const handleFilesDropped = useCallback((droppedFiles: FileList) => {
    const fileArray = Array.from(droppedFiles);

    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.file.name));
      const remaining = MAX_FILES - prev.length;

      const filesToAdd = fileArray
        .filter((file) => !existingNames.has(file.name))
        .slice(0, remaining)
        .map((file) => {
          const error = validateFile(file);
          return {
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            file,
            status: error ? "error" : "pending",
            phase: "idle" as ProcessingPhase,
            error,
          } as UploadFile;
        });

      return [...prev, ...filesToAdd];
    });
  }, []);

  // 파일 제거
  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // 실패한 파일 재시도
  const retryFile = async (id: string) => {
    const fileToRetry = files.find((f) => f.id === id);
    if (!fileToRetry || fileToRetry.status !== "error") return;

    // 상태를 pending으로 변경
    setFiles((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, status: "pending" as FileStatus, error: undefined, phase: "idle" as ProcessingPhase } : f
      )
    );

    setIsUploading(true);
    await uploadFile({ ...fileToRetry, status: "pending", error: undefined, phase: "idle" as ProcessingPhase });
    setIsUploading(false);
    setActiveProcessingFile(null);
  };

  // 실패한 모든 파일 재시도
  const retryAllFailed = async () => {
    const failedFiles = files.filter((f) => f.status === "error");
    if (failedFiles.length === 0) return;

    // 모든 실패 파일을 pending으로 변경
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "error" ? { ...f, status: "pending" as FileStatus, error: undefined, phase: "idle" as ProcessingPhase } : f
      )
    );

    setIsUploading(true);
    for (const file of failedFiles) {
      await uploadFile({ ...file, status: "pending", error: undefined, phase: "idle" as ProcessingPhase });
      await new Promise((r) => setTimeout(r, 500));
    }
    setIsUploading(false);
    setActiveProcessingFile(null);
  };

  // 단일 파일 업로드 - Direct-to-Storage 패턴 (Vercel 4.5MB 제한 우회)
  const uploadFile = async (uploadFile: UploadFile): Promise<boolean> => {
    // 상태 업데이트: uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.id === uploadFile.id ? { ...f, status: "uploading", phase: "uploading" } : f
      )
    );
    setActiveProcessingFile({ ...uploadFile, phase: "routing" });

    // presign 데이터를 catch에서 접근하기 위해 외부 선언
    let presign: { storagePath?: string; jobId?: string; candidateId?: string; userId?: string; plan?: string } | null = null;

    try {
      // Phase 1: Presign - 서버에서 job/candidate 생성
      setActiveProcessingFile((prev) => prev ? { ...prev, phase: "routing" } : null);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, phase: "routing" } : f
        )
      );

      const presignRes = await fetch("/api/upload/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: uploadFile.file.name,
          fileSize: uploadFile.file.size,
          fileType: uploadFile.file.type,
        }),
      });

      const contentType = presignRes.headers.get("content-type");
      let presignData;
      if (contentType && contentType.includes("application/json")) {
        presignData = await presignRes.json();
      } else {
        const text = await presignRes.text();
        throw new Error(text || "서버 연결에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }

      if (!presignRes.ok || !presignData.success) {
        // 사용자 친화적 에러 메시지 매핑
        const serverError = presignData.error?.message || presignData.error || "";
        const userFriendlyErrors: Record<string, string> = {
          "크레딧이 부족합니다": "이번 달 업로드 가능 횟수를 모두 사용했습니다. 다음 달에 다시 시도하거나 플랜을 업그레이드해주세요.",
          "사용자를 찾을 수 없습니다": "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
        };
        throw new Error(userFriendlyErrors[serverError] || serverError || "업로드 준비 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }

      // API 응답에서 data 추출
      presign = presignData.data;
      if (!presign?.storagePath || !presign?.jobId) {
        throw new Error("서버 응답에 문제가 있습니다. 페이지를 새로고침하고 다시 시도해주세요.");
      }

      // Phase 2: Direct Storage Upload - 클라이언트가 직접 Supabase Storage에 업로드
      setActiveProcessingFile((prev) => prev ? { ...prev, phase: "uploading" } : null);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, phase: "uploading" } : f
        )
      );

      // Supabase 클라이언트로 직접 업로드
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // 업로드 전 세션 확인 (디버깅 및 검증)
      const { data: { user: clientUser } } = await supabase.auth.getUser();

      if (!clientUser) {
        throw new Error("로그인 세션이 만료되었습니다. 페이지를 새로고침하고 다시 로그인해주세요.");
      }

      // storagePath에서 user.id 추출하여 검증
      // 경로 형식: uploads/{user.id}/{filename}
      const pathParts = presign.storagePath.split('/');
      const pathUserId = pathParts[1]; // uploads/{userId}/...

      if (pathUserId !== clientUser.id) {
        console.error("[Upload] User ID mismatch:", {
          clientUserId: clientUser.id,
          pathUserId: pathUserId,
          storagePath: presign.storagePath,
        });
        throw new Error("세션 정보가 일치하지 않습니다. 페이지를 새로고침하고 다시 시도해주세요.");
      }

      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(presign.storagePath, uploadFile.file, {
          contentType: uploadFile.file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        // Storage 에러 메시지를 사용자 친화적으로 변환
        const storageErrorMap: Record<string, string> = {
          "The resource already exists": "동일한 파일이 이미 업로드되어 있습니다.",
          "Payload too large": "파일이 너무 큽니다. 50MB 이하의 파일을 선택해주세요.",
          "Invalid JWT": "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
          "Bucket not found": "저장소 설정 오류입니다. 관리자에게 문의해주세요.",
          "Object not found": "파일을 찾을 수 없습니다.",
          "access denied": "파일 접근 권한이 없습니다. 다시 로그인해주세요.",
          "quota exceeded": "저장 용량이 초과되었습니다.",
          "network": "네트워크 연결을 확인해주세요.",
          "timeout": "업로드 시간이 초과되었습니다. 다시 시도해주세요.",
          // RLS (Row Level Security) 관련 에러
          "row-level security": "접근 권한이 없습니다. 다시 로그인해주세요.",
          "violates row-level security policy": "접근 권한이 없습니다. 다시 로그인해주세요.",
          "permission denied": "파일 업로드 권한이 없습니다. 다시 로그인해주세요.",
          "unauthorized": "인증이 필요합니다. 다시 로그인해주세요.",
          "not authenticated": "로그인이 필요합니다.",
          "jwt expired": "로그인 세션이 만료되었습니다. 다시 로그인해주세요.",
          "invalid token": "인증 정보가 유효하지 않습니다. 다시 로그인해주세요.",
        };

        // 매핑된 메시지 찾기
        const friendlyMessage = Object.entries(storageErrorMap).find(
          ([key]) => uploadError.message.toLowerCase().includes(key.toLowerCase())
        )?.[1];

        // 매핑된 메시지가 있으면 사용, 없으면 원본 에러 메시지 포함하여 안내
        if (friendlyMessage) {
          throw new Error(friendlyMessage);
        } else {
          // 기술적 에러 메시지를 사용자에게 보여주되, 맥락 추가
          const originalMessage = uploadError.message || "알 수 없는 오류";
          throw new Error(`파일 업로드에 실패했어요: ${originalMessage}`);
        }
      }

      // Phase 3: Confirm - Worker 파이프라인 트리거
      setActiveProcessingFile((prev) => prev ? { ...prev, phase: "analyzing" } : null);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, phase: "analyzing" } : f
        )
      );

      const confirmRes = await fetch("/api/upload/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: presign.jobId,
          candidateId: presign.candidateId,
          storagePath: presign.storagePath,
          fileName: uploadFile.file.name,
          userId: presign.userId,
          plan: presign.plan,
        }),
      });

      const confirmData = await confirmRes.json();
      if (!confirmRes.ok || !confirmData.success) {
        // 파일 검증 실패 메시지를 사용자 친화적으로 변환
        const serverError = confirmData.error?.message || confirmData.error || "";
        const confirmErrorMap: Record<string, string> = {
          "파일 시그니처가 유효하지 않습니다": "파일 형식이 올바르지 않습니다. 파일이 손상되었거나 확장자가 변경되었을 수 있습니다. 원본 파일을 다시 확인해주세요.",
          "파일 검증에 실패했습니다": "파일을 검증할 수 없습니다. 파일이 손상되었을 수 있습니다.",
        };
        const friendlyMessage = Object.entries(confirmErrorMap).find(
          ([key]) => serverError.includes(key)
        )?.[1];
        throw new Error(friendlyMessage || serverError || "파일 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
      }

      // 완료
      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id ? { ...f, status: "success", phase: "complete" } : f
        )
      );
      setActiveProcessingFile((prev) => prev ? { ...prev, phase: "complete" } : null);

      return true;
    } catch (error) {
      // 실패 시 orphan 데이터 정리 시도 (best effort)
      if (presign?.jobId) {
        try {
          await fetch("/api/upload/cleanup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobId: presign.jobId,
              candidateId: presign.candidateId,
              storagePath: presign.storagePath,
            }),
          });
        } catch {
          // 정리 실패는 무시 (백그라운드 정리 작업에 위임)
        }
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === uploadFile.id
            ? { ...f, status: "error", error: (error as Error).message }
            : f
        )
      );
      return false;
    }
  };

  // 모든 파일 업로드
  const uploadAll = async () => {
    const pendingFiles = files.filter((f) => f.status === "pending");
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    for (const file of pendingFiles) {
      await uploadFile(file);
      await new Promise((r) => setTimeout(r, 500)); // 파일 간 딜레이
    }

    setIsUploading(false);
    setActiveProcessingFile(null);
  };

  // 통계
  const stats = {
    total: files.length,
    pending: files.filter((f) => f.status === "pending").length,
    uploading: files.filter((f) => f.status === "uploading" || f.status === "processing").length,
    success: files.filter((f) => f.status === "success").length,
    error: files.filter((f) => f.status === "error").length,
  };

  const hasFiles = files.length > 0;
  const allComplete = stats.pending === 0 && stats.uploading === 0 && stats.total > 0;
  const progressPercent = stats.total > 0 ? Math.round(((stats.success + stats.error) / stats.total) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Upload size={24} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">이력서 업로드</h1>
        </div>
        <p className="text-gray-500">
          이력서 파일을 업로드하면 AI가 자동으로 분석하여 후보자 정보를 추출합니다.
        </p>
      </div>

      {/* Success Banner */}
      <AnimatePresence>
        {allComplete && stats.success > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "p-4 rounded-xl border shadow-sm",
              stats.error === 0
                ? "bg-emerald-50 border-emerald-100"
                : "bg-yellow-50 border-yellow-100"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {stats.error === 0 ? (
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-yellow-500" />
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    업로드 완료: {stats.success}개 성공
                    {stats.error > 0 && `, ${stats.error}개 실패`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => router.push("/candidates")}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white
                         hover:bg-gray-50 text-gray-900 border border-gray-200 text-sm font-medium transition-colors shadow-sm"
              >
                후보자 목록으로 이동
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overall Progress Bar */}
      <AnimatePresence>
        {isUploading && stats.total > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">
                업로드 진행 중...
              </span>
              <span className="text-sm text-gray-500">
                {stats.success + stats.error} / {stats.total} ({progressPercent}%)
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
                className="h-full bg-primary rounded-full"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing Visualization */}
      <AnimatePresence>
        {activeProcessingFile && activeProcessingFile.phase !== "idle" && (
          <ProcessingVisualization
            phase={activeProcessingFile.phase}
            fileName={activeProcessingFile.file.name}
          />
        )}
      </AnimatePresence>

      {/* Gravity Drop Zone */}
      {!isUploading && (
        <GravityDropZone
          onFilesDropped={handleFilesDropped}
          accept={ALLOWED_EXTENSIONS.join(",")}
          maxFiles={MAX_FILES}
          disabled={isUploading}
        />
      )}

      {/* File List */}
      <AnimatePresence>
        {hasFiles && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                파일 목록 ({stats.total}/{MAX_FILES})
              </h3>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">
                  대기: <span className="text-gray-900">{stats.pending}</span>
                </span>
                <span className="text-gray-500">
                  완료: <span className="text-emerald-600">{stats.success}</span>
                </span>
                {stats.error > 0 && (
                  <span className="text-gray-500">
                    실패: <span className="text-red-500">{stats.error}</span>
                  </span>
                )}
              </div>
            </div>

            {/* File Items */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {files.map((file) => (
                <motion.div
                  key={file.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border transition-colors shadow-sm",
                    file.status === "success" && "bg-white border-emerald-100",
                    file.status === "error" && "bg-white border-red-100",
                    file.status === "uploading" && "bg-white border-blue-100",
                    file.status === "pending" && "bg-white border-gray-100"
                  )}
                >
                  {/* Icon */}
                  <div className={cn(
                    "p-2 rounded-lg",
                    file.status === "success" && "bg-emerald-50 text-emerald-600",
                    file.status === "error" && "bg-red-50 text-red-600",
                    file.status === "uploading" && "bg-blue-50 text-blue-600",
                    file.status === "pending" && "bg-gray-50 text-gray-500"
                  )}>
                    {file.status === "success" ? (
                      <CheckCircle size={18} />
                    ) : file.status === "uploading" ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <FileText size={18} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {file.error || `${(file.file.size / 1024 / 1024).toFixed(2)} MB`}
                    </p>
                  </div>

                  {/* Retry button for failed files */}
                  {file.status === "error" && !isUploading && (
                    <button
                      onClick={() => retryFile(file.id)}
                      className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 hover:text-blue-700 transition-colors"
                      title="재시도"
                    >
                      <RotateCcw size={16} />
                    </button>
                  )}

                  {/* Remove */}
                  {file.status !== "uploading" && (
                    <button
                      onClick={() => removeFile(file.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {/* Retry All Failed Button */}
              {stats.error > 0 && stats.pending === 0 && !isUploading && (
                <button
                  onClick={retryAllFailed}
                  className="flex-1 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2
                           bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 shadow-sm"
                >
                  <RotateCcw className="w-5 h-5" />
                  실패 {stats.error}개 재시도
                </button>
              )}

              {/* Upload Button */}
              {stats.pending > 0 && (
                <button
                  onClick={uploadAll}
                  disabled={isUploading}
                  className={cn(
                    "flex-1 py-4 rounded-xl font-semibold text-lg transition-all flex items-center justify-center gap-2 shadow-sm",
                    isUploading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-primary hover:bg-primary/90 text-white"
                  )}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      {stats.pending}개 파일 업로드
                    </>
                  )}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InfoCard
          title="지원 형식"
          description="HWP, HWPX, DOC, DOCX, PDF"
          icon="📄"
        />
        <InfoCard
          title="AI 분석"
          description="2-Way Cross-Check (GPT-4o + Gemini)"
          icon="🤖"
        />
        <InfoCard
          title="개인정보 보호"
          description="AES-256 암호화 + PII 마스킹"
          icon="🔒"
        />
      </div>
    </div>
  );
}

function InfoCard({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
      <div className="text-2xl mb-2">{icon}</div>
      <h4 className="font-medium text-gray-900">{title}</h4>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}
