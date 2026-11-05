# AGENTS.md

Rules for any agent (Claude, Codex, Copilot, or a person) working on Abhishek Pillai's portfolio site. This folder becomes the GitHub Pages site at `shakeabhishek.github.io`. Read this file before changing anything.

The site is plain HTML, CSS and a little JavaScript. No framework, no build step, no package manager.

## 1. Never publish

These never appear on the site, in a commit, in a file name, or in alt text. No exceptions, even if a source file contains them.

- **Phone number.**
- **Email address**, until Abhishek approves one specific address for the site (see section 2).
- **Immigration, visa or work-authorization details** of any kind.
- **The CV PDF itself** (`abhishek-technical-resume.pdf`). It holds private contact details. It stays gitignored. A public resume, if wanted, is a separate redacted file Abhishek approves.
- **The original photo** (`my-photo.jpeg`). Only the processed copy in `assets/img/` is published, resized and with all metadata (EXIF, GPS, device) stripped.
- **Anything about Interplay or Ivy beyond what the CV and LinkedIn already say publicly.** No client or family office names, no internal architecture or tooling details, no security setup, no internal metrics, screenshots, repo names, or incident stories.
- **Secrets of any kind**: API keys, tokens, `.env` files, passwords, internal URLs, hostnames, IP addresses.
- **Other people's information**: colleagues, classmates, professors, family. No names, photos or quotes without their written consent.
- **Private school records**: grades, transcripts, fees, enrollment documents, offer letters, salary or compensation.
- **Home or mailing address.** City-level location ("New York") is fine.
- **Anything from other class projects' private data** (job postings analysis, cover letters, the CV copy in `job-hunt-in-a-folder`).

## 2. Ask Abhishek first

Stop and ask before doing any of these. Approval for one does not carry over to the next.

- **Any `git push`, new repo, GitHub Pages setting, or custom domain.** Nothing goes to GitHub without an explicit "push it" in the current conversation.
- **Any `git commit`.** Commit only when asked.
- **Adding a contact method**: email, phone, calendar link, contact form.
- **Linking or hosting a resume.**
- **Any claim that isn't already on the CV, LinkedIn, or a public GitHub repo.** New metrics, new titles, new dates, "award-winning", "patent-pending" in a new context.
- **Job-search signals** like "open to work" or "looking for roles".
- **Adding analytics, tracking, cookies, embeds, or any third-party script or CDN.**
- **Using any photo other than** `assets/img/abhishek.jpg` and project photos from Abhishek's own public repos.
- **Deleting, renaming or moving files** Abhishek created.
- **Adding a new page or section**, or removing one.

## 3. Facts and sources

- Every claim on the site traces to one of: the CV in this folder, the LinkedIn profile at https://www.linkedin.com/in/abhishek2599/, or a public repo at https://github.com/shakeabhishek.
- Copy numbers exactly as the source states them ("75% to 96%", "16K+"). Never round, combine or invent a number.
- If two sources disagree, use neither and ask.
- When a role or project changes, update the site from the source, not from memory.
- **The home page mirrors the CV**: every section, role and bullet, in the CV's order (Education, Experience, then Additional Information: projects, skills, certifications, volunteering). The only things left out are the items in section 1.
- **Concept pages** in `concepts/` were design explorations. They are gitignored and never published.

## 4. Git safety

This folder currently sits inside the public `gen-ai-in-business` repo, on branch `class-2-portfolio`.

- Never run `git add -A` or `git add .` from the repo root without reading `git status` first.
- `.gitignore` in this folder keeps the CV PDF and original photo out. Check `git check-ignore` before any commit that touches this folder.
- Before any push, scan the diff for a phone number, an email address, and any immigration or visa terms.

## 5. Style

### Voice

