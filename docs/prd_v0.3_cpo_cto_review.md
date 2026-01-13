# 🏢 FAANG CPO + CTO 합동 검토 보고서

## RAI PRD v0.3 Critical Review

| 역할 | 검토자 | 결론 |
|------|--------|------|
| **CPO** | FAANG 출신 (Product) | 🟠 **조건부 승인** |
| **CTO** | Senior TA (Engineering) | 🔴 **수정 필요** |

---

## 📊 Executive Summary

PRD v0.3은 V0.2 대비 **대폭 개선**되었으나, 코드베이스 100% 일치 관점에서 **5개의 Critical Issue**가 발견되었습니다.

| 영역 | 일치율 | 판정 |
|------|--------|------|
| Multi-Agent Pipeline | 100% | ✅ PASS |
| Search & Privacy | 100% | ✅ PASS |
| Blind Export | 100% | ✅ PASS |
| HWP Fallback | 100% | ✅ PASS |
| **Pricing** | 50% | ❌ FAIL |
| **3-Way Cross-Check** | 70% | ⚠️ PARTIAL |
| **Claude 연동** | 80% | ⚠️ PARTIAL |

---

## 🚨 Critical Issues (CPO)

### Issue #1: 가격 불일치 (Price Mismatch)

**심각도**: 🔴 **Critical** (고객 혼란, 법적 이슈)

PRD v0.3에서 두 가지 다른 가격을 명시하고 있습니다:

| 플랜 | PRD v0.3 (Section 6.1) | `types/auth.ts` | `lib/paddle/config.ts` |
|------|------------------------|-----------------|------------------------|
| **Starter** | ₩0 | **₩79,000** | ₩0 |
| **Pro** | ₩49,000 | **₩149,000** | ₩49,000 |
| **Enterprise** | ₩99,000 | **₩199,000** | ₩99,000 |

**근거 코드:**

```typescript
// types/auth.ts:25-49
starter: { price: 79000, ... },
pro: { price: 149000, ... },
enterprise: { price: 199000, ... },

// lib/paddle/config.ts:26-71
starter: { price: 0, ... },
pro: { price: 49000, ... },
enterprise: { price: 99000, ... },
```

**CPO 의견:**
> "두 파일이 완전히 다른 가격 체계를 가지고 있습니다. `types/auth.ts`는 PRD v6.0 기준이고, `lib/paddle/config.ts`는 실제 Paddle 결제용입니다. 고객이 UI에서 보는 가격과 결제되는 가격이 다를 수 있는 심각한 버그입니다."

**권장 조치:**
1. `types/auth.ts`와 `lib/paddle/config.ts` 통합
2. PRD에 단일 진실 공급원(Single Source of Truth) 명시
3. 가격 상수를 한 곳에서만 관리

---

### Issue #2: 3-Way Cross-Check 부정확

**심각도**: 🟠 **High** (기술 부채)

PRD v0.3은 "3-Way Cross-Check ✅ 코드 완료"라고 명시하지만, **`AnalystAgent`는 항상 2-Way만 사용**합니다.

**근거 코드:**

```python
# apps/worker/agents/analyst_agent.py:178-193
def _get_providers(self, mode: AnalysisMode) -> List[LLMProvider]:
    # Always use OpenAI + Gemini for cross-check (2 calls)  ← 주석 참조!
    required = [LLMProvider.OPENAI, LLMProvider.GEMINI]
    providers = [p for p in required if p in available]
    return providers
```

**반면** `BaseSectionAgent`는 올바르게 구현되어 있습니다:

```python
# apps/worker/agents/base_section_agent.py:150-169
def _get_providers(self, mode: AnalysisMode) -> List[LLMProvider]:
    if mode == AnalysisMode.PHASE_1:
        required = [LLMProvider.OPENAI, LLMProvider.GEMINI]
    else:
        required = [LLMProvider.OPENAI, LLMProvider.GEMINI, LLMProvider.CLAUDE]
    return providers
```

**CTO 의견:**
> "메인 분석 파이프라인(`AnalystAgent`)에서 Phase 2 모드가 무시됩니다. `BaseSectionAgent`의 로직을 `AnalystAgent._get_providers()`에도 동일하게 적용해야 합니다."

**권장 조치:**
1. `AnalystAgent._get_providers()` 수정
2. 또는 `AnalystAgent`가 `BaseSectionAgent`를 상속하도록 리팩토링
3. PRD 상태를 "⚠️ AnalystAgent 미적용"으로 변경

---

### Issue #3: Phase 별 기능 실제 활성화 여부

**심각도**: 🟠 **Medium**

PRD v0.3은 "Enterprise 플랜 = Phase 2 = 3-Way"라고 명시하지만, 실제로 플랜에 따른 Cross-Check 모드 전환이 **자동으로 이루어지지 않습니다**.

**근거 코드:**

```typescript
// types/auth.ts:42-49
enterprise: {
  crossCheckMode: "phase_2",  // 정의만 되어 있음
}
```

이 값이 Worker에 전달되어 `ANALYSIS_MODE`로 설정되는 경로가 불분명합니다.

**CTO 의견:**
> "사용자 플랜 정보가 Worker에 전달되는 경로를 확인해야 합니다. 현재는 환경변수 `ANALYSIS_MODE`로 전역 설정되는 것으로 보이며, 사용자별 플랜 기반 동적 전환은 미구현일 가능성이 높습니다."

