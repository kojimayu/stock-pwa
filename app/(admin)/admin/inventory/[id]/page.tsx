import { InventoryDetail } from "@/components/admin/inventory-detail";

export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    return (
        <div className="container mx-auto py-6">
            <InventoryDetail id={parseInt(id)} />
        </div>
    );
}
