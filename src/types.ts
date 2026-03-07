export interface UserData {
  uid: string;
  name: string;
  email: string;
  phone: string;
  walletBalance: number;
  selectedTheme: string;
  createdAt: any;
}

export interface Service {
  id: string;
  api_service_id?: string; // ID from SMM API
  name: string;
  category: string;
  emoji: string;
  description: string;
  pricePerUnit: number;
  minQty: number;
  maxQty: number;
  enabled: boolean;
}

export interface Order {
  id: string;
  userId: string;
  serviceId: string;
  api_service_id?: string;
  api_order_id?: string;
  serviceName: string;
  category: string;
  link: string;
  quantity: number;
  pricePerUnit: number;
  totalCost: number;
  price?: number; // For backward compatibility
  status: 'Pending' | 'Processing' | 'Completed' | 'Cancelled' | 'Approved' | 'Rejected';
  createdAt: any;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  bannerUrl?: string;
  isGlobal?: boolean;
  createdAt: any;
  userId?: string; // Optional for global notifications
}

export type ThemeType = 'premium' | 'dark-pro' | 'royal-gold' | 'light-minimal' | 'cyber-neon' | 'modern-gaming' | 'black-gold' | 'clean-ui' | 'neon-cyber';
