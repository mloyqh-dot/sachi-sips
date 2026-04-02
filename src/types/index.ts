export type Category = 'Matcha' | 'Coffee' | 'Specials' | 'Savory' | 'Bakery';

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
}

export type PaymentMethod = 'cash' | 'card' | 'other';
export type OrderStatus = 'live' | 'completed';

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
}

export interface Order {
  id: string;
  ticket_number: string;
  created_at: string;
  completed_at?: string | null;
  status: OrderStatus;
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
  items: CartItem[];
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
  items: CartItem[];
}
