import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { OrderRequest } from 'src/application/dtos/request/order.request';
import { BaseResponse } from 'src/application/dtos/response/common/base-response';
import { BaseResponseAPI } from 'src/application/dtos/response/common/base-response-api';
import { PagedResult } from 'src/application/dtos/response/common/paged-result';
import {
  OrderDetailResponse,
  OrderListItemResponse,
  OrderResponse
} from 'src/application/dtos/response/order.response';
import { I18nErrorHandler } from 'src/infrastructure/domain/utils/i18n-error-handler';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import ApiUrl from 'src/infrastructure/domain/common/api/api_url';

const orderListInclude = {
  AspNetUsers_Orders_CustomerIdToAspNetUsers: true,
  AspNetUsers_Orders_StaffIdToAspNetUsers: true,
  OrderDetails: true,
  ShippingInfos: true
} satisfies Prisma.OrdersInclude;

const orderDetailInclude = {
  AspNetUsers_Orders_CustomerIdToAspNetUsers: true,
  AspNetUsers_Orders_StaffIdToAspNetUsers: true,
  OrderDetails: {
    include: {
      ProductVariants: {
        include: {
          Products: true,
          Media: { where: { IsPrimary: true } },
          Concentrations: true
        }
      }
    }
  },
  UserVouchers: {
    include: {
      Vouchers: true
    }
  },
  ContactAddresses: true,
  ShippingInfos: true
} satisfies Prisma.OrdersInclude;

type OrderListItem = Prisma.OrdersGetPayload<{
  include: typeof orderListInclude;
}>;
type OrderFull = Prisma.OrdersGetPayload<{
  include: typeof orderDetailInclude;
}>;

function mapOrderListItem(o: OrderListItem): OrderListItemResponse {
  return new OrderListItemResponse({
    id: o.Id,
    code: o.Code,
    customerId: o.CustomerId ?? null,
    customerName:
      o.AspNetUsers_Orders_CustomerIdToAspNetUsers?.FullName ?? null,
    staffId: o.StaffId ?? null,
    staffName: o.AspNetUsers_Orders_StaffIdToAspNetUsers?.FullName ?? null,
    type: o.Type as 'Online' | 'Offline' | 'Shoppe',
    status: o.Status as
      | 'Pending'
      | 'Processing'
      | 'Shipped'
      | 'Delivered'
      | 'Canceled'
      | 'Returned',
    totalAmount: Number(o.TotalAmount),
    paymentStatus: o.PaymentStatus as 'Unpaid' | 'Paid' | 'Refunded',
    shippingStatus:
      o.ShippingInfos?.Status != null ? Number(o.ShippingInfos.Status) : null,
    itemCount: o.OrderDetails.length,
    createdAt: o.CreatedAt.toISOString(),
    updatedAt: o.UpdatedAt?.toISOString() ?? null
  });
}

function mapOrderFull(o: OrderFull): OrderResponse {
  return new OrderResponse({
    id: o.Id,
    code: o.Code,
    customerId: o.CustomerId ?? null,
    customerName:
      o.AspNetUsers_Orders_CustomerIdToAspNetUsers?.FullName ?? null,
    customerEmail: o.AspNetUsers_Orders_CustomerIdToAspNetUsers?.Email ?? null,
    staffId: o.StaffId ?? null,
    staffName: o.AspNetUsers_Orders_StaffIdToAspNetUsers?.FullName ?? null,
    type: o.Type as 'Online' | 'Offline' | 'Shoppe',
    orderStatus: o.Status as
      | 'Pending'
      | 'Processing'
      | 'Shipped'
      | 'Delivered'
      | 'Canceled'
      | 'Returned',
    totalAmount: Number(o.TotalAmount),
    paymentStatus: o.PaymentStatus as 'Unpaid' | 'Paid' | 'Refunded',
    paidAt: o.PaidAt?.toISOString() ?? null,
    paymentExpiresAt: o.PaymentExpiresAt?.toISOString() ?? null,
    voucherId: o.UserVoucherId ?? null,
    voucherCode: o.UserVouchers?.Vouchers?.Code ?? null,
    recipientInfo: o.ContactAddresses
      ? {
        fullName: o.ContactAddresses.ContactName,
        phone: o.ContactAddresses.ContactPhoneNumber,
        fullAddress: o.ContactAddresses.FullAddress
      }
      : null,
    shippingInfo: o.ShippingInfos
      ? {
        carrierName: o.ShippingInfos.CarrierName,
        trackingNumber: o.ShippingInfos.TrackingNumber,
        shippingFee: Number(o.ShippingInfos.ShippingFee),
        status: o.ShippingInfos.Status
      }
      : null,
    orderDetails: o.OrderDetails.map(
      (d): OrderDetailResponse =>
        new OrderDetailResponse({
          id: d.Id,
          variantId: d.VariantId,
          variantName: `${d.ProductVariants.Products.Name} ${d.ProductVariants.VolumeMl}ml ${d.ProductVariants.Concentrations.Name}`,
          quantity: d.Quantity,
          unitPrice: Number(d.UnitPrice),
          total: Number(d.UnitPrice) * d.Quantity,
          imageUrl: d.ProductVariants.Media[0]?.Url ?? null
        })
    ),
    createdAt: o.CreatedAt.toISOString(),
    updatedAt: o.UpdatedAt?.toISOString() ?? null
  });
}

