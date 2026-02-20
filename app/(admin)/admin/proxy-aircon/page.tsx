import { getVendors } from "@/lib/actions";
import { ProxyAirconClient } from "./proxy-aircon-client";

// サーバーコンポーネント: 業者一覧を取得してクライアントに渡す
export default async function ProxyAirconPage() {
    const vendors = await getVendors();

    return <ProxyAirconClient vendors={vendors} />;
}
