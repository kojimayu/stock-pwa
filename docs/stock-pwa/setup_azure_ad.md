
# Azure AD (Entra ID) Setup Guide for STOCK-PWA

管理画面のログイン認証にMicrosoft 365アカウントを使用するため、Azure Portalでの設定が必要です。
以下の手順に従って「アプリケーション登録」を行い、必要な情報（Client ID, Tenant ID, Client Secret）を取得してください。

## 1. アプリの登録 (App Registration)

1.  [Azure Portal](https://portal.azure.com/) にアクセスし、ログインします。
2.  検索バーで「**Microsoft Entra ID**」 (旧 Azure Active Directory) を検索して開きます。
3.  左メニューから「**アプリの登録 (App registrations)**」を選択します。
4.  「**新規登録 (New registration)**」をクリックします。
5.  以下の通りに入力します：
    *   **名前**: `STOCK-PWA-Auth` (任意の識別しやすい名前)
    *   **サポートされているアカウントの種類**:
        *   通常は「**この組織ディレクトリのみに含まれるアカウント (シングルテナント)**」を選択します (社内利用のみの場合)。
    *   **リダイレクト URI (Redirect URI)**:
        *   プラットフォーム: **Web**
        *   URI: `http://localhost:3000/api/auth/callback/azure-ad`
        *   *(後で本番環境用URLも追加します)*
6.  「**登録 (Register)**」をクリックします。

## 2. 認証情報の取得

登録完了後の「概要 (Overview)」ページから、以下の情報をメモしてください。後で環境変数 (`.env`) に設定します。

*   **アプリケーション (クライアント) ID** (`AZURE_AD_CLIENT_ID`)
*   **ディレクトリ (テナント) ID** (`AZURE_AD_TENANT_ID`)

## 3. クライアントシークレットの作成

1.  左メニューの「**証明書とシークレット (Certificates & secrets)**」を選択します。
2.  「**クライアント シークレット (Client secrets)**」タブで、「**新しいクライアント シークレット (New client secret)**」をクリックします。
3.  **説明**: `NextAuth Secret` など
4.  **有効期限**: 任意の期間 (例: fix 12 months, or recommend 6 months)
5.  「**追加 (Add)**」をクリックします。
6.  **重要**: 生成された **「値 (Value)」** をすぐにコピーしてください。
    *   ※この画面を離れると二度と表示されません。これが `AZURE_AD_CLIENT_SECRET` になります。

## 4. APIのアクセス許可 (Optional)

通常、ログインのみであればデフォルトの `User.Read` (自分のプロファイル読み取り) が付与されているはずです。追加の設定は不要です。

---

## 5. 環境変数の設定

取得した情報を `.env` ファイルに追記します（私がサポートします）。

```env
AZURE_AD_CLIENT_ID="<取得したアプリケーションID>"
AZURE_AD_CLIENT_SECRET="<取得したシークレットの値>"
AZURE_AD_TENANT_ID="<取得したテナントID>"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<ランダムな文字列>"
```
