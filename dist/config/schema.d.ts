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
}, "strip", z.ZodTypeAny, {
    id: string;
    builtin: boolean;
    name?: string | undefined;
    emoji?: string | undefined;
    role?: string | undefined;
    guideline_file?: string | undefined;
}, {
    id: string;
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
    }, "strip", z.ZodTypeAny, {
        id: string;
        builtin: boolean;
        name?: string | undefined;
        emoji?: string | undefined;
        role?: string | undefined;
        guideline_file?: string | undefined;
    }, {
        id: string;
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
    personas?: {
        id: string;
        builtin: boolean;
        name?: string | undefined;
        emoji?: string | undefined;
        role?: string | undefined;
        guideline_file?: string | undefined;
    }[] | undefined;
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
//# sourceMappingURL=schema.d.ts.map