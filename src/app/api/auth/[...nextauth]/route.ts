import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Next.js 16 Turbopack discovery hint
const handler = NextAuth(authOptions);

// Force dynamic to prevent static generation of auth routes
export const dynamic = "force-dynamic";

export { handler as GET, handler as POST };
