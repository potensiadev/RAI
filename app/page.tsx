"use client";

import { motion, Variants } from "framer-motion";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Shield,
  Zap,
  Search,
  ArrowRight,
  Upload,
  FileText,
  Users,
  CheckCircle,
  Menu,
  X,
  Clock,
  TrendingUp,
  Target,
  Play,
  ChevronRight,
  Quote,
  Star,
} from "lucide-react";

// Animation variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      delay,
      ease: [0.25, 0.8, 0.25, 1],
    },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

// Navigation links
const navLinks = [
  { href: "/products", label: "기능" },
  { href: "/pricing", label: "요금" },
  { href: "/support", label: "지원" },
];

// Testimonials data
const testimonials = [
  {
    quote: "월 50시간을 절약하고 있습니다. 이력서 검토 시간이 80% 줄었어요.",
    author: "김소연",
    role: "시니어 파트너",
    company: "Executive Search Korea",
    avatar: "K",
  },
  {
    quote: "클라이언트에게 후보자를 3배 더 빨리 제안할 수 있게 됐습니다.",
    author: "박준혁",
    role: "헤드헌터",
    company: "Tech Talent Partners",
    avatar: "P",
  },
  {
    quote: "시맨틱 검색 덕분에 숨어있던 적합 후보를 찾아낼 수 있었어요.",
    author: "이민지",
    role: "리크루팅 매니저",
    company: "Global HR Solutions",
    avatar: "L",
  },
];

// Company logos for social proof
const companyLogos = [
  "Executive Search Korea",
  "Tech Talent",
  "HR Partners",
  "Recruit Pro",
  "Talent Bridge",
];

// How it works steps
const workflowSteps = [
  {
    step: 1,
    title: "이력서 업로드",
    description: "PDF, HWP, DOCX 파일을 드래그 & 드롭",
    time: "5초",
    icon: Upload,
  },
  {
    step: 2,
    title: "AI 자동 분석",
    description: "경력, 스킬, 학력을 구조화된 데이터로 변환",
    time: "30초",
    icon: Zap,
  },
  {
    step: 3,
    title: "스마트 검색",
    description: "의미 기반 검색으로 최적 후보자 매칭",
    time: "즉시",
    icon: Search,
  },
  {
    step: 4,
    title: "블라인드 내보내기",
    description: "개인정보 제거된 이력서 1클릭 생성",
    time: "3초",
    icon: FileText,
  },
];

