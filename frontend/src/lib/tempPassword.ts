/**
 * Normalizes a role or designation into a clean PascalCase prefix for initial passwords.
 * e.g., "TEACHER" -> "Teacher", "PARENT" -> "Parent", "DRIVER" -> "Driver",
 * "ACCOUNTANT" -> "Accountant", "SCHOOL_ADMIN" -> "Admin", "LIBRARIAN" -> "Librarian"
 */
export function formatRolePrefix(role: string): string {
  if (!role) return "Staff";
  const normalized = role.trim().toUpperCase();
  switch (normalized) {
    case "TEACHER":
      return "Teacher";
    case "PARENT":
      return "Parent";
    case "DRIVER":
      return "Driver";
    case "ACCOUNTANT":
      return "Accountant";
    case "SCHOOL_ADMIN":
    case "SUPER_ADMIN":
      return "Admin";
    case "PRINCIPAL":
      return "Principal";
    case "LIBRARIAN":
      return "Librarian";
    case "TRANSPORT_MANAGER":
      return "Transport";
    case "STUDENT":
      return "Student";
    case "STAFF":
      return "Staff";
    default: {
      const words = role.split(/[\s_-]+/);
      const titleCase = words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("");
      return titleCase || "Staff";
    }
  }
}

/**
 * Generates dynamic initial password in the format: <Role>@<last 4 digits of mobile>
 * e.g., Parent@3210, Teacher@3210, Driver@3210, Accountant@3210.
 * Falls back to "1234" if mobile has fewer than 4 digits.
 */
export function generateRoleTempPassword(role: string, mobile?: string | null): string {
  const rolePrefix = formatRolePrefix(role);
  const digits = (mobile || "").replace(/\D/g, "");
  const last4 = digits.length >= 4 ? digits.slice(-4) : "1234";
  return `${rolePrefix}@${last4}`;
}

/**
 * Retained for backwards compatibility where a purely random 8-character password is required.
 */
export function generateRandomTempPassword(): string {
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowers = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const specials = "!@#$%";
  const chars = uppers + lowers + digits + specials;
  const pwd = [
    uppers[Math.floor(Math.random() * uppers.length)],
    lowers[Math.floor(Math.random() * lowers.length)],
    digits[Math.floor(Math.random() * digits.length)],
    specials[Math.floor(Math.random() * specials.length)],
  ];
  for (let i = 0; i < 4; i++) {
    pwd.push(chars[Math.floor(Math.random() * chars.length)]);
  }
  return pwd.sort(() => Math.random() - 0.5).join("");
}
