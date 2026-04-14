import { describe, expect, it, vi } from "vitest";
import { recommendedPreset, strictPreset } from "bettera11y";
import { bettera11yPlugin, inferFormatFromId, normalizeModuleId, shouldAuditId } from "../src";

function getHookHandler<T>(hook: unknown): T {
    if (!hook) {
        throw new Error("Expected plugin hook to exist");
    }
    if (typeof hook === "function") {
        return hook as T;
    }
    return (hook as { handler: T }).handler;
}

describe("module id helpers", () => {
    it("normalizes query params from vite module ids", () => {
        expect(normalizeModuleId("/repo/src/App.tsx?t=171310")).toBe("/repo/src/App.tsx");
    });

    it("infers bettera11y formats from extension", () => {
        expect(inferFormatFromId("/repo/src/App.tsx")).toBe("tsx");
        expect(inferFormatFromId("/repo/src/index.html")).toBe("html");
        expect(inferFormatFromId("/repo/src/notes.md")).toBe("markdown");
        expect(inferFormatFromId("/repo/src/theme.scss")).toBe("css");
        expect(inferFormatFromId("/repo/src/file.txt")).toBeNull();
    });

    it("supports extension overrides", () => {
        expect(inferFormatFromId("/repo/src/template.custom", { ".custom": "html" })).toBe("html");
    });

    it("filters ids using include and exclude globs", () => {
        const include = ["**/*.tsx"];
        const exclude = ["**/*.stories.tsx"];
        expect(shouldAuditId("/repo/src/App.tsx", include, exclude)).toBe(true);
        expect(shouldAuditId("/repo/src/App.stories.tsx", include, exclude)).toBe(false);
        expect(shouldAuditId("/repo/node_modules/pkg/index.tsx", include, [])).toBe(false);
        expect(shouldAuditId("\u0000virtual", include, [])).toBe(false);
    });
});

describe("vite plugin transform", () => {
    it("warns for accessibility findings when overlay is enabled", async () => {
        const warn = vi.fn();
        const error = vi.fn((message: unknown) => {
            throw new Error(String(message));
        });
        const plugin = bettera11yPlugin({
            include: ["**/*.html"],
            overlay: true,
            rules: recommendedPreset
        });

        const configResolved = getHookHandler<(config: unknown) => void>(plugin.configResolved);
        configResolved({
            command: "serve",
            root: "/repo"
        });

        const context = { warn, error };
        const transform = getHookHandler<(this: unknown, code: string, id: string) => Promise<unknown>>(
            plugin.transform
        );
        await transform.call(
            context as never,
            "<html><body><img src='/hero.png' /></body></html>",
            "/repo/src/index.html"
        );

        expect(warn).toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    it("skips non-matching files", async () => {
        const warn = vi.fn();
        const error = vi.fn((message: unknown) => {
            throw new Error(String(message));
        });
        const plugin = bettera11yPlugin({
            include: ["**/*.tsx"],
            rules: recommendedPreset
        });
        const context = { warn, error };

        const transform = getHookHandler<(this: unknown, code: string, id: string) => Promise<unknown>>(
            plugin.transform
        );
        await transform.call(context as never, "body {}", "/repo/src/styles.css");

        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
    });

    it("throws on error diagnostics when failOnError is true", async () => {
        const warn = vi.fn();
        const plugin = bettera11yPlugin({
            include: ["**/*.html"],
            failOnError: true,
            rules: strictPreset
        });

        const configResolved = getHookHandler<(config: unknown) => void>(plugin.configResolved);
        configResolved({
            command: "serve",
            root: "/repo"
        });

        const context = {
            warn,
            error: (message: unknown) => {
                throw new Error(typeof message === "string" ? message : JSON.stringify(message));
            }
        };

        const transform = getHookHandler<(this: unknown, code: string, id: string) => Promise<unknown>>(
            plugin.transform
        );
        await expect(
            transform.call(
                context as never,
                "<html><body><img src='/hero.png' /></body></html>",
                "/repo/src/index.html"
            )
        ).rejects.toThrow(/Accessibility errors found/);
    });
});
