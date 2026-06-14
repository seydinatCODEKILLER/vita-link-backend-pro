export const otpEmailHtml = (firstName: string, code: string): string => `
  <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border-radius:12px;border:1px solid #eee">
    <h2 style="color:#C0392B;margin-bottom:8px">🩸 Vita-Link</h2>
    <p style="color:#333">Bonjour <strong>${firstName}</strong>,</p>
    <p style="color:#555">Voici votre code de vérification :</p>
    <div style="font-size:36px;font-weight:700;letter-spacing:10px;color:#C0392B;text-align:center;padding:24px 0">
      ${code}
    </div>
    <p style="color:#888;font-size:13px">Ce code expire dans <strong>10 minutes</strong>. Ne le partagez avec personne.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="color:#aaa;font-size:12px">Vita-Link — Le lien qui sauve, l'honneur qui engage.</p>
  </div>
`;
