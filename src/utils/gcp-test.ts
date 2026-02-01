/**
 * GCP Vertex AI 테스트용 유틸리티
 */

// 두 숫자를 곱하는 함수
export function multiply(a: number, b: number): number {
  return a * b;
}

// 배열의 평균값 계산
export function average(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }
  const sum = numbers.reduce((acc, n) => acc + n, 0);
  return sum / numbers.length;
}

// 문자열을 대문자로 변환
export function toUpperCase(str: string): string {
  return str.toUpperCase();
}
