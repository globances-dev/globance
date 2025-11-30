import { getSupabaseQueryClient } from './supabase';
import { sendEmail } from './email';

export async function createP2PNotification(
  userId: string,
  type: 'trade_started' | 'payment_sent' | 'released' | 'cancelled' | 'dispute_opened' | 'dispute_resolved',
  title: string,
  message: string,
  data?: any
): Promise<void> {
  try {
    const db = getSupabaseQueryClient();
    
    // Create activity/notification entry
    await db.exec(`
      INSERT INTO earnings_transactions (user_id, amount, type, description)
      VALUES ($1, 0, $2, $3)
    `, [userId, `p2p_${type}`, message]);

  } catch (error) {
    console.error('Error creating P2P notification:', error);
  }
}

export async function sendP2PEmails(
  type: 'trade_started' | 'payment_sent' | 'released' | 'cancelled' | 'dispute_opened' | 'dispute_resolved',
  buyerEmail: string,
  sellerEmail: string,
  data: {
    amount_usdt: number;
    total_fiat: number;
    fiat_currency_code: string;
    trade_id?: string;
    reason?: string;
  }
): Promise<void> {
  const { amount_usdt, total_fiat, fiat_currency_code, trade_id } = data;

  try {
    switch (type) {
      case 'trade_started':
        await sendEmail({
          to: buyerEmail,
          subject: `Trade Started - ${amount_usdt} USDT for ${fiat_currency_code} - Globance P2P`,
          text: `Your P2P trade has started. You have 30 minutes to mark payment as sent. Amount: ${amount_usdt} USDT`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">✓ Trade Started</h2>
              <p>Your P2P trade has been created successfully!</p>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount_usdt} USDT</p>
                <p style="margin: 5px 0;"><strong>Fiat Amount:</strong> ${total_fiat} ${fiat_currency_code}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> Escrow Locked</p>
              </div>
              <p style="color: #dc2626;"><strong>⏰ Important:</strong> You have 30 minutes to mark payment as sent.</p>
            </div>
          `,
        });

        await sendEmail({
          to: sellerEmail,
          subject: `New P2P Trade - ${amount_usdt} USDT - Globance P2P`,
          text: `A buyer has taken your offer. Trade amount: ${amount_usdt} USDT. Waiting for payment confirmation.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">📊 New Trade</h2>
              <p>A buyer has taken your P2P offer!</p>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount_usdt} USDT</p>
                <p style="margin: 5px 0;"><strong>Fiat Amount:</strong> ${total_fiat} ${fiat_currency_code}</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> Waiting for Payment</p>
              </div>
            </div>
          `,
        });
        break;

      case 'payment_sent':
        await sendEmail({
          to: sellerEmail,
          subject: `Payment Received - ${amount_usdt} USDT - Globance P2P`,
          text: `The buyer has marked payment as sent. Please verify and release the crypto to complete the trade.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #10b981;">✓ Payment Marked as Sent</h2>
              <p>The buyer has marked payment as sent for your trade.</p>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Amount:</strong> ${amount_usdt} USDT</p>
              </div>
              <p>Please verify payment and release the crypto to complete the trade.</p>
            </div>
          `,
        });
        break;

      case 'released':
        await sendEmail({
          to: buyerEmail,
          subject: `Trade Completed - ${amount_usdt} USDT Received - Globance P2P`,
          text: `Your P2P trade has been completed! The seller has released ${amount_usdt} USDT to your wallet.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #10b981;">✓ Trade Completed</h2>
              <p>Congratulations! Your P2P trade has been completed successfully.</p>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Amount Received:</strong> ${amount_usdt} USDT</p>
              </div>
              <p>The crypto has been released to your wallet.</p>
            </div>
          `,
        });

        await sendEmail({
          to: sellerEmail,
          subject: `Trade Completed - ${amount_usdt} USDT Released - Globance P2P`,
          text: `Your P2P trade has been completed! You have released ${amount_usdt} USDT and received the fiat payment.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #10b981;">✓ Trade Completed</h2>
              <p>Your P2P trade has been completed successfully.</p>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Amount Released:</strong> ${amount_usdt} USDT</p>
              </div>
              <p>Payment received. Trade closed.</p>
            </div>
          `,
        });
        break;

      case 'dispute_opened':
        await sendEmail({
          to: buyerEmail,
          subject: `Dispute Opened - Trade ${trade_id} - Globance P2P`,
          text: `A dispute has been opened on your trade. Our support team will review and resolve this shortly.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">⚠️ Dispute Opened</h2>
              <p>A dispute has been opened on your trade. Our team will investigate and resolve this.</p>
            </div>
          `,
        });

        await sendEmail({
          to: sellerEmail,
          subject: `Dispute Opened - Trade ${trade_id} - Globance P2P`,
          text: `A dispute has been opened on your trade. Our support team will review and resolve this shortly.`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">⚠️ Dispute Opened</h2>
              <p>A dispute has been opened on your trade. Our team will investigate and resolve this.</p>
            </div>
          `,
        });
        break;
    }
  } catch (error) {
    console.error('Error sending P2P email:', error);
  }
}
