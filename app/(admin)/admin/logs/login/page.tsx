
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOperationLogs } from "@/lib/actions";
import { format } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function LoginHistoryPage() {
    // Fetch only login/logout related logs
    const logs = await getOperationLogs(100, ['LOGIN', 'KIOSK_LOGIN_SUCCESS', 'LOGOUT', 'AUTO_LOGOUT', 'ADMIN_LOGIN']);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" asChild>
                    <Link href="/admin/logs">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">ログイン履歴</h2>
                    <p className="text-muted-foreground">直近100件のログイン・ログアウト操作</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>履歴一覧</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[180px]">日時</TableHead>
                                <TableHead className="w-[150px]">操作種別</TableHead>
                                <TableHead className="w-[200px]">対象</TableHead>
                                <TableHead>詳細</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-mono text-xs">
                                        {format(log.performedAt, "yyyy/MM/dd HH:mm:ss")}
                                    </TableCell>
                                    <TableCell>
                                        <BadgeAction action={log.action} />
                                    </TableCell>
                                    <TableCell className="text-sm font-medium">{log.target}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground break-all">
                                        {log.details || "-"}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {logs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                                        履歴はまだありません
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function BadgeAction({ action }: { action: string }) {
    let colorClass = "bg-gray-100 text-gray-800";
    let label = action;

    if (action === "LOGIN" || action === "KIOSK_LOGIN_SUCCESS") {
        colorClass = "bg-green-100 text-green-800";
        label = "Kioskログイン";
    }
    if (action === "ADMIN_LOGIN") {

        colorClass = "bg-blue-100 text-blue-800";
        label = "管理ログイン";
    }
    if (action === "LOGOUT") {
        colorClass = "bg-gray-100 text-gray-800";
        label = "ログアウト";
    }
    if (action === "AUTO_LOGOUT") {
        colorClass = "bg-orange-100 text-orange-800";
        label = "自動ログアウト";
    }

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            {label} ({action})
        </span>
    );
}
