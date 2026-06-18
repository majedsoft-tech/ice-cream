export type ContainerType = string;

export interface ContainerOption {
  id: ContainerType;
  name: string;
  nameEn: string;
  price: number;
  description: string;
  color: string;
  emoji?: string;
  isAvailable?: boolean;
}

export interface FlavorOption {
  id: string;
  name: string;
  nameEn: string;
  price: number; // Add price per scoop/flavor if premium
  color: string; // Used for visual rendering
  emoji: string;
  isAvailable?: boolean;
}

export interface ToppingOption {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  category: 'sauce' | 'solid' | 'fruit';
  emoji: string;
  isAvailable?: boolean;
}

export interface CartItem {
  id: string;
  container: ContainerOption;
  flavors: FlavorOption[];
  toppings: ToppingOption[];
  quantity: number;
  basePrice: number;    // Container + flavors
  toppingsPrice: number; // Sum of toppings
  itemTotal: number;     // (base + toppings) * quantity
}

export interface OrderDiscount {
  id: string;
  name: string;
  nameEn?: string;
  type: 'percentage' | 'fixed';
  value: number;
  description: string;
}

export interface SaleRecord {
  id: string;
  orderNumber: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  toppingsTotal: number;
  discountAmount: number;
  calculatedDiscountName: string;
  total: number;
  paymentMethod: 'cash' | 'card';
  receivedAmount?: number;
  changeAmount?: number;
  bankSubMethod?: string;
  customerName?: string;
  isOnline?: boolean;
}

export interface OnlineOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  toppingsTotal: number;
  total: number;
  status: 'pending' | 'accepted' | 'prepared' | 'cancelled';
  timestamp: string;
  createdAt?: number;
  paymentMethod?: 'cash' | 'card';
  bankSubMethod?: string;
}
