import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * Takes a token, and returns a new token with updated
 * `accessToken` and `accessTokenExpires`. If an error occurs,
 * returns the old token and an error property.
 */
async function refreshAccessToken(token: any) {
  try {
    const url =
      "https://oauth2.googleapis.com/token?" +
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      });

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fallback to old refresh token
    };
  } catch (error) {
    console.error("Error refreshing access token", error);

    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/youtube",
          prompt: "consent",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (
        url.startsWith("exp://") ||
        url.startsWith("mobile://") ||
        url.startsWith("nexus-music://") ||
        url.startsWith("nexus://")
      ) {
        return url;
      }
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        const parsedUrl = new URL(url);
        if (
          parsedUrl.origin === baseUrl ||
          parsedUrl.hostname.includes("nadeesha.site") ||
          parsedUrl.hostname.includes("vercel.app") ||
          parsedUrl.hostname === "localhost"
        ) {
          return url;
        }
      } catch {
        // Fallback
      }
      return baseUrl;
    },
    async jwt({ token, account, user }) {
      // Initial sign in: Merge account and user info into the token
      if (account && user) {
        const expiresAt = Math.floor(Date.now() + (Number(account.expires_in) || 3600) * 1000);
        return {
          ...token,
          accessToken: account.access_token,
          accessTokenExpires: expiresAt,
          refreshToken: account.refresh_token ?? token.refreshToken,
          user,
        };
      }

      // Return previous token if the access token has not expired yet or expiresAt is not set
      if (!(token as any).accessTokenExpires || Date.now() < (token as any).accessTokenExpires) {
        return token;
      }

      // Access token has expired, try to update it if refresh token is available
      if (token.refreshToken) {
        return refreshAccessToken(token);
      }

      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      // Populate the session object with the token's user data and accessToken
      if (token.user) {
        session.user = token.user;
      }
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_dev_only",
};
