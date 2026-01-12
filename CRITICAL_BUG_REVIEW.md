# Critical Bug Fix Review

**Reviewers**: Senior PM + Senior Engineer (Silicon Valley)
**Date**: 2026-01-13
**Status**: Review Complete

---

## Senior Product Manager Review

### BUG-H1-01: 한영 경계 분리

#### What's Good
- 핵심 사용자 pain point 해결 (한국 헤드헌터의 자연스러운 검색 패턴)
- 기존 동작 하위 호환성 유지 (공백/쉼표 분리는 그대로)

#### Concerns & Gaps

| # | 이슈 | 비즈니스 영향 | 권장 조치 |
|---|------|--------------|----------|
| 1 | **사용자에게 분리 결과 미표시** | 사용자가 "React개발자"가 어떻게 검색되는지 모름 | 검색창 아래 "검색어: React, 개발자" 표시 |
| 2 | **숫자+한글 미처리** | "5년차 개발자"에서 "5년차"가 분리 안됨 | 숫자+한글 경계도 분리 검토 |
| 3 | **역방향 학습 기회 놓침** | 검색 로그로 어떤 패턴이 많은지 분석 안함 | 분리 전/후 쿼리 로깅 추가 |

#### PM Verdict
> 기술적으로 해결됐지만, **사용자가 이 기능을 인지하지 못함**.
> "React개발자"로 검색해서 결과가 나오면 "왜 되지?" 의문.
> **피드백 루프 없는 개선**은 반쪽짜리.

---

### BUG-H3-01: Null Byte 필터링 + DoS 방지

#### What's Good
- 보안 취약점 선제 대응
- 100개 제한은 실제 사용 케이스에 충분

#### Concerns & Gaps

| # | 이슈 | 비즈니스 영향 | 권장 조치 |
|---|------|--------------|----------|
| 1 | **100개 제한 사용자 미고지** | 101번째 스킬부터 잘림 → 데이터 누락 | 업로드 시 경고 또는 상세 페이지 표시 |
| 2 | **Magic Number** | 왜 100인지 근거 부재 | 데이터 분석 후 P95 기준 설정 |
| 3 | **데이터 정합성** | DB에는 150개, 검색에는 100개 → 불일치 | 업로드 단계에서 제한 권장 |

#### PM Verdict
> 보안은 OK, 그러나 **데이터 잘림에 대한 사용자 커뮤니케이션 부재**.
> 헤드헌터가 "왜 이 후보자 스킬이 덜 보이지?" 의문 가질 수 있음.

---

## Senior Engineer Review

### BUG-H1-01: 한영 경계 분리 Regex

#### Code Quality

```typescript
.split(/[\s,]+|(?<=[가-힣])(?=[a-zA-Z])|(?<=[a-zA-Z])(?=[가-힣])/)
```

| 항목 | 평가 | 상세 |
|------|------|------|
| 정확성 | ⚠️ | Lookbehind는 ES2018+, 일부 환경 미지원 가능 |
| 성능 | ⚠️ | Lookbehind/Lookahead는 일반 split보다 느림 |
| 유지보수 | ❌ | 복잡한 regex, 주석 없으면 이해 어려움 |
| 테스트 | ❌ | 단위 테스트 없음 |

#### Technical Debt & Risks

1. **Regex Compatibility**
   ```
   // Node.js 10 미만, 일부 브라우저에서 에러 가능
   // Safari 16.3 이하: Lookbehind 미지원
   ```

2. **Edge Cases 미처리**
   ```typescript
   "React.js개발자"  // → ["React.js개발자"] (점 때문에 미분리)
   "C++개발자"       // → ["C++개발자"] (특수문자 때문에 미분리)
   "iOS개발자"       // → ["iOS개발자"] (대문자S 후 한글이지만...)
   ```

3. **중복 코드 위험**
   - 같은 regex가 여러 곳에서 필요할 수 있음
   - 유틸 함수로 추출 필요

#### Recommended Refactor

```typescript
// lib/search/query-parser.ts

/**
 * Mixed Language Query Parser
 * 한영 혼합 쿼리를 개별 토큰으로 분리
 *
 * @example
 * "React개발자" → ["React", "개발자"]
 * "시니어 Developer" → ["시니어", "Developer"]
 */
export function parseSearchQuery(query: string): string[] {
  // 1. 기본 분리 (공백, 쉼표)
  // 2. 한영 경계 분리
  // 3. 정제 (빈 문자열 제거, 길이 제한)

  const KOREAN_ENGLISH_BOUNDARY = /(?<=[가-힣])(?=[a-zA-Z])|(?<=[a-zA-Z])(?=[가-힣])/;
  const WHITESPACE_COMMA = /[\s,]+/;

  return query
    .split(WHITESPACE_COMMA)
    .flatMap(token => token.split(KOREAN_ENGLISH_BOUNDARY))
    .map(t => t.trim())
    .filter(t => t.length > 0 && t.length <= 50);
}

// 단위 테스트 필수
describe('parseSearchQuery', () => {
  it('separates Korean-English boundary', () => {
    expect(parseSearchQuery('React개발자')).toEqual(['React', '개발자']);
  });

  it('handles special characters', () => {
    expect(parseSearchQuery('C++개발자')).toEqual(['C++', '개발자']); // 또는 다른 예상 동작
  });
});
```

