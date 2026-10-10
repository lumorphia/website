import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { build } from "../scripts/build.mjs";

test("ships only public files with valid versioned stylesheet and script references", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "lumorphia-build-"));
  try {
    await build(output);
    const files = await readdir(output);
    assert.equal(files.includes("previews"), false);
    assert.equal(files.includes("README.md"), false);
    assert.equal(files.includes("scripts"), false);
    for (const page of ["index.html", "404.html"]) {
      const html = await readFile(path.join(output, page), "utf8");
      const references = [
        ...html.matchAll(
          /(?:src|href)="\/?((?:style|script|theme|account)\.[a-f0-9]{12}\.(?:css|js))"/g,
        ),
      ];
      assert.equal(references.length, page === "index.html" ? 4 : 2);
      for (const [, filename] of references)
        await access(path.join(output, filename));
    }
    const html = await readFile(path.join(output, "index.html"), "utf8");
    assert.equal(html.includes('content="noindex"'), false);
    assert.equal(html.includes("デザイン試作"), false);
    assert.ok(html.includes('href="https://lumorphia.com/"'));
    assert.ok(html.includes('class="game-copyright">© SQUARE ENIX</span>'));
    assert.ok(files.includes("robots.txt"));
    assert.ok(files.includes("sitemap.xml"));
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

// Cloudflare Pages は dist/_headers を読んで応答のヘッダーを付ける
test("writes the security and cache headers for Cloudflare Pages", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "lumorphia-build-"));
  try {
    await build(output);
    const headers = await readFile(path.join(output, "_headers"), "utf8");
    assert.ok(
      headers.includes(
        "Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src https://accounts.lumorphia.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://accounts.lumorphia.com",
      ),
    );
    assert.ok(headers.includes("X-Content-Type-Options: nosniff"));
    assert.ok(headers.includes("Referrer-Policy: strict-origin-when-cross-origin"));
    const files = await readdir(output);
    const versioned = files.filter((f) => /\.[a-f0-9]{12}\.(?:css|js)$/.test(f));
    assert.equal(versioned.length, 4);
    for (const file of versioned)
      assert.ok(
        headers.includes(`/${file}\n  Cache-Control: public, max-age=31536000, immutable`),
        file,
      );
    assert.ok(headers.includes("/\n  Cache-Control: no-cache"));
    assert.ok(headers.includes("/assets/*\n  Cache-Control: public, max-age=86400"));
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
