import { z } from "zod";
/**
 * MAGI Configuration Schema
 * .github/magi.yml 파일 스키마 정의
 */
export declare const PersonaConfigSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    emoji: z.ZodOptional<z.ZodString>;
    role: z.ZodOptional<z.ZodString>;
    guideline_file: z.ZodOptional<z.ZodString>;
    builtin: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    model: z.ZodOptional<z.ZodString>;
    provider: z.ZodOptional<z.ZodEnum<["gemini", "openai", "claude"]>>;
}, "strip", z.ZodTypeAny, {
    id: string;
    builtin: boolean;
    model?: string | undefined;
    provider?: "gemini" | "openai" | "claude" | undefined;
    name?: string | undefined;
    emoji?: string | undefined;
    role?: string | undefined;
    guideline_file?: string | undefined;
}, {
    id: string;
    model?: string | undefined;
    provider?: "gemini" | "openai" | "claude" | undefined;
    name?: string | undefined;
    emoji?: string | undefined;
    role?: string | undefined;
    guideline_file?: string | undefined;
    builtin?: boolean | undefined;
}>;
export declare const ProviderConfigSchema: z.ZodObject<{
    type: z.ZodDefault<z.ZodEnum<["gemini", "openai", "claude"]>>;
    model: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "gemini" | "openai" | "claude";
    model?: string | undefined;
}, {
    type?: "gemini" | "openai" | "claude" | undefined;
    model?: string | undefined;
}>;
export declare const VotingConfigSchema: z.ZodObject<{
    required_approvals: z.ZodDefault<z.ZodNumber>;
    total_voters: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    required_approvals: number;
    total_voters: number;
}, {
    required_approvals?: number | undefined;
    total_voters?: number | undefined;
}>;
export declare const OutputConfigSchema: z.ZodObject<{
    pr_comment: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        style: z.ZodDefault<z.ZodEnum<["summary", "detailed"]>>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        style: "summary" | "detailed";
    }, {
        enabled?: boolean | undefined;
        style?: "summary" | "detailed" | undefined;
    }>>>;
    labels: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        approved: z.ZodDefault<z.ZodString>;
        rejected: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        approved: string;
        rejected: string;
    }, {
        enabled?: boolean | undefined;
        approved?: string | undefined;
        rejected?: string | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    pr_comment: {
        enabled: boolean;
        style: "summary" | "detailed";
    };
    labels: {
        enabled: boolean;
        approved: string;
        rejected: string;
    };
}, {
    pr_comment?: {
        enabled?: boolean | undefined;
        style?: "summary" | "detailed" | undefined;
    } | undefined;
    labels?: {
        enabled?: boolean | undefined;
        approved?: string | undefined;
        rejected?: string | undefined;
    } | undefined;
}>;
export declare const TieredModelsConfigSchema: z.ZodObject<{
    small: z.ZodOptional<z.ZodString>;
    medium: z.ZodOptional<z.ZodString>;
    large: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    small?: string | undefined;
    medium?: string | undefined;
    large?: string | undefined;
}, {
    small?: string | undefined;
    medium?: string | undefined;
    large?: string | undefined;
}>;
export declare const DebateConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    max_rounds: z.ZodDefault<z.ZodNumber>;
    trigger: z.ZodDefault<z.ZodEnum<["conflict", "disagreement", "always"]>>;
    revote_after_debate: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    max_rounds: number;
    trigger: "conflict" | "disagreement" | "always";
    revote_after_debate: boolean;
}, {
    enabled?: boolean | undefined;
    max_rounds?: number | undefined;
    trigger?: "conflict" | "disagreement" | "always" | undefined;
    revote_after_debate?: boolean | undefined;
}>;
export declare const SlackConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    webhook_url: z.ZodOptional<z.ZodString>;
    notify_on: z.ZodDefault<z.ZodEnum<["all", "rejection", "approval"]>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    notify_on: "all" | "rejection" | "approval";
    webhook_url?: string | undefined;
}, {
    enabled?: boolean | undefined;
    webhook_url?: string | undefined;
    notify_on?: "all" | "rejection" | "approval" | undefined;
}>;
export declare const NotificationsConfigSchema: z.ZodObject<{
    slack: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        webhook_url: z.ZodOptional<z.ZodString>;
        notify_on: z.ZodDefault<z.ZodEnum<["all", "rejection", "approval"]>>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        notify_on: "all" | "rejection" | "approval";
        webhook_url?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        webhook_url?: string | undefined;
        notify_on?: "all" | "rejection" | "approval" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    slack?: {
        enabled: boolean;
        notify_on: "all" | "rejection" | "approval";
        webhook_url?: string | undefined;
    } | undefined;
}, {
    slack?: {
        enabled?: boolean | undefined;
        webhook_url?: string | undefined;
        notify_on?: "all" | "rejection" | "approval" | undefined;
    } | undefined;
}>;
export declare const OptimizationConfigSchema: z.ZodObject<{
    tiered_models: z.ZodOptional<z.ZodObject<{
        small: z.ZodOptional<z.ZodString>;
        medium: z.ZodOptional<z.ZodString>;
        large: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        small?: string | undefined;
        medium?: string | undefined;
        large?: string | undefined;
    }, {
        small?: string | undefined;
        medium?: string | undefined;
        large?: string | undefined;
    }>>;
    context_caching: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    prompt_compression: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    context_caching: boolean;
    prompt_compression: boolean;
    tiered_models?: {
        small?: string | undefined;
        medium?: string | undefined;
        large?: string | undefined;
    } | undefined;
}, {
    tiered_models?: {
        small?: string | undefined;
        medium?: string | undefined;
        large?: string | undefined;
    } | undefined;
    context_caching?: boolean | undefined;
    prompt_compression?: boolean | undefined;
}>;
export declare const MagiConfigSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodNumber>;
    provider: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        type: z.ZodDefault<z.ZodEnum<["gemini", "openai", "claude"]>>;
        model: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "gemini" | "openai" | "claude";
        model?: string | undefined;
    }, {
        type?: "gemini" | "openai" | "claude" | undefined;
        model?: string | undefined;
    }>>>;
    voting: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        required_approvals: z.ZodDefault<z.ZodNumber>;
        total_voters: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        required_approvals: number;
        total_voters: number;
    }, {
        required_approvals?: number | undefined;
        total_voters?: number | undefined;
    }>>>;
    personas: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        emoji: z.ZodOptional<z.ZodString>;
        role: z.ZodOptional<z.ZodString>;
        guideline_file: z.ZodOptional<z.ZodString>;
        builtin: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        model: z.ZodOptional<z.ZodString>;
        provider: z.ZodOptional<z.ZodEnum<["gemini", "openai", "claude"]>>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        builtin: boolean;
        model?: string | undefined;
        provider?: "gemini" | "openai" | "claude" | undefined;
        name?: string | undefined;
        emoji?: string | undefined;
        role?: string | undefined;
        guideline_file?: string | undefined;
    }, {
        id: string;
        model?: string | undefined;
        provider?: "gemini" | "openai" | "claude" | undefined;
        name?: string | undefined;
        emoji?: string | undefined;
        role?: string | undefined;
        guideline_file?: string | undefined;
        builtin?: boolean | undefined;
    }>, "many">>;
    output: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        pr_comment: z.ZodDefault<z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            style: z.ZodDefault<z.ZodEnum<["summary", "detailed"]>>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            style: "summary" | "detailed";
        }, {
            enabled?: boolean | undefined;
            style?: "summary" | "detailed" | undefined;
        }>>>;
        labels: z.ZodDefault<z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            approved: z.ZodDefault<z.ZodString>;
            rejected: z.ZodDefault<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            approved: string;
            rejected: string;
        }, {
            enabled?: boolean | undefined;
            approved?: string | undefined;
            rejected?: string | undefined;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        pr_comment: {
            enabled: boolean;
            style: "summary" | "detailed";
        };
        labels: {
            enabled: boolean;
            approved: string;
            rejected: string;
        };
    }, {
        pr_comment?: {
            enabled?: boolean | undefined;
            style?: "summary" | "detailed" | undefined;
        } | undefined;
        labels?: {
            enabled?: boolean | undefined;
            approved?: string | undefined;
            rejected?: string | undefined;
        } | undefined;
    }>>>;
    optimization: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        tiered_models: z.ZodOptional<z.ZodObject<{
            small: z.ZodOptional<z.ZodString>;
            medium: z.ZodOptional<z.ZodString>;
            large: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            small?: string | undefined;
            medium?: string | undefined;
            large?: string | undefined;
        }, {
            small?: string | undefined;
            medium?: string | undefined;
            large?: string | undefined;
        }>>;
        context_caching: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        prompt_compression: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        context_caching: boolean;
        prompt_compression: boolean;
        tiered_models?: {
            small?: string | undefined;
            medium?: string | undefined;
            large?: string | undefined;
        } | undefined;
    }, {
        tiered_models?: {
            small?: string | undefined;
            medium?: string | undefined;
            large?: string | undefined;
        } | undefined;
        context_caching?: boolean | undefined;
        prompt_compression?: boolean | undefined;
    }>>>;
    debate: z.ZodDefault<z.ZodOptional<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        max_rounds: z.ZodDefault<z.ZodNumber>;
        trigger: z.ZodDefault<z.ZodEnum<["conflict", "disagreement", "always"]>>;
        revote_after_debate: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        max_rounds: number;
        trigger: "conflict" | "disagreement" | "always";
        revote_after_debate: boolean;
    }, {
        enabled?: boolean | undefined;
        max_rounds?: number | undefined;
        trigger?: "conflict" | "disagreement" | "always" | undefined;
        revote_after_debate?: boolean | undefined;
    }>>>;
    notifications: z.ZodOptional<z.ZodObject<{
        slack: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            webhook_url: z.ZodOptional<z.ZodString>;
            notify_on: z.ZodDefault<z.ZodEnum<["all", "rejection", "approval"]>>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            notify_on: "all" | "rejection" | "approval";
            webhook_url?: string | undefined;
        }, {
            enabled?: boolean | undefined;
            webhook_url?: string | undefined;
            notify_on?: "all" | "rejection" | "approval" | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        slack?: {
            enabled: boolean;
            notify_on: "all" | "rejection" | "approval";
            webhook_url?: string | undefined;
        } | undefined;
    }, {
        slack?: {
            enabled?: boolean | undefined;
            webhook_url?: string | undefined;
            notify_on?: "all" | "rejection" | "approval" | undefined;
        } | undefined;
    }>>;
    ignore: z.ZodOptional<z.ZodObject<{
        files: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        paths: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        files?: string[] | undefined;
        paths?: string[] | undefined;
    }, {
        files?: string[] | undefined;
        paths?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    version: number;
    provider: {
        type: "gemini" | "openai" | "claude";
        model?: string | undefined;
    };
    voting: {
        required_approvals: number;
        total_voters: number;
    };
    output: {
        pr_comment: {
            enabled: boolean;
            style: "summary" | "detailed";
        };
        labels: {
            enabled: boolean;
            approved: string;
            rejected: string;
        };
    };
    optimization: {
        context_caching: boolean;
        prompt_compression: boolean;
        tiered_models?: {
            small?: string | undefined;
            medium?: string | undefined;
            large?: string | undefined;
        } | undefined;
    };
    debate: {
        enabled: boolean;
        max_rounds: number;
        trigger: "conflict" | "disagreement" | "always";
        revote_after_debate: boolean;
    };
    personas?: {
        id: string;
        builtin: boolean;
        model?: string | undefined;
        provider?: "gemini" | "openai" | "claude" | undefined;
        name?: string | undefined;
        emoji?: string | undefined;
        role?: string | undefined;
        guideline_file?: string | undefined;
    }[] | undefined;
    notifications?: {
        slack?: {
            enabled: boolean;
            notify_on: "all" | "rejection" | "approval";
            webhook_url?: string | undefined;
        } | undefined;
    } | undefined;
    ignore?: {
        files?: string[] | undefined;
        paths?: string[] | undefined;
    } | undefined;
}, {
    version?: number | undefined;
    provider?: {
        type?: "gemini" | "openai" | "claude" | undefined;
        model?: string | undefined;
    } | undefined;
    voting?: {
        required_approvals?: number | undefined;
        total_voters?: number | undefined;
    } | undefined;
    personas?: {
        id: string;
        model?: string | undefined;
        provider?: "gemini" | "openai" | "claude" | undefined;
        name?: string | undefined;
        emoji?: string | undefined;
        role?: string | undefined;
        guideline_file?: string | undefined;
        builtin?: boolean | undefined;
    }[] | undefined;
    output?: {
        pr_comment?: {
            enabled?: boolean | undefined;
            style?: "summary" | "detailed" | undefined;
        } | undefined;
        labels?: {
            enabled?: boolean | undefined;
            approved?: string | undefined;
            rejected?: string | undefined;
        } | undefined;
    } | undefined;
    optimization?: {
        tiered_models?: {
            small?: string | undefined;
            medium?: string | undefined;
            large?: string | undefined;
        } | undefined;
        context_caching?: boolean | undefined;
        prompt_compression?: boolean | undefined;
    } | undefined;
    debate?: {
        enabled?: boolean | undefined;
        max_rounds?: number | undefined;
        trigger?: "conflict" | "disagreement" | "always" | undefined;
        revote_after_debate?: boolean | undefined;
    } | undefined;
    notifications?: {
        slack?: {
            enabled?: boolean | undefined;
            webhook_url?: string | undefined;
            notify_on?: "all" | "rejection" | "approval" | undefined;
        } | undefined;
    } | undefined;
    ignore?: {
        files?: string[] | undefined;
        paths?: string[] | undefined;
    } | undefined;
}>;
export type MagiConfig = z.infer<typeof MagiConfigSchema>;
export type PersonaConfig = z.infer<typeof PersonaConfigSchema>;
export type ProviderConfigType = z.infer<typeof ProviderConfigSchema>;
export type VotingConfig = z.infer<typeof VotingConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
export type DebateConfig = z.infer<typeof DebateConfigSchema>;
//# sourceMappingURL=schema.d.ts.map