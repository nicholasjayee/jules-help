
import {
  Product,
  Customer,
  Sale,
  Expense,
  BusinessLocation,
  UserProfile,
  SaleItem,
  BusinessSettings
} from '@/components/types/index';

// Mock User
export const mockUser: UserProfile = {
  id: 'user-123',
  full_name: 'Demo User',
  display_name: 'Demo',
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock Business Location
export const mockBusinessLocation: BusinessLocation = {
  id: 'loc-123',
  name: 'Main Branch',
  is_default: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockBusinessLocations: BusinessLocation[] = [mockBusinessLocation];

// Mock Business Settings
export const mockBusinessSettings: BusinessSettings = {
  businessName: 'Demo Business',
  businessAddress: '123 Main St, City',
  businessPhone: '555-0123',
  businessEmail: 'demo@example.com',
  currency: 'USD',
  paymentInfo: 'Bank Account: 123456789',
  defaultPrintFormat: 'standard'
};

// Mock Products
export const mockProducts: Product[] = [
  {
    id: 'prod-1',
    itemNumber: 'ITM-001',
    name: 'Product A',
    description: 'Description for Product A',
    category: 'General',
    quantity: 100,
    costPrice: 50,
    sellingPrice: 100,
    supplier: 'Supplier X',
    imageUrl: null,
    minimumStock: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-2',
    itemNumber: 'ITM-002',
    name: 'Product B',
    description: 'Description for Product B',
    category: 'Electronics',
    quantity: 50,
    costPrice: 200,
    sellingPrice: 350,
    supplier: 'Supplier Y',
    imageUrl: null,
    minimumStock: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'prod-3',
    itemNumber: 'ITM-003',
    name: 'Product C',
    description: 'Description for Product C',
    category: 'Groceries',
    quantity: 0,
    costPrice: 10,
    sellingPrice: 20,
    supplier: 'Supplier Z',
    imageUrl: null,
    minimumStock: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

// Mock Customers
export const mockCustomers: Customer[] = [
  {
    id: 'cust-1',
    fullName: 'John Doe',
    email: 'john@example.com',
    phoneNumber: '555-1111',
    birthday: new Date('1990-01-01'),
    location: 'City A',
    categoryId: 'cat-1',
    socialMedia: null,
    gender: 'Male',
    tags: ['VIP'],
    notes: 'Loyal customer',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'cust-2',
    fullName: 'Jane Smith',
    email: 'jane@example.com',
    phoneNumber: '555-2222',
    birthday: null,
    location: 'City B',
    categoryId: null,
    socialMedia: null,
    gender: 'Female',
    tags: [],
    notes: '',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];

// Mock Sales
export const mockSales: Sale[] = [
  {
    id: 'sale-1',
    receiptNumber: 'REC-001',
    customerName: 'John Doe',
    customerAddress: 'City A',
    customerContact: '555-1111',
    customerId: 'cust-1',
    items: [
      {
        description: 'Product A',
        quantity: 1,
        price: 100,
        cost: 50,
        productId: 'prod-1',
      }
    ],
    paymentStatus: 'Paid',
    profit: 50,
    date: new Date(),
    taxRate: 0,
    amountPaid: 100,
    amountDue: 0,
    createdAt: new Date(),
  }
];

// Mock Expenses
export const mockExpenses: Expense[] = [
  {
    id: 'exp-1',
    amount: 500,
    description: 'Rent',
    category: 'Rent',
    date: new Date(),
    paymentMethod: 'Cash',
    personInCharge: 'Manager',
    receiptImage: null,
    cashAccountId: null,
    cashTransactionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
];
