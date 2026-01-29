import {
  Product,
  Sale,
  ProductCategory,
  UserProfile,
  BusinessSettings,
  SaleItem,
} from '@/types';
import { BusinessLocation } from '@/contexts/BusinessContext';

// Dummy User
export const DUMMY_USER_ID = 'dummy-user-id';

// Dummy User Profile
export const dummyProfile: UserProfile = {
  id: DUMMY_USER_ID,
  full_name: 'Test User',
  display_name: 'Test',
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Dummy Business Locations
export let dummyBusinessLocations: BusinessLocation[] = [
  {
    id: 'loc-1',
    name: 'Main Branch',
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'loc-2',
    name: 'Downtown Branch',
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Dummy Categories
export let dummyCategories: ProductCategory[] = [
  { id: 'cat-1', name: 'Electronics' },
  { id: 'cat-2', name: 'Clothing' },
  { id: 'cat-3', name: 'Groceries' },
];

// Dummy Products
export let dummyProducts: Product[] = [
  {
    id: 'prod-1',
    itemNumber: 'ITM-001',
    name: 'Laptop',
    description: 'High performance laptop',
    category: 'Electronics',
    quantity: 15,
    costPrice: 800000,
    sellingPrice: 1200000,
    supplier: 'TechSupplier Inc.',
    imageUrl: null,
    minimumStock: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-2',
    itemNumber: 'ITM-002',
    name: 'T-Shirt',
    description: 'Cotton T-Shirt',
    category: 'Clothing',
    quantity: 100,
    costPrice: 15000,
    sellingPrice: 25000,
    supplier: 'FashionHub',
    imageUrl: null,
    minimumStock: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-3',
    itemNumber: 'ITM-003',
    name: 'Rice (5kg)',
    description: 'Premium Basmati Rice',
    category: 'Groceries',
    quantity: 50,
    costPrice: 25000,
    sellingPrice: 35000,
    supplier: 'GrainWholesale',
    imageUrl: null,
    minimumStock: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Dummy Sales
export let dummySales: Sale[] = [
  {
    id: 'sale-1',
    receiptNumber: 'REC-001',
    customerName: 'John Doe',
    customerAddress: '123 Main St',
    customerContact: '0700123456',
    items: [
      {
        description: 'Laptop',
        quantity: 1,
        price: 1200000,
        cost: 800000,
        productId: 'prod-1',
        discountType: 'amount',
        discountAmount: 0,
      } as SaleItem,
    ],
    paymentStatus: 'Paid',
    profit: 400000,
    date: new Date(),
    createdAt: new Date(),
    amountPaid: 1200000,
    amountDue: 0,
    notes: 'First sale',
  },
  {
    id: 'sale-2',
    receiptNumber: 'REC-002',
    customerName: 'Jane Smith',
    customerAddress: '456 Oak Ave',
    customerContact: '0777987654',
    items: [
      {
        description: 'T-Shirt',
        quantity: 2,
        price: 25000,
        cost: 15000,
        productId: 'prod-2',
      } as SaleItem,
    ],
    paymentStatus: 'Paid',
    profit: 20000,
    date: new Date(),
    createdAt: new Date(),
    amountPaid: 50000,
    amountDue: 0,
  },
];

// Helper functions to simulate async operations

export const getProducts = async (): Promise<Product[]> => {
  return [...dummyProducts];
};

export const addProduct = async (product: Product): Promise<Product> => {
  dummyProducts = [product, ...dummyProducts];
  return product;
};

export const updateProductInDb = async (id: string, updates: Partial<Product>): Promise<boolean> => {
  dummyProducts = dummyProducts.map(p => p.id === id ? { ...p, ...updates } : p);
  return true;
};

export const deleteProductFromDb = async (id: string): Promise<boolean> => {
  dummyProducts = dummyProducts.filter(p => p.id !== id);
  return true;
};

export const getCategories = async (): Promise<ProductCategory[]> => {
  return [...dummyCategories];
};

export const getSales = async (): Promise<Sale[]> => {
  return [...dummySales];
};

export const addSaleToDb = async (sale: Sale): Promise<Sale> => {
  dummySales = [sale, ...dummySales];
  return sale;
};

export const deleteSaleFromDb = async (id: string): Promise<boolean> => {
  dummySales = dummySales.filter(s => s.id !== id);
  return true;
};

export const getBusinessLocations = async (): Promise<BusinessLocation[]> => {
  return [...dummyBusinessLocations];
};

export const getUserProfile = async (): Promise<UserProfile> => {
  return { ...dummyProfile };
};
