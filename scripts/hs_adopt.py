"""Adopt mode: read an existing repository and say what is in it, before anything is changed.

Standard library only. `scan(root)` walks the project (never following symlinks, skipping dependency and build
folders), and returns a plain dict: languages, manifests and frameworks, tests, CI, git facts, structure, risks and
"evidence candidates" (which files probably answer which gate checks). It never prints or stores the text of anything
that looks like a secret: only the file, the line and the kind.

`render(report)` turns that into docs/adopt/inventory.md; `plan_template()` is the skeleton of the restructure plan.
"""
import json
import os
import re
import subprocess

SKIP_DIRS = {".git", "node_modules", ".venv", "venv", "env", "__pycache__", "dist", "build", "target", "vendor", ".next", ".nuxt", ".svelte-kit",
             ".idea", ".vscode", "coverage", ".pytest_cache", ".mypy_cache", ".gradle", "Pods", ".hyperskill", ".turbo", ".cache", "bower_components"}
MAX_FILES = 30000
MAX_TEXT = 1024 * 1024

LANGS = {
    ".py": "Python", ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript", ".jsx": "JavaScript (JSX)", ".ts": "TypeScript", ".tsx": "TypeScript (TSX)",
    ".go": "Go", ".rs": "Rust", ".rb": "Ruby", ".php": "PHP", ".java": "Java", ".kt": "Kotlin", ".swift": "Swift", ".cs": "C#", ".c": "C", ".h": "C/C++ header",
    ".cpp": "C++", ".cc": "C++", ".scala": "Scala", ".ex": "Elixir", ".exs": "Elixir", ".dart": "Dart", ".lua": "Lua", ".sh": "Shell", ".sql": "SQL",
    ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".vue": "Vue", ".svelte": "Svelte", ".md": "Markdown", ".yml": "YAML", ".yaml": "YAML", ".json": "JSON", ".tf": "Terraform",
}
CODE_LANGS = {v for k, v in LANGS.items() if k not in (".md", ".json", ".yml", ".yaml", ".html", ".css", ".scss")}

MANIFESTS = {
    "package.json": "npm", "pyproject.toml": "Python (pyproject)", "requirements.txt": "pip", "Pipfile": "pipenv", "setup.py": "Python (setup.py)", "go.mod": "Go modules",
    "Cargo.toml": "Cargo", "Gemfile": "Bundler", "pom.xml": "Maven", "build.gradle": "Gradle", "build.gradle.kts": "Gradle", "composer.json": "Composer",
    "mix.exs": "Mix", "pubspec.yaml": "Dart pub", "Package.swift": "Swift PM", "deno.json": "Deno",
}
LOCKFILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "poetry.lock", "Pipfile.lock", "uv.lock", "go.sum", "Cargo.lock", "Gemfile.lock", "composer.lock", "mix.lock", "pubspec.lock"}
FRAMEWORK_DEPS = {
    "react": "React", "next": "Next.js", "vue": "Vue", "nuxt": "Nuxt", "svelte": "Svelte", "@sveltejs/kit": "SvelteKit", "@angular/core": "Angular", "astro": "Astro",
    "express": "Express", "fastify": "Fastify", "@nestjs/core": "NestJS", "koa": "Koa", "hono": "Hono", "vite": "Vite", "webpack": "webpack", "tailwindcss": "Tailwind CSS",
    "prisma": "Prisma", "@prisma/client": "Prisma", "drizzle-orm": "Drizzle", "typeorm": "TypeORM", "mongoose": "Mongoose", "sequelize": "Sequelize",
    "jest": "Jest", "vitest": "Vitest", "mocha": "Mocha", "playwright": "Playwright", "@playwright/test": "Playwright", "cypress": "Cypress",
    "django": "Django", "flask": "Flask", "fastapi": "FastAPI", "sqlalchemy": "SQLAlchemy", "pytest": "pytest", "celery": "Celery", "rails": "Rails", "laravel/framework": "Laravel",
    "gin-gonic/gin": "Gin", "labstack/echo": "Echo", "actix-web": "Actix", "axum": "Axum", "tokio": "Tokio",
}
TEST_FILE = re.compile(r"(^test_.*\.py$|.*_test\.(py|go|rb)$|.*\.(test|spec)\.(js|jsx|ts|tsx|mjs|cjs)$|.*Test\.(java|kt|cs)$|.*_spec\.rb$|.*Tests?\.swift$)")
TEST_DIRS = {"tests", "test", "__tests__", "spec", "e2e", "cypress", "playwright"}
CI_FILES = {".gitlab-ci.yml": "GitLab CI", "Jenkinsfile": "Jenkins", "azure-pipelines.yml": "Azure Pipelines", ".travis.yml": "Travis CI", "bitbucket-pipelines.yml": "Bitbucket Pipelines", ".drone.yml": "Drone"}
SECRET_PATTERNS = [
    ("AWS access key id", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("private key block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}")),
    ("Stripe live key", re.compile(r"\b[sr]k_live_[A-Za-z0-9]{16,}")),
    ("API-key style secret", re.compile(r"(?i)\b(api[_-]?key|secret|passwd|password|token)\b\s*[:=]\s*['\"][A-Za-z0-9_\-/+=]{16,}['\"]")),
]
BIG_FILE_LINES = 800


