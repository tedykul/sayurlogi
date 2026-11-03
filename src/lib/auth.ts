import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase().trim();
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.active) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});
        return { id: user.id, email: user.email, name: user.name || undefined, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "viewer";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = (token.role as string) || "viewer";
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || process.env.ADMIN_PASSWORD || "dev-secret-change-in-production",
};

declare module "next-auth" {
  interface Session {
    user: { id?: string; email: string; name?: string | null; role?: string };
  }
  interface User { role?: string }
}

declare module "next-auth/jwt" {
  interface JWT { id?: string; role?: string }
}
