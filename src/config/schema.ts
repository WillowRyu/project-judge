import { z } from "zod";

/**
 * MAGI Configuration Schema
 * .github/magi.yml 파일 스키마 정의
 */

const nonEmptyString = z.string().trim().min(1);
const positiveInteger = z.number().finite().int().positive();
const DEFAULT_PERSONA_COUNT = 3;

export const PersonaConfigSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_-]*$/, "Persona IDs must be safe lowercase names"),
  name: nonEmptyString.optional(),
  emoji: nonEmptyString.optional(),
  role: nonEmptyString.optional(),
  guideline_file: nonEmptyString.optional(),
  builtin: z.boolean().optional().default(true),
  model: nonEmptyString.optional(), // 페르소나별 모델 (예: gemini-3.5-flash, gpt-5.5)
  provider: z.enum(["gemini", "openai", "claude"]).optional(), // 페르소나별 provider
}).strict();

export const ProviderConfigSchema = z.object({
  type: z.enum(["gemini", "openai", "claude"]).default("gemini"),
  model: nonEmptyString.optional(),
}).strict();

export const VotingConfigSchema = z.object({
  required_approvals: positiveInteger.default(2),
  total_voters: positiveInteger.optional(),
  fail_on_rejection: z.boolean().default(false),
}).strict();

export const OutputConfigSchema = z.object({
  language: z.enum(["ko", "en"]).default("ko"),
  pr_comment: z
    .object({
      enabled: z.boolean().default(true),
      style: z.enum(["summary", "detailed"]).default("detailed"),
    })
    .strict()
    .optional()
    .default({}),
  labels: z
    .object({
      enabled: z.boolean().default(true),
      approved: nonEmptyString.default("magi-approved"),
      rejected: nonEmptyString.default("magi-changes-requested"),
    })
    .strict()
    .optional()
    .default({}),
}).strict();

export const TieredModelsConfigSchema = z.object({
  small: nonEmptyString.optional(), // 1-10줄 (기본: gemini-3.5-flash-lite)
  medium: nonEmptyString.optional(), // 11-100줄 (기본: gemini-3.5-flash)
  large: nonEmptyString.optional(), // 100줄+ (기본: gemini-3.5-flash)
}).strict();

export const DebateConfigSchema = z.object({
  enabled: z.boolean().default(false),
  max_rounds: z.number().finite().int().min(1).max(5).default(1),
  trigger: z
    .enum(["conflict", "disagreement", "always"])
    .default("disagreement"),
  revote_after_debate: z.boolean().default(true),
}).strict();

export const SlackConfigSchema = z.object({
  enabled: z.boolean().default(false),
  webhook_url: nonEmptyString.optional(),
  notify_on: z.enum(["all", "rejection", "approval"]).default("all"),
}).strict();

export const NotificationsConfigSchema = z.object({
  slack: SlackConfigSchema.optional(),
}).strict();

export const OptimizationConfigSchema = z.object({
  tiered_models: TieredModelsConfigSchema.optional(),
  context_caching: z.boolean().optional().default(true),
  prompt_compression: z.boolean().optional().default(true),
  max_diff_tokens: positiveInteger.default(30000),
  max_tokens_per_file: positiveInteger.default(2500),
  hard_cut: z
    .object({
      enabled: z.boolean().optional().default(true),
      max_changed_files: positiveInteger.optional().default(300),
      max_changed_lines: positiveInteger.optional().default(100000),
    })
    .strict()
    .optional()
    .default({}),
}).strict();

const IgnoreConfigSchema = z.object({
  use_defaults: z.boolean().default(true),
  files: z.array(nonEmptyString).optional(),
  paths: z.array(nonEmptyString).optional(),
}).strict();

const MagiConfigInputSchema = z.object({
  version: z.literal(1).default(1),
  provider: ProviderConfigSchema.optional().default({}),
  voting: VotingConfigSchema.optional().default({}),
  personas: z.array(PersonaConfigSchema).min(1).optional(),
  output: OutputConfigSchema.optional().default({}),
  optimization: OptimizationConfigSchema.optional().default({}),
  debate: DebateConfigSchema.optional().default({}),
  notifications: NotificationsConfigSchema.optional(),
  ignore: IgnoreConfigSchema.optional().default({}),
}).strict();

export const MagiConfigSchema = MagiConfigInputSchema.superRefine((config, ctx) => {
  const personaCount = config.personas?.length ?? DEFAULT_PERSONA_COUNT;
  const ids = new Set<string>();
  for (const [index, persona] of (config.personas ?? []).entries()) {
    if (ids.has(persona.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personas", index, "id"], message: `Duplicate persona ID: ${persona.id}` });
    }
    ids.add(persona.id);
  }
  if (config.voting.required_approvals > personaCount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["voting", "required_approvals"], message: `required_approvals cannot exceed the ${personaCount} configured personas` });
  }
  if (config.voting.total_voters !== undefined && config.voting.total_voters !== personaCount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["voting", "total_voters"], message: `total_voters must equal the ${personaCount} configured personas` });
  }
}).transform((config) => ({
  ...config,
  voting: {
    ...config.voting,
    total_voters: config.voting.total_voters ?? (config.personas?.length ?? DEFAULT_PERSONA_COUNT),
  },
}));

export type MagiConfig = z.infer<typeof MagiConfigSchema>;
export type PersonaConfig = z.infer<typeof PersonaConfigSchema>;
export type ProviderConfigType = z.infer<typeof ProviderConfigSchema>;
export type VotingConfig = z.infer<typeof VotingConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
export type DebateConfig = z.infer<typeof DebateConfigSchema>;
