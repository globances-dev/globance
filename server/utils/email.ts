import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'support@globance.com';
const APP_URL = process.env.APP_URL || 'https://globance.app';
const FROM_NAME = 'Globance Support';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    if (!SENDGRID_API_KEY) {
      console.log('[DEV] Email would be sent to:', options.to, 'Subject:', options.subject);
      return true;
    }

    console.log('[EMAIL] Sending to:', options.to, 'Subject:', options.subject, 'From:', SENDGRID_FROM_EMAIL);

    await sgMail.send({
      to: options.to,
      from: { email: SENDGRID_FROM_EMAIL, name: FROM_NAME },
      subject: options.subject,
      text: options.text,
      html: options.html || options.text,
    });

    console.log('[EMAIL] ✓ Successfully sent to:', options.to, 'Subject:', options.subject);
    return true;
  } catch (error: any) {
    console.error('[EMAIL ERROR] Failed to send email to:', options.to);
    console.error('[EMAIL ERROR] Error code:', error.code);
    console.error('[EMAIL ERROR] Full error:', JSON.stringify(error, null, 2));
    if (error.response?.body?.errors) {
      console.error('[EMAIL ERROR] SendGrid errors:', error.response.body.errors);
    }
    return false;
  }
};

export const sendRegistrationEmail = async (email: string, name: string) => {
  return sendEmail({
    to: email,
    subject: 'Welcome to Globance',
    text: `Welcome ${name}!\n\nYour Globance account has been created successfully. Start earning daily returns from cloud mining packages today!\n\nLogin here: ${APP_URL}/login`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Globance</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 20px 0; font-size: 16px;">Hi ${name},</p>
          <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Your Globance account has been created successfully. Start earning daily returns from cloud mining packages today!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/login" style="background-color: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Login to Your Account</a>
          </div>
          <p style="margin: 20px 0 0 0; font-size: 13px; color: #6b7280;">Questions? Contact our support team anytime.</p>
        </div>
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
          <p style="margin: 0;">© 2025 Globance. All rights reserved.</p>
        </div>
      </div>
    `,
  });
};

export const sendPasswordResetEmail = async (email: string, resetLink: string) => {
  return sendEmail({
    to: email,
    subject: 'Reset your Globance password',
    text: `Click the link to reset your password: ${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">You requested to reset your Globance password. Click the button below to create a new password.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Reset Password</a>
          </div>
          <p style="margin: 20px 0 0 0; font-size: 13px; color: #6b7280; line-height: 1.5;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
          <p style="margin: 0;">© 2025 Globance. All rights reserved.</p>
        </div>
      </div>
    `,
  });
};

export const sendDepositConfirmationEmail = async (
  email: string,
  amount: number,
  network: string
) => {
  return sendEmail({
    to: email,
    subject: `Your deposit is confirmed`,
    text: `Your deposit of ${amount} USDT on ${network} has been confirmed and credited to your Globance wallet.\n\nYou can now invest in cloud mining packages to start earning daily returns.\n\nView packages: ${APP_URL}/packages`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">✓ Deposit Confirmed</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Your deposit has been successfully confirmed and credited to your Globance wallet.</p>
          <div style="background-color: #ecfdf5; padding: 20px; border-radius: 6px; border: 1px solid #d1fae5; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount} USDT</p>
            <p style="margin: 5px 0;"><strong>Network:</strong> ${network}</p>
          </div>
          <p style="margin: 20px 0; font-size: 15px; line-height: 1.6;">You can now invest in cloud mining packages to start earning daily returns!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/packages" style="background-color: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">View Mining Packages</a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
          <p style="margin: 0;">© 2025 Globance. All rights reserved.</p>
        </div>
      </div>
    `,
  });
};

export const sendWithdrawalNotificationEmail = async (
  email: string,
  amount: number,
  status: 'requested' | 'approved' | 'executed' | 'completed' | 'rejected',
  txid?: string
) => {
  const netAmount = amount - 1; // 1 USDT fee
  const fee = 1;

  if (status === 'rejected') {
    return sendEmail({
      to: email,
      subject: `Withdrawal Request Rejected`,
      text: `Your withdrawal request for ${amount} USDT has been rejected. The full amount has been refunded to your wallet balance.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Withdrawal Rejected</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Your withdrawal request has been rejected. The full amount has been refunded to your wallet balance.</p>
            <div style="background-color: #fef2f2; padding: 20px; border-radius: 6px; border: 1px solid #fecaca; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount} USDT (Refunded)</p>
            </div>
            <p style="margin: 20px 0 0 0; font-size: 13px; color: #6b7280; line-height: 1.5;">If you have questions, please contact support.</p>
          </div>
          <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
            <p style="margin: 0;">© 2025 Globance. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }

  if (status === 'executed' || status === 'completed') {
    return sendEmail({
      to: email,
      subject: `Your withdrawal is completed`,
      text: `Your withdrawal has been executed successfully.\n\nAmount Requested: ${amount} USDT\nPlatform Fee: ${fee} USDT\nNet Amount Sent: ${netAmount} USDT\nTransaction ID: ${txid || 'N/A'}\n\nYour funds have been sent to your wallet address.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✓ Withdrawal Completed</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Your withdrawal from Globance has been executed successfully.</p>
            <div style="background-color: #ecfdf5; padding: 20px; border-radius: 6px; border: 1px solid #d1fae5; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Amount Requested:</strong> ${amount} USDT</p>
              <p style="margin: 5px 0;"><strong>Platform Fee:</strong> ${fee} USDT</p>
              <p style="margin: 5px 0; color: #10b981;"><strong>Net Amount Sent:</strong> ${netAmount} USDT</p>
              ${txid ? `<p style="margin: 5px 0; font-size: 12px;"><strong>Transaction ID:</strong> ${txid}</p>` : ''}
            </div>
            <p style="margin: 20px 0 0 0; font-size: 13px; color: #6b7280; line-height: 1.5;">Your funds have been sent to your wallet address. Please check your wallet to confirm receipt.</p>
          </div>
          <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
            <p style="margin: 0;">© 2025 Globance. All rights reserved.</p>
          </div>
        </div>
      `,
    });
  }

  const statusDisplayName = status === 'approved' ? 'approved' : status === 'requested' ? 'received' : 'processed';
  return sendEmail({
    to: email,
    subject: `Withdrawal ${statusDisplayName}`,
    text: `Your withdrawal request for ${amount} USDT has been ${statusDisplayName} and is being processed.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Withdrawal ${statusDisplayName.charAt(0).toUpperCase() + statusDisplayName.slice(1)}</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Your withdrawal request for ${amount} USDT has been ${statusDisplayName} and is being processed.</p>
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 6px; border: 1px solid #bfdbfe; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount} USDT</p>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
          <p style="margin: 0;">© 2025 Globance. All rights reserved.</p>
        </div>
      </div>
    `,
  });
};

export const sendMiningPackagePurchaseEmail = async (
  email: string,
  amount: number,
  dailyReturn: number,
  packageDuration?: string
) => {
  return sendEmail({
    to: email,
    subject: 'Mining package activated',
    text: `Your mining package has been activated!\n\nInvestment: ${amount} USDT\nDaily Return: ${dailyReturn}%\n\nStart earning daily returns from cloud mining today!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Mining Package Activated</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Congratulations! Your mining package has been successfully activated and is now earning daily returns.</p>
          <div style="background-color: #eff6ff; padding: 20px; border-radius: 6px; border: 1px solid #bfdbfe; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Investment Amount:</strong> ${amount} USDT</p>
            <p style="margin: 5px 0;"><strong>Daily Return:</strong> ${dailyReturn}%</p>
            ${packageDuration ? `<p style="margin: 5px 0;"><strong>Duration:</strong> ${packageDuration}</p>` : ''}
          </div>
          <p style="margin: 20px 0; font-size: 15px; line-height: 1.6;">Your earnings will be calculated and added to your wallet daily.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/home" style="background-color: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">View Your Account</a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
          <p style="margin: 0;">© 2025 Globance. All rights reserved.</p>
        </div>
      </div>
    `,
  });
};

export const sendReferralRewardEmail = async (
  email: string,
  amount: number,
  referrerName: string,
  level: number
) => {
  const levelName = level === 1 ? 'Level 1' : level === 2 ? 'Level 2' : 'Level 3';
  return sendEmail({
    to: email,
    subject: 'You earned a referral reward',
    text: `You earned ${amount} USDT from a ${levelName} referral!\n\nCongratulations on growing your network at Globance.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Referral Reward Earned</h1>
        </div>
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
          <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6;">Great news! You earned a referral reward from your network.</p>
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 6px; border: 1px solid #fcd34d; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Reward Amount:</strong> +${amount} USDT</p>
            <p style="margin: 5px 0;"><strong>Reward Level:</strong> ${levelName}</p>
          </div>
          <p style="margin: 20px 0; font-size: 15px; line-height: 1.6;">The amount has been credited to your wallet. Keep growing your referral network to earn more rewards!</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/referral" style="background-color: #2563eb; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">View Referral Stats</a>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; font-size: 12px; color: #9ca3af;">
          <p style="margin: 0;">© 2025 Globance. All rights reserved.</p>
        </div>
      </div>
    `,
  });
};
