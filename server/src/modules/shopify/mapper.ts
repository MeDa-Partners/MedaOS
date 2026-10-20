import { NewOrder } from '../../db/schema';
import { detectPayment } from './payment';
import { ShopifyOrder } from './shopify.types';

/**
 * Shopify order → the Shopify-owned columns of an `orders` row. Ported from buildRow_() in
 * docs/reference/wayveda-sheet-sync.js.
 *
 * Deliberately returns only Shopify-owned fields: no stage, no task id and none of the
 * team-owned columns, so an upsert built from this can never overwrite the team's work.
 */
export type ShopifyOwnedOrderFields = Pick<
  NewOrder,
  | 'shopifyOrderId'
  | 'shopifyUpdatedAt'
  | 'rawPayload'
  | 'orderNumber'
  | 'orderDate'
  | 'customerName'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'pincode'
  | 'products'
  | 'totalQty'
  | 'totalAmount'
  | 'paymentMethod'
  | 'channel'
  | 'financialStatus'
  | 'fulfillmentStatus'
>;

/** Digits only; drop a leading 91 from 12 digits or a leading 0 from 11. */
export function normalizePhone(raw: string | null | undefined): string {
  let phone = String(raw || '').replace(/\D/g, '');
  if (phone.length === 12 && phone.startsWith('91')) phone = phone.slice(2);
  if (phone.length === 11 && phone.startsWith('0')) phone = phone.slice(1);
  return phone;
}

export function mapShopifyOrder(o: ShopifyOrder): ShopifyOwnedOrderFields {
  const ship = o.shipping_address || o.billing_address || {};
  const cust = o.customer || {};
  const lineItems = o.line_items || [];

  const customerName = ship.name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'N/A';

  const address = [ship.address1, ship.address2, ship.city, ship.province, ship.zip, ship.country || 'India']
    .filter(Boolean)
    .join(', ');

  return {
    shopifyOrderId: o.id,
    shopifyUpdatedAt: new Date(o.updated_at),
    rawPayload: o,
    orderNumber: String(o.name || '').replace(/#/g, ''),
    orderDate: new Date(o.created_at),
    customerName,
    phone: normalizePhone(o.phone || ship.phone || cust.phone),
    address,
    city: ship.city || '',
    state: ship.province || '',
    pincode: ship.zip || '',
    products: lineItems.map((li) => `${li.title} x${li.quantity}`).join(', '),
    totalQty: lineItems.reduce((s, li) => s + (li.quantity || 0), 0),
    totalAmount: String(parseFloat(o.total_price || '0') || 0),
    paymentMethod: detectPayment(o),
    channel: String(o.source_name || ''),
    financialStatus: o.financial_status || '',
    fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
  };
}
