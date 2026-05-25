import { Role } from '../../constants';

declare global {
  namespace Express {
    interface UserPayload {
      id: number;
      username: string;
      role: Role;
    }
    interface Request {
      user?: UserPayload;
      restaurantId?: number;
      membership?: { restaurantId: number; role: string };
    }
  }
}

export {};
