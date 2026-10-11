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

// Cloudflare (Workers の静的アセット) は dist/_headers を読んで応答のヘッダーを付ける
test("writes the security and cache headers for Cloudflare", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "lumorphia-build-"));
  try {
    await build(output);
    const headers = await readFile(path.join(output, "_headers"), "utf8");
    assert.ok(
      headers.includes(
        "Content-Security-Policy: default-src 'none'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' https:; connect-src https://accounts.lumorphia.com https://cloudflareinsights.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self' https://accounts.lumorphia.com",
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

// accounts は公開したので、ログインと管理の入口は普段から出し、セッションも見に行く
test("shows the account entries by default", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "lumorphia-build-"));
  try {
    await build(output);
    const html = await readFile(path.join(output, "index.html"), "utf8");
    const entries = [...html.matchAll(/<[a-z]+[^>]*data-accounts-entry[^>]*>/g)];
    assert.equal(entries.length, 3);
    for (const [tag] of entries) assert.doesNotMatch(tag, /\shidden(?=[\s>])/);
    assert.match(
      html,
      /name="lumorphia-accounts-origin"\s+content="https:\/\/accounts\.lumorphia\.com"/,
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

// 障害などで accounts を閉じている間は、入口を隠してセッションも見に行かない
test("hides the account entries while accounts is closed", async () => {
  const output = await mkdtemp(path.join(os.tmpdir(), "lumorphia-build-"));
  try {
    await build(output, { accountsClosed: true });
    const html = await readFile(path.join(output, "index.html"), "utf8");
    const entries = [...html.matchAll(/<[a-z]+[^>]*data-accounts-entry[^>]*>/g)];
    assert.equal(entries.length, 3);
    for (const [tag] of entries) assert.match(tag, /\shidden(?=[\s>])/);
    assert.match(html, /name="lumorphia-accounts-origin"\s+content=""/);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

// Workers Builds は wrangler deploy を回す。ビルドしてから dist だけを上げる
test("deploys only the built dist as static assets on Workers", async () => {
  const config = JSON.parse(
    await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
  );
  assert.equal(config.build.command, "npm run build");
  assert.equal(config.assets.directory, "./dist");
  assert.equal(config.assets.not_found_handling, "404-page");
  assert.equal(config.main, undefined);
});
