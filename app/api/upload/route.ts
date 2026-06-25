import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type GeneratedTask = {
  action: string;
  responsible: string | null;
  responsible_employee_id: number | null;
  due_date: string | null;
};

type ReportSection = {
  title: string;
  content: string[];
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeLines(lines: string[]) {
  const seen = new Set<string>();

  return lines.filter((line, index) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return Boolean(index > 0 && lines[index - 1]?.trim());
    }

    const normalizedLine = normalizeText(
      trimmedLine.replace(/^[-*•]\s*/, "")
    );

    if (!normalizedLine) {
      return false;
    }

    if (seen.has(normalizedLine)) {
      return false;
    }

    seen.add(normalizedLine);
    return true;
  });
}

function isTaskSection(title: string) {
  const normalizedTitle = normalizeText(title);

  return (
    normalizedTitle.includes("tache") ||
    normalizedTitle.includes("action a realiser") ||
    normalizedTitle.includes("actions a realiser")
  );
}

function sanitizeReport(report: unknown) {
  const rawReport = cleanText(report);

  if (!rawReport) {
    return "# Résumé exécutif\nAucun élément exploitable n’a été identifié dans la transcription.";
  }

  const sections: ReportSection[] = [];
  let currentTitle = "Résumé exécutif";
  let currentContent: string[] = [];

  rawReport.split("\n").forEach((line) => {
    const headingMatch = line.match(/^#\s+(.+)$/);

    if (headingMatch) {
      if (currentContent.join("").trim()) {
        sections.push({
          title: currentTitle,
          content: currentContent,
        });
      }

      currentTitle = headingMatch[1].trim();
      currentContent = [];
      return;
    }

    currentContent.push(line);
  });

  if (currentContent.join("").trim()) {
    sections.push({
      title: currentTitle,
      content: currentContent,
    });
  }

  const cleanedSections = sections
    .map((section) => ({
      title: section.title,
      content: dedupeLines(section.content).join("\n").trim(),
    }))
    .filter((section) => {
      return section.title && section.content && !isTaskSection(section.title);
    });

  if (cleanedSections.length === 0) {
    return "# Résumé exécutif\nAucun élément exploitable n’a été identifié dans la transcription.";
  }

  const hasExecutiveSummary = cleanedSections.some((section) =>
    normalizeText(section.title).includes("resume executif")
  );

  const firstSection = cleanedSections[0];
  const normalizedSections = hasExecutiveSummary
    ? cleanedSections
    : [
        {
          title: "Résumé exécutif",
          content: firstSection.content,
        },
        ...cleanedSections.slice(1),
      ];

  return normalizedSections
    .map((section) => `# ${section.title}\n${section.content}`)
    .join("\n\n")
    .trim();
}

function sanitizeDueDate(value: unknown) {
  const dueDate = cleanText(value);

  return /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null;
}

function sanitizeEmployeeId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}

function sanitizeTasks(tasks: unknown): GeneratedTask[] {
  if (!Array.isArray(tasks)) {
    return [];
  }

  const seenTasks = new Set<string>();

  return tasks
    .map((task) => {
      if (!task || typeof task !== "object") {
        return null;
      }

      const taskRecord = task as Record<string, unknown>;
      const action = cleanText(taskRecord.action);

      if (!action) {
        return null;
      }

      const responsible = cleanText(taskRecord.responsible) || null;
      const responsibleEmployeeId = sanitizeEmployeeId(
        taskRecord.responsible_employee_id
      );
      const dueDate = sanitizeDueDate(taskRecord.due_date);
      const taskKey = [
        normalizeText(action),
        responsibleEmployeeId ?? normalizeText(responsible || ""),
        dueDate || "",
      ].join("|");

      if (seenTasks.has(taskKey)) {
        return null;
      }

      seenTasks.add(taskKey);

      return {
        action,
        responsible,
        responsible_employee_id: responsibleEmployeeId,
        due_date: dueDate,
      };
    })
    .filter((task): task is GeneratedTask => Boolean(task));
}

