import { NextResponse } from 'next/server';

import type { ApiFailureResponse, BrokerChatRequest, BrokerChatResponse } from '@/lib/contracts/webhooks';
import { postJson } from '@/lib/server/webhook-client';

export const dynamic = 'force-dynamic';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function unwrapFirst(value: unknown): unknown {
  let current: unknown = value;

  for (let depth = 0; depth < 5; depth += 1) {
    if (!Array.isArray(current)) {
      return current;
    }

    if (current.length === 0) {
      return undefined;
    }

    current = current[0];
  }

  return current;
}

function extractText(value: unknown): string | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  if (typeof value.message === 'string' && value.message.trim().length > 0) {
    return value.message;
  }

  if (typeof value.output === 'string' && value.output.trim().length > 0) {
    return value.output;
  }

  if (typeof value.text === 'string' && value.text.trim().length > 0) {
    return value.text;
  }

  if (isObject(value.output) && typeof value.output.text === 'string' && value.output.text.trim().length > 0) {
    return value.output.text;
  }

  if (!isObject(value.response)) {
    return undefined;
  }

  const candidate = unwrapFirst(value.response.generations);
  return isObject(candidate) && typeof candidate.text === 'string' && candidate.text.trim().length > 0
    ? candidate.text
    : undefined;
}

function isBrokerChatRequest(value: unknown): value is BrokerChatRequest {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.request_id === 'string' &&
    typeof value.broker_id === 'string' &&
    typeof value.conversation_id === 'string' &&
    typeof value.chatInput === 'string'
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
        request_id: 'broker-chat-invalid-json',
        error: {
          code: 'INVALID_JSON',
          message: 'Broker chat requests must be JSON.',
          retryable: false
        }
      },
      { status: 400 }
    );
  }

  if (!isBrokerChatRequest(payload)) {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: 'broker-chat-invalid-payload',
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'The broker chat payload is missing required fields.',
          retryable: false
        }
      },
      { status: 400 }
    );
  }

  const webhookUrl = process.env.N8N_BROKER_CHAT_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: payload.request_id,
        error: {
          code: 'WEBHOOK_NOT_CONFIGURED',
          message: 'N8N_BROKER_CHAT_WEBHOOK_URL is not configured.',
          retryable: false
        }
      },
      { status: 503 }
    );
  }

  try {
    const upstream = await postJson<unknown>(webhookUrl, payload);
    const first = unwrapFirst(upstream);
    const message = extractText(first) ?? 'The broker assistant returned no response.';

    return NextResponse.json<BrokerChatResponse>({
      ok: true,
      request_id: payload.request_id,
      role: 'broker',
      message,
      source: 'n8n'
    });
  } catch (error) {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: payload.request_id,
        error: {
          code: 'WEBHOOK_REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'The broker chat webhook did not return a valid response.',
          retryable: true
        }
      },
      { status: 502 }
    );
  }
}
