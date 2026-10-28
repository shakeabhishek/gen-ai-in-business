"""Job Hunt in a Folder.

Reads cv.pdf, every posting file in postings/, and every link in postings.csv,
then builds job-hunt.html: one entry per role with key facts, fit against the
CV (1-to-5), the deadline and the exact posting text it came from, three
interview questions, and recent company news with a source on every fact.

    python build.py            build the page and open it
    python build.py --watch    rebuild whenever a posting is added or changed
    python build.py --no-news  skip the web search for company news
"""

from __future__ import annotations

import argparse
import concurrent.futures as cf
import csv
import datetime as dt
import email.utils
import hashlib
import json
import os
import re
import sys
import time
import webbrowser
from dataclasses import dataclass, field
from pathlib import Path
from defusedxml import ElementTree

import httpx
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from google import genai
from google.genai import types
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
CV_PATH = ROOT / "cv.pdf"
POSTINGS_DIR = ROOT / "postings"
POSTINGS_CSV = ROOT / "postings.csv"
CACHE_DIR = ROOT / ".cache"
OUTPUT = ROOT / "job-hunt.html"

# Bump when the prompt or schema changes so cached analyses are redone.
PROMPT_VERSION = "5"
POSTING_SUFFIXES = {".pdf", ".docx", ".txt", ".md", ".html", ".htm"}
MIN_POSTING_CHARS = 400
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


class RoleAnalysis(BaseModel):
    title: str
    company: str
    location: str = Field(description="Short, e.g. 'New York' or 'NYC or SF'. 'Not stated' if absent.")
    work_model: str = Field(description="One or two words: 'Onsite', 'Hybrid', 'Remote', or 'Not stated'.")
    pay: str | None = Field(description="Pay range exactly as short as possible, e.g. '$180k-$240k'. Null if not stated.")
    headline: str = Field(
        description="One line, at most 12 words, that tells the candidate the verdict on this role "
        "and the main reason. e.g. 'Strong match on agent work; London-only is the blocker.'"
    )
    skills: list[str] = Field(description="The 3 most important required skills, 1 to 3 words each.")
    key_facts: list[str] = Field(
        description="3 to 5 facts from the posting not already covered by pay/location/skills: "
        "team, level, travel, years required. At most 12 words each."
    )
    fit_score: int = Field(ge=1, le=5, description="1 = poor fit, 5 = excellent fit.")
    strengths: list[str] = Field(
        description="2 to 3 CV points that match the posting, at most 15 words each, naming the CV evidence."
    )
    gaps: list[str] = Field(description="1 to 3 things the posting asks for that the CV lacks, at most 15 words each.")
    deadline: str | None = Field(
        description="Application deadline as YYYY-MM-DD, only if the posting states one. "
        "Null if the posting gives no deadline. Never infer from a posted date."
    )
    deadline_quote: str | None = Field(
        description="The exact sentence or phrase from the posting that states the deadline, "
        "copied verbatim. Null when deadline is null."
    )
    interview_questions: list[str] = Field(
        description="Exactly 3 questions this interviewer is likely to ask this candidate, "
        "tied to the posting's requirements and the candidate's background. One sentence each."
    )


ANALYSIS_PROMPT = """You are helping a candidate triage job postings against their CV.
The CV is attached as a PDF. The posting text follows.

Rules:
- Use only what the posting and CV actually say. Do not invent pay, location or dates.
- For the deadline: copy the exact words from the posting into deadline_quote.
  If the posting has no application deadline, set both deadline and deadline_quote to null.
  A "posted on" date is not a deadline.
- Score fit honestly. A 5 means the CV clearly meets nearly every requirement.
  A hard requirement the CV misses (years of experience, location, work authorization,
  a required skill) lowers the score; list it under gaps.
- Write to the candidate as "you" ("Your SAP work..."). Never use their name or he/she.
- Today's date is {today}.

POSTING SOURCE: {source}

POSTING TEXT:
{text}
"""

class NewsItem(BaseModel):
    article: int = Field(description="The number of the article this fact comes from.")
    fact: str = Field(description="One plain sentence stating what the headline reports, with the month and year.")


class NewsPick(BaseModel):
    items: list[NewsItem]


NEWS_PROMPT = """A candidate is interviewing for a "{title}" role at {company}.
Below are recent news headlines. Pick up to 3 that are actually about {company} and that
the candidate should know (funding, product launches, leadership changes, layoffs,
earnings, partnerships). Skip headlines about other companies with a similar name.
For each, state only what the headline says. Do not add facts that are not in it.

{articles}
"""


@dataclass
class Posting:
    source: str  # file name or URL
    text: str = ""
    error: str | None = None
    note: str = ""