function sanitizeTitle(title: unknown) {
  const cleanedTitle = cleanText(title)
    .replace(/^#+\s*/, "")
    .replace(/\s+/g, " ");

  if (!cleanedTitle) {
    return "Réunion sans titre";
  }

  return cleanedTitle.split(" ").slice(0, 8).join(" ");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("audio");
    const participants = formData.get("participants");
    const employeesRaw = formData.get("employees") as string | null;

    const employees = employeesRaw ? JSON.parse(employeesRaw) : [];

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

Objectif qualitatif : écrire comme un assistant de direction expérimenté.
Le compte rendu ne doit pas être plus long que nécessaire : il doit être plus clair, plus fiable et immédiatement exploitable.
Avant de rédiger, identifie mentalement le sujet principal, l'objectif de la réunion, les décisions, désaccords, actions, responsabilités, échéances et ambiguïtés. Ne restitue que les éléments réellement présents dans la transcription.

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
- Le compte rendu est en français professionnel, naturel, lisible et sobre.
- Préfère des formulations comme "Cette réunion avait pour objectif..." ou "Les échanges ont principalement porté sur..." quand cela correspond à la transcription.
- Le résumé exécutif doit répondre clairement à : pourquoi cette réunion, ce qui a été décidé, et ce qu'il faut retenir.
- Rédige le résumé exécutif comme une synthèse de cabinet de conseil : quelques paragraphes courts, aucune phrase creuse, aucun remplissage.
- Hiérarchise les informations : décisions, actions et échéances d'abord ; détails secondaires ensuite.
- Retourne le compte rendu en Markdown.
- Utilise "# Résumé exécutif" dans tous les cas.
- Ajoute uniquement les sections utiles parmi : "# Points clés", "# Décisions prises", "# Risques ou points à clarifier", "# Questions ouvertes", "# Prochaines étapes".
- N'ajoute pas une section vide.
- Ne jamais inclure une section "Actions à réaliser" dans le compte rendu : les tâches sont affichées séparément dans l'application.
- Ne répète pas les tâches mot pour mot dans le compte rendu.
- Pour les décisions, risques, budget, blocages, questions ouvertes et prochaines étapes : mentionne seulement ce qui a réellement été évoqué.
- Si aucune décision claire n'a été prise, n'invente pas de décision. Si cela améliore la compréhension, écris : "Aucune décision claire n’a été prise pendant cette réunion."
- Si aucun risque n'a été évoqué, n'écris pas "Aucun risque majeur n’a été identifié" sauf si la réunion a explicitement traité les risques. Préfère omettre la section.
- Si une responsabilité est ambiguë, écris clairement que la responsabilité n’a pas pu être déterminée avec certitude.
- Ne crée jamais de participant, de décision, de risque, de tâche, de budget ou d'échéance absent de la transcription.
- Soigne les paragraphes, les retours à la ligne et les listes pour produire un document agréable à lire.

Règles d'extraction des tâches :
- Liste uniquement les vraies actions clairement mentionnées dans la réunion.
- Si aucune action n'est identifiable, retourne [].
- Reformule chaque tâche pour qu'elle soit précise, courte et directement actionnable.
- Chaque tâche doit contenir autant que possible l'action, le contexte utile, le responsable et l'échéance, mais uniquement si ces informations existent réellement.
- Une bonne tâche ressemble à : "Envoyer le devis au client afin de permettre la validation du projet avant le 30 juin."
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

Contrôle qualité final avant de retourner le JSON :
- Aucune section vide.
- Aucune tâche dupliquée.
- Aucun participant inventé ou dupliqué.
- Aucune décision répétée.
- Aucune information incohérente avec la transcription.
- Les tâches ne doivent contenir que des actions réellement évoquées.
- Les échéances doivent être ISO YYYY-MM-DD ou null.
- Le compte rendu et les tâches doivent raconter la même réunion, sans contradiction.

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
    const title = sanitizeTitle(result.title);
    const report = sanitizeReport(result.report);
    const tasks = sanitizeTasks(result.tasks);

    return Response.json({
      title,
      report,
      tasks,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Erreur pendant la génération du compte rendu." },
      { status: 500 }
    );
  }
}
