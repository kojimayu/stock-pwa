import { getOrders } from "@/lib/actions";
import { OrderList } from "@/components/admin/order-list";

export default async function AdminOrdersPage() {
    const orders = await getOrders();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">発注管理</h2>
                    <p className="text-muted-foreground">
                        在庫補充のための発注書作成と入荷管理を行います。
                    </p>
                </div>
            </div>
            <OrderList initialOrders={orders as any} />
        </div>
    );
}
