import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import { bettera11yPlugin, recommendedPreset } from "vite-plugin-bettera11y";

export default defineConfig({
    server: {
        hmr: {
            overlay: true
        }
    },
    plugins: [
        // BetterA11y must run before React so transforms see TSX/JSX source (both plugins use `enforce: "pre"`).
        bettera11yPlugin({
            rules: recommendedPreset,
            overlay: true,
            include: ["src/**/*.{tsx,ts,css,html}"],
            logLevel: "warn"
        }) as PluginOption,
        react()
        // Cast: when linking the plugin via `file:../..`, TypeScript can see two distinct `vite` installs
        // (repo root vs this app). Runtime is correct; this aligns `Plugin` types for `tsc -b`.
    ]
});
