import { NextResponse } from 'next/server';

import type { ErrorWebhookRequest, ErrorWebhookResponse } from '@/lib/contracts/webhooks';
import { postJson } from '@/lib/server/webhook-client';

export const dynamic = 'force-dynamic';

function isErrorRequest(value: unknown): value is ErrorWebhookRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.request_id === 'string' &&
    typeof record.webhook === 'string' &&
    typeof record.error === 'object' &&
    record.error !== null
  );
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Error webhook expects JSON.',
          retryable: false
        }
      },
      { status: 400 }
    );
  }

  if (!isErrorRequest(payload)) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'The error payload is missing required fields.',
          retryable: false
        }
      },
      { status: 400 }
    );
  }

  const webhookUrl = process.env.N8N_ERROR_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'WEBHOOK_NOT_CONFIGURED',
          message: 'N8N_ERROR_WEBHOOK_URL is not configured.',
          retryable: false
        }
      },
      { status: 503 }
    );
  }

  try {
    return NextResponse.json<ErrorWebhookResponse>(await postJson<ErrorWebhookResponse>(webhookUrl, payload));
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'WEBHOOK_REQUEST_FAILED',
          message: 'The error webhook did not return a valid response.',
          retryable: true
        }
      },
      { status: 502 }
    );
  }
}
