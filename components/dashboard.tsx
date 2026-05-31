'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import type {
  AddListingRequest,
  AddListingResponse,
  ApiFailureResponse,
  ChatMatchedProperty,
  ChatRequest,
  ChatResponse,
  ErrorWebhookRequest,
  ListingType,
  PropertyRecord,
  PropertyType,
  Role
} from '@/lib/contracts/webhooks';
import { formatEUR } from '@/lib/format';
import { normalizeText, propertyTypeOptions, listingTypeOptions } from '@/lib/contracts/webhooks';

interface DashboardProps {
  initialProperties: PropertyRecord[];
  mode?: 'all' | 'broker' | 'buyer';
  initialError?: string | null;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  badge?: string;
  matchedProperties?: ChatMatchedProperty[];
}

interface ListingDraft {
  title: string;
  property_type: PropertyType;
  listing_type: ListingType;
  location: string;
  price: string;
  description: string;
}

const initialListingDraft: ListingDraft = {
  title: '',
  property_type: 'apartment',
  listing_type: 'for_sale',
  location: '',
  price: '',
  description: ''
};

const MAX_UPLOAD_IMAGE_BYTES = 750 * 1024;
const MAX_UPLOAD_IMAGE_DIMENSION = 1600;

function formatTime(time: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(time));
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function appendListingPayload(formData: FormData, payload: AddListingRequest): void {
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
}

function replaceFileExtension(filename: string, extension: string): string {
  const trimmedName = filename.trim();
  const lastDotIndex = trimmedName.lastIndexOf('.');

  if (lastDotIndex <= 0) {
    return `${trimmedName || 'listing-image'}.${extension}`;
  }

  return `${trimmedName.slice(0, lastDotIndex)}.${extension}`;
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new window.Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToJpegFile(canvas: HTMLCanvasElement, filename: string, quality: number): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), 'image/jpeg', quality);
  });

  if (!blob) {
    throw new Error('Could not process the listing image.');
  }

  return new File([blob], replaceFileExtension(filename, 'jpg'), {
    type: 'image/jpeg'
  });
}

async function optimizeListingImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a valid image file.');
  }

  const image = await loadImageElement(file);
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  const initialScale = Math.min(1, MAX_UPLOAD_IMAGE_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * initialScale));
  height = Math.max(1, Math.round(height * initialScale));

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Image optimization is unavailable in this browser.');
  }

  let quality = 0.82;
  let optimizedFile: File | null = null;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    optimizedFile = await canvasToJpegFile(canvas, file.name, quality);
    if (optimizedFile.size <= MAX_UPLOAD_IMAGE_BYTES) {
      return optimizedFile;
    }

    width = Math.max(1, Math.round(width * 0.85));
    height = Math.max(1, Math.round(height * 0.85));
    quality = Math.max(0.5, quality - 0.08);
  }

  if (!optimizedFile) {
    throw new Error('Could not process the listing image.');
  }

  if (optimizedFile.size > MAX_UPLOAD_IMAGE_BYTES) {
    throw new Error('The image is still too large after compression. Use a smaller photo.');
  }

  return optimizedFile;
}

function PropertyCard({ property }: { property: PropertyRecord }) {
  return (
    <article className="property-card">
      <div className="property-image">
        <Image src={property.image_url} alt={property.title} fill unoptimized sizes="(max-width: 720px) 100vw, 33vw" style={{ objectFit: 'cover' }} />
      </div>
      <div className="property-body">
        <div className="property-title-row">
          <div>
            <h3 className="property-title">{property.title}</h3>
            <p className="property-meta">{property.location}</p>
          </div>
          <div className="price">{formatEUR(property.price)}</div>
        </div>
        <div className="meta-row">
          <span className="pill is-accent">{property.property_type}</span>
          <span className="pill is-positive">{property.listing_type}</span>
          <span className="pill">{property.id}</span>
        </div>
        <p className="property-meta">{property.description}</p>
      </div>
    </article>
  );
}

