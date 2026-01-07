/**
 * 타임아웃 설정
 * 환경변수로 오버라이드 가능
 */

/**
 * 환경변수에서 타임아웃 값 읽기 (밀리초)
 */
const getEnvTimeout = (key: string, defaultValue: number): number => {
  const envValue = process.env[key];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultValue;
};

/**
 * Worker 파이프라인 호출 타임아웃 (밀리초)
 * 환경변수: WORKER_PIPELINE_TIMEOUT_MS
 * 기본값: 15000 (15초)
 */
export const WORKER_PIPELINE_TIMEOUT = getEnvTimeout(
  'WORKER_PIPELINE_TIMEOUT_MS',
  15000
);

/**
 * 파일 업로드 간 딜레이 (밀리초)
 * 환경변수: UPLOAD_DELAY_MS
 * 기본값: 500
 */
export const UPLOAD_DELAY = getEnvTimeout(
  'UPLOAD_DELAY_MS',
  500
);

/**
 * LLM API 호출 타임아웃 (밀리초)
 * 환경변수: LLM_API_TIMEOUT_MS
 * 기본값: 60000 (60초)
 */
export const LLM_API_TIMEOUT = getEnvTimeout(
  'LLM_API_TIMEOUT_MS',
  60000
);

/**
 * 스토리지 업로드 타임아웃 (밀리초)
 * 환경변수: STORAGE_UPLOAD_TIMEOUT_MS
 * 기본값: 30000 (30초)
 */
export const STORAGE_UPLOAD_TIMEOUT = getEnvTimeout(
  'STORAGE_UPLOAD_TIMEOUT_MS',
  30000
);
