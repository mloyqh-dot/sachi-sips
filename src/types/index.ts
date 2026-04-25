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

export interface ProductOptions {
  milk: MilkOption;
  sugar: SugarOption;
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
  items: OrderItem[];
}

export interface OrderRecord extends Omit<Order, 'items'> {
  order_items: OrderItem[];
}

export interface Transaction {
  id: string;
  created_at: string;
  items: CartEntry[];
  total: number;
  payment_method: PaymentMethod;
  notes?: string;
  staff_name: string;
}

export interface Receipt {
  id: string;
  transaction_id: string;
  created_at: string;
  total: number;
  items: CartEntry[];
}
