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
