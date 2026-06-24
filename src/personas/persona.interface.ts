/**
 * Persona Interface
 * 각 페르소나의 정의 및 리뷰 결과 타입
 */
export interface Persona {
  id: string;
  name: string;
  emoji: string;
  role: string;
  guideline: string;
  model?: string; // 페르소나별 모델 지정 (미지정 시 Provider 기본값 사용)
  provider?: "gemini" | "openai" | "claude"; // 페르소나별 provider (미지정 시 전역 사용)
}

export type VoteResult = "approve" | "reject" | "conditional";

export interface ReviewResult {
  personaId: string;
  personaName: string;
  personaEmoji: string;
  vote: VoteResult;
  reason: string;
  details: string;
  suggestions?: string[];
  debateResponse?: string; // 토론 응답 (토론 후 추가됨)
  originalVote?: VoteResult; // 토론 전 원래 투표 (변경된 경우에만 설정)
  error?: boolean; // LLM 호출 실패 → 집계 제외
  errorKind?: "rate_limit" | "other"; // 재시도 분류용(내부)
}

export interface VotingSummary {
  totalVoters: number;
  approvals: number;
  rejections: number;
  conditionals: number;
  errored: number; // 실패로 집계 제외된 수
  validVoters: number; // 유효 리뷰 수(전체 - errored)
  undetermined: boolean; // 유효 리뷰 < 정족수 → 판정 불가
  passed: boolean;
  requiredApprovals: number;
}
