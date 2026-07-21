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
  isHidden?: boolean;
  imageUrl?: string;
}

export interface FlavorOption {
  id: string;
  name: string;
  nameEn: string;
  price: number; // Add price per scoop/flavor if premium
  color: string; // Used for visual rendering
  emoji: string;
  isAvailable?: boolean;
  isHidden?: boolean;
  imageUrl?: string;
}

export interface ToppingOption {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  category: 'sauce' | 'solid' | 'fruit';
  emoji: string;
  isAvailable?: boolean;
  isHidden?: boolean;
  imageUrl?: string;
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
  createdAt?: number;
}

export interface OnlineOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  items: CartItem[];
  subtotal: number;
  toppingsTotal: number;
  total: number;
  status: 'pending' | 'accepted' | 'prepared' | 'cancelled' | 'received';
  timestamp: string;
  createdAt?: number;
  preparedAt?: number;
  paymentMethod?: 'cash' | 'card';
  bankSubMethod?: string;
}

export interface ExpenseRecord {
  id: string;
  category: string; // "مواد خام" | "مواد تشغيل" | "رواتب" | "إيجار" | "فواتير" | "تسويق" | "صيانة" | "أخرى"
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string; // ISO String or similar
}

