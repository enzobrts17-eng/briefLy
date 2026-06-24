"use client";

import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import { supabase } from "../lib/supabase";

type Meeting = {
  id: number;
  title: string;
  file_name: string;
  created_at: string;
  report: string;
};

type Employee = {
  id: number;
  name: string;
  role: string;
  email: string;
};

type TaskFromAI = {
  action: string;
  responsible?: string;
  responsible_employee_id?: number | null;
  due_date?: string;
};

type ApiResponse = {
  title: string;
  report: string;
  tasks?: TaskFromAI[];
  error?: string;
};
type Task = {
  id: number;
  meeting_id: number;
  action: string;
  responsible: string | null;
  responsible_employee_id?: number | null;
  due_date: string | null;
  status: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentMeetingId, setCurrentMeetingId] = useState<number | null>(null);
  const [currentParticipants, setCurrentParticipants] = useState<Employee[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [meetingSearch, setMeetingSearch] = useState("");
  const [meetingFilter, setMeetingFilter] = useState<
  "all" | "today" | "week" | "month"
>("all");
  const [showTrash, setShowTrash] = useState(false);
  const [deletedMeetings, setDeletedMeetings] = useState<Meeting[]>([]);
  const [isEditing, setIsEditing] = useState(false);
const [emailStatus, setEmailStatus] = useState("");
const [showEmailModal, setShowEmailModal] = useState(false);
const [emailRecipients, setEmailRecipients] = useState<number[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
const [openTaskMenuId, setOpenTaskMenuId] = useState<number | null>(null);
const [openEmployeeMenuId, setOpenEmployeeMenuId] = useState<number | null>(null);
const [selectedEmployeeProfile, setSelectedEmployeeProfile] =
  useState<Employee | null>(null);
const [selectedResponsible, setSelectedResponsible] = useState("Tous");
const [taskStatusFilter, setTaskStatusFilter] = useState<"all" | "done" | "todo">("all");
const [currentMeetingDate, setCurrentMeetingDate] = useState("");
const [showEmployeeModal, setShowEmployeeModal] = useState(false);
const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
const [employeeForm, setEmployeeForm] = useState({
  name: "",
  role: "",
  email: "",
});
  useEffect(() => {
    loadMeetings();
    loadDeletedMeetings();
    loadEmployees();
  }, []);

  async function loadMeetings() {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setMeetings(data || []);
  }

  async function loadDeletedMeetings() {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setDeletedMeetings(data || []);
  }

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setEmployees(data || []);
  }
async function saveEmployeeForm() {
  if (!employeeForm.name.trim()) {
    alert("Le nom est obligatoire.");
    return;
  }

  if (editingEmployee) {
    const { error } = await supabase
      .from("employees")
      .update({
        name: employeeForm.name,
        role: employeeForm.role,
        email: employeeForm.email,
      })
      .eq("id", editingEmployee.id);

    if (error) {
      console.error(error);
      alert("Erreur lors de la modification.");
      return;
    }
  } else {
    const { error } = await supabase.from("employees").insert({
      name: employeeForm.name,
      role: employeeForm.role,
      email: employeeForm.email,
    });

    if (error) {
      console.error(error);
      alert("Erreur lors de l'ajout.");
      return;
    }
  }

  setShowEmployeeModal(false);
  setEditingEmployee(null);
  setEmployeeForm({ name: "", role: "", email: "" });
  await loadEmployees();
}

async function deleteEmployee(id: number) {
  const confirmed = window.confirm(
    "Supprimer ce collaborateur ?"
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Erreur lors de la suppression.");
    return;
  }

  setOpenEmployeeMenuId(null);
  await loadEmployees();
}
  async function deleteMeeting(id: number) {
    const confirmed = window.confirm(
      "Es-tu sûr de vouloir supprimer cette réunion ? Elle sera placée dans la corbeille pendant 30 jours."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("meetings")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    await loadMeetings();
    await loadDeletedMeetings();
  }

  async function restoreMeeting(id: number) {
    const { error } = await supabase
      .from("meetings")
      .update({
        deleted_at: null,
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    await loadMeetings();
    await loadDeletedMeetings();
  }

  async function permanentlyDeleteMeeting(id: number) {
    const confirmed = window.confirm(
      "Supprimer définitivement cette réunion ? Cette action est irréversible."
    );

    if (!confirmed) return;

    const { error } = await supabase.from("meetings").delete().eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    await loadDeletedMeetings();
  }
  async function saveTasks(meetingId: number, tasks: TaskFromAI[] = []) {
  if (!tasks || tasks.length === 0) return;

  const tasksToInsert = tasks.map((task) => {
  const responsibleText = (task.responsible || "").toLowerCase();

  const possibleMatches = employees.filter((employee) => {
  const employeeName = employee.name.toLowerCase();
  const employeeEmail = employee.email?.toLowerCase() || "";

  return (
    responsibleText === employeeName ||
    responsibleText.includes(employeeName) ||
    employeeName.includes(responsibleText) ||
    (employeeEmail && responsibleText.includes(employeeEmail))
  );
});

const matchedEmployee =
  possibleMatches.length === 1 ? possibleMatches[0] : null;

  return {
    meeting_id: meetingId,
    action: task.action,
    responsible: task.responsible || null,
    responsible_employee_id:
  task.responsible_employee_id || matchedEmployee?.id || null,
    due_date: task.due_date || null,
    status: "À faire",
  };
});
  const { error } = await supabase.from("tasks").insert(tasksToInsert);

  if (error) {
    console.error(error);
  }
}

  async function saveMeeting(
  title: string,
  report: string,
  fileName: string,
  tasks: TaskFromAI[] = []
) {
    const { data, error } = await supabase
      .from("meetings")
      .insert({
        title,
        report,
        file_name: fileName,
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return null;
  
    }
if (data) {
  setCurrentMeetingId(data.id);

  const selectedParticipants = employees.filter((employee) =>
    selectedEmployees.includes(employee.id)
  );

  setCurrentParticipants(selectedParticipants);

  await loadMeetingTasks(data.id);
}
if (data) {
  await saveTasks(data.id, tasks);
}
    if (data && selectedEmployees.length > 0) {
      const participantsToInsert = selectedEmployees.map((employeeId) => ({
        meeting_id: data.id,
        employee_id: employeeId,
      }));

      const { error: participantsError } = await supabase
        .from("meeting_participants")
        .insert(participantsToInsert);

      if (participantsError) {
        console.error(participantsError);
      }
    }

   
    await loadMeetings();
    return data.id;
  }

  function toggleEmployee(employeeId: number) {
    if (selectedEmployees.includes(employeeId)) {
      setSelectedEmployees(selectedEmployees.filter((id) => id !== employeeId));
    } else {
      setSelectedEmployees([...selectedEmployees, employeeId]);
    }
  }

  async function startRecording() {
    try {
      setMessage("");
      setCurrentTitle("");
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        const recordedFile = new File(
          [audioBlob],
          `enregistrement-${Date.now()}.webm`,
          { type: "audio/webm" }
        );

        setFile(recordedFile);
        setMessage("Enregistrement terminé. Tu peux générer le compte rendu.");
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error(error);
      setMessage("Impossible d'accéder au micro.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => {
        track.stop();
      });
      setIsRecording(false);
    }
  }

  async function handleUpload() {
    if (!file) {
      setMessage("Choisis ou enregistre un fichier audio.");
      return;
    }

    try {
      setCurrentTitle("");
      setMessage("Génération du compte rendu...");

      const selectedParticipants = employees.filter((employee) =>
        selectedEmployees.includes(employee.id)
      );

      const participantsText =
        selectedParticipants.length > 0
          ? selectedParticipants
              .map((employee) => `${employee.name} (${employee.role})`)
              .join(", ")
          : "Aucun participant sélectionné";

      const formData = new FormData();
      formData.append("audio", file);
      formData.append("participants", participantsText);
      formData.append(
  "employees",
  JSON.stringify(
    employees.map((employee) => ({
      id: employee.id,
      name: employee.name,
      role: employee.role,
      email: employee.email,
    }))
  )
);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data: ApiResponse = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Erreur pendant la génération.");
        return;
      }

      setCurrentTitle(data.title);
setMessage(data.report);

const savedMeetingId = await saveMeeting(
  data.title,
  data.report,
  file.name,
  data.tasks || []
);

if (savedMeetingId) {
  await loadMeetingTasks(savedMeetingId);
}
      
    } catch (error) {
      console.error(error);
      setMessage("Erreur lors de l'envoi.");
    }
  }
async function sendMeetingEmail(
  title: string,
  report: string,
  employeeIds: number[]
) {
  const emails = employees
    .filter((employee) => employeeIds.includes(employee.id))
    .map((employee) => employee.email);

  if (emails.length === 0) return;


  try {
    await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emails,
        title,
        report,
      }),
    });
  } catch (error) {
    console.error(error);
  }
}
async function sendEmailToParticipants() {
const selectedRecipients = employees.filter((employee) =>
  emailRecipients.includes(employee.id)
);

const emails = selectedRecipients
  .map((employee) => employee.email)
  .filter((email) => email);

if (emails.length === 0) {
  setEmailStatus("Aucun destinataire sélectionné.");
  return;
}

  if (!message || message === "Génération du compte rendu...") {
    setEmailStatus("Aucun compte rendu à envoyer.");
    return;
  }

  try {
    setEmailStatus("Envoi en cours...");

    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        emails,
        title: currentTitle || "Compte rendu de réunion",
        report: message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setEmailStatus(data.error || "Erreur pendant l'envoi.");
      return;
    }

    setEmailStatus("Compte rendu envoyé aux participants.");
  } catch (error) {
    console.error(error);
    setEmailStatus("Erreur pendant l'envoi de l'email.");
  }
}
async function saveEditedReport() {
  if (!currentMeetingId) {
    setIsEditing(false);
    return;
  }

  const { error } = await supabase
    .from("meetings")
    .update({
      report: message,
    })
    .eq("id", currentMeetingId);

  if (error) {
    console.error(error);
    alert("Erreur lors de la sauvegarde.");
    return;
  }

  await loadMeetings();
  setIsEditing(false);
}
  function downloadPDF(
    report: string = message,
    title: string = currentTitle || "Compte rendu de réunion",
    fileName = "compte-rendu-reunion.pdf"
  ) {
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(report, 180);

    doc.setFontSize(18);
    doc.text(title, 15, 20);

    doc.setFontSize(11);
    doc.text(lines, 15, 35);

    doc.save(fileName);
  }
  async function loadMeetingTasks(meetingId: number) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  setTasks(data || []);
}
async function toggleTaskStatus(task: Task) {
  const newStatus = task.status === "Fait" ? "À faire" : "Fait";

  const { error } = await supabase
    .from("tasks")
    .update({ status: newStatus })
    .eq("id", task.id);

  if (error) {
    console.error(error);
    return;
  }

  setTasks((currentTasks) =>
    currentTasks.map((currentTask) =>
      currentTask.id === task.id
        ? { ...currentTask, status: newStatus }
        : currentTask
    )
  );
}
async function deleteTask(taskId: number) {
  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", taskId);

  if (error) {
    console.error(error);
    return;
  }

  setTasks((currentTasks) =>
    currentTasks.filter((task) => task.id !== taskId)
  );

  setOpenTaskMenuId(null);
}
async function updateTaskDueDate(taskId: number, dueDate: string) {
  const { error } = await supabase
    .from("tasks")
    .update({ due_date: dueDate || null })
    .eq("id", taskId);

  if (error) {
    console.error(error);
    return;
  }

  setTasks((currentTasks) =>
    currentTasks.map((task) =>
      task.id === taskId
        ? { ...task, due_date: dueDate || null }
        : task
    )
  );
}
async function updateTaskResponsible(task: Task, employeeId: number) {
  const employee = employees.find((e) => e.id === employeeId);

  if (!employee) {
    alert("Collaborateur introuvable.");
    return;
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      responsible: employee.name,
      responsible_employee_id: employee.id,
    })
    .eq("id", task.id);

  if (error) {
    console.error(error);
    alert("Erreur lors de la modification du responsable.");
    return;
  }

  setTasks((currentTasks) =>
    currentTasks.map((currentTask) =>
      currentTask.id === task.id
        ? {
            ...currentTask,
            responsible: employee.name,
            responsible_employee_id: employee.id,
          }
        : currentTask
    )
  );

  setOpenTaskMenuId(null);
}

