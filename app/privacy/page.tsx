"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Sparkles, Menu, X, ChevronUp, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import DeepSpaceBackground from "@/components/layout/DeepSpaceBackground";

// Navigation links
const navLinks = [
  { href: "/products", label: "Products" },
  { href: "/pricing", label: "Pricing" },
  { href: "/support", label: "Support" },
];

// Table of Contents
const tocItems = [
  { id: "general", label: "제1조 (목적)" },
  { id: "collection", label: "제2조 (수집하는 개인정보)" },
  { id: "purpose", label: "제3조 (개인정보의 이용목적)" },
  { id: "retention", label: "제4조 (보유 및 이용기간)" },
  { id: "provision", label: "제5조 (제3자 제공)" },
  { id: "outsourcing", label: "제6조 (처리 위탁)" },
  { id: "rights", label: "제7조 (정보주체의 권리)" },
  { id: "security", label: "제8조 (안전성 확보 조치)" },
  { id: "cookies", label: "제9조 (쿠키 사용)" },
  { id: "automated", label: "제10조 (자동 수집 장치)" },
  { id: "children", label: "제11조 (아동의 개인정보)" },
  { id: "overseas", label: "제12조 (국외 이전)" },
  { id: "officer", label: "제13조 (개인정보 보호책임자)" },
  { id: "remedies", label: "제14조 (권익침해 구제)" },
  { id: "changes", label: "제15조 (방침 변경)" },
];

