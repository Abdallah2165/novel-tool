import "server-only";

import { ApiError } from "@/lib/api/http";
import { auth } from "@/lib/auth/server";

export async function resolveHeadersSession(headers: Headers) {
  const session = await auth.api.getSession({
    headers,
    query: {
      disableRefresh: true,
    },
  });

  if (!session?.user) {
    throw new ApiError(401, "AUTH_ERROR", "Authentication required.");
  }

  return session;
}

export async function resolveHeadersUser(headers: Headers) {
  const session = await resolveHeadersSession(headers);
  return session.user;
}

export async function resolveRequestUser(request: Request) {
  return resolveHeadersUser(request.headers);
}
