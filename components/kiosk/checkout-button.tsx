"use client";

import { useState } from "react";
import { useCartStore } from "@/lib/store";
import { createTransaction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle } from "lucide-react";

export function CheckoutButton() {
    const [loading, setLoading] = useState(false);
    const { items, vendor, clearCart } = useCartStore();
    const router = useRouter();

    const handleCheckout = async () => {
        if (!vendor) {
            toast.error("ログインセッションが切れました。再度ログインしてください。");
            router.push("/");
            return;
        }
        if (items.length === 0) {
            toast.error("カートが空です");
            return;
        }

        setLoading(true);
        try {
            const res = await createTransaction(vendor.id, items);

            if (res.success) {
                clearCart();
                // Navigate to complete page
                router.push("/shop/complete");
            } else {
                toast.error(res.message || "出庫処理に失敗しました");
            }
        } catch (e) {
            toast.error("予期せぬエラーが発生しました");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            size="lg"
            className="w-full h-16 text-xl font-bold bg-blue-600 hover:bg-blue-700 shadow-lg"
            onClick={handleCheckout}
            disabled={loading || items.length === 0}
        >
            {loading ? (
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : (
                <CheckCircle className="mr-2 h-6 w-6" />
            )}
            出庫を確定する
        </Button>
    );
}