export default function PrivacyPage() {
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);
    };
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <DeepSpaceBackground />

      <div className="relative z-10">
        {/* Navigation */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center justify-between px-6 md:px-8 py-6 max-w-7xl mx-auto"
        >
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-white">RAI</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-slate-300 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/login"
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10
                       text-sm text-white font-medium transition-all"
            >
              시작하기
            </Link>
          </div>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </motion.nav>

        {/* Mobile Menu */}
        <motion.div
          initial={false}
          animate={{
            height: mobileMenuOpen ? "auto" : 0,
            opacity: mobileMenuOpen ? 1 : 0,
          }}
          transition={{ duration: 0.3 }}
          className="md:hidden overflow-hidden"
        >
          <div className="px-6 pb-6 space-y-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-slate-300 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-slate-300 hover:text-white transition-colors"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-3 px-4 rounded-lg bg-primary text-white text-center font-medium"
              >
                시작하기
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Hero Section */}
        <section className="px-6 md:px-8 pt-16 pb-8 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">PIPA & GDPR 준수</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              개인정보처리방침
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              RAI는 이용자의 개인정보를 소중히 보호합니다.
            </p>
            <p className="text-sm text-slate-500 mt-4">
              최종 수정일: 2025년 1월 13일 | 시행일: 2025년 1월 13일
            </p>
          </motion.div>
        </section>

        {/* Main Content */}
        <section className="px-6 md:px-8 py-8 max-w-5xl mx-auto">
          <div className="flex gap-8">
            {/* Table of Contents - Desktop */}
            <motion.aside
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="hidden lg:block w-64 shrink-0"
            >
              <div className="sticky top-8 p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <h3 className="text-sm font-semibold text-white mb-4">목차</h3>
                <nav className="space-y-2">
                  {tocItems.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block text-xs text-slate-400 hover:text-primary transition-colors py-1"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>
            </motion.aside>

            {/* Privacy Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex-1 prose prose-invert prose-slate max-w-none"
            >
              <div className="p-6 md:p-8 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-10">
                {/* 서문 */}
                <section>
                  <p className="text-slate-300 leading-relaxed">
                    포텐시아 주식회사(Potensia Inc., 이하 &quot;회사&quot;)는 개인정보보호법, 정보통신망 이용촉진 및
                    정보보호 등에 관한 법률 등 관련 법령에 따라 이용자의 개인정보를 보호하고,
                    이와 관련한 고충을 신속하고 원활하게 처리할 수 있도록 다음과 같이
                    개인정보처리방침을 수립하여 공개합니다.
                  </p>
                </section>

                {/* 제1조 */}
                <section id="general">
                  <h2 className="text-xl font-bold text-white mb-4">제1조 (목적)</h2>
                  <p className="text-slate-300 leading-relaxed">
                    본 개인정보처리방침은 회사가 제공하는 AI 기반 이력서 분석 서비스
                    &quot;RAI&quot;(이하 &quot;서비스&quot;)를 이용하는 이용자의 개인정보가 어떻게
                    수집, 이용, 보관, 파기되는지를 안내하고, 이용자의 권리와 그 행사 방법을
                    알려드리기 위해 수립되었습니다.
                  </p>
                </section>

                {/* 제2조 */}
                <section id="collection">
                  <h2 className="text-xl font-bold text-white mb-4">제2조 (수집하는 개인정보)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    회사는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.
                  </p>

                  <h3 className="text-lg font-semibold text-white mt-6 mb-3">1. 회원가입 시 수집 정보</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-300">
                    <li><strong className="text-white">필수항목:</strong> 이메일 주소, 비밀번호, 이름</li>
                    <li><strong className="text-white">선택항목:</strong> 회사명, 직책, 전화번호</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6 mb-3">2. 서비스 이용 시 수집 정보</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-300">
                    <li>이력서 파일에 포함된 후보자 정보 (이름, 연락처, 경력, 학력 등)</li>
                    <li>서비스 이용 기록, 접속 로그, IP 주소</li>
                    <li>결제 정보 (결제 수단, 결제 이력)</li>
                  </ul>

                  <h3 className="text-lg font-semibold text-white mt-6 mb-3">3. 자동 수집 정보</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-300">
                    <li>브라우저 종류 및 버전, 운영체제</li>
                    <li>접속 일시, 서비스 이용 기록</li>
                    <li>쿠키, 디바이스 정보</li>
                  </ul>
                </section>

                {/* 제3조 */}
                <section id="purpose">
                  <h2 className="text-xl font-bold text-white mb-4">제3조 (개인정보의 이용목적)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    회사는 수집한 개인정보를 다음의 목적으로 이용합니다.
                  </p>
                  <ol className="list-decimal list-inside space-y-3 text-slate-300">
                    <li>
                      <strong className="text-white">서비스 제공:</strong> 이력서 분석, 후보자 검색,
                      데이터 관리, 블라인드 내보내기 등 서비스 기능 제공
                    </li>
                    <li>
                      <strong className="text-white">회원 관리:</strong> 회원제 서비스 제공, 본인 확인,
                      가입 의사 확인, 부정 이용 방지
                    </li>
                    <li>
                      <strong className="text-white">요금 결제:</strong> 유료 서비스 요금 청구, 결제 처리
                    </li>
                    <li>
                      <strong className="text-white">고객 지원:</strong> 문의사항 처리, 공지사항 전달,
                      서비스 이용 관련 안내
                    </li>
                    <li>
                      <strong className="text-white">서비스 개선:</strong> 서비스 품질 향상, 신규 서비스
                      개발, 통계 분석
                    </li>
                    <li>
                      <strong className="text-white">마케팅:</strong> 이벤트 정보 제공, 맞춤형 서비스
                      제공 (동의 시)
                    </li>
                  </ol>
                </section>

                {/* 제4조 */}
                <section id="retention">
                  <h2 className="text-xl font-bold text-white mb-4">제4조 (개인정보의 보유 및 이용기간)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    회사는 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이
                    파기합니다. 단, 다음의 정보는 아래의 사유로 명시한 기간 동안 보존합니다.
                  </p>

                  <h3 className="text-lg font-semibold text-white mt-6 mb-3">1. 회사 내부 방침에 의한 보존</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-slate-300 mt-2">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-white">보존 항목</th>
                          <th className="text-left py-3 px-4 text-white">보존 기간</th>
                          <th className="text-left py-3 px-4 text-white">보존 사유</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">부정 이용 기록</td>
                          <td className="py-3 px-4">1년</td>
                          <td className="py-3 px-4">부정 이용 방지</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <h3 className="text-lg font-semibold text-white mt-6 mb-3">2. 관련 법령에 의한 보존</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-slate-300 mt-2">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-white">보존 항목</th>
                          <th className="text-left py-3 px-4 text-white">보존 기간</th>
                          <th className="text-left py-3 px-4 text-white">근거 법령</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">계약 또는 청약철회 기록</td>
                          <td className="py-3 px-4">5년</td>
                          <td className="py-3 px-4">전자상거래법</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">대금결제 및 재화 공급 기록</td>
                          <td className="py-3 px-4">5년</td>
                          <td className="py-3 px-4">전자상거래법</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">소비자 불만 또는 분쟁처리 기록</td>
                          <td className="py-3 px-4">3년</td>
                          <td className="py-3 px-4">전자상거래법</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">웹사이트 방문 기록</td>
                          <td className="py-3 px-4">3개월</td>
                          <td className="py-3 px-4">통신비밀보호법</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 제5조 */}
                <section id="provision">
                  <h2 className="text-xl font-bold text-white mb-4">제5조 (개인정보의 제3자 제공)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
                    다만, 다음의 경우에는 예외로 합니다.
                  </p>
                  <ol className="list-decimal list-inside space-y-2 text-slate-300">
                    <li>이용자가 사전에 동의한 경우</li>
                    <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
                    <li>통계작성, 학술연구, 시장조사를 위해 특정 개인을 식별할 수 없는 형태로 제공하는 경우</li>
                  </ol>
                </section>

                {/* 제6조 */}
                <section id="outsourcing">
                  <h2 className="text-xl font-bold text-white mb-4">제6조 (개인정보 처리의 위탁)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    회사는 서비스 향상을 위해 다음과 같이 개인정보 처리 업무를 위탁하고 있습니다.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-slate-300 mt-2">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-white">수탁업체</th>
                          <th className="text-left py-3 px-4 text-white">위탁 업무</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">Amazon Web Services (AWS)</td>
                          <td className="py-3 px-4">클라우드 서버 운영 및 데이터 저장</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">Paddle</td>
                          <td className="py-3 px-4">결제 처리 및 정산</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">Supabase</td>
                          <td className="py-3 px-4">데이터베이스 운영</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">OpenAI / Google</td>
                          <td className="py-3 px-4">AI 이력서 분석 처리</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-slate-400 text-sm mt-4">
                    위탁 계약 시 개인정보보호법 제26조에 따라 개인정보가 안전하게 관리될 수 있도록
                    필요한 사항을 규정하고 있습니다.
                  </p>
                </section>

                {/* 제7조 */}
                <section id="rights">
                  <h2 className="text-xl font-bold text-white mb-4">제7조 (정보주체의 권리와 행사 방법)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    이용자(정보주체)는 다음과 같은 권리를 행사할 수 있습니다.
                  </p>
                  <ol className="list-decimal list-inside space-y-3 text-slate-300">
                    <li>
                      <strong className="text-white">개인정보 열람권:</strong> 자신의 개인정보 처리 현황에
                      대해 열람을 요구할 수 있습니다.
                    </li>
                    <li>
                      <strong className="text-white">정정·삭제권:</strong> 개인정보의 오류에 대해 정정 또는
                      삭제를 요구할 수 있습니다.
                    </li>
                    <li>
                      <strong className="text-white">처리정지권:</strong> 개인정보 처리의 정지를 요구할 수
                      있습니다.
                    </li>
                    <li>
                      <strong className="text-white">동의 철회권:</strong> 개인정보 수집·이용에 대한 동의를
                      철회할 수 있습니다.
                    </li>
                  </ol>
                  <p className="text-slate-300 mt-4">
                    권리 행사는 서비스 내 설정 메뉴 또는 고객센터(support@rai.kr)를 통해 요청할 수
                    있으며, 회사는 지체 없이 필요한 조치를 취합니다.
                  </p>
                </section>

                {/* 제8조 */}
                <section id="security">
                  <h2 className="text-xl font-bold text-white mb-4">제8조 (개인정보의 안전성 확보 조치)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
                  </p>
                  <ol className="list-decimal list-inside space-y-3 text-slate-300">
                    <li>
                      <strong className="text-white">관리적 조치:</strong> 개인정보 보호 내부 관리계획 수립,
                      직원 교육, 접근 권한 관리
                    </li>
                    <li>
                      <strong className="text-white">기술적 조치:</strong>
                      <ul className="list-disc list-inside ml-4 mt-2 space-y-1 text-slate-400">
                        <li>민감 데이터 AES-256-GCM 암호화</li>
                        <li>SSL/TLS 암호화 통신</li>
                        <li>Row Level Security(RLS)를 통한 데이터 격리</li>
                        <li>보안 프로그램 설치 및 업데이트</li>
                        <li>접근 로그 기록 및 모니터링</li>
                      </ul>
                    </li>
                    <li>
                      <strong className="text-white">물리적 조치:</strong> 전산실, 자료 보관실 접근 통제
                    </li>
                  </ol>
                </section>

                {/* 제9조 */}
                <section id="cookies">
                  <h2 className="text-xl font-bold text-white mb-4">제9조 (쿠키의 사용)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    회사는 이용자에게 개별적인 맞춤 서비스를 제공하기 위해 쿠키(cookie)를 사용합니다.
                  </p>
                  <h3 className="text-lg font-semibold text-white mt-6 mb-3">1. 쿠키의 사용 목적</h3>
                  <ul className="list-disc list-inside space-y-2 text-slate-300">
                    <li>로그인 상태 유지</li>
                    <li>이용자 설정 저장</li>
                    <li>서비스 이용 통계 분석</li>
                    <li>맞춤형 서비스 제공</li>
                  </ul>
                  <h3 className="text-lg font-semibold text-white mt-6 mb-3">2. 쿠키 설정 거부 방법</h3>
                  <p className="text-slate-300">
                    이용자는 웹 브라우저 설정을 통해 쿠키 저장을 거부할 수 있습니다.
                    다만, 쿠키 저장을 거부할 경우 로그인이 필요한 일부 서비스 이용에 어려움이
                    있을 수 있습니다.
                  </p>
                </section>

                {/* 제10조 */}
                <section id="automated">
                  <h2 className="text-xl font-bold text-white mb-4">제10조 (자동 수집 장치의 설치·운영 및 거부)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    회사는 서비스 개선을 위해 다음과 같은 자동 수집 장치를 사용할 수 있습니다.
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-slate-300">
                    <li>Google Analytics: 서비스 이용 통계 분석</li>
                    <li>Sentry: 오류 추적 및 서비스 안정성 개선</li>
                  </ul>
                  <p className="text-slate-300 mt-4">
                    이용자는 브라우저 설정 또는 Do Not Track 기능을 통해 자동 수집을 거부할 수 있습니다.
                  </p>
                </section>

                {/* 제11조 */}
                <section id="children">
                  <h2 className="text-xl font-bold text-white mb-4">제11조 (아동의 개인정보 보호)</h2>
                  <p className="text-slate-300 leading-relaxed">
                    회사는 만 14세 미만 아동의 개인정보를 수집하지 않습니다. 서비스는 만 18세 이상의
                    성인을 대상으로 제공되며, 만 14세 미만 아동의 가입 신청이 확인되는 경우 해당
                    계정을 삭제합니다.
                  </p>
                </section>

                {/* 제12조 */}
                <section id="overseas">
                  <h2 className="text-xl font-bold text-white mb-4">제12조 (개인정보의 국외 이전)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    회사는 서비스 제공을 위해 개인정보를 국외로 이전할 수 있습니다.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-slate-300 mt-2">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-4 text-white">이전받는 자</th>
                          <th className="text-left py-3 px-4 text-white">이전 국가</th>
                          <th className="text-left py-3 px-4 text-white">이전 목적</th>
                          <th className="text-left py-3 px-4 text-white">이전 항목</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">AWS</td>
                          <td className="py-3 px-4">대한민국 (서울)</td>
                          <td className="py-3 px-4">데이터 저장</td>
                          <td className="py-3 px-4">서비스 이용 데이터</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">OpenAI</td>
                          <td className="py-3 px-4">미국</td>
                          <td className="py-3 px-4">AI 분석</td>
                          <td className="py-3 px-4">이력서 텍스트 (비식별화)</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">Google Cloud</td>
                          <td className="py-3 px-4">미국</td>
                          <td className="py-3 px-4">AI 분석</td>
                          <td className="py-3 px-4">이력서 텍스트 (비식별화)</td>
                        </tr>
                        <tr className="border-b border-white/5">
                          <td className="py-3 px-4">Paddle</td>
                          <td className="py-3 px-4">영국</td>
                          <td className="py-3 px-4">결제 처리</td>
                          <td className="py-3 px-4">결제 정보</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* 제13조 */}
                <section id="officer">
                  <h2 className="text-xl font-bold text-white mb-4">제13조 (개인정보 보호책임자)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한
                    정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를
                    지정하고 있습니다.
                  </p>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <p className="text-slate-300"><strong className="text-white">개인정보 보호책임자</strong></p>
                    <p className="text-slate-300">성명: 개인정보보호팀</p>
                    <p className="text-slate-300">이메일: privacy@rai.kr</p>
                    <p className="text-slate-300">전화: 고객센터 문의</p>
                  </div>
                </section>

                {/* 제14조 */}
                <section id="remedies">
                  <h2 className="text-xl font-bold text-white mb-4">제14조 (권익침해 구제 방법)</h2>
                  <p className="text-slate-300 leading-relaxed mb-4">
                    정보주체는 개인정보침해로 인한 구제를 받기 위하여 다음 기관에 분쟁해결이나
                    상담 등을 신청할 수 있습니다.
                  </p>
                  <ul className="list-disc list-inside space-y-3 text-slate-300">
                    <li>
                      <strong className="text-white">개인정보분쟁조정위원회:</strong>{" "}
                      (국번없이) 1833-6972 / www.kopico.go.kr
                    </li>
                    <li>
                      <strong className="text-white">개인정보침해신고센터:</strong>{" "}
                      (국번없이) 118 / privacy.kisa.or.kr
                    </li>
                    <li>
                      <strong className="text-white">대검찰청 사이버수사과:</strong>{" "}
                      (국번없이) 1301 / www.spo.go.kr
                    </li>
                    <li>
                      <strong className="text-white">경찰청 사이버수사국:</strong>{" "}
                      (국번없이) 182 / ecrm.cyber.go.kr
                    </li>
                  </ul>
                </section>

                {/* 제15조 */}
                <section id="changes">
                  <h2 className="text-xl font-bold text-white mb-4">제15조 (개인정보처리방침의 변경)</h2>
                  <ol className="list-decimal list-inside space-y-3 text-slate-300">
                    <li>
                      본 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의
                      추가, 삭제 및 수정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을
                      통하여 고지합니다.
                    </li>
                    <li>
                      중요한 변경사항의 경우 시행 30일 전에 이메일 또는 서비스 내 알림으로
                      개별 통지합니다.
                    </li>
                  </ol>
                </section>

                {/* 부칙 */}
                <section className="pt-8 border-t border-white/10">
                  <h2 className="text-xl font-bold text-white mb-4">부칙</h2>
                  <ol className="list-decimal list-inside space-y-2 text-slate-300">
                    <li>본 개인정보처리방침은 2025년 1월 13일부터 시행됩니다.</li>
                  </ol>
                </section>

                {/* 연락처 */}
                <section className="pt-8 border-t border-white/10">
                  <h2 className="text-xl font-bold text-white mb-4">문의처</h2>
                  <div className="text-slate-300 space-y-2">
                    <p><strong className="text-white">회사명:</strong> 포텐시아 주식회사 (Potensia Inc.)</p>
                    <p><strong className="text-white">개인정보 관련 문의:</strong> privacy@rai.kr</p>
                    <p><strong className="text-white">일반 문의:</strong> support@rai.kr</p>
                    <p><strong className="text-white">고객센터:</strong> 평일 09:00 - 18:00</p>
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative px-6 md:px-8 py-12 border-t border-white/5">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm text-slate-500">
                © 2025 RAI. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/terms" className="hover:text-white transition-colors">
                이용약관
              </Link>
              <Link href="/privacy" className="text-white font-medium">
                개인정보처리방침
              </Link>
              <Link href="/support" className="hover:text-white transition-colors">
                문의하기
              </Link>
            </div>
          </div>
        </footer>

        {/* Scroll to Top Button */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: showScrollTop ? 1 : 0 }}
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-3 rounded-full bg-primary/20 border border-primary/30
                   text-primary hover:bg-primary/30 transition-all z-50"
          style={{ pointerEvents: showScrollTop ? "auto" : "none" }}
          aria-label="맨 위로"
        >
          <ChevronUp className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
