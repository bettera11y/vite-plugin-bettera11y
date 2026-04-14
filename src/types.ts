import type { AuditFormat, AuditFunctionOptions, AuditResult } from "bettera11y";

export type BetterA11yLogLevel = "error" | "warn" | "info";

export type BetterA11yViteOptions = {
    /**
     * Glob patterns to include for audits.
     */
    include?: string | string[];
    /**
     * Glob patterns to exclude from audits.
     */
    exclude?: string | string[];
    /**
     * If true, emit diagnostics through Vite warning/error channels.
     */
    overlay?: boolean;
    /**
     * If true, throw plugin errors when error-severity diagnostics are found.
     */
    failOnError?: boolean;
    /**
     * Controls terminal logging verbosity.
     */
    logLevel?: BetterA11yLogLevel;
    /**
     * Optional explicit format overrides by extension.
     */
    formatByExtension?: Partial<Record<string, AuditFormat>>;
} & Pick<AuditFunctionOptions, "rules" | "ruleOptions" | "normalizers">;

export type BetterA11yNormalizedOptions = Required<
    Pick<BetterA11yViteOptions, "overlay" | "failOnError" | "logLevel">
> & {
    include: string[];
    exclude: string[];
    formatByExtension: Partial<Record<string, AuditFormat>>;
    rules: AuditFunctionOptions["rules"];
    ruleOptions: AuditFunctionOptions["ruleOptions"];
    normalizers: AuditFunctionOptions["normalizers"];
};

export type BetterA11yDiagnosticSummary = {
    errors: number;
    warnings: number;
};

export type BetterA11yRunResult = {
    result: AuditResult;
    summary: BetterA11yDiagnosticSummary;
};
