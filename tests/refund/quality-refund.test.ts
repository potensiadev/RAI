/**
 * 품질 환불 단위 테스트
 *
 * PRD: prd_refund_policy_v0.4.md
 * QA: refund_policy_test_scenarios_v1.0.md
 *
 * 커버리지: EC-001 ~ EC-025, EC-063 ~ EC-070
 */

import {
  checkQualityRefundCondition,
  isFullRefundEligible,
  calculateRefund,
  REFUND_CONFIG,
} from "@/lib/refund/config";

describe("Quality Refund - checkQualityRefundCondition", () => {
  describe("EC-001 ~ EC-010: Confidence Score 엣지 케이스", () => {
    test("EC-001: confidence = null → 0으로 처리, 환불 대상", () => {
      const result = checkQualityRefundCondition(null, {
        name: null,
        phone: null,
        email: null,
        last_company: null,
      });
      expect(result.confidence).toBe(0);
      expect(result.eligible).toBe(true);
    });

    test("EC-002: confidence = undefined → 0으로 처리, 환불 대상", () => {
      const result = checkQualityRefundCondition(undefined, {
        name: null,
        phone: null,
        email: null,
        last_company: null,
      });
      expect(result.confidence).toBe(0);
      expect(result.eligible).toBe(true);
    });

    test("EC-003: confidence = 0 → 환불 대상 (0 < 0.3)", () => {
      const result = checkQualityRefundCondition(0, {
        name: null,
        phone: null,
        email: null,
        last_company: null,
      });
      expect(result.eligible).toBe(true);
    });

    test("EC-004: confidence = 0.29999 → 환불 대상 (0.29999 < 0.3)", () => {
      const result = checkQualityRefundCondition(0.29999, {
        name: null,
        phone: null,
        email: null,
        last_company: null,
      });
      expect(result.eligible).toBe(true);
    });

    test("EC-005: confidence = 0.3 (정확히) → 환불 안 됨 (0.3 >= 0.3)", () => {
      const result = checkQualityRefundCondition(0.3, {
        name: null,
        phone: null,
        email: null,
        last_company: null,
      });
      expect(result.eligible).toBe(false);
    });

    test("EC-006: confidence = 0.30001 → 환불 안 됨", () => {
      const result = checkQualityRefundCondition(0.30001, {
        name: null,
        phone: null,
        email: null,
        last_company: null,
      });
      expect(result.eligible).toBe(false);
    });

    test("EC-007: confidence = -0.1 (음수) → 환불 대상 (-0.1 < 0.3)", () => {
      const result = checkQualityRefundCondition(-0.1, {
        name: null,
        phone: null,
        email: null,
        last_company: null,
      });
      expect(result.eligible).toBe(true);
    });

    test("EC-008: confidence = 1.5 (범위 초과) → 환불 안 됨", () => {
      const result = checkQualityRefundCondition(1.5, {
        name: "홍길동",
        phone: "010-1234-5678",
        email: null,
        last_company: "삼성전자",
      });
      expect(result.eligible).toBe(false);
    });

    test("EC-010: confidence = NaN → 0으로 처리?", () => {
      // NaN은 JavaScript에서 falsy가 아니므로 ?? 연산자로 0이 되지 않음
      // 하지만 NaN >= 0.3은 false이므로 필드 검사로 진행
      const result = checkQualityRefundCondition(NaN, {
        name: null,
        phone: null,
        email: null,
        last_company: null,
      });
      // NaN >= 0.3 은 false이므로 필드 검사 진행, 모든 필드 누락 시 환불 대상
      expect(result.eligible).toBe(true);
    });
  });

  describe("EC-011 ~ EC-025: 필드 누락 엣지 케이스", () => {
    test("EC-011: name = 빈 문자열 → 누락으로 처리", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: "",
        phone: null,
        email: null,
        last_company: null,
      });
      expect(result.missingFields).toContain("name");
    });

    test("EC-012: name = 공백만 → 누락으로 처리 (trim 후)", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: "   ",
        phone: null,
        email: null,
        last_company: null,
      });
      expect(result.missingFields).toContain("name");
    });

    test("EC-013: phone = 빈 문자열, email = null → contact 누락", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: "홍길동",
        phone: "",
        email: null,
        last_company: "삼성전자",
      });
      expect(result.missingFields).toContain("contact");
    });

    test("EC-014: phone = null, email = 빈 문자열 → contact 누락", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: "홍길동",
        phone: null,
        email: "",
        last_company: "삼성전자",
      });
      expect(result.missingFields).toContain("contact");
    });

    test("EC-015: phone 형식 불량 → contact 존재로 처리", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: "홍길동",
        phone: "not-a-phone",
        email: null,
        last_company: "삼성전자",
      });
      expect(result.missingFields).not.toContain("contact");
    });

    test("EC-016: email 형식 불량 → contact 존재로 처리", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: "홍길동",
        phone: null,
        email: "not-an-email",
        last_company: "삼성전자",
      });
      expect(result.missingFields).not.toContain("contact");
    });

    test("EC-017: last_company = 빈 문자열 → 누락으로 처리", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: "홍길동",
        phone: "010-1234-5678",
        email: null,
        last_company: "",
      });
      expect(result.missingFields).toContain("last_company");
    });

    test("EC-019: quick_data 전체 null → 모든 필드 누락 (3개)", () => {
      const result = checkQualityRefundCondition(0.25, null);
      expect(result.missingFields).toEqual(["name", "contact", "last_company"]);
      expect(result.eligible).toBe(true);
    });

    test("EC-020: quick_data 없음 → 모든 필드 누락 (3개)", () => {
      const result = checkQualityRefundCondition(0.25, undefined);
      expect(result.missingFields).toEqual(["name", "contact", "last_company"]);
      expect(result.eligible).toBe(true);
    });

    test("EC-021: 필드 1개만 누락 (name) → 환불 안 됨", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: null,
        phone: "010-1234-5678",
        email: null,
        last_company: "삼성전자",
      });
      expect(result.missingFields).toEqual(["name"]);
      expect(result.eligible).toBe(false);
    });

    test("EC-022: 필드 1개만 누락 (contact) → 환불 안 됨", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: "홍길동",
        phone: null,
        email: null,
        last_company: "삼성전자",
      });
      expect(result.missingFields).toEqual(["contact"]);
      expect(result.eligible).toBe(false);
    });

    test("EC-023: 필드 1개만 누락 (last_company) → 환불 안 됨", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: "홍길동",
        phone: "010-1234-5678",
        email: null,
        last_company: null,
      });
      expect(result.missingFields).toEqual(["last_company"]);
      expect(result.eligible).toBe(false);
    });

    test("EC-024: phone 있고 email 없음 → contact 존재", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: null,
        phone: "010-1234-5678",
        email: null,
        last_company: null,
      });
      expect(result.missingFields).not.toContain("contact");
      expect(result.missingFields).toContain("name");
      expect(result.missingFields).toContain("last_company");
    });

    test("EC-025: phone 없고 email 있음 → contact 존재", () => {
      const result = checkQualityRefundCondition(0.25, {
        name: null,
        phone: null,
        email: "test@test.com",
        last_company: null,
      });
      expect(result.missingFields).not.toContain("contact");
      expect(result.missingFields).toContain("name");
      expect(result.missingFields).toContain("last_company");
    });
  });

  describe("Scenario 2.1.2: 필드 누락 조합별 환불 여부", () => {
    test.each([
      [0.25, null, null, null, null, 3, true],
      [0.25, "홍길동", null, null, null, 2, true],
      [0.25, "홍길동", "010-1234-5678", null, null, 1, false],
      [0.25, "홍길동", null, "hong@test.com", null, 1, false],
      [0.25, null, "010-1234-5678", null, "삼성전자", 1, false],
      [0.25, null, null, "hong@test.com", "삼성전자", 1, false],
      [0.29, null, null, null, null, 3, true],
      // confidence >= threshold면 필드 검사 없이 early return (missingFields = 0)
      [0.3, null, null, null, null, 0, false],
      [0.31, null, null, null, null, 0, false],
    ])(
      "confidence=%p, name=%p, phone=%p, email=%p, last_company=%p → missing=%p, eligible=%p",
      (confidence, name, phone, email, lastCompany, expectedMissing, expectedEligible) => {
        const result = checkQualityRefundCondition(confidence, {
          name,
          phone,
          email,
          last_company: lastCompany,
        });
        expect(result.missingFields.length).toBe(expectedMissing);
        expect(result.eligible).toBe(expectedEligible);
      }
    );
  });
});