@dataclass
class Role:
    posting: Posting
    analysis: RoleAnalysis | None = None
    deadline_check: str = "none"  # verified | unverified | none
    news: list[dict] = field(default_factory=list)
    news_error: str | None = None
    error: str | None = None

    @property
    def slug(self) -> str:
        """A stable anchor id, so timeline links and bookmarks survive re-sorting."""
        name = f"{self.analysis.company}-{self.analysis.title}" if self.analysis else self.posting.source
        return "role-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60]

    @property
    def deadline_date(self) -> dt.date | None:
        if not self.analysis or not self.analysis.deadline:
            return None
        try:
            return dt.date.fromisoformat(self.analysis.deadline)
        except ValueError:
            return None


# ---------------------------------------------------------------- reading


def read_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader

        return "\n".join(page.extract_text() or "" for page in PdfReader(path).pages)
    if suffix == ".docx":
        import docx

        return "\n".join(p.text for p in docx.Document(path).paragraphs)
    raw = path.read_text(errors="replace")
    if suffix in {".html", ".htm"}:
        return html_to_text(raw)
    return raw


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "header"]):
        tag.decompose()
    lines = (line.strip() for line in soup.get_text("\n").splitlines())
    return "\n".join(line for line in lines if line)


def fetch_url(url: str) -> str:
    cached = CACHE_DIR / "pages" / (hashlib.sha256(url.encode()).hexdigest()[:16] + ".txt")
    if cached.exists():
        return cached.read_text()
    resp = httpx.get(url, headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=30)
    resp.raise_for_status()
    text = html_to_text(resp.text)
    if len(text) >= MIN_POSTING_CHARS:
        cached.parent.mkdir(parents=True, exist_ok=True)
        cached.write_text(text)
    return text


def collect_postings() -> list[Posting]:
    postings: list[Posting] = []
    if POSTINGS_DIR.exists():
        for path in sorted(POSTINGS_DIR.iterdir()):
            if path.suffix.lower() not in POSTING_SUFFIXES or path.name.startswith("."):
                continue
            p = Posting(source=path.name)
            try:
                p.text = read_file(path)
            except Exception as exc:  # noqa: BLE001 - report any unreadable file on the page
                p.error = f"Could not read the file: {exc}"
            postings.append(p)

    if POSTINGS_CSV.exists():
        with POSTINGS_CSV.open(newline="") as fh:
            for row in csv.DictReader(fh):
                url = (row.get("url") or "").strip()
                if not url or url.startswith("#"):
                    continue
                p = Posting(source=url, note=(row.get("notes") or "").strip())
                try:
                    p.text = fetch_url(url)
                except Exception as exc:  # noqa: BLE001
                    p.error = f"Could not open the link: {exc}"
                postings.append(p)

    for p in postings:
        if not p.error and len(p.text.strip()) < MIN_POSTING_CHARS:
            p.error = (
                "The page had almost no text (it may need a login or load with JavaScript). "
                "Save the posting as a PDF into postings/ instead."
            )
    return postings


# ---------------------------------------------------------------- model calls


def normalize(s: str) -> str:
    s = s.lower().replace("’", "'").replace("–", "-").replace("—", "-")
    return re.sub(r"\s+", " ", s).strip()


def check_deadline(analysis: RoleAnalysis, posting_text: str) -> str:
    """The trust check: is the quoted deadline really in the posting?"""
    if not analysis.deadline:
        return "none"
    quote = normalize(analysis.deadline_quote or "")
    if quote and quote in normalize(posting_text):
        return "verified"
    return "unverified"


def generate(client: genai.Client, **kwargs):
    """generate_content that rides out free-tier limits instead of failing.

    Each free model has its own small daily quota. When a model is out for the day
    (429 PerDay) or overloaded (500/503), move to the next model in
    GEMINI_FALLBACK_MODELS. A per-minute rate limit (429) just waits and retries.
    """
    chain = os.environ.get("GEMINI_FALLBACK_MODELS", "").strip() or "gemini-3.6-flash,gemini-3.5-flash,gemini-3.1-flash-lite"
    fallbacks = [m.strip() for m in chain.split(",") if m.strip() and m.strip() != kwargs["model"]]
    waits = 0
    while True:
        try:
            return client.models.generate_content(**kwargs)
        except genai.errors.APIError as exc:
            if exc.code not in (429, 500, 503):
                raise
            out_for_today = exc.code == 429 and "PerDay" in str(exc)
            if (out_for_today or exc.code != 429) and fallbacks:
                reason = "out of free quota for today" if out_for_today else "overloaded"
                print(f"  {kwargs['model']} is {reason}, switching to {fallbacks[0]}")
                kwargs["model"] = fallbacks.pop(0)
                continue
            if out_for_today:
                raise  # every model is out for today; waiting won't help
            waits += 1
            if waits > 4:
                raise
            time.sleep(10 * waits)


