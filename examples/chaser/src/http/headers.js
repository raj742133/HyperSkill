/** Headers on every response. connect-src 'none' is what enforces "the page makes no requests after it loads". */
export function securityHeaders(config) {
  const h = {
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "cross-origin-opener-policy": "same-origin",
    "cache-control": "no-store",
  };
  if (config.NODE_ENV === "production") h["strict-transport-security"] = "max-age=63072000; includeSubDomains";
  return h;
}
