"use client";

import { motion, Variants } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  Brain,
  Shield,
  Zap,
  FileSearch,
  Users,
  Lock,
  BarChart3,
  ArrowRight,
  CheckCircle,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect } from "react";

// Navigation links
const navLinks = [
  { href: "/products", label: "Products" },
  { href: "/pricing", label: "Pricing" },
  { href: "/support", label: "Support" },
];

// Animation variants
const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      delay: typeof delay === "number" ? delay : 0,
      ease: "easeOut",
    },
  }),
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

// Product features data
const coreFeatures = [
  {
    icon: Brain,
    title: "2-Way AI Cross-Check",
    description:
      "GPT-4o와 Gemini 1.5 Pro 두 개의 AI 엔진이 독립적으로 이력서를 분석하고 교차 검증하여 99.2% 정확도를 달성합니다.",
    details: [
      "독립적인 듀얼 AI 분석",
      "교차 검증을 통한 오류 최소화",
      "신뢰도 점수 제공",
      "필드별 정확도 표시",
    ],
  },
  {
    icon: Shield,
    title: "Privacy Shield",
    description:
      "AES-256-GCM 암호화와 자동 PII 마스킹으로 후보자의 민감한 개인정보를 안전하게 보호합니다.",
    details: [
      "AES-256-GCM 암호화",
      "자동 PII 탐지 및 마스킹",
      "RLS 기반 데이터 격리",
      "GDPR/PIPA 준수",
    ],
  },
  {
    icon: Zap,
    title: "30초 분석",
    description:
      "PDF, HWP, DOCX 등 다양한 형식의 이력서를 30초 이내에 구조화된 데이터로 변환합니다.",
    details: [
      "PDF, HWP, DOCX 지원",
      "평균 처리 시간 30초",
      "비동기 병렬 처리",
      "대용량 배치 업로드",
    ],
  },
  {
    icon: FileSearch,
    title: "시맨틱 검색",
    description:
      "벡터 임베딩 기반 검색으로 키워드가 아닌 의미를 이해하여 최적의 후보자를 찾아냅니다.",
    details: [
      "OpenAI 임베딩 기반",
      "동의어 자동 확장",
      "스킬 매칭 점수",
      "고급 필터링",
    ],
  },
  {
    icon: Users,
    title: "중복 감지",
    description:
      "동일 후보자의 다른 버전 이력서를 자동으로 감지하고 효율적으로 버전 관리합니다.",
    details: [
      "해시 기반 중복 탐지",
      "유사도 점수 계산",
      "버전 히스토리 관리",
      "병합/삭제 옵션",
    ],
  },
  {
    icon: Lock,
    title: "블라인드 내보내기",
    description:
      "개인 식별 정보를 제거한 블라인드 이력서를 PDF로 즉시 생성하여 공정한 채용을 지원합니다.",
    details: [
      "원클릭 블라인드 PDF",
      "선택적 필드 마스킹",
      "커스텀 템플릿",
      "배치 내보내기",
    ],
  },
];

// Additional features
const additionalFeatures = [
  {
    icon: BarChart3,
    title: "리스크 대시보드",
    description: "데이터 품질 문제를 한눈에 파악하고 관리할 수 있습니다.",
  },
  {
    icon: Sparkles,
    title: "포지션 매칭",
    description: "채용 포지션과 후보자를 자동으로 매칭하여 추천합니다.",
  },
];

export default function ProductsPage() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/10 selection:text-primary">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/80 backdrop-blur-md border-b border-gray-100" : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">RAI</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${link.href === "/products"
                  ? "text-primary"
                  : "text-gray-500 hover:text-gray-900"
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all shadow-sm hover:shadow-md"
            >
              시작하기
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <motion.div
        initial={false}
        animate={{ height: mobileMenuOpen ? "auto" : 0, opacity: mobileMenuOpen ? 1 : 0 }}
        className="md:hidden overflow-hidden bg-white border-b border-gray-100 fixed top-20 left-0 right-0 z-40 shadow-lg"
      >
        <div className="p-6 space-y-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-base font-medium text-gray-900"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <Link
              href="/login"
              className="block w-full py-3 text-center text-gray-600 font-medium hover:text-gray-900"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="block w-full py-3 rounded-xl bg-primary text-white text-center font-medium hover:bg-primary/90"
            >
              시작하기
            </Link>
          </div>
        </div>
      </motion.div>

      <main className="pt-32 pb-20 px-6">
        {/* Hero */}
        <div className="max-w-4xl mx-auto text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
              AI 기반 이력서 분석의
              <br />
              <span className="text-primary">새로운 기준</span>
            </h1>
            <p className="text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto">
              RAI는 최신 AI 기술을 활용하여 이력서 분석, 후보자 검색,
              <br className="hidden md:block" />
              데이터 관리를 하나의 플랫폼에서 해결합니다.
            </p>
          </motion.div>
        </div>

        {/* Core Features */}
        <div className="max-w-7xl mx-auto mb-32">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {coreFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                variants={fadeInUp}
                className="group p-8 rounded-3xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-500 leading-relaxed mb-6">{feature.description}</p>

                <ul className="space-y-3">
                  {feature.details.map((detail) => (
                    <li key={detail} className="flex items-center gap-3 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                      {detail}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Additional Features */}
        <div className="max-w-3xl mx-auto mb-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl font-bold text-gray-900">추가 기능</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {additionalFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-start gap-5 p-6 rounded-2xl bg-white border border-gray-100 shadow-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{feature.title}</h3>
                  <p className="text-sm text-gray-500">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative px-8 py-16 md:py-20 rounded-[2.5rem] bg-[#0F172A] text-center overflow-hidden"
          >
            {/* Background Gradient */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                지금 바로 시작하세요
              </h2>
              <p className="text-blue-100 mb-10 max-w-lg mx-auto text-lg">
                Closed Beta 기간 동안 모든 기능을 무료로 체험해보세요.
                <br />
                신용카드 없이 14일간 무료로 이용할 수 있습니다.
              </p>

              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-primary hover:bg-blue-600 text-white font-semibold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                무료 체험 시작
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-gray-400" />
            </div>
            <span className="text-sm text-gray-500">© 2025 RAI. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-gray-900 transition-colors">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">
              개인정보처리방침
            </Link>
            <Link href="/support" className="hover:text-gray-900 transition-colors">
              문의하기
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
