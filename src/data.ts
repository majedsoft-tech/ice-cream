import { ContainerOption, FlavorOption, ToppingOption, OrderDiscount } from './types';

export const CONTAINERS: ContainerOption[] = [
  {
    id: 'cup',
    name: 'كوب ورقي فاخر',
    nameEn: 'Premium Paper Cup',
    price: 5.0,
    description: 'يأتي مع ملعقة خشبية صديقة للبيئة وسهل التناول والتحكم.',
    color: 'from-amber-100 to-amber-200 text-amber-800 border-amber-300'
  } as any, // Cast support for custom styles
  {
    id: 'cone',
    name: 'بسكوت مقرمش (مخروط)',
    nameEn: 'Crispy Waffle Cone',
    price: 7.0,
    description: 'بسكوتة وافل مذهبة ومقرمشة تُصنع طازجة يومياً بنكهة الفانيلا.',
    color: 'from-amber-600 to-amber-700 text-white border-amber-800'
  } as any
];

// Map exact structure to ContainerOption
export const CONTAINER_OPTIONS: ContainerOption[] = [
  {
    id: 'cup',
    name: 'كوب آيس كريم',
    nameEn: 'Cup',
    price: 5.0,
    description: 'كوب أنيق ومريح ومناسب لجميع الإضافات مع ملعقة خشبية مجانية.',
    color: '#FFFAF0' // Warm tint
  },
  {
    id: 'cone',
    name: 'بسكوت مقرمش',
    nameEn: 'Cone',
    price: 7.0,
    description: 'بسكوتة بسكويتة مقرمشة لذيذة تخبز طازجة بمذاق وافل الرائع.',
    color: '#F4A460' // Sandy brown
  }
];

export const FLAVOR_OPTIONS: FlavorOption[] = [
  {
    id: 'vanilla',
    name: 'فانيليا كلاسيكية',
    nameEn: 'Classic Vanilla',
    price: 0.0, // included in base
    color: '#FFFDF0',
    emoji: '🍦'
  }
];

export const TOPPING_OPTIONS: ToppingOption[] = [
  {
    id: 'sprinkles',
    name: 'حلوى السكر الملونة',
    nameEn: 'Rainbow Sprinkles',
    price: 1.5,
    category: 'solid',
    emoji: '🌈'
  },
  {
    id: 'nuts',
    name: 'مكسرات مشكلة ولوز حمّص',
    nameEn: 'Mixed Roasted Nuts',
    price: 2.5,
    category: 'solid',
    emoji: '🥜'
  }
];

export const DISCOUNTS: OrderDiscount[] = [
  {
    id: 'none',
    name: 'بدون خصم إضافي',
    nameEn: 'No Additional Discount',
    type: 'fixed',
    value: 0,
    description: 'لا يوجد خصم يدوي مطبق'
  },
  {
    id: 'loyal_customer',
    name: 'خصم العميل الوفي %10',
    nameEn: 'Loyal Customer 10%',
    type: 'percentage',
    value: 10,
    description: 'خصم تقديري للزبائن الدائمين للمحل.'
  },
  {
    id: 'family_offer',
    name: 'خصم الجمعات والعائلات %15',
    nameEn: 'Family Discount 15%',
    type: 'percentage',
    value: 15,
    description: 'يُطبق للطلبات العائلية الكبيرة لإضفاء البهجة.'
  },
  {
    id: 'happy_child',
    name: 'خصم ابتسامة طفل (3 ريال)',
    nameEn: 'Child Smile Deal (3 SAR)',
    type: 'fixed',
    value: 3,
    description: 'خصم نقدي مباشر لإسعاد الصغار.'
  }
];

export const DEFAULT_CURRENCY = 'ريال';
export const DEFAULT_CURRENCY_EN = 'SAR';
