# E2E 테스트 요청: 3-Way Cross-Check 기능

**요청일:** 2026-01-13
**요청자:** Development Team
**우선순위:** High
**관련 PRD:** prd_refund_policy_v0.4.md

---

## 1. 변경 사항 요약

### 수정된 파일
- `apps/worker/agents/analyst_agent.py` (라인 244-389)

### 변경 내용
`_merge_responses()` 메서드에 3-Way Cross-Check (다수결) 로직 추가:

| 모드 | 플랜 | LLM 사용 | 검증 방식 |
|------|------|----------|-----------|
| Phase 1 (2-Way) | Starter | GPT-4o + Gemini | 2개 비교 |
| Phase 2 (3-Way) | Pro | GPT-4o + Gemini + Claude | 다수결 |

### 신뢰도 점수 계산
- **3개 모두 일치:** 1.0
- **2개 일치, 1개 불일치:** 0.85 (다수결 채택)
- **3개 모두 불일치:** 0.4 (경고 발생)

---

## 2. 테스트 시나리오

### 시나리오 1: Starter 플랜 - 2-Way 검증
**전제조건:**
- Starter 플랜 사용자 계정
- OPENAI_API_KEY, GEMINI_API_KEY 설정됨

**테스트 단계:**
1. Starter 플랜 계정으로 로그인
2. 이력서 파일 업로드 (PDF/DOCX)
3. 분석 완료 대기

**예상 결과:**
- Worker 로그: `[AnalystAgent] 2-Way Cross-Check 모드 (GPT + Gemini)`
- `analysis_mode: "phase_1"` 저장
- Claude API 호출 없음

---

### 시나리오 2: Pro 플랜 - 3-Way 검증 (정상 케이스)
**전제조건:**
- Pro 플랜 사용자 계정
- OPENAI_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY 설정됨

**테스트 단계:**
1. Pro 플랜 계정으로 로그인
2. 이력서 파일 업로드 (명확한 정보가 있는 이력서)
3. 분석 완료 대기

**예상 결과:**
- Worker 로그: `[AnalystAgent] 3-Way Cross-Check 모드 (GPT + Gemini + Claude)`
- `analysis_mode: "phase_2"` 저장
- 3개 LLM 모두 호출 확인
- 신뢰도 점수 0.85 이상

---

### 시나리오 3: Pro 플랜 - 3-Way 다수결 적용
**전제조건:**
- Pro 플랜 사용자 계정
- 일부 정보가 모호한 이력서 (예: 약어로 된 이름)

**테스트 단계:**
1. Pro 플랜 계정으로 로그인
2. 모호한 정보가 포함된 이력서 업로드
3. 분석 완료 후 warnings 확인

**예상 결과:**
- `warnings`에 `mismatch_resolved` 타입 경고 포함
- 다수결로 선택된 값이 최종 결과에 반영

---

### 시나리오 4: Pro 플랜 - Claude 미설정 시 Fallback
**전제조건:**
- Pro 플랜 사용자 계정
- ANTHROPIC_API_KEY 미설정 또는 잘못된 키

**테스트 단계:**
1. ANTHROPIC_API_KEY 제거 또는 무효화
2. Pro 플랜 계정으로 이력서 업로드
3. 분석 완료 확인

**예상 결과:**
- Claude 호출 실패해도 분석 완료
- 2-Way (GPT + Gemini) 결과로 Fallback
- `warnings`에 Claude API 에러 경고 포함

---

### 시나리오 5: 크리티컬 필드 검증
**검증 대상 필드:**
- `name` (이름)
- `phone` (전화번호)
- `email` (이메일)

**테스트 단계:**
1. Pro 플랜으로 이력서 분석
2. DB에서 `candidates` 테이블의 결과 확인
3. `processing_jobs` 테이블의 `confidence_score` 확인

**예상 결과:**
- 크리티컬 필드가 정확히 추출됨
- 3개 LLM 일치 시 confidence_score ≥ 0.9

---

### 시나리오 6: 3-Way 불일치 자동 환불 (신규)
**전제조건:**
- Pro 플랜 사용자 계정
- 이름/연락처가 모호한 이력서 (예: 손글씨 스캔, 비정형 포맷)

**테스트 단계:**
1. Pro 플랜 계정으로 로그인
2. 3개 LLM이 다르게 해석할 가능성이 높은 이력서 업로드
3. 분석 완료 후 confidence_score 확인
4. confidence < 0.5 인 경우 자동 환불 처리 확인

**예상 결과:**
- confidence < 0.5 → 자동 환불 대상 (`reason: "three_way_disagree"`)
- `refund_requests` 테이블에 환불 요청 생성
- 크레딧 복구 확인

**환불 정책 참고:**
| 조건 | Threshold | 적용 |
|------|-----------|------|
| 필드 누락 | confidence < 0.3 AND 2개+ 누락 | 모든 플랜 |
| **3-Way 불일치** | **confidence < 0.5 AND phase_2** | **Pro만** |

---

### 시나리오 7: Starter 플랜 - 3-Way 조건 미적용 확인
**전제조건:**
- Starter 플랜 사용자 계정

**테스트 단계:**
1. Starter 플랜 계정으로 이력서 업로드
2. confidence 0.4 결과 발생 시

**예상 결과:**
- 자동 환불 **미적용** (0.4 >= 0.3 이므로 기존 규칙에 의해 환불 안 됨)
- Starter는 2-Way만 사용하므로 3-Way 불일치 조건 해당 안 됨

---

## 3. 검증 포인트

### 로그 확인 (Worker)
```
[AnalystAgent] Starting Optimized Analysis (Mode: phase_2)
[AnalystAgent] Calling 3 providers: ['openai', 'gemini', 'claude']
[AnalystAgent] 3-Way Cross-Check 모드 (GPT + Gemini + Claude)
```

### DB 확인
```sql
-- processing_jobs 테이블
SELECT id, analysis_mode, confidence_score, status
FROM processing_jobs
WHERE user_id = '<pro_user_id>'
ORDER BY created_at DESC
LIMIT 5;

-- 예상: analysis_mode = 'phase_2', confidence_score >= 0.85
```

### API 확인
```bash
# 분석 결과 조회
GET /api/candidates/<id>

# 예상 응답에 포함:
# - mode: "phase_2"
# - warnings: [] 또는 mismatch 관련 경고
```

---

## 4. 환경 설정

### 필수 환경변수
```env
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Worker 실행
```bash
cd apps/worker
python main.py
```

---

## 5. 예상 리스크

| 리스크 | 영향 | 완화 방안 |
|--------|------|-----------|
| Claude API 비용 증가 | Pro 플랜만 해당 | Pro 가격에 반영됨 |
| Claude 타임아웃 | 분석 지연 | 2분 타임아웃 설정됨 |
| 3개 모두 불일치 | 낮은 신뢰도 | 경고 표시, 수동 검토 권장 |

---

## 6. 승인

- [ ] QA 테스트 완료
- [ ] 모든 시나리오 PASS
- [ ] 성능 영향 확인 (분석 시간)
- [ ] 비용 영향 확인 (Claude API 호출)

---

**문의:** Development Team
**긴급 연락:** Slack #dev-qa
