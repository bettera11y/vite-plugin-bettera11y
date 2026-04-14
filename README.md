# vite-plugin-bettera11y

Vite plugin for running BetterA11y audits during local development.

## Install

```bash
npm install vite-plugin-bettera11y bettera11y
```

## Usage

```ts
import { defineConfig } from "vite";
import { bettera11yPlugin } from "vite-plugin-bettera11y";
import { recommendedPreset } from "bettera11y";

export default defineConfig({
    plugins: [
        bettera11yPlugin({
            rules: recommendedPreset,
            overlay: true,
            include: ["src/**/*.{html,jsx,tsx,css,scss,md}"],
            exclude: ["**/*.stories.tsx"]
        })
    ]
});
```

## Options

- `include`: glob(s) for files to audit.
- `exclude`: glob(s) to skip.
- `overlay`: emit warnings/errors through Vite for browser overlay visibility.
- `failOnError`: throw when error diagnostics are found (off by default for dev ergonomics).
- `logLevel`: `error`, `warn`, or `info` terminal logging.
- `rules`, `ruleOptions`, `normalizers`: passthrough BetterA11y runtime options.

## Notes

- Audits only run in `vite dev` mode.
- The plugin skips virtual modules and `node_modules`.
