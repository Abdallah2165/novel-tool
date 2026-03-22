import { isIP } from "node:net";

import { ApiError } from "@/lib/api/http";
import { isProduction } from "@/lib/env";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
]);

function isPrivateIpv4(hostname: string) {
  if (isIP(hostname) !== 4) {
    return false;
  }

  const [a, b] = hostname.split(".").map(Number);
  return (
    a === 10 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254)
  );
}

export function assertSafeRemoteUrl(rawUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ApiError(422, "URL_INVALID", "URL format is invalid.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ApiError(422, "URL_INVALID", "Only HTTP(S) endpoints are allowed.");
  }

  if (isProduction && parsed.protocol !== "https:") {
    throw new ApiError(422, "URL_INVALID", "Production only allows HTTPS endpoints.");
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname) || isPrivateIpv4(hostname)) {
    throw new ApiError(422, "URL_INVALID", "Private, loopback, or metadata endpoints are blocked.");
  }

  return parsed;
}
