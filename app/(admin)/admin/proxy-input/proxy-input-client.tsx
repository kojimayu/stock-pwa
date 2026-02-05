"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UserCheck, ArrowRight, ShoppingCart, AlertCircle, ArrowLeft } from "lucide-react";
import { ProxyShopContent } from "./proxy-shop-content";

interface Vendor {
    id: number;
    name: string;
    accessCompanyName?: string | null;
}

interface Product {
    id: number;
    code?: string;
    name: string;
    category: string;
    subCategory?: string | null;
    productType?: string | null;
    priceA: number;
    priceB: number;
    stock: number;
    minStock: number;
    createdAt: string;
    updatedAt: string;
}

interface ProxyInputClientProps {
    products: Product[];
    vendors: Vendor[];
}

export function ProxyInputClient({ products, vendors }: ProxyInputClientProps) {
    const [selectedVendorId, setSelectedVendorId] = useState<string>("");
    const [isShopMode, setIsShopMode] = useState(false);

    const selectedVendor = vendors.find(v => v.id === Number(selectedVendorId));

    const handleStartProxy = () => {
        if (selectedVendor) {
            setIsShopMode(true);
        }
    };

    const handleExitProxy = () => {
        setIsShopMode(false);
        setSelectedVendorId("");
    };

    if (isShopMode && selectedVendor) {
        return (
            <div className="-m-4 md:-m-8 flex flex-col" style={{ height: "100vh" }}>
                {/* 代理入力バナー */}
                <div className="bg-amber-500 text-white p-2 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        <span className="font-medium">代理入力モード: {selectedVendor.name}</span>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleExitProxy}
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        終了
                    </Button>
                </div>
                {/* 埋め込みショップコンテンツ */}
                <div className="flex-1 overflow-hidden">
                    <ProxyShopContent
                        products={products}
                        vendor={selectedVendor}
                    />
                </div>
            </div>
        );
    }

    // 業者選択画面
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">代理入力</h2>
                <p className="text-muted-foreground">業者に代わって材料の持出しを記録します</p>
            </div>
            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5" />
                        業者を選択
                    </CardTitle>
                    <CardDescription>
                        代理で持出し入力を行う業者を選択してください
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="業者を選択..." />
                        </SelectTrigger>
                        <SelectContent>
                            {vendors.map((vendor) => (
                                <SelectItem key={vendor.id} value={String(vendor.id)}>
                                    <div className="flex items-center gap-2">
                                        <span>{vendor.name}</span>
                                        {vendor.accessCompanyName && (
                                            <span className="text-xs text-muted-foreground">
                                                ({vendor.accessCompanyName})
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {selectedVendor && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                    <p className="font-medium text-blue-900">
                                        {selectedVendor.name} として入力します
                                    </p>
                                    <p className="text-sm text-blue-700 mt-1">
                                        この操作は「代理入力」として記録され、管理者の操作ログに残ります。
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={handleStartProxy}
                        disabled={!selectedVendor}
                        className="w-full"
                        size="lg"
                    >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        代理入力を開始
                        <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
