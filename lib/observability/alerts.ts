/**
 * Alert Service
 * 
 * 에러 및 중요 이벤트 알림
 * - Slack Webhook
 * - Discord Webhook
 * - 중복 알림 방지 (쿨다운)
 */

// 알림 채널 설정
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// 쿨다운 설정 (같은 유형 알림 5분 제한)
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;
const lastAlertTimes: Map<string, number> = new Map();

/**
 * 알림 심각도
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * 알림 페이로드
 */
export interface AlertPayload {
    severity: AlertSeverity;
    title: string;
    message: string;
    context?: Record<string, unknown>;
}

/**
 * 쿨다운 체크
 */
function isOnCooldown(alertKey: string): boolean {
    const lastTime = lastAlertTimes.get(alertKey);
    if (!lastTime) return false;
    return Date.now() - lastTime < ALERT_COOLDOWN_MS;
}

/**
 * Slack 알림 전송
 */
async function sendSlackAlert(payload: AlertPayload): Promise<boolean> {
    if (!SLACK_WEBHOOK_URL) return false;

    const color = {
        info: '#36a64f',
        warning: '#ffa500',
        error: '#ff0000',
        critical: '#8b0000',
    }[payload.severity];

    try {
        const response = await fetch(SLACK_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                attachments: [{
                    color,
                    title: `[${payload.severity.toUpperCase()}] ${payload.title}`,
                    text: payload.message,
                    fields: payload.context ? Object.entries(payload.context).map(([key, value]) => ({
                        title: key,
                        value: String(value),
                        short: true,
                    })) : [],
                    ts: Math.floor(Date.now() / 1000),
                }],
            }),
        });

        return response.ok;
    } catch (error) {
        console.error('[Alert] Slack send failed:', error);
        return false;
    }
}

/**
 * Discord 알림 전송
 */
async function sendDiscordAlert(payload: AlertPayload): Promise<boolean> {
    if (!DISCORD_WEBHOOK_URL) return false;

    const color = {
        info: 0x36a64f,
        warning: 0xffa500,
        error: 0xff0000,
        critical: 0x8b0000,
    }[payload.severity];

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: `[${payload.severity.toUpperCase()}] ${payload.title}`,
                    description: payload.message,
                    color,
                    fields: payload.context ? Object.entries(payload.context).map(([key, value]) => ({
                        name: key,
                        value: String(value),
                        inline: true,
                    })) : [],
                    timestamp: new Date().toISOString(),
                }],
            }),
        });

        return response.ok;
    } catch (error) {
        console.error('[Alert] Discord send failed:', error);
        return false;
    }
}

/**
 * 알림 전송 (모든 채널)
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
    const alertKey = `${payload.severity}:${payload.title}`;

    // 쿨다운 체크
    if (isOnCooldown(alertKey)) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            service: 'alert',
            event: 'alert_throttled',
            key: alertKey,
        }));
        return;
    }

    // 쿨다운 기록
    lastAlertTimes.set(alertKey, Date.now());

    // 로그 출력
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        service: 'alert',
        event: 'alert_sent',
        severity: payload.severity,
        title: payload.title,
    }));

    // 채널별 전송 (병렬)
    await Promise.allSettled([
        sendSlackAlert(payload),
        sendDiscordAlert(payload),
    ]);
}

/**
 * 서킷 브레이커 오픈 알림
 */
export async function alertCircuitOpen(failures: number): Promise<void> {
    await sendAlert({
        severity: 'critical',
        title: 'Circuit Breaker OPEN',
        message: 'OpenAI API 연속 실패로 서킷 브레이커가 열렸습니다. 30초간 Fallback 모드로 동작합니다.',
        context: {
            failures,
            service: 'OpenAI Embedding',
            action: 'Fallback to text search',
        },
    });
}

/**
 * 높은 에러율 알림
 */
export async function alertHighErrorRate(errorRate: number): Promise<void> {
    await sendAlert({
        severity: 'error',
        title: 'High Error Rate Detected',
        message: `임베딩 에러율이 ${errorRate}%로 임계값을 초과했습니다.`,
        context: {
            errorRate: `${errorRate}%`,
            threshold: '10%',
        },
    });
}

/**
 * 서비스 복구 알림
 */
export async function alertServiceRecovered(service: string): Promise<void> {
    await sendAlert({
        severity: 'info',
        title: 'Service Recovered',
        message: `${service} 서비스가 정상 상태로 복구되었습니다.`,
        context: { service },
    });
}
