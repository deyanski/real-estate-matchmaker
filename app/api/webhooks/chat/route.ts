import { NextResponse } from 'next/server';

import type { ApiFailureResponse, ChatRequest, ChatResponse } from '@/lib/contracts/webhooks';
import { isRole } from '@/lib/contracts/webhooks';
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

function extractGenerationsText(value: unknown): string | undefined {
  if (!isObject(value)) {
    return undefined;
  }

  const directGenerations = value.generations;
  const directCandidate = unwrapFirst(directGenerations);

  if (isObject(directCandidate) && typeof directCandidate.text === 'string') {
    return directCandidate.text;
  }

  const nestedResponse = value.response;
  if (!isObject(nestedResponse)) {
    return undefined;
  }

  const responseGenerations = nestedResponse.generations;
  const candidate = unwrapFirst(responseGenerations);

  if (!isObject(candidate)) {
    return undefined;
  }

  return typeof candidate.text === 'string' ? candidate.text : undefined;
}

function normalizeChatResponse(raw: unknown, fallbackRequestId: string, fallbackRole: ChatRequest['role']): ChatResponse {
  const first = unwrapFirst(raw);

  if (!first) {
    return {
      ok: true,
      request_id: fallbackRequestId,
      role: fallbackRole,
      message: 'No matching result was returned by the assistant.',
      response_type: 'no_match',
      matched_properties: [],
      source: 'n8n'
    };
  }

  if (!isObject(first)) {
    throw new Error('Unexpected chat webhook response shape.');
  }

  // Handle n8n shape: { output: { match: bool, matched_properties: [...], matched_properties_id: [...] } }
  const outputObject = isObject(first.output) ? first.output : undefined;
  const outputMatchedProperties = outputObject && Array.isArray(outputObject.matched_properties)
    ? outputObject.matched_properties
    : undefined;

  const messageCandidate =
    typeof first.message === 'string' ? first.message :
    typeof first.text === 'string' ? first.text :
    outputObject
      ? outputObject.match === true && outputMatchedProperties && outputMatchedProperties.length > 0
        ? `Found ${outputMatchedProperties.length} matching propert${outputMatchedProperties.length === 1 ? 'y' : 'ies'}.`
        : 'No matching properties were found for your query.'
      : typeof first.response === 'string' ? first.response :
      undefined;

  const generationsText = extractGenerationsText(first);
  const responseTypeCandidate = outputObject
    ? outputObject.match === true && outputMatchedProperties && outputMatchedProperties.length > 0
      ? 'search_results'
      : 'no_match'
    : first.response_type;
  const requestIdCandidate = first.request_id;
  const matchedPropertiesCandidate = outputMatchedProperties ?? first.matched_properties;
  const roleCandidate = first.role;

  const normalizedMessage =
    typeof messageCandidate === 'string' && messageCandidate.trim().length > 0
      ? messageCandidate
      : typeof generationsText === 'string' && generationsText.trim().length > 0
      ? generationsText
      : 'No matching result was returned by the assistant.';

  return {
    ok: true,
    request_id: typeof requestIdCandidate === 'string' ? requestIdCandidate : fallbackRequestId,
    role: isRole(roleCandidate) ? roleCandidate : fallbackRole,
    message: normalizedMessage,
    response_type:
      responseTypeCandidate === 'answer' ||
      responseTypeCandidate === 'search_results' ||
      responseTypeCandidate === 'no_match' ||
      responseTypeCandidate === 'refusal'
        ? responseTypeCandidate
        : normalizedMessage === 'No matching result was returned by the assistant.'
        ? 'no_match'
        : 'answer',
    matched_properties: Array.isArray(matchedPropertiesCandidate) ? (matchedPropertiesCandidate as ChatResponse['matched_properties']) : [],
    source: 'n8n',
    summary: typeof first.summary === 'string' ? first.summary : undefined
  };
}

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
    const typedPayload = payload as ChatRequest;
    const { message, ...rest } = typedPayload;
    const n8nPayload = {
      ...rest,
      chatInput: message
    };

    const upstreamResponse = await postJson<unknown>(webhookUrl, n8nPayload);

    return NextResponse.json<ChatResponse>(normalizeChatResponse(upstreamResponse, typedPayload.meta.request_id, typedPayload.role));
  } catch (error) {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: (payload as ChatRequest).meta.request_id,
        error: {
          code: 'WEBHOOK_REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'The chat webhook did not return a valid response.',
          retryable: true
        }
      },
      { status: 502 }
    );
  }
}