- First person, plain and specific. "I built", not "Abhishek is a passionate builder".
- Active voice, sentence case for every heading and button.
- Lead with what was built and what it changed. One concrete number beats three adjectives.
- Banned words: passionate, seasoned, cutting-edge, leverage, synergy, elevate, seamless, unleash, revolutionize, rockstar, ninja, guru.
- No em dashes or en dashes anywhere. Use a period, a comma, a colon, or a plain hyphen.
- No all-caps labels, no numbered section markers (01, 02), no eyebrow label above every heading.
- One label per action across the site. Contact is always "Get in touch". Projects are always "View on GitHub".

### Visual system

The theme is a desk: a dot-grid background, polaroids, sticky notes and tape. Color comes from stationery.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F5F6F2` | `#141821` | The desk |
| `--surface` | `#FFFFFF` | `#1D2230` | Plain cards |
| `--ink` | `#1B1D22` | `#EEF0F4` | Text |
| `--ink-soft` | `#545A66` | `#A7AEBB` | Secondary text |
| `--accent` / `--blue` | `#2340C8` | `#9DB0FF` / `#3E5BE0` | Links, buttons, the blue card |
| `--yellow` | `#FFE27A` | `#F2D46B` | Sticky notes, highlighter, tape |
| `--mint` | `#BFE6D3` | `#A9D9C2` | Sticky notes, highlighter |
| `--coral` | `#FFC2B8` | `#F2B2A7` | Sticky notes, highlighter |

- Notes are paper: text on yellow, mint and coral is always `--note-ink` (`#1B1D22`), in both themes.
- **Only one photo in the hero**: Abhishek's polaroid. Nothing else goes near it.
- Project cards wear their own repo's identity (NeuroHex servo green, Lumi's pink pixel heart and sleeping cat, Argus in its cat mascot's charcoal and coral). Take these from the repo, never invent them.
- Tilts stay small: 3deg at most on the hero photo, 2deg elsewhere.

- **Type:** Geist only (self-hosted in `assets/fonts/`). Weights 400, 500, 600, 700. No second family, no monospace labels.
- **Radius:** paper (polaroids, notes, cards) is 4px, plain cards 14px, buttons and chips are full pills. Nothing else.
- **Theme:** follows the visitor's system setting (light or dark). Every section uses the same theme.
- **Layout:** content max width 1200px, 24px side gutters (16px on phones). Every multi-column layout collapses to one column under 768px. No horizontal page scroll at 360px.
- **Icons:** Phosphor (regular weight) only, inlined as SVG. No emoji.
- **Images:** real photos only. No stock photos, no fake screenshots built from divs, no AI-generated images of Abhishek. Every image has `width`, `height`, and descriptive alt text. Keep each under 250KB.

### Motion

- One page-load sequence on the hero. Sections rise in once as they scroll into view, in pure CSS (`animation-timeline: view()`), so content is never hidden waiting on a script. Nothing loops on the home page.
- A looping animation (like the Connectome concept's network) needs a visible pause button, must stop when off screen or in a hidden tab, and must be a still frame under reduced motion.
- Animate only `transform` and `opacity`. UI transitions 150 to 250ms with `cubic-bezier(0.23, 1, 0.32, 1)`. Buttons scale to 0.97 on press.
- Hover effects only under `@media (hover: hover) and (pointer: fine)`.
- Under `prefers-reduced-motion: reduce`, nothing moves; content is simply visible.

### Accessibility and performance

- WCAG AA contrast in both themes. Visible focus ring on every interactive element. Tap targets at least 44px.
- Semantic HTML: one `h1` per page, landmarks (`header`, `main`, `footer`), a skip link.
- External links open in a new tab with `rel="noopener"` and say so to screen readers.
- No JavaScript is required to read the page. JS only adds motion.

## 6. Before saying it's done

1. Open the page in a browser, in both light and dark mode.
2. Check widths 375px, 768px and 1280px. No horizontal scroll.
3. `grep` the published files for the phone number, `@`, em and en dashes, and immigration or visa terms. Expect no hits.
4. Click every link.
5. List every file created or changed.
