import { NextResponse } from 'next/server';

import type { ApiFailureResponse, ChatRequest, ChatResponse } from '@/lib/contracts/webhooks';
import { isRole } from '@/lib/contracts/webhooks';
import { postJson } from '@/lib/server/webhook-client';

export const dynamic = 'force-dynamic';

function isChatRequest(value: unknown): value is ChatRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const meta = record.meta as Record<string, unknown> | undefined;
  return (
    typeof record.message === 'string' &&
    typeof record.user_id === 'string' &&
    isRole(record.role) &&
    typeof meta?.request_id === 'string' &&
    typeof record.conversation_id === 'string'
  );
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: 'chat-invalid-json',
        error: {
          code: 'INVALID_JSON',
          message: 'Chat requests must be JSON.',
          retryable: false
        }
      },
      { status: 400 }
    );
  }

  if (!isChatRequest(payload)) {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: 'chat-invalid-payload',
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'The chat payload is missing required fields.',
          retryable: false
        }
      },
      { status: 400 }
    );
  }

  const webhookUrl = process.env.N8N_CHAT_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: (payload as ChatRequest).meta.request_id,
        error: {
          code: 'WEBHOOK_NOT_CONFIGURED',
          message: 'N8N_CHAT_WEBHOOK_URL is not configured.',
          retryable: false
        }
      },
      { status: 503 }
    );
  }

  try {
    return NextResponse.json<ChatResponse>(await postJson<ChatResponse>(webhookUrl, payload));
  } catch {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: (payload as ChatRequest).meta.request_id,
        error: {
          code: 'WEBHOOK_REQUEST_FAILED',
          message: 'The chat webhook did not return a valid response.',
          retryable: true
        }
      },
      { status: 502 }
    );
  }
}
