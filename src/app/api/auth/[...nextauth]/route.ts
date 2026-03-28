import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        // You can attach custom data from the token if needed
        // (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  // Ensure we use JWT strategy since we aren't hooking up a DB yet
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_dev_only",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
