import http.client
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPTS = os.path.join(ROOT, "scripts")
sys.path.insert(0, SCRIPTS)
import hs_live  # noqa: E402

PREV = os.path.join(ROOT, "site", "live", "previews")
TRACKER = os.path.join(SCRIPTS, "hyperskill.py")


def catalog():
    with open(os.path.join(ROOT, "skills", "hyperskill", "catalog.json"), encoding="utf-8") as f:
        return {g["id"]: g for g in json.load(f)["groups"]}


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class CoverageTests(unittest.TestCase):
    def test_every_item_that_can_have_a_picture_has_one(self):
        want = {"tells": 30, "concepts": 111, "fixes": 20, "addons": 19, "uu-landing": 34, "uu-styles": 88, "uu-fonts": 74, "sw-components": 58,
                "sw-figures": 22, "sw-headline": 8, "sw-buttons": 4, "sw-cards": 4, "sw-reveal": 5, "sw-extras": 4, "sw-presets": 7}
        groups = catalog()
        for gid, n in want.items():
            have = sum(1 for i in groups[gid]["items"] if i.get("media"))
            self.assertEqual(have, n, "%s: %d of %d items have a picture" % (gid, have, len(groups[gid]["items"])))
        self.assertGreaterEqual(sum(1 for i in groups["sw-hero"]["items"] if i.get("media")), 10)
        self.assertGreaterEqual(sum(1 for i in groups["sw-login"]["items"] if i.get("media")), 9, "sign-in backgrounds reuse the hero clips")
        self.assertGreaterEqual(sum(1 for i in groups["sw-modules"]["items"] if i.get("media")), 5)
        self.assertGreaterEqual(sum(1 for i in groups["figures"]["items"] if i.get("media")), 7)

    def test_the_effects_that_move_are_real_clips_not_stills(self):
        groups = catalog()
        for gid in ("sw-hero", "sw-headline", "sw-buttons", "sw-cards", "sw-reveal", "sw-extras", "sw-components", "sw-figures"):
            for it in groups[gid]["items"]:
                if it.get("media"):
                    self.assertEqual(it["media"]["kind"], "video", it["id"])

    def test_every_referenced_file_exists_and_is_what_it_claims_to_be(self):
        for g in catalog().values():
            for it in g["items"]:
                m = it.get("media")
                if not m:
                    continue
                path = os.path.join(PREV, m["src"])
                self.assertTrue(os.path.isfile(path), it["id"])
                with open(path, "rb") as f:
                    head = f.read(16)
                if m["kind"] == "video":
                    self.assertIn(b"ftyp", head, it["id"])
                    self.assertGreater(os.path.getsize(path), 2500, it["id"] + " looks empty")
                    self.assertTrue(os.path.isfile(os.path.join(PREV, m["poster"])), it["id"] + " has no poster")
                elif m["kind"] == "image":
                    self.assertEqual(head[:4], b"RIFF", it["id"])

    def test_the_drawn_svgs_are_inert(self):
        n = 0
        for dirpath, _, files in os.walk(PREV):
            for name in files:
                if not name.endswith(".svg"):
                    continue
                n += 1
                path = os.path.join(dirpath, name)
                tree = ET.parse(path)
                for el in tree.iter():
                    tag = el.tag.split("}")[-1]
                    self.assertNotIn(tag, ("script", "foreignObject", "iframe", "image", "a"), path)
                    for k, v in el.attrib.items():
                        self.assertFalse(k.lower().startswith("on"), path)
                        self.assertNotRegex(v, r"(?i)^\s*(https?:|javascript:|data:)", path)
        self.assertGreater(n, 290)

    def test_the_previews_stay_small(self):
        total = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(PREV) for f in fs)
        self.assertLess(total, 40 * 1024 * 1024, "previews are %.1f MB" % (total / 1e6))


class ServeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        subprocess.run([sys.executable, TRACKER, "--root", self.tmp.name, "init", "--name", "demo"], check=True, capture_output=True)
        self.server, self.port = hs_live.make_server(self.tmp.name, free_port())
        threading.Thread(target=self.server.serve_forever, daemon=True).start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def get(self, path, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        c.request("GET", path, headers=headers or {})
        r = c.getresponse()
        body = r.read()
        out = (r.status, dict(r.getheaders()), body)
        c.close()
        return out

    def a_video(self):
        for g in catalog().values():
            for it in g["items"]:
                if it.get("media", {}).get("kind") == "video":
                    return it["media"]
        self.fail("no video in the catalogue")

    def test_pictures_and_clips_are_served_with_the_right_type(self):
        m = self.a_video()
        status, h, body = self.get("/live/previews/" + m["src"])
        self.assertEqual((status, h["Content-Type"]), (200, "video/mp4"))
        self.assertIn(b"ftyp", body[:16])
        status, h, _ = self.get("/live/previews/" + m["poster"])
        self.assertEqual((status, h["Content-Type"]), (200, "image/webp"))
        status, h, _ = self.get("/live/previews/tells/harsh-gradients.svg")
        self.assertEqual((status, h["Content-Type"]), (200, "image/svg+xml"))
        self.assertIn("media-src 'self'", h["Content-Security-Policy"])

    def test_video_supports_byte_ranges_for_safari_and_seeking(self):
        m = self.a_video()
        status, h, body = self.get("/live/previews/" + m["src"], {"Range": "bytes=0-99"})
        self.assertEqual(status, 206)
        self.assertEqual(len(body), 100)
        self.assertTrue(h["Content-Range"].startswith("bytes 0-99/"))
        self.assertEqual(self.get("/live/previews/" + m["src"], {"Range": "bytes=99999999-"})[0], 416)

    def test_nothing_outside_the_preview_folder_or_extension_list_is_served(self):
        for bad in ("/live/previews/../state.json", "/live/previews/tells/../../live.js", "/live/previews/tells/harsh-gradients.svg/../../../index.html",
                    "/live/previews/tells/x.html", "/live/previews/tells/.hidden.svg", "/live/previews/%2e%2e/index.html", "/live/previews/tells/nope.svg"):
            self.assertEqual(self.get(bad)[0], 404, bad)

    def test_a_foreign_host_cannot_fetch_them(self):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        c.request("GET", "/live/previews/tells/harsh-gradients.svg", headers={"Host": "evil.example"})
        self.assertEqual(c.getresponse().status, 403)

    def test_the_page_shows_pictures_without_innerhtml_and_has_a_viewer(self):
        with open(os.path.join(ROOT, "site", "live", "live.js"), encoding="utf-8") as f:
            js = f.read()
        self.assertNotIn("innerHTML", js)
        self.assertIn("createElement(\"video\")", js)
        with open(os.path.join(ROOT, "site", "live", "index.html"), encoding="utf-8") as f:
            self.assertIn('<dialog id="kit-box"', f.read())


if __name__ == "__main__":
    unittest.main()
