import { AdminSidebar } from "@/components/admin/sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    // パスワード変更が必要かチェック（メール/パスワードログインの場合）
    if (session?.user?.email) {
        const adminUser = await prisma.adminUser.findUnique({
            where: { email: session.user.email },
        });

        // パスワード変更が必要で、かつパスワード変更ページ以外にアクセスしている場合
        if (adminUser?.mustChangePassword) {
            // パスワード変更ページへリダイレクト（無限ループ防止のチェックは呼び出し元で行う）
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
