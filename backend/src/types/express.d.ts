declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        id: string;
        role: "ADMIN_GENERAL" | "ADMIN" | "USER";
        email: string;
      };
    }
  }
}

export {};
