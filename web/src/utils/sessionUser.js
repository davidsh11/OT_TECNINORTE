// Apply the read-only JOSELOS menu update to existing browser sessions too.
export function normalizeSessionUser(user) {
  if (!user || user.role !== "mecanico") return user;
  const username = String(user.username || "").trim().toLowerCase();
  const mechanicId = String(user.mechanicId || "").trim().toUpperCase();
  if (username !== "joselos" && mechanicId !== "JOSELOS") return user;
  return {
    ...user,
    allowedViews: [...new Set([...(user.allowedViews || []), "buscar"])],
    canAssignOt: false
  };
}
