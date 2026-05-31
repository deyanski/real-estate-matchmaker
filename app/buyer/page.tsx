import Dashboard from '@/components/dashboard';
import { getProperties } from '@/lib/server/supabase-rest';

export const dynamic = 'force-dynamic';

export default async function BuyerPage() {
  try {
    const properties = await getProperties();

    return <Dashboard initialProperties={properties} mode="buyer" />;
  } catch {
    return <Dashboard initialProperties={[]} initialError="Buyer listings could not be loaded from Supabase. Check your server env and table access." mode="buyer" />;
  }
}
