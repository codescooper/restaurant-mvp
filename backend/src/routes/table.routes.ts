import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  createTableSchema,
  updateTableSchema,
  payOrderSchema,
  billRequestSchema,
  mergeTableSchema,
  createReservationSchema,
  updateReservationSchema,
} from '../validators/schemas';
import {
  listTablesController,
  createTableController,
  updateTableController,
  deleteTableController,
  settleTableController,
  billRequestController,
  mergeTableController,
  createReservationController,
  listReservationsController,
  updateReservationController,
  arriveReservationController,
  cancelReservationController,
  honorReservationController,
} from '../controllers/table.controller';

const router = Router();
router.use(authenticate);

const SERVICE = ['serveur', 'caissier', 'administrateur'] as const;
const CAISSE = ['caissier', 'administrateur'] as const;

// Réservations (avant /:id pour éviter toute collision de route)
router.get('/reservations', requireRole(...SERVICE), listReservationsController);
router.post('/reservations', requireRole(...SERVICE), validate(createReservationSchema), createReservationController);
router.put('/reservations/:id', requireRole(...SERVICE), validate(updateReservationSchema), updateReservationController);
router.post('/reservations/:id/arrive', requireRole(...SERVICE), arriveReservationController);
router.patch('/reservations/:id/cancel', requireRole(...SERVICE), cancelReservationController);
router.patch('/reservations/:id/honor', requireRole(...SERVICE), honorReservationController);

// Lecture du plan de salle
router.get('/', requireRole(...SERVICE), listTablesController);

// Demande d'addition (serveur), fusion (caisse), règlement (caisse)
router.patch('/:id/bill-request', requireRole(...SERVICE), validate(billRequestSchema), billRequestController);
router.post('/:id/merge', requireRole(...CAISSE), validate(mergeTableSchema), mergeTableController);
router.post('/:id/settle', requireRole(...CAISSE), validate(payOrderSchema), settleTableController);

// Gestion des tables (CRUD) : admin
router.post('/', requireRole('administrateur'), validate(createTableSchema), createTableController);
router.put('/:id', requireRole('administrateur'), validate(updateTableSchema), updateTableController);
router.delete('/:id', requireRole('administrateur'), deleteTableController);

export default router;
