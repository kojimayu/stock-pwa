"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Printer } from "lucide-react";

export default function StatementsPage() {
    const router = useRouter();
    const now = new Date();
    // デフォルトは先月
    const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();

    const [year, setYear] = useState(String(defaultYear));
    const [month, setMonth] = useState(String(defaultMonth));

    const handlePreview = () => {
        router.push(`/admin/reports/statements/print?year=${year}&month=${month}`);
    };

    // 年の選択肢（今年と過去2年）
    const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">月次明細書</h2>
                <p className="text-muted-foreground">業者ごとの月次取引明細を一括出力</p>
            </div>

            <Card className="max-w-lg">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        対象期間の選択
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">年</label>
                            <Select value={year} onValueChange={setYear}>
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {years.map((y) => (
                                        <SelectItem key={y} value={String(y)}>
                                            {y}年
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">月</label>
                            <Select value={month} onValueChange={setMonth}>
                                <SelectTrigger className="w-24">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {months.map((m) => (
                                        <SelectItem key={m} value={String(m)}>
                                            {m}月
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handlePreview} className="gap-2">
                            <Printer className="w-4 h-4" />
                            明細を表示
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground mt-4">
                        表示後、ブラウザの「印刷」(Ctrl+P) からPDF保存できます。
                        <br />
                        材料明細とエアコン明細は別ページで出力されます。
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
