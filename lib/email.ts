import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const EMAIL_FROM = process.env.EMAIL_FROM || 'max@rollingsudsnyct.net';
const EMAIL_SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'Max Gelfman';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'max.gelfman@rollingsuds.com';
const EMAIL_CC = process.env.EMAIL_CC || 'max.gelfman@rollingsuds.com';

// Always CC'd on all invoice and photo emails
const PERMANENT_CC = 'deannedra.hamilton@gosuperclean.com';

interface Attachment {
  name: string;
  contentType: string;
  base64: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  attachments: Attachment[];
}

/**
 * Send an email via Resend
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { error } = await resend.emails.send({
    from: `${EMAIL_SENDER_NAME} <${EMAIL_FROM}>`,
    replyTo: EMAIL_REPLY_TO || undefined,
    to: [options.to],
    cc: [
      ...(EMAIL_CC ? EMAIL_CC.split(',').map((e) => e.trim()).filter(Boolean) : []),
      PERMANENT_CC,
    ],
    subject: options.subject,
    html: options.body,
    attachments: options.attachments.map((att) => ({
      filename: att.name,
      content: Buffer.from(att.base64, 'base64'),
    })),
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

/**
 * Check if Resend is configured
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
