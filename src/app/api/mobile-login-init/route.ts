import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Initiates Google OAuth sign-in automatically when opened in external Chrome browser.
 * Fetches NextAuth CSRF token, sets the CSRF cookie on NextResponse, and auto-submits POST form to /api/auth/signin/google.
 */
export async function GET(request: Request) {
  const reqUrl = new URL(request.url);
  const host = request.headers.get("host") || reqUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl = `${protocol}://${host}`;

  const DEEP_LINK_CALLBACK = "nexus://auth-callback";
  const mobileCallback = `${baseUrl}/api/mobile-callback?redirect=${encodeURIComponent(DEEP_LINK_CALLBACK)}`;

  let csrfToken = "";
  let csrfCookieName = "";
  let csrfCookieValue = "";

  try {
    const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`, {
      headers: { cookie: request.headers.get("cookie") || "" },
      cache: "no-store",
    });

    const setCookieHeader = csrfRes.headers.get("set-cookie") || "";
    const match = setCookieHeader.match(/(__Host-next-auth\.csrf-token|next-auth\.csrf-token)=([^;]+)/);
    if (match) {
      csrfCookieName = match[1];
      csrfCookieValue = decodeURIComponent(match[2]);
    }

    if (csrfRes.ok) {
      const data = await csrfRes.json();
      csrfToken = data.csrfToken || "";
    }
  } catch (err) {
    console.error("[mobile-login-init] Error fetching CSRF token:", err);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connecting to Google...</title>
  <style>
    body {
      background-color: #000;
      color: #fff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-left-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>Connecting to Google Sign-In...</p>
  <form id="loginForm" action="${baseUrl}/api/auth/signin/google" method="POST">
    <input type="hidden" name="csrfToken" value="${csrfToken}" />
    <input type="hidden" name="callbackUrl" value="${mobileCallback}" />
  </form>
  <script>
    document.getElementById("loginForm").submit();
  </script>
</body>
</html>`;

  const response = new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });

  if (csrfCookieName && csrfCookieValue) {
    response.cookies.set(csrfCookieName, csrfCookieValue, {
      path: "/",
      httpOnly: true,
      secure: csrfCookieName.startsWith("__Host-"),
      sameSite: "lax",
    });
  }

  return response;
}
