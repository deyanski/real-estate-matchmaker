import { NextResponse } from 'next/server';

import type { ApiFailureResponse, BrokerRecord } from '@/lib/contracts/webhooks';
import { getBrokerById } from '@/lib/server/supabase-rest';

export const dynamic = 'force-dynamic';

interface BrokerVerifyRequest {
  broker_id?: string;
}

interface BrokerVerifyResponse {
  ok: true;
  verified: boolean;
  broker?: BrokerRecord;
  source: 'supabase';
}

export async function POST(request: Request) {
  let payload: BrokerVerifyRequest;

  try {
    payload = (await request.json()) as BrokerVerifyRequest;
  } catch {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: 'verify-invalid-json',
        error: {
          code: 'INVALID_JSON',
          message: 'Broker verification requires JSON.',
          retryable: false
        }
      },
      { status: 400 }
    );
  }

  const brokerId = payload.broker_id?.trim();
  if (!brokerId) {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: 'verify-missing-broker-id',
        error: {
          code: 'MISSING_BROKER_ID',
          message: 'broker_id is required.',
          retryable: false
        }
      },
      { status: 400 }
    );
  }

  let broker: BrokerRecord | null;

  try {
    broker = await getBrokerById(brokerId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Broker verification is unavailable.';
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: 'verify-supabase-unavailable',
        error: {
          code: 'BROKER_LOOKUP_FAILED',
          message,
          retryable: true
        }
      },
      { status: 503 }
    );
  }

  return NextResponse.json<BrokerVerifyResponse>({
    ok: true,
    verified: broker !== null,
    broker: broker ?? undefined,
    source: 'supabase'
  });
}
