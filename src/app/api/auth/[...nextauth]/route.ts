import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  // Optional: Define a secret for development fallback
  secret: process.env.NEXTAUTH_SECRET || "fallback_development_secret_nexus_music_123",
  // You can define callbacks or pages here if you'd like
});

export { handler as GET, handler as POST };
