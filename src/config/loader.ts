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
    return MagiConfigSchema.parse(parsed);
  }

  // 설정 파일이 없으면 기본값 사용
  return MagiConfigSchema.parse({});
}

export function getDefaultConfig(): MagiConfig {
  return MagiConfigSchema.parse({});
}
