import { PagedAndSortedRequest } from "./paged-and-sorted.request";

enum OrderStatus {
  Pending = "Pending",
  Processing = "Processing",
  Shipped = "Shipped",
  Delivered = "Delivered",
  Canceled = "Canceled",
  Returned = "Returned"
}

enum OrderType {
  Online = "Online",
  Offline = "Offline",
  Shoppe = "Shoppe"
}

enum PaymentStatus {
  Unpaid = "Unpaid",
  Paid = "Paid",
  Refunded = "Refunded"
}

export class OrderRequest extends PagedAndSortedRequest {
  status?: OrderStatus;
  type?: OrderType;
  paymentStatus?: PaymentStatus;
  fromDate?: string;
  toDate?: string;
  searchTerm?: string;
}