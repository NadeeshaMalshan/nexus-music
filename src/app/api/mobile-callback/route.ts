import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import redis from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Called by NextAuth after successful login as the callbackUrl in external browser.
 * 
 * Strategy:
 * 1. Get server session and raw cookie header.
 * 2. Store sessionToken and user info in Redis under a short-lived token (5 min TTL).
 * 3. Return HTML with Android Intent URI & Custom Scheme JS redirect + fallback button.
 *    (Android Chrome blocks automated HTTP 302/307 header redirects to custom schemes).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get("redirect") || "nexus://auth-callback";

  // Get the authenticated session
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    console.error("[mobile-callback] No session found");
    return new Response("Unauthorized — no active session", { status: 401 });
  }

  // Extract raw next-auth session cookie from request
  const cookieHeader = request.headers.get("cookie") || "";
  const secureTokenMatch = cookieHeader.match(/__Secure-next-auth\.session-token=([^;]+)/);
  const tokenMatch = cookieHeader.match(/next-auth\.session-token=([^;]+)/);
  const sessionToken = (secureTokenMatch && secureTokenMatch[1]) || (tokenMatch && tokenMatch[1]) || "";

  // Generate a short-lived one-time token
  const token = crypto.randomUUID();

  // Store session token and user data in Redis for 5 minutes
  if (redis) {
    await redis.set(
      `mobile-auth-token:${token}`,
      JSON.stringify({
        sessionToken,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        accessToken: (session as any).accessToken,
      }),
      { ex: 300 } // 5 minutes
    );
    console.log(`[mobile-callback] Token stored in Redis for: ${session.user.email}`);
  }

  const customSchemeUrl = `nexus://auth-callback?auth_token=${encodeURIComponent(token)}`;
  const androidIntentUrl = `intent://auth-callback?auth_token=${encodeURIComponent(token)}#Intent;scheme=nexus;package=com.nexusmobile;end`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Successful - Returning to App</title>
  <style>
    body {
      background-color: #000000;
      color: #ffffff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
      text-align: center;
    }
    .card {
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    .checkmark {
      width: 60px;
      height: 60px;
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin: 0 auto 20px auto;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 8px 0;
      font-weight: 600;
    }
    p {
      color: #9ca3af;
      font-size: 14px;
      margin: 0 0 24px 0;
      line-height: 1.5;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 14px 0;
      background: #3b82f6;
      color: #ffffff;
      font-weight: 600;
      font-size: 16px;
      border-radius: 10px;
      text-decoration: none;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      transition: background 0.2s;
    }
    .btn:active {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="checkmark">✓</div>
    <h1>Login Successful!</h1>
    <p>Opening Nexus Music app...</p>
    <a id="appLink" href="${androidIntentUrl}" class="btn">Open App</a>
  </div>
  <script>
    var intentUrl = "${androidIntentUrl}";
    var customUrl = "${customSchemeUrl}";

    // Attempt automatic navigation
    try {
      window.location.href = intentUrl;
    } catch(e) {}

    setTimeout(function() {
      try {
        window.location.href = customUrl;
      } catch(e) {}
    }, 400);
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
