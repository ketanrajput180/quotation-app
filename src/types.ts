export enum QuotationStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid'
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
}

export interface CompanyProfile {
  id?: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  gstin: string;
  pan: string;
  logoUrl?: string;
  stampUrl?: string;
  bankDetails: BankDetails;
}

export interface Customer {
  id?: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  gstin: string;
  state: string;
  updatedAt: string;
}

export interface InventoryItem {
  id?: string;
  name: string;
  description: string;
  hsn: string;
  rate: number;
  unit: string;
  updatedAt: string;
}

export interface QuotationItem {
  productId: string;
  description: string;
  hsn: string;
  qty: number;
  rate: number;
  taxableValue: number;
  gstRate: number;
  gstAmount: number;
  total: number;
}

export interface Quotation {
  id?: string;
  userId: string;
  quotationNo: string;
  date: string;
  customerId: string;
  customerName: string;
  items: QuotationItem[];
  totalTaxableValue: number;
  totalGstAmount: number;
  grandTotal: number;
  isIGST: boolean;
  status: QuotationStatus;
  termsAndConditions: string[];
  createdAt: string;
  updatedAt: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}
