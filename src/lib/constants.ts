import type { Category } from '../types';

export const CATEGORY_ORDER: Category[] = [
  'Matcha',
  'Filter Coffee',
  'Mocktail',
  'Bites',
  'Bakes',
  'Merch',
];

export const CATEGORY_META: Record<Category, { label: string; description: string }> = {
  Matcha: {
    label: 'Matcha & Hojicha Lattes',
    description: 'Signature tea drinks and fruit-led matcha blends.',
  },
  'Filter Coffee': {
    label: 'Filter Coffee',
    description: 'Single-origin pours by Anchoffee, served hot or iced.',
  },
  Mocktail: {
    label: 'Mocktails',
    description: 'Flights and flavour-led non-alcoholic drinks.',
  },
  Bites: {
    label: 'Bites',
    description: 'Quick hot snacks suited for event service.',
  },
  Bakes: {
    label: 'Bakes',
    description: 'Pastries and small baked treats by thenoobcooks.',
  },
  Merch: {
    label: 'Merchandise',
    description: 'Sachi Sips, Esther House, and Friends of Sachi collections.',
  },
};

export const STATION_CATEGORIES = {
  hojicha: ['Matcha'] as Category[],
  coffee: ['Filter Coffee', 'Mocktail'] as Category[],
  kitchen: ['Bites', 'Bakes'] as Category[],
  merch: ['Merch'] as Category[],
} as const;
