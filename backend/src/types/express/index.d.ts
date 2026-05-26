declare global {
  namespace Express {
    interface Request {
      user?: { id: number; isSuperAdmin: boolean };
      restaurantId?: number;
      membership?: { restaurantId: number; role: string };
    }
  }
}

export {};
