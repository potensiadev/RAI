"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Plus,
  X,
  Briefcase,
  Building2,
  Users,
  GraduationCap,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import type { PositionPriority, PositionStatus, JobType } from "@/types/position";

interface FormData {
  title: string;
  clientCompany: string;
  department: string;
  description: string;
  requiredSkills: string[];
  preferredSkills: string[];
  minExpYears: number;
  maxExpYears: number | null;
  requiredEducationLevel: string;
  preferredMajors: string[];
  locationCity: string;
  jobType: JobType;
  salaryMin: number | null;
  salaryMax: number | null;
  priority: PositionPriority;
  status: PositionStatus;
  deadline: string;
}

const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: "full-time", label: "정규직" },
  { value: "contract", label: "계약직" },
  { value: "freelance", label: "프리랜서" },
  { value: "internship", label: "인턴" },
];

const PRIORITIES: { value: PositionPriority; label: string }[] = [
  { value: "urgent", label: "긴급" },
  { value: "high", label: "높음" },
  { value: "normal", label: "보통" },
  { value: "low", label: "낮음" },
];

const STATUSES: { value: PositionStatus; label: string }[] = [
  { value: "open", label: "진행중" },
  { value: "paused", label: "일시중지" },
  { value: "closed", label: "마감" },
  { value: "filled", label: "채용완료" },
];

const EDUCATION_LEVELS = [
  { value: "", label: "무관" },
  { value: "high_school", label: "고졸" },
  { value: "associate", label: "전문학사" },
  { value: "bachelor", label: "학사" },
  { value: "master", label: "석사" },
  { value: "doctorate", label: "박사" },
];

