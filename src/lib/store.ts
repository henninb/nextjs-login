export interface User {
  id: string;
  email: string;
  passwordHash: string;
  /** Incremented on password change to invalidate existing JWTs. */
  sessionVersion: number;
  createdAt: Date;
}

export interface ResetToken {
  userId: string;
  token: string;
  expiresAt: Date;
}

const users: User[] = [
  {
    id: "seed-0001",
    email: "demo@example.com",
    passwordHash: "$2b$12$38ZSm36tAlB4nBEAqpHlEu5ED4clc9rJ1xFmJt5BWQP9npT6t49.O",
    sessionVersion: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
];
const resetTokens: ResetToken[] = [];

export function getAllUsers(): User[] {
  return users;
}

export function findUserByEmail(email: string): User | undefined {
  return users.find((u) => u.email === email.toLowerCase());
}

export function findUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function createUser(email: string, passwordHash: string): User {
  const user: User = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    passwordHash,
    sessionVersion: 1,
    createdAt: new Date(),
  };
  users.push(user);
  return user;
}

export function updateUserPassword(userId: string, passwordHash: string): boolean {
  const user = users.find((u) => u.id === userId);
  if (!user) return false;
  user.passwordHash = passwordHash;
  user.sessionVersion += 1;
  return true;
}

export function createResetToken(userId: string): string {
  const now = Date.now();
  for (let i = resetTokens.length - 1; i >= 0; i--) {
    if (resetTokens[i].expiresAt.getTime() <= now) {
      resetTokens.splice(i, 1);
    }
  }
  const token = crypto.randomUUID();
  resetTokens.push({
    userId,
    token,
    expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
  });
  return token;
}

export function consumeResetToken(token: string): string | null {
  const index = resetTokens.findIndex(
    (rt) => rt.token === token && rt.expiresAt > new Date()
  );
  if (index === -1) return null;
  const { userId } = resetTokens[index];
  resetTokens.splice(index, 1);
  return userId;
}
