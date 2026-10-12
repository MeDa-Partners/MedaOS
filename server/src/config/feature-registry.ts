/**
 * Supported Feature Registry
 * 
 * Defines the ground truth of application features implemented in code.
 * A database record must NOT become a usable application feature unless it maps
 * to an implementation declared here.
 */

export interface SupportedSectionDefinition {
  key: string;
  name: string;
  description: string;
  routeTemplate: string;
  status: 'implemented' | 'beta' | 'planned';
}

export interface SupportedVentureDefinition {
  slug: string;
  name: string;
  description: string;
  supportedSectionKeys: string[];
}

export const SUPPORTED_SECTIONS: Record<string, SupportedSectionDefinition> = {
  sales: {
    key: 'sales',
    name: 'Sales Performance',
    description: 'Venture revenue tracking, deal pipeline, and sales orders.',
    routeTemplate: '/:ventureSlug/sales',
    status: 'implemented',
  },
  orders: {
    key: 'orders',
    name: 'Orders & Dispatch',
    description: 'Order fulfillment, customer deliveries, and stock dispatching.',
    routeTemplate: '/:ventureSlug/orders',
    status: 'implemented',
  },
  operations: {
    key: 'operations',
    name: 'Operations & Logistics',
    description: 'Operational throughput, supply chain coordination, and warehouse oversight.',
    routeTemplate: '/:ventureSlug/operations',
    status: 'implemented',
  },
  nbd: {
    key: 'nbd',
    name: 'New Business Development',
    description: 'Client acquisition, strategic accounts, and expansion initiatives.',
    routeTemplate: '/:ventureSlug/nbd',
    status: 'implemented',
  },
  marketing: {
    key: 'marketing',
    name: 'Marketing & Growth',
    description: 'Campaign distribution, acquisition channels, and audience analytics.',
    routeTemplate: '/:ventureSlug/marketing',
    status: 'implemented',
  },
  campaigns: {
    key: 'campaigns',
    name: 'Campaign Management',
    description: 'Ad campaign executions, creatives, and conversion reporting.',
    routeTemplate: '/:ventureSlug/campaigns',
    status: 'implemented',
  },
  leads: {
    key: 'leads',
    name: 'Lead Management',
    description: 'Inbound lead qualification, CRM contact pipeline, and deal conversion.',
    routeTemplate: '/:ventureSlug/leads',
    status: 'implemented',
  },
};

export const SUPPORTED_VENTURES: Record<string, SupportedVentureDefinition> = {
  wayveda: {
    slug: 'wayveda',
    name: 'WayVeda',
    description: 'Ayurvedic wellness & herbal ecommerce venture.',
    supportedSectionKeys: ['sales', 'orders', 'operations', 'marketing', 'nbd'],
  },
  'digital-chaabi': {
    slug: 'digital-chaabi',
    name: 'Digital Chaabi',
    description: 'Performance digital marketing and media agency.',
    supportedSectionKeys: ['sales', 'marketing', 'campaigns', 'leads', 'nbd'],
  },
  'nature-mania': {
    slug: 'nature-mania',
    name: 'Nature Mania',
    description: 'Organic consumer health & wellness brand.',
    supportedSectionKeys: ['sales', 'orders', 'operations', 'marketing'],
  },
  'my-fit-brain': {
    slug: 'my-fit-brain',
    name: 'My Fit Brain',
    description: 'Digital tele-consultation & mental health platform.',
    supportedSectionKeys: ['sales', 'operations', 'nbd', 'marketing'],
  },
};

export function isSectionImplemented(slug: string): boolean {
  return !!SUPPORTED_SECTIONS[slug.toLowerCase().trim()];
}

export function isVentureSupported(slug: string): boolean {
  return !!SUPPORTED_VENTURES[slug.toLowerCase().trim()];
}

export function getFeatureRegistryOverview() {
  return {
    sections: Object.values(SUPPORTED_SECTIONS),
    ventures: Object.values(SUPPORTED_VENTURES),
  };
}
