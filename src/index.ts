import { createHash } from "node:crypto";
import path from "node:path";
import { audit, type AuditFormat, type AuditResult } from "bettera11y";
import { minimatch } from "minimatch";
import type { Plugin, ResolvedConfig } from "vite";
import type { BetterA11yNormalizedOptions, BetterA11yRunResult, BetterA11yViteOptions } from "./types";

const DEFAULT_INCLUDE = ["**/*.{html,htm,md,markdown,jsx,tsx,css,scss,sass,less}"];
const DEFAULT_EXCLUDE = ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.vite/**"];
const DEFAULT_LOG_LEVEL = "warn";

const EXTENSION_TO_FORMAT: Record<string, AuditFormat> = {
    ".html": "html",
    ".htm": "html",
    ".md": "markdown",
    ".markdown": "markdown",
    ".jsx": "jsx",
    ".tsx": "tsx",
    ".css": "css",
    ".scss": "css",
    ".sass": "css",
    ".less": "css"
};

type PluginContextLike = {
    warn: (message: string | { message: string }) => void;
    error: (message: string | { message: string }) => never;
};

export function bettera11yPlugin(options: BetterA11yViteOptions = {}): Plugin {
    const normalizedOptions = normalizeOptions(options);
    const lastContentHashById = new Map<string, string>();
    let resolvedConfig: ResolvedConfig | undefined;
    let isDevServer = true;

    return {
        name: "vite-plugin-bettera11y",
        enforce: "post",
        configResolved(config) {
            resolvedConfig = config;
            isDevServer = config.command === "serve";
        },
        async transform(code, id) {
            if (!isDevServer) {
                return null;
            }

            const normalizedId = normalizeModuleId(id);
            if (!shouldAuditId(normalizedId, normalizedOptions.include, normalizedOptions.exclude)) {
                return null;
            }

            const contentHash = hashContent(code);
            if (lastContentHashById.get(normalizedId) === contentHash) {
                return null;
            }
            lastContentHashById.set(normalizedId, contentHash);

            const format = inferFormatFromId(normalizedId, normalizedOptions.formatByExtension);
            if (!format) {
                return null;
            }

            const runResult = await runAudit(code, normalizedId, format, normalizedOptions);
            reportToTerminal(runResult, normalizedId, normalizedOptions.logLevel);
            reportToOverlay(this, runResult.result.diagnostics, normalizedId, normalizedOptions);

            const hasErrors = runResult.summary.errors > 0;
            if (hasErrors && normalizedOptions.failOnError) {
                this.error({
                    message: `[bettera11y] Accessibility errors found in ${relativePath(normalizedId, resolvedConfig)}`
                });
            }

            return null;
        }
    };
}

async function runAudit(
    code: string,
    filepath: string,
    format: AuditFormat,
    options: BetterA11yNormalizedOptions
): Promise<BetterA11yRunResult> {
    const result = await audit(code, {
        filepath,
        format,
        rules: options.rules,
        ruleOptions: options.ruleOptions,
        normalizers: options.normalizers
    });
    const summary = summarizeDiagnostics(result);
    return { result, summary };
}

function summarizeDiagnostics(result: AuditResult): BetterA11yRunResult["summary"] {
    let errors = 0;
    let warnings = 0;
    for (const diagnostic of result.diagnostics) {
        if (diagnostic.severity === "error") {
            errors += 1;
        } else {
            warnings += 1;
        }
    }
    return { errors, warnings };
}

function reportToTerminal(
    result: BetterA11yRunResult,
    id: string,
    logLevel: BetterA11yNormalizedOptions["logLevel"]
): void {
    const total = result.summary.errors + result.summary.warnings;
    if (total === 0 && logLevel !== "info") {
        return;
    }

    const prefix = "[bettera11y]";
    const file = relativePath(id);
    if (total === 0) {
        // eslint-disable-next-line no-console
        console.info(`${prefix} ${file}: no accessibility issues found`);
        return;
    }

    for (const diagnostic of result.result.diagnostics) {
        if (diagnostic.severity === "warn" && logLevel === "error") {
            continue;
        }
        const location = formatLocation(diagnostic);
        const ruleId = diagnostic.ruleId ?? "unknown-rule";
        const line = `${prefix} ${file}${location} ${diagnostic.severity.toUpperCase()} ${ruleId} ${diagnostic.message}`;
        if (diagnostic.severity === "error") {
            // eslint-disable-next-line no-console
            console.error(line);
        } else {
            // eslint-disable-next-line no-console
            console.warn(line);
        }
    }
}

function reportToOverlay(
    context: PluginContextLike,
    diagnostics: AuditResult["diagnostics"],
    id: string,
    options: BetterA11yNormalizedOptions
): void {
    if (!options.overlay) {
        return;
    }

    for (const diagnostic of diagnostics) {
        const file = relativePath(id);
        const message = `[bettera11y] ${file} ${diagnostic.message}`;
        if (diagnostic.severity === "error") {
            if (options.failOnError) {
                continue;
            }
            context.warn({ message });
            continue;
        }
        context.warn({ message });
    }
}

function formatLocation(diagnostic: AuditResult["diagnostics"][number]): string {
    const line = diagnostic.location?.start?.line;
    const column = diagnostic.location?.start?.column;
    if (typeof line === "number" && typeof column === "number") {
        return `:${line}:${column}`;
    }
    if (typeof line === "number") {
        return `:${line}`;
    }
    return "";
}

function normalizeOptions(options: BetterA11yViteOptions): BetterA11yNormalizedOptions {
    return {
        include: toArray(options.include, DEFAULT_INCLUDE),
        exclude: toArray(options.exclude, DEFAULT_EXCLUDE),
        overlay: options.overlay ?? true,
        failOnError: options.failOnError ?? false,
        logLevel: options.logLevel ?? DEFAULT_LOG_LEVEL,
        formatByExtension: options.formatByExtension ?? {},
        rules: options.rules,
        ruleOptions: options.ruleOptions,
        normalizers: options.normalizers
    };
}

function toArray(value: string | string[] | undefined, defaults: string[]): string[] {
    if (!value) {
        return [...defaults];
    }
    return Array.isArray(value) ? value : [value];
}

function hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex");
}

function relativePath(fileId: string, resolvedConfig?: ResolvedConfig): string {
    const root = resolvedConfig?.root ?? process.cwd();
    return path.relative(root, fileId) || fileId;
}

export function normalizeModuleId(id: string): string {
    return id.replace(/\?.*$/, "");
}

export function shouldAuditId(id: string, include: string[], exclude: string[]): boolean {
    if (!id || id.startsWith("\u0000")) {
        return false;
    }
    if (id.includes("/node_modules/") || id.includes("/@id/") || id.includes("/@vite/")) {
        return false;
    }

    const isIncluded = include.length === 0 || matchesAny(include, id);
    if (!isIncluded) {
        return false;
    }
    return exclude.length === 0 ? true : !matchesAny(exclude, id);
}

export function inferFormatFromId(
    id: string,
    overrides: Partial<Record<string, AuditFormat>> = {}
): AuditFormat | null {
    const extension = path.extname(id).toLowerCase();
    if (overrides[extension]) {
        return overrides[extension] ?? null;
    }
    return EXTENSION_TO_FORMAT[extension] ?? null;
}

function matchesAny(patterns: string[], id: string): boolean {
    return patterns.some((pattern) => minimatch(id, pattern, { dot: true }));
}

export type { BetterA11yViteOptions } from "./types";
