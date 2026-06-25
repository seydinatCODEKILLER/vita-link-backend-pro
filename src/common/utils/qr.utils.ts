import QRCode from 'qrcode';
import { customAlphabet } from 'nanoid';

const nanoidAlphaNum = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  4,
);

export const generateDonationCode = (): string => {
  return `VITA-${nanoidAlphaNum()}-${nanoidAlphaNum()}`;
};

export const generateQrCodeBase64 = async (
  donationCode: string,
): Promise<string> => {
  const buffer = await QRCode.toBuffer(donationCode, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400,
    color: { dark: '#C0392B', light: '#FFFFFF' },
  });
  return buffer.toString('base64');
};

export const generateDonationQr = async (): Promise<{
  code: string;
  qrBase64: string;
}> => {
  const code = generateDonationCode();
  const qrBase64 = await generateQrCodeBase64(code);
  return { code, qrBase64 };
};
