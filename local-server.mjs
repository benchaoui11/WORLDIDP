import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 3003);

loadLocalEnv();

const { default: gate } = await import("./api/gate.js");
const { default: block } = await import("./api/block.js");
const { default: switchMode } = await import("./api/switch-mode.js");

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const WHITE_ASSET_EXTENSIONS = new Set([".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff", ".woff2"]);

function loadLocalEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index);
    const value = line.slice(index + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function toNodeResponse(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      res.setHeader(key, value);
      return this;
    },
    send(body) {
      res.end(body);
    },
  };
}

async function toEdgeRequest(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  return new Request(`http://localhost:${PORT}${req.url}`, {
    method: req.method,
    headers: req.headers,
    body: chunks.length ? Buffer.concat(chunks) : undefined,
    duplex: "half",
  });
}

async function sendWebResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

function safeStaticPath(pathname) {
  const relative = pathname.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, relative);
  if (!filePath.startsWith(ROOT + path.sep)) return null;
  return filePath;
}

function sendStatic(req, res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function isAllowedWhiteAsset(pathname) {
  if (!pathname.startsWith("/_white/")) return false;
  return WHITE_ASSET_EXTENSIONS.has(path.extname(pathname).toLowerCase());
}

function shouldUseGate(pathname) {
  return pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/apply" ||
    pathname.startsWith("/apply/") ||
    pathname.endsWith(".html");
}

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
  res.end("<!doctype html><title>Not found</title><h1>404</h1>");
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://localhost:${PORT}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === "/api/switch-mode") {
      return sendWebResponse(res, await switchMode(await toEdgeRequest(req)));
    }

    if (isAllowedWhiteAsset(pathname)) {
      const filePath = safeStaticPath(pathname);
      if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return sendStatic(req, res, filePath);
      }
      return notFound(res);
    }

    if (pathname === "/api/block" || pathname.startsWith("/_offer/") || pathname.startsWith("/_white/")) {
      return sendWebResponse(res, block());
    }

    if (shouldUseGate(pathname)) {
      return gate(req, toNodeResponse(res));
    }

    const filePath = safeStaticPath(pathname);
    if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return sendStatic(req, res, filePath);
    }

    return notFound(res);
  } catch (error) {
    console.error("[local-server]", error);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Local server error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`FirstIDP local server ready: http://localhost:${PORT}`);
});