async function askAndUpdateTaskDueDate(task: Task) {
  const dueDate = prompt(
    "Nouvelle échéance au format AAAA-MM-JJ :",
    task.due_date || ""
  );

  if (dueDate === null) return;

  await updateTaskDueDate(task.id, dueDate);
  setOpenTaskMenuId(null);
}
async function sendTaskToResponsible(task: Task) {
  if (!task.responsible) {
    alert("Aucun responsable identifié pour cette tâche.");
    return;
  }

  const responsibleName = task.responsible.toLowerCase().trim();

const responsibleEmployee = employees.find((employee) => {
  const employeeName = employee.name.toLowerCase().trim();

  return (
    employeeName === responsibleName ||
    employeeName.includes(responsibleName) ||
    responsibleName.includes(employeeName)
  );
});

  if (!responsibleEmployee || !responsibleEmployee.email) {
    alert("Aucun email trouvé pour ce responsable.");
    return;
  }

  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      emails: [responsibleEmployee.email],
      title: `Tâche assignée - ${currentTitle}`,
      report: `
Bonjour ${responsibleEmployee.name},

Une tâche vous a été assignée suite à la réunion "${currentTitle}".

Tâche :
${task.action}

Échéance :
${task.due_date || "Non mentionnée"}

Cordialement,
BriefLy
`,
    }),
  });

  if (!response.ok) {
  const errorText = await response.text();
  console.log("Erreur API send-email :", errorText);
  alert("Erreur pendant l'envoi de la tâche.");
  return;
}

  alert("Tâche envoyée au responsable.");
}
function downloadTaskCalendar(task: Task) {
  const title = task.action;
  const description = `Responsable : ${
    task.responsible || "Non mentionné"
  }`;

  const now = new Date();

  const startDate = new Date(now);
  startDate.setHours(9, 0, 0, 0);

  const endDate = new Date(now);
  endDate.setHours(10, 0, 0, 0);

  const formatDate = (date: Date) =>
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BriefLy//Task//FR
BEGIN:VEVENT
UID:${Date.now()}@briefly
DTSTAMP:${formatDate(now)}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${title}
DESCRIPTION:${description}
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "tache-briefly.ics";
  link.click();

  URL.revokeObjectURL(url);
}
async function loadMeetingParticipants(meetingId: number) {
  const { data, error } = await supabase
    .from("meeting_participants")
    .select("employees(*)")
    .eq("meeting_id", meetingId);

  if (error) {
    console.error(error);
    return;
  }

  const participants = data
  ?.map((item: any) => item.employees)
  ?.filter(Boolean) || [];
  setCurrentParticipants(participants);
}
  function openMeeting(meeting: Meeting) {
    loadMeetingTasks(meeting.id);
  setCurrentMeetingId(meeting.id);
  setCurrentTitle(meeting.title);
  setMessage(meeting.report);
  setCurrentMeetingDate(
  new Date(meeting.created_at).toLocaleString("fr-FR")
);
  loadMeetingParticipants(meeting.id);
}
const filteredEmployees = employees.filter((employee) => {
  const search = employeeSearch.toLowerCase();

  return (
    employee.name.toLowerCase().includes(search) ||
    employee.role.toLowerCase().includes(search)
  );
});
const filteredMeetings = meetings.filter((meeting) => {
  const search = meetingSearch.toLowerCase();

  const meetingDate = new Date(meeting.created_at);
  const now = new Date();

  const dateText = meetingDate.toLocaleString("fr-FR").toLowerCase();

  const matchesSearch =
    meeting.title.toLowerCase().includes(search) ||
    meeting.file_name.toLowerCase().includes(search) ||
    meeting.report.toLowerCase().includes(search) ||
    dateText.includes(search);

  const isToday = meetingDate.toDateString() === now.toDateString();

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);

  const isThisWeek = meetingDate >= startOfWeek;

  const isThisMonth =
    meetingDate.getMonth() === now.getMonth() &&
    meetingDate.getFullYear() === now.getFullYear();

  const matchesFilter =
    meetingFilter === "all" ||
    (meetingFilter === "today" && isToday) ||
    (meetingFilter === "week" && isThisWeek) ||
    (meetingFilter === "month" && isThisMonth);

  return matchesSearch && matchesFilter;
});
const filteredTasks = tasks.filter((task) => {
  const matchesResponsible =
    selectedResponsible === "Tous" ||
    task.responsible === selectedResponsible;

  const matchesStatus =
    taskStatusFilter === "all" ||
    (taskStatusFilter === "done" && task.status === "Fait") ||
    (taskStatusFilter === "todo" && task.status !== "Fait");

  return matchesResponsible && matchesStatus;
});

  return (
    <main className="min-h-screen flex flex-col items-center p-8">
      <h1 className="text-4xl font-bold mt-12 mb-6">Réunion AI</h1>

      <p className="mb-8 text-center">
        Transformez vos réunions audio en comptes rendus clairs.
      </p>

      <div className="flex gap-3 mb-6">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="px-4 py-2 bg-red-600 text-white rounded"
          >
            Démarrer l’enregistrement
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-black text-white rounded"
          >
            Arrêter l’enregistrement
          </button>
        )}
      </div>

      {isRecording && (
        <p className="mb-4 text-red-600 font-semibold">
          Enregistrement en cours...
        </p>
      )}

      <p className="mb-3 text-sm text-gray-500">ou importe un fichier audio :</p>

      <input
        type="file"
        accept="audio/*"
        onChange={(e) => {
          const selectedFile = e.target.files?.[0];

          if (selectedFile) {
            setFile(selectedFile);
            setMessage("");
            setCurrentTitle("");
          }
        }}
      />

      {file && (
        <p className="mt-4">
          Fichier prêt : <strong>{file.name}</strong>
        </p>
      )}

      {employees.length > 0 && (
        <div className="mt-6 border rounded-lg p-4 max-w-md w-full">
          

          <div className="flex items-center justify-between mb-3">
  <h3 className="font-bold">Participants présents</h3>

  <button
    type="button"
    onClick={() => {
      setEditingEmployee(null);
      setEmployeeForm({ name: "", role: "", email: "" });
      setShowEmployeeModal(true);
    }}
    className="px-2 py-1 border rounded text-sm"
  >
    +
  </button>
</div>
          <input
  type="text"
  placeholder="🔍 Rechercher un collaborateur..."
  value={employeeSearch}
  onChange={(e) => setEmployeeSearch(e.target.value)}
  className="w-full border rounded p-2 mb-3"
 />

          {filteredEmployees.map((employee) => (
            <label
  key={employee.id}
  className="flex items-center justify-between gap-2 mb-2"
>
              <input
                type="checkbox"
                checked={selectedEmployees.includes(employee.id)}
                onChange={() => toggleEmployee(employee.id)}
              />

              <button
  type="button"
  onClick={(e) => {
    e.preventDefault();
    setSelectedEmployeeProfile(employee);
  }}
  className="text-left hover:underline"
>
  {employee.name}
  {employee.role ? ` (${employee.role})` : ""}
</button>
              <div className="relative">
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault();
      setOpenEmployeeMenuId(
        openEmployeeMenuId === employee.id ? null : employee.id
      );
    }}
    className="px-2 text-gray-500 hover:text-black"
  >
    ⋯
  </button>

  {openEmployeeMenuId === employee.id && (
    <div className="absolute right-0 mt-1 bg-white border rounded shadow z-50 min-w-[120px]">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
        setEditingEmployee(employee);
setEmployeeForm({
  name: employee.name,
  role: employee.role || "",
  email: employee.email || "",
});
setShowEmployeeModal(true);
setOpenEmployeeMenuId(null);
        }}
        className="block w-full text-left px-3 py-2 hover:bg-gray-100"
      >
        Modifier
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          deleteEmployee(employee.id);
        }}
        className="block w-full text-left px-3 py-2 text-red-600 hover:bg-gray-100"
      >
        Supprimer
      </button>
    </div>
  )}
