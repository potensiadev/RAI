/**
 * 에러 코드 및 사용자 친화적 메시지 정의
 * 
 * 기술적 에러를 사용자가 이해할 수 있는 메시지로 변환
 */

// 에러 코드 타입
export type ErrorCode =
    | "PARSE_FAILED"
    | "ENCRYPTED"
    | "SCANNED_IMAGE"
    | "TEXT_TOO_SHORT"
    | "LLM_TIMEOUT"
    | "LLM_ERROR"
    | "STORAGE_ERROR"
    | "MISSING_REQUIRED_FIELDS"
    | "UNKNOWN";

// 사용자 친화적 에러 메시지
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
    PARSE_FAILED: "읽을 수 없는 파일이에요. 다른 형식(PDF, Word 등)으로 다시 업로드해 주세요.",
    ENCRYPTED: "비밀번호로 보호된 파일이에요. 비밀번호 해제 후 다시 업로드해 주세요.",
    SCANNED_IMAGE: "스캔 이미지로 된 파일이에요. 텍스트 문서를 업로드해 주세요.",
    TEXT_TOO_SHORT: "이력서 내용이 너무 짧아요. 파일 내용을 확인해 주세요.",
    LLM_TIMEOUT: "분석 시간이 오래 걸려 중단되었어요. 다시 시도해 주세요.",
    LLM_ERROR: "분석 중 문제가 발생했어요. 잠시 후 다시 시도해 주세요.",
    STORAGE_ERROR: "파일 저장에 실패했어요. 다시 시도해 주세요.",
    MISSING_REQUIRED_FIELDS: "이력서에서 필수 정보(이름, 연락처, 경력)를 찾을 수 없어요. 파일을 확인해 주세요.",
    UNKNOWN: "예상치 못한 문제가 발생했어요. 다시 시도해 주세요.",
} as const;

// 기술적 에러 패턴 → 에러 코드 매핑
export function classifyError(technicalError: string): ErrorCode {
    const errorLower = technicalError.toLowerCase();

    // 파싱 실패
    if (
        errorLower.includes("parse") ||
        errorLower.includes("parsing failed") ||
        errorLower.includes("file rejected") ||
        errorLower.includes("unsupported file")
    ) {
        return "PARSE_FAILED";
    }

    // 암호화
    if (
        errorLower.includes("encrypt") ||
        errorLower.includes("password") ||
        errorLower.includes("protected")
    ) {
        return "ENCRYPTED";
    }

    // 스캔 이미지
    if (
        errorLower.includes("scanned") ||
        errorLower.includes("ocr") ||
        errorLower.includes("image only")
    ) {
        return "SCANNED_IMAGE";
    }

    // 텍스트 부족
    if (
        errorLower.includes("too short") ||
        errorLower.includes("text length") ||
        errorLower.includes("minimum")
    ) {
        return "TEXT_TOO_SHORT";
    }

    // LLM 타임아웃
    if (
        errorLower.includes("timeout") ||
        errorLower.includes("timed out")
    ) {
        return "LLM_TIMEOUT";
    }

    // LLM 에러
    if (
        errorLower.includes("llm") ||
        errorLower.includes("analysis") ||
        errorLower.includes("provider failed")
    ) {
        return "LLM_ERROR";
    }

    // 스토리지 에러
    if (
        errorLower.includes("storage") ||
        errorLower.includes("upload") ||
        errorLower.includes("download")
    ) {
        return "STORAGE_ERROR";
    }

    // 필수 필드 누락
    if (
        errorLower.includes("required") ||
        errorLower.includes("missing") ||
        errorLower.includes("필수")
    ) {
        return "MISSING_REQUIRED_FIELDS";
    }

    return "UNKNOWN";
}

// 에러 코드로 사용자 메시지 가져오기
export function getUserMessage(errorCode: ErrorCode): string {
    return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN;
}

// 기술적 에러를 사용자 메시지로 변환
export function getErrorMessageForUser(technicalError: string): string {
    const errorCode = classifyError(technicalError);
    return getUserMessage(errorCode);
}
