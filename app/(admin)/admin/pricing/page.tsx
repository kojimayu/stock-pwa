import { getCategoryPricingRules, getPricingReport } from "@/lib/actions";
import { PricingDashboard } from "@/components/admin/pricing-dashboard";

export default async function PricingPage() {
    const [rules, report] = await Promise.all([
        getCategoryPricingRules(),
        getPricingReport(),
    ]);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">価格設定</h2>
                <p className="text-muted-foreground">
                    カテゴリ別掛率の管理と価格レポート
                </p>
            </div>
            <PricingDashboard rules={rules} report={report} />
        </div>
    );
}
