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
  model: z.string().optional(), // 페르소나별 모델 (예: gemini-3-pro, gpt-5.2)
  provider: z.enum(["gemini", "openai", "claude"]).optional(), // 페르소나별 provider
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

export const TieredModelsConfigSchema = z.object({
  small: z.string().optional(), // 1-10줄 (기본: gemini-2.5-flash-lite)
  medium: z.string().optional(), // 11-100줄 (기본: GCP=gemini-3-flash, API=gemini-2.5-flash)
  large: z.string().optional(), // 100줄+ (기본: GCP=gemini-3-pro-preview, API=gemini-2.5-pro)
});

export const DebateConfigSchema = z.object({
  enabled: z.boolean().default(false),
  max_rounds: z.number().default(1),
  trigger: z
    .enum(["conflict", "disagreement", "always"])
    .default("disagreement"),
  revote_after_debate: z.boolean().default(true),
});

export const SlackConfigSchema = z.object({
  enabled: z.boolean().default(false),
  webhook_url: z.string().optional(),
  notify_on: z.enum(["all", "rejection", "approval"]).default("all"),
});

export const NotificationsConfigSchema = z.object({
  slack: SlackConfigSchema.optional(),
});

export const OptimizationConfigSchema = z.object({
  tiered_models: TieredModelsConfigSchema.optional(),
  context_caching: z.boolean().optional().default(true),
  prompt_compression: z.boolean().optional().default(true),
});

export const MagiConfigSchema = z.object({
  version: z.number().default(1),
  provider: ProviderConfigSchema.optional().default({}),
  voting: VotingConfigSchema.optional().default({}),
  personas: z.array(PersonaConfigSchema).optional(),
  output: OutputConfigSchema.optional().default({}),
  optimization: OptimizationConfigSchema.optional().default({}),
  debate: DebateConfigSchema.optional().default({}),
  notifications: NotificationsConfigSchema.optional(),
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
export type DebateConfig = z.infer<typeof DebateConfigSchema>;
