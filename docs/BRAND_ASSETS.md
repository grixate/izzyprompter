# IZZY website identity

The website uses the **02 Balanced** master from the supplied
`izzy-logo-asset-pack.zip` (13 October 2026). Production assets were checked
against the pack's SHA-256 checksums and copied without altering the artwork.

`src/assets/brand/` preserves the six production SVGs. `BrandLogo` uses the
dark full logo on paper headers and the warm light full logo on the display.
`RemoteBrand` uses the light wordmark on graphite remote panels. Full logos
render at 140 CSS pixels, or 120 on small screens; remote wordmarks render
at 72. Aspect ratios, internal spacing, orange markers, and clear space are
preserved. Design-lab studies are independent and retain their existing marks.

`public/` contains the SVG and 16/32-pixel favicons, 180-pixel Apple icon,
and 192/512-pixel app icons. The existing `/local` manifest keeps its identity,
start URL, scope, and colors, and uses the new icon entries. It is still linked
only from the local preview. The legacy `offline-icon.svg` URL remains available
with the new favicon artwork for older installations.

The offline worker caches the icons along with the app shell. Component SVGs
are imported through Vite and included in its versioned bundles. Phoenix serves
the public icons with image MIME types and `no-cache`, so future identity
updates are revalidated rather than cached as immutable files.

Logo integration does not change sessions, accounts, scripts, or deployment
configuration. Follow [the release workflow](RELEASE_WORKFLOW.md) for hosted
review and publication; merging this change does not deploy production.
