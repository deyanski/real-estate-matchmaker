import Dashboard from '@/components/dashboard';
import { getProperties } from '@/lib/server/supabase-rest';

export const dynamic = 'force-dynamic';

export default async function BrokerPage() {
  try {
    const properties = await getProperties();

    return <Dashboard initialProperties={properties} mode="broker" />;
  } catch {
    return <Dashboard initialProperties={[]} initialError="Broker data could not be loaded from Supabase. Check your server env and table access." mode="broker" />;
  }
}
