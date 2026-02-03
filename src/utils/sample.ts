/**
 * Sample utility function for MAGI review test
 * 이 파일은 MAGI 리뷰 봇 테스트용입니다.
 */

// 간단한 덧셈 함수
export function add(a: number, b: number): number {
  return a + b;
}

// 배열에서 최대값 찾기
export function findMax(numbers: number[]): number {
  if (numbers.length === 0) {
    throw new Error("Array cannot be empty");
  }
  return Math.max(...numbers);
}

// 문자열 뒤집기
export function reverseString(str: string): string {
  return str.split("").reverse().join("");
}

// 간단한 인사 메시지
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
// Test retry logic Tue Feb  3 12:19:50 KST 2026
