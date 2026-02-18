
export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  isBox?: boolean;
  quantityPerBox?: number;
}

// メール用の数量表示フォーマット
function formatEmailQuantity(item: CartItem): string {
  if (item.isBox) {
    if (item.unit === 'm') {
      return `${item.quantity}巻`;
    }
    return `${item.quantity}箱`;
  }
  return `${item.quantity}${item.unit || '個'}`;
}

// Helper to get Access Token from Azure AD
async function getAccessToken(): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Azure AD credentials (TENANT_ID, CLIENT_ID, CLIENT_SECRET) are missing.");
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'client_credentials');

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to retrieve access token: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function sendTransactionEmail(
  toEmail: string,
  vendorName: string,
  items: CartItem[],
  totalAmount: number
) {
  const fromAddress = process.env.SMTP_FROM_ADDRESS;

  if (!fromAddress) {
    console.warn('SMTP_FROM_ADDRESS is not set. Skipping email via Graph API.');
    return;
  }

  try {
    console.log("Preparing to send email via Microsoft Graph API...");
    const accessToken = await getAccessToken();

    const itemListHtml = items
      .map(
        (item) =>
          `<tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.price}円</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${formatEmailQuantity(item)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">${item.price * item.quantity}円</td>
            </tr>`
      )
      .join('');

    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>お疲れ様です、${vendorName} 様</h2>
            <p>以下の内容で精算が完了しました。</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
                <tr style="background-color: #f2f2f2;">
                <th style="padding: 8px; text-align: left;">商品名</th>
                <th style="padding: 8px; text-align: right;">単価</th>
                <th style="padding: 8px; text-align: right;">数量</th>
                <th style="padding: 8px; text-align: right;">小計</th>
                </tr>
            </thead>
            <tbody>
                ${itemListHtml}
            </tbody>
            <tfoot>
                <tr>
                <td colspan="3" style="padding: 12px; text-align: right; font-weight: bold;">合計</td>
                <td style="padding: 12px; text-align: right; font-weight: bold; font-size: 1.2em;">${totalAmount}円</td>
                </tr>
            </tfoot>
            </table>

            <p style="margin-top: 30px; font-size: 0.9em; color: #666;">
            ※このメールは自動送信されています。<br>
            ※本システムに関するお問い合わせは管理者までお願いします。
            </p>
        </div>
        `;

    const emailMessage = {
      message: {
        subject: `【精算完了】${vendorName}様 - 取引明細`,
        body: {
          contentType: "HTML",
          content: htmlContent,
        },
        toRecipients: [
          {
            emailAddress: {
              address: toEmail,
            },
          },
        ],
        // Optional: set sender name if needed, though 'from' handled by endpoint usually
      },
      saveToSentItems: false, // Optional: don't clutter the shared mailbox sent items
    };

    const sendMailEndpoint = `https://graph.microsoft.com/v1.0/users/${fromAddress}/sendMail`;

    const response = await fetch(sendMailEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailMessage),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Graph API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    console.log(`Email successfully sent to ${toEmail} via Graph API`);
    return { success: true };

  } catch (error) {
    console.error('Error sending email via Graph API:', error);
    // Don't rethrow if you want to avoid breaking the transaction flow, 
    // but here we let the caller know it failed if they care.
    // For the current bg usage, console error is critical.
    throw error;
  }
}
