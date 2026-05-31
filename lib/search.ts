import type { ChatMatchedProperty, PropertyRecord } from '@/lib/contracts/webhooks';
import { formatEUR, mockInquiryLogs, mockProperties } from '@/lib/data/mock';
import { normalizeText } from '@/lib/contracts/webhooks';

const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'with', 'in', 'on', 'near', 'close', 'please']);

function tokenize(input: string): string[] {
  return normalizeText(input)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function scoreProperty(query: string, property: PropertyRecord): number {
  const tokens = tokenize(query);
  const haystack = `${property.title} ${property.property_type} ${property.listing_type} ${property.location} ${property.description}`.toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 2;
    }
  }

  if (query.toLowerCase().includes('balcony') && haystack.includes('balcony')) {
    score += 4;
  }

  if (query.toLowerCase().includes('garden') && haystack.includes('garden')) {
    score += 4;
  }

  if (query.toLowerCase().includes('metro') && haystack.includes('metro')) {
    score += 3;
  }

  if (query.toLowerCase().includes('cheap') && property.price <= 100000) {
    score += 5;
  }

  if (query.toLowerCase().includes('rent') && property.listing_type === 'for_rent') {
    score += 4;
  }

  if (query.toLowerCase().includes('sale') && property.listing_type === 'for_sale') {
    score += 4;
  }

  return score;
}

export function rankProperties(query: string, source: PropertyRecord[] = mockProperties): ChatMatchedProperty[] {
  return source
    .map((property) => ({
      ...property,
      score: scoreProperty(query, property)
    }))
    .sort((left, right) => right.score - left.score)
    .filter((property) => property.score > 0)
    .slice(0, 3);
}

function isBrokerOnlyQuestion(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes('inquiry logs') ||
    lowered.includes('internal logs') ||
    lowered.includes('how many inquiries') ||
    lowered.includes('average price') ||
    lowered.includes('cheapest') ||
    lowered.includes('business figures')
  );
}

function getAveragePrice(properties: PropertyRecord[], listingType?: PropertyRecord['listing_type'], propertyType?: PropertyRecord['property_type']): number | null {
  const filtered = properties.filter((property) => {
    return (
      (listingType ? property.listing_type === listingType : true) &&
      (propertyType ? property.property_type === propertyType : true)
    );
  });

  if (filtered.length === 0) {
    return null;
  }

  return filtered.reduce((sum, property) => sum + property.price, 0) / filtered.length;
}

function extractLocation(message: string): string | null {
  const lowered = message.toLowerCase();
  if (lowered.includes('sofia')) return 'Sofia';
  if (lowered.includes('plovdiv')) return 'Plovdiv';
  if (lowered.includes('varna')) return 'Varna';
  return null;
}

function extractPropertyType(message: string): PropertyRecord['property_type'] | null {
  const lowered = message.toLowerCase();
  if (lowered.includes('apartment')) return 'apartment';
  if (lowered.includes('house')) return 'house';
  if (lowered.includes('studio')) return 'studio';
  if (lowered.includes('office')) return 'office';
  if (lowered.includes('maisonette')) return 'maisonette';
  return null;
}

export function respondToChat(role: 'broker' | 'client', message: string) {
  const lowered = message.toLowerCase();
  const candidateProperties = rankProperties(message);

  if (role === 'client' && isBrokerOnlyQuestion(message)) {
    return {
      response_type: 'refusal' as const,
      message: 'I can help with property search and listing details, but I cannot provide internal logs or business aggregates.',
      matched_properties: []
    };
  }

  if (lowered.includes('how many inquiries')) {
    return {
      response_type: 'answer' as const,
      message: `There are ${mockInquiryLogs.length} inquiries in the local dataset this week.`,
      matched_properties: []
    };
  }

  if (lowered.includes('average price')) {
    const propertyType = extractPropertyType(message);
    const location = extractLocation(message);
    const filtered = mockProperties.filter((property) => {
      return (
        (propertyType ? property.property_type === propertyType : true) &&
        (location ? property.location.toLowerCase().includes(location.toLowerCase()) : true)
      );
    });

    const average = getAveragePrice(filtered);
    return {
      response_type: 'answer' as const,
      message: average
        ? `The average price for that slice is ${formatEUR(average)}.`
        : 'I could not find enough local data for that comparison.',
      matched_properties: []
    };
  }

  if (lowered.includes('cheapest')) {
    const filtered = mockProperties
      .filter((property) => {
        const propertyType = extractPropertyType(message);
        const location = extractLocation(message);
        return (
          (propertyType ? property.property_type === propertyType : true) &&
          (location ? property.location.toLowerCase().includes(location.toLowerCase()) : true)
        );
      })
      .sort((left, right) => left.price - right.price);

    if (filtered.length === 0) {
      return {
        response_type: 'no_match' as const,
        message: 'No listing matched that request.',
        matched_properties: []
      };
    }

    return {
      response_type: 'answer' as const,
      message: `The cheapest match is ${filtered[0].title} in ${filtered[0].location}.`,
      matched_properties: [
        {
          ...filtered[0],
          score: 10
        }
      ]
    };
  }

  if (candidateProperties.length === 0) {
    return {
      response_type: 'no_match' as const,
      message: 'No strong semantic match found. Try adding more detail about location, layout, or features.',
      matched_properties: []
    };
  }

  return {
    response_type: 'search_results' as const,
    message: `I found ${candidateProperties.length} likely match${candidateProperties.length === 1 ? '' : 'es'}.`,
    matched_properties: candidateProperties
  };
}
