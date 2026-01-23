import { getTransactions } from "@/lib/actions";
import { TransactionList } from "@/components/admin/transaction-list";

export default async function TransactionsPage() {
    const transactions = await getTransactions(100); // Get last 100

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">取引履歴</h2>
                <p className="text-muted-foreground">過去の出庫取引の記録 (直近100件)</p>
            </div>

            <TransactionList transactions={transactions} />
        </div>
    );
}
