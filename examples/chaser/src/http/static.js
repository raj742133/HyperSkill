import fs from "node:fs";
import path from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

/** Serve files from `root` only. Anything that resolves outside it, or is not a regular file, is a 404. */
export function serveStatic(root, urlPath, res) {
  let rel;
  try { rel = decodeURIComponent(urlPath.split("?")[0]); } catch { return false; }
  if (rel.includes("\0")) return false;
  if (rel === "/" ) rel = "/index.html";
  const file = path.resolve(root, "." + rel);
  if (file !== root && !file.startsWith(root + path.sep)) return false;
  let st;
  try { st = fs.statSync(file); } catch { return false; }
  if (!st.isFile()) return false;
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "content-length": st.size });
  fs.createReadStream(file).pipe(res);
  return true;
}
