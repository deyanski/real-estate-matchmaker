import { NextResponse } from 'next/server';

import type { AddListingN8nItem, AddListingN8nResponse, AddListingRequest, AddListingResponse, ApiFailureResponse } from '@/lib/contracts/webhooks';
import { listingTypeOptions, propertyTypeOptions } from '@/lib/contracts/webhooks';
import { postFormData, postJson } from '@/lib/server/webhook-client';

export const dynamic = 'force-dynamic';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isN8nListingItem(value: unknown): value is AddListingN8nItem {
  if (!isObject(value)) {
    return false;
  }

  const listing = value.listing;
  if (!isObject(listing)) {
    return false;
  }

  return (
    value.ok === true &&
    typeof listing.id === 'string' &&
    typeof listing.title === 'string' &&
    propertyTypeOptions.includes(listing.property_type as (typeof propertyTypeOptions)[number]) &&
    listingTypeOptions.includes(listing.listing_type as (typeof listingTypeOptions)[number]) &&
    typeof listing.location === 'string' &&
    (typeof listing.price === 'number' || typeof listing.price === 'string') &&
    typeof listing.description === 'string' &&
    typeof listing.image_url === 'string' &&
    listing.status === 'created'
  );
}

function parseListingPrice(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error('Invalid listing price in webhook response.');
  }

  return parsed;
}

function normalizeAddListingResponse(raw: AddListingN8nResponse, fallbackRequestId: string): AddListingResponse {
  const firstItem = Array.isArray(raw) ? raw[0] : raw;

  if (!isN8nListingItem(firstItem)) {
    throw new Error('The add-listing webhook returned an unexpected response shape.');
  }

  const listing = firstItem.listing;

  return {
    ok: true,
    request_id: typeof firstItem.request_id === 'string' ? firstItem.request_id : fallbackRequestId,
    listing: {
      id: listing.id,
      title: listing.title,
      property_type: listing.property_type,
      listing_type: listing.listing_type,
      location: listing.location,
      price: parseListingPrice(listing.price),
      description: listing.description,
      image_url: listing.image_url,
      vector_id: listing.vector_id,
      status: 'created'
    },
    messages: Array.isArray(firstItem.messages) ? firstItem.messages : ['Listing created successfully.'],
    source: 'n8n'
  };
}

function buildAddListingFormData(payload: AddListingRequest, imageFile: File | null): FormData {
  const formData = new FormData();

  formData.append('meta.schema_version', payload.meta.schema_version);
  formData.append('meta.request_id', payload.meta.request_id);
  formData.append('meta.sent_at', payload.meta.sent_at);
  formData.append('meta.source', payload.meta.source);
  formData.append('role', payload.role);
  formData.append('broker_id', payload.broker_id);
  formData.append('property.title', payload.property.title);
  formData.append('property.property_type', payload.property.property_type);
  formData.append('property.listing_type', payload.property.listing_type);
  formData.append('property.location', payload.property.location);
  formData.append('property.price', String(payload.property.price));
  formData.append('property.currency', payload.property.currency);
  formData.append('property.description', payload.property.description);
  formData.append('image.filename', payload.image.filename);
  formData.append('image.mime_type', payload.image.mime_type);
  formData.append('source_context.submitted_by_user_id', payload.source_context.submitted_by_user_id);
  formData.append('source_context.submitted_by_role', payload.source_context.submitted_by_role);
  formData.append('source_context.client_time_zone', payload.source_context.client_time_zone);

  if (imageFile) {
    formData.append('image', imageFile, imageFile.name);
  }

  return formData;
}

function readRequiredString(formData: FormData, key: string): string {
  const value = formData.get(key);

  if (typeof value !== 'string') {
    throw new Error(`MISSING_FIELD:${key}`);
  }

  return value;
}

