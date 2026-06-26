import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type MemoryTask = {
  action?: string | null;
  responsible?: string | null;
  due_date?: string | null;
  status?: string | null;
  priority?: string | null;
};

type MemoryParticipant = {
  name?: string | null;
  role?: string | null;
  email?: string | null;
};

type MemoryMeeting = {
  meeting_id: number;
  title?: string | null;
  date?: string | null;
  author?: string | null;
  folder?: string | null;
  report?: string | null;
  participants?: MemoryParticipant[];
  tasks?: MemoryTask[];
};

type MemorySource = {
  meeting_id: number;
  title: string;
  date: string;
  author?: string | null;
  minute?: string | null;
  excerpt?: string | null;
};

type MemoryAnswer = {
  answer?: string;
  sources?: MemorySource[];
};

const MAX_MEETINGS = 60;
const MAX_REPORT_CHARS = 4500;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}\n[Contenu tronqué pour la recherche]`;
}

function sanitizeCorpus(value: unknown): MemoryMeeting[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const meetings: MemoryMeeting[] = [];

  value.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }

    const record = item as Record<string, unknown>;
    const meetingId = Number(record.meeting_id);

    if (!Number.isInteger(meetingId)) {
      return;
    }

    const participants: MemoryParticipant[] = [];
    const tasks: MemoryTask[] = [];

    if (Array.isArray(record.participants)) {
      record.participants.forEach((participant) => {
        if (!participant || typeof participant !== "object") {
          return;
        }

        const participantRecord = participant as Record<string, unknown>;

        participants.push({
          name: cleanString(participantRecord.name) || null,
          role: cleanString(participantRecord.role) || null,
          email: cleanString(participantRecord.email) || null,
        });
      });
    }

    if (Array.isArray(record.tasks)) {
      record.tasks.forEach((task) => {
        if (!task || typeof task !== "object") {
          return;
        }

        const taskRecord = task as Record<string, unknown>;
        const action = cleanString(taskRecord.action);

        if (!action) {
          return;
        }

        tasks.push({
          action,
          responsible: cleanString(taskRecord.responsible) || null,
          due_date: cleanString(taskRecord.due_date) || null,
          status: cleanString(taskRecord.status) || null,
          priority: cleanString(taskRecord.priority) || null,
        });
      });
    }

    meetings.push({
      meeting_id: meetingId,
      title: cleanString(record.title) || "Réunion sans titre",
      date: cleanString(record.date) || "",
      author: cleanString(record.author) || null,
      folder: cleanString(record.folder) || null,
      report: truncateText(cleanString(record.report), MAX_REPORT_CHARS),
      participants,
      tasks,
    });
  });

  return meetings.slice(0, MAX_MEETINGS);
}

function sanitizeSources(
  sources: unknown,
  corpus: MemoryMeeting[]
): MemorySource[] {
  if (!Array.isArray(sources)) {
    return [];
  }

  const corpusById = new Map(
    corpus.map((meeting) => [meeting.meeting_id, meeting])
  );
  const seenSourceIds = new Set<number>();
  const sanitizedSources: MemorySource[] = [];

  sources.forEach((source) => {
    if (!source || typeof source !== "object") {
      return;
    }

    const record = source as Record<string, unknown>;
    const meetingId = Number(record.meeting_id);
    const meeting = corpusById.get(meetingId);

    if (!meeting || seenSourceIds.has(meetingId)) {
      return;
    }

    seenSourceIds.add(meetingId);

    sanitizedSources.push({
      meeting_id: meetingId,
      title: meeting.title || "Réunion sans titre",
      date: meeting.date || "",
      author: cleanString(record.author) || meeting.author || null,
      minute: cleanString(record.minute) || null,
      excerpt: cleanString(record.excerpt) || null,
    });
  });

  return sanitizedSources.slice(0, 8);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const query = cleanString(body?.query);
    const corpus = sanitizeCorpus(body?.corpus);

    if (!query) {
      return NextResponse.json(
        { error: "Question manquante." },
        { status: 400 }
      );
    }

    if (corpus.length === 0) {
      return NextResponse.json({
        answer:
          "Aucune réunion n’est encore disponible dans la mémoire de l’entreprise.",
        sources: [],
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Tu es la mémoire d'entreprise de Briefly. Réponds en français, comme un assistant professionnel. Utilise uniquement le corpus fourni. N'invente jamais une décision, une tâche, une date, un auteur, un participant ou une source. Si l'information n'est pas présente, dis-le clairement. Comprends les synonymes, pluriels, fautes simples et formulations naturelles, mais cite seulement les réunions réellement pertinentes. Réponds avec un JSON strict: {\"answer\":\"...\",\"sources\":[{\"meeting_id\":123,\"title\":\"...\",\"date\":\"...\",\"author\":\"...\",\"minute\":\"...\",\"excerpt\":\"...\"}]}. La minute peut être null si elle n'est pas disponible.",
        },
        {
          role: "user",
          content: JSON.stringify({
            question: query,
            corpus,
          }),
        },
      ],
    });
    const rawContent = completion.choices[0]?.message?.content || "{}";
    const parsedAnswer = JSON.parse(rawContent) as MemoryAnswer;
    const answer = cleanString(parsedAnswer.answer);
    const sources = sanitizeSources(parsedAnswer.sources, corpus);

    return NextResponse.json({
      answer:
        answer ||
        "Je n’ai trouvé aucune information fiable dans les réunions enregistrées.",
      sources,
    });
  } catch (error) {
    console.error("Erreur memory-search :", error);

    return NextResponse.json(
      { error: "Erreur pendant la recherche dans la mémoire." },
      { status: 500 }
    );
  }
}