def _git(root, *args):
    try:
        r = subprocess.run(["git", "-C", root] + list(args), capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.TimeoutExpired):
        return None
    return r.stdout.strip() if r.returncode == 0 else None


def _read(path, limit=MAX_TEXT):
    try:
        with open(path, "rb") as f:
            data = f.read(limit + 1)
    except OSError:
        return None
    if len(data) > limit or b"\x00" in data[:4096]:
        return None
    return data.decode("utf-8", errors="replace")


def _deps_from_package_json(text):
    try:
        d = json.loads(text)
    except ValueError:
        return {}, {}, []
    deps = {}
    for k in ("dependencies", "devDependencies", "peerDependencies"):
        deps.update(d.get(k) or {})
    return deps, (d.get("scripts") or {}), [d.get("name") or ""]


def _py_deps(text):
    names = set()
    for line in text.splitlines():
        m = re.match(r"\s*([A-Za-z0-9_.\-]+)", line)
        if m and not line.lstrip().startswith(("#", "-", "[")):
            names.add(m.group(1).lower())
    for m in re.finditer(r'["\']([A-Za-z0-9_.\-]+)\s*(?:[<>=!~\[;].*)?["\']', text):  # pyproject dependency arrays
        names.add(m.group(1).lower())
    return names


def scan(root):
    root = os.path.abspath(root)
    files, langs, top, big, todos = [], {}, {}, [], 0
    manifests, lockfiles, ci, docs, secrets, test_files, test_dirs = [], [], [], {}, [], [], set()
    frameworks, scripts, dep_names = set(), {}, set()
    notes = []
    for dirpath, dirnames, filenames in os.walk(root, followlinks=False):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not os.path.islink(os.path.join(dirpath, d)))
        rel_dir = os.path.relpath(dirpath, root)
        for d in dirnames:
            if d in TEST_DIRS:
                test_dirs.add(os.path.normpath(os.path.join(rel_dir, d)))
        for fn in sorted(filenames):
            p = os.path.join(dirpath, fn)
            if os.path.islink(p):
                continue
            rel = os.path.normpath(os.path.join(rel_dir, fn))
            if len(files) >= MAX_FILES:
                notes.append("stopped after %d files; the project is larger than this scan reads" % MAX_FILES)
                break
            files.append(rel)
            ext = os.path.splitext(fn)[1].lower()
            lang = LANGS.get(ext)
            first = rel.split(os.sep)[0] if os.sep in rel else "(root files)"
            text = _read(p) if (lang or fn in MANIFESTS or fn.startswith(".env") or fn in ("Dockerfile", "Makefile")) else None
            lines = text.count("\n") + 1 if text else 0
            if lang:
                e = langs.setdefault(lang, {"files": 0, "lines": 0})
                e["files"] += 1
                e["lines"] += lines
            t = top.setdefault(first, {"files": 0, "lines": 0})
            t["files"] += 1
            t["lines"] += lines
            if text is not None and lang in CODE_LANGS:
                if lines >= BIG_FILE_LINES:
                    big.append((rel, lines))
                todos += len(re.findall(r"\b(TODO|FIXME|HACK|XXX)\b", text))
            if fn in MANIFESTS:
                manifests.append((rel, MANIFESTS[fn]))
                if fn == "package.json" and text:
                    deps, sc, _ = _deps_from_package_json(text)
                    if rel == "package.json" or not scripts:
                        scripts.update(sc)
                    dep_names |= set(deps)
                elif text and fn in ("requirements.txt", "pyproject.toml", "Pipfile"):
                    dep_names |= _py_deps(text)
                elif text and fn in ("go.mod", "Cargo.toml", "Gemfile", "composer.json"):
                    for m in re.finditer(r"([A-Za-z0-9_.\-/]+)", text):
                        dep_names.add(m.group(1).lower())
            if fn in LOCKFILES:
                lockfiles.append(rel)
            if fn in CI_FILES:
                ci.append((rel, CI_FILES[fn]))
            if rel.startswith(os.path.join(".github", "workflows")) and ext in (".yml", ".yaml"):
                ci.append((rel, "GitHub Actions"))
            if rel.startswith(".circleci"):
                ci.append((rel, "CircleCI"))
            low = fn.lower()
            if low.startswith("readme"):
                docs["readme"] = rel
            elif low.startswith("license") or low.startswith("licence") or low == "copying":
                docs["licence"] = rel
            elif low.startswith("contributing"):
                docs["contributing"] = rel
            elif fn in ("CLAUDE.md", "AGENTS.md"):
                docs["agent memory"] = rel
            elif fn in ("Dockerfile",) or fn.startswith("docker-compose"):
                docs.setdefault("containers", rel)
            elif fn in (".env.example", ".env.sample", ".env.template"):
                docs["env example"] = rel
            if TEST_FILE.match(fn) or os.path.normpath(rel_dir).split(os.sep)[0] in TEST_DIRS and lang in CODE_LANGS:
                test_files.append(rel)
            if text is not None and (lang or fn.startswith(".env")) and not fn.endswith((".lock", ".min.js")):
                for n, line in enumerate(text.splitlines(), 1):
                    if len(line) > 600:
                        continue
                    for kind, rx in SECRET_PATTERNS:
                        if rx.search(line):
                            if "example" in fn.lower() or "sample" in fn.lower() or "fixture" in rel.lower() or "/test" in rel.lower():
                                break
                            secrets.append({"file": rel, "line": n, "kind": kind})
                            break
                    if len(secrets) >= 50:
                        break
        else:
            continue
        break
    for dep in dep_names:
        k = FRAMEWORK_DEPS.get(dep.lower()) or FRAMEWORK_DEPS.get(dep)
        if k:
            frameworks.add(k)
    if (os.path.isdir(os.path.join(root, ".github")) and not ci):
        notes.append(".github exists but holds no workflow")
    tracked = _git(root, "ls-files")
    tracked_set = set(tracked.splitlines()) if tracked else set()
    git = {"is_repo": _git(root, "rev-parse", "--is-inside-work-tree") == "true"}
    if git["is_repo"]:
        git["branch"] = _git(root, "rev-parse", "--abbrev-ref", "HEAD")
        git["commits"] = int(_git(root, "rev-list", "--count", "HEAD") or 0)
        git["last_commit"] = _git(root, "log", "-1", "--format=%cs")
        git["uncommitted_files"] = len((_git(root, "status", "--porcelain") or "").splitlines())
        sl = _git(root, "shortlog", "-sn", "--all", "HEAD") or ""
        git["contributors"] = len(sl.splitlines())
    env_tracked = sorted(f for f in tracked_set if os.path.basename(f).startswith(".env") and not f.endswith((".example", ".sample", ".template")))
    modules_tracked = any(f.startswith("node_modules/") for f in tracked_set)
    big.sort(key=lambda x: -x[1])
    test_files = sorted(set(test_files))
    runner = [s for s in sorted({FRAMEWORK_DEPS[d] for d in dep_names if d in FRAMEWORK_DEPS} & {"Jest", "Vitest", "Mocha", "pytest", "Playwright", "Cypress"})]
    code_lines = sum(v["lines"] for k, v in langs.items() if k in CODE_LANGS)
    risks = []

    def risk(sev, rid, text, evidence=None):
        risks.append({"severity": sev, "id": rid, "text": text, "evidence": evidence or []})
    if not test_files:
        risk("high", "no-tests", "No test files were found, so there is nothing that says today's behaviour is right. Pin behaviour before restructuring.")
    elif code_lines and len(test_files) * 400 < code_lines:
        risk("medium", "thin-tests", "%d test files for about %d lines of code: restructuring will outrun the tests." % (len(test_files), code_lines))
    if not ci:
        risk("medium", "no-ci", "No CI configuration found: nothing blocks a broken change.")
    if manifests and not lockfiles:
        risk("medium", "no-lockfile", "Dependencies are declared but no lockfile is committed: installs are not reproducible.")
    if secrets:
        risk("high", "secrets", "%d line(s) look like secrets in source (see inventory.json for file and line; the values were not read out). Rotate them if they are real." % len(secrets), [f"{s['file']}:{s['line']} ({s['kind']})" for s in secrets[:10]])
    if env_tracked:
        risk("high", "env-committed", "An environment file is tracked by git: " + ", ".join(env_tracked[:5]) + ". Treat its contents as leaked.", env_tracked[:5])
    if modules_tracked:
        risk("medium", "node-modules-committed", "node_modules is tracked by git: the repository carries third-party code and will be slow to clone.")
    if "readme" not in docs:
        risk("low", "no-readme", "No README: nobody can tell what this is or how to run it.")
    if "licence" not in docs:
        risk("low", "no-licence", "No licence file: reuse terms are undefined.")
    if "env example" not in docs and any("process.env" in (_read(os.path.join(root, f), 200000) or "") for f in files[:400] if f.endswith((".js", ".ts", ".mjs"))):
        risk("low", "no-env-example", "The code reads environment variables but there is no .env.example listing them.")
    if big:
        risk("medium", "big-files", "%d code file(s) over %d lines, the biggest first: %s" % (len(big), BIG_FILE_LINES, ", ".join("%s (%d)" % b for b in big[:5])), [b[0] for b in big[:10]])
    if git.get("is_repo") and git.get("uncommitted_files"):
        risk("medium", "dirty-tree", "%d uncommitted file(s): commit or stash before a restructure, so every step can be undone." % git["uncommitted_files"])
    if not git["is_repo"]:
        risk("high", "no-git", "Not a git repository: a restructure with no history has no undo. Run git init and commit first.")
    if todos > 50:
        risk("low", "many-todos", "%d TODO/FIXME/HACK markers in code." % todos)

    def have(*names):
        return [f for f in files if os.path.basename(f) in names]
    e2e = [f for f in files if re.search(r"(playwright|cypress)\.config\.|(^|/)e2e/", f)]
    build_script = [k for k in scripts if k in ("build", "start", "dev", "test", "lint")]
    candidates = {}

    def cand(gid, why, paths):
        if paths:
            candidates[gid] = {"why": why, "files": paths[:6]}
    cand("git-hygiene", "git history and ignore file", [f for f in (".gitignore",) if f in files] if git["is_repo"] else [])
    cand("ci-blocks", "a CI configuration exists (check that it blocks merges on failure)", [c[0] for c in ci])
    cand("e2e-critical", "end-to-end test setup exists (check it covers signup, login, the core flow, billing, invites)", e2e)
    cand("memory-updated", "agent memory file exists", [docs["agent memory"]] if "agent memory" in docs else [])
    cand("deps-justified", "dependency manifests (each dependency still needs a reason)", [m[0] for m in manifests])
    cand("dependency-audit", "lockfile present, so an audit can run", lockfiles)
    cand("env-validation", "environment example exists (check the app validates its config at startup)", [docs["env example"]] if "env example" in docs else [])
    cand("scaffold-runs", "build/start/test scripts are declared (run them and record the output)", [m[0] for m in manifests if m[0].endswith("package.json")] if build_script else [])
    cand("legal-published", "licence file exists (this is not a privacy policy or terms of service)", [docs["licence"]] if "licence" in docs else [])
    langs_sorted = sorted(langs.items(), key=lambda kv: -kv[1]["lines"])
    return {
        "root": root, "files": len(files), "languages": [{"name": k, **v} for k, v in langs_sorted], "code_lines": code_lines,
        "manifests": manifests, "lockfiles": lockfiles, "frameworks": sorted(frameworks), "scripts": scripts, "dependencies": len(dep_names),
        "tests": {"files": len(test_files), "dirs": sorted(test_dirs), "runners": runner, "sample": test_files[:8], "e2e": e2e[:6]},
        "ci": ci, "docs": docs, "git": git, "structure": sorted(({"path": k, **v} for k, v in top.items()), key=lambda x: -x["lines"] or -x["files"]),
        "big_files": big[:15], "todos": todos, "secrets": secrets, "risks": risks, "evidence_candidates": candidates, "notes": notes,
    }


