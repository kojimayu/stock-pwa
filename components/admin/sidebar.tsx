"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, FileText, Users, History, Menu,
  ClipboardList, Fan, Boxes, Settings, ChevronRight
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

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
      { name: "商品管理", href: "/admin/products", icon: Package },
      { name: "在庫管理", href: "/admin/inventory", icon: Package },
      { name: "発注管理", href: "/admin/orders", icon: ClipboardList },
    ],
  },
  {
    name: "エアコン管理",
    icon: Fan,
    items: [
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

function SidebarContent({ onClose }: { onClose?: () => void }) {
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
      <div className="p-4 border-t border-slate-800">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 block">
          ← Kiosk画面へ戻る
        </Link>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-full w-64">
        <SidebarContent />
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
            <SidebarContent onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
