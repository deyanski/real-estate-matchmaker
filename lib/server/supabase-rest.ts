import 'server-only';

import type { BrokerRecord, PropertyRecord } from '@/lib/contracts/webhooks';

const PROPERTY_SELECT = 'id,title,property_type,listing_type,location,price,description,image_url';
const BROKER_SELECT = 'broker_id,display_name,active';

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server configuration is missing.');
  }

  return {
    url: url.replace(/\/$/, ''),
    serviceRoleKey
  };
}

async function supabaseRestFetch<T>(path: string): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Supabase REST request failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function getProperties(): Promise<PropertyRecord[]> {
  return supabaseRestFetch<PropertyRecord[]>(`_properties?select=${PROPERTY_SELECT}&order=created_at.desc`);
}

export async function getBrokerById(brokerId: string): Promise<BrokerRecord | null> {
  const encodedBrokerId = encodeURIComponent(brokerId);
  const brokers = await supabaseRestFetch<BrokerRecord[]>(
    `_brokers?select=${BROKER_SELECT}&broker_id=eq.${encodedBrokerId}&active=eq.true&limit=1`
  );

  return brokers[0] ?? null;
}
