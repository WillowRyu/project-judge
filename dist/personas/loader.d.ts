import { Persona } from "./persona.interface";
import { PersonaConfig } from "../config/schema";
/**
 * 단일 페르소나 로드
 */
export declare function loadPersona(workspacePath: string, personaId: string, config?: PersonaConfig): Promise<Persona>;
/**
 * 기본 3개 페르소나 로드
 */
export declare function loadDefaultPersonas(workspacePath: string): Promise<Persona[]>;
/**
 * 설정 기반 페르소나 로드
 */
export declare function loadPersonasFromConfig(workspacePath: string, personaConfigs?: PersonaConfig[]): Promise<Persona[]>;
//# sourceMappingURL=loader.d.ts.map