import crypto from "crypto";

export const generateReferralCode = (): string => {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
  };