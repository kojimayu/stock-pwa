import { getOrderById } from "@/lib/actions";
import { OrderDetail } from "@/components/admin/order-detail";
import { notFound } from "next/navigation";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const order = await getOrderById(parseInt(id));

    if (!order) {
        notFound();
    }

    return (
        <OrderDetail initialOrder={order as any} />
    );
}
