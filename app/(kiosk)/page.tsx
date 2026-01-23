import LoginForm from '@/components/kiosk/login-form';
import { getVendors } from '@/lib/actions';

export default async function KioskLoginPage() {
  const vendors = await getVendors();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-2">在庫管理システム</h1>
        <p className="text-xl text-gray-500">持ち出し処理端末</p>
      </div>
      <LoginForm vendors={vendors} />
    </main>
  );
}
