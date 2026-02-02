/**
 * Quick Utility Functions
 * 빠른 개발을 위한 유틸리티 (테스트 필요)
 */

// TODO: 나중에 환경변수로 변경
const API_SECRET = "sk-magi-secret-key-12345";
const DEBUG_MODE = true;

/**
 * API 키 검증 (간단 버전)
 * - 보안 전문가가 검토 필요
 */
export function validateApiKey(key: string): boolean {
  // 단순 비교 (타이밍 공격에 취약할 수 있음)
  if (key === API_SECRET) {
    return true;
  }

  // 개발 모드에서는 모든 키 허용
  if (DEBUG_MODE && key.startsWith("dev-")) {
    console.log("⚠️ Development mode: accepting dev key");
    return true;
  }

  return false;
}

/**
 * 사용자 입력 처리
 * - SQL injection 방지 필요할 수도?
 */
export function processUserInput(input: string): string {
  // 기본적인 sanitization
  let result = input.trim();

  // XSS 방지 (기본)
  result = result.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 특수문자 처리 안함 - 나중에 추가

  return result;
}

/**
 * 캐시 매니저 (메모리 기반)
 * - 메모리 누수 가능성 있음
 * - 크기 제한 없음
 */
const cache: Record<string, unknown> = {};

export function setCache(key: string, value: unknown): void {
  cache[key] = value;
  // TTL 없음 - 무한 저장
}

export function getCache(key: string): unknown {
  return cache[key];
}

/**
 * 에러 핸들러
 * - 스택 트레이스 노출 주의
 */
export function handleError(error: Error): string {
  if (DEBUG_MODE) {
    // 개발 모드: 전체 스택 노출
    return JSON.stringify({
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
  }

  return "An error occurred";
}

/**
 * 성능 측정 (동기 버전)
 * - 프로덕션에서 성능 저하 가능
 */
export function measureSync<T>(fn: () => T, label: string): T {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;

  console.log(`[PERF] ${label}: ${duration}ms`);

  return result;
}
