import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrevoClient } from '@getbrevo/brevo';
import { otpEmailHtml } from '@/common/templates/otp-email.template';

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);
  private readonly client: BrevoClient;
  private readonly mailFrom: string;

  constructor(private readonly config: ConfigService) {
    this.client = new BrevoClient({
      apiKey: this.config.getOrThrow<string>('BREVO_API_KEY'),
    });
    this.mailFrom =
      this.config.get<string>('MAIL_FROM') ?? 'noreply@vita-link.sn';
  }

  async sendOtp(to: string, firstName: string, code: string): Promise<void> {
    try {
      await this.client.transactionalEmails.sendTransacEmail({
        sender: { name: 'Vita-Link', email: this.mailFrom },
        to: [{ email: to, name: firstName }],
        subject: '🩸 Vita-Link — Votre code de vérification',
        htmlContent: otpEmailHtml(firstName, code),
      });
      this.logger.log(`OTP envoyé à ${to}`);
    } catch (err) {
      this.logger.error(`Échec envoi OTP à ${to}`, err);
      throw err;
    }
  }
}
