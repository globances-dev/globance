import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateReferralCode = (): string => {
  return crypto.randomBytes(8).toString('hex').toUpperCase().substring(0, 12);
};

export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};
