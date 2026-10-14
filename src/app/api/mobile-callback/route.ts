import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Called by NextAuth after successful login as the callbackUrl.
 *
 * Strategy:
 * 1. Get the server-side session (user just logged in, session cookie exists in this request).
 * 2. Generate a short-lived one-time token, store user info in Redis (5 min TTL).
 * 3. Append the token to the mobile deep link URL.
 * 4. Serve an HTML page that uses JS window.location.href to trigger the custom URI scheme.
 *
 * IMPORTANT: HTTP 307 redirects to custom URI schemes (nexus-music://) are silently blocked
 * by Chrome on Android. The browser must navigate there via JS, which triggers the OS intent
 * system to open the registered app handler.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get("redirect");

  if (!redirect) {
    return new Response("Missing redirect parameter", { status: 400 });
  }

  // Get the authenticated session (server-side, cookie is available here)
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    console.error("[mobile-callback] No session found");
    return new Response("Unauthorized — no active session", { status: 401 });
  }

  // Generate a short-lived one-time token
  const token = crypto.randomUUID();

  // Store user data in Redis for 5 minutes
  if (redis) {
    await redis.set(
      `mobile-auth-token:${token}`,
      JSON.stringify({
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        accessToken: (session as any).accessToken,
      }),
      { ex: 300 } // 5 minutes
    );
    console.log(`[mobile-callback] Token stored in Redis for: ${session.user.email}`);
  }

  // Build the deep link URL with auth token appended
  let deepLinkUrl = redirect;
  try {
    const parsedUrl = new URL(redirect);
    parsedUrl.searchParams.set("auth_token", token);
    deepLinkUrl = parsedUrl.toString();
  } catch {
    // Custom scheme (e.g. nexus-music://) can't be parsed by URL() — append manually
    deepLinkUrl = redirect.includes("?")
      ? `${redirect}&auth_token=${token}`
      : `${redirect}?auth_token=${token}`;
  }

  console.log(`[mobile-callback] Opening deep link via JS: ${deepLinkUrl}`);

  // Serve an HTML page that navigates to the custom scheme via JavaScript.
  // Chrome on Android silently ignores HTTP 307 to custom URI schemes,
  // but DOES open the OS intent when JS sets window.location.href.
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Returning to Nexus...</title>
    <style>
      body {
        background: #0a0a0a;
        color: #fff;
        font-family: system-ui, sans-serif;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        margin: 0;
        text-align: center;
        gap: 16px;
      }
      p { color: #888; font-size: 14px; }
      a { color: #3B82F6; font-size: 14px; }
    </style>
  </head>
  <body>
    <h2>Login successful!</h2>
    <p>Returning to Nexus app...</p>
    <a href="${deepLinkUrl}">Tap here if the app didn't open</a>
    <script>
      // Trigger the custom URI scheme to open the native app
      window.location.href = ${JSON.stringify(deepLinkUrl)};
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    },
  });
}
