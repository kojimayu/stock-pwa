import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PasswordChangeFormClient } from "./password-change-form-client";

export default async function ChangePasswordPage() {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        redirect("/login");
    }

    // パスワード変更が必要かチェック
    const adminUser = await prisma.adminUser.findUnique({
        where: { email: session.user.email },
    });

    const isRequired = adminUser?.mustChangePassword ?? false;

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <PasswordChangeFormClient isRequired={isRequired} />
        </div>
    );
}