describe("Subscription Refund - isFullRefundEligible (Paddle 호환: 14일 무조건 전액환불)", () => {
  describe("EC-063 ~ EC-064: 14일 경계 테스트", () => {
    test("EC-063: 정확히 14일차 취소 → 전액 환불 대상", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 14);
      const result = isFullRefundEligible(startDate);
      expect(result).toBe(true);
    });

    test("EC-064: 15일차 취소 → 환불 불가", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 15);
      const result = isFullRefundEligible(startDate);
      expect(result).toBe(false);
    });

    test("7일 이내 취소 → 전액 환불 대상", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const result = isFullRefundEligible(startDate);
      expect(result).toBe(true);
    });

    test("1일차 취소 → 전액 환불 대상", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const result = isFullRefundEligible(startDate);
      expect(result).toBe(true);
    });

    test("크레딧 사용량과 무관하게 14일 이내면 전액 환불 (Paddle 정책)", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 10);
      // usedCredits 파라미터는 하위 호환성을 위해 유지되지만 무시됨
      const result = isFullRefundEligible(startDate, 100);
      expect(result).toBe(true);
    });
  });
});

describe("Subscription Refund - calculateRefund (Paddle 호환: 14일 무조건 전액환불)", () => {
  describe("EC-065 ~ EC-070: 14일 기준 환불 계산", () => {
    test("EC-065: 14일 이내 → 전액 환불", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 10);
      const result = calculateRefund({
        paymentAmount: 49000,
        subscriptionStartDate: startDate,
      });
      expect(result.eligible).toBe(true);
      expect(result.refundAmount).toBe(49000);
    });

    test("EC-066: 정확히 14일차 → 전액 환불", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 14);
      const result = calculateRefund({
        paymentAmount: 49000,
        subscriptionStartDate: startDate,
      });
      expect(result.eligible).toBe(true);
      expect(result.refundAmount).toBe(49000);
    });

    test("EC-067: 15일차 → 환불 불가", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 15);
      const result = calculateRefund({
        paymentAmount: 49000,
        subscriptionStartDate: startDate,
      });
      expect(result.eligible).toBe(false);
      expect(result.refundAmount).toBe(0);
      expect(result.reason).toBe("refund_period_expired");
    });

    test("EC-068: 결제 금액 0원 → 환불 금액 0원 (14일 이내라도)", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 5);
      const result = calculateRefund({
        paymentAmount: 0,
        subscriptionStartDate: startDate,
      });
      expect(result.eligible).toBe(true);
      expect(result.refundAmount).toBe(0);
    });

    test("EC-069: Enterprise 플랜 동일 정책 (14일 이내 전액 환불)", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const result = calculateRefund({
        paymentAmount: 99000,
        subscriptionStartDate: startDate,
      });
      expect(result.eligible).toBe(true);
      expect(result.refundAmount).toBe(99000);
    });

    test("EC-070: 30일 경과 → 환불 불가", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const result = calculateRefund({
        paymentAmount: 49000,
        subscriptionStartDate: startDate,
      });
      expect(result.eligible).toBe(false);
      expect(result.refundAmount).toBe(0);
    });

    test("1일차 취소 → 전액 환불", () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      const result = calculateRefund({
        paymentAmount: 149000,
        subscriptionStartDate: startDate,
      });
      expect(result.eligible).toBe(true);
      expect(result.refundAmount).toBe(149000);
    });
  });
});

