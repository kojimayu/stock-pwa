import { getAllVendors } from "@/lib/actions";
import { VendorList } from "@/components/admin/vendor-list";

export default async function VendorsPage() {
    const vendors = await getAllVendors();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">業者管理</h2>
                <p className="text-muted-foreground">出庫作業を行う業者の登録・管理</p>
            </div>

            <VendorList vendors={vendors} />
        </div>
    );
}
