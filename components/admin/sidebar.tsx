import Link from "next/link";
import { LayoutDashboard, Package, FileText, Users, TrendingUp, History } from "lucide-react";

const navigation = [
  { name: "ダッシュボード", href: "/admin", icon: LayoutDashboard },
  { name: "取引履歴", href: "/admin/transactions", icon: FileText },
  { name: "利益分析", href: "/admin/analysis", icon: TrendingUp },
  { name: "商品管理", href: "/admin/products", icon: Package },
  { name: "業者管理", href: "/admin/vendors", icon: Users },
  { name: "操作ログ", href: "/admin/logs", icon: History },
];

export function AdminSidebar() {
  return (
    <div className="flex flex-col h-full w-64 bg-slate-900 text-white">
      <div className="p-6">
        <h1 className="text-xl font-bold">在庫管理システム</h1>
        <p className="text-xs text-slate-400">管理画面</p>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-300">
          ← Kiosk画面へ戻る
        </Link>
      </div>
    </div>
  );
}