function buildOrderWhere(
  request: OrderRequest,
  customerId?: string
): Prisma.OrdersWhereInput {
  return {
    ...(customerId ? { CustomerId: customerId } : {}),
    ...(request.status ? { Status: request.status } : {}),
    ...(request.type ? { Type: request.type } : {}),
    ...(request.paymentStatus ? { PaymentStatus: request.paymentStatus } : {}),
    ...(request.fromDate || request.toDate
      ? {
        CreatedAt: {
          ...(request.fromDate ? { gte: new Date(request.fromDate) } : {}),
          ...(request.toDate ? { lte: new Date(request.toDate) } : {})
        }
      }
      : {}),
    ...(request.searchTerm
      ? {
        OR: [
          {
            AspNetUsers_Orders_CustomerIdToAspNetUsers: {
              FullName: { contains: request.searchTerm }
            }
          },
          {
            AspNetUsers_Orders_StaffIdToAspNetUsers: {
              FullName: { contains: request.searchTerm }
            }
          }
        ]
      }
      : {})
  };
}

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly err: I18nErrorHandler
  ) { }

  async getAllOrders(
    request: OrderRequest
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await this.err.wrap(async () => {
      const where = buildOrderWhere(request);
      const skip = (request.PageNumber - 1) * request.PageSize;
      const take = request.PageSize;

      const [orders, totalCount] = await Promise.all([
        this.prisma.orders.findMany({
          where,
          skip,
          take,
          include: orderListInclude
        }),
        this.prisma.orders.count({ where })
      ]);

      const result = new PagedResult<OrderListItemResponse>({
        items: orders.map(mapOrderListItem),
        pageNumber: request.PageNumber,
        pageSize: request.PageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / request.PageSize)
      });
      return { success: true, payload: result };
    }, 'errors.order.fetch_all');
  }

  async getOrderById(orderId: string): Promise<BaseResponseAPI<OrderResponse>> {
    return await this.err.wrap(async () => {
      const order = await this.prisma.orders.findUnique({
        where: { Id: orderId },
        include: orderDetailInclude
      });
      if (!order) {
        return this.err.fail('errors.order.not_found');
      }
      return { success: true, payload: mapOrderFull(order) };
    }, 'errors.order.fetch_detail');
  }

  async getOrdersByUserId(
    userId: string,
    request: OrderRequest
  ): Promise<BaseResponseAPI<PagedResult<OrderListItemResponse>>> {
    return await this.err.wrap(async () => {
      const where = buildOrderWhere(request, userId);
      const skip = (request.PageNumber - 1) * request.PageSize;
      const take = request.PageSize;

      const [orders, totalCount] = await Promise.all([
        this.prisma.orders.findMany({
          where,
          skip,
          take,
          include: orderListInclude
        }),
        this.prisma.orders.count({ where })
      ]);

      const result = new PagedResult<OrderListItemResponse>({
        items: orders.map(mapOrderListItem),
        pageNumber: request.PageNumber,
        pageSize: request.PageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / request.PageSize)
      });
      return { success: true, payload: result };
    }, 'errors.order.fetch_by_user');
  }

  async getOrderDetailsWithOrdersByUserId(
    userId: string
  ): Promise<BaseResponse<OrderResponse[]>> {
    return await this.err.wrap(async () => {
      const orders = await this.prisma.orders.findMany({
        where: { CustomerId: userId },
        include: orderDetailInclude
      });
      return { success: true, data: orders.map(mapOrderFull) };
    }, 'errors.order.fetch_details_with_orders');
  }

  async getOrderReportFromGetOrderDetailsWithOrdersByUserId(
    userId: string
  ): Promise<BaseResponse<string>> {
    return await this.err.wrap(async () => {
      const orders = await this.prisma.orders.findMany({
        where: { CustomerId: userId },
        include: orderDetailInclude
      });
      if (orders.length === 0) {
        return this.err.fail('errors.order.no_orders');
      }
      const report = orders
        .map((o) => {
          const mapped = mapOrderFull(o);
          return `Order ID: ${mapped.id}\nItems:\n${mapped.orderDetails.map((item: OrderDetailResponse) => `- ${item.variantName} (Quantity: ${item.quantity}, Price: ${item.unitPrice})`).join('\n')}\nTotal Amount: ${mapped.totalAmount}\nStatus: ${mapped.orderStatus}\nCreated At: ${mapped.createdAt}\n`;
        })
        .join('\n----------------\n');
      return { success: true, data: report };
    }, 'errors.order.create_report');
  }
}
