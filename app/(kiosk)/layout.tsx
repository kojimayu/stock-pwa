import { IdleTimer } from "@/components/kiosk/idle-timer";

export default function KioskLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        // キオスクモード向けに、これ以上の装飾はせずchildrenを表示
        // 将来的にはヘッダーなどが必要ならここに追加
        <div className="min-h-screen bg-gray-50 text-gray-900">
            <IdleTimer />
            {children}
        </div>
    );
}
