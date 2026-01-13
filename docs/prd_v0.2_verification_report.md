# PRD v0.2 검증 보고서

## 📋 Technical Architect Review Request

| 문서 | 발견 일시 | 보고자 |
|------|----------|--------|
| `docs/rai_prd_v0.2.md` | 2026-01-13 21:45 KST | Senior Engineer |

---

## 🚨 CRITICAL: PRD v0.2와 코드베이스 불일치 내역

PRD v0.2 문서에 **심각한 오류**가 발견되었습니다. 아래 항목들은 "미구현" 또는 "부분 구현"으로 잘못 분류되어 있으나, **실제로는 완전히 구현되어 있습니다**.

---

## 1. Blind Export (블라인드 내보내기)

### PRD v0.2 기술 내용 (❌ 오류)

```markdown
#### 2.2.4. Blind Export
| 블라인드 이력서 생성 | 개인정보 마스킹 버전 | 🟡 DB 스키마만 존재 |
| PDF 내보내기 | 마스킹된 PDF 생성 | ❌ 미구현 |
| 월간 제한 | Starter 30회, Pro 무제한 | ❌ 미구현 |
```

### 실제 구현 상태 (✅ 완전 구현)

| 파일 | 구현 내용 |
|------|----------|
| `app/api/candidates/[id]/export/route.ts` | 542줄의 완전한 Blind Export API |
| `app/(dashboard)/candidates/[id]/page.tsx:393-394` | `handleBlindExport` 핸들러 |
| `supabase/migrations/003_blind_exports.sql` | DB 스키마 + RLS + 함수 |
| `types/auth.ts:18,31,39,47` | `blindExportLimit` 플랜별 설정 |

**구현된 기능:**
- ✅ 연락처 완전 마스킹 (`[연락처 비공개]`, `[이메일 비공개]`)
- ✅ HTML 템플릿 생성 (클라이언트에서 PDF 변환)
- ✅ 월별 내보내기 횟수 제한 (`get_monthly_blind_export_count` RPC)
- ✅ 내보내기 기록 저장 (`blind_exports` 테이블)
- ✅ IP 익명화 (`anonymizeIP` 함수)
- ✅ 플랜별 제한 (Starter: 30회, Pro/Enterprise: 무제한)

---

## 2. HWP 3단계 Fallback

### PRD v0.2 기술 내용 (❌ 오류)

```markdown
| 1차: olefile | 직접 파싱 | ✅ 구현됨 |
| 2차: LibreOffice | HWP→PDF 변환 | ⚠️ 코드 존재, 미검증 |
| 3차: 한컴 API | 유료 백업 | ❌ 미구현 |
```

### 실제 구현 상태 (✅ 3단계 완전 구현)

| 파일 | 라인 | 구현 내용 |
|------|------|----------|
| `apps/worker/utils/hwp_parser.py` | 65-154 | `parse()` 메서드 - 3단계 Fallback 로직 |
| `apps/worker/utils/hwp_parser.py` | 156-179 | `_parse_hwpx_direct()` - HWPX 직접 파싱 |
| `apps/worker/utils/hwp_parser.py` | 181-217 | `_parse_hwp_direct()` - HWP(OLE) 직접 파싱 |
| `apps/worker/utils/hwp_parser.py` | 272-318 | `_parse_via_libreoffice()` - LibreOffice 변환 |
| `apps/worker/utils/hwp_parser.py` | 320-450 | `_parse_via_hancom_api()` - **한컴 API 완전 구현** |

**한컴 API 구현 상세:**
```python
# apps/worker/utils/hwp_parser.py:320-450
def _parse_via_hancom_api(self, file_bytes: bytes) -> Tuple[str, int]:
    # Step 1: 파일 업로드 및 변환 요청
    # Step 2: 변환 완료 대기 (폴링)
    # Step 3: 변환된 PDF 다운로드
    # Step 4: PDF에서 텍스트 추출
```

---

## 3. Paddle 결제 연동

### PRD v0.2 기술 내용 (❌ 오류)

```markdown
| Paddle 연동 | 구독 관리 | 🟡 스키마만 존재 |
```

### 실제 구현 상태 (✅ 클라이언트 구현 완료)

| 파일 | 구현 내용 |
|------|----------|
| `lib/paddle/client.ts` | Paddle.js 클라이언트 초기화, Checkout 열기 |
| `lib/paddle/config.ts` | Paddle 환경 설정, 플랜별 priceId, API 엔드포인트 |

**구현된 기능:**
- ✅ Paddle SDK 초기화 (`@paddle/paddle-js`)
- ✅ 싱글톤 패턴 (`getPaddleInstance()`)
- ✅ Checkout 오버레이 (`openCheckout()`)
- ✅ 한국 로케일 지원 (`locale: 'ko'`)
- ✅ 다크 테마
- ✅ 플랜별 priceId 매핑

**미구현 부분:**
- Webhook 처리 (서버 사이드)
- 구독 상태 동기화

---

## 4. Claude (3-Way Cross-Check)

### PRD v0.2 기술 내용 (❌ 오류)

```markdown
| Claude 3.5 연동 | Enterprise 전용 | ❌ 미구현 |
| 3-Way 비교 로직 | 다수결 채택 | ❌ 미구현 |
```

### 실제 구현 상태 (✅ 클라이언트 완전 구현)

