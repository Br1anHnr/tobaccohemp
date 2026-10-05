export interface CartItem {
  productId: string;
  quantity: number;
  variant?: string;
}
export interface DemoOrder {
  number: string;
  total: number;
  count: number;
  createdAt: string;
}
