import QRCode from 'qrcode';

/** 生成二维码 data URL（手机扫码访问用）。 */
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 256,
    color: { dark: '#0b0f17', light: '#ffffff' },
  });
}
