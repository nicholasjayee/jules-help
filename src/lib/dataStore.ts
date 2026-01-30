
import {
  Product,
  Customer,
  Sale,
  Expense,
  BusinessLocation,
  UserProfile,
  BusinessSettings,
  SaleFormData,
  SaleItem
} from '@/components/types/index';
import { BusinessProfile } from '@/components/contexts/ProfileContext';
import {
  mockProducts,
  mockCustomers,
  mockSales,
  mockExpenses,
  mockBusinessLocations,
  mockUser,
  mockBusinessSettings
} from '@/lib/dummyData';

class DataStore {
  private products: Product[];
  private customers: Customer[];
  private sales: Sale[];
  private expenses: Expense[];
  private businessLocations: BusinessLocation[];
  private profiles: BusinessProfile[];
  private user: UserProfile;
  private businessSettings: BusinessSettings;

  constructor() {
    this.products = [...mockProducts];
    this.customers = [...mockCustomers];
    this.sales = [...mockSales];
    this.expenses = [...mockExpenses];
    this.businessLocations = [...mockBusinessLocations];
    this.profiles = [];
    this.user = { ...mockUser };
    this.businessSettings = { ...mockBusinessSettings };
  }

  // --- Auth ---
  async getUser(): Promise<UserProfile | null> {
    return this.user;
  }

  async signOut(): Promise<void> {
    // In a real app, this would clear session
    return;
  }

  // --- Business Locations ---
  async getBusinessLocations(userId: string): Promise<BusinessLocation[]> {
    return this.businessLocations;
  }

  async createBusiness(business: BusinessLocation): Promise<BusinessLocation> {
    this.businessLocations.push(business);
    return business;
  }

  async updateBusiness(id: string, updates: Partial<BusinessLocation>): Promise<BusinessLocation | null> {
    const index = this.businessLocations.findIndex(b => b.id === id);
    if (index === -1) return null;
    this.businessLocations[index] = { ...this.businessLocations[index], ...updates };
    return this.businessLocations[index];
  }

  async deleteBusiness(id: string): Promise<boolean> {
    this.businessLocations = this.businessLocations.filter(b => b.id !== id);
    return true;
  }

  async getBusinessSettings(locationId: string): Promise<BusinessSettings> {
    return this.businessSettings;
  }

  async updateBusinessSettings(locationId: string, settings: Partial<BusinessSettings>): Promise<BusinessSettings> {
    this.businessSettings = { ...this.businessSettings, ...settings };
    return this.businessSettings;
  }

  // --- Profiles ---
  async getProfiles(locationId: string): Promise<BusinessProfile[]> {
    return this.profiles.filter(p => p.business_location_id === locationId);
  }

  async createProfile(profile: BusinessProfile): Promise<BusinessProfile> {
    this.profiles.push(profile);
    return profile;
  }

  async updateProfile(id: string, updates: Partial<BusinessProfile>): Promise<BusinessProfile | null> {
    const index = this.profiles.findIndex(p => p.id === id);
    if (index === -1) return null;
    this.profiles[index] = { ...this.profiles[index], ...updates };
    return this.profiles[index];
  }

  async deleteProfile(id: string): Promise<boolean> {
    this.profiles = this.profiles.filter(p => p.id !== id);
    return true;
  }

  // --- Products ---
  async getProducts(userId: string, locationId: string): Promise<Product[]> {
    return this.products;
  }

  async createProduct(product: Product): Promise<Product> {
    this.products.push(product);
    return product;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
    const index = this.products.findIndex(p => p.id === id);
    if (index === -1) return null;
    this.products[index] = { ...this.products[index], ...updates };
    return this.products[index];
  }

  async deleteProduct(id: string): Promise<boolean> {
    this.products = this.products.filter(p => p.id !== id);
    return true;
  }

  // --- Customers ---
  async getCustomers(userId: string): Promise<Customer[]> {
    return this.customers;
  }

  async createCustomer(customer: Customer): Promise<Customer> {
    this.customers.push(customer);
    return customer;
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer | null> {
    const index = this.customers.findIndex(c => c.id === id);
    if (index === -1) return null;
    this.customers[index] = { ...this.customers[index], ...updates };
    return this.customers[index];
  }

  async deleteCustomer(id: string): Promise<boolean> {
    this.customers = this.customers.filter(c => c.id !== id);
    return true;
  }

  // --- Sales ---
  async getSales(userId: string, locationId: string): Promise<Sale[]> {
    return this.sales;
  }

  async createSale(sale: Sale): Promise<Sale> {
    this.sales.push(sale);

    // Update product quantities
    for (const item of sale.items) {
      if (item.productId) {
        const product = this.products.find(p => p.id === item.productId);
        if (product) {
          product.quantity -= item.quantity;
        }
      }
    }

    return sale;
  }

  async updateSale(id: string, updates: Partial<Sale>): Promise<Sale | null> {
    const index = this.sales.findIndex(s => s.id === id);
    if (index === -1) return null;
    this.sales[index] = { ...this.sales[index], ...updates };
    return this.sales[index];
  }

  async deleteSale(id: string): Promise<boolean> {
    this.sales = this.sales.filter(s => s.id !== id);
    return true;
  }

  // --- Expenses ---
  async getExpenses(userId: string): Promise<Expense[]> {
    return this.expenses;
  }

  async createExpense(expense: Expense): Promise<Expense> {
    this.expenses.push(expense);
    return expense;
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense | null> {
    const index = this.expenses.findIndex(e => e.id === id);
    if (index === -1) return null;
    this.expenses[index] = { ...this.expenses[index], ...updates };
    return this.expenses[index];
  }

  async deleteExpense(id: string): Promise<boolean> {
    this.expenses = this.expenses.filter(e => e.id !== id);
    return true;
  }
}

export const dataStore = new DataStore();
