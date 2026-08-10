#!/usr/bin/env python3
"""Offline wheel resolver/downloader.

Works around a corporate CDN that intermittently 403s the PEP 658
``.whl.metadata`` sidecars that pip needs during resolution, while the actual
``.whl`` files and the /simple/ index download fine via urllib.

Strategy: resolve the dependency closure ourselves using urllib + the wheel's
own METADATA (Requires-Dist), download every needed wheel into a wheelhouse,
then the caller does:  pip install --no-index --no-deps wheelhouse/*.whl
"""
from __future__ import annotations

import html.parser
import io
import os
import sys
import urllib.request
import zipfile

from pip._vendor.packaging.requirements import Requirement
from pip._vendor.packaging.version import Version, InvalidVersion
from pip._vendor.packaging.utils import canonicalize_name
from pip._vendor.packaging.specifiers import SpecifierSet

PYSTR = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

WHEELHOUSE = sys.argv[1]
ROOTS = sys.argv[2:]
os.makedirs(WHEELHOUSE, exist_ok=True)

# Already present in the venv (or provided by an equivalent dist). We do NOT
# download these; at install time they satisfy runtime imports. opencv-python /
# -headless / -contrib all provide the same ``cv2`` module.
SATISFIED = {
    "pip", "setuptools", "wheel", "numpy", "pillow", "pymupdf", "pymupdfb",
    "opencv-python", "opencv-python-headless", "opencv-contrib-python",
}

PYVER = sys.version_info


def fetch(url: str) -> bytes:
    import time
    last = None
    for attempt in range(8):
        req = urllib.request.Request(url, headers={"User-Agent": "bootstrap/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (403, 429, 500, 502, 503):
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    raise last


class LinkParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []  # (href, requires_python)

    def handle_starttag(self, tag, attrs):
        if tag != "a":
            return
        d = dict(attrs)
        href = d.get("href", "")
        if href:
            self.links.append((href, d.get("data-requires-python") or ""))


def wheel_ok(fname: str) -> bool:
    """Accept wheels compatible with this interpreter (win_amd64 / any)."""
    if not fname.endswith(".whl"):
        return False
    stem = fname[:-4]
    parts = stem.split("-")
    if len(parts) < 3:
        return False
    pytag, abitag, plattag = parts[-3], parts[-2], parts[-1]
    plats = plattag.split(".")
    if not any(p in ("any", "win_amd64") for p in plats):
        return False
    abis = abitag.split(".")
    # Reject free-threaded (cp313t) and any other-version specific ABIs.
    ok_abi = {"none", "abi3", f"cp{PYVER.major}{PYVER.minor}"}
    if not any(a in ok_abi for a in abis):
        return False
    if "abi3" in abis:
        return True
    pys = pytag.split(".")
    if any(p in ("py3", "py2") for p in pys):
        return True
    if f"cp{PYVER.major}{PYVER.minor}" in pys:
        return True
    return False


def parse_version_from_fname(fname: str, dist: str) -> str | None:
    stem = fname[:-4]
    parts = stem.split("-")
    if len(parts) < 2:
        return None
    return parts[1]


def pick_wheel(name: str, specifier) -> tuple[str, str]:
    """Return (url, filename) of the best matching wheel for name."""
    index = f"https://pypi.org/simple/{canonicalize_name(name)}/"
    p = LinkParser()
    p.feed(fetch(index).decode("utf-8", "replace"))
    ignore_rp = os.environ.get("IGNORE_RP") == "1"
    candidates = []
    for href, rp in p.links:
        fname = href.split("/")[-1].split("#")[0]
        if not wheel_ok(fname):
            continue
        if rp and not ignore_rp:
            try:
                if not SpecifierSet(rp).contains(PYSTR, prereleases=True):
                    continue
            except Exception:
                pass
        vstr = parse_version_from_fname(fname, name)
        if not vstr:
            continue
        try:
            v = Version(vstr)
        except InvalidVersion:
            continue
        if v.is_prerelease:
            continue
        if specifier is not None and vstr not in specifier:
            # specifier.contains handles prereleases; use __contains__
            if not specifier.contains(v):
                continue
        candidates.append((v, fname, href))
    if candidates:
        candidates.sort(key=lambda t: t[0])
        _, fname, href = candidates[-1]
        if href.startswith("/"):
            href = "https://pypi.org" + href
        return href, fname, False

    # No wheel: fall back to an sdist (pure-python packages like
    # antlr4-python3-runtime ship sdist-only for some versions).
    SDIST_EXTS = (".tar.gz", ".zip", ".tar.bz2")
    sdists = []
    for href, rp in p.links:
        fname = href.split("/")[-1].split("#")[0]
        if not fname.endswith(SDIST_EXTS):
            continue
        if rp:
            try:
                if not SpecifierSet(rp).contains(PYSTR, prereleases=True):
                    continue
            except Exception:
                pass
        stem = fname
        for ext in SDIST_EXTS:
            if stem.endswith(ext):
                stem = stem[: -len(ext)]
                break
        prefix = name + "-"
        if not stem.lower().startswith(prefix.lower()):
            continue
        vstr = stem[len(prefix):]
        try:
            v = Version(vstr)
        except InvalidVersion:
            continue
        if v.is_prerelease:
            continue
        if specifier is not None and not specifier.contains(v):
            continue
        sdists.append((v, fname, href))
    if not sdists:
        raise RuntimeError(f"No compatible wheel or sdist found for {name} {specifier}")
    sdists.sort(key=lambda t: t[0])
    _, fname, href = sdists[-1]
    if href.startswith("/"):
        href = "https://pypi.org" + href
    return href, fname, True


def requires_from_wheel(path: str):
    with zipfile.ZipFile(path) as z:
        meta_name = None
        for n in z.namelist():
            if n.endswith(".dist-info/METADATA"):
                meta_name = n
                break
        if not meta_name:
            return []
        text = z.read(meta_name).decode("utf-8", "replace")
    reqs = []
    for line in text.splitlines():
        if line.startswith("Requires-Dist:"):
            reqs.append(line[len("Requires-Dist:"):].strip())
    return reqs


def marker_ok(req: Requirement) -> bool:
    if req.marker is None:
        return True
    # Evaluate with no extras selected -> pulls only mandatory deps.
    try:
        return req.marker.evaluate({"extra": ""})
    except Exception:
        return True


def main():
    seen = set()
    queue = [Requirement(r) for r in ROOTS]
    downloaded = []
    while queue:
        req = queue.pop(0)
        cname = canonicalize_name(req.name)
        if cname in SATISFIED or cname in seen:
            continue
        seen.add(cname)
        url, fname, is_sdist = pick_wheel(req.name, req.specifier)
        dest = os.path.join(WHEELHOUSE, fname)
        if not os.path.exists(dest):
            print(f"  downloading {fname}{' [sdist]' if is_sdist else ''}")
            data = fetch(url)
            with open(dest, "wb") as f:
                f.write(data)
        else:
            print(f"  cached      {fname}")
        downloaded.append(fname)
        if is_sdist:
            # Can't easily read deps from an sdist; these fallbacks are
            # pure-python leaf packages (e.g. antlr runtime) with no deps.
            continue
        for line in requires_from_wheel(dest):
            try:
                dep = Requirement(line)
            except Exception:
                continue
            if not marker_ok(dep):
                continue
            if canonicalize_name(dep.name) not in seen:
                queue.append(dep)
    print(f"\nResolved {len(downloaded)} wheels into {WHEELHOUSE}")


if __name__ == "__main__":
    main()