describe("3-Way Disagree Refund - Pro 플랜 전용", () => {
  describe("EC-071 ~ EC-075: 3-Way 불일치 환불 조건", () => {
    test("EC-071: phase_2 + confidence 0.4 → 환불 대상 (3-way 불일치)", () => {
      const result = checkQualityRefundCondition(
        0.4,
        {
          name: "홍길동",
          phone: "010-1234-5678",
          email: "test@test.com",
          last_company: "삼성전자",
        },
        "phase_2"
      );
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe("three_way_disagree");
      expect(result.confidence).toBe(0.4);
    });

    test("EC-072: phase_2 + confidence 0.49 → 환불 대상 (경계값)", () => {
      const result = checkQualityRefundCondition(
        0.49,
        {
          name: "홍길동",
          phone: "010-1234-5678",
          email: null,
          last_company: "삼성전자",
        },
        "phase_2"
      );
      expect(result.eligible).toBe(true);
      expect(result.reason).toBe("three_way_disagree");
    });

    test("EC-073: phase_2 + confidence 0.5 → 환불 안 됨 (경계값)", () => {
      const result = checkQualityRefundCondition(
        0.5,
        {
          name: "홍길동",
          phone: "010-1234-5678",
          email: null,
          last_company: "삼성전자",
        },
        "phase_2"
      );
      expect(result.eligible).toBe(false);
    });

    test("EC-074: phase_1 + confidence 0.4 → 환불 안 됨 (2-Way는 기존 규칙)", () => {
      const result = checkQualityRefundCondition(
        0.4,
        {
          name: "홍길동",
          phone: "010-1234-5678",
          email: null,
          last_company: "삼성전자",
        },
        "phase_1"
      );
      // 0.4 >= 0.3이므로 기존 규칙에 의해 환불 안 됨
      expect(result.eligible).toBe(false);
    });

    test("EC-075: analysisMode 없음 + confidence 0.4 → 환불 안 됨 (기존 규칙)", () => {
      const result = checkQualityRefundCondition(0.4, {
        name: "홍길동",
        phone: "010-1234-5678",
        email: null,
        last_company: "삼성전자",
      });
      // analysisMode 미지정 시 기존 규칙 적용
      expect(result.eligible).toBe(false);
    });

    test("phase_2 + confidence 0.85 → 환불 안 됨 (2개 일치)", () => {
      const result = checkQualityRefundCondition(
        0.85,
        {
          name: "홍길동",
          phone: "010-1234-5678",
          email: null,
          last_company: "삼성전자",
        },
        "phase_2"
      );
      expect(result.eligible).toBe(false);
    });

    test("phase_2 + confidence 1.0 → 환불 안 됨 (3개 일치)", () => {
      const result = checkQualityRefundCondition(
        1.0,
        {
          name: "홍길동",
          phone: "010-1234-5678",
          email: null,
          last_company: "삼성전자",
        },
        "phase_2"
      );
      expect(result.eligible).toBe(false);
    });
  });
});

describe("REFUND_CONFIG", () => {
  test("품질 환불 기본 설정값 확인", () => {
    expect(REFUND_CONFIG.quality.confidenceThreshold).toBe(0.3);
    expect(REFUND_CONFIG.quality.threeWayDisagreeThreshold).toBe(0.5);
    expect(REFUND_CONFIG.quality.requiredMissingFields).toBe(2);
    expect(REFUND_CONFIG.quality.criticalFields).toEqual([
      "name",
      "contact",
      "last_company",
    ]);
  });

  test("구독 환불 기본 설정값 확인 (Paddle 호환: 14일 무조건 전액환불)", () => {
    // Paddle 정책: 14일 이내 무조건 전액 환불
    expect(REFUND_CONFIG.subscription.fullRefundDays).toBe(14);
    // 14일 경과 후 환불 불가
    expect(REFUND_CONFIG.subscription.allowRefundAfterPeriod).toBe(false);
  });

  test("데이터 보존 정책 설정값 확인", () => {
    expect(REFUND_CONFIG.retention.softDeleteDays).toBe(90);
  });
});