**권장 조치:**
1. 업로드 시 사용자 플랜 조회 → Job에 mode 포함
2. Worker에서 mode 파라미터 우선 적용
3. PRD에 "플랜별 자동 전환 미구현" 명시

---

### Issue #4: Appendix 가격 불일치 재언급

**심각도**: 🟡 **Low** (문서 내 중복 불일치)

PRD v0.3 Section 11.1 Appendix에서 `types/auth.ts` 코드를 그대로 인용하면서 Section 6.1과 다른 가격을 보여줍니다:

```markdown
## 6.1. 요금제
| **Starter** | 무료 | ...

## 11.1. 요금제 상수
starter: { price: 79000, ... },  // ← 무료가 아님!
```

**CPO 의견:**
> "동일 문서 내에서 가격이 다르게 기재되어 있어 혼란을 야기합니다."

---

### Issue #5: "Production Ready" vs 실제 운영 준비도

**심각도**: 🟡 **Medium**

PRD v0.3은 대부분의 기능을 "✅ Production Ready"로 표기했으나:

1. **E2E 테스트 미완료** (문서 자체가 "8h 필요"라고 명시)
2. **Sentry 통합** 상태 불명 (config 확인 필요)
3. **Rate Limiting** 실제 적용 여부 검증 필요

**CTO 의견:**
> "'Production Ready'는 QA 완료, 모니터링 설정, 장애 대응 플레이북이 갖춰진 상태를 의미합니다. 테스트 미완료 상태에서는 'Feature Complete'가 더 정확합니다."

---

## ✅ 정확하게 반영된 항목 (Verified)

| 항목 | 검증 결과 | 코드 근거 |
|------|----------|----------|
| Blind Export API 구현 | ✅ 정확 | `export/route.ts` 542줄 |
| HWP 3단계 Fallback | ✅ 정확 | `hwp_parser.py` 한컴 API 포함 |
| Claude 클라이언트 | ✅ 정확 | `llm_manager.py` AsyncAnthropic |
| Paddle 클라이언트 | ✅ 정확 | `lib/paddle/client.ts` |
| AI 검토 UI | ✅ 정확 | `CandidateReviewPanel.tsx` 642줄 |
| DB 스키마 | ✅ 정확 | 11개 테이블 확인 |
| Consent Flow | ✅ 정확 | `middleware.ts` 검증 |
| Hybrid Search | ✅ 정확 | `search/route.ts` 722줄 |

---

## 📋 최종 판정

### CPO 의견

> **"PRD v0.3은 V0.2 대비 95% 개선되었습니다.** 그러나 가격 불일치는 반드시 수정해야 합니다. 고객이 UI에서 보는 가격과 실제 결제 가격이 다르면 법적 문제가 발생할 수 있습니다.
>
> 또한 '3-Way Cross-Check ✅ 코드 완료'라는 표현은 오해의 소지가 있습니다. 정확히 말하면 'LLM Manager에서 지원하나, AnalystAgent에서 미적용'입니다."

### CTO 의견

> **"기술적으로 Critical한 버그는 없으나, 문서와 코드의 일관성 문제가 있습니다.**
>
> 1. 가격 상수 통합 필요 (DRY 원칙 위반)
> 2. `AnalystAgent` Phase 2 로직 누락
> 3. 'Production Ready' 대신 'Feature Complete' 권장
>
> V0.3 승인 전 위 3가지 수정을 권고합니다."

---

## 🎯 수정 권고사항

### Priority 1: 가격 통합 (Critical)

```typescript
// lib/pricing.ts (신규 생성)
export const PRICING = {
  starter: { price: 0, credits: 50, blindExportLimit: 30 },
  pro: { price: 49000, credits: 150, blindExportLimit: Infinity },
  enterprise: { price: 99000, credits: 300, blindExportLimit: Infinity },
};

// types/auth.ts, lib/paddle/config.ts에서 import하여 사용
```

### Priority 2: AnalystAgent 수정 (High)

```python
# apps/worker/agents/analyst_agent.py:178-193
def _get_providers(self, mode: AnalysisMode) -> List[LLMProvider]:
    available = self.llm_manager.get_available_providers()
    
    if mode == AnalysisMode.PHASE_1:
        required = [LLMProvider.OPENAI, LLMProvider.GEMINI]
    else:  # PHASE_2
        required = [LLMProvider.OPENAI, LLMProvider.GEMINI, LLMProvider.CLAUDE]
    
    providers = [p for p in required if p in available]
    
    if not providers:
        if available:
            return available[:1]
        raise ValueError("No LLM providers available")
    
    return providers
```

### Priority 3: PRD 문구 수정 (Medium)

| 현재 | 수정 |
|------|------|
| AI Cross-Check (3-Way) \| 100% \| ✅ 코드 완료 | AI Cross-Check (3-Way) \| 80% \| ⚠️ LLM 지원됨, AnalystAgent 미적용 |
| ✅ Production Ready | ✅ Feature Complete (E2E 테스트 필요) |
| 가격 표 2개 | 가격 표 1개 + Appendix에서 참조만 |

---

## 📌 결론

| 항목 | 판정 |
|------|------|
| **PRD v0.3 승인 여부** | 🟠 **조건부 승인** |
| **필수 수정 사항** | 3건 (가격, AnalystAgent, 문구) |
| **권장 수정 사항** | 2건 (Production Ready 표기, E2E 테스트) |

---

*검토일: 2026-01-13*
*CPO: FAANG Product Executive*
*CTO: Senior Technical Architect*
