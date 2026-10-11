import { createServer } from "node:http";
import { createServer as createTlsServer } from "node:https";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const files = process.argv.includes("--dist") ? path.join(root, "dist") : root;
const port = Number(process.env.PORT || 3200);
const accountOrigin = new URL(
  process.env.ACCOUNTS_ORIGIN || "https://accounts.lumorphia.com",
).origin;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};
// 手元のプレビュー用。ソース・参照資料は配信しない。
const handler = async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  response.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' https:; connect-src ${accountOrigin} https://cloudflareinsights.com; base-uri 'none'; frame-ancestors 'none'; form-action 'self' ${accountOrigin}`,
  );
  response.setHeader("Cache-Control", "no-store");
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }
  let filename;
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    filename = pathname === "/" ? "index.html" : pathname.slice(1);
    if (
      !/^(?:index\.html|404\.html|robots\.txt|sitemap\.xml|(?:style|script|theme|account)(?:\.[a-f0-9]{12})?\.(?:css|js)|assets\/[a-zA-Z0-9_-]+\.(?:png|svg|webp|txt))$/.test(
        filename,
      )
    )
      throw new Error("Not found");
    const bytes = await readFile(path.join(files, filename));
    const body = filename.endsWith(".html")
      ? Buffer.from(
          bytes
            .toString()
            .replaceAll("https://accounts.lumorphia.com", accountOrigin),
        )
      : bytes;
    response.writeHead(200, {
      "Content-Type":
        types[path.extname(filename)] || "application/octet-stream",
      "Content-Length": body.length,
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    const body = await readFile(path.join(files, "404.html"));
    response.writeHead(404, { "Content-Type": types[".html"] });
    response.end(request.method === "HEAD" ? undefined : body);
  }
};
const server =
  process.env.DEV_TLS_CERT && process.env.DEV_TLS_KEY
    ? createTlsServer(
        {
          cert: await readFile(process.env.DEV_TLS_CERT),
          key: await readFile(process.env.DEV_TLS_KEY),
        },
        handler,
      )
    : createServer(handler);
server.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Local: ${process.env.DEV_TLS_CERT && process.env.DEV_TLS_KEY ? "https" : "http"}://127.0.0.1:${port}`,
  ),
);