function parseAddListingMultipartForm(formData: FormData): { payload: AddListingRequest; imageFile: File | null } {
  const payloadField = formData.get('payload');
  if (typeof payloadField === 'string') {
    const parsedPayload = JSON.parse(payloadField) as unknown;
    if (!isValidListing(parsedPayload)) {
      throw new Error('INVALID_PAYLOAD');
    }

    return {
      payload: parsedPayload,
      imageFile: formData.get('image') instanceof File ? (formData.get('image') as File) : null
    };
  }

  const priceValue = Number(readRequiredString(formData, 'property.price'));

  const payload: AddListingRequest = {
    meta: {
      schema_version: readRequiredString(formData, 'meta.schema_version') as '1.0',
      request_id: readRequiredString(formData, 'meta.request_id'),
      sent_at: readRequiredString(formData, 'meta.sent_at'),
      source: readRequiredString(formData, 'meta.source') as 'app'
    },
    role: readRequiredString(formData, 'role') as 'broker',
    broker_id: readRequiredString(formData, 'broker_id'),
    property: {
      title: readRequiredString(formData, 'property.title'),
      property_type: readRequiredString(formData, 'property.property_type') as AddListingRequest['property']['property_type'],
      listing_type: readRequiredString(formData, 'property.listing_type') as AddListingRequest['property']['listing_type'],
      location: readRequiredString(formData, 'property.location'),
      price: priceValue,
      currency: readRequiredString(formData, 'property.currency') as 'EUR',
      description: readRequiredString(formData, 'property.description')
    },
    image: {
      filename: readRequiredString(formData, 'image.filename'),
      mime_type: readRequiredString(formData, 'image.mime_type')
    },
    source_context: {
      submitted_by_user_id: readRequiredString(formData, 'source_context.submitted_by_user_id'),
      submitted_by_role: readRequiredString(formData, 'source_context.submitted_by_role') as AddListingRequest['source_context']['submitted_by_role'],
      client_time_zone: readRequiredString(formData, 'source_context.client_time_zone')
    }
  };

  if (!Number.isFinite(priceValue) || !isValidListing(payload)) {
    throw new Error('INVALID_PAYLOAD');
  }

  const imageValue = formData.get('image');

  return {
    payload,
    imageFile: imageValue instanceof File ? imageValue : null
  };
}

async function parseAddListingRequest(request: Request): Promise<{ payload: AddListingRequest; imageFile: File | null }> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    return parseAddListingMultipartForm(formData);
  }

  const parsedPayload = (await request.json()) as unknown;
  if (!isValidListing(parsedPayload)) {
    throw new Error('INVALID_PAYLOAD');
  }

  return {
    payload: parsedPayload,
    imageFile: null
  };
}

function isValidListing(value: unknown): value is AddListingRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const property = record.property as Record<string, unknown> | undefined;
  const image = record.image as Record<string, unknown> | undefined;
  const meta = record.meta as Record<string, unknown> | undefined;

  return (
    record.role === 'broker' &&
    typeof record.broker_id === 'string' &&
    typeof property?.title === 'string' &&
    typeof property?.location === 'string' &&
    typeof property?.price === 'number' &&
    typeof property?.description === 'string' &&
    typeof property?.currency === 'string' &&
    propertyTypeOptions.includes(property?.property_type as (typeof propertyTypeOptions)[number]) &&
    listingTypeOptions.includes(property?.listing_type as (typeof listingTypeOptions)[number]) &&
    typeof image?.filename === 'string' &&
    typeof image?.mime_type === 'string' &&
    typeof meta?.request_id === 'string'
  );
}

export async function POST(request: Request) {
  let payload: AddListingRequest;
  let imageFile: File | null;

  try {
    ({ payload, imageFile } = await parseAddListingRequest(request));
  } catch {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: 'listing-invalid-json',
        error: {
          code: 'INVALID_JSON',
          message: 'Add listing expects JSON.',
          retryable: false
        }
      },
      { status: 400 }
    );
  }

  const webhookUrl = process.env.N8N_ADD_LISTING_WEBHOOK_URL;
  const bearerToken = process.env.N8N_ADD_LISTING_BEARER_TOKEN;

  if (!webhookUrl) {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: payload.meta.request_id,
        error: {
          code: 'WEBHOOK_NOT_CONFIGURED',
          message: 'N8N_ADD_LISTING_WEBHOOK_URL is not configured.',
          retryable: false
        }
      },
      { status: 503 }
    );
  }

  try {
    if (imageFile) {
      const upstreamResponse = await postFormData<AddListingN8nResponse>(
        webhookUrl,
        buildAddListingFormData(payload, imageFile),
        bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}
      );

      return NextResponse.json<AddListingResponse>(
        normalizeAddListingResponse(upstreamResponse, payload.meta.request_id)
      );
    }

    const upstreamResponse = await postJson<AddListingN8nResponse>(webhookUrl, payload, bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {});

    return NextResponse.json<AddListingResponse>(normalizeAddListingResponse(upstreamResponse, payload.meta.request_id));
  } catch (error) {
    return NextResponse.json<ApiFailureResponse>(
      {
        ok: false,
        request_id: payload.meta.request_id,
        error: {
          code: 'WEBHOOK_REQUEST_FAILED',
          message: error instanceof Error ? error.message : 'The add-listing webhook did not return a valid response.',
          retryable: true
        }
      },
      { status: 502 }
    );
  }
}
