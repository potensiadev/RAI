/**
 * 업로드 관련 설정 상수
 * 클라이언트와 서버에서 공통으로 사용
 *
 * 주의: 이 파일의 값을 변경하면 클라이언트와 서버 모두 재배포 필요
 */

/**
 * 이력서 업로드 설정
 */
export const RESUME_UPLOAD_CONFIG = {
  /**
   * 최대 파일 크기 (bytes)
   * 10MB - 이력서에 충분한 크기
   */
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  /**
   * 최소 파일 크기 (bytes)
   * 1KB - 빈 파일 방지
   */
  MIN_FILE_SIZE: 1024,

  /**
   * 허용 확장자
   */
  ALLOWED_EXTENSIONS: [".hwp", ".hwpx", ".doc", ".docx", ".pdf"] as const,

  /**
   * 한 번에 업로드 가능한 최대 파일 수
   */
  MAX_FILES_PER_BATCH: 30,
} as const;

/**
 * JD(Job Description) 업로드 설정
 */
export const JD_UPLOAD_CONFIG = {
  /**
   * 최대 파일 크기 (bytes)
   * 5MB - JD는 이력서보다 작음
   */
  MAX_FILE_SIZE: 5 * 1024 * 1024,

  /**
   * 최소 파일 크기 (bytes)
   */
  MIN_FILE_SIZE: 1024,

  /**
   * 허용 확장자
   */
  ALLOWED_EXTENSIONS: [".pdf", ".docx", ".doc"] as const,
} as const;

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/**
 * 이력서 업로드 에러 메시지
 */
export const RESUME_ERROR_MESSAGES = {
  FILE_TOO_LARGE: `파일 크기가 ${formatFileSize(RESUME_UPLOAD_CONFIG.MAX_FILE_SIZE)}를 초과합니다.`,
  FILE_TOO_SMALL: `파일 크기가 너무 작습니다 (최소 ${formatFileSize(RESUME_UPLOAD_CONFIG.MIN_FILE_SIZE)}).`,
  INVALID_EXTENSION: `지원하지 않는 파일 형식입니다. ${RESUME_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.map(e => e.toUpperCase().replace('.', '')).join(', ')} 파일만 업로드할 수 있습니다.`,
  MAX_FILES_EXCEEDED: `한 번에 ${RESUME_UPLOAD_CONFIG.MAX_FILES_PER_BATCH}개까지만 업로드할 수 있습니다.`,
} as const;

/**
 * JD 업로드 에러 메시지
 */
export const JD_ERROR_MESSAGES = {
  FILE_TOO_LARGE: `파일 크기가 ${formatFileSize(JD_UPLOAD_CONFIG.MAX_FILE_SIZE)}를 초과합니다.`,
  FILE_TOO_SMALL: `파일 크기가 너무 작습니다 (최소 ${formatFileSize(JD_UPLOAD_CONFIG.MIN_FILE_SIZE)}).`,
  INVALID_EXTENSION: `지원하지 않는 파일 형식입니다. ${JD_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.map(e => e.toUpperCase().replace('.', '')).join(', ')} 파일만 업로드할 수 있습니다.`,
} as const;
