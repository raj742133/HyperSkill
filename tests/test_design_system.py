import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class DesignSystemDocTests(unittest.TestCase):
    def test_every_embedded_css_block_is_still_in_the_site_stylesheet(self):
        with open(os.path.join(ROOT, "docs", "design-system.md"), encoding="utf-8") as f:
            doc = f.read()
        with open(os.path.join(ROOT, "site", "styles.css"), encoding="utf-8") as f:
            css = f.read()
        blocks = re.findall(r"```css file=site/styles\.css\n(.*?)\n```", doc, re.S)
        self.assertGreaterEqual(len(blocks), 12, "the document should embed the tokens, base, layout and every component")
        for b in blocks:
            self.assertIn(b, css, "this block no longer matches site/styles.css:\n" + b[:120])

    def test_the_documented_tokens_exist_in_the_stylesheet(self):
        with open(os.path.join(ROOT, "docs", "design-system.md"), encoding="utf-8") as f:
            doc = f.read()
        with open(os.path.join(ROOT, "site", "styles.css"), encoding="utf-8") as f:
            css = f.read()
        for token in re.findall(r"`(--[a-z0-9-]+)`", doc):
            if token in ("--accent-text",):
                continue  # suggested in the document, not part of the original stylesheet
            self.assertIn(token + ":", css, token + " is documented but not defined")
