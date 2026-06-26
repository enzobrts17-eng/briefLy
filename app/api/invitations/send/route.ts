import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildInvitationText({
  firstName,
  organizationName,
  inviterName,
  inviteUrl,
}: {
  firstName: string;
  organizationName: string;
  inviterName: string;
  inviteUrl: string;
}) {
  return `Briefly

Bonjour ${firstName || ""},

${inviterName} vous invite à rejoindre l’espace ${organizationName} sur Briefly.

Rejoindre Briefly :
${inviteUrl}

Cette invitation expire automatiquement.`;
}

function buildInvitationHtml({
  firstName,
  organizationName,
  inviterName,
  inviteUrl,
}: {
  firstName: string;
  organizationName: string;
  inviterName: string;
  inviteUrl: string;
}) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invitation Briefly</title>
  </head>
  <body style="margin:0;background:#f6f7f9;font-family:Inter,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-radius:24px;background:#ffffff;box-shadow:0 18px 50px rgba(17,24,39,0.08);overflow:hidden;">
            <tr>
              <td style="padding:32px 34px 20px;border-bottom:1px solid #eef0f3;">
                <div style="display:inline-flex;align-items:center;gap:10px;margin:0 0 24px;font-size:15px;font-weight:800;color:#111827;">
                  <span style="display:inline-block;width:30px;height:30px;border-radius:10px;background:#111827;color:#ffffff;text-align:center;line-height:30px;">B</span>
                  Briefly
                </div>
                <h1 style="margin:0;font-size:28px;line-height:1.2;color:#111827;">Rejoignez ${escapeHtml(
                  organizationName
                )}</h1>
                <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#6b7280;">${escapeHtml(
                  inviterName
                )} vous invite à collaborer sur Briefly.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 34px 8px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#374151;">Bonjour ${escapeHtml(
                  firstName
                )},</p>
                <p style="margin:0;font-size:16px;line-height:1.65;color:#374151;">Votre espace de travail est prêt. Créez votre compte ou connectez-vous pour rejoindre automatiquement l’organisation.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 34px 34px;">
                <a href="${escapeHtml(
                  inviteUrl
                )}" style="display:block;border-radius:15px;background:#111827;color:#ffffff;text-align:center;text-decoration:none;font-size:16px;font-weight:700;padding:15px 18px;">Rejoindre Briefly</a>
                <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">Cette invitation est personnelle et expire automatiquement.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const {
      email,
      firstName = "",
      lastName = "",
      organizationName = "votre entreprise",
      inviterName = "Un administrateur",
      inviteUrl,
    } = await request.json();

    if (!email || !inviteUrl) {
      return Response.json(
        { error: "Email ou lien d’invitation manquant." },
        { status: 400 }
      );
    }

    if (!process.env.RESEND_API_KEY) {
      return Response.json(
        { error: "Configuration Resend manquante." },
        { status: 500 }
      );
    }

    const recipientName = [firstName, lastName].filter(Boolean).join(" ");
    const subject = `${inviterName} vous invite sur Briefly`;

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Briefly <onboarding@resend.dev>",
      to: [email],
      subject,
      text: buildInvitationText({
        firstName: recipientName || firstName,
        organizationName,
        inviterName,
        inviteUrl,
      }),
      html: buildInvitationHtml({
        firstName: recipientName || firstName,
        organizationName,
        inviterName,
        inviteUrl,
      }),
    });

    if (error) {
      console.error("Erreur Resend invitation:", error);
      return Response.json({ error }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (error) {
    console.error("Erreur route invitation:", error);
    return Response.json(
      { error: "Impossible d’envoyer l’invitation." },
      { status: 500 }
    );
  }
}