def summary_line(r):
    langs = ", ".join("%s %d%%" % (l["name"], round(100 * l["lines"] / max(r["code_lines"], 1))) for l in r["languages"] if l["name"] in CODE_LANGS)[:100] if r["code_lines"] else "no code found"
    return "%d files, %s; %d test file(s); %d risk(s) (%d high)" % (r["files"], langs, r["tests"]["files"], len(r["risks"]), sum(1 for k in r["risks"] if k["severity"] == "high"))


def render(r):
    L = ["# Inventory of the existing project", "",
         "Written by `hyperskill.py adopt` from the files on disk. It is a starting point for a person who knows the project to correct, not a verdict. Values that look like secrets are never printed here.", "",
         "**Summary:** " + summary_line(r), ""]
    L += ["## Stack", ""]
    if r["languages"]:
        L += ["| Language | Files | Lines |", "|---|---|---|"] + ["| %s | %d | %d |" % (l["name"], l["files"], l["lines"]) for l in r["languages"][:12]]
    L += ["", "- Package managers: " + (", ".join(sorted({m[1] for m in r["manifests"]})) or "none found"),
          "- Frameworks and tools detected: " + (", ".join(r["frameworks"]) or "none recognised"),
          "- Dependencies named: %d" % r["dependencies"], "- Lockfiles: " + (", ".join(r["lockfiles"][:6]) or "none"),
          "- Scripts: " + (", ".join("`%s`" % k for k in list(r["scripts"])[:10]) or "none declared")]
    L += ["", "## Tests", "", "- Test files: %d (runners: %s)" % (r["tests"]["files"], ", ".join(r["tests"]["runners"]) or "not detected"),
          "- Test folders: " + (", ".join(r["tests"]["dirs"]) or "none"), "- End-to-end setup: " + (", ".join(r["tests"]["e2e"]) or "none found")]
    L += ["", "## CI and delivery", "", "- CI: " + (", ".join(sorted({"%s (%s)" % (c[0], c[1]) for c in r["ci"]})) or "none found"),
          "- Containers: " + r["docs"].get("containers", "none found")]
    g = r["git"]
    L += ["", "## Git", ""]
    L += (["- Branch %s, %d commits, last commit %s, %d contributor(s), %d uncommitted file(s)" % (g.get("branch"), g.get("commits", 0), g.get("last_commit"), g.get("contributors", 0), g.get("uncommitted_files", 0))] if g.get("is_repo") else ["- Not a git repository."])
    L += ["", "## Where the code lives", "", "| Folder | Files | Lines |", "|---|---|---|"] + ["| `%s` | %d | %d |" % (t["path"], t["files"], t["lines"]) for t in r["structure"][:15]]
    if r["big_files"]:
        L += ["", "Largest code files: " + ", ".join("`%s` (%d lines)" % b for b in r["big_files"][:8])]
    L += ["", "## Risks found", ""]
    if r["risks"]:
        order = {"high": 0, "medium": 1, "low": 2}
        for k in sorted(r["risks"], key=lambda k: order[k["severity"]]):
            L.append("- **%s** `%s`: %s" % (k["severity"].upper(), k["id"], k["text"]))
    else:
        L.append("- None found by this scan (which does not mean there are none).")
    L += ["", "## Gate checks these files may already answer", "",
          "Hints only. Open each file, confirm it really satisfies the check, then pass it with evidence as usual; the tracker still refuses evidence that names a file that does not exist.", ""]
    for gid, c in r["evidence_candidates"].items():
        L.append("- `%s`: %s: %s" % (gid, c["why"], ", ".join("`%s`" % f for f in c["files"])))
    if not r["evidence_candidates"]:
        L.append("- None.")
    if r["notes"]:
        L += ["", "## Notes", ""] + ["- " + n for n in r["notes"]]
    L += ["", "## What the scan did not look at", "",
          "Runtime behaviour, data in databases, deployed infrastructure, third-party accounts, whether the tests it found actually pass, and anything in a folder it skips (dependencies, build output, `.git`).", ""]
    return "\n".join(L)


def plan_template():
    return """# Restructure plan

Read `inventory.md` first. A restructure here is a series of small steps, each of which leaves the project working. Nothing is rewritten in one go.

## Goal

One paragraph: what is wrong with the structure today, what it should look like, and what must not change (the behaviour users rely on).

## Behaviour that must not change

List the behaviours the restructure could break, and next to each the test that pins it today. A behaviour with no pinning test is written up as a test first (a characterisation test: it records what the code does now, right or wrong), and that test must pass before step 1.

| Behaviour | Pinned by (test file and name) | Passing before step 1 |
|---|---|---|
|  |  |  |

## Steps

One row per step. A step changes structure or behaviour, never both. Each step names the files it touches, how to prove behaviour is unchanged (the tests above, plus anything else), and how to undo it (usually: revert one commit).

| # | Step | Files | Proof behaviour is unchanged | Undo | Done (test run) |
|---|---|---|---|---|---|
| 1 |  |  |  | revert the commit |  |

## Order and risk

Do the steps that touch the least-tested code last. Put anything that touches data, auth or money behind its own review (`hs-reviewer`).

## Out of scope

What this restructure deliberately does not do.
"""