function ChatBubble({ message }: { message: MessageItem }) {
  return (
    <article className={`chat-message ${message.role === 'user' ? 'is-user' : 'is-assistant'}`}>
      <div className="chat-meta">
        <span>{message.role === 'user' ? 'You' : message.badge ?? 'Advisor'}</span>
        <span>{formatTime(message.time)}</span>
      </div>
      <p className="chat-text">{message.text}</p>
      {message.matchedProperties && message.matchedProperties.length > 0 ? (
        <div className="result-list">
          {message.matchedProperties.map((property) => (
            <div className="message-card" key={`${message.id}-${property.id}`}>
              <div className="property-title-row">
                <strong>{property.title}</strong>
                <span className="result-score">score {property.score.toFixed(1)}</span>
              </div>
              <p className="property-meta">
                {property.location} · {property.property_type} · {property.listing_type} · {formatEUR(property.price)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

async function reportWebhookError(payload: ErrorWebhookRequest): Promise<void> {
  try {
    await fetch('/api/webhooks/error', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch {
    // Intentionally ignored in the UI fallback path.
  }
}

export default function Dashboard({ initialProperties, mode = 'all', initialError = null }: DashboardProps) {
  const [properties, setProperties] = useState<PropertyRecord[]>(initialProperties);
  const [brokerId, setBrokerId] = useState('BRK-001');
  const [sessionId] = useState(() => crypto.randomUUID());
  const [listingDraft, setListingDraft] = useState<ListingDraft>(initialListingDraft);
  const [listingFile, setListingFile] = useState<File | null>(null);
  const [listingPreview, setListingPreview] = useState<string>('');
  const [listingStatus, setListingStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [listingMessage, setListingMessage] = useState('');
  const [brokerQuery, setBrokerQuery] = useState('How many inquiries did we get this week?');
  const [buyerQuery, setBuyerQuery] = useState('Recommend something quiet and close to a metro under 100,000 EUR.');
  const [brokerMessages, setBrokerMessages] = useState<MessageItem[]>([]);
  const [buyerMessages, setBuyerMessages] = useState<MessageItem[]>([
    {
      id: createId('message'),
      role: 'assistant',
      badge: 'Buyer Assistant',
      text: 'Ask in plain language. The search box will rank properties by meaning and features.',
      time: new Date().toISOString()
    }
  ]);
  const [brokerBusy, setBrokerBusy] = useState(false);
  const [buyerBusy, setBuyerBusy] = useState(false);

  const brokerIdentifier = normalizeText(brokerId);
  const showBroker = mode !== 'buyer';
  const showBuyer = mode !== 'broker';
  const activeUserId = brokerIdentifier || sessionId;
  const dashboardStats = useMemo(() => {
    const saleCount = properties.filter((property) => property.listing_type === 'for_sale').length;
    const rentCount = properties.filter((property) => property.listing_type === 'for_rent').length;
    return {
      total: properties.length,
      saleCount,
      rentCount,
      averagePrice: properties.length
        ? properties.reduce((sum, property) => sum + property.price, 0) / properties.length
        : 0
    };
  }, [properties]);

  useEffect(() => {
    if (!listingFile) {
      setListingPreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(listingFile);
    setListingPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [listingFile]);

  async function sendListing() {
    if (!brokerIdentifier) {
      setListingStatus('error');
      setListingMessage('Enter a broker ID before adding a listing.');
      return;
    }

    if (!listingFile) {
      setListingStatus('error');
      setListingMessage('Please choose an image for the listing.');
      return;
    }

    const priceValue = Number(listingDraft.price);
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setListingStatus('error');
      setListingMessage('Enter a valid price in EUR.');
      return;
    }

    setListingStatus('submitting');
    setListingMessage('Optimizing image and publishing listing through the webhook contract...');

    try {
      const optimizedImage = await optimizeListingImage(listingFile);

      const requestBody: AddListingRequest = {
        meta: {
          schema_version: '1.0',
          request_id: createId('listing'),
          sent_at: new Date().toISOString(),
          source: 'app'
        },
        role: 'broker',
        broker_id: brokerIdentifier,
        property: {
          title: normalizeText(listingDraft.title),
          property_type: listingDraft.property_type,
          listing_type: listingDraft.listing_type,
          location: normalizeText(listingDraft.location),
          price: priceValue,
          currency: 'EUR',
          description: normalizeText(listingDraft.description)
        },
        image: {
          filename: optimizedImage.name,
          mime_type: optimizedImage.type || 'application/octet-stream'
        },
        source_context: {
          submitted_by_user_id: brokerIdentifier,
          submitted_by_role: 'broker',
          client_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      };

      const formData = new FormData();
      appendListingPayload(formData, requestBody);
  formData.append('image', optimizedImage, optimizedImage.name);

      const response = await fetch('/api/webhooks/listings', {
        method: 'POST',
        body: formData
      });

      const payload = (await response.json()) as AddListingResponse | ApiFailureResponse;

      if (!response.ok || !payload.ok) {
        const failure = payload as ApiFailureResponse;
        throw new Error(failure.error.message);
      }

      setProperties((current) => [payload.listing, ...current]);
      setListingDraft(initialListingDraft);
      setListingFile(null);
      setListingStatus('success');
      setListingMessage(payload.messages.join(' '));
    } catch (error) {
      setListingStatus('error');
      setListingMessage(error instanceof Error ? error.message : 'The listing could not be published.');
      await reportWebhookError({
        request_id: createId('error'),
        webhook: 'add_listing',
        error: {
          code: 'ADD_LISTING_FAILED',
          message: error instanceof Error ? error.message : 'The listing could not be published.',
          retryable: true
        },
        timestamp: new Date().toISOString(),
        source: 'app'
      });
    }
  }

  async function submitChat(
    role: Role,
    message: string,
    setMessages: Dispatch<SetStateAction<MessageItem[]>>,
    view: 'property_management' | 'buyer_search'
  ) {
    const prompt = normalizeText(message);
    if (!prompt) {
      return;
    }

    const userMessage: MessageItem = {
      id: createId('message'),
      role: 'user',
      text: prompt,
      time: new Date().toISOString()
    };

    setMessages((current) => [...current, userMessage]);

    const request: ChatRequest = {
      meta: {
        schema_version: '1.0',
        request_id: createId('chat'),
        sent_at: new Date().toISOString(),
        source: 'app'
      },
      role,
      user_id: activeUserId,
      conversation_id: `${view}:${activeUserId}`,
      message: prompt,
      context: {
        current_view: view,
        selected_property_ids: [],
        recent_property_ids: properties.slice(0, 3).map((property) => property.id)
      }
    };

    role === 'broker' ? setBrokerBusy(true) : setBuyerBusy(true);

    try {
      const response = await fetch('/api/webhooks/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      const payload = (await response.json()) as ChatResponse | ApiFailureResponse;

      if (!response.ok || !payload.ok) {
        throw new Error('The assistant could not respond.');
      }

      const assistantMessage: MessageItem = {
        id: createId('message'),
        role: 'assistant',
        badge: role === 'broker' ? 'Real Estate Advisor' : 'Buyer Assistant',
        text: payload.message,
        time: new Date().toISOString(),
        matchedProperties: payload.matched_properties
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createId('message'),
          role: 'assistant',
          badge: 'System',
          text: error instanceof Error ? error.message : 'The assistant could not respond.',
          time: new Date().toISOString()
        }
      ]);
      await reportWebhookError({
        request_id: createId('error'),
        webhook: 'chat',
        error: {
          code: 'CHAT_FAILED',
          message: error instanceof Error ? error.message : 'The assistant could not respond.',
          retryable: true
        },
        timestamp: new Date().toISOString(),
        source: 'app'
      });
    } finally {
      role === 'broker' ? setBrokerBusy(false) : setBuyerBusy(false);
    }
  }

  const brokerSubmitDisabled = brokerBusy;
  const latestBuyerResult = [...buyerMessages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.matchedProperties && message.matchedProperties.length > 0);

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-grid">
          <div>
            {mode !== 'all' ? (
              <p style={{ margin: '0 0 12px' }}>
                <Link className="button button-secondary" href="/">
                  Back to landing
                </Link>
              </p>
            ) : null}
            <p className="hero-kicker">NovaDom Realty // semantic workflow</p>
            <h1 className="hero-title">A brokerage cockpit that feels like a magazine spread.</h1>
            <p className="hero-text">
              This Next.js front end is wired for two webhook contracts only: broker listing creation and embedded chat.
              The broker path is gated by a seeded broker ID; buyer chat stays role-tagged and search-focused.
            </p>
            <div className="hero-badges">
              <span className="chip"><strong>{dashboardStats.total}</strong> active listings</span>
              <span className="chip"><strong>{dashboardStats.saleCount}</strong> for sale</span>
              <span className="chip"><strong>{dashboardStats.rentCount}</strong> for rent</span>
              <span className="chip"><strong>{formatEUR(dashboardStats.averagePrice)}</strong> mean asking price</span>
            </div>
            {initialError ? (
              <div className="empty-state" style={{ marginTop: 18 }}>
                {initialError}
              </div>
            ) : null}
          </div>
          <div className="hero-side">
          </div>
        </div>
      </section>

      <section className={`workspace ${mode !== 'all' ? 'is-single' : ''}`}>
        {showBroker ? <article className="panel is-broker">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2 className="panel-title">Property management</h2>
              <p className="panel-copy">
                Add a listing, preview the catalogue, and use the broker-only chat lane for business questions.
              </p>
            </div>
            <span className={`status-chip ${brokerIdentifier ? 'is-success' : 'is-warning'}`}>
              {brokerIdentifier ? `Broker: ${brokerIdentifier}` : 'Broker ID required'}
            </span>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="field-label" htmlFor="broker-id">
                Broker ID
              </label>
              <input
                id="broker-id"
                className="field-input"
                value={brokerId}
                onChange={(event) => setBrokerId(event.target.value)}
                placeholder="BRK-001"
              />
            </div>

            <div className="form-grid is-two-column">
              <div className="field">
                <label className="field-label" htmlFor="listing-title">
                  Title
                </label>
                <input
                  id="listing-title"
                  className="field-input"
                  value={listingDraft.title}
                  onChange={(event) => setListingDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Sunlit two-bedroom apartment"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="listing-price">
                  Price (EUR)
                </label>
                <input
                  id="listing-price"
                  className="field-input"
                  type="number"
                  value={listingDraft.price}
                  onChange={(event) => setListingDraft((current) => ({ ...current, price: event.target.value }))}
                  placeholder="189000"
                />
              </div>
            </div>

            <div className="form-grid is-two-column">
              <div className="field">
                <label className="field-label" htmlFor="listing-type">
                  Listing type
                </label>
                <select
                  id="listing-type"
                  className="field-select"
                  value={listingDraft.listing_type}
                  onChange={(event) => setListingDraft((current) => ({ ...current, listing_type: event.target.value as ListingType }))}
                >
                  {listingTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="property-type">
                  Property type
                </label>
                <select
                  id="property-type"
                  className="field-select"
                  value={listingDraft.property_type}
                  onChange={(event) => setListingDraft((current) => ({ ...current, property_type: event.target.value as PropertyType }))}
                >
                  {propertyTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-grid is-two-column">
              <div className="field">
                <label className="field-label" htmlFor="listing-location">
                  Location
                </label>
                <input
                  id="listing-location"
                  className="field-input"
                  value={listingDraft.location}
                  onChange={(event) => setListingDraft((current) => ({ ...current, location: event.target.value }))}
                  placeholder="Lozenets, Sofia"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="listing-image">
                  Image
                </label>
                <input
                  id="listing-image"
                  className="field-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => setListingFile(event.target.files?.[0] ?? null)}
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="listing-description">
                Description
              </label>
              <textarea
                id="listing-description"
                className="field-textarea"
                value={listingDraft.description}
                onChange={(event) => setListingDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder="Bright, renovated, balcony, close to metro..."
              />
            </div>

            <div className="form-actions">
              <button className="button" type="button" onClick={sendListing} disabled={brokerSubmitDisabled}>
                {listingStatus === 'submitting' ? 'Publishing...' : 'Publish listing'}
              </button>
              <p className="help-text">
                Broker requests forward the entered broker ID to n8n. Broker validation is handled in the workflow, not in the GUI.
              </p>
            </div>

            {listingPreview ? (
              <div className="result-card">
                <figure>
                  <Image src={listingPreview} alt="Selected listing preview" fill unoptimized sizes="240px" style={{ objectFit: 'cover' }} />
                </figure>
                <div className="result-body">
                  <h3 className="result-title">Image preview</h3>
                  <p className="property-meta">The selected image will be packaged into the webhook payload as base64 and preview URL.</p>
                </div>
              </div>
            ) : null}

            {listingMessage ? (
              <div className="empty-state" aria-live="polite">
                {listingStatus === 'error' ? 'Error: ' : ''}
                {listingMessage}
              </div>
            ) : null}
          </div>

          <div className="chat-shell" style={{ marginTop: 22 }}>
            <div className="panel-header" style={{ marginBottom: 0 }}>
              <div className="panel-title-group">
                <h3 className="panel-title" style={{ fontSize: '1.75rem' }}>
                  Broker chat
                </h3>
                <p className="panel-copy">Business questions, inquiry counts, and catalogue operations belong here.</p>
              </div>
            </div>

            <div className="chat-thread">
              {brokerMessages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="broker-chat">
                Ask the advisor
              </label>
              <textarea
                id="broker-chat"
                className="field-textarea"
                value={brokerQuery}
                onChange={(event) => setBrokerQuery(event.target.value)}
                placeholder="How many inquiries did we get this week?"
              />
            </div>
            <div className="form-actions">
              <button className="button" type="button" disabled={brokerBusy} onClick={() => submitChat('broker', brokerQuery, setBrokerMessages, 'property_management')}>
                {brokerBusy ? 'Sending...' : 'Send broker message'}
              </button>
              <span className="help-text">Embedded chat sends the role and user ID to the webhook layer.</span>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="panel-header">
              <div className="panel-title-group">
                <h3 className="panel-title" style={{ fontSize: '1.75rem' }}>
                  Current catalogue
                </h3>
                <p className="panel-copy">Seeded mock data now, Supabase-backed reads later.</p>
              </div>
            </div>
            <div className="catalog-grid">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          </div>
        </article> : null}

        {showBuyer ? <article className="panel is-buyer">
          <div className="panel-header">
            <div className="panel-title-group">
              <h2 className="panel-title">Buyer search</h2>
              <p className="panel-copy">
                This lane is for semantic property discovery and no-match handling. It is intentionally separate from the broker workflow.
              </p>
            </div>
            <span className="status-chip is-success">Role: client</span>
          </div>

          <div className="chat-shell">
            <div className="chat-thread">
              {buyerMessages.map((message) => (
                <ChatBubble key={message.id} message={message} />
              ))}
            </div>

            <div className="field">
              <label className="field-label" htmlFor="buyer-chat">
                Search the catalogue
              </label>
              <textarea
                id="buyer-chat"
                className="field-textarea"
                value={buyerQuery}
                onChange={(event) => setBuyerQuery(event.target.value)}
                placeholder="A bright, quiet two-bedroom with a balcony close to a park"
              />
            </div>

            <div className="form-actions">
              <button className="button" type="button" disabled={buyerBusy} onClick={() => submitChat('client', buyerQuery, setBuyerMessages, 'buyer_search')}>
                {buyerBusy ? 'Searching...' : 'Send buyer message'}
              </button>
              <p className="help-text">Search results are ranked by meaning in the mocked route and can be replaced by the n8n semantic workflow later.</p>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="panel-header">
              <div className="panel-title-group">
                <h3 className="panel-title" style={{ fontSize: '1.75rem' }}>
                  Recommended matches
                </h3>
                <p className="panel-copy">Latest buyer response. No-match states stay visible instead of showing weak results.</p>
              </div>
            </div>

            {latestBuyerResult?.matchedProperties && latestBuyerResult.matchedProperties.length > 0 ? (
              <div className="result-list">
                {latestBuyerResult.matchedProperties.map((property) => (
                  <article key={property.id} className="result-card">
                    <figure>
                      <Image src={property.image_url} alt={property.title} fill unoptimized sizes="(max-width: 720px) 100vw, 220px" style={{ objectFit: 'cover' }} />
                    </figure>
                    <div className="result-body">
                      <div className="result-title-row">
                        <div>
                          <h3 className="result-title">{property.title}</h3>
                          <p className="property-meta">{property.location}</p>
                        </div>
                        <span className="price">{formatEUR(property.price)}</span>
                      </div>
                      <div className="meta-row">
                        <span className="pill is-accent">{property.property_type}</span>
                        <span className="pill is-positive">{property.listing_type}</span>
                        <span className="pill">score {property.score.toFixed(1)}</span>
                      </div>
                      <p className="property-meta">{property.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                No ranked matches yet. Send a buyer message to populate this panel with semantic results.
              </div>
            )}
          </div>
        </article> : null}
      </section>

      <p className="footer-note">
        Backend contract summary: add-listing uses a bearer-protected webhook proxy, embedded chat posts the role and user ID only,
        and Supabase table names are reserved with an underscore prefix for the eventual database layer.
      </p>
    </main>
  );
}
