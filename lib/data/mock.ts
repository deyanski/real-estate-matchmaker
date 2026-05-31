import type { BrokerRecord, PropertyRecord } from '@/lib/contracts/webhooks';

export const mockBrokers: BrokerRecord[] = [
  {
    broker_id: 'BRK-001',
    display_name: 'Mira Petkova',
    active: true
  },
  {
    broker_id: 'BRK-014',
    display_name: 'Georgi Ivanov',
    active: true
  },
  {
    broker_id: 'BRK-031',
    display_name: 'Elena Marinova',
    active: false
  }
];

export const mockProperties: PropertyRecord[] = [
  {
    id: 'P-001',
    title: 'Two-bedroom apartment',
    property_type: 'apartment',
    listing_type: 'for_sale',
    location: 'Lozenets, Sofia',
    price: 189000,
    description:
      'Bright two-bedroom with a renovated kitchen, oak flooring, a large south-facing balcony, and a separate storage room. Quiet street, close to parks and metro.',
    image_url:
      'https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'P-002',
    title: 'Studio',
    property_type: 'studio',
    listing_type: 'for_sale',
    location: 'Studentski Grad, Sofia',
    price: 72000,
    description:
      'Compact furnished studio ideal for students or investment. Newly built block, elevator, secured entrance, low maintenance fees.',
    image_url:
      'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'P-003',
    title: 'Three-bedroom house',
    property_type: 'house',
    listing_type: 'for_sale',
    location: 'Bistritsa, Sofia',
    price: 415000,
    description:
      'Detached family house with a garden, garage for two cars, fireplace, and panoramic mountain views. Needs minor cosmetic updates.',
    image_url:
      'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'P-004',
    title: 'One-bedroom apartment',
    property_type: 'apartment',
    listing_type: 'for_sale',
    location: 'Center, Plovdiv',
    price: 98500,
    description:
      'Renovated one-bedroom in a historic building, high ceilings, original details, walking distance to the Old Town. No elevator, third floor.',
    image_url:
      'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'P-005',
    title: 'Maisonette',
    property_type: 'maisonette',
    listing_type: 'for_sale',
    location: 'Vitosha, Sofia',
    price: 312000,
    description:
      'Spacious two-level maisonette with three bedrooms, two bathrooms, a private terrace, underfloor heating, and a dedicated parking spot.',
    image_url:
      'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'P-006',
    title: 'Two-bedroom apartment',
    property_type: 'apartment',
    listing_type: 'for_rent',
    location: 'Mladost, Sofia',
    price: 950,
    description:
      'Modern furnished two-bedroom for rent, air conditioning, fully equipped kitchen, balcony, close to a metro station and a shopping mall.',
    image_url:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'P-007',
    title: 'Office space',
    property_type: 'office',
    listing_type: 'for_rent',
    location: 'Business Park, Sofia',
    price: 1450,
    description:
      'Open-plan office of 120 sqm in a class A business building, air conditioning, server room, 4 parking spots, ready to move in.',
    image_url:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80'
  }
];

export interface InquiryLog {
  id: string;
  buyer_query: string;
  matched_property_ids: string[];
  timestamp: string;
}

export const mockInquiryLogs: InquiryLog[] = [
  {
    id: 'inq-001',
    buyer_query: 'quiet apartment with balcony near a park',
    matched_property_ids: ['P-001', 'P-006'],
    timestamp: '2026-05-28T09:45:00.000Z'
  },
  {
    id: 'inq-002',
    buyer_query: 'cheapest apartment in Sofia',
    matched_property_ids: ['P-002'],
    timestamp: '2026-05-29T11:20:00.000Z'
  },
  {
    id: 'inq-003',
    buyer_query: 'house with garden and mountain views',
    matched_property_ids: ['P-003'],
    timestamp: '2026-05-30T14:05:00.000Z'
  }
];

export function formatEUR(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: price % 1 === 0 ? 0 : 2
  }).format(price);
}
