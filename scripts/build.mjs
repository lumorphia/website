import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, "dist");
// 配信するものを列挙し、参照画像や開発用ファイルの混入を防ぐ。
const assets = [
  "lumorphia-icon.png",
  "lumorphia-logo.png",
  "prismtone-photo.webp",
  "prismtone-light-wordmark.svg",
  "prismtone-dark-wordmark.svg",
  "Cormorant-OFL.txt",
];
const accounts = "https://accounts.lumorphia.com";
/**
 * Cloudflare の _headers (Workers の静的アセットが読む)。全体に CSP などを付け、HTML は毎回確かめ、
 * ハッシュ付きの CSS・JavaScript は長く、固定名の画像は短く持たせる。
 */
function headersFor(versioned) {
  const lines = [
    "/*",
    `  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src ${accounts}; base-uri 'none'; frame-ancestors 'none'; form-action 'self' ${accounts}`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: strict-origin-when-cross-origin",
    "/",
    "  Cache-Control: no-cache",
    "/index.html",
    "  Cache-Control: no-cache",
    "/404.html",
    "  Cache-Control: no-cache",
    "/assets/*",
    "  Cache-Control: public, max-age=86400",
    ...versioned.flatMap((file) => [
      `/${file}`,
      "  Cache-Control: public, max-age=31536000, immutable",
    ]),
  ];
  return `${lines.join("\n")}\n`;
}
/**
 * accounts を開くまでは、ログインと管理の入口 (data-accounts-entry) を隠し、
 * account.js がセッションを見に行かないよう accounts の origin を空にする。
 */
function gateAccounts(html, accountsOpen) {
  if (accountsOpen) return html;
  return html
    .replaceAll("data-accounts-entry", "data-accounts-entry hidden")
    .replace(
      /(name="lumorphia-accounts-origin"\s+content=)"[^"]*"/,
      '$1""',
    );
}
export async function build(destination = output, { accountsOpen = false } = {}) {
  await mkdir(destination, { recursive: true });
  await mkdir(path.join(destination, "assets"), { recursive: true });
  const filenames = new Map();
  for (const name of ["style.css", "script.js", "theme.js", "account.js"]) {
    const body = await readFile(path.join(root, name));
    const hash = createHash("sha256").update(body).digest("hex").slice(0, 12);
    const file = `${path.parse(name).name}.${hash}${path.extname(name)}`;
    filenames.set(name, file);
    await writeFile(path.join(destination, file), body);
  }
  for (const name of ["index.html", "404.html"]) {
    let html = await readFile(path.join(root, name), "utf8");
    for (const [original, versioned] of filenames)
      html = html.replaceAll(original, versioned);
    html = gateAccounts(html, accountsOpen);
    await writeFile(path.join(destination, name), html);
  }
  await writeFile(path.join(destination, "_headers"), headersFor([...filenames.values()]));
  for (const name of ["robots.txt", "sitemap.xml"])
    await cp(path.join(root, name), path.join(destination, name));
  for (const name of assets)
    await cp(
      path.join(root, "assets", name),
      path.join(destination, "assets", name),
    );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 新しい出力を完成させてから置き換え、古いハッシュ付きファイルを残さない。
  const staging = path.join(root, ".dist-staging");
  try {
    await rm(staging, { recursive: true, force: true });
    // Workers Builds のビルドの環境変数。accounts を開くときに 1 にしてビルドし直す
    await build(staging, {
      accountsOpen: process.env.LUMORPHIA_ACCOUNTS_OPEN === "1",
    });
    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
    console.log("Built dist/ for https://lumorphia.com/");
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
