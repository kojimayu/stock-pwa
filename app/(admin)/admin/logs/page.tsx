import { getOperationLogs } from "@/lib/actions";
import OperationLogsClient from "./logs-client";

export default async function OperationLogsPage() {
    const logs = await getOperationLogs(500);

    // Date型をシリアライズ
    const serializedLogs = logs.map(log => ({
        ...log,
        performedAt: log.performedAt,
    }));

    return <OperationLogsClient logs={serializedLogs} />;
}
