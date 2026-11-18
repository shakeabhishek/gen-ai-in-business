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
- **Adding analytics, tracking, cookies, embeds, or any third-party script or CDN.** (Pretext, self-hosted in `assets/vendor/`, was approved on 2026-11-18.)
- **Using any photo other than** `assets/img/abhishek.jpg` and project photos from Abhishek's own public repos.
- **Deleting, renaming or moving files** Abhishek created.
- **Adding a new page or section**, or removing one.

## 3. Facts and sources

- Every claim on the site traces to one of: the CV in this folder, the LinkedIn profile at https://www.linkedin.com/in/abhishek2599/, or a public repo at https://github.com/shakeabhishek.
- Copy numbers exactly as the source states them ("75% to 96%", "16K+"). Never round, combine or invent a number.
- If two sources disagree, use neither and ask.
- When a role or project changes, update the site from the source, not from memory.
- **The home page mirrors the CV**: every section, role and bullet, in the CV's order (Education, Experience, then Additional Information: projects, skills, certifications, volunteering). The only things left out are the items in section 1.

## 4. Git safety

This folder currently sits inside the public `gen-ai-in-business` repo, on branch `class-2-portfolio`.

- Never run `git add -A` or `git add .` from the repo root without reading `git status` first.
- `.gitignore` in this folder keeps the CV PDF and original photo out. Check `git check-ignore` before any commit that touches this folder.
- Before any push, scan the diff for a phone number, an email address, and any immigration or visa terms.
- Before any publish, run `python3 scripts/stamp_assets.py`. It versions the CSS and JS links so visitors never get a new page with a cached old stylesheet (GitHub Pages caches files for 10 minutes).

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

A dark editorial design portfolio: midnight navy, off-white type, Columbia Blue as the single accent. Everything sits square. Color comes from Columbia's palette: Columbia Blue `#B9D9EB` (visualidentity.columbia.edu), the primary blue `#1D4F91` (PMS 7686) and navy. No pastels.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0A0F1C` | Page background |
| `--surface` | `#121A2B` | Plain cards, NeuroHex card |
| `--ink` | `#EEF2F7` | Text |
| `--ink-soft` | `#9AA6BA` | Secondary text |
| `--accent` / `--sky` | `#B9D9EB` | Links, buttons, Engineering card, SAP label, active menu item, title underlines |
| `--navy` | `#13305F` | Business School card, Interplay label, Argus card, contact panel |
| `--cu-blue` | `#1D4F91` | Hero glow, the About section's circles |
| `--slate` | `#C9D3DF` | Volunteering card, Wolters Kluwer label |
| `--pale` | `#141E31` | VIT card, skill chips |

- **Signature pieces** (picked from two "design trends" lists Abhishek shared; most of the rest are AI-site cliches and stay out):
  - **Blueprint hero:** grainy navy gradient with a major and minor Columbia Blue grid. The band runs up under the transparent header.
  - **Dithered portrait:** `assets/js/dither.js` paints a two-color Atkinson dither over the photo; hover shows color. Only dither dark, high-contrast photos (the studio portrait). Bright photos turn into blobs, so NeuroHex stays in color. Touch devices always get color.
  - **About text flow:** `assets/js/flow.js` uses Pretext (`assets/vendor/pretext/`, MIT, `@chenglou/pretext` 1.0.0, self-hosted) to wrap the About text around circles you can drag. Words never split inside a gap; a finished paragraph ends its line; on phones the circles start at the edges. The paragraphs in `.flow-source` are the real, accessible text and show if the script doesn't run. Every sentence there must come from the CV or the repos.
  - **One marquee** of tools from the CV. Only one per page.
- **Deliberately not used:** cream backgrounds, Instrument Serif or any serif, one italic word in a headline, all-caps eyebrows, pulsing dots, three equal icon cards, sparkle icons, liquid glass.
- Text on sky and slate cards is always `--note-ink` (navy `#0B2551`). Text on navy is white.
- **Only one photo in the hero**: Abhishek's portrait. Nothing else goes near it.
- Project cards wear their own repo's identity (NeuroHex servo green with the CAD model next to the build, Lumi's pink pixel heart, Argus's cat mascot on a navy card). Take these from the repo, never invent them.
- **Nothing is tilted or rotated.** No tape, no stickers poking out of cards, no overlapping photos. Abhishek rejected these as unprofessional.

- **Type:** Geist only (self-hosted in `assets/fonts/`). Weights 400, 500, 600, 700. No second family, no monospace labels.
- **Radius:** colored cards and photos are 4px, plain cards 14px, buttons, chips and the About circles are full pills. Nothing else.
- **Theme:** one dark theme for everyone, on purpose. No light mode.
- **Layout:** content max width 1200px, 24px side gutters (16px on phones). Every multi-column layout collapses to one column under 768px. No horizontal page scroll at 360px.
- **Icons:** Phosphor (regular weight) only, inlined as SVG. No emoji.
- **Images:** real photos and real CAD renders only. No stock photos, no fake screenshots built from divs, no AI-generated images of Abhishek. Every image has `width`, `height`, and descriptive alt text. Keep each under 250KB. Strip all metadata before publishing.
- **Video:** link to it (the NeuroHex walk is on GitHub). Embedding needs the audio track removed and the file compressed first; ask before adding one.

### Motion

- One page-load sequence on the hero. Sections rise in once as they scroll into view, in pure CSS (`animation-timeline: view()`), so content is never hidden waiting on a script.
- The only loop is the tools marquee: slow, paused on hover, and still under reduced motion. Any other loop needs a visible pause button, must stop when off screen, and must be a still frame under reduced motion.
- Animate only `transform` and `opacity`. UI transitions 150 to 250ms with `cubic-bezier(0.23, 1, 0.32, 1)`. Buttons scale to 0.97 on press.
- Hover effects only under `@media (hover: hover) and (pointer: fine)`.
- **Phones scroll plain content.** Scroll-driven reveals and the blurred header only run on desktops with a mouse. Never call `scrollIntoView()` from scroll-tracking code: on phones it also scrolls the page and makes it jump. Move inner scrollers with `element.scrollTo()` instead. Test with real-time mobile emulation (a CDP script: 390px, touch, coarse pointer) and expect 0 jumps.
- Under `prefers-reduced-motion: reduce`, nothing moves on its own; content is simply visible.
- **Testing needs a local server** (`python3 -m http.server`): browsers block JavaScript modules on `file://`, so the About flow won't run from a double-clicked file.

### Accessibility and performance

- WCAG AA contrast. Visible focus ring on every interactive element. Tap targets at least 44px.
- Semantic HTML: one `h1` per page, landmarks (`header`, `main`, `footer`), a skip link.
- External links open in a new tab with `rel="noopener"` and say so to screen readers.
- No JavaScript is required to read the page. JS only adds motion, dithering and the text flow.

## 6. Before saying it's done

1. Serve the folder locally and open it in a browser. Drag the About circles.
2. Check widths 375px, 768px and 1280px. No horizontal scroll.
3. `grep` the published files for the phone number, `@`, em and en dashes, and immigration or visa terms. Expect no hits.
4. Click every link.
5. List every file created or changed.
