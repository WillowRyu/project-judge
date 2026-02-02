/**
 * Debate Feature Test
 * 토론 기능 로컬 테스트
 */
import { needsDebate, runDebate, DebateConfig } from "../review/debate";
import { ReviewResult, Persona } from "../personas/persona.interface";
import { PRContext } from "../review/orchestrator";
import { LLMProvider } from "../providers/provider.interface";
import { AnalyzedDiff } from "../review/diff-analyzer";

// Mock Provider (테스트용)
class MockProvider implements LLMProvider {
  name = "mock";

  async review(prompt: string): Promise<string> {
    // 토론 응답 시뮬레이션
    console.log("  [MockProvider] Generating debate response...");
    return JSON.stringify({
      response: "다른 의견을 고려해 보았지만, 제 입장을 유지합니다.",
      changedVote: null,
      newReason: null,
    });
  }
}

// 테스트 데이터
const mockPersonas: Persona[] = [
  {
    id: "melchior",
    name: "MELCHIOR",
    emoji: "🔬",
    role: "과학자",
    guideline: "",
  },
  {
    id: "balthasar",
    name: "BALTHASAR",
    emoji: "👩‍👧",
    role: "어머니",
    guideline: "",
  },
  { id: "casper", name: "CASPER", emoji: "💃", role: "여자", guideline: "" },
];

const mockContext: PRContext = {
  title: "Test PR",
  body: "Test description",
  diff: {
    files: [],
    compressedDiff: "",
    summary: "",
    totalAdditions: 10,
    totalDeletions: 5,
  } as AnalyzedDiff,
  author: "tester",
  baseBranch: "main",
  headBranch: "feature/test",
};

// 테스트 1: 만장일치 - 토론 불필요
function testUnanimous() {
  console.log("\n=== Test 1: Unanimous (No debate needed) ===");

  const reviews: ReviewResult[] = [
    {
      personaId: "melchior",
      personaName: "MELCHIOR",
      personaEmoji: "🔬",
      vote: "approve",
      reason: "",
      details: "",
    },
    {
      personaId: "balthasar",
      personaName: "BALTHASAR",
      personaEmoji: "👩‍👧",
      vote: "approve",
      reason: "",
      details: "",
    },
    {
      personaId: "casper",
      personaName: "CASPER",
      personaEmoji: "💃",
      vote: "approve",
      reason: "",
      details: "",
    },
  ];

  const config: DebateConfig = {
    enabled: true,
    maxRounds: 1,
    trigger: "disagreement",
    revoteAfterDebate: true,
  };
  const result = needsDebate(reviews, config);

  console.log(`  needsDebate: ${result}`);
  console.log(`  Expected: false`);
  console.log(`  ${result === false ? "✅ PASS" : "❌ FAIL"}`);
}

// 테스트 2: 의견 충돌 - 토론 필요
function testDisagreement() {
  console.log("\n=== Test 2: Disagreement (Debate needed) ===");

  const reviews: ReviewResult[] = [
    {
      personaId: "melchior",
      personaName: "MELCHIOR",
      personaEmoji: "🔬",
      vote: "approve",
      reason: "",
      details: "",
    },
    {
      personaId: "balthasar",
      personaName: "BALTHASAR",
      personaEmoji: "👩‍👧",
      vote: "reject",
      reason: "",
      details: "",
    },
    {
      personaId: "casper",
      personaName: "CASPER",
      personaEmoji: "💃",
      vote: "approve",
      reason: "",
      details: "",
    },
  ];

  const config: DebateConfig = {
    enabled: true,
    maxRounds: 1,
    trigger: "disagreement",
    revoteAfterDebate: true,
  };
  const result = needsDebate(reviews, config);

  console.log(`  needsDebate: ${result}`);
  console.log(`  Expected: true`);
  console.log(`  ${result === true ? "✅ PASS" : "❌ FAIL"}`);
}

// 테스트 3: 토론 비활성화
function testDisabled() {
  console.log("\n=== Test 3: Debate disabled ===");

  const reviews: ReviewResult[] = [
    {
      personaId: "melchior",
      personaName: "MELCHIOR",
      personaEmoji: "🔬",
      vote: "approve",
      reason: "",
      details: "",
    },
    {
      personaId: "balthasar",
      personaName: "BALTHASAR",
      personaEmoji: "👩‍👧",
      vote: "reject",
      reason: "",
      details: "",
    },
    {
      personaId: "casper",
      personaName: "CASPER",
      personaEmoji: "💃",
      vote: "approve",
      reason: "",
      details: "",
    },
  ];

  const config: DebateConfig = {
    enabled: false,
    maxRounds: 1,
    trigger: "disagreement",
    revoteAfterDebate: true,
  };
  const result = needsDebate(reviews, config);

  console.log(`  needsDebate: ${result}`);
  console.log(`  Expected: false (disabled)`);
  console.log(`  ${result === false ? "✅ PASS" : "❌ FAIL"}`);
}

// 테스트 4: 실제 토론 실행 (Mock)
async function testDebateExecution() {
  console.log("\n=== Test 4: Debate execution (Mock) ===");

  const reviews: ReviewResult[] = [
    {
      personaId: "melchior",
      personaName: "MELCHIOR",
      personaEmoji: "🔬",
      vote: "approve",
      reason: "코드 효율적",
      details: "",
    },
    {
      personaId: "balthasar",
      personaName: "BALTHASAR",
      personaEmoji: "👩‍👧",
      vote: "reject",
      reason: "테스트 부족",
      details: "",
    },
    {
      personaId: "casper",
      personaName: "CASPER",
      personaEmoji: "💃",
      vote: "approve",
      reason: "UX 양호",
      details: "",
    },
  ];

  const provider = new MockProvider();
  const config: DebateConfig = {
    enabled: true,
    maxRounds: 1,
    trigger: "disagreement",
    revoteAfterDebate: true,
  };

  const result = await runDebate(
    provider,
    mockPersonas,
    reviews,
    mockContext,
    config,
  );

  console.log(
    `  Final votes:`,
    result.map((r) => `${r.personaEmoji} ${r.vote}`).join(", "),
  );
  console.log(`  ${result.length === 3 ? "✅ PASS" : "❌ FAIL"}`);
}

// 실행
async function main() {
  console.log("🗣️ Debate Feature Tests\n");

  testUnanimous();
  testDisagreement();
  testDisabled();
  await testDebateExecution();

  console.log("\n✅ All tests complete!");
}

main().catch(console.error);
