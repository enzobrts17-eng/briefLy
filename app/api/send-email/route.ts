import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { emails, title, report } = await request.json();

    if (!emails || emails.length === 0) {
      return Response.json(
        { error: "Aucun destinataire fourni." },
        { status: 400 }
      );
    }

    const { data, error } = await resend.emails.send({
      from: "BriefLy <onboarding@resend.dev>",
      to: emails,
      subject: `Compte rendu - ${title}`,
      text: report,
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