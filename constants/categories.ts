export const DAY_ONE_CATEGORIES = [
  'Food & Catering',
  'Fashion',
  'Beauty Tools',
  'Home & Living',
  'Electronics Repair',
  'Baby & Kids',
  'Bags & Accessories',
  'Phone Accessories',
  'Art & Handmade',
  'Books & Stationery',
  'Digital Products',
  'Safe Verified Services',
] as const;

export type DayOneCategory = typeof DAY_ONE_CATEGORIES[number];

export interface CategoryDisplay {
  id: string;
  name: DayOneCategory;
  image?: string;
}
