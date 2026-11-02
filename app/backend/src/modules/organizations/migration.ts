import mongoose from "mongoose";

export type LegacyUserRow = { _id: unknown; email: unknown; organizationId?: unknown; role?: unknown };

export function inspectLegacyUsers(users: LegacyUserRow[]) {
  const legacyUsers = users.filter((user) => user.organizationId !== undefined || user.role !== undefined);
  const invalidLegacyUsers = legacyUsers.filter((user) => !mongoose.isValidObjectId(user.organizationId) || !["admin", "dispatcher", "driver"].includes(String(user.role)) || typeof user.email !== "string" || !user.email.trim());
  const emailCounts = new Map<string, number>();
  for (const user of users) if (typeof user.email === "string") {
    const normalized = user.email.trim().toLowerCase();
    emailCounts.set(normalized, (emailCounts.get(normalized) ?? 0) + 1);
  }
  const duplicateEmailGroups = [...emailCounts.values()].filter((count) => count > 1).length;
  return { legacyUsers, invalidLegacyUsers, duplicateEmailGroups };
}
