import { ApiPropertyOptional } from "@nestjs/swagger";
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
    @ApiPropertyOptional({
        enum: OrderStatus,
        description: "Trạng thái đơn hàng",
        example: OrderStatus.Pending,
    })
    status?: OrderStatus;

    @ApiPropertyOptional({
        enum: OrderType,
        description: "Loại đơn hàng",
        example: OrderType.Online,
    })
    type?: OrderType;

    @ApiPropertyOptional({
        enum: PaymentStatus,
        description: "Trạng thái thanh toán",
        example: PaymentStatus.Unpaid,
    })
    paymentStatus?: PaymentStatus;

    @ApiPropertyOptional({
        description: "Ngày bắt đầu (ISO 8601)",
        example: "2024-01-01",
    })
    fromDate?: string;

    @ApiPropertyOptional({
        description: "Ngày kết thúc (ISO 8601)",
        example: "2024-12-31",
    })
    toDate?: string;

    @ApiPropertyOptional({
        description: "Từ khóa tìm kiếm",
        example: "perfume",
    })
    searchTerm?: string;

    constructor(init?: Partial<OrderRequest>) {
        super();
        Object.assign(this, init);
    }
}