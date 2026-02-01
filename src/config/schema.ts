import { z } from "zod";

/**
 * MAGI Configuration Schema
 * .github/magi.yml 파일 스키마 정의
 */

export const PersonaConfigSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  emoji: z.string().optional(),
  role: z.string().optional(),
  guideline_file: z.string().optional(),
  builtin: z.boolean().optional().default(true),
});

export const ProviderConfigSchema = z.object({
  type: z.enum(["gemini", "openai", "claude"]).default("gemini"),
  model: z.string().optional(),
});

export const VotingConfigSchema = z.object({
  required_approvals: z.number().default(2),
  total_voters: z.number().default(3),
});

export const OutputConfigSchema = z.object({
  pr_comment: z
    .object({
      enabled: z.boolean().default(true),
      style: z.enum(["summary", "detailed"]).default("detailed"),
    })
    .optional()
    .default({}),
  labels: z
    .object({
      enabled: z.boolean().default(true),
      approved: z.string().default("magi-approved"),
      rejected: z.string().default("magi-changes-requested"),
    })
    .optional()
    .default({}),
});

export const MagiConfigSchema = z.object({
  version: z.number().default(1),
  provider: ProviderConfigSchema.optional().default({}),
  voting: VotingConfigSchema.optional().default({}),
  personas: z.array(PersonaConfigSchema).optional(),
  output: OutputConfigSchema.optional().default({}),
  ignore: z
    .object({
      files: z.array(z.string()).optional(),
      paths: z.array(z.string()).optional(),
    })
    .optional(),
});

export type MagiConfig = z.infer<typeof MagiConfigSchema>;
export type PersonaConfig = z.infer<typeof PersonaConfigSchema>;
export type ProviderConfigType = z.infer<typeof ProviderConfigSchema>;
export type VotingConfig = z.infer<typeof VotingConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
