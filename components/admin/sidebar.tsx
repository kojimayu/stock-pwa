"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, FileText, Users, History, Menu,
  ClipboardList, Fan, Boxes, Settings, ChevronRight, User, LogOut
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/admin/logout-button";

interface SidebarProps {
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

// カテゴリ分けされたナビゲーション
const navigationGroups = [
  {
    name: null, // トップレベル（カテゴリなし）
    items: [
      { name: "ダッシュボード", href: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    name: "材料管理",
    icon: Boxes,
    items: [
      { name: "取引履歴", href: "/admin/transactions", icon: FileText },
      { name: "代理入力", href: "/admin/proxy-input", icon: Users },
      { name: "商品管理", href: "/admin/products", icon: Package },
      { name: "在庫管理", href: "/admin/inventory", icon: Package },
      { name: "発注管理", href: "/admin/orders", icon: ClipboardList },
    ],
  },
  {
    name: "エアコン管理",
    icon: Fan,
    items: [
      { name: "在庫管理", href: "/admin/aircon-inventory", icon: Package },
      { name: "発注管理", href: "/admin/aircon-orders", icon: ClipboardList },
      { name: "持出し履歴", href: "/admin/aircon-logs", icon: FileText },
    ],
  },
  {
    name: "システム",
    icon: Settings,
    items: [
      { name: "業者管理", href: "/admin/vendors", icon: Users },
      { name: "操作ログ", href: "/admin/logs", icon: History },
    ],
  },
];

function SidebarContent({ onClose, user }: { onClose?: () => void; user?: SidebarProps['user'] }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-white">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold">在庫管理システム</h1>
        <p className="text-xs text-slate-400 mt-1">管理画面</p>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navigationGroups.map((group, groupIndex) => (
          <div key={groupIndex} className="mb-2">
            {/* カテゴリ見出し */}
            {group.name && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {group.icon && <group.icon className="w-4 h-4" />}
                {group.name}
              </div>
            )}
            {/* ナビゲーションアイテム */}
            <div className={cn(group.name && "ml-2 border-l border-slate-700")}>
              {group.items.map((item) => {
                const isActive = pathname === item.href ||
                  (item.href !== "/admin" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-r-lg transition-colors",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-slate-300 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950">
        {user && (
          <div className="mb-4 px-2 flex items-center gap-3 text-sm text-slate-300">
            <User className="w-8 h-8 p-1.5 bg-slate-800 rounded-full text-slate-400" />
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{user.name || "User"}</div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
            </div>
          </div>
        )}
        <LogoutButton />
        <div className="mt-4 pt-4 border-t border-slate-800">
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 block text-center">
            ← Kiosk画面へ戻る
          </Link>
        </div>
        {/* ビルド情報 */}
        <div className="mt-3 pt-3 border-t border-slate-800/50 text-center">
          <p className="text-[10px] text-slate-600 font-mono">
            {process.env.NEXT_PUBLIC_BUILD_BRANCH || "dev"}:{process.env.NEXT_PUBLIC_BUILD_COMMIT || "local"}
          </p>
          <p className="text-[10px] text-slate-700">
            {process.env.NEXT_PUBLIC_BUILD_DATE
              ? new Date(process.env.NEXT_PUBLIC_BUILD_DATE).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
              : "開発モード"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AdminSidebar({ user }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full w-64">
        <SidebarContent user={user} />
      </div>

      {/* Mobile Sidebar Trigger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-slate-900 border-slate-700 text-white hover:bg-slate-800 hover:text-white shadow-md">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-r border-slate-800 w-64 focus:outline-none">
            <div className="sr-only">
              <SheetTitle>Admin Menu</SheetTitle>
            </div>
            <SidebarContent onClose={() => setOpen(false)} user={user} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
