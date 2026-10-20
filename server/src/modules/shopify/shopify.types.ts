/** Only the parts of a Shopify REST order (Admin API 2026-01) that MedaOS reads. */
export interface ShopifyAddress {
  name?: string | null;
  phone?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  country?: string | null;
}

export interface ShopifyLineItem {
  title: string;
  quantity: number;
}

export interface ShopifyOrder {
  id: number;
  name?: string | null;
  created_at: string;
  updated_at: string;
  total_price?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  payment_gateway_names?: string[] | null;
  source_name?: string | null;
  phone?: string | null;
  customer?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
  shipping_address?: ShopifyAddress | null;
  billing_address?: ShopifyAddress | null;
  line_items?: ShopifyLineItem[] | null;
}

export interface ShopifyCredentials {
  shopDomain: string;
  clientId: string;
  clientSecret: string;
}
