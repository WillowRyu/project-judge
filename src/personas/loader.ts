import * as path from "path";
import { Persona } from "./persona.interface";
import { BUILT_IN_PERSONAS, isBuiltInPersona } from "./built-in";
import { PersonaConfig } from "../config/schema";
import { readWorkspaceFileIfExists } from "../config/workspace-path";

/**
 * Persona Loader
 * 커스텀 지침 자동 감지 + 기본값 폴백 + common.md 병합
 */

// 자동 감지 경로
const CUSTOM_GUIDELINE_PATHS = [".github/magi", ".magi", "docs/magi"];

// 공통 지침 파일명
const COMMON_GUIDELINE_FILES = ["common.md", "COMMON.md"];

/**
 * 페르소나별 커스텀 지침 파일 탐색
 */
function findCustomGuideline(
  workspacePath: string,
  personaId: string,
): string | null {
  const fileVariants = [
    `${personaId}.md`,
    `${personaId.toUpperCase()}.md`,
    `${personaId.toLowerCase()}.md`,
  ];

  for (const basePath of CUSTOM_GUIDELINE_PATHS) {
    for (const fileName of fileVariants) {
      const guideline = readWorkspaceFileIfExists(workspacePath, path.posix.join(basePath, fileName));
      if (guideline !== null) return guideline;
    }
  }

  return null;
}

/**
 * 공통 지침 파일 탐색
 */
function findCommonGuideline(workspacePath: string): string {
  for (const basePath of CUSTOM_GUIDELINE_PATHS) {
    for (const fileName of COMMON_GUIDELINE_FILES) {
      const guideline = readWorkspaceFileIfExists(workspacePath, path.posix.join(basePath, fileName));
      if (guideline !== null) return guideline;
    }
  }

  return "";
}

/**
 * 지침 합성
 */
function mergeGuidelines(base: string, common: string): string {
  if (!common) {
    return base;
  }

  return `${base}

---

## 📋 프로젝트 추가 지침

${common}`;
}

/**
 * 단일 페르소나 로드
 */
export async function loadPersona(
  workspacePath: string,
  personaId: string,
  config?: PersonaConfig,
): Promise<Persona> {
  const explicitGuideline = config?.guideline_file
    ? readWorkspaceFileIfExists(workspacePath, config.guideline_file)
    : null;
  if (config?.guideline_file && explicitGuideline === null) {
    throw new Error(`Guideline file not found: ${config.guideline_file}`);
  }
  const customGuideline = explicitGuideline ?? findCustomGuideline(workspacePath, personaId);

  // 2. 기본 지침 (커스텀 없으면)
  let baseGuideline: string;
  let meta: { id: string; name: string; emoji: string; role: string };

  if (customGuideline) {
    baseGuideline = customGuideline;
    // 커스텀 지침일 경우 config에서 메타 정보 가져오기
    meta = {
      id: personaId,
      name: config?.name ?? personaId.toUpperCase(),
      emoji: config?.emoji ?? "🤖",
      role: config?.role ?? "Reviewer",
    };
  } else if (config?.builtin !== false && isBuiltInPersona(personaId)) {
    const builtIn = BUILT_IN_PERSONAS[personaId];
    baseGuideline = builtIn.guideline;
    meta = {
      id: builtIn.id,
      name: builtIn.name,
      emoji: builtIn.emoji,
      role: builtIn.role,
    };
  } else {
    throw new Error(
      `Unknown persona: ${personaId}. No custom guideline found and builtin fallback is disabled or unavailable.`,
    );
  }

  // 3. 공통 지침 로드
  const commonGuideline = findCommonGuideline(workspacePath);

  // 4. 지침 합성
  const finalGuideline = mergeGuidelines(baseGuideline, commonGuideline);

  meta = {
    ...meta,
    name: config?.name ?? meta.name,
    emoji: config?.emoji ?? meta.emoji,
    role: config?.role ?? meta.role,
  };

  return {
    ...meta,
    guideline: finalGuideline,
    model: config?.model, // 페르소나별 모델 (미지정 시 undefined)
    provider: config?.provider, // 페르소나별 provider (미지정 시 undefined)
  };
}

/**
 * 기본 3개 페르소나 로드
 */
export async function loadDefaultPersonas(
  workspacePath: string,
): Promise<Persona[]> {
  return Promise.all([
    loadPersona(workspacePath, "melchior"),
    loadPersona(workspacePath, "balthasar"),
    loadPersona(workspacePath, "casper"),
  ]);
}

/**
 * 설정 기반 페르소나 로드
 */
export async function loadPersonasFromConfig(
  workspacePath: string,
  personaConfigs?: PersonaConfig[],
): Promise<Persona[]> {
  if (!personaConfigs || personaConfigs.length === 0) {
    return loadDefaultPersonas(workspacePath);
  }

  return Promise.all(
    personaConfigs.map((config) =>
      loadPersona(workspacePath, config.id, config),
    ),
  );
}
