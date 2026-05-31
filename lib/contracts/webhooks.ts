export type Role = 'broker' | 'client';
export type ListingType = 'for_sale' | 'for_rent';
export type PropertyType = 'apartment' | 'house' | 'studio' | 'office' | 'maisonette' | 'other';

export interface BrokerRecord {
  broker_id: string;
  display_name: string;
  active: boolean;
}

export interface PropertyRecord {
  id: string;
  title: string;
  property_type: PropertyType;
  listing_type: ListingType;
  location: string;
  price: number;
  description: string;
  image_url: string;
}

export interface AddListingImagePayload {
  filename: string;
  mime_type: string;
  public_url?: string | null;
  storage_path?: string | null;
  data_url?: string | null;
}

export interface AddListingRequest {
  meta: {
    schema_version: '1.0';
    request_id: string;
    sent_at: string;
    source: 'app';
  };
  role: 'broker';
  broker_id: string;
  property: {
    title: string;
    property_type: PropertyType;
    listing_type: ListingType;
    location: string;
    price: number;
    currency: 'EUR';
    description: string;
  };
  image: AddListingImagePayload;
  source_context: {
    submitted_by_user_id: string;
    submitted_by_role: Role;
    client_time_zone: string;
  };
}

export interface AddListingResponse {
  ok: true;
  request_id: string;
  listing: {
    id: string;
    title: string;
    property_type: PropertyType;
    listing_type: ListingType;
    location: string;
    price: number;
    description: string;
    image_url: string;
    vector_id?: string;
    status: 'created';
  };
  messages: string[];
  source: 'n8n';
}

export interface AddListingN8nItem {
  ok: true;
  request_id?: string;
  listing: {
    id: string;
    title: string;
    property_type: PropertyType;
    listing_type: ListingType;
    location: string;
    price: number | string;
    description: string;
    image_url: string;
    vector_id?: string;
    status: 'created';
  };
  messages?: string[];
  source?: 'n8n';
}

export type AddListingN8nResponse = AddListingN8nItem | AddListingN8nItem[];

export interface ErrorWebhookRequest {
  request_id: string;
  webhook: 'add_listing' | 'chat';
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: string;
  };
  timestamp: string;
  source: 'app';
}

export interface ErrorWebhookResponse {
  ok: true;
  source: 'n8n';
  received: true;
}

export interface ChatRequest {
  meta: {
    schema_version: '1.0';
    request_id: string;
    sent_at: string;
    source: 'app';
  };
  role: Role;
  user_id: string;
  conversation_id: string;
  message: string;
  context: {
    current_view: 'property_management' | 'buyer_search';
    selected_property_ids: string[];
    recent_property_ids: string[];
  };
}

export interface ChatMatchedProperty extends PropertyRecord {
  score: number;
}

export interface ChatResponse {
  ok: true;
  request_id: string;
  role: Role;
  message: string;
  response_type: 'answer' | 'search_results' | 'no_match' | 'refusal';
  matched_properties: ChatMatchedProperty[];
  source: 'n8n';
  summary?: string;
}

export interface ApiFailureResponse {
  ok: false;
  request_id: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export const propertyTypeOptions: readonly PropertyType[] = [
  'apartment',
  'house',
  'studio',
  'office',
  'maisonette',
  'other'
] as const;

export const listingTypeOptions: readonly ListingType[] = ['for_sale', 'for_rent'] as const;

export function isRole(value: unknown): value is Role {
  return value === 'broker' || value === 'client';
}

export function isListingType(value: unknown): value is ListingType {
  return value === 'for_sale' || value === 'for_rent';
}

export function isPropertyType(value: unknown): value is PropertyType {
  return propertyTypeOptions.includes(value as PropertyType);
}

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
