import dotenv from 'dotenv';
dotenv.config();

const DC_DOMAINS = [
  { accounts: 'https://accounts.zoho.com', api: 'https://www.zohoapis.com', region: 'US' },
  { accounts: 'https://accounts.zoho.eu', api: 'https://www.zohoapis.eu', region: 'EU' },
  { accounts: 'https://accounts.zoho.in', api: 'https://www.zohoapis.in', region: 'IN' },
  { accounts: 'https://accounts.zoho.com.au', api: 'https://www.zohoapis.com.au', region: 'AU' },
  { accounts: 'https://accounts.zoho.ca', api: 'https://www.zohoapis.ca', region: 'CA' },
];

export async function exchangeGrantCode(
  clientId: string,
  clientSecret: string,
  grantCode: string,
  redirectUri = 'https://api-console.zoho.com'
) {
  console.log(`Exchanging code for client ID: ${clientId}...`);

  for (const dc of DC_DOMAINS) {
    try {
      const tokenUrl = `${dc.accounts}/oauth/v2/token`;
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: grantCode,
      });

      console.log(`Trying data center: ${dc.region} (${tokenUrl})...`);
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const data: any = await response.json();

      if (data.refresh_token) {
        console.log(`\n🎉 SUCCESS! Token generated on ${dc.region} data center.`);
        console.log(`Refresh Token: ${data.refresh_token}`);
        console.log(`API Domain: ${data.api_domain || dc.api}`);
        return {
          refreshToken: data.refresh_token,
          accessToken: data.access_token,
          accountsUrl: dc.accounts,
          apiDomain: data.api_domain || dc.api,
          region: dc.region,
        };
      }

      if (data.error && data.error !== 'invalid_code') {
        console.log(`Data center ${dc.region} returned: ${data.error_description || data.error}`);
      }
    } catch (e: any) {
      console.log(`Data center ${dc.region} network check failed: ${e.message}`);
    }
  }

  throw new Error('Failed to exchange code across Zoho data centers. Please verify the code is fresh.');
}

// Allow CLI execution: tsx scripts/exchange-token.ts <grantCode>
if (process.argv[2]) {
  const code = process.argv[2];
  const clientId = process.env.ZOHO_CLIENT_ID || '1000.L3R607A4GLK3D7PRYFQ9PRXM5AMOGN';
  const clientSecret = process.env.ZOHO_CLIENT_SECRET || '72b8cdfe4f79a05abaf28132df09bafaee42293b96';

  exchangeGrantCode(clientId, clientSecret, code)
    .then((res) => {
      console.log('\nConfig payload:', JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error(err.message);
    });
}
