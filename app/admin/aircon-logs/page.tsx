
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AirconLogsPage() {
    const logs = await prisma.airConditionerLog.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            vendor: true,
        },
        take: 200, // Limit for performance
    });

    return (
        <div className="space-y-6 p-8">
            <h1 className="text-2xl font-bold">エアコン持出し履歴</h1>

            <Card>
                <CardHeader>
                    <CardTitle>最新の持出しログ (最新200件)</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">日時</TableHead>
                                <TableHead>業者名</TableHead>
                                <TableHead>管理No</TableHead>
                                <TableHead>顧客名</TableHead>
                                <TableHead>元請/下請</TableHead>
                                <TableHead>品番</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                        ログがありません
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell>{formatDate(log.createdAt)}</TableCell>
                                        <TableCell className="font-medium">{log.vendor.name}</TableCell>
                                        <TableCell>{log.managementNo}</TableCell>
                                        <TableCell>{log.customerName || "-"}</TableCell>
                                        <TableCell>{log.contractor || "-"}</TableCell>
                                        <TableCell className="font-mono bg-slate-100 rounded px-1">{log.modelNumber}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