---

### BUG-H3-01: Null Byte 필터링 + DoS 방지

#### Code Quality

```typescript
skills: ((row.skills as string[]) ?? [])
  .slice(0, 100)
  .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
  .map(s => s.replace(/\u0000/g, "")),
```

| 항목 | 평가 | 상세 |
|------|------|------|
| 정확성 | ✅ | Null byte 제거 정상 동작 |
| 성능 | ⚠️ | 3번 순회 (slice → filter → map), 체이닝 최적화 가능 |
| 일관성 | ❌ | 같은 로직이 2곳에 중복 (toSearchResult, calculateFacets) |
| 상수 관리 | ❌ | 100이 하드코딩됨 |

#### Technical Debt & Risks

1. **DRY 원칙 위반**
   ```typescript
   // toSearchResult에서:
   .slice(0, 100).filter(...).map(s => s.replace(/\u0000/g, ""))

   // calculateFacets에서:
   .slice(0, 100) ... skill.trim().replace(/\u0000/g, "")

   // → 나중에 하나만 수정하면 불일치 발생
   ```

2. **Magic Number**
   ```typescript
   .slice(0, 100)  // 왜 100? 50? 200?
   normalizedSkill.length <= 100  // 또 100?
   ```

3. **Null byte만 제거?**
   ```typescript
   // 다른 제어 문자는?
   // \u0001-\u001F (제어 문자)
   // \u007F (DEL)
   // \u200B (Zero-width space)
   ```

#### Recommended Refactor

```typescript
// lib/search/sanitize.ts

const MAX_SKILLS_COUNT = 100;
const MAX_SKILL_LENGTH = 100;

/**
 * 위험한 제어 문자 제거
 * - Null byte (\u0000)
 * - 기타 제어 문자 (\u0001-\u001F, \u007F)
 * - Zero-width 문자
 */
const DANGEROUS_CHARS = /[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g;

export function sanitizeSkill(skill: unknown): string | null {
  if (typeof skill !== "string") return null;

  const sanitized = skill.trim().replace(DANGEROUS_CHARS, "");

  if (sanitized.length === 0 || sanitized.length > MAX_SKILL_LENGTH) {
    return null;
  }

  return sanitized;
}

export function sanitizeSkillsArray(skills: unknown): string[] {
  if (!Array.isArray(skills)) return [];

  return skills
    .slice(0, MAX_SKILLS_COUNT)
    .map(sanitizeSkill)
    .filter((s): s is string => s !== null);
}

// 사용
skills: sanitizeSkillsArray(row.skills),
```

---

## Cross-Cutting Concerns

### 1. 테스트 부재

| 수정 사항 | 단위 테스트 | 통합 테스트 | E2E 테스트 |
|----------|------------|------------|-----------|
| 한영 경계 분리 | ❌ | ❌ | ❌ |
| Null byte 필터링 | ❌ | ❌ | ❌ |
| 배열 길이 제한 | ❌ | ❌ | ❌ |

**Risk**: 리팩토링 시 regression 발생 가능

### 2. 모니터링 부재

```typescript
// 권장: 메트릭 추가
metrics.increment('search.query.korean_english_split', {
  original_length: query.length,
  token_count: keywords.length,
});

metrics.increment('search.skills.truncated', {
  original_count: row.skills?.length,
  truncated_count: 100,
});
```

### 3. Feature Flag 부재

```typescript
// 권장: 점진적 롤아웃
if (featureFlags.isEnabled('mixed_language_query')) {
  // 새 로직
} else {
  // 기존 로직
}
```

---

## Action Items

### Immediate (이번 PR에 추가)

| # | 항목 | 담당 | 예상 공수 |
|---|------|------|----------|
| 1 | 상수 추출 (MAX_SKILLS_COUNT 등) | Engineer | 15m |
| 2 | 중복 로직 유틸 함수 추출 | Engineer | 30m |
| 3 | 기본 단위 테스트 추가 | Engineer | 1h |

### Next Sprint

| # | 항목 | 담당 | 예상 공수 |
|---|------|------|----------|
| 1 | 검색어 분리 결과 UI 표시 | PM + FE | 4h |
| 2 | 제어 문자 전체 필터링 확장 | Engineer | 1h |
| 3 | 메트릭/로깅 추가 | Engineer | 2h |
| 4 | 통합 테스트 추가 | QA | 4h |

### Backlog

| # | 항목 |
|---|------|
| 1 | Feature flag 도입 |
| 2 | 숫자+한글 경계 분리 |
| 3 | 스킬 100개 초과 시 사용자 알림 |

---

## Final Verdict

| Role | Approval | Condition |
|------|----------|-----------|
| **PM** | ⚠️ Conditional | 사용자 피드백 루프 추가 시 OK |
| **Engineer** | ⚠️ Conditional | 테스트 + 유틸 함수 추출 시 OK |

### Summary

> 버그 자체는 수정되었으나, **Production-Ready 수준**에는 미달.
>
> 1. **중복 코드** → 유지보수 부채
> 2. **테스트 부재** → Regression 위험
> 3. **사용자 투명성 부재** → UX 반쪽짜리
>
> 권장: 위 Immediate 항목 완료 후 배포

---

*Review by Senior PM & Senior Engineer*
*"Ship fast, but ship right"*
