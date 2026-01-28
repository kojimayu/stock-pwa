"use client";

import Link from "next/link";
import { LayoutDashboard, Package, FileText, Users, TrendingUp, History, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navigation = [
  { name: "ダッシュボード", href: "/admin", icon: LayoutDashboard },
  { name: "取引履歴", href: "/admin/transactions", icon: FileText },
  { name: "利益分析", href: "/admin/analysis", icon: TrendingUp },
  { name: "商品管理", href: "/admin/products", icon: Package },
  { name: "在庫管理 (棚卸)", href: "/admin/inventory", icon: Package },
  { name: "業者管理", href: "/admin/vendors", icon: Users },
  { name: "操作ログ", href: "/admin/logs", icon: History },
];

function SidebarContent({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-white">
      <div className="p-6">
        <h1 className="text-xl font-bold">在庫管理システム</h1>
        <p className="text-xs text-slate-400">管理画面</p>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navigation.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </Link>
        ))}
      </nav>
      {/* Added bottom padding to avoid overlap with indicators (e.g. Next.js dev tools) */}
      <div className="p-4 border-t border-slate-800 pb-20">
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
            {/* Hidden Title for Accessibility */}
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
