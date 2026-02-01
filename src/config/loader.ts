import * as fs from "fs";
import * as path from "path";
import * as yaml from "yaml";
import { MagiConfigSchema, MagiConfig } from "./schema";

/**
 * Configuration Loader
 * magi.yml 파일을 로드하고 검증
 */

const DEFAULT_CONFIG_PATHS = [
  ".github/magi.yml",
  ".github/magi.yaml",
  ".magi.yml",
  ".magi.yaml",
];

// 기본 무시 패턴 - 빌드 결과물 및 의존성
const DEFAULT_IGNORE_PATTERNS = [
  "dist/**",
  "build/**",
  "node_modules/**",
  "*.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "*.min.js",
  "*.min.css",
  "*.d.ts.map",
  "*.js.map",
];

export async function loadConfig(
  workspacePath: string,
  configPath?: string,
): Promise<MagiConfig> {
  let configFile: string | null = null;

  if (configPath) {
    const fullPath = path.join(workspacePath, configPath);
    if (fs.existsSync(fullPath)) {
      configFile = fullPath;
    }
  } else {
    for (const defaultPath of DEFAULT_CONFIG_PATHS) {
      const fullPath = path.join(workspacePath, defaultPath);
      if (fs.existsSync(fullPath)) {
        configFile = fullPath;
        break;
      }
    }
  }

  if (configFile) {
    const content = fs.readFileSync(configFile, "utf-8");
    const parsed = yaml.parse(content);
    const config = MagiConfigSchema.parse(parsed);

    // 기본 무시 패턴과 사용자 설정 병합
    config.ignore = {
      files: [...DEFAULT_IGNORE_PATTERNS, ...(config.ignore?.files || [])],
      paths: config.ignore?.paths || [],
    };

    return config;
  }

  // 설정 파일이 없으면 기본값 + 기본 무시 패턴 사용
  const defaultConfig = MagiConfigSchema.parse({});
  defaultConfig.ignore = {
    files: DEFAULT_IGNORE_PATTERNS,
    paths: [],
  };
  return defaultConfig;
}

export function getDefaultConfig(): MagiConfig {
  return MagiConfigSchema.parse({});
}