| 파일 | 라인 | 구현 내용 |
|------|------|----------|
| `apps/worker/services/llm_manager.py` | 103-118 | Claude 클라이언트 초기화 (`AsyncAnthropic`) |
| `apps/worker/services/llm_manager.py` | 443-507 | `_call_claude_json()` 메서드 |
| `apps/worker/services/llm_manager.py` | 659-716 | `_call_claude_text()` 메서드 |
| `apps/worker/services/llm_manager.py` | 124 | 모델 설정 (`claude-3-5-sonnet-20241022`) |

**구현된 기능:**
- ✅ AsyncAnthropic 클라이언트
- ✅ 타임아웃 설정 (120초)
- ✅ JSON 모드 지원
- ✅ 텍스트 모드 지원
- ✅ 토큰 사용량 추적
- ✅ system/user 메시지 분리

**Phase 2 활성화 조건:**
- `ANTHROPIC_API_KEY` 환경 변수 설정
- `AnalysisMode.PHASE_2` 모드 사용

---

## 5. AI 검토 UI

### PRD v0.2 기술 내용 (❌ 오류)

```markdown
| 필드별 수정 UI | EditableField 컴포넌트 | 🟡 기본 구현 |
| 모델 간 불일치 표시 | 툴팁으로 상세 표시 | ❌ 미구현 |
```

### 실제 구현 상태 (✅ 고급 기능 포함)

| 파일 | 구현 내용 |
|------|----------|
| `components/review/CandidateReviewPanel.tsx` (642줄) | 완전한 검토 UI |
| `components/review/EditableField.tsx` (222줄) | 필드별 편집 컴포넌트 |
| `components/review/ReviewBanner.tsx` | 검토 배너 |

**구현된 고급 기능:**
- ✅ `FieldConfidenceSummary` 컴포넌트 (신뢰도 분포 시각화)
- ✅ 필드별 신뢰도 Progress Bar
- ✅ 낮은 신뢰도 필드 하이라이트 (80% 미만)
- ✅ 경고 메시지 표시
- ✅ Optimistic Update (저장 버튼 연타 방지)
- ✅ 변경사항 롤백 기능
- ✅ 경력 기간 자동 계산 (`calculateTotalExperience`)

---

## 📋 수정 필요 항목 요약

### PRD v0.2 문서 수정 필요

| 항목 | PRD v0.2 상태 | 실제 상태 | 수정 필요 |
|------|--------------|----------|----------|
| Blind Export | ❌ 미구현 | ✅ **완전 구현** | 🔴 Critical |
| HWP 3단계 Fallback | ⚠️ 2단계까지 | ✅ **3단계 완료** | 🔴 Critical |
| Paddle 클라이언트 | 🟡 스키마만 | ✅ **클라이언트 구현** | 🟠 High |
| Claude 연동 | ❌ 미구현 | ✅ **완전 구현** | 🔴 Critical |
| AI 검토 UI | 🟡 기본 구현 | ✅ **고급 기능 포함** | 🟠 High |

---

## ✅ 실제 미구현 항목 (정확한 목록)

PRD v6.0 대비 실제로 미구현된 항목:

| 영역 | 기능 | 상태 | 비고 |
|------|------|------|------|
| **결제** | Webhook 처리 | ❌ 미구현 | 서버 사이드 필요 |
| **결제** | 구독 상태 동기화 | ❌ 미구현 | Webhook 의존 |
| **결제** | Auto-Reload | ❌ 미구현 | |
| **결제** | Overage Billing | ❌ 미구현 | |
| **결제** | Stripe 연동 | ❌ 미구현 | Paddle로 대체 |
| **분석** | 3-Way 실제 활성화 | 🟡 비활성 | Phase 2 설정 필요 |
| **Sales Radar** | 채용공고 크롤링 | ❌ 미구현 | Phase 2 로드맵 |
| **Sales Radar** | 공고-후보자 매칭 | ❌ 미구현 | Phase 2 로드맵 |
| **Team CRM** | 다중 사용자 | ❌ 미구현 | Phase 2 로드맵 |

---

## 🎯 권장 조치

### 1. PRD v0.2 즉시 수정 (Priority: CRITICAL)

`docs/rai_prd_v0.2.md` 문서의 다음 섹션들을 코드베이스와 일치하도록 수정:

1. **Section 2.2** (Gap Analysis) - 구현 상태 정정
2. **Section 8.1** (Phase 1 Status) - Blind Export/Payment 상태 정정
3. **Gap Summary** - 구현 완료 항목 이동

### 2. 기능 활성화 검토 (Priority: HIGH)

현재 코드는 있으나 비활성화된 기능:
- Claude 3-Way Cross-Check (`ANTHROPIC_API_KEY` 설정 필요)
- 한컴 API (`HANCOM_API_KEY` 설정 필요)

### 3. Phase 1 완료를 위한 실제 남은 작업

1. Paddle Webhook 처리 구현
2. 구독 상태 동기화
3. E2E 테스트

---

## 📎 참조 파일 목록

```
d:\RAI\app\api\candidates\[id]\export\route.ts
d:\RAI\apps\worker\utils\hwp_parser.py
d:\RAI\lib\paddle\client.ts
d:\RAI\lib\paddle\config.ts
d:\RAI\apps\worker\services\llm_manager.py
d:\RAI\components\review\CandidateReviewPanel.tsx
d:\RAI\components\review\EditableField.tsx
d:\RAI\types\auth.ts
d:\RAI\supabase\migrations\003_blind_exports.sql
```

---

*이 보고서는 코드베이스 상세 분석을 기반으로 작성되었습니다.*
*검토 요청: Senior Technical Architect*
