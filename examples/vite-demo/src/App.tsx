import "./App.css";

/**
 * Demo UI for vite-plugin-bettera11y using `recommendedPreset`.
 *
 * Each block is labeled with the rule id it is meant to trigger. Run `npm run dev` from
 * `examples/vite-demo` and watch the terminal (and Vite overlay) for diagnostics.
 *
 * Expected rule ids from this tree (fragment audits; `main-landmark` is skipped for TSX):
 * `duplicate-id`, `heading-order`, `image-alt`, `form-control-label`, `button-accessible-name`,
 * `invalid-aria`, `color-contrast`, `text-readability`.
 */
export default function App() {
    return (
        <main>
            <h1>BetterA11y Vite demo</h1>
            <p>
                Run <code>npm run dev</code> and watch the terminal (and Vite overlay) for diagnostics. This page
                bundles several intentional issues that match the default <code>recommendedPreset</code> rules.
            </p>

            {/* heading-order: jump from h1 to h3 without an h2 */}
            <section aria-labelledby="issues-heading">
                <h3 id="issues-heading">Intentional findings (recommended preset)</h3>

                {/* duplicate-id */}
                <p id="a11y-demo-duplicate">First element reuses the same id as the next paragraph.</p>
                <p id="a11y-demo-duplicate">Second duplicate id (4.1.1).</p>

                {/* image-alt */}
                <p>
                    {/* Intentional: missing alt triggers image-alt */}
                    <img src="https://placehold.co/320x200/1a1a2e/eee?text=demo" />
                    {/* Fixed: add alt="…" or alt="" for decorative images */}
                </p>

                {/* form-control-label: no label, aria-label, or aria-labelledby */}
                <p>
                    <label>
                        Search (unlabeled control next to this label is intentional)
                        <input type="text" name="decoy" />
                    </label>
                    <input type="search" name="q" placeholder="Placeholder is not a label" />
                </p>

                {/* button-accessible-name (not inside <p> — HTML parsing would hoist the button and break the demo) */}
                <div>
                    <button type="button" />
                </div>

                {/* invalid-aria: unknown aria-* attribute name */}
                <p aria-not-a-real-aria-attribute="true">
                    Unknown <code>aria-*</code> attribute on this paragraph.
                </p>

                {/* color-contrast (inline styles on ancestor of text) */}
                <p style={{ color: "#959595", backgroundColor: "#a3a3a3" }}>
                    <span>Inline foreground/background pair below WCAG AA contrast.</span>
                </p>

                {/* color-contrast (CSS file) */}
                <p className="a11y-demo-bad-css-contrast">Low contrast text styled from App.css.</p>

                {/* text-readability: font size and line-height ratio */}
                <p style={{ fontSize: "10px", lineHeight: "12px" }}>
                    Very small type with tight line-height (readability heuristic).
                </p>
            </section>
        </main>
    );
}