def cache_load(key: str):
    path = CACHE_DIR / f"{key}.json"
    return json.loads(path.read_text()) if path.exists() else None


def cache_save(key: str, data) -> None:
    CACHE_DIR.mkdir(exist_ok=True)
    (CACHE_DIR / f"{key}.json").write_text(json.dumps(data, indent=2))


def analyze(client: genai.Client, model: str, cv_bytes: bytes, posting: Posting) -> RoleAnalysis:
    key = "role-" + hashlib.sha256(
        b"|".join([PROMPT_VERSION.encode(), model.encode(), cv_bytes, posting.text.encode()])
    ).hexdigest()[:20]
    if cached := cache_load(key):
        return RoleAnalysis.model_validate(cached)

    prompt = ANALYSIS_PROMPT.format(
        today=dt.date.today().isoformat(), source=posting.source, text=posting.text[:60_000]
    )
    resp = generate(
        client,
        model=model,
        contents=[types.Part.from_bytes(data=cv_bytes, mime_type="application/pdf"), prompt],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=RoleAnalysis,
            temperature=0.2,
        ),
    )
    analysis = resp.parsed if isinstance(resp.parsed, RoleAnalysis) else RoleAnalysis.model_validate_json(resp.text)
    cache_save(key, analysis.model_dump())
    return analysis


def search_news(company: str, days: int = 180, limit: int = 12) -> list[dict]:
    """Recent headlines from Google News RSS (free, no key)."""
    query = f'"{company}" when:{days}d'
    resp = httpx.get(
        "https://news.google.com/rss/search",
        params={"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"},
        headers={"User-Agent": USER_AGENT},
        timeout=20,
    )
    resp.raise_for_status()
    articles = []
    for item in ElementTree.fromstring(resp.content).iter("item"):
        try:
            date = email.utils.parsedate_to_datetime(item.findtext("pubDate", "")).date().isoformat()
        except (TypeError, ValueError):
            date = ""
        title = item.findtext("title", "").strip()
        publisher = item.findtext("source", "").strip()
        # Google News appends " - Publisher" to every title.
        if publisher and title.endswith(" - " + publisher):
            title = title[: -len(publisher) - 3]
        articles.append(
            {"title": title, "url": item.findtext("link", "").strip(), "publisher": publisher, "date": date}
        )
        if len(articles) == limit:
            break
    return [a for a in articles if a["title"] and a["url"]]


def company_news(client: genai.Client, model: str, company: str, title: str) -> list[dict]:
    """Pick the notable headlines. Every fact points at an article we fetched, never one the model names."""
    key = "news-" + hashlib.sha256(f"{model}|{company}|{dt.date.today()}".encode()).hexdigest()[:20]
    if (cached := cache_load(key)) is not None:
        return cached

    articles = search_news(company)
    if not articles:
        cache_save(key, [])
        return []
    listing = "\n".join(
        f"[{i}] {a['date']} | {a['publisher']} | {a['title']}" for i, a in enumerate(articles, 1)
    )
    resp = generate(
        client,
        model=model,
        contents=NEWS_PROMPT.format(company=company, title=title, articles=listing),
        config=types.GenerateContentConfig(
            response_mime_type="application/json", response_schema=NewsPick, temperature=0.2
        ),
    )
    pick = resp.parsed if isinstance(resp.parsed, NewsPick) else NewsPick.model_validate_json(resp.text)
    news, seen = [], set()
    for item in pick.items[:3]:
        # A fact that cites an article we didn't fetch is dropped, not shown.
        if not 1 <= item.article <= len(articles) or item.article in seen:
            continue
        seen.add(item.article)
        a = articles[item.article - 1]
        news.append({"text": item.fact, "headline": a["title"], "sources": [
            {"url": a["url"], "label": f"{a['publisher'] or 'source'}, {a['date']}".rstrip(", ")}
        ]})
    cache_save(key, news)
    return news


# ---------------------------------------------------------------- page


