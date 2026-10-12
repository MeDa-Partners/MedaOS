export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  status: string;
}

export interface AuthenticatedSession {
  id: string;
  expiresAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: AuthenticatedSession;
      devUser?: {
        username: string;
        isDeveloper: boolean;
      };
      ventureId?: string;
    }
  }
}
