/**
 * URL Security Validator
 *
 * XSS 방지를 위한 URL 스킴 검증
 * - javascript:, vbscript:, data: 등 위험한 스킴 차단
 * - 허용된 프로토콜만 통과
 */

const SAFE_PROTOCOLS = ['https:', 'http:', 'mailto:'] as const;

const BLOCKED_PATTERNS = [
    /^javascript:/i,
    /^data:/i,
    /^vbscript:/i,
    /^file:/i,
] as const;

/**
 * URL 안전성 검증 및 살균
 *
 * @param url - 검증할 URL 문자열
 * @returns 안전한 URL 또는 undefined (차단된 경우)
 *
 * @example
 * sanitizeUrl("https://github.com/user")  // ✅ "https://github.com/user"
 * sanitizeUrl("javascript:alert(1)")      // ❌ undefined
 * sanitizeUrl("/relative/path")           // ✅ "/relative/path"
 */
export function sanitizeUrl(url: string | undefined | null): string | undefined {
    if (!url) return undefined;

    const trimmed = url.trim();
    if (!trimmed) return undefined;

    // Block dangerous schemes
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(trimmed)) {
            console.warn(`[Security] Blocked dangerous URL scheme: ${trimmed.slice(0, 50)}...`);
            return undefined;
        }
    }

    // Validate protocol for absolute URLs
    try {
        const parsed = new URL(trimmed);
        if (!SAFE_PROTOCOLS.includes(parsed.protocol as typeof SAFE_PROTOCOLS[number])) {
            console.warn(`[Security] Blocked non-allowed protocol: ${parsed.protocol}`);
            return undefined;
        }
        return trimmed;
    } catch {
        // Relative URLs starting with / are allowed
        if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
            return trimmed;
        }
        // Hash links are allowed
        if (trimmed.startsWith('#')) {
            return trimmed;
        }
        // Block everything else (could be protocol-relative //evil.com)
        console.warn(`[Security] Blocked malformed or relative URL: ${trimmed.slice(0, 50)}...`);
        return undefined;
    }
}

/**
 * 외부 링크 검증 (https만 허용)
 *
 * 포트폴리오, GitHub, LinkedIn 등 외부 사이트 링크용
 */
export function sanitizeExternalUrl(url: string | undefined | null): string | undefined {
    const sanitized = sanitizeUrl(url);
    if (!sanitized) return undefined;

    // 외부 URL은 https만 허용
    if (sanitized.startsWith('/') || sanitized.startsWith('#')) {
        return undefined; // 상대 경로는 외부 URL이 아님
    }

    try {
        const parsed = new URL(sanitized);
        if (parsed.protocol !== 'https:') {
            console.warn(`[Security] External URL must be HTTPS: ${sanitized.slice(0, 50)}...`);
            return undefined;
        }
        return sanitized;
    } catch {
        return undefined;
    }
}

/**
 * 이메일 링크 생성
 */
export function createMailtoUrl(email: string | undefined | null): string | undefined {
    if (!email) return undefined;

    const sanitized = email.trim();
    // 기본적인 이메일 형식 검증
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
        return undefined;
    }

    return `mailto:${sanitized}`;
}
