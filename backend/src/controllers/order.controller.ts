import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { AppError } from '../utils/errors';
import * as orderService from '../services/order.service';
import { ORDER_STATUSES } from '../constants';

export const listOrdersController = asyncHandler(async (req, res) => {
  const statusParam = req.query.status as string | undefined;
  const statuses = statusParam
    ? statusParam.split(',').map((s) => s.trim()).filter((s) => (ORDER_STATUSES as readonly string[]).includes(s))
    : undefined;
  sendSuccess(res, await orderService.listOrders(statuses));
});

export const getOrderController = asyncHandler(async (req, res) => {
  sendSuccess(res, await orderService.getOrder(Number(req.params.id)));
});

export const createOrderController = asyncHandler(async (req, res) => {
  // Le serveur prend la commande mais n'encaisse jamais : règlement à la caisse.
  if (req.user?.role === 'serveur' && req.body.paymentMethod) {
    throw new AppError(403, 'ORDER_005');
  }
  const serverId = req.user?.role === 'serveur' ? req.user.id : undefined;
  const order = await orderService.createOrder({ ...req.body, serverId }, req.user?.id);
  sendSuccess(
    res,
    {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      finalTotal: order.finalTotal,
      createdAt: order.createdAt,
      order,
    },
    201
  );
});

export const updateStatusController = asyncHandler(async (req, res) => {
  const order = await orderService.updateStatus(Number(req.params.id), req.body.status, req.user?.id);
  sendSuccess(res, { success: true, order });
});

export const cancelOrderController = asyncHandler(async (req, res) => {
  const order = await orderService.cancelOrder(
    Number(req.params.id),
    req.body.reason,
    req.user?.id,
    req.user?.role,
    req.body.pin
  );
  sendSuccess(res, order);
});

export const payOrderController = asyncHandler(async (req, res) => {
  const order = await orderService.payOrder(
    Number(req.params.id),
    req.body.paymentMethod,
    req.body.paymentDetails,
    req.user?.id
  );
  sendSuccess(res, order);
});

export const refundOrderController = asyncHandler(async (req, res) => {
  const order = await orderService.refundOrder(
    Number(req.params.id),
    req.body.reason,
    req.user?.id,
    req.user?.role,
    req.body.pin
  );
  sendSuccess(res, order);
});