def runway(roles: list[Role], today: dt.date) -> dict:
    """Place dated roles on a timeline from today, in lanes so labels don't collide."""
    dated = [r for r in roles if r.deadline_date]
    span = max([30] + [(r.deadline_date - today).days + 3 for r in dated])
    lane_ends: list[float] = []
    marks = []
    for r in dated:
        days = (r.deadline_date - today).days
        pos = max(0.0, min(100.0, days / span * 100))
        lane = next((i for i, end in enumerate(lane_ends) if pos - end > 16), len(lane_ends))
        if lane == len(lane_ends):
            lane_ends.append(pos)
        lane_ends[lane] = pos
        marks.append({"role": r, "pos": pos, "lane": lane, "days": days})
    ticks = [
        {"pos": d / span * 100, "label": (today + dt.timedelta(days=d)).strftime("%b %-d")}
        for d in range(0, span + 1, 7)
    ]
    return {"marks": marks, "ticks": ticks, "lanes": max(1, len(lane_ends))}


def render(roles: list[Role], skipped: list[Posting], live: bool) -> None:
    today = dt.date.today()
    roles.sort(key=lambda r: (r.deadline_date or dt.date.max, -(r.analysis.fit_score if r.analysis else 0)))
    env = Environment(loader=FileSystemLoader(ROOT), autoescape=select_autoescape(["html"]))
    env.filters["nice_date"] = lambda d: d.strftime("%a %b %-d, %Y")
    html = env.get_template("template.html").render(
        roles=roles,
        skipped=skipped,
        today=today,
        runway=runway(roles, today),
        built_at=dt.datetime.now().strftime("%b %-d, %-I:%M %p"),
        live=live,
    )
    OUTPUT.write_text(html)


def build(news: bool, live: bool = False) -> int:
    load_dotenv(ROOT / ".env")
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        sys.exit("GEMINI_API_KEY is empty. Add your key to .env (see .env.example).")
    if not CV_PATH.exists():
        sys.exit(f"No CV found. Put your CV at {CV_PATH.name}.")
    model = os.environ.get("GEMINI_MODEL", "").strip() or "gemini-3.8-flash"
    client = genai.Client(api_key=api_key)
    cv_bytes = CV_PATH.read_bytes()

    postings = collect_postings()
    readable = [p for p in postings if not p.error]
    skipped = [p for p in postings if p.error]
    print(f"{len(readable)} postings to read, {len(skipped)} skipped. Model: {model}")

    def work(p: Posting) -> Role:
        role = Role(posting=p)
        try:
            role.analysis = analyze(client, model, cv_bytes, p)
            role.deadline_check = check_deadline(role.analysis, p.text)
        except Exception as exc:  # noqa: BLE001
            role.error = f"The model call failed: {exc}"
            return role
        if news:
            try:
                role.news = company_news(client, model,role.analysis.company, role.analysis.title)
            except Exception as exc:  # noqa: BLE001
                role.news_error = f"News search failed: {exc}"
        print(f"  done: {role.analysis.company} - {role.analysis.title}")
        return role

    with cf.ThreadPoolExecutor(max_workers=4) as pool:
        roles = list(pool.map(work, readable))
    failed = [r for r in roles if r.error]
    for r in failed:
        r.posting.error = r.error
    render([r for r in roles if not r.error], skipped + [r.posting for r in failed], live)
    print(f"Wrote {OUTPUT.name}")
    return len(failed) + len(skipped)


def watch(news: bool) -> None:
    from watchdog.events import FileSystemEventHandler
    from watchdog.observers import Observer

    class Changed(FileSystemEventHandler):
        last = 0.0

        def on_any_event(self, event):
            name = Path(event.src_path).name
            if event.is_directory or name.startswith(".") or name.startswith("~$"):
                return
            if Path(event.src_path).parent == POSTINGS_DIR or name == POSTINGS_CSV.name:
                Changed.last = time.time()

    observer = Observer()
    observer.schedule(Changed(), str(POSTINGS_DIR))
    observer.schedule(Changed(), str(ROOT))
    observer.start()
    print("Watching postings/ and postings.csv. Drop a posting in to rebuild. Ctrl+C to stop.")
    pending_since = 0.0
    try:
        while True:
            time.sleep(1)
            # Wait for 2 quiet seconds so a file that is still copying isn't read half-written.
            if Changed.last > pending_since and time.time() - Changed.last > 2:
                pending_since = Changed.last
                print("Change detected, rebuilding...")
                build(news, live=True)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--watch", action="store_true", help="rebuild when postings change")
    parser.add_argument("--no-news", action="store_true", help="skip the company news search")
    parser.add_argument("--no-open", action="store_true", help="don't open the page in a browser")
    args = parser.parse_args()
    POSTINGS_DIR.mkdir(exist_ok=True)

    build(news=not args.no_news, live=args.watch)
    if not args.no_open:
        webbrowser.open(OUTPUT.as_uri())
    if args.watch:
        watch(news=not args.no_news)


if __name__ == "__main__":
    main()
