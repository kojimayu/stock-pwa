import { InventoryList } from "@/components/admin/inventory-list";

export default function InventoryPage() {
    return (
        <div className="container mx-auto py-6">
            <h1 className="text-2xl font-bold mb-6">棚卸管理</h1>
            <InventoryList />
        </div>
    );
}
