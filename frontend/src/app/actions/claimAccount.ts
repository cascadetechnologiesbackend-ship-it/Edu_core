"use server";

import { verifyAndClaimParentAccount } from "@schoolmitra/backend/lib/parentLinkage";
import { verifyAndClaimStudentAccount } from "@schoolmitra/backend/lib/studentAccess";
import { getClientRequestContext } from "@/lib/requestContext";

export async function claimParentAccountAction(data: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}) {
  try {
    const { token, newPassword, confirmPassword } = data;
    if (!token || !token.trim()) {
      return { success: false, message: "Claim token is missing. Please use the valid claim link." };
    }
    if (!newPassword || newPassword.length < 8) {
      return { success: false, message: "Password must be at least 8 characters long." };
    }
    if (!/[A-Z]/.test(newPassword)) {
      return { success: false, message: "Password must contain at least one uppercase letter." };
    }
    if (!/[0-9]/.test(newPassword)) {
      return { success: false, message: "Password must contain at least one number." };
    }
    if (newPassword !== confirmPassword) {
      return { success: false, message: "Passwords do not match." };
    }

    const reqCtx = getClientRequestContext();
    const result = await verifyAndClaimParentAccount({
      token: token.trim(),
      newPassword,
      ipAddress: reqCtx.ipAddress,
      userAgent: reqCtx.userAgent,
    });

    return {
      success: true,
      email: result.email,
      userId: result.userId,
      message: result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to verify and claim parent account.",
    };
  }
}

export async function claimStudentAccountAction(data: {
  admissionNumber: string;
  dateOfBirth: string;
  token: string;
  newPassword: string;
  confirmPassword: string;
}) {
  try {
    const { admissionNumber, dateOfBirth, token, newPassword, confirmPassword } = data;
    if (!token || !token.trim()) {
      return { success: false, message: "Claim token is missing. Please use the valid claim link." };
    }
    if (!admissionNumber || !admissionNumber.trim()) {
      return { success: false, message: "Admission number is required." };
    }
    if (!dateOfBirth) {
      return { success: false, message: "Date of birth is required for verification." };
    }
    if (!newPassword || newPassword.length < 8) {
      return { success: false, message: "Password must be at least 8 characters long." };
    }
    if (!/[A-Z]/.test(newPassword)) {
      return { success: false, message: "Password must contain at least one uppercase letter." };
    }
    if (!/[0-9]/.test(newPassword)) {
      return { success: false, message: "Password must contain at least one number." };
    }
    if (newPassword !== confirmPassword) {
      return { success: false, message: "Passwords do not match." };
    }

    const reqCtx = getClientRequestContext();
    const result = await verifyAndClaimStudentAccount({
      admissionNumber: admissionNumber.trim(),
      dateOfBirth,
      claimToken: token.trim(),
      newPassword,
      ipAddress: reqCtx.ipAddress,
      userAgent: reqCtx.userAgent,
    });

    return {
      success: true,
      userId: result.userId,
      email: result.email,
      message: result.message,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to verify and claim student account.",
    };
  }
}
