---
title: "Themes & white-label"
description: "Re-skin the dashboard with theme packs, or brand it with your own name, logo and accent colour."
---

The dashboard can be restyled and rebranded without touching the component library:
**theme packs** change colours, radius and fonts; **white-label config** changes the
product name, tagline, logo, favicon and accent colour.

## Themes

Dark is the default theme; a light theme is built in, and the colour tokens are OKLCH
with a hex fallback for engines without OKLCH. Contrast of the status colours, the
accent, the focus ring and control borders is verified from the real tokens in both
themes by the `@re-shell/ui` test suite.

### Theme packs

A **theme pack** is a JSON document of design tokens: OKLCH colours for the light and
dark schemes, a corner radius (at most 2rem) and up to three font stacks. Packs are
discoverable on npm through the keyword **`reshell-theme`**.

```bash
re-shell ui theme search ocean
re-shell ui theme install reshell-theme-ocean
re-shell ui theme install ./my-theme.json
re-shell ui theme list
re-shell ui theme remove ocean
```

Every pack is validated before it can reach the page:

- values must match a strict grammar (OKLCH colours, plain font family names), so a
  hostile pack cannot inject CSS;
- unknown tokens are rejected and a document over 64 KiB is rejected;
- **text and background pairs below WCAG 2.x AA contrast are rejected**: an installed
  theme cannot make the dashboard unreadable.

A pack must define `background`, `foreground`, `primary` and `primary-foreground` for
each scheme it supplies; other tokens inherit the built-in value.

There are two places packs are managed, and they are separate:

- **In the dashboard**: Settings, Appearance installs a pack from a URL or a file,
  previews it without saving, applies it, or removes it. The pack is validated first and
  kept in your browser's storage.
- **With the CLI**: `re-shell ui theme ...` validates and stores packs in the workspace
  directory `.re-shell/themes`, and can search npm. No code was found that makes the
  dashboard read that directory, so treat it as a validated, shareable store of packs
  (commit it, or hand the JSON to the dashboard's file install) rather than as the
  dashboard's own list.

Searching and installing from the live npm registry was not exercised while writing
this documentation (the code is tested against fixtures).

## White-label

White-label config rebrands the dashboard. Fields (all optional): `productName`,
`tagline` (up to 60 characters), `logo` and `favicon` (URLs), and `accentColor`.

Sources, highest priority first:

1. Environment variables: `RE_SHELL_BRAND_NAME`, `RE_SHELL_BRAND_TAGLINE`,
   `RE_SHELL_BRAND_LOGO`, `RE_SHELL_BRAND_FAVICON`, `RE_SHELL_BRAND_ACCENT`.
2. A config file in the workspace: `re-shell.whitelabel.json` or
   `.re-shell/whitelabel.json`, or the file named by `RE_SHELL_WHITE_LABEL_FILE`.

```json
{
  "productName": "Acme Console",
  "tagline": "Internal platform",
  "logo": "https://assets.acme.example/logo.svg",
  "favicon": "https://assets.acme.example/favicon.svg",
  "accentColor": "#4f46e5"
}
```

The config is applied **at build time** (the dashboard build) and **at serve time**
(`re-shell ui` re-brands a prebuilt dashboard without rebuilding it). Invalid config
fails with every reason listed rather than being half-applied. The accent colour must
have at least 3:1 contrast against the page to be accepted, and a readable foreground
ink for text on it is derived automatically.

## See also

- [ui](/re-shell/cli/ui/): `ui theme` and the other `ui` subcommands.
- [Dashboard](/re-shell/dashboard/overview/)
