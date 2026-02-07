export class OrderResponse {
    createdAt: string;
    customerId: string | null;
    customerName: string | null;
    id: string;
    itemCount: number;
    paymentStatus: 'Unpaid' | 'Paid' | 'Refunded';
    shippingStatus: number | null;
    staffId: string | null;
    staffName: string | null;
    status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Canceled' | 'Returned';
    totalAmount: number;
    type: 'Online' | 'Offline' | 'Shoppe';
    updatedAt: string | null;
}