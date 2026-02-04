
import { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
    providers: [
        // Azure AD SSO（HTTPS環境用）
        AzureADProvider({
            clientId: process.env.AZURE_AD_CLIENT_ID!,
            clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
            tenantId: process.env.AZURE_AD_TENANT_ID,
        }),
        // メール/パスワード認証（HTTP環境でも使用可能）
        CredentialsProvider({
            name: "メールアドレス",
            credentials: {
                email: { label: "メールアドレス", type: "email" },
                password: { label: "パスワード", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                // データベースから管理者を検索
                const user = await prisma.adminUser.findUnique({
                    where: { email: credentials.email },
                });

                if (!user) {
                    return null;
                }

                // パスワード照合
                const isValid = await bcrypt.compare(credentials.password, user.password);
                if (!isValid) {
                    return null;
                }

                return {
                    id: String(user.id),
                    email: user.email,
                    name: user.name,
                    mustChangePassword: user.mustChangePassword,
                };
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.mustChangePassword = (user as any).mustChangePassword;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).mustChangePassword = token.mustChangePassword;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: "jwt",
    },
};

// パスワードハッシュ化ヘルパー
export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

// パスワード検証ヘルパー
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}
