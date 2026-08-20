/**
 * Identity extracted from a verified JWT. Populated by the authentication middleware.
 */
export interface AuthenticatedUser {
  userId: string;
  roles: string[];
}
