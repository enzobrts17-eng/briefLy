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
Tu es un assistant spécialisé dans les comptes rendus de réunion.

Analyse la transcription et retourne uniquement un JSON valide avec cette structure exacte :

{
  "title": "Titre court de la réunion",
  "report": "# Résumé exécutif\n...\n# Points clés\n...\n# Décisions prises\n...\n# Actions à réaliser\n...\n# Risques ou points à clarifier\n...",
  "tasks": [
  {
    "action": "Action à réaliser",
    "responsible": "Nom du responsable si identifiable",
    "responsible_employee_id": 1,
    "responsible_confidence": 85,
    "due_date": "Échéance si identifiable"
  }
]
}
Pour chaque tâche, attribue responsible_employee_id uniquement si le score de confiance est supérieur ou égal à 60.

Ajoute toujours responsible_confidence avec un entier de 0 à 100.

Utilise la liste des collaborateurs disponibles, leur nom, leur email et leur poste pour choisir le bon identifiant.

Pour déterminer le responsable :

1. Cherche d'abord un prénom, un nom ou un nom complet explicitement cité dans la transcription.
2. Si plusieurs collaborateurs correspondent au même prénom ou nom, utilise leur poste et le contenu de la tâche pour choisir le plus cohérent.
3. Si aucun nom n'est cité, attribue la tâche au collaborateur dont le rôle est le plus adapté à l'action.
4. Si le score de confiance est inférieur à 60, mets responsible à null et responsible_employee_id à null.

Barème de confiance :
- 90 à 100 : nom complet clairement cité ou prénom/nom sans ambiguïté avec rôle cohérent.
- 70 à 89 : prénom ou nom cité, départagé par le rôle ou le contexte.
- 60 à 69 : aucun nom cité, mais rôle très clairement adapté à la tâche.
- 0 à 59 : doute, ambiguïté ou rôle insuffisamment cohérent.

N'invente jamais d'identifiant.

Règles :

- Le titre doit contenir moins de 8 mots.
- Le titre ne doit pas inventer de sujet.
- Le compte rendu doit être en français professionnel.
- Le compte rendu doit être détaillé et structuré.
- Chaque section est obligatoire.
- Même si peu d'informations sont disponibles, remplis chaque section.
- Ne retourne jamais un simple paragraphe.
- Retourne le compte rendu en Markdown.

Le champ "report" doit toujours contenir :

# Résumé exécutif

# Points clés

# Décisions prises

# Risques ou points à clarifier

IMPORTANT :
Ne jamais inclure une section "Actions à réaliser".
Les actions seront affichées séparément dans l'interface utilisateur.
Ne pas répéter les tâches dans le compte rendu.

Si la réunion est très courte (moins de 3 décisions ou actions),
génère uniquement :

# Résumé exécutif
# Décisions prises

Évite les sections inutiles.

Le champ "tasks" sert uniquement à extraire les actions sous forme de données.

Ne réduis jamais le compte rendu parce que des tâches existent.

Dans "tasks", liste uniquement les vraies actions clairement mentionnées dans la réunion.

Si aucune action n'est identifiable, retourne :

[]

N'invente jamais :
- d'action
- de responsable
- d'échéance

Dans la section "# Actions à réaliser", chaque action doit obligatoirement commencer par le nom de la personne responsable lorsqu'elle est mentionnée.

Conserve les noms des personnes et les échéances mentionnées dans la transcription.

Ne transforme jamais une action attribuée à une personne en action anonyme.

Ne regroupe pas plusieurs actions ensemble.

Si une personne responsable est mentionnée, indique son prénom ou son nom.

Si une échéance est mentionnée, indique-la.

N’invente jamais de personne, d’échéance ou d’action.

Dans la section "# Décisions prises", ne place que les décisions réellement prises pendant la réunion.

Dans la section "# Actions à réaliser", ne place que les actions futures à effectuer.

Les informations présentes dans "# Décisions prises" et "# Actions à réaliser" ne doivent pas être dupliquées mot pour mot.
Collaborateurs disponibles dans l'entreprise :

${JSON.stringify(employees, null, 2)}

IMPORTANT :

Chaque collaborateur possède un identifiant unique (id).

Lorsqu'une action est attribuée à une personne, tu dois retourner :
- responsible : le nom détecté
- responsible_employee_id : l'identifiant exact du collaborateur
- responsible_confidence : score entier de confiance entre 0 et 100

Pour déterminer la bonne personne, utilise dans cet ordre :

1. Nom complet exact
2. Prénom + poste
3. Prénom + email
4. Cohérence entre la tâche et le poste

Si plusieurs personnes correspondent et qu'il y a un doute, mets responsible à null, responsible_employee_id à null et responsible_confidence sous 60.

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
