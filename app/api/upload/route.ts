import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("audio");
    const participants = formData.get("participants");
    const employeesRaw = formData.get("employees") as string | null;

const employees = employeesRaw
  ? JSON.parse(employeesRaw)
  : [];

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Aucun fichier audio reçu." },
        { status: 400 }
      );
    }

    const selectedParticipants =
      typeof participants === "string"
        ? participants
        : "Aucun participant sélectionné";

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
    });

    const transcriptionText = transcription.text.trim();
    const today = new Date();
    const referenceDate = today.toISOString().slice(0, 10);
    const referenceWeekday = new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      timeZone: "Europe/Paris",
    }).format(today);

    if (
      !transcriptionText ||
      transcriptionText.length < 20 ||
      transcriptionText.includes("Merci d'avoir regardé") ||
      transcriptionText.includes("Sous-titres réalisés") ||
      transcriptionText.includes("Abonnez-vous")
    ) {
      return Response.json(
        { error: "Aucune parole exploitable détectée dans l'enregistrement." },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
Tu es un assistant spécialisé dans les comptes rendus de réunion professionnels.

Priorité absolue : fidélité à la transcription.
Tu ne dois jamais inventer, compléter, extrapoler ou supposer une information absente.
Si un sujet n'a pas été évoqué, ne crée pas de contenu artificiel. Omet la section correspondante, ou écris explicitement "Aucun élément n'a été évoqué durant la réunion" uniquement si cette précision aide la lecture.

Analyse la transcription et retourne uniquement un JSON valide avec cette structure exacte :

{
  "title": "Titre court de la réunion",
  "report": "# Résumé exécutif\n...\n# Points clés\n...\n# Décisions prises\n...\n# Risques ou points à clarifier\n...",
  "tasks": [
    {
      "action": "Action courte, précise et directement actionnable",
      "responsible": "Nom du responsable si identifiable",
      "responsible_employee_id": 1,
      "due_date": "YYYY-MM-DD ou null"
    }
  ]
}

Règles de rédaction du compte rendu :
- Le titre contient moins de 8 mots et reste fidèle au sujet réellement évoqué.
- Le compte rendu est en français professionnel, naturel et lisible.
- Préfère des formulations comme "Cette réunion avait pour objectif..." ou "Les échanges ont principalement porté sur..." quand cela correspond à la transcription.
- Le résumé exécutif doit synthétiser les informations réellement discutées.
- Retourne le compte rendu en Markdown.
- Utilise "# Résumé exécutif" dans tous les cas.
- Ajoute uniquement les sections utiles parmi : "# Points clés", "# Décisions prises", "# Risques ou points à clarifier", "# Questions ouvertes", "# Prochaines étapes".
- N'ajoute pas une section vide.
- Ne jamais inclure une section "Actions à réaliser" dans le compte rendu : les tâches sont affichées séparément dans l'application.
- Ne répète pas les tâches mot pour mot dans le compte rendu.
- Pour les décisions, risques, budget, blocages, questions ouvertes et prochaines étapes : mentionne seulement ce qui a réellement été évoqué.

Règles d'extraction des tâches :
- Liste uniquement les vraies actions clairement mentionnées dans la réunion.
- Si aucune action n'est identifiable, retourne [].
- Reformule chaque tâche pour qu'elle soit précise, courte et directement actionnable.
- Ne crée jamais une tâche implicite ou probable.
- Ne regroupe pas plusieurs actions différentes dans une seule tâche.
- Conserve le responsable et l'échéance uniquement s'ils sont identifiables dans la transcription ou par correspondance fiable avec les collaborateurs.
- Toute échéance dans tasks.due_date doit être convertie en YYYY-MM-DD. Ne retourne jamais "demain", "vendredi", "fin du mois" ou une autre expression textuelle dans due_date.

Attribution des responsables :
Pour chaque tâche, attribue responsible_employee_id uniquement si tu es suffisamment certain du collaborateur concerné.
Utilise la liste des collaborateurs disponibles, leur nom, leur email et leur poste pour choisir le bon identifiant.

Pour déterminer le responsable :
1. Cherche d'abord un prénom, un nom ou un nom complet explicitement cité dans la transcription.
2. Si plusieurs collaborateurs correspondent au même prénom ou nom, utilise leur poste et le contenu de la tâche pour choisir le plus cohérent.
3. Si aucun nom n'est cité, attribue la tâche au collaborateur dont le rôle est le plus adapté uniquement si la correspondance est très claire.
4. Si le score de confiance est inférieur à 60, mets responsible à null et responsible_employee_id à null.

Barème de confiance :
- 90 à 100 : nom complet clairement cité ou prénom/nom sans ambiguïté avec rôle cohérent.
- 70 à 89 : prénom ou nom cité, départagé par le rôle ou le contexte.
- 60 à 69 : aucun nom cité, mais rôle très clairement adapté à la tâche.
- 0 à 59 : doute, ambiguïté ou rôle insuffisamment cohérent.

N'invente jamais d'identifiant.

Gestion des échéances :
La date de référence de la réunion est ${referenceDate} (${referenceWeekday}).

Pour chaque tâche, due_date doit être :
- une date ISO au format YYYY-MM-DD si une échéance est détectée ;
- null si aucune échéance n'est détectée.

Convertis les échéances relatives en date ISO avec la date de référence :
- "aujourd'hui" = ${referenceDate}
- "demain" = le jour suivant la date de référence
- un jour de semaine cité, par exemple "vendredi", = le prochain jour correspondant après ou égal à la date de référence
- "lundi prochain" = le prochain lundi strictement après la semaine courante
- "dans une semaine" = date de référence + 7 jours
- "avant la fin du mois" = dernier jour du mois de la date de référence

N'invente jamais d'échéance. Si la transcription ne contient pas d'indice temporel clair pour la tâche, mets due_date à null.
Collaborateurs disponibles dans l'entreprise :

${JSON.stringify(employees, null, 2)}

IMPORTANT :

Chaque collaborateur possède un identifiant unique (id).

Lorsqu'une action est attribuée à une personne, tu dois retourner :
- responsible : le nom détecté
- responsible_employee_id : l'identifiant exact du collaborateur

Pour déterminer la bonne personne, utilise dans cet ordre :

1. Nom complet exact
2. Prénom + poste
3. Prénom + email
4. Cohérence entre la tâche et le poste

Si plusieurs personnes correspondent et qu'il y a un doute, mets responsible à null et responsible_employee_id à null.

Si aucun nom n'est cité, tu peux attribuer selon le rôle uniquement si la tâche correspond clairement au poste avec un score supérieur ou égal à 60.

Ne jamais inventer un identifiant.

Participants présents sélectionnés dans l'application :

${selectedParticipants}

Transcription de la réunion :

${transcriptionText}
`,
        },
      ],
    });

    const content = completion.choices[0].message.content || "{}";
    const result = JSON.parse(content);

    return Response.json({
  title: result.title || "Réunion sans titre",
  report: result.report || "Aucun compte rendu généré.",
  tasks: result.tasks || [],
});
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Erreur pendant la génération du compte rendu." },
      { status: 500 }
    );
  }
}
