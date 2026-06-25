import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailTask = {
  action?: string;
  due_date?: string | null;
  status?: string | null;
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stripMarkdown(value: string) {
  return value
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .trim();
}

function getReportSummary(report: string, summary?: string) {
  if (summary?.trim()) {
    return summary.trim();
  }

  const cleanReport = stripMarkdown(report || "");
  const firstParagraph = cleanReport
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find(Boolean);

  if (!firstParagraph) {
    return "Le compte rendu de la réunion est disponible dans Briefly.";
  }

  return firstParagraph.length > 420
    ? `${firstParagraph.slice(0, 420).trim()}...`
    : firstParagraph;
}

function buildTextEmail({
  title,
  meetingDate,
  summary,
  participants,
  tasks,
  reportUrl,
}: {
  title: string;
  meetingDate?: string;
  summary: string;
  participants: string[];
  tasks: EmailTask[];
  reportUrl: string;
}) {
  const taskText =
    tasks.length > 0
      ? `\n\nVos tâches :\n${tasks
          .map(
            (task, index) =>
              `${index + 1}. ${task.action || "Tâche sans titre"}\n   Échéance : ${
                task.due_date || "Non renseignée"
              }\n   Statut : ${task.status || "À faire"}`
          )
          .join("\n\n")}`
      : "";

  return `Briefly

${title}
${meetingDate ? `Date : ${meetingDate}` : ""}

${summary}

Participants : ${
    participants.length > 0 ? participants.join(", ") : "Aucun participant renseigné"
  }${taskText}

Consulter le compte rendu :
${reportUrl}`;
}

function buildHtmlEmail({
  title,
  meetingDate,
  summary,
  participants,
  tasks,
  reportUrl,
}: {
  title: string;
  meetingDate?: string;
  summary: string;
  participants: string[];
  tasks: EmailTask[];
  reportUrl: string;
}) {
  const participantItems =
    participants.length > 0
      ? participants
          .map(
            (participant) =>
              `<span style="display:inline-block;margin:0 8px 8px 0;padding:7px 10px;border-radius:999px;background:#f3f4f6;color:#374151;font-size:13px;">${escapeHtml(
                participant
              )}</span>`
          )
          .join("")
      : `<span style="color:#6b7280;font-size:14px;">Aucun participant renseigné</span>`;

  const taskSection =
    tasks.length > 0
      ? `
        <tr>
          <td style="padding:0 32px 28px;">
            <h2 style="margin:0 0 14px;font-size:17px;line-height:1.3;color:#111827;">Vos tâches</h2>
            ${tasks
              .map(
                (task) => `
                  <div style="margin:0 0 12px;padding:16px;border:1px solid #e5e7eb;border-radius:14px;background:#ffffff;">
                    <p style="margin:0 0 10px;font-size:15px;line-height:1.55;color:#111827;">${escapeHtml(
                      task.action || "Tâche sans titre"
                    )}</p>
                    <div style="font-size:13px;line-height:1.5;color:#6b7280;">
                      <span>Échéance : ${escapeHtml(task.due_date || "Non renseignée")}</span>
                      <span style="margin:0 8px;color:#d1d5db;">•</span>
                      <span>Statut : ${escapeHtml(task.status || "À faire")}</span>
                    </div>
                  </div>
                `
              )
              .join("")}
          </td>
        </tr>`
      : "";

  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f6f7f9;font-family:Inter,Arial,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;overflow:hidden;border-radius:22px;background:#ffffff;box-shadow:0 18px 50px rgba(17,24,39,0.08);">
            <tr>
              <td style="padding:30px 32px 22px;border-bottom:1px solid #eef0f3;">
                <div style="margin:0 0 22px;font-size:14px;font-weight:800;letter-spacing:0.02em;color:#111827;">Briefly</div>
                <h1 style="margin:0;font-size:28px;line-height:1.2;color:#111827;">${escapeHtml(
                  title
                )}</h1>
                ${
                  meetingDate
                    ? `<p style="margin:10px 0 0;font-size:14px;color:#6b7280;">${escapeHtml(
                        meetingDate
                      )}</p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:26px 32px 24px;">
                <p style="margin:0;font-size:16px;line-height:1.65;color:#374151;">${escapeHtml(
                  summary
                )}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 26px;">
                <h2 style="margin:0 0 12px;font-size:15px;line-height:1.3;color:#111827;">Participants</h2>
                <div>${participantItems}</div>
              </td>
            </tr>
            ${taskSection}
            <tr>
              <td style="padding:4px 32px 34px;">
                <a href="${escapeHtml(
                  reportUrl
                )}" style="display:block;width:100%;box-sizing:border-box;border-radius:14px;background:#111827;color:#ffffff;text-align:center;text-decoration:none;font-size:16px;font-weight:700;padding:15px 18px;">Consulter le compte rendu</a>
                <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">Ce lien pointera vers la réunion dans Briefly lorsque l’espace partagé sera activé.</p>
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
      emails,
      title,
      report = "",
      subject,
      meetingDate,
      participants = [],
      tasks = [],
      summary,
      ctaUrl,
    } = await request.json();

    if (!emails || emails.length === 0) {
      return Response.json(
        { error: "Aucun destinataire fourni." },
        { status: 400 }
      );
    }

    const emailTitle = title || "Compte rendu de réunion";
    const safeParticipants = Array.isArray(participants)
      ? participants.map((participant) =>
          typeof participant === "string"
            ? participant
            : participant?.name || participant?.email || ""
        ).filter(Boolean)
      : [];
    const safeTasks = Array.isArray(tasks) ? tasks : [];
    const reportUrl =
      ctaUrl ||
      process.env.BRIEFLY_REPORT_URL ||
      process.env.NEXT_PUBLIC_BRIEFLY_REPORT_URL ||
      "https://briefly.app";
    const emailSummary = getReportSummary(report, summary);

    const { data, error } = await resend.emails.send({
      from: "Briefly <onboarding@resend.dev>",
      to: emails,
      subject: subject || `Compte rendu - ${emailTitle}`,
      html: buildHtmlEmail({
        title: emailTitle,
        meetingDate,
        summary: emailSummary,
        participants: safeParticipants,
        tasks: safeTasks,
        reportUrl,
      }),
      text: buildTextEmail({
        title: emailTitle,
        meetingDate,
        summary: emailSummary,
        participants: safeParticipants,
        tasks: safeTasks,
        reportUrl,
      }),
    });

    if (error) {
      console.error(error);
      return Response.json(
        { error: "Erreur pendant l'envoi de l'email." },
        { status: 500 }
      );
    }

    return Response.json({ success: true, data });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Erreur serveur pendant l'envoi de l'email." },
      { status: 500 }
    );
  }
}
