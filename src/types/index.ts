export type Category = 'Matcha' | 'Filter Coffee' | 'Mocktail' | 'Bites' | 'Bakes' | 'Merch';

export interface Product {
  id: string;
  name: string;
  price: number;
  category: Category;
  subcategory: string | null;
  sort_order: number;
  is_available: boolean;
}

export type MilkOption = 'dairy' | 'oat';
export type SugarOption = 'no_sugar' | 'less_sweet' | 'normal' | 'more_sweet';
export type WarmUpOption = 'warm_up' | 'no_warm_up';

export interface ProductOptions {
  milk?: MilkOption;
  sugar?: SugarOption;
  warm_up?: WarmUpOption;
}

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  options?: ProductOptions;
  quantity: number;
  setLabel?: string;
}

export interface BestieSetSubItem {
  product_id: string;
  name: string;
  price: number;      // normal DB price, used for proportional distribution
  category: string;
  options?: ProductOptions;
}

export interface BestieSetCartItem {
  type: 'bestie_set';
  cartKey: string;    // unique local id, e.g. `bestie_set::${Date.now()}`
  setPrice: number;   // always 18
  drink1: BestieSetSubItem;
  drink2: BestieSetSubItem;
  bite: BestieSetSubItem;
}

export type CartEntry = CartItem | BestieSetCartItem;

export type PaymentMethod = 'cash' | 'card' | 'other';
export type OrderStatus = 'live' | 'completed';
export type OrderType = 'dine_in' | 'takeaway';
export type OrderSource = 'pos' | 'preorder';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  options: ProductOptions | null;
  line_total: number;
  created_at: string;
  ready_at: string | null;
  prep_required: boolean;
  external_lineitem_name?: string | null;
  external_lineitem_options?: string | null;
  external_lineitem_raw?: Record<string, unknown> | null;
}

export interface Order {
  id: string;
  ticket_number: string;
  created_at: string;
  completed_at?: string | null;
  status: OrderStatus;
  order_type: OrderType;
  subtotal: number;
  total: number;
  payment_method: PaymentMethod;
  notes?: string | null;
  staff_name: string;
  customer_name?: string | null;
  order_source: OrderSource;
  external_order_key?: string | null;
  external_order_number?: string | null;
  external_order_name?: string | null;
  scheduled_for?: string | null;
  release_at?: string | null;
  prep_due_at?: string | null;
  preorder_payment_status?: string | null;
  preorder_fulfillment_status?: string | null;
  preorder_collected_at?: string | null;
  external_raw?: Record<string, unknown> | null;
  items: OrderItem[];
}

export interface OrderRecord extends Omit<Order, 'items'> {
  order_items: OrderItem[];
}

export interface Donation {
  id: string;
  created_at: string;
  amount: number;
  payment_method: PaymentMethod;
  staff_name: string;
  note: string | null;
}

export interface DonationPayload {
  amount: number;
  payment_method: PaymentMethod;
  staff_name: string;
  note?: string | null;
}

