import { AdminSidebar } from "@/components/admin/sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    // 現在のパスを取得（リダイレクトループ防止）
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "";
    const isChangePasswordPage = pathname.includes("/change-password");

    // パスワード変更が必要かチェック（メール/パスワードログインの場合）
    // ただし、パスワード変更ページでは再度リダイレクトしない
    if (session?.user?.email && !isChangePasswordPage) {
        const adminUser = await prisma.adminUser.findUnique({
            where: { email: session.user.email },
        });

        if (adminUser?.mustChangePassword) {
            redirect("/admin/change-password");
        }
    }

    return (
        <div className="flex h-screen w-full bg-slate-50">
            <AdminSidebar user={session?.user || undefined} />
            <main className="flex-1 overflow-y-auto">
                <div className="p-4 pt-16 md:p-8 max-w-7xl mx-auto space-y-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
