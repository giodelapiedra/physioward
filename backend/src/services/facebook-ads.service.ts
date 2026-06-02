import axios, { AxiosError } from 'axios';
import { env } from '../config/env';
import { Errors } from '../shared/errors';

export interface FacebookAdsDaySpend {
  spend_date:    string; // YYYY-MM-DD
  campaign_name: string;
  amount:        number; // AUD (account currency)
}

function handleFacebookError(err: unknown): never {
  if (err instanceof AxiosError) {
    const fb = err.response?.data?.error;
    if (fb) {
      const msg = `Facebook Ads API error (code ${fb.code}): ${fb.message}`;
      // Token expired / invalid → treat as validation so frontend shows actionable message
      if (fb.code === 190 || fb.type === 'OAuthException') {
        throw Errors.validation(`Facebook access token expired or invalid — please refresh it. ${msg}`);
      }
      throw Errors.internal(msg);
    }
    throw Errors.internal(`Facebook Ads API request failed: ${err.message}`);
  }
  throw err;
}

export async function fetchFacebookAdsSpend(
  dateFrom: string,
  dateTo:   string
): Promise<FacebookAdsDaySpend[]> {
  if (!env.FACEBOOK_ADS_ACCESS_TOKEN || !env.FACEBOOK_ADS_ACCOUNT_ID) {
    throw Errors.validation('Facebook Ads credentials not configured — add FACEBOOK_ADS_* vars to .env');
  }

  const results: FacebookAdsDaySpend[] = [];
  let url: string | null =
    `https://graph.facebook.com/v19.0/act_${env.FACEBOOK_ADS_ACCOUNT_ID}/insights`;
  let isFirst = true;

  while (url) {
    const params: Record<string, string> = {
      fields:         'spend,campaign_name,date_start',
      time_range:     JSON.stringify({ since: dateFrom, until: dateTo }),
      time_increment: '1',
      level:          'campaign',
      access_token:   env.FACEBOOK_ADS_ACCESS_TOKEN!,
      limit:          '500',
    };

    let page: any;
    try {
      const resp = await axios.get<any>(url, isFirst ? { params } : {});
      page = resp.data;
    } catch (err) {
      handleFacebookError(err);
    }

    for (const row of (page.data ?? [])) {
      const amount = parseFloat(row.spend ?? '0');
      if (amount > 0) {
        results.push({
          spend_date:    row.date_start as string,
          campaign_name: (row.campaign_name as string) || 'Unknown campaign',
          amount,
        });
      }
    }

    url = page.paging?.next ?? null;
    isFirst = false;
  }

  return results;
}