export default function EditPositionPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const positionId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [preferredSkillInput, setPreferredSkillInput] = useState("");
  const [majorInput, setMajorInput] = useState("");

  const [formData, setFormData] = useState<FormData>({
    title: "",
    clientCompany: "",
    department: "",
    description: "",
    requiredSkills: [],
    preferredSkills: [],
    minExpYears: 0,
    maxExpYears: null,
    requiredEducationLevel: "",
    preferredMajors: [],
    locationCity: "",
    jobType: "full-time",
    salaryMin: null,
    salaryMax: null,
    priority: "normal",
    status: "open",
    deadline: "",
  });

  // 기존 포지션 데이터 로드
  useEffect(() => {
    const fetchPosition = async () => {
      try {
        const response = await fetch(`/api/positions/${positionId}`);
        if (!response.ok) {
          if (response.status === 404) {
            toast.error("오류", "포지션을 찾을 수 없습니다.");
            router.push("/positions");
            return;
          }
          throw new Error("Failed to fetch position");
        }
        const data = await response.json();
        const position = data.data;

        setFormData({
          title: position.title || "",
          clientCompany: position.clientCompany || "",
          department: position.department || "",
          description: position.description || "",
          requiredSkills: position.requiredSkills || [],
          preferredSkills: position.preferredSkills || [],
          minExpYears: position.minExpYears || 0,
          maxExpYears: position.maxExpYears,
          requiredEducationLevel: position.requiredEducationLevel || "",
          preferredMajors: position.preferredMajors || [],
          locationCity: position.locationCity || "",
          jobType: position.jobType || "full-time",
          salaryMin: position.salaryMin,
          salaryMax: position.salaryMax,
          priority: position.priority || "normal",
          status: position.status || "open",
          deadline: position.deadline ? position.deadline.split("T")[0] : "",
        });
      } catch (error) {
        console.error("Fetch position error:", error);
        toast.error("오류", "포지션 정보를 불러오는데 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosition();
  }, [positionId, router, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("오류", "포지션명을 입력해주세요.");
      return;
    }
    if (formData.requiredSkills.length === 0) {
      toast.error("오류", "최소 하나의 필수 스킬을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/positions/${positionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "포지션 수정에 실패했습니다.");
      }

      toast.success("성공", "포지션이 수정되었습니다.");
      router.push(`/positions/${positionId}`);
    } catch (error) {
      console.error("Update position error:", error);
      toast.error("오류", error instanceof Error ? error.message : "포지션 수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addSkill = (type: "required" | "preferred") => {
    const input = type === "required" ? skillInput : preferredSkillInput;
    const setInput = type === "required" ? setSkillInput : setPreferredSkillInput;
    const field = type === "required" ? "requiredSkills" : "preferredSkills";

    if (!input.trim()) return;

    const skills = input.split(",").map((s) => s.trim()).filter(Boolean);
    const currentSkills = formData[field];
    const newSkills = skills.filter((s) => !currentSkills.includes(s));

    if (newSkills.length > 0) {
      setFormData({ ...formData, [field]: [...currentSkills, ...newSkills] });
    }
    setInput("");
  };

  const removeSkill = (type: "required" | "preferred", skill: string) => {
    const field = type === "required" ? "requiredSkills" : "preferredSkills";
    setFormData({
      ...formData,
      [field]: formData[field].filter((s) => s !== skill),
    });
  };

  const addMajor = () => {
    if (!majorInput.trim()) return;
    if (!formData.preferredMajors.includes(majorInput.trim())) {
      setFormData({
        ...formData,
        preferredMajors: [...formData.preferredMajors, majorInput.trim()],
      });
    }
    setMajorInput("");
  };

  const removeMajor = (major: string) => {
    setFormData({
      ...formData,
      preferredMajors: formData.preferredMajors.filter((m) => m !== major),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/positions/${positionId}`}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">포지션 수정</h1>
          <p className="text-slate-400 text-sm mt-1">{formData.title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 기본 정보 */}
        <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
          <div className="flex items-center gap-2 text-white font-medium">
            <Briefcase className="w-5 h-5 text-primary" />
            기본 정보
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-slate-400 mb-2">
                포지션명 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                <Building2 className="w-4 h-4 inline mr-1" />
                고객사
              </label>
              <input
                type="text"
                value={formData.clientCompany}
                onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">부서</label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">상태</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as PositionStatus })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                         focus:outline-none focus:border-primary/50 cursor-pointer"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">우선순위</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as PositionPriority })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                         focus:outline-none focus:border-primary/50 cursor-pointer"
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              상세 설명 (JD)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={6}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                       text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </section>

        {/* 스킬 요건 */}
        <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
          <div className="flex items-center gap-2 text-white font-medium">
            <Users className="w-5 h-5 text-primary" />
            스킬 요건
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              필수 스킬 <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill("required");
                  }
                }}
                placeholder="스킬 입력 후 Enter"
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => addSkill("required")}
                className="px-4 py-3 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {formData.requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-sm"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill("required", skill)}
                      className="hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">우대 스킬</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={preferredSkillInput}
                onChange={(e) => setPreferredSkillInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill("preferred");
                  }
                }}
                placeholder="스킬 입력 후 Enter"
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
              <button
                type="button"
                onClick={() => addSkill("preferred")}
                className="px-4 py-3 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {formData.preferredSkills.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.preferredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-300 text-sm"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill("preferred", skill)}
                      className="hover:text-white transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 경력 & 학력 */}
        <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
          <div className="flex items-center gap-2 text-white font-medium">
            <GraduationCap className="w-5 h-5 text-primary" />
            경력 & 학력
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">최소 경력 (년)</label>
              <input
                type="number"
                min="0"
                value={formData.minExpYears}
                onChange={(e) => setFormData({ ...formData, minExpYears: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">최대 경력 (년)</label>
              <input
                type="number"
                min="0"
                value={formData.maxExpYears ?? ""}
                onChange={(e) => setFormData({
                  ...formData,
                  maxExpYears: e.target.value ? parseInt(e.target.value) : null,
                })}
                placeholder="무관"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">학력 요건</label>
              <select
                value={formData.requiredEducationLevel}
                onChange={(e) => setFormData({ ...formData, requiredEducationLevel: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                         focus:outline-none focus:border-primary/50 cursor-pointer"
              >
                {EDUCATION_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">우대 전공</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={majorInput}
                  onChange={(e) => setMajorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addMajor();
                    }
                  }}
                  placeholder="전공 입력"
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10
                           text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                />
                <button
                  type="button"
                  onClick={addMajor}
                  className="px-3 rounded-xl bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {formData.preferredMajors.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.preferredMajors.map((major) => (
                    <span
                      key={major}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-700/50 text-slate-300 text-xs"
                    >
                      {major}
                      <button type="button" onClick={() => removeMajor(major)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 근무 조건 */}
        <section className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
          <div className="flex items-center gap-2 text-white font-medium">
            <MapPin className="w-5 h-5 text-primary" />
            근무 조건
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">근무 형태</label>
              <select
                value={formData.jobType}
                onChange={(e) => setFormData({ ...formData, jobType: e.target.value as JobType })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white
                         focus:outline-none focus:border-primary/50 cursor-pointer"
              >
                {JOB_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">근무지</label>
              <input
                type="text"
                value={formData.locationCity}
                onChange={(e) => setFormData({ ...formData, locationCity: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                연봉 하한 (만원)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={formData.salaryMin ?? ""}
                onChange={(e) => setFormData({
                  ...formData,
                  salaryMin: e.target.value ? parseInt(e.target.value) : null,
                })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">연봉 상한 (만원)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={formData.salaryMax ?? ""}
                onChange={(e) => setFormData({
                  ...formData,
                  salaryMax: e.target.value ? parseInt(e.target.value) : null,
                })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                채용 마감일
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                         text-white focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </section>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-4">
          <Link
            href={`/positions/${positionId}`}
            className="px-6 py-3 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors",
              isSubmitting
                ? "bg-primary/50 text-white/50 cursor-not-allowed"
                : "bg-primary hover:bg-primary/90 text-white"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                저장
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