</div>
            </label>
          ))}
        </div>
      )}
      
      {selectedEmployeeProfile &&
  (() => {
    const employeeTasks = tasks.filter(
  (task) =>
    task.responsible_employee_id === selectedEmployeeProfile.id
);

    const completedTasks = employeeTasks.filter(
      (task) => task.status === "Fait"
    );

    const pendingTasks = employeeTasks.filter(
      (task) => task.status !== "Fait"
    );

    return (
      <div className="mb-4 p-4 border rounded-lg bg-gray-50">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-bold">
            {selectedEmployeeProfile.name}
          </h4>

          <button
            onClick={() => setSelectedEmployeeProfile(null)}
            className="text-gray-500"
          >
            ×
          </button>
        </div>

        <p>
          <strong>Poste :</strong>{" "}
          {selectedEmployeeProfile.role || "Non renseigné"}
        </p>

        <p>
          <strong>Email :</strong>{" "}
          {selectedEmployeeProfile.email || "Non renseigné"}
        </p>

        <hr className="my-3" />

        <p>📋 Tâches : {employeeTasks.length}</p>
        <p>✅ Terminées : {completedTasks.length}</p>
        <p>⏳ À faire : {pendingTasks.length}</p>

        {pendingTasks.length > 0 && (
          <>
            <h5 className="font-semibold mt-3">Tâches à faire</h5>
            <ul className="list-disc list-inside text-sm">
              {pendingTasks.map((task) => (
                <li key={task.id}>{task.action}</li>
              ))}
            </ul>
          </>
        )}

        {completedTasks.length > 0 && (
          <>
            <h5 className="font-semibold mt-3">Tâches terminées</h5>
            <ul className="list-disc list-inside text-sm text-gray-600">
              {completedTasks.map((task) => (
                <li key={task.id}>{task.action}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    );
  })()}

      <button
        onClick={handleUpload}
        className="mt-6 px-4 py-2 bg-black text-white rounded"
      >
        Générer le compte rendu
      </button>

      {message && message !== "Génération du compte rendu..." && (
  <div className="flex gap-3 mt-4">
    <button
      onClick={() => setIsEditing(true)}
      className="px-4 py-2 border rounded"
    >
      Modifier
    </button>

    <button
      onClick={() => downloadPDF()}
      className="px-4 py-2 border rounded"
    >
      Télécharger en PDF
    </button>

    <button
  onClick={() => {
    setEmailRecipients(selectedEmployees);
    setShowEmailModal(true);
  }}
  className="px-4 py-2 bg-black text-white rounded"
>
  Envoyer aux participants
</button>
  </div>
)}
{emailStatus && (
  <p className="mt-3 text-sm text-gray-600">
    {emailStatus}
  </p>
)}

      {message && (
  <div className="mt-8 max-w-3xl w-full border rounded-lg p-6 text-left">
    {currentTitle && (
  <div className="mb-4 flex items-start justify-between gap-4">
    <div>
      <h2 className="text-2xl font-bold">{currentTitle}</h2>
      {currentMeetingDate && (
        <p className="text-sm text-gray-500 mt-1">
          {currentMeetingDate}
        </p>
      )}
    </div>

    <button
      onClick={() => {
        setCurrentTitle("");
        setCurrentMeetingId(null);
        setCurrentMeetingDate("");
        setCurrentParticipants([]);
        setMessage("");
        setTasks([]);
        setIsEditing(false);
      }}
      className="px-3 py-1 border rounded text-sm"
    >
      Fermer
    </button>
  </div>
)}
    {tasks.length > 0 && (
  <div className="flex gap-4 text-sm text-gray-600 mb-4">
  <button
    onClick={() => {
      if (tasks.length === 0) return;

      setTaskStatusFilter("all");
      document
        .getElementById("actions-detectees")
        ?.scrollIntoView({ behavior: "smooth" });
    }}
    className="hover:underline"
  >
    📝 {tasks.length} tâche{tasks.length > 1 ? "s" : ""}
  </button>

  <button
    onClick={() => {
      const doneCount = tasks.filter(
        (task) => task.status === "Fait"
      ).length;

      if (doneCount === 0) return;

      setTaskStatusFilter("done");
      document
        .getElementById("actions-detectees")
        ?.scrollIntoView({ behavior: "smooth" });
    }}
    className="hover:underline"
  >
    ✅ {tasks.filter((task) => task.status === "Fait").length} terminées
  </button>

  <button
    onClick={() => {
      const todoCount = tasks.filter(
        (task) => task.status !== "Fait"
      ).length;

      if (todoCount === 0) return;

      setTaskStatusFilter("todo");
      document
        .getElementById("actions-detectees")
        ?.scrollIntoView({ behavior: "smooth" });
    }}
    className="hover:underline"
  >
    ⏳ {tasks.filter((task) => task.status !== "Fait").length} à faire
  </button>
</div>
)}
   
    {currentParticipants.length > 0 && (
  <div className="mb-4 rounded border p-3 bg-gray-50">
    <p className="font-semibold mb-2">Participants présents :</p>

    <ul className="list-disc list-inside text-sm text-gray-700">
      {currentParticipants.map((participant) => (
        <li key={participant.id}>
          {participant.name}
          {participant.role ? ` (${participant.role})` : ""}
        </li>
      ))}
    </ul>
  </div>
)}

    {isEditing ? (
      <div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full min-h-[400px] border rounded p-3"
        />

        <div className="flex gap-3 mt-4">
          <button
            onClick={saveEditedReport}
            className="px-4 py-2 bg-black text-white rounded"
          >
            Enregistrer les modifications
          </button>

          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 border rounded"
          >
            Annuler
          </button>
        </div>
      </div>
    ) : (
      <>
     <div className="whitespace-pre-wrap">
  {message}
</div>

{tasks.length > 0 && (
  <div className="mt-6 border rounded-lg p-4 bg-gray-50">
    <div className="mb-3">
  <select
    value={selectedResponsible}
    onChange={(e) => setSelectedResponsible(e.target.value)}
    className="border rounded px-3 py-2"
  >
    <option value="Tous">Tous les responsables</option>

   {[...new Set(tasks.map((task) => task.responsible || ""))]
  .filter((responsible) => responsible !== "")
  .map((responsible) => (
    <option key={responsible} value={responsible}>
      {responsible}
    </option>
  ))}
  </select>
</div>

   <h3 id="actions-detectees" className="font-bold mb-3">
  Actions détectées
</h3>


  
    <div className="space-y-3">
      {filteredTasks.map((task) => (
       <div
  key={task.id}
  onClick={() => toggleTaskStatus(task)}
  className={`border rounded p-3 cursor-pointer transition ${
    task.status === "Fait"
      ? "bg-green-100 border-green-300"
      : "bg-white"
  }`}
>
  <div className="flex justify-end">
  <button
    onClick={(e) => {
      e.stopPropagation();
      setOpenTaskMenuId(
        openTaskMenuId === task.id ? null : task.id
      );
    }}
    className="text-gray-500 hover:text-black"
  >
    ⋯
  </button>
</div>
          <p className="font-semibold">
  {task.status === "Fait" ? "✅ " : "⬜ "}
  {task.action}
</p>

          <p className="text-sm text-gray-600">
            Responsable : {task.responsible || "Non mentionné"}
          </p>

          <div className="text-sm text-gray-600">
  <label className="mr-2">Échéance :</label>

  <input
    type="date"
    value={task.due_date || ""}
    onClick={(e) => e.stopPropagation()}
    onChange={(e) =>
      updateTaskDueDate(task.id, e.target.value)
    }
    className="border rounded px-2 py-1 text-sm"
  />
</div>

          <p className="text-sm text-gray-600">
            Statut : {task.status}
          </p>
          <button
  type="button"
  onClick={(e) => {
    e.stopPropagation();
    setOpenTaskMenuId(openTaskMenuId === task.id ? null : task.id);
  }}
  className="absolute top-3 right-3 px-2 text-gray-500 hover:text-black"
>
  ⋯
</button>
          {openTaskMenuId === task.id && (
  <div
    onClick={(e) => e.stopPropagation()}
    className="absolute right-3 top-10 bg-white border rounded shadow-lg z-50 min-w-[220px]"
  >
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        downloadTaskCalendar(task);
        setOpenTaskMenuId(null);
      }}
      className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
    >
      📅 Ajouter au calendrier
    </button>

    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();

        const employeeId = Number(
          prompt(
            "ID du nouveau responsable :\n\n" +
              employees
                .map(
                  (employee) =>
                    `${employee.id} - ${employee.name} (${employee.role || "Sans poste"})`
                )
                .join("\n")
          )
        );

        if (!employeeId) return;

        updateTaskResponsible(task, employeeId);
        setOpenTaskMenuId(null);
      }}
      className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
    >
      Modifier le responsable
    </button>

    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        askAndUpdateTaskDueDate(task);
        setOpenTaskMenuId(null);
      }}
      className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
    >
      Modifier l’échéance
    </button>

    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        sendTaskToResponsible(task);
        setOpenTaskMenuId(null);
      }}
      className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
    >
      📩 Envoyer au responsable
    </button>

    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        deleteTask(task.id);
        setOpenTaskMenuId(null);
      }}
      className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-100"
    >
      🗑 Supprimer la tâche
    </button>
  </div>
)}
          
        </div>
                 ))}
    </div>
  </div>
)}

      </>
    )}
  </div>
)}



      {meetings.length > 0 && (
        <section className="mt-10 max-w-3xl w-full">
          <h2 className="text-2xl font-bold mb-4">Historique des réunions</h2>
          <div className="flex gap-2 mb-4 flex-wrap">
  <button
    onClick={() => setMeetingFilter("all")}
    className={`px-3 py-1 rounded ${
      meetingFilter === "all"
        ? "bg-black text-white"
        : "border"
    }`}
  >
    Toutes
  </button>

  <button
    onClick={() => setMeetingFilter("today")}
    className={`px-3 py-1 rounded ${
      meetingFilter === "today"
        ? "bg-black text-white"
        : "border"
    }`}
  >
    Aujourd'hui
  </button>

  <button
    onClick={() => setMeetingFilter("week")}
    className={`px-3 py-1 rounded ${
      meetingFilter === "week"
        ? "bg-black text-white"
        : "border"
    }`}
  >
    Cette semaine
  </button>

  <button
    onClick={() => setMeetingFilter("month")}
    className={`px-3 py-1 rounded ${
      meetingFilter === "month"
        ? "bg-black text-white"
        : "border"
    }`}
  >
    Ce mois
  </button>
</div>
          <input
  type="text"
  placeholder="🔍 Rechercher une réunion..."
  value={meetingSearch}
  onChange={(e) => setMeetingSearch(e.target.value)}
  className="w-full border rounded p-2 mb-4"
/>

          <div className="space-y-3">
            {filteredMeetings
  .filter((meeting) => meeting.id !== currentMeetingId)
  .map((meeting) => (
              <div key={meeting.id} className="border rounded-lg p-4">
                <p className="font-semibold">{meeting.title}</p>
                <p className="text-sm text-gray-500">
                  {new Date(meeting.created_at).toLocaleString("fr-FR")}
                </p>
                <p className="text-sm text-gray-500">{meeting.file_name}</p>

                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => openMeeting(meeting)}
                    className="px-3 py-1 bg-black text-white rounded text-sm"
                  >
                    Ouvrir
                  </button>

                  <button
                    onClick={() =>
                      downloadPDF(
                        meeting.report,
                        meeting.title,
                        `compte-rendu-${meeting.id}.pdf`
                      )
                    }
                    className="px-3 py-1 border rounded text-sm"
                  >
                    PDF
                  </button>

                  <button
                    onClick={() => deleteMeeting(meeting.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
{showEmailModal && (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6 z-50">
    <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Destinataires</h2>

        <button
          onClick={() => setShowEmailModal(false)}
          className="px-3 py-1 border rounded"
        >
          Fermer
        </button>
      </div>

      <p className="mb-4 text-sm text-gray-600">
        Décoche les personnes qui ne doivent pas recevoir le compte rendu.
      </p>

      <div className="space-y-2">
        {employees
          .filter((employee) => selectedEmployees.includes(employee.id))
          .map((employee) => (
            <label key={employee.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={emailRecipients.includes(employee.id)}
                onChange={() => {
                  if (emailRecipients.includes(employee.id)) {
                    setEmailRecipients(
                      emailRecipients.filter((id) => id !== employee.id)
                    );
                  } else {
                    setEmailRecipients([...emailRecipients, employee.id]);
                  }
                }}
              />

              <span>
                {employee.name}
                {employee.role ? ` (${employee.role})` : ""}
                {employee.email ? ` — ${employee.email}` : " — aucun email"}
              </span>
            </label>
          ))}
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={sendEmailToParticipants}
          className="px-4 py-2 bg-black text-white rounded"
        >
          Envoyer
        </button>

        <button
          onClick={() => setShowEmailModal(false)}
          className="px-4 py-2 border rounded"
        >
          Annuler
        </button>
      </div>
    </div>
  </div>
)}

      {showTrash && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Corbeille</h2>

              <button
                onClick={() => setShowTrash(false)}
                className="px-3 py-1 border rounded"
              >
                Fermer
              </button>
            </div>

            {deletedMeetings.length === 0 ? (
              <p>Aucune réunion dans la corbeille.</p>
            ) : (
              <div className="space-y-3">
                {deletedMeetings.map((meeting) => (
                  <div key={meeting.id} className="border rounded-lg p-4">
                    <p className="font-semibold">{meeting.title}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(meeting.created_at).toLocaleString("fr-FR")}
                    </p>
                    <p className="text-sm text-gray-500">
                      {meeting.file_name}
                    </p>

                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => restoreMeeting(meeting.id)}
                        className="px-3 py-1 bg-black text-white rounded text-sm"
                      >
                        Restaurer
                      </button>

                      <button
                        onClick={() => permanentlyDeleteMeeting(meeting.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                      >
                        Supprimer définitivement
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => setShowTrash(true)}
        className="fixed bottom-6 right-6 bg-black text-white px-4 py-2 rounded-full shadow-lg"
      >
        🗑️ Corbeille
      </button>
      {showEmployeeModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
      <h2 className="text-xl font-bold mb-4">
        {editingEmployee ? "Modifier le collaborateur" : "Ajouter un collaborateur"}
      </h2>

      <div className="space-y-3">
        <input
          type="text"
          placeholder="Nom"
          value={employeeForm.name}
          onChange={(e) =>
            setEmployeeForm({
              ...employeeForm,
              name: e.target.value,
            })
          }
          className="w-full border rounded p-2"
        />

        <input
          type="email"
          placeholder="Email"
          value={employeeForm.email}
          onChange={(e) =>
            setEmployeeForm({
              ...employeeForm,
              email: e.target.value,
            })
          }
          className="w-full border rounded p-2"
        />

        <input
          type="text"
          placeholder="Poste / Fonction"
          value={employeeForm.role}
          onChange={(e) =>
            setEmployeeForm({
              ...employeeForm,
              role: e.target.value,
            })
          }
          className="w-full border rounded p-2"
        />
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          type="button"
          onClick={() => setShowEmployeeModal(false)}
          className="px-4 py-2 border rounded"
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={saveEmployeeForm}
          className="px-4 py-2 bg-black text-white rounded"
        >
          Enregistrer
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  );
}