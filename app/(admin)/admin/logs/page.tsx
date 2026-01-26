import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOperationLogs } from "@/lib/actions";
import { format } from "date-fns";

export default async function OperationLogsPage() {
    const logs = await getOperationLogs(100);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">操作ログ</h2>
                <p className="text-muted-foreground">システム上の重要な操作履歴（直近100件）</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>ログ一覧</CardTitle>
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
                                        ログはまだありません
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
    if (action.includes("CREATE")) colorClass = "bg-blue-100 text-blue-800";
    if (action.includes("UPDATE")) colorClass = "bg-yellow-100 text-yellow-800";
    if (action.includes("DELETE")) colorClass = "bg-red-100 text-red-800";
    if (action === "IMPORT") colorClass = "bg-purple-100 text-purple-800";

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            {action}
        </span>
    );
}
