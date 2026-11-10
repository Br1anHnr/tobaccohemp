import type {
  CustomerOrder,
  CustomerProfile,
  OrderStatus,
} from "@/types/account";

// Fictitious data used only by the demonstrative customer area.
// Replace with the customer/orders API once it is approved.
export const demoProfile: CustomerProfile = {
  name: "Cliente Demonstração",
  email: "cliente.demo@example.com",
  phone: "(11) 90000-0000",
  city: "São Paulo",
  state: "SP",
};

export const demoOrders: CustomerOrder[] = [
  {
    number: "TH-DEMO0003",
    createdAt: "2026-10-28T14:20:00-03:00",
    status: "em-separacao",
    items: [
      { productId: "bag-01", quantity: 1, variant: "Preto" },
      { productId: "tray-01", quantity: 2 },
    ],
    shipping: 0,
  },
  {
    number: "TH-DEMO0002",
    createdAt: "2026-09-12T10:05:00-03:00",
    status: "entregue",
    items: [{ productId: "case-01", quantity: 1, variant: "Grafite" }],
    shipping: 0,
  },
  {
    number: "TH-DEMO0001",
    createdAt: "2026-07-03T18:42:00-03:00",
    status: "cancelado",
    items: [{ productId: "org-01", quantity: 1 }],
    shipping: 0,
  },
];

export const orderStatusLabel: Record<OrderStatus, string> = {
  "em-separacao": "Em separação",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};
