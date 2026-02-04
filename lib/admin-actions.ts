"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// パスワード変更
export async function changePassword(currentPassword: string, newPassword: string) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        throw new Error("認証が必要です");
    }

    const user = await prisma.adminUser.findUnique({
        where: { email: session.user.email },
    });

    if (!user) {
        throw new Error("ユーザーが見つかりません");
    }

    // 現在のパスワードを確認
    const bcrypt = await import("bcryptjs");
    const isValid = await bcrypt.compare(currentPassword, user.password);

    if (!isValid) {
        throw new Error("現在のパスワードが正しくありません");
    }

    // 新しいパスワードの検証
    if (newPassword.length < 8) {
        throw new Error("パスワードは8文字以上必要です");
    }

    // パスワード更新
    const hashedPassword = await hashPassword(newPassword);
    await prisma.adminUser.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            mustChangePassword: false,
        },
    });

    return { success: true };
}
