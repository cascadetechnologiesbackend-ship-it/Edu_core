import { db } from "@/db";
import { superAdminUsers } from "@/db/schema/core";
import { eq } from "drizzle-orm";
import { authenticator } from "otplib";
import { encryptData, decryptData } from "@/lib/encryption";
import QRCode from "qrcode";

export interface TotpSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

/**
 * Initiates TOTP setup for a SUPER_ADMIN user.
 * Generates an authenticator secret, encrypts it, stores it in DB (with totpEnabled=false),
 * and returns the QR code data URL for scanning in an authenticator app.
 */
export async function initiateTotpSetup(
  superAdminId: string,
  issuer = "SchoolMitra ERP",
): Promise<TotpSetupResult> {
  const [admin] = await db
    .select({
      id: superAdminUsers.id,
      email: superAdminUsers.email,
    })
    .from(superAdminUsers)
    .where(eq(superAdminUsers.id, superAdminId))
    .limit(1);

  if (!admin) {
    throw new Error("Super Admin user not found");
  }

  const secret = authenticator.generateSecret();
  const encryptedSecret = encryptData(secret);
  const otpauthUrl = authenticator.keyuri(admin.email, issuer, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  await db
    .update(superAdminUsers)
    .set({
      totpSecret: encryptedSecret,
      totpEnabled: false, // Remains disabled until verified with valid code
      updatedAt: new Date(),
    })
    .where(eq(superAdminUsers.id, superAdminId));

  return {
    secret,
    qrCodeDataUrl,
    otpauthUrl,
  };
}

/**
 * Confirms and enables TOTP after verifying a code from the user.
 */
export async function confirmTotpSetup(
  superAdminId: string,
  totpCode: string,
): Promise<boolean> {
  const [admin] = await db
    .select({
      id: superAdminUsers.id,
      totpSecret: superAdminUsers.totpSecret,
    })
    .from(superAdminUsers)
    .where(eq(superAdminUsers.id, superAdminId))
    .limit(1);

  if (!admin || !admin.totpSecret) {
    throw new Error("No pending TOTP setup found for user");
  }

  let secret = admin.totpSecret;
  if (secret.includes(":")) {
    const decrypted = decryptData(secret);
    if (decrypted) secret = decrypted;
  }

  const isValid = authenticator.check(totpCode.trim(), secret);
  if (!isValid) {
    return false;
  }

  await db
    .update(superAdminUsers)
    .set({
      totpEnabled: true,
      updatedAt: new Date(),
    })
    .where(eq(superAdminUsers.id, superAdminId));

  return true;
}
