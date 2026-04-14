import { createHash } from "node:crypto";
import path from "node:path";
import { audit, type AuditFormat, type AuditResult } from "bettera11y";
import { minimatch } from "minimatch";
import type { TransformPluginContext } from "rollup";
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

export function bettera11yPlugin(options: BetterA11yViteOptions = {}): Plugin {
    const normalizedOptions = normalizeOptions(options);
    const lastContentHashById = new Map<string, string>();
    let resolvedConfig: ResolvedConfig | undefined;
    let isDevServer = true;

    return {
        name: "vite-plugin-bettera11y",
        /**
         * Must run as `pre` before `@vitejs/plugin-react` (also `pre`) so we audit TSX/JSX source.
         * With `post`, Vite hands us compiled output (e.g. `jsxDEV` / `createElement`) and BetterA11y cannot recover `<img>` etc.
         */
        enforce: "pre",
        configResolved(config) {
            resolvedConfig = config;
            isDevServer = config.command === "serve";
        },
        async transform(code, id) {
            if (!isDevServer) {
                return null;
            }

            const normalizedId = normalizeModuleId(id);
            if (
                !shouldAuditId(normalizedId, normalizedOptions.include, normalizedOptions.exclude, resolvedConfig?.root)
            ) {
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
            emitAccessibilityDiagnostics(
                this,
                runResult.result.diagnostics,
                normalizedId,
                normalizedOptions,
                resolvedConfig
            );

            const hasErrors = runResult.summary.errors > 0;
            if (hasErrors && normalizedOptions.failOnError) {
                this.error({
                    message: `Accessibility errors in ${relativePath(normalizedId, resolvedConfig)} (BetterA11y)`,
                    id: normalizedId
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

/**
 * Emits BetterA11y diagnostics through Vite or Rollup so output matches the dev server style.
 */
function emitAccessibilityDiagnostics(
    context: TransformPluginContext,
    diagnostics: AuditResult["diagnostics"],
    moduleId: string,
    options: BetterA11yNormalizedOptions,
    resolvedConfig?: ResolvedConfig
): void {
    const logger = resolvedConfig?.logger;
    const relativeFile = relativePath(moduleId, resolvedConfig);

    if (diagnostics.length === 0 && options.logLevel === "info" && logger) {
        logger.info(`No accessibility issues in ${relativeFile}`, { timestamp: true });
        return;
    }

    for (const diagnostic of diagnostics) {
        if (diagnostic.severity === "warn" && options.logLevel === "error") {
            continue;
        }
        if (diagnostic.severity === "error" && options.failOnError && options.overlay) {
            continue;
        }

        const message = formatBetterA11yMessage(diagnostic);
        const loc = diagnosticLocationToRollupLoc(diagnostic, moduleId);

        if (options.overlay) {
            context.warn({ message, id: moduleId, loc });
        } else if (logger) {
            const suffix = loc ? ` (${loc.line}:${loc.column})` : "";
            const line = `${relativeFile}${suffix} ${message}`;
            if (diagnostic.severity === "error") {
                logger.error(line, { timestamp: true });
            } else {
                logger.warn(line, { timestamp: true });
            }
        }
    }
}

function formatBetterA11yMessage(diagnostic: AuditResult["diagnostics"][number]): string {
    const rule = diagnostic.ruleId ? ` [${diagnostic.ruleId}]` : "";
    return `${diagnostic.message}${rule}`;
}

function diagnosticLocationToRollupLoc(
    diagnostic: AuditResult["diagnostics"][number],
    moduleId: string
): { file?: string; line: number; column: number } | undefined {
    const start = diagnostic.location?.start;
    if (typeof start?.line !== "number" || typeof start?.column !== "number") {
        return undefined;
    }
    return {
        file: moduleId,
        line: start.line,
        column: Math.max(0, start.column - 1)
    };
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

/**
 * Returns the path used for include/exclude glob matching.
 * Vite passes absolute module ids; user include or exclude globs are written relative to the Vite project root.
 */
export function idForGlobMatching(fileId: string, root?: string): string {
    const toPosix = (value: string): string => value.split(path.sep).join("/");
    if (!root) {
        return toPosix(fileId);
    }
    const rel = path.relative(root, fileId);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
        return toPosix(fileId);
    }
    return toPosix(rel);
}

export function shouldAuditId(id: string, include: string[], exclude: string[], root?: string): boolean {
    if (!id || id.startsWith("\u0000")) {
        return false;
    }
    if (id.includes("/node_modules/") || id.includes("/@id/") || id.includes("/@vite/")) {
        return false;
    }

    const globId = idForGlobMatching(id, root);
    const isIncluded = include.length === 0 || matchesAny(include, globId);
    if (!isIncluded) {
        return false;
    }
    return exclude.length === 0 ? true : !matchesAny(exclude, globId);
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
export { recommendedPreset, strictPreset, wcagAaBaselinePreset } from "bettera11y";
