import { AdminSidebar } from "@/components/admin/sidebar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

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