// Pricing tiers preview
const pricingTiers = [
  {
    name: "Free",
    price: "0",
    period: "월",
    description: "시작하기 좋은 플랜",
    features: ["월 100건 분석", "기본 검색", "이메일 지원"],
    cta: "무료로 시작",
    popular: false,
  },
  {
    name: "Pro",
    price: "99,000",
    period: "월",
    description: "성장하는 팀을 위한",
    features: ["월 500건 분석", "시맨틱 검색", "팀 협업 (3명)", "우선 지원"],
    cta: "Pro 시작하기",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "문의",
    period: "",
    description: "대규모 조직을 위한",
    features: ["무제한 분석", "API 액세스", "전담 매니저", "커스텀 연동"],
    cta: "문의하기",
    popular: false,
  },
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [demoProgress, setDemoProgress] = useState(0);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-advance demo steps
  useEffect(() => {
    if (isDemoPlaying) {
      const interval = setInterval(() => {
        setDemoProgress((prev) => {
          if (prev >= 100) {
            setActiveStep((s) => (s < 4 ? s + 1 : 1));
            return 0;
          }
          return prev + 2;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isDemoPlaying]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-hidden">
      {/* Navigation */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold">RAI</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90
                       text-sm text-white font-medium transition-all shadow-sm"
            >
              무료로 시작하기
            </Link>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white">
            <div className="px-6 py-4 space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-base font-medium text-gray-600 hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-base font-medium text-gray-600"
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block w-full py-3 px-4 rounded-lg bg-primary text-white text-center font-medium"
                >
                  무료로 시작하기
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="flex-1">
        {/* ============================================
            HERO SECTION - Outcome Focused
            Critical Issue #1: Rewritten copy
        ============================================ */}
        <section className="relative px-6 md:px-8 py-20 md:py-28 max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            {/* Social Proof Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-3 px-4 py-2 rounded-full
                       bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium mb-8"
            >
              <div className="flex -space-x-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full bg-emerald-200 border-2 border-white flex items-center justify-center text-xs font-bold text-emerald-700"
                  >
                    {["K", "P", "L", "C"][i]}
                  </div>
                ))}
              </div>
              <span>500+ 헤드헌터가 사용 중</span>
            </motion.div>

            {/* Main Headline - Outcome Focused */}
            <motion.h1
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              custom={0.1}
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-[1.1] tracking-tight"
            >
              완벽한 후보자를
              <br />
              <span className="text-primary">몇 분 안에</span> 찾으세요
            </motion.h1>

            {/* Pain Point Subtitle */}
            <motion.p
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              custom={0.2}
              className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              하루 50개 이력서 검토?
              <br className="md:hidden" />
              <span className="font-semibold text-gray-900"> AI가 30초 만에 핵심만 추려드립니다.</span>
              <br />
              더 많은 후보자를 제안하고, 더 빨리 성사시키세요.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              custom={0.3}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                href="/signup"
                className="group flex items-center gap-2 px-8 py-4 rounded-xl
                         bg-primary hover:bg-primary/90 text-white font-semibold text-lg
                         transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                무료로 시작하기
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <button
                onClick={() => {
                  setIsDemoPlaying(true);
                  document.getElementById("demo-section")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group flex items-center gap-2 px-8 py-4 rounded-xl
                         bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold text-lg
                         transition-all"
              >
                <Play className="w-5 h-5" />
                2분 데모 보기
              </button>
            </motion.div>

            {/* ============================================
                VALUE-BASED STATS - Critical Issue #2
            ============================================ */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t border-gray-200"
            >
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="w-6 h-6 text-primary" />
                  <span className="text-3xl md:text-4xl font-bold text-gray-900">2시간</span>
                </div>
                <p className="text-sm md:text-base text-gray-600 font-medium">하루 절약 시간</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <TrendingUp className="w-6 h-6 text-primary" />
                  <span className="text-3xl md:text-4xl font-bold text-gray-900">3배</span>
                </div>
                <p className="text-sm md:text-base text-gray-600 font-medium">후보자 제안 증가</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Target className="w-6 h-6 text-primary" />
                  <span className="text-3xl md:text-4xl font-bold text-gray-900">80%</span>
                </div>
                <p className="text-sm md:text-base text-gray-600 font-medium">검토 시간 자동화</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            SOCIAL PROOF - Company Logos
            Critical Issue #3
        ============================================ */}
        <section className="bg-gray-50 px-6 md:px-8 py-12 border-y border-gray-200">
          <div className="max-w-7xl mx-auto">
            <p className="text-center text-sm text-gray-500 mb-8 font-medium">
              국내 Top 서치펌들이 신뢰하는 솔루션
            </p>
            <div className="flex items-center justify-center gap-8 md:gap-16 flex-wrap opacity-60">
              {companyLogos.map((logo) => (
                <div key={logo} className="text-gray-400 font-semibold text-lg">
                  {logo}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            INTERACTIVE DEMO SECTION
            Missed Opportunity #1: Show, Don't Tell
        ============================================ */}
        <section id="demo-section" className="px-6 md:px-8 py-24 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              직접 체험해보세요
            </h2>
            <p className="text-gray-600 text-lg">
              30초 만에 이력서가 어떻게 분석되는지 확인하세요
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-gray-900 rounded-3xl p-8 md:p-12 shadow-2xl"
          >
            {/* Demo Header */}
            <div className="flex items-center gap-2 mb-8">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-4 text-gray-400 text-sm">RAI Demo</span>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Left: Upload Area */}
              <div className="space-y-6">
                <div
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    activeStep >= 1
                      ? "border-primary bg-primary/10"
                      : "border-gray-700 bg-gray-800"
                  }`}
                >
                  <Upload
                    className={`w-12 h-12 mx-auto mb-4 ${
                      activeStep >= 1 ? "text-primary" : "text-gray-500"
                    }`}
                  />
                  <p className="text-white font-medium mb-2">
                    {activeStep >= 1 ? "이력서_김철수.pdf 업로드됨" : "이력서를 드래그하세요"}
                  </p>
                  <p className="text-gray-400 text-sm">PDF, HWP, DOCX 지원</p>
                </div>

                {/* Progress Steps */}
                <div className="space-y-3">
                  {workflowSteps.slice(0, 2).map((step) => (
                    <div
                      key={step.step}
                      className={`flex items-center gap-4 p-4 rounded-xl transition-all ${
                        activeStep >= step.step ? "bg-gray-800" : "bg-gray-800/50"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          activeStep >= step.step ? "bg-primary" : "bg-gray-700"
                        }`}
                      >
                        {activeStep > step.step ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : (
                          <step.icon className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-medium">{step.title}</p>
                        <p className="text-gray-400 text-sm">{step.description}</p>
                      </div>
                      <span className="text-primary font-mono text-sm">{step.time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Analysis Result */}
              <div className="bg-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-semibold">분석 결과</h3>
                  {activeStep >= 2 && (
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium">
                      신뢰도 96%
                    </span>
                  )}
                </div>

                {activeStep >= 2 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="p-4 bg-gray-700/50 rounded-xl">
                      <p className="text-gray-400 text-sm mb-1">이름</p>
                      <p className="text-white font-medium">김철수</p>
                    </div>
                    <div className="p-4 bg-gray-700/50 rounded-xl">
                      <p className="text-gray-400 text-sm mb-1">현재 직책</p>
                      <p className="text-white font-medium">Senior Frontend Engineer @ 네이버</p>
                    </div>
                    <div className="p-4 bg-gray-700/50 rounded-xl">
                      <p className="text-gray-400 text-sm mb-1">총 경력</p>
                      <p className="text-white font-medium">7년 3개월</p>
                    </div>
                    <div className="p-4 bg-gray-700/50 rounded-xl">
                      <p className="text-gray-400 text-sm mb-2">핵심 스킬</p>
                      <div className="flex flex-wrap gap-2">
                        {["React", "TypeScript", "Next.js", "Node.js"].map((skill) => (
                          <span
                            key={skill}
                            className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <p>이력서를 업로드하면 분석 결과가 표시됩니다</p>
                  </div>
                )}
              </div>
            </div>

            {/* Demo Controls */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                onClick={() => {
                  setIsDemoPlaying(!isDemoPlaying);
                  if (!isDemoPlaying) setActiveStep(1);
                }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium transition-all"
              >
                {isDemoPlaying ? "일시정지" : "데모 시작"}
                {!isDemoPlaying && <Play className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  setActiveStep(1);
                  setDemoProgress(0);
                  setIsDemoPlaying(false);
                }}
                className="px-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-all"
              >
                초기화
              </button>
            </div>
          </motion.div>
        </section>

        {/* ============================================
            HOW IT WORKS - Workflow Visualization
            Missed Opportunity #2
        ============================================ */}
        <section className="bg-gray-50 px-6 md:px-8 py-24">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                어떻게 작동하나요?
              </h2>
              <p className="text-gray-600 text-lg">
                4단계로 완성되는 스마트 채용 워크플로우
              </p>
            </motion.div>

            <div className="grid md:grid-cols-4 gap-6">
              {workflowSteps.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  {/* Connector Line */}
                  {index < workflowSteps.length - 1 && (
                    <div className="hidden md:block absolute top-12 left-[60%] w-full h-0.5 bg-gray-300" />
                  )}

                  <div className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    {/* Step Number */}
                    <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg mb-4">
                      {step.step}
                    </div>

                    {/* Icon */}
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <step.icon className="w-7 h-7 text-primary" />
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{step.description}</p>

                    {/* Time Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium">
                      <Clock className="w-4 h-4" />
                      {step.time}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            SIMPLIFIED FEATURES - 3 Key Benefits
            Critical Issue #4
        ============================================ */}
        <section className="px-6 md:px-8 py-24 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              왜 헤드헌터들이 RAI를 선택할까요?
            </h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">
              복잡한 기능 설명 대신, 실제로 얻는 가치에 집중했습니다
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1: Speed */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group p-8 rounded-3xl bg-gradient-to-br from-blue-50 to-white border border-blue-100 hover:shadow-lg transition-all"
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">30초 만에 분석 완료</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                수십 페이지 이력서도 30초 안에 구조화된 데이터로 변환합니다.
                경력, 스킬, 학력을 한눈에 파악하세요.
              </p>
              <div className="flex items-center gap-2 text-blue-600 font-medium">
                <span>이력서 검토 시간 80% 절감</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.div>

            {/* Feature 2: Smart Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="group p-8 rounded-3xl bg-gradient-to-br from-purple-50 to-white border border-purple-100 hover:shadow-lg transition-all"
            >
              <div className="w-16 h-16 rounded-2xl bg-purple-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Search className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">똑똑한 의미 검색</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                "React 잘하는 시니어" 같은 자연어로 검색하세요.
                키워드가 아닌 의미로 최적의 후보자를 찾아드립니다.
              </p>
              <div className="flex items-center gap-2 text-purple-600 font-medium">
                <span>숨은 인재 발굴율 3배 향상</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.div>

            {/* Feature 3: Security */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="group p-8 rounded-3xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 hover:shadow-lg transition-all"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">완벽한 개인정보 보호</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                AES-256 암호화와 PII 마스킹으로 후보자 정보를 안전하게 보호합니다.
                블라인드 이력서 1클릭 생성까지.
              </p>
              <div className="flex items-center gap-2 text-emerald-600 font-medium">
                <span>GDPR & PIPA 준수</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============================================
            TESTIMONIALS SECTION
            Critical Issue #3: Social Proof
        ============================================ */}
        <section className="bg-gray-900 px-6 md:px-8 py-24">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                헤드헌터들의 실제 후기
              </h2>
              <p className="text-gray-400 text-lg">
                RAI를 사용하는 채용 전문가들의 이야기
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <motion.div
                  key={testimonial.author}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-gray-800 rounded-2xl p-8 relative"
                >
                  {/* Quote Icon */}
                  <Quote className="w-10 h-10 text-primary/30 absolute top-6 right-6" />

                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="text-white text-lg mb-6 leading-relaxed">
                    "{testimonial.quote}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{testimonial.author}</p>
                      <p className="text-gray-400 text-sm">
                        {testimonial.role}, {testimonial.company}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================
            PRICING PREVIEW
            Missed Opportunity #3
        ============================================ */}
        <section className="px-6 md:px-8 py-24 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              투명한 요금제
            </h2>
            <p className="text-gray-600 text-lg">
              팀 규모에 맞는 플랜을 선택하세요. 언제든 업그레이드 가능합니다.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {pricingTiers.map((tier, index) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`relative rounded-3xl p-8 ${
                  tier.popular
                    ? "bg-primary text-white shadow-xl scale-105"
                    : "bg-white border border-gray-200"
                }`}
              >
                {/* Popular Badge */}
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-yellow-400 text-gray-900 text-sm font-bold">
                    가장 인기
                  </div>
                )}

                {/* Plan Name */}
                <h3 className={`text-xl font-bold mb-2 ${tier.popular ? "text-white" : "text-gray-900"}`}>
                  {tier.name}
                </h3>
                <p className={`text-sm mb-6 ${tier.popular ? "text-white/80" : "text-gray-500"}`}>
                  {tier.description}
                </p>

                {/* Price */}
                <div className="mb-6">
                  <span className={`text-4xl font-bold ${tier.popular ? "text-white" : "text-gray-900"}`}>
                    {tier.price === "문의" ? "" : "₩"}
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className={tier.popular ? "text-white/60" : "text-gray-500"}>
                      /{tier.period}
                    </span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <CheckCircle
                        className={`w-5 h-5 ${tier.popular ? "text-white" : "text-primary"}`}
                      />
                      <span className={tier.popular ? "text-white/90" : "text-gray-600"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={tier.name === "Enterprise" ? "/support" : "/signup"}
                  className={`block w-full py-3 rounded-xl text-center font-semibold transition-all ${
                    tier.popular
                      ? "bg-white text-primary hover:bg-gray-100"
                      : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                  }`}
                >
                  {tier.cta}
                </Link>
              </motion.div>
            ))}
          </div>

          <p className="text-center text-gray-500 mt-8">
            모든 플랜에 14일 무료 체험이 포함됩니다. 신용카드 없이 시작하세요.
          </p>
        </section>

        {/* ============================================
            FINAL CTA SECTION
        ============================================ */}
        <section className="px-6 md:px-8 py-24 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="p-12 rounded-3xl bg-gradient-to-br from-primary to-blue-600 text-white text-center shadow-2xl"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              지금 바로 시작하세요
            </h2>
            <p className="text-white/80 text-lg mb-8 max-w-md mx-auto">
              14일 무료 체험으로 RAI의 모든 기능을 경험해보세요.
              <br />
              신용카드 없이 바로 시작할 수 있습니다.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="group flex items-center gap-2 px-8 py-4 rounded-xl
                         bg-white text-primary font-semibold text-lg
                         hover:bg-gray-100 transition-all shadow-lg"
              >
                무료 체험 시작
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center justify-center gap-6 mt-8 text-sm text-white/60 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>신용카드 불필요</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>14일 무료 체험</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>언제든 취소 가능</span>
              </div>
            </div>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white px-6 md:px-8 py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm text-gray-500">© 2025 RAI. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-primary transition-colors">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">
              개인정보처리방침
            </Link>
            <Link href="/support" className="hover:text-primary transition-colors">
              문의하기
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
