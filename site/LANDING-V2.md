# Re-Shell Landing V2 — Concept Lock (W16-1)

> **Direction (locked):** Dark mission-control — *one product* (CLI + dashboard + docs are three
> surfaces of the same system). Premium, intentional, anti-slop. Built entirely from the existing
> token system (`site/src/styles/theme.css` + `landing.css` + `docs/design/dashboard-design.md`):
> electric-lime `--signal` (#c4f042 / oklch 0.86 0.21 130), layered near-black `--bg-0..3`, hairline
> borders + soft glow, status colors, Space Grotesk (display) / JetBrains Mono (data) / Inter (body).
> Dark default; the existing light theme stays correct. All interactivity is **vanilla TS in Astro
> `<script>` tags**, progressively enhanced (sensible static state with JS off), typed (no `any`),
> fully static (GitHub Pages, base `/re-shell`), and **all motion respects `prefers-reduced-motion`**.

---

## 1. Research — best-in-class interactive dev-tool landings

Reviewed: **bun.sh**, **warp.dev**, **railway.com**, **raycast.com** (plus prior knowledge of
turbo.build / prisma.io / clerk.com). Concrete, tasteful patterns worth adapting:

| # | Pattern | Where seen | Adapt for Re-Shell |
|---|---------|-----------|--------------------|
| **P1** | **Animated benchmark bars + big numeric metrics** ("59,026 req/s", bars fill on view) | bun.sh | Count-up stat band (templates / languages / command groups / startup ms), mono numerals filling from 0 on scroll. |
| **P2** | **Card/tab product switcher** ("Four tools, one toolkit"; "Why Warp" tabs cycling product mocks) | bun.sh, warp.dev | Browser-hero **tabbed dashboard mock** (Overview / Graph / Jobs & Logs) — built from tokens, not screenshots. |
| **P3** | **Tabbed code/example playground** with syntax-highlighted real code, one-click copy | bun.sh | **Terminal Playground**: clickable command chips that type a real command + reveal canned realistic output, per-command copy. |
| **P4** | **Interactive infra "Canvas" graph** (services render as a node graph) | railway.com | Graph tab inside the browser-hero mock — a small workspace topology (nodes + edges, active path in signal). |
| **P5** | **Gamified exploration** ("What else can X do?" rotating discovery cards; extension category tabs) | raycast.com, bun.sh | **"Explored N/total commands"** progress meter + reward micro-pulse when all command chips are tried. |
| **P6** | **Scroll-driven progressive storytelling** (hero → social proof → benchmarks → features → use-cases → CTA) | bun.sh, raycast.com | Keep the existing reveal/stagger, extend with the new sections in a deliberate narrative order. |
| **P7** | **Tactile hero artifact** (Raycast keyboard; Bun mascot) — one memorable, on-brand centerpiece | raycast.com, bun.sh | The **realistic browser window** framing the live dashboard mock *is* our centerpiece. |
| **P8** | **Config/stack composition affordance** (platform-detected install, OS-specific commands) | bun.sh, warp.dev | **Build-Your-Stack** composer → live `re-shell create …` command with copy. |

### What to AVOID (anti-slop guardrails)
- **No gimmick autoplay that hijacks the page** — typewriter/auto-cycle must be ambient, pausable, and *off* under reduced-motion.
- **No fake/inaccurate output** — every command + number must be real (CLI facts: 205 templates · 36 languages · 27 command groups · ~43ms startup; typed `{ ok, data, warnings }`; 127.0.0.1 dashboard).
- **No layout-thrash animation** — animate only `transform`/`opacity`/`clip-path`/`color`; never width/height/top/left.
- **No rainbow** — one `--signal` accent used semantically; status colors only for status.
- **No "dashboard-by-numbers" generic look** — keep mixed bento spans, hairlines, real depth.
- **No heavy deps / no charts lib / no canvas-WebGL** — SVG + CSS only.
- **No motion that blocks reading** — count-up and typewriter complete fast; controls remain keyboard-operable; reduced-motion shows final state instantly.
- **No carousel that traps focus** — discovery/cycling is supplemental, never the only path to content.

---

## 2. Audit of the current landing — what to upgrade

Current `index.astro` + `landing.css` are already strong (token-correct, accessible, reduced-motion-guarded,
semantic). They are **static**. Upgrades for V2:

| Area | Today | V2 upgrade |
|------|-------|-----------|
| **Hero visual** | Static `.lp-window` dashboard recreation (single fixed view) | Realistic **browser chrome** (3 traffic-light dots, URL bar `https://localhost:3333` + lock glyph + tab "Re-Shell — overview") framing an **interactive tabbed** mock (Overview / Graph / Jobs & Logs). |
| **Command tour** | 4 static `<pre>` terminal blocks | **Terminal Playground**: one terminal + clickable command chips, typewriter reveal, per-command copy, exploration progress + reward. |
| **Trust band** | Static `<dl>` numbers (205 / 36 / 171 / 127.0.0.1) | **Count-up** stats animating 0→target on scroll (205 templates · 36 languages · 27 command groups · ~43ms startup), mono tabular numerals. |
| **Quickstart** | Static command list | **Build-Your-Stack** composer (frontend + backend + infra → live `re-shell create` command + copy). |
| **Graph** | none | Small SVG **workspace topology** inside the hero Graph tab (P4). |
| **Motion** | reveal + stagger + live pulse (good) | Keep; add hero parallax/depth (transform-only), chip hover/active states, tab cross-fade — all reduced-motion-guarded. |
| **Reuse** | n/a | Reuse existing tokens, `.lp-*` classes, copy-button JS, IntersectionObserver reveal, theme toggle, skip link. No new files needed beyond the new sections + scripts. |

---

## 3. V2 spec — component contracts

All components are server-rendered with a **sensible static default** (the state shown with JS disabled),
then progressively enhanced. State lives in `data-*` attributes / classes toggled by typed vanilla TS.

### 3.1 BROWSER HERO — interactive tabbed dashboard mock

**Markup contract** (replaces `.lp-window`; add `.lp-browser`):

```
<figure class="lp-browser" role="group" aria-label="Re-Shell local dashboard preview">
  <div class="lp-browser__chrome">
    <span class="lp-dot lp-dot--r"></span><span class="lp-dot lp-dot--y"></span><span class="lp-dot lp-dot--g"></span>
    <div class="lp-browser__tab" aria-hidden="true">Re-Shell — overview</div>
    <div class="lp-browser__url">
      <svg class="lp-lock" …/>            <!-- closed-padlock glyph -->
      <span>https://localhost:3333</span>
      <span class="lp-win-live"><span class="lp-live-dot"></span>live</span>
    </div>
  </div>
  <div class="lp-browser__viewport">
    <div role="tablist" aria-label="Dashboard views" class="lp-tabs">
      <button role="tab" id="tab-overview" aria-selected="true"  aria-controls="panel-overview">Overview</button>
      <button role="tab" id="tab-graph"    aria-selected="false" aria-controls="panel-graph">Graph</button>
      <button role="tab" id="tab-jobs"     aria-selected="false" aria-controls="panel-jobs">Jobs &amp; Logs</button>
    </div>
    <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview"> … bento tiles … </div>
    <div id="panel-graph"    role="tabpanel" aria-labelledby="tab-graph"    hidden> … SVG topology … </div>
    <div id="panel-jobs"     role="tabpanel" aria-labelledby="tab-jobs"     hidden> … jobs table + log stream … </div>
  </div>
</figure>
```

**Panels (all from tokens, real content):**
- **Overview** — reuse the existing bento (Workspaces 12 ✓ + sparkline, Health 36/36, Drift 2 warn, recent jobs strip, mini-term `workspace summary --json`).
- **Graph** — inline **SVG** topology: ~6 nodes (`web-shell`, `admin`, `api`, `auth`, `payments`, `gateway`) as `surface-raised` rounded rects with status dots; edges in `--border-strong`, **active path in `--signal`** with an animated dash (`stroke-dasharray`, paused under reduced-motion). `viewBox` scales; faint dot-grid background via CSS.
- **Jobs & Logs** — dense jobs table (mono ids/durations, `.lp-badge` per row) beside a short streaming log console (`--bg-0`, mono, level-colored lines). Running row shows the live signal dot.

**Behavior contract (vanilla TS):**
- Roving-tabindex tablist: ArrowLeft/Right move, Home/End jump, Enter/Space activate; only active tab is `tabindex=0`.
- `selectTab(id)`: set `aria-selected`, toggle `hidden` on panels, update `.lp-browser__tab` label + URL hash fragment (`#overview`), cross-fade via `opacity`/`transform` (≤200ms, `--ease-out-expo`).
- **Reduced-motion:** instant swap (no fade, no dash animation). **JS off:** Overview panel visible, others `hidden` — still a valid static hero.
- Optional ambient auto-advance (8s) that **stops permanently on first user interaction** and never runs under reduced-motion.

**Style contract:** new `.lp-browser*` classes extend `.lp-window`; `--bg-2` chrome, `--bg-0` viewport, hairline borders, `--signal` edge glow (`::after`), URL bar in JetBrains Mono `--muted-foreground`, lock glyph in `--status-healthy`. Tabs reuse the dashboard active-row treatment (signal text + underline indicator + glow).

### 3.2 TERMINAL PLAYGROUND — gamified command explorer

**Markup contract:**

```
<section class="lp-playground" id="playground">
  <div class="lp-pg__chips" role="group" aria-label="Try a command">
    <button class="lp-pg-chip" data-cmd="workspace summary --json" aria-pressed="false">workspace summary --json</button>
    <button class="lp-pg-chip" data-cmd="templates list">templates list</button>
    <button class="lp-pg-chip" data-cmd="doctor">doctor</button>
    <button class="lp-pg-chip" data-cmd="ui">re-shell ui</button>
    <button class="lp-pg-chip" data-cmd="create acme --framework react">create …</button>
  </div>
  <div class="lp-term lp-pg__term">
    <div class="lp-term__bar"> dots + <span class="lp-term__title" id="pg-title">workspace summary --json</span>
      <button class="lp-copy" data-copy="re-shell workspace summary --json" aria-label="Copy command">…</button>
    </div>
    <div class="lp-term__body" aria-live="polite">
      <div class="lp-pg__line"><span class="lp-prompt">$</span> re-shell <span id="pg-typed">workspace summary --json</span><span class="lp-caret" aria-hidden="true"></span></div>
      <pre id="pg-output" class="lp-pg__out"> … canned realistic output … </pre>
    </div>
  </div>
  <div class="lp-pg__meter">
    <div class="lp-pg__bar"><span id="pg-fill" style="--p:20%"></span></div>
    <span class="lp-pg__count">explored <b id="pg-n">1</b>/<b id="pg-total">5</b> commands</span>
  </div>
</section>
```

**Canned output set (real, typed):** `workspace summary --json` → `{ ok, data:{ workspaces:12, graph:{nodes,edges}, health:"healthy" }, warnings:[] }`; `templates list` → `📋 Templates (205)` + sample rows + `36 languages · 171 frameworks`; `doctor` → check rows + `36/36`, `--fix` hint; `ui` → loopback host / port 3333 / token / ready URL; `create …` → scaffold tree + next steps. (Reuse the strings already in the current command tour.)

**Behavior contract (vanilla TS):**
- Click/Enter a chip → `runCommand(cmd)`: typewriter into `#pg-typed` (char step ~28ms, total ≤700ms), blinking caret, then reveal `#pg-output` (fade/clip-reveal), update `#pg-title` + copy `data-copy`, set chip `aria-pressed=true`.
- **Exploration meter:** track a `Set<string>` of tried commands; update `#pg-n` + `--p` (`tried/total*100%`). When all tried → add `.is-complete` (single tasteful **reward micro-pulse**: signal ring/glow + "✓ all explored" badge), pulse fires once.
- **Per-command copy** via existing `.lp-copy` handler (writes the full `re-shell <cmd>`).
- **Reduced-motion:** no typewriter (command appears instantly), no caret blink, output appears instantly, reward = static state change (no pulse).
- **JS off:** first command + its output rendered statically; chips are anchor-like (no-op) but the panel reads as a real terminal.
- Optional gentle autoplay cycling chips every ~5s until first interaction; never under reduced-motion.

**Style contract:** chips = `.cli-chip`-style (mono, `--bg-0`, hairline; hover `--border-strong`; `aria-pressed=true` → signal tint + check). Meter bar = hairline track with `--signal` fill (`transform: scaleX` or `width` on a clipped span — prefer `transform`), `transition` guarded. Caret = 1px signal block, `lp-blink` keyframe.

### 3.3 COUNT-UP STATS

**Markup contract** (band; can replace/augment `.lp-trust`):

```
<dl class="lp-stats lp-reveal">
  <div class="lp-stat"><dt class="lp-stat__num lp-accent" data-count="205" data-suffix="">0</dt><dd>framework templates</dd></div>
  <div class="lp-stat"><dt class="lp-stat__num" data-count="36">0</dt><dd>languages</dd></div>
  <div class="lp-stat"><dt class="lp-stat__num" data-count="27">0</dt><dd>command groups</dd></div>
  <div class="lp-stat"><dt class="lp-stat__num" data-count="43" data-prefix="~" data-suffix="ms">0</dt><dd>cold startup</dd></div>
</dl>
```

**Behavior contract:** single `IntersectionObserver` (threshold ~0.4, once) → `requestAnimationFrame` count-up (ease-out, ~900ms) writing integer values with optional `data-prefix`/`data-suffix`. Numbers in JetBrains Mono `tabular-nums` so width doesn't jitter. **Reduced-motion / no JS:** render the final target immediately (set text content to target on load when reduced, or just print target in markup and let JS animate from 0 only when motion is allowed).

### 3.4 BUILD-YOUR-STACK composer

**Markup contract:**

```
<section class="lp-builder" id="builder">
  <fieldset><legend>Frontend</legend>
    <!-- radio pills --> React · Vue · Svelte · Angular
  </fieldset>
  <fieldset><legend>Backend</legend>
    FastAPI · Express · NestJS · Spring · Gin · Actix
  </fieldset>
  <fieldset><legend>Infra</legend>
    <!-- checkboxes --> Kubernetes · Helm · GitOps
  </fieldset>
  <div class="lp-builder__preview lp-term">
    <div class="lp-term__bar"> dots <span class="lp-term__title">your stack</span>
      <button class="lp-copy" id="builder-copy" aria-label="Copy generated command">…</button>
    </div>
    <pre id="builder-cmd" class="lp-term__body" aria-live="polite"> … composed command … </pre>
  </div>
</section>
```

**Composition logic (typed):** map selections → a real multi-line command, e.g.
```
re-shell init acme-platform
re-shell add web-shell  --framework react
re-shell service api    --template fastapi
re-shell generate k8s helm gitops
```
- Frontend = single radio (default React); Backend = single radio (default FastAPI); Infra = 0..n checkboxes (omit the `generate` line if none).
- On any change → recompute the `<pre>` text + update `#builder-copy` `data-copy`. Brief `log-flash` highlight on update (guarded).
- **Reduced-motion / no JS:** default selections render a valid default command server-side; controls are native radio/checkbox so they work without JS, only the live preview text needs JS (static default shown otherwise).

**Pill/option contract:** native `<input type=radio|checkbox>` visually styled as pills (`.cli-chip`-like); `:checked` → signal tint + ring; keyboard + screen-reader native; visible focus.

### 3.5 MOTION system (all reduced-motion-guarded)

- **Scroll reveal / stagger** — reuse existing `.lp-reveal` + `.lp-stagger` + IntersectionObserver.
- **Hero depth** — subtle transform-only parallax / float on the browser window (small `translateY` tied to scroll via rAF, capped); skip entirely under reduced-motion.
- **Tab cross-fade** — `opacity` + small `translateY`, ≤200ms.
- **Typewriter + caret blink** — Terminal Playground only; off under reduced-motion.
- **Count-up** — rAF ease-out; static target under reduced-motion.
- **Reward micro-pulse** — one-shot signal ring on full exploration; static under reduced-motion.
- **Graph edge dash** — animated `stroke-dashoffset` on the active path; static under reduced-motion.
- **Hover/focus/active** — chips, tabs, pills, buttons all get designed states + visible `--ring` focus.
- Global guard already present in `landing.css` (`@media (prefers-reduced-motion: reduce)`); extend it to neutralize the new keyframes (`lp-blink`, dash, parallax, count-up).

---

## 4. Gamification mechanics chosen (report)

1. **Command exploration meter + reward (primary mechanic).** The Terminal Playground tracks which
   real commands the visitor has tried (`Set` of 5). A hairline progress bar fills with `--signal` and
   an `explored N/5 commands` counter updates on each new command. Trying all five triggers a single,
   tasteful **reward micro-pulse** (signal ring/glow + "✓ all explored" badge). This turns the
   command tour into low-pressure, self-directed discovery — adapted from Raycast/Bun "what else can it
   do?" discovery cards (P5), but grounded in *real* CLI commands and output (no fake fluff).

2. **Interactive product tabs as playful exploration (secondary).** The browser-hero's Overview /
   Graph / Jobs & Logs tabs let visitors poke the product themselves (P2) — including a live-feeling
   topology graph (P4) — instead of watching a static screenshot.

3. **Count-up stats as a "score reveal" (tertiary).** Numbers animate 0→target on scroll (P1), giving
   the credibility band a satisfying, benchmark-style payoff in mono numerals.

4. **Build-Your-Stack as a configurator mini-game (tertiary).** Picking frontend/backend/infra
   live-composes a real, copyable `re-shell create` command (P8) — immediate, tangible payoff that
   doubles as a genuinely useful quickstart.

All four are **progressive enhancements**: the page is complete, accurate, and accessible with JS
disabled or motion reduced — the gamification only adds delight on top of a solid static baseline.
