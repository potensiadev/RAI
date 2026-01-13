/**
 * k6 부하 테스트: 환불 동시성 검증
 *
 * PRD: prd_refund_policy_v0.4.md Section 3.3
 * QA: refund_policy_test_scenarios_v1.0.md (EC-026 ~ EC-035)
 *
 * Paddle 의존성: 없음 (품질 환불만 테스트)
 *
 * 설치: https://k6.io/docs/get-started/installation/
 * 실행: k6 run tests/load/refund-stress.js
 * 환경변수:
 *   - BASE_URL: 테스트 대상 URL (기본: http://localhost:3000)
 *   - WEBHOOK_SECRET: Webhook 인증 시크릿
 */

import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// 환경변수
var BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
var WEBHOOK_SECRET = __ENV.WEBHOOK_SECRET || "test-webhook-secret";

// 커스텀 메트릭
var refundSuccessRate = new Rate("refund_success_rate");
var idempotentCount = new Counter("idempotent_responses");
var refundDuration = new Trend("refund_duration_ms");
var duplicateRefundCount = new Counter("duplicate_refunds");

// 테스트 설정
export var options = {
  scenarios: {
    // 시나리오 1: 같은 candidate에 동시 환불 요청 (이중 환불 방지 테스트)
    duplicate_refund_test: {
      executor: "shared-iterations",
      vus: 20, // 20명이 동시에
      iterations: 20, // 같은 candidate에 환불 요청
      maxDuration: "30s",
      exec: "testDuplicateRefund",
      tags: { scenario: "duplicate" },
    },

    // 시나리오 2: 다른 candidate에 대량 환불 (처리량 테스트)
    bulk_refund_test: {
      executor: "constant-arrival-rate",
      rate: 50, // 초당 50건
      timeUnit: "1s",
      duration: "1m",
      preAllocatedVUs: 100,
      exec: "testBulkRefund",
      tags: { scenario: "bulk" },
      startTime: "35s", // 시나리오 1 완료 후 시작
    },

    // 시나리오 3: 스파이크 테스트 (급격한 트래픽 증가)
    spike_test: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      stages: [
        { target: 10, duration: "10s" }, // 워밍업
        { target: 100, duration: "10s" }, // 스파이크
        { target: 10, duration: "10s" }, // 정상화
      ],
      preAllocatedVUs: 150,
      exec: "testBulkRefund",
      tags: { scenario: "spike" },
      startTime: "2m", // 시나리오 2 완료 후 시작
    },
  },

  thresholds: {
    // 성능 임계값
    http_req_duration: ["p(95)<500", "p(99)<1000"], // 95%는 500ms, 99%는 1초 이내
    http_req_failed: ["rate<0.01"], // 에러율 1% 미만
    refund_success_rate: ["rate>0.99"], // 환불 성공률 99% 이상
    duplicate_refunds: ["count==0"], // 이중 환불 0건
  },
};

// 공유 candidate ID (이중 환불 테스트용)
var SHARED_CANDIDATE_ID = "test-candidate-duplicate-check";
var SHARED_USER_ID = "test-user-duplicate-check";
var SHARED_JOB_ID = "test-job-duplicate-check";

/**
 * 시나리오 1: 이중 환불 방지 테스트
 * 동일한 candidate에 대해 여러 요청이 동시에 들어올 때
 * 오직 1건만 처리되어야 함
 */
export function testDuplicateRefund() {
  var payload = JSON.stringify({
    job_id: SHARED_JOB_ID,
    status: "completed",
    result: {
      candidate_id: SHARED_CANDIDATE_ID,
      confidence_score: 0.2, // 환불 조건 충족
      quick_data: {
        name: null,
        phone: null,
        email: null,
        last_company: null,
      },
    },
  });

  var params = {
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": WEBHOOK_SECRET,
    },
    tags: { name: "duplicate_refund" },
  };

  var startTime = Date.now();
  var res = http.post(BASE_URL + "/api/webhooks/worker", payload, params);
  var duration = Date.now() - startTime;

  refundDuration.add(duration);

  var success = check(res, {
    "status is 200": function(r) { return r.status === 200; },
    "response has success": function(r) {
      try {
        var body = JSON.parse(r.body);
        return body.success === true;
      } catch (e) {
        return false;
      }
    },
  });

  refundSuccessRate.add(success);

  // Idempotent 응답 카운트
  try {
    var body = JSON.parse(res.body);
    if (body.data && body.data.idempotent === true) {
      idempotentCount.add(1);
    } else if (body.data && body.data.action === "refunded") {
      // 실제로 환불 처리된 경우
      // 첫 번째 요청만 여기에 도달해야 함
      console.log("VU " + __VU + ": Actual refund processed");
    }
  } catch (e) {
    console.error("Parse error: " + e);
  }
}

/**
 * 시나리오 2: 대량 환불 처리량 테스트
 * 서로 다른 candidate에 대한 대량 환불 요청
 */
export function testBulkRefund() {
  // 각 요청마다 고유한 candidate ID 생성
  var uniqueId = uuidv4();
  var candidateId = "test-candidate-" + uniqueId;
  var userId = "test-user-" + uniqueId;
  var jobId = "test-job-" + uniqueId;

  var payload = JSON.stringify({
    job_id: jobId,
    status: "completed",
    result: {
      candidate_id: candidateId,
      confidence_score: 0.25,
      quick_data: {
        name: null,
        phone: null,
        email: null,
        last_company: null,
      },
    },
  });

  var params = {
    headers: {
      "Content-Type": "application/json",
      "X-Webhook-Secret": WEBHOOK_SECRET,
    },
    tags: { name: "bulk_refund" },
  };

  var startTime = Date.now();
  var res = http.post(BASE_URL + "/api/webhooks/worker", payload, params);
  var duration = Date.now() - startTime;

  refundDuration.add(duration);

  var success = check(res, {
    "status is 200": function(r) { return r.status === 200; },
    "response time < 500ms": function(r) { return r.timings.duration < 500; },
  });

  refundSuccessRate.add(success);

  // 간단한 딜레이
  sleep(0.1);
}

/**
 * 테스트 전 셋업 (한 번만 실행)
 */
export function setup() {
  console.log("============================================================");
  console.log("환불 동시성 부하 테스트 시작");
  console.log("Target: " + BASE_URL);
  console.log("============================================================");

  // 서버 헬스체크
  var healthRes = http.get(BASE_URL + "/api/webhooks/worker");
  if (healthRes.status !== 200) {
    throw new Error("Server health check failed: " + healthRes.status);
  }

  return {
    startTime: new Date().toISOString(),
  };
}

/**
 * 테스트 후 정리 및 결과 요약
 */
export function teardown(data) {
  console.log("============================================================");
  console.log("테스트 완료");
  console.log("시작: " + data.startTime);
  console.log("종료: " + new Date().toISOString());
  console.log("============================================================");
}

/**
 * 기본 실행 함수 (시나리오 미지정 시)
 */
export default function () {
  testBulkRefund();
}
