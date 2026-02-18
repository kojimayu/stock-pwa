
import { getVendorAirconStock } from "@/lib/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, Box, Home, Wind } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function AirconStockPage() {
    const stockData = await getVendorAirconStock();

    // 全体集計
    const totalSummary = stockData.reduce((acc, curr) => ({
        set: acc.set + curr.summary.set,
        indoor: acc.indoor + curr.summary.indoor,
        outdoor: acc.outdoor + curr.summary.outdoor,
        total: acc.total + curr.summary.total,
    }), { set: 0, indoor: 0, outdoor: 0, total: 0 });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tight">業者別予備在庫ダッシュボード</h2>
            </div>

            {/* Total Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">総持出し台数</CardTitle>
                        <Box className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalSummary.total}台</div>
                        <p className="text-xs text-muted-foreground">未返却のエアコン総数</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">セット</CardTitle>
                        <Box className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalSummary.set}台</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">内機のみ</CardTitle>
                        <Home className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalSummary.indoor}台</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">外機のみ</CardTitle>
                        <Wind className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalSummary.outdoor}台</div>
                    </CardContent>
                </Card>
            </div>

            {/* Vendor List */}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {stockData.map((data) => (
                    <Card key={data.vendor.id} className="flex flex-col">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-lg">{data.vendor.name}</CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        保有数: <span className="font-bold text-foreground">{data.summary.total}</span> 台
                                    </p>
                                </div>
                                <div className="flex gap-1">
                                    {data.summary.set > 0 && <Badge variant="secondary" className="bg-blue-100 text-blue-700">セット:{data.summary.set}</Badge>}
                                    {data.summary.indoor > 0 && <Badge variant="secondary" className="bg-orange-100 text-orange-700">内:{data.summary.indoor}</Badge>}
                                    {data.summary.outdoor > 0 && <Badge variant="secondary" className="bg-green-100 text-green-700">外:{data.summary.outdoor}</Badge>}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="list">
                                    <AccordionTrigger className="text-sm py-2">
                                        保有リストを表示
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-3 pt-2">
                                            {data.items.map((item) => (
                                                <div key={item.id} className="text-sm border-l-2 border-slate-200 pl-3 py-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge variant="outline" className={`text-[10px] h-5 px-1 ${item.type === 'INDOOR' ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                                            item.type === 'OUTDOOR' ? 'bg-green-50 text-green-600 border-green-200' :
                                                                'bg-blue-50 text-blue-600 border-blue-200'
                                                            }`}>
                                                            {item.type === 'INDOOR' ? '内機' : item.type === 'OUTDOOR' ? '外機' : 'セット'}
                                                        </Badge>
                                                        <span className="font-mono font-bold">{item.modelNumber}</span>
                                                    </div>
                                                    <div className="text-slate-500 text-xs space-y-0.5">
                                                        <div className="flex gap-2">
                                                            <span>管理No: {item.managementNo}</span>
                                                            {item.airconProduct?.stock === 0 && (
                                                                <span className="text-red-500 font-bold">(在庫切れ)</span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            {format(new Date(item.createdAt), 'MM/dd HH:mm', { locale: ja })}
                                                            {item.vendorUser && ` / ${item.vendorUser.name}`}
                                                        </div>
                                                        <div className="text-slate-700 truncate">
                                                            {item.customerName || '顧客名なし'}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </CardContent>
                    </Card>
                ))}

                {stockData.length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-500">
                        現在持ち出し中のエアコンはありません
                    </div>
                )}
            </div>
        </div>
    );
}
