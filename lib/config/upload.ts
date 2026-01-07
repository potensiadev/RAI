/**
 * 업로드 설정
 * 환경변수로 오버라이드 가능
 */

/**
 * 환경변수에서 숫자 값 읽기
 */
const getEnvNumber = (key: string, defaultValue: number): number => {
  const envValue = process.env[key];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultValue;
};

// ─────────────────────────────────────────────────────
// 파일 크기 제한
// ─────────────────────────────────────────────────────

/**
 * 최대 파일 크기 (바이트)
 * 환경변수: MAX_FILE_SIZE_MB
 * 기본값: 10MB (Vercel 4.5MB 제한 고려, 여유있게 10MB)
 *
 * 참고: Vercel Serverless는 요청 body 4.5MB 제한
 * 대용량 파일은 Direct-to-Storage 패턴 사용 권장
 */
export const MAX_FILE_SIZE_BYTES = getEnvNumber('MAX_FILE_SIZE_MB', 10) * 1024 * 1024;

/**
 * 동시 처리 가능한 최대 메모리 (바이트)
 * 환경변수: MAX_CONCURRENT_MEMORY_MB
 * 기본값: 100MB
 *
 * 동시 업로드 시 총 메모리 사용량 제한
 */
export const MAX_CONCURRENT_MEMORY_BYTES = getEnvNumber('MAX_CONCURRENT_MEMORY_MB', 100) * 1024 * 1024;

// ─────────────────────────────────────────────────────
// 동시 업로드 제한
// ─────────────────────────────────────────────────────

/**
 * 사용자당 동시 업로드 제한
 * 환경변수: MAX_CONCURRENT_UPLOADS_PER_USER
 * 기본값: 5
 */
export const MAX_CONCURRENT_UPLOADS_PER_USER = getEnvNumber('MAX_CONCURRENT_UPLOADS_PER_USER', 5);

/**
 * 전역 동시 업로드 제한
 * 환경변수: MAX_CONCURRENT_UPLOADS_GLOBAL
 * 기본값: 50
 */
export const MAX_CONCURRENT_UPLOADS_GLOBAL = getEnvNumber('MAX_CONCURRENT_UPLOADS_GLOBAL', 50);

// ─────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────

/**
 * 사용자당 분당 업로드 제한
 * 환경변수: UPLOAD_RATE_LIMIT_PER_MINUTE
 * 기본값: 10
 */
export const UPLOAD_RATE_LIMIT_PER_MINUTE = getEnvNumber('UPLOAD_RATE_LIMIT_PER_MINUTE', 10);

/**
 * 버스트 업로드 제한 (10초당)
 * 환경변수: UPLOAD_BURST_LIMIT
 * 기본값: 3
 */
export const UPLOAD_BURST_LIMIT = getEnvNumber('UPLOAD_BURST_LIMIT', 3);

/**
 * 전역 분당 업로드 제한
 * 환경변수: GLOBAL_UPLOAD_RATE_LIMIT_PER_MINUTE
 * 기본값: 100
 */
export const GLOBAL_UPLOAD_RATE_LIMIT_PER_MINUTE = getEnvNumber('GLOBAL_UPLOAD_RATE_LIMIT_PER_MINUTE', 100);

// ─────────────────────────────────────────────────────
// 파일 유형 제한
// ─────────────────────────────────────────────────────

/**
 * 허용되는 파일 확장자
 */
export const ALLOWED_EXTENSIONS = ['.hwp', '.hwpx', '.doc', '.docx', '.pdf'];

/**
 * 파일 확장자별 MIME 타입
 */
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.hwp': ['application/x-hwp', 'application/haansofthwp'],
  '.hwpx': ['application/hwp+zip', 'application/x-hwpx'],
};

/**
 * Magic Bytes 정의 (파일 시그니처)
 */
export const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  '.pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  '.doc': [{ bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }], // OLE Compound
  '.docx': [{ bytes: [0x50, 0x4B, 0x03, 0x04] }], // ZIP (Office Open XML)
  '.hwp': [{ bytes: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] }], // OLE Compound
  '.hwpx': [{ bytes: [0x50, 0x4B, 0x03, 0x04] }], // ZIP
};

// ─────────────────────────────────────────────────────
// 파일명 제한
// ─────────────────────────────────────────────────────

/**
 * 최대 파일명 길이
 * 환경변수: MAX_FILENAME_LENGTH
 * 기본값: 200
 */
export const MAX_FILENAME_LENGTH = getEnvNumber('MAX_FILENAME_LENGTH', 200);

// ─────────────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────────────

/**
 * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 파일 확장자 추출 (소문자)
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
}

/**
 * 파일 유효성 검사
 */
export function validateFile(file: { name: string; size: number }): { valid: boolean; error?: string } {
  // 파일명 길이 검사
  if (file.name.length > MAX_FILENAME_LENGTH) {
    return {
      valid: false,
      error: `파일명이 너무 깁니다. (최대 ${MAX_FILENAME_LENGTH}자)`,
    };
  }

  // 확장자 검사
  const ext = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식입니다. (지원: ${ALLOWED_EXTENSIONS.join(', ')})`,
    };
  }

  // 파일 크기 검사
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `파일 크기가 제한을 초과했습니다. (최대 ${formatFileSize(MAX_FILE_SIZE_BYTES)})`,
    };
  }

  // 빈 파일 검사
  if (file.size === 0) {
    return {
      valid: false,
      error: '빈 파일은 업로드할 수 없습니다.',
    };
  }

  return { valid: true };
}

/**
 * Magic Bytes 검증
 */
export function validateMagicBytes(buffer: ArrayBuffer, extension: string): boolean {
  const signatures = MAGIC_BYTES[extension];
  if (!signatures) {
    return true; // 알 수 없는 확장자는 검증 스킵
  }

  const bytes = new Uint8Array(buffer);

  return signatures.some((sig) => {
    const offset = sig.offset || 0;
    return sig.bytes.every((byte, index) => bytes[offset + index] === byte);
  });
}

/**
 * ZIP 파일 타입 감지 (docx vs hwpx)
 */
export function detectZipType(buffer: ArrayBuffer): '.docx' | '.hwpx' | null {
  const bytes = new Uint8Array(buffer);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 10000));

  if (text.includes('[Content_Types].xml') || text.includes('word/document.xml')) {
    return '.docx';
  }

  if (text.includes('Contents/content.hpf') || (text.includes('mimetype') && text.includes('hwp'))) {
    return '.hwpx';
  }

  return null;
}
