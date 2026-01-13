/**
 * Circuit Breaker for OpenAI API
 * 
 * 연속 실패 시 일시적으로 API 호출을 차단하여 시스템 보호
 * - 5회 연속 실패 → 서킷 오픈 (30초)
 * - 30초 후 Half-Open 상태에서 테스트
 * - 성공 시 서킷 클로즈
 */

// 서킷 브레이커 설정
const FAILURE_THRESHOLD = 5;
const RESET_TIMEOUT_MS = 30000; // 30초
const HALF_OPEN_MAX_CALLS = 1;

// 상태 관리
interface CircuitState {
    failures: number;
    lastFailureTime: number;
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    halfOpenCalls: number;
}

const circuitState: CircuitState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
    halfOpenCalls: 0,
};

/**
 * Structured logging for circuit breaker events
 */
function logCircuit(event: string, data: Record<string, unknown>): void {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'circuit_breaker',
        event,
        ...data,
    }));
}

/**
 * 서킷 상태 확인 및 업데이트
 */
function checkCircuit(): void {
    if (circuitState.state === 'OPEN') {
        const elapsed = Date.now() - circuitState.lastFailureTime;
        if (elapsed >= RESET_TIMEOUT_MS) {
            // 타임아웃 경과 → Half-Open으로 전환
            circuitState.state = 'HALF_OPEN';
            circuitState.halfOpenCalls = 0;
            logCircuit('circuit_half_open', { elapsed_ms: elapsed });
        }
    }
}

/**
 * 서킷이 열려있는지 확인
 */
export function isCircuitOpen(): boolean {
    checkCircuit();

    if (circuitState.state === 'OPEN') {
        return true;
    }

    if (circuitState.state === 'HALF_OPEN') {
        // Half-Open 상태에서는 제한된 호출만 허용
        if (circuitState.halfOpenCalls >= HALF_OPEN_MAX_CALLS) {
            return true;
        }
        circuitState.halfOpenCalls++;
    }

    return false;
}

/**
 * 성공 기록
 */
export function recordSuccess(): void {
    if (circuitState.state === 'HALF_OPEN') {
        // Half-Open 성공 → 서킷 닫기
        logCircuit('circuit_closed', {
            previous_failures: circuitState.failures,
        });
    }

    circuitState.failures = 0;
    circuitState.state = 'CLOSED';
}

/**
 * 실패 기록
 */
export function recordFailure(): void {
    circuitState.failures++;
    circuitState.lastFailureTime = Date.now();

    if (circuitState.state === 'HALF_OPEN') {
        // Half-Open 실패 → 다시 Open
        circuitState.state = 'OPEN';
        logCircuit('circuit_reopened', { failures: circuitState.failures });
    } else if (circuitState.failures >= FAILURE_THRESHOLD) {
        // 임계값 도달 → Open
        circuitState.state = 'OPEN';
        logCircuit('circuit_opened', {
            failures: circuitState.failures,
            threshold: FAILURE_THRESHOLD,
        });
    }
}

/**
 * 서킷 상태 조회 (Health Check용)
 */
export function getCircuitStatus(): {
    state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
    failures: number;
    lastFailureTime: Date | null;
    isHealthy: boolean;
} {
    checkCircuit();

    return {
        state: circuitState.state,
        failures: circuitState.failures,
        lastFailureTime: circuitState.lastFailureTime > 0
            ? new Date(circuitState.lastFailureTime)
            : null,
        isHealthy: circuitState.state === 'CLOSED',
    };
}

/**
 * 서킷 리셋 (테스트/관리용)
 */
export function resetCircuit(): void {
    circuitState.failures = 0;
    circuitState.lastFailureTime = 0;
    circuitState.state = 'CLOSED';
    circuitState.halfOpenCalls = 0;
    logCircuit('circuit_reset', {});
}

export { FAILURE_THRESHOLD, RESET_TIMEOUT_MS };
