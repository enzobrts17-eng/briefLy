"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import { supabase } from "../lib/supabase";

type Meeting = {
  id: number;
  title: string;
  file_name: string;
  created_at: string;
  report: string;
  folder_id?: number | null;
};

type MeetingFolder = {
  id: number;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
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

type TaskStatus = "À faire" | "En cours" | "Fait";

type Task = {
  id: number;
  meeting_id: number;
  created_at?: string;
  action: string;
  responsible: string | null;
  responsible_employee_id?: number | null;
  due_date: string | null;
  status: TaskStatus;
  completed_at?: string | null;
};

type MeetingParticipantRow = {
  employees: Employee | Employee[] | null;
};

type MeetingParticipantSearchRow = {
  meeting_id: number;
  employees: Employee | Employee[] | null;
};

type AppSection = "dashboard" | "new" | "report" | "history" | "collaborators";
type DashboardPeriod = "week" | "month" | "year" | "all";
type DashboardSelection =
  | "meetings"
  | "todo"
  | "progress"
  | "done"
  | "overdue"
  | null;

const GENERATING_REPORT_MESSAGE = "Génération du compte rendu en cours...";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [editedReport, setEditedReport] = useState("");
  const [reportError, setReportError] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [currentMeetingId, setCurrentMeetingId] = useState<number | null>(null);
  const [currentParticipants, setCurrentParticipants] = useState<Employee[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingFolders, setMeetingFolders] = useState<MeetingFolder[]>([]);
  const [folderStatus, setFolderStatus] = useState("");
  const [expandedFolderIds, setExpandedFolderIds] = useState<number[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalMode, setFolderModalMode] = useState<
    "create" | "rename" | "add" | "remove"
  >("create");
  const [activeFolder, setActiveFolder] = useState<MeetingFolder | null>(null);
  const [folderName, setFolderName] = useState("");
  const [selectedFolderMeetingIds, setSelectedFolderMeetingIds] = useState<
    number[]
  >([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meetingParticipantsByMeetingId, setMeetingParticipantsByMeetingId] =
    useState<Record<number, Employee[]>>({});
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [meetingSearch, setMeetingSearch] = useState("");
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [deletedMeetings, setDeletedMeetings] = useState<Meeting[]>([]);
  const [isEditing, setIsEditing] = useState(false);
const [emailStatus, setEmailStatus] = useState("");
const [showEmailModal, setShowEmailModal] = useState(false);
const [showSendReportModal, setShowSendReportModal] = useState(false);
const [sendReportContext, setSendReportContext] = useState<
  "current" | "history"
>("current");
const [isSendParticipantsOpen, setIsSendParticipantsOpen] = useState(false);
const [isSendOthersOpen, setIsSendOthersOpen] = useState(false);
const [copiedNotice, setCopiedNotice] = useState("");
const [openReportSections, setOpenReportSections] = useState<
  Record<string, boolean>
>({});
const [generationStepIndex, setGenerationStepIndex] = useState(0);
const [pendingCloseTarget, setPendingCloseTarget] = useState<
  "current" | "history" | null
>(null);
const [showParticipantsModal, setShowParticipantsModal] = useState(false);
const [showInviteParticipantsModal, setShowInviteParticipantsModal] =
  useState(false);
const [showBulkTasksModal, setShowBulkTasksModal] = useState(false);
const [showReminderModal, setShowReminderModal] = useState(false);
const [emailRecipients, setEmailRecipients] = useState<number[]>([]);
const [pendingParticipantIds, setPendingParticipantIds] = useState<number[]>([]);
const [pendingInviteEmployeeIds, setPendingInviteEmployeeIds] = useState<
  number[]
>([]);
const [selectedBulkTaskIds, setSelectedBulkTaskIds] = useState<number[]>([]);
const [bulkTaskSource, setBulkTaskSource] = useState<Task[]>([]);
const [reminderTaskSource, setReminderTaskSource] = useState<Task[]>([]);
const [selectedReminderTaskIds, setSelectedReminderTaskIds] = useState<number[]>(
  []
);
const [showOtherReminderTasks, setShowOtherReminderTasks] = useState(false);
const [reminderStatus, setReminderStatus] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [activeLiveMeetingId, setActiveLiveMeetingId] = useState<string | null>(
    null
  );
  const [invitedLiveParticipantIds, setInvitedLiveParticipantIds] = useState<
    number[]
  >([]);
  const [connectedLiveParticipantIds, setConnectedLiveParticipantIds] = useState<
    number[]
  >([]);
  const [liveMeetingStartedAt, setLiveMeetingStartedAt] = useState<Date | null>(
    null
  );
  const [liveMeetingElapsedSeconds, setLiveMeetingElapsedSeconds] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dashboardTasks, setDashboardTasks] = useState<Task[]>([]);
  const [dashboardPeriod, setDashboardPeriod] =
    useState<DashboardPeriod>("week");
  const [dashboardSelection, setDashboardSelection] =
    useState<DashboardSelection>(null);
  const [activeSection, setActiveSection] = useState<AppSection>("dashboard");
  const [openedHistoryMeetingId, setOpenedHistoryMeetingId] = useState<
    number | null
  >(null);
  const [historyTitle, setHistoryTitle] = useState("");
  const [historyDate, setHistoryDate] = useState("");
  const [historyMessage, setHistoryMessage] = useState("");
  const [historyParticipants, setHistoryParticipants] = useState<Employee[]>([]);
  const [historyTasks, setHistoryTasks] = useState<Task[]>([]);
  const [isEditingHistory, setIsEditingHistory] = useState(false);
  const [editedHistoryReport, setEditedHistoryReport] = useState("");
  const [editedTitle, setEditedTitle] = useState("");
  const [editedHistoryTitle, setEditedHistoryTitle] = useState("");
  const [isCurrentParticipantsOpen, setIsCurrentParticipantsOpen] =
    useState(false);
  const [isCurrentTasksOpen, setIsCurrentTasksOpen] = useState(false);
  const [isHistoryParticipantsOpen, setIsHistoryParticipantsOpen] =
    useState(false);
  const [isHistoryTasksOpen, setIsHistoryTasksOpen] = useState(false);
  const [historyScrollBeforeOpen, setHistoryScrollBeforeOpen] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const employeeNameInputRef = useRef<HTMLInputElement | null>(null);
  const dashboardSearchInputRef = useRef<HTMLInputElement | null>(null);
  const meetingSearchInputRef = useRef<HTMLInputElement | null>(null);
  const employeeSearchInputRef = useRef<HTMLInputElement | null>(null);
const [openTaskMenuId, setOpenTaskMenuId] = useState<number | null>(null);
const [openMeetingMenuId, setOpenMeetingMenuId] = useState<number | null>(null);
const [openFolderMenuId, setOpenFolderMenuId] = useState<number | null>(null);
const [openEmployeeMenuId, setOpenEmployeeMenuId] = useState<number | null>(null);
const [openTrashMeetingMenuId, setOpenTrashMeetingMenuId] = useState<
  number | null
>(null);
const [selectedEmployeeProfile, setSelectedEmployeeProfile] =
  useState<Employee | null>(null);
const [selectedResponsible, setSelectedResponsible] = useState("Tous");
const [taskStatusFilter] = useState<
  "all" | "done" | "progress" | "todo"
>("all");
const [currentMeetingDate, setCurrentMeetingDate] = useState("");
const [showEmployeeModal, setShowEmployeeModal] = useState(false);
const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
const [employeeForm, setEmployeeForm] = useState({
  name: "",
  role: "",
  email: "",
});
const [newResponsibleTaskId, setNewResponsibleTaskId] = useState<number | null>(
  null
);
const [newResponsibleForm, setNewResponsibleForm] = useState({
  name: "",
  role: "",
  email: "",
});
const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
const [editedTaskAction, setEditedTaskAction] = useState("");
  const closeAllMenus = useCallback(() => {
	    setOpenTaskMenuId(null);
	    setOpenMeetingMenuId(null);
	    setOpenFolderMenuId(null);
	    setOpenEmployeeMenuId(null);
    setOpenTrashMeetingMenuId(null);
    setNewResponsibleTaskId(null);
    setEditingTaskId(null);
    setEditedTaskAction("");
  }, []);

  useEffect(() => {
    loadMeetings();
    loadDeletedMeetings();
	    loadMeetingFolders();
	    loadEmployees();
	    loadMeetingParticipantIndex();
	    loadDashboardTasks();
	  }, []);

  useEffect(() => {
    if (!isRecording || !liveMeetingStartedAt) {
      return;
    }

    const updateElapsedTime = () => {
      setLiveMeetingElapsedSeconds(
        Math.floor((Date.now() - liveMeetingStartedAt.getTime()) / 1000)
      );
    };

    updateElapsedTime();
    const intervalId = window.setInterval(updateElapsedTime, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRecording, liveMeetingStartedAt]);

  useEffect(() => {
    if (!showEmployeeModal) {
      return;
    }

    window.setTimeout(() => employeeNameInputRef.current?.focus(), 0);
  }, [showEmployeeModal]);

  useEffect(() => {
    if (message !== GENERATING_REPORT_MESSAGE) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setGenerationStepIndex((currentStep) => Math.min(currentStep + 1, 3));
    }, 1300);

    return () => window.clearInterval(intervalId);
  }, [message]);

  useEffect(() => {
    function closeTopMostPopup() {
      if (pendingCloseTarget) {
        setPendingCloseTarget(null);
        return true;
      }
      if (showSendReportModal) {
        setShowSendReportModal(false);
        return true;
      }
      if (showParticipantsModal) {
        setShowParticipantsModal(false);
        return true;
      }
      if (showInviteParticipantsModal) {
        setShowInviteParticipantsModal(false);
        return true;
      }
      if (showBulkTasksModal) {
        setShowBulkTasksModal(false);
        return true;
      }
      if (showReminderModal) {
        closeReminderModal();
        return true;
      }
      if (showFolderModal) {
        closeFolderModal();
        return true;
      }
      if (showEmailModal) {
        setShowEmailModal(false);
        return true;
      }
      if (showEmployeeModal) {
        setShowEmployeeModal(false);
        return true;
      }
      if (showTrash) {
        setShowTrash(false);
        return true;
      }

      return false;
    }

    function handleKeyboardShortcuts(event: KeyboardEvent) {
      const target = event.target;
      const isTextInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (event.key === "Escape" && closeTopMostPopup()) {
        event.preventDefault();
        return;
      }

      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "f") {
        event.preventDefault();
        const searchInput =
          activeSection === "history"
            ? meetingSearchInputRef.current
            : activeSection === "collaborators"
              ? employeeSearchInputRef.current
              : dashboardSearchInputRef.current;
        searchInput?.focus();
        return;
      }

      if (key === "n" && !isTextInput) {
        event.preventDefault();
        setActiveSection("new");
      }
    }

    document.addEventListener("keydown", handleKeyboardShortcuts);

    return () => {
      document.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, [
    activeSection,
    pendingCloseTarget,
    showBulkTasksModal,
    showEmailModal,
    showEmployeeModal,
    showFolderModal,
    showInviteParticipantsModal,
    showParticipantsModal,
    showReminderModal,
    showSendReportModal,
    showTrash,
  ]);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        closeAllMenus();
        return;
      }

      if (target.closest("[data-menu-trigger], [data-menu-content]")) {
        return;
      }

      closeAllMenus();
    }

    document.addEventListener("click", handleDocumentClick);

    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [closeAllMenus]);

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

	  async function loadMeetingFolders() {
	    const { data, error } = await supabase
	      .from("meeting_folders")
	      .select("*")
	      .order("created_at", { ascending: false });
	
	    if (error) {
	      console.error("Erreur Supabase chargement dossiers:", error);
	      setMeetingFolders([]);
	      return;
	    }
		
		    setMeetingFolders((data || []) as MeetingFolder[]);
		  }
	
  function openCreateFolderModal() {
    setFolderModalMode("create");
    setActiveFolder(null);
    setFolderName("");
    setSelectedFolderMeetingIds([]);
    setFolderStatus("");
    setShowFolderModal(true);
  }

  function openRenameFolderModal(folder: MeetingFolder) {
    setFolderModalMode("rename");
    setActiveFolder(folder);
    setFolderName(folder.name);
    setSelectedFolderMeetingIds([]);
    setFolderStatus("");
    setShowFolderModal(true);
  }

  function openAddMeetingsToFolderModal(folder: MeetingFolder) {
    setFolderModalMode("add");
    setActiveFolder(folder);
    setFolderName(folder.name);
    setSelectedFolderMeetingIds([]);
    setFolderStatus("");
    setShowFolderModal(true);
  }

  function openRemoveMeetingsFromFolderModal(folder: MeetingFolder) {
    setFolderModalMode("remove");
    setActiveFolder(folder);
    setFolderName(folder.name);
    setSelectedFolderMeetingIds([]);
    setFolderStatus("");
    setShowFolderModal(true);
  }

  function closeFolderModal() {
    setShowFolderModal(false);
    setActiveFolder(null);
    setFolderName("");
    setSelectedFolderMeetingIds([]);
    setFolderStatus("");
  }

  async function updateMeetingFolder(meetingIds: number[], folderId: number | null) {
    if (meetingIds.length === 0) return true;

	    const { error } = await supabase
	      .from("meetings")
	      .update({ folder_id: folderId })
	      .in("id", meetingIds);
	
	    if (error) {
	      console.error("Erreur Supabase classement réunions:", error);
	      setFolderStatus("Impossible de mettre à jour le dossier. Consulte la console pour le détail.");
	      return false;
	    }

    setMeetings((currentMeetings) =>
      currentMeetings.map((meeting) =>
	        meetingIds.includes(meeting.id)
	          ? { ...meeting, folder_id: folderId }
	          : meeting
	      )
    );
    return true;
  }

  async function submitFolderModal() {
    const trimmedName = folderName.trim();

    if ((folderModalMode === "create" || folderModalMode === "rename") && !trimmedName) {
      setFolderStatus("Indique un nom de dossier.");
      return;
    }

    if (folderModalMode === "create") {
      const { data, error } = await supabase
        .from("meeting_folders")
        .insert({
          name: trimmedName,
          description: null,
          color: null,
        })
        .select("*")
        .single();

      if (error || !data) {
        console.error("Erreur Supabase création dossier:", error);
        setFolderStatus("Impossible de créer le dossier. Consulte la console pour le détail.");
        return;
      }

      const createdFolder = data as MeetingFolder;
      setMeetingFolders((currentFolders) => [createdFolder, ...currentFolders]);
      setExpandedFolderIds((currentIds) => [
        ...new Set([...currentIds, createdFolder.id]),
      ]);

      const updated = await updateMeetingFolder(
        selectedFolderMeetingIds,
        createdFolder.id
      );

      if (updated) closeFolderModal();
      return;
    }

    if (!activeFolder) return;

    if (folderModalMode === "rename") {
      const { error } = await supabase
        .from("meeting_folders")
        .update({ name: trimmedName })
        .eq("id", activeFolder.id);

      if (error) {
        console.error("Erreur Supabase renommage dossier:", error);
        setFolderStatus("Impossible de renommer le dossier. Consulte la console pour le détail.");
        return;
      }

      setMeetingFolders((currentFolders) =>
        currentFolders.map((folder) =>
          folder.id === activeFolder.id ? { ...folder, name: trimmedName } : folder
        )
      );
      closeFolderModal();
      return;
    }

    if (folderModalMode === "add") {
      const updated = await updateMeetingFolder(
        selectedFolderMeetingIds,
        activeFolder.id
      );
      if (updated) closeFolderModal();
      return;
    }

    if (folderModalMode === "remove") {
      const updated = await updateMeetingFolder(selectedFolderMeetingIds, null);
      if (updated) closeFolderModal();
    }
  }

  async function deleteFolder(folder: MeetingFolder) {
    const detached = await updateMeetingFolder(
      meetings
        .filter((meeting) => meeting.folder_id === folder.id)
        .map((meeting) => meeting.id),
      null
    );

    if (!detached) return;

    const { error } = await supabase.from("meeting_folders").delete().eq("id", folder.id);

    if (error) {
      console.error("Erreur Supabase suppression dossier:", error);
      setFolderStatus("Impossible de supprimer le dossier. Consulte la console pour le détail.");
      await loadMeetings();
      return;
    }

    setMeetingFolders((currentFolders) =>
      currentFolders.filter((currentFolder) => currentFolder.id !== folder.id)
    );
    setExpandedFolderIds((currentIds) =>
      currentIds.filter((folderId) => folderId !== folder.id)
    );
    closeAllMenus();
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

  async function loadMeetingParticipantIndex() {
    const { data, error } = await supabase
      .from("meeting_participants")
      .select("meeting_id, employees(*)");

    if (error) {
      console.warn("Impossible de charger l'index participants:", error);
      setMeetingParticipantsByMeetingId({});
      return;
    }

    const rows = (data || []) as MeetingParticipantSearchRow[];
    const participantsByMeetingId: Record<number, Employee[]> = {};

    rows.forEach((row) => {
      const participantList = Array.isArray(row.employees)
        ? row.employees
        : row.employees
          ? [row.employees]
          : [];

      participantsByMeetingId[row.meeting_id] = [
        ...(participantsByMeetingId[row.meeting_id] || []),
        ...participantList,
      ];
    });

    setMeetingParticipantsByMeetingId(participantsByMeetingId);
  }

  async function loadDashboardTasks() {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setDashboardTasks((data || []) as Task[]);
  }

  function startLiveMeetingSession() {
    const startedAt = new Date();

    setActiveLiveMeetingId(`live-${Date.now()}`);
    setLiveMeetingStartedAt(startedAt);
    setLiveMeetingElapsedSeconds(0);
    setInvitedLiveParticipantIds([]);
    setConnectedLiveParticipantIds([]);
    setPendingInviteEmployeeIds([]);
  }

  function endLiveMeetingSession() {
    setActiveLiveMeetingId(null);
    setLiveMeetingStartedAt(null);
    setLiveMeetingElapsedSeconds(0);
    setInvitedLiveParticipantIds([]);
    setConnectedLiveParticipantIds([]);
    setPendingInviteEmployeeIds([]);
    setShowInviteParticipantsModal(false);
  }

  function inviteLiveParticipants(employeeIds: number[]) {
    setInvitedLiveParticipantIds((currentIds) => [
      ...new Set([
        ...currentIds,
        ...employeeIds.filter(
          (employeeId) => !connectedLiveParticipantIds.includes(employeeId)
        ),
      ]),
    ]);
    setPendingInviteEmployeeIds([]);
    setShowInviteParticipantsModal(false);
  }

  function markLiveParticipantAsJoined(employeeId: number) {
    setConnectedLiveParticipantIds((currentIds) => [
      ...new Set([...currentIds, employeeId]),
    ]);
    setInvitedLiveParticipantIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== employeeId)
    );
    setPendingInviteEmployeeIds((currentIds) =>
      currentIds.filter((currentId) => currentId !== employeeId)
    );
  }

  function openManualParticipantsFallback() {
    setPendingParticipantIds(connectedLiveParticipantIds);
    setParticipantSearch("");
    setShowParticipantsModal(true);
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

    setShowEmployeeModal(false);
    setEditingEmployee(null);
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

    setEmployeeForm({ name: "", role: "", email: "" });
    setShowEmployeeModal(false);
  }

  await loadEmployees();
}

async function deleteEmployee(id: number) {
  const confirmed = window.confirm(
    "Supprimer ce collaborateur ?"
  );

  if (!confirmed) return;

  const detachedTaskPayload = {
    responsible_employee_id: null,
    responsible: null,
  };

  const { error: detachError } = await supabase
    .from("tasks")
    .update(detachedTaskPayload)
    .eq("responsible_employee_id", id);

  if (detachError) {
    console.error("Erreur Supabase détachement tâches collaborateur :", detachError);
    alert(
      detachError.message ||
        "Impossible de détacher les tâches liées à ce collaborateur."
    );
    return;
  }

  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erreur Supabase suppression collaborateur :", error);
    alert(
      error.message ||
        "Erreur lors de la suppression du collaborateur. Vérifie les relations Supabase."
    );
    return;
  }

  const detachLocalTask = (task: Task) =>
    task.responsible_employee_id === id
      ? {
          ...task,
          responsible_employee_id: null,
          responsible: null,
        }
      : task;

  setEmployees((currentEmployees) =>
    currentEmployees.filter((employee) => employee.id !== id)
  );
  setTasks((currentTasks) => currentTasks.map(detachLocalTask));
  setHistoryTasks((currentTasks) => currentTasks.map(detachLocalTask));
  setSelectedEmployees((currentSelectedEmployees) =>
    currentSelectedEmployees.filter((employeeId) => employeeId !== id)
  );
  setPendingParticipantIds((currentPendingParticipantIds) =>
    currentPendingParticipantIds.filter((employeeId) => employeeId !== id)
  );
  setEmailRecipients((currentEmailRecipients) =>
    currentEmailRecipients.filter((employeeId) => employeeId !== id)
  );
  if (selectedEmployeeProfile?.id === id) {
    setSelectedEmployeeProfile(null);
  }
  closeAllMenus();
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
  function normalizeText(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getRoleScore(action: string, role: string) {
    const normalizedAction = normalizeText(action);
    const roleWords = normalizeText(role)
      .split(" ")
      .filter((word) => word.length > 2);

    if (roleWords.length === 0) {
      return 0;
    }

    const matches = roleWords.filter((word) =>
      normalizedAction.includes(word)
    ).length;

    return Math.min(30, Math.round((matches / roleWords.length) * 30));
  }

  function scoreEmployeeForTask(task: TaskFromAI, employee: Employee) {
    const evidenceText = normalizeText(
      `${task.responsible || ""} ${task.action}`
    );
    const employeeName = normalizeText(employee.name);
    const nameParts = employeeName
      .split(" ")
      .filter((part) => part.length > 1);
    const roleScore = getRoleScore(task.action, employee.role || "");

    if (employeeName && evidenceText.includes(employeeName)) {
      return 90 + Math.min(10, roleScore);
    }

    const matchedNameParts = nameParts.filter((part) =>
      evidenceText.includes(part)
    ).length;

    if (matchedNameParts > 0) {
      const baseScore = matchedNameParts === nameParts.length ? 85 : 65;
      return Math.min(100, baseScore + roleScore);
    }

    return roleScore;
  }

  function findBestResponsible(task: TaskFromAI) {
    const aiEmployee = task.responsible_employee_id
      ? employees.find((employee) => employee.id === task.responsible_employee_id)
      : null;
    const aiConfidence = aiEmployee ? scoreEmployeeForTask(task, aiEmployee) : 0;

    if (aiEmployee && aiConfidence >= 60) {
      return {
        employee: aiEmployee,
        confidence: aiConfidence,
      };
    }

    const candidates = employees
      .map((employee) => ({
        employee,
        confidence: scoreEmployeeForTask(task, employee),
      }))
      .sort((a, b) => b.confidence - a.confidence);
    const bestCandidate = candidates[0];

    if (!bestCandidate || bestCandidate.confidence < 60) {
      return {
        employee: null,
        confidence: bestCandidate?.confidence || 0,
      };
    }

    return bestCandidate;
  }

  function normalizeTaskDueDate(dueDate: string | null | undefined) {
    if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return null;
    }

    const parsedDate = new Date(`${dueDate}T00:00:00`);

    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return dueDate;
  }

  function isMissingCompletedAtColumnError(error: unknown) {
    if (!error || typeof error !== "object") {
      return false;
    }

    const errorText = Object.values(error)
      .filter((value) => typeof value === "string")
      .join(" ")
      .toLowerCase();

    return errorText.includes("completed_at");
  }

  async function saveTasks(meetingId: number, tasks: TaskFromAI[] = []) {
  if (!tasks || tasks.length === 0) return;

  const tasksToInsert = tasks.map((task) => {
  const assignment = findBestResponsible(task);

  return {
    meeting_id: meetingId,
    action: task.action,
    responsible: assignment.employee?.name || null,
    responsible_employee_id: assignment.employee?.id || null,
    due_date: normalizeTaskDueDate(task.due_date),
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
	  tasks: TaskFromAI[] = [],
	  participantIds: number[] = selectedEmployees,
	  folderId: number | null = null
) {
    const meetingPayload: {
      title: string;
      report: string;
      file_name: string;
      folder_id?: number | null;
    } = {
      title,
      report,
      file_name: fileName,
    };

    if (folderId) {
      meetingPayload.folder_id = folderId;
    }

    let { data, error } = await supabase
      .from("meetings")
      .insert(meetingPayload)
      .select()
      .single();

    if (error && "folder_id" in meetingPayload) {
      console.warn(
        "La colonne meetings.folder_id n'est pas disponible, sauvegarde sans dossier:",
        error
      );
      const fallbackPayload = {
        title,
        report,
        file_name: fileName,
      };
      const fallbackResponse = await supabase
        .from("meetings")
        .insert(fallbackPayload)
        .select()
        .single();

      data = fallbackResponse.data;
      error = fallbackResponse.error;
    }

    if (error) {
      console.error(error);
      return null;
  
    }
if (data) {
  setCurrentMeetingId(data.id);

  const selectedParticipants = employees.filter((employee) =>
    participantIds.includes(employee.id)
  );

  setCurrentParticipants(selectedParticipants);

  await loadMeetingTasks(data.id);
}
if (data) {
  await saveTasks(data.id, tasks);
}
    if (data && participantIds.length > 0) {
      const participantsToInsert = participantIds.map((employeeId) => ({
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
		    await loadMeetingParticipantIndex();
		    await loadDashboardTasks();
		    return data.id;
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
      startLiveMeetingSession();
    } catch (error) {
      console.error(error);
      setMessage("Impossible d'accéder au micro.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current) {
      if (liveMeetingStartedAt) {
        setLiveMeetingElapsedSeconds(
          Math.floor((Date.now() - liveMeetingStartedAt.getTime()) / 1000)
        );
      }

      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => {
        track.stop();
      });
      setIsRecording(false);
    }
  }

  async function handleUpload(participantIds: number[] = selectedEmployees) {
    if (!file) {
      setReportError("Choisis ou enregistre un fichier audio.");
      setMessage("");
      return;
    }

    try {
      setCurrentTitle("");
      setReportError("");
      setGenerationStepIndex(0);
      setMessage(GENERATING_REPORT_MESSAGE);

      const selectedParticipants = employees.filter((employee) =>
        participantIds.includes(employee.id)
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
        setReportError(data.error || "Erreur pendant la génération.");
        setMessage("");
        return;
      }

      setReportError("");
      setCurrentTitle(data.title);
setMessage(data.report);

const savedMeetingId = await saveMeeting(
  data.title,
  data.report,
  file.name,
  data.tasks || [],
  participantIds
);

if (!savedMeetingId) {
  setReportError("Le compte rendu a été généré, mais la sauvegarde a échoué.");
  setMessage("");
  return;
}

await loadMeetingTasks(savedMeetingId);
setCurrentMeetingId(savedMeetingId);
setCurrentTitle(data.title);
setMessage(data.report);
setCurrentMeetingDate(new Date().toLocaleString("fr-FR"));
setCurrentParticipants(selectedParticipants);
setIsCurrentParticipantsOpen(false);
setIsCurrentTasksOpen(false);
endLiveMeetingSession();
setActiveSection("report");
      
    } catch (error) {
      console.error(error);
      setReportError("Erreur lors de l'envoi.");
      setMessage("");
    }
  }
function getBrieflyReportUrl(meetingId: number | null | undefined) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BRIEFLY_REPORT_URL ||
    (typeof window !== "undefined" ? window.location.origin : "https://briefly.app");

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  return meetingId ? `${normalizedBaseUrl}?meeting=${meetingId}` : normalizedBaseUrl;
}

function getEmailSummary(report: string) {
  const cleanReport = report
    .replace(/^#+\s+/gm, "")
    .replace(/\*\*/g, "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .find(Boolean);

  if (!cleanReport) {
    return "Le compte rendu de la réunion est disponible dans Briefly.";
  }

  return cleanReport.length > 360
    ? `${cleanReport.slice(0, 360).trim()}...`
    : cleanReport;
}

function getOpenTasksForEmployee(sourceTasks: Task[], employee: Employee) {
  const employeeName = employee.name.toLowerCase().trim();

  return sourceTasks.filter((task) => {
    if (normalizeTaskStatus(task.status) === "Fait") {
      return false;
    }

    if (task.responsible_employee_id) {
      return task.responsible_employee_id === employee.id;
    }

    const responsibleName = task.responsible?.toLowerCase().trim();
    if (!responsibleName) {
      return false;
    }

    return (
      responsibleName === employeeName ||
      responsibleName.includes(employeeName) ||
      employeeName.includes(responsibleName)
    );
  });
}

async function sendMeetingPackage({
  title,
  report,
  meetingDate,
  participants,
  sourceTasks,
  meetingId,
}: {
  title: string;
  report: string;
  meetingDate: string;
  participants: Employee[];
  sourceTasks: Task[];
  meetingId: number | null;
}) {
  if (!report || report === GENERATING_REPORT_MESSAGE) {
    setEmailStatus("Aucun compte rendu à envoyer.");
    return;
  }

  const uniqueParticipants = [
    ...new Map(participants.map((participant) => [participant.id, participant])).values(),
  ];

  if (uniqueParticipants.length === 0) {
    setEmailStatus("Aucun participant renseigné pour cet envoi.");
    return;
  }

  const participantsWithEmail = uniqueParticipants.filter((participant) =>
    participant.email?.trim()
  );
  const missingEmailCount = uniqueParticipants.length - participantsWithEmail.length;

  if (participantsWithEmail.length === 0) {
    setEmailStatus("Aucun participant ne possède d'email renseigné.");
    return;
  }

  try {
    setEmailStatus("Envoi en cours...");

    let includedTaskCount = 0;

    for (const participant of participantsWithEmail) {
      const participantTasks = getOpenTasksForEmployee(sourceTasks, participant);
      includedTaskCount += participantTasks.length;

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: [participant.email],
          title,
          meetingDate,
          participants: uniqueParticipants.map((employee) => employee.name),
          summary: getEmailSummary(report),
          report,
          tasks: participantTasks.map((task) => ({
            action: task.action,
            due_date: task.due_date,
            status: normalizeTaskStatus(task.status),
          })),
          ctaUrl: getBrieflyReportUrl(meetingId),
          subject: `Compte rendu - ${title}`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur pendant l'envoi.");
      }
    }

    const missingMessage =
      missingEmailCount > 0
        ? ` ${missingEmailCount} participant(s) ignoré(s) sans email.`
        : "";

    setEmailStatus(
      `${participantsWithEmail.length} email(s) envoyé(s). ${includedTaskCount} tâche(s) intégrée(s).${missingMessage}`
    );
  } catch (error) {
    console.error(error);
    setEmailStatus("Erreur pendant l'envoi de l'email.");
  }
}

function openSendReportModal(context: "current" | "history") {
  const participants =
    context === "current" ? currentParticipants : historyParticipants;

  setSendReportContext(context);
  setEmailRecipients(participants.map((participant) => participant.id));
  setIsSendParticipantsOpen(false);
  setIsSendOthersOpen(false);
  setShowSendReportModal(true);
}

async function confirmSendReportModal() {
  const selectedRecipients = employees.filter((employee) =>
    emailRecipients.includes(employee.id)
  );

  await sendMeetingPackage({
    title:
      sendReportContext === "current"
        ? currentTitle || "Compte rendu de réunion"
        : historyTitle || "Compte rendu de réunion",
    report: sendReportContext === "current" ? message : historyMessage,
    meetingDate:
      sendReportContext === "current" ? currentMeetingDate : historyDate,
    participants: selectedRecipients,
    sourceTasks: sendReportContext === "current" ? tasks : historyTasks,
    meetingId:
      sendReportContext === "current" ? currentMeetingId : openedHistoryMeetingId,
  });

  setShowSendReportModal(false);
}

async function sendEmailToParticipants() {
const selectedRecipients = employees.filter((employee) =>
  emailRecipients.includes(employee.id)
);

await sendMeetingPackage({
  title: currentTitle || "Compte rendu de réunion",
  report: message,
  meetingDate: currentMeetingDate,
  participants: selectedRecipients,
  sourceTasks: tasks,
  meetingId: currentMeetingId,
});

setShowEmailModal(false);
}
async function saveEditedReport() {
  if (!currentMeetingId) {
    setIsEditing(false);
    return;
  }

  const nextTitle = editedTitle.trim() || currentTitle || "Compte rendu de réunion";

  const { error } = await supabase
    .from("meetings")
    .update({
      title: nextTitle,
      report: editedReport,
    })
    .eq("id", currentMeetingId);

  if (error) {
    console.error(error);
    alert("Erreur lors de la sauvegarde.");
    return;
  }

  await loadMeetings();
  setCurrentTitle(nextTitle);
  setMessage(editedReport);
  setEditedTitle("");
  setEditedReport("");
  setIsEditing(false);
}
  function formatPdfDate(date: string | null | undefined) {
    if (!date) {
      return "Non renseignée";
    }

    return date;
  }

  function formatCompletedAt(date: string | null | undefined) {
    if (!date) {
      return "";
    }

    const parsedDate = new Date(date);

    if (Number.isNaN(parsedDate.getTime())) {
      return date;
    }

    return parsedDate.toLocaleString("fr-FR");
  }

  function formatLiveMeetingDuration(seconds: number) {
    const safeSeconds = Math.max(0, seconds);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;

    return [hours, minutes, remainingSeconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  function parseReportSections(report: string) {
    const sections: { title: string; content: string }[] = [];
    let currentTitle = "Compte rendu";
    let currentContent: string[] = [];

    report.split("\n").forEach((line) => {
      const headingMatch = line.match(/^#\s+(.+)$/);

      if (headingMatch) {
        if (currentContent.join("").trim()) {
          sections.push({
            title: currentTitle,
            content: currentContent.join("\n").trim(),
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
        content: currentContent.join("\n").trim(),
      });
    }

    return sections;
  }

  function downloadReportPDF({
    title,
    report,
    date,
    participants,
    reportTasks,
    fileName,
  }: {
    title: string;
    report: string;
    date: string;
    participants: Employee[];
    reportTasks: Task[];
    fileName: string;
  }) {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;
    let y = 22;

    const ensureSpace = (height: number) => {
      if (y + height <= pageHeight - margin) return;
      doc.addPage();
      y = margin;
    };

    const addWrappedText = (
      text: string,
      x: number,
      maxWidth: number,
      lineHeight: number
    ) => {
      const lines = doc.splitTextToSize(text, maxWidth) as string[];
      lines.forEach((line) => {
        ensureSpace(lineHeight + 2);
        doc.text(line, x, y);
        y += lineHeight;
      });
    };

    const participantsText =
      participants.length > 0
        ? participants
            .map((participant) => {
              const role = participant.role ? ` (${participant.role})` : "";
              return `${participant.name}${role}`;
            })
            .join(", ")
        : "Aucun participant renseigné";
    const pendingTasks = reportTasks.filter(
      (task) => normalizeTaskStatus(task.status) !== "Fait"
    );

    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    addWrappedText(title || "Compte rendu de réunion", margin, contentWidth, 8.5);
    y += 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    doc.text(`Date : ${date || "Non renseignée"}`, margin, y);
    y += 7;
    addWrappedText(`Participants : ${participantsText}`, margin, contentWidth, 6);
    y += 4;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    parseReportSections(report).forEach((section) => {
      ensureSpace(28);
      doc.setFillColor(243, 244, 246);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(margin, y, contentWidth, 11, 2, 2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(17, 24, 39);
      doc.text(section.title, margin + 4, y + 7);
      y += 17;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(55, 65, 81);
      addWrappedText(section.content, margin, contentWidth, 6);
      y += 5;
    });

    ensureSpace(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 24, 39);
    doc.text("Tâches à faire", margin, y);
    y += 8;

    if (pendingTasks.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(75, 85, 99);
      doc.text("Aucune tâche à faire", margin, y);
      y += 7;
    } else {
      pendingTasks.forEach((task) => {
        const metaText = `Responsable : ${
          task.responsible || "Non attribué"
        }   ·   Échéance : ${formatPdfDate(
          task.due_date
        )}   ·   Statut : ${normalizeTaskStatus(task.status)}`;
        const actionLines = doc.splitTextToSize(
          task.action,
          contentWidth - 8
        ) as string[];
        const metaLines = doc.splitTextToSize(
          metaText,
          contentWidth - 8
        ) as string[];
        const cardHeight =
          12 + actionLines.length * 5.5 + metaLines.length * 5;

        ensureSpace(cardHeight + 8);
        const cardY = y;
        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(229, 231, 235);
        doc.roundedRect(margin, cardY, contentWidth, cardHeight, 3, 3, "FD");
        y += 7;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(17, 24, 39);
        actionLines.forEach((line) => {
          doc.text(line, margin + 4, y);
          y += 5.5;
        });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(75, 85, 99);
        metaLines.forEach((line) => {
          doc.text(line, margin + 4, y);
          y += 5;
        });
        y = cardY + cardHeight + 6;
      });
    }

    doc.save(fileName);
  }

  function downloadCurrentReportPDF() {
    downloadReportPDF({
      title: currentTitle || "Compte rendu de réunion",
      report: message,
      date: currentMeetingDate,
      participants: currentParticipants,
      reportTasks: tasks,
      fileName: currentMeetingId
        ? `compte-rendu-${currentMeetingId}.pdf`
        : "compte-rendu-reunion.pdf",
    });
  }

  async function fetchMeetingPdfData(meetingId: number) {
    const [tasksResponse, participantsResponse] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true }),
      supabase
        .from("meeting_participants")
        .select("employees(*)")
        .eq("meeting_id", meetingId),
    ]);

    if (tasksResponse.error) {
      console.error(tasksResponse.error);
      throw tasksResponse.error;
    }

    if (participantsResponse.error) {
      console.error(participantsResponse.error);
      throw participantsResponse.error;
    }

    const meetingParticipants =
      (participantsResponse.data as MeetingParticipantRow[] | null)
        ?.flatMap((item) => item.employees || [])
        ?.filter((employee): employee is Employee => Boolean(employee)) || [];

    return {
      reportTasks: (tasksResponse.data || []) as Task[],
      participants: meetingParticipants,
    };
  }

  async function downloadMeetingPDF(meeting: Meeting) {
    try {
      const { reportTasks, participants } = await fetchMeetingPdfData(meeting.id);

      downloadReportPDF({
          title: meeting.title || "Compte rendu de réunion",
          report: meeting.report,
          date: new Date(meeting.created_at).toLocaleString("fr-FR"),
          participants,
          reportTasks,
          fileName: `compte-rendu-${meeting.id}.pdf`,
        });
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la préparation du PDF.");
    }
  }

  async function saveEditedHistoryReport() {
    if (!openedHistoryMeetingId) {
      setIsEditingHistory(false);
      return;
    }

    const nextTitle =
      editedHistoryTitle.trim() || historyTitle || "Compte rendu de réunion";

    const { error } = await supabase
      .from("meetings")
      .update({
        title: nextTitle,
        report: editedHistoryReport,
      })
      .eq("id", openedHistoryMeetingId);

    if (error) {
      console.error(error);
      alert("Erreur lors de la sauvegarde.");
      return;
    }

    setHistoryTitle(nextTitle);
    setHistoryMessage(editedHistoryReport);
    setEditedHistoryTitle("");
    setEditedHistoryReport("");
    setIsEditingHistory(false);
    await loadMeetings();
  }

  function downloadHistoryReportPDF() {
    downloadReportPDF({
        title: historyTitle || "Compte rendu de réunion",
        report: historyMessage,
        date: historyDate,
        participants: historyParticipants,
        reportTasks: historyTasks,
        fileName: openedHistoryMeetingId
        ? `compte-rendu-${openedHistoryMeetingId}.pdf`
        : "compte-rendu-reunion.pdf",
      });
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
function updateTaskEverywhere(
  taskId: number,
  updater: (currentTask: Task) => Task
) {
  const updateMatchingTasks = (currentTasks: Task[]) =>
    currentTasks.map((currentTask) =>
      currentTask.id === taskId ? updater(currentTask) : currentTask
    );

  setTasks(updateMatchingTasks);
  setHistoryTasks(updateMatchingTasks);
  setBulkTaskSource(updateMatchingTasks);
  setDashboardTasks(updateMatchingTasks);
}

function normalizeTaskStatus(status: string | null | undefined): TaskStatus {
  if (status === "En cours" || status === "Fait") {
    return status;
  }

  return "À faire";
}

function getNextTaskStatus(task: Task): TaskStatus {
  const currentStatus = normalizeTaskStatus(task.status);

  if (currentStatus === "À faire") {
    return "En cours";
  }

  if (currentStatus === "En cours") {
    return "Fait";
  }

  return "À faire";
}

async function updateTaskStatus(task: Task, status: TaskStatus) {
  const completedAt = status === "Fait" ? new Date().toISOString() : null;
  const updatePayload = {
    status,
    completed_at: completedAt,
  };

  const { error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", task.id);

  if (error) {
    if (isMissingCompletedAtColumnError(error)) {
      console.warn(
        "Colonne completed_at absente dans Supabase. Le statut est sauvegardé sans completed_at.",
        error
      );

      const { error: fallbackError } = await supabase
        .from("tasks")
        .update({ status })
        .eq("id", task.id);

      if (fallbackError) {
        console.error(fallbackError);
        return;
      }
	    } else {
	      console.error(error);
	      return;
	    }
  }

  updateTaskEverywhere(task.id, (currentTask) => ({
    ...currentTask,
    status,
    completed_at: completedAt,
  }));
}

async function updateTaskAction(task: Task) {
  const nextAction = editedTaskAction.trim();

  if (!nextAction) {
    alert("Le texte de la tâche ne peut pas être vide.");
    return;
  }

  const { error } = await supabase
    .from("tasks")
    .update({ action: nextAction })
    .eq("id", task.id);

  if (error) {
    console.error(error);
    alert("Erreur lors de la modification de la tâche.");
    return;
  }

  updateTaskEverywhere(task.id, (currentTask) => ({
    ...currentTask,
    action: nextAction,
  }));
  setEditingTaskId(null);
  setEditedTaskAction("");
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

  const removeTask = (currentTasks: Task[]) =>
    currentTasks.filter((task) => task.id !== taskId);

  setTasks(removeTask);
  setHistoryTasks(removeTask);
  setBulkTaskSource(removeTask);
  setDashboardTasks(removeTask);
  setSelectedBulkTaskIds((currentIds) =>
    currentIds.filter((currentId) => currentId !== taskId)
  );

  closeAllMenus();
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

  updateTaskEverywhere(taskId, (task) => ({
    ...task,
    due_date: dueDate || null,
  }));
}
async function updateTaskResponsible(task: Task, employeeId: number) {
  const employee = employees.find((e) => e.id === employeeId);

  if (!employee) {
    alert("Collaborateur introuvable.");
    return;
  }

  const updatePayload = {
    responsible: employee.name,
    responsible_employee_id: employee.id,
  };

  const { error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", task.id);

  if (error) {
    console.error(error);
    alert("Erreur lors de la modification du responsable.");
    return;
  }

  updateTaskEverywhere(task.id, (currentTask) => ({
    ...currentTask,
    responsible: employee.name,
    responsible_employee_id: employee.id,
  }));

  closeAllMenus();
}

async function createResponsibleAndAssignTask(task: Task) {
  if (!newResponsibleForm.name.trim()) {
    alert("Le nom du responsable est obligatoire.");
    return;
  }

  const { data, error } = await supabase
    .from("employees")
    .insert({
      name: newResponsibleForm.name.trim(),
      role: newResponsibleForm.role.trim(),
      email: newResponsibleForm.email.trim(),
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error(error);
    alert("Erreur lors de la création du responsable.");
    return;
  }

  const newEmployee = data as Employee;
  const updatePayload = {
    responsible: newEmployee.name,
    responsible_employee_id: newEmployee.id,
  };

  const { error: updateError } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", task.id);

  if (updateError) {
    console.error(updateError);
    alert("Le collaborateur a été créé, mais la tâche n'a pas pu être assignée.");
    setEmployees((currentEmployees) =>
      [...currentEmployees, newEmployee].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    return;
  }

  setEmployees((currentEmployees) =>
    [...currentEmployees, newEmployee].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  );
  updateTaskEverywhere(task.id, (currentTask) => ({
    ...currentTask,
    responsible: newEmployee.name,
    responsible_employee_id: newEmployee.id,
  }));
  setNewResponsibleForm({ name: "", role: "", email: "" });
  closeAllMenus();
}

function getTaskResponsibleEmployeeId(task: Task) {
  if (task.responsible_employee_id) {
    return task.responsible_employee_id;
  }

  const responsibleName = task.responsible?.toLowerCase().trim();

  if (!responsibleName) {
    return "";
  }

  return (
    employees.find(
      (employee) => employee.name.toLowerCase().trim() === responsibleName
    )?.id || ""
  );
}

function getTaskDueDateClass(task: Task) {
  const status = normalizeTaskStatus(task.status);

  if (status === "Fait") {
    return "border-green-300 bg-green-50";
  }

  if (status === "En cours") {
    return "border-orange-300 bg-orange-50";
  }

  return "border-red-300 bg-red-50";
}

function getLocalDateIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDashboardPeriodLabel(period: DashboardPeriod) {
  if (period === "week") return "Cette semaine";
  if (period === "month") return "Ce mois";
  if (period === "year") return "Cette année";
  return "Totalité";
}

function isDateInDashboardPeriod(
  dateValue: string | null | undefined,
  period: DashboardPeriod
) {
  if (period === "all") {
    return true;
  }

  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();

  if (period === "year") {
    return date.getFullYear() === now.getFullYear();
  }

  if (period === "month") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  const startOfWeek = new Date(now);
  const dayOfWeek = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return date >= startOfWeek && date < endOfWeek;
}

function getTaskPeriodDate(task: Task, meetingsSource: Meeting[]) {
  const meeting = meetingsSource.find(
    (currentMeeting) => currentMeeting.id === task.meeting_id
  );

  return meeting?.created_at || task.created_at;
}

function getOpenTasks(sourceTasks: Task[]) {
  return sourceTasks.filter(
    (task) => normalizeTaskStatus(task.status) !== "Fait"
  );
}

function dedupeTasksById(sourceTasks: Task[]) {
  return [...new Map(sourceTasks.map((task) => [task.id, task])).values()];
}

function getUrgentTasks(sourceTasks: Task[]) {
  const today = getLocalDateIso();
  const openTasks = getOpenTasks(sourceTasks);

  return {
    overdueTasks: openTasks.filter(
      (task) => Boolean(task.due_date) && task.due_date! < today
    ),
    dueTodayTasks: openTasks.filter((task) => task.due_date === today),
  };
}

function getMeetingFolderById(folderId: number | null | undefined) {
  if (!folderId) return null;
  return meetingFolders.find((folder) => folder.id === folderId) || null;
}

function getMeetingTasks(meetingId: number, sourceTasks: Task[] = dashboardTasks) {
  return sourceTasks.filter((task) => task.meeting_id === meetingId);
}

function getEmptySectionMessage(title: string | null) {
  const normalizedTitle = (title || "").toLowerCase();

  if (normalizedTitle.includes("décision")) {
    return "Aucune décision claire n’a été prise pendant cette réunion.";
  }

  if (normalizedTitle.includes("risque") || normalizedTitle.includes("clarifier")) {
    return "Aucun risque particulier n’a été identifié.";
  }

  if (normalizedTitle.includes("point")) {
    return "Aucun point clé supplémentaire n’a été relevé.";
  }

  return "Aucune information supplémentaire n’a été identifiée.";
}

function hasSensitiveInformation(report: string) {
  return [
    /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/i,
    /\bRIB\b/i,
    /mot de passe|password|identifiant confidentiel/i,
    /salaire|rémunération|bulletin de paie/i,
    /donnée bancaire|carte bancaire|coordonnées bancaires/i,
    /confidentiel|information personnelle|donnée personnelle/i,
  ].some((pattern) => pattern.test(report));
}

function copySectionContent(content: string, label: string) {
  navigator.clipboard
    ?.writeText(content)
    .then(() => {
      setCopiedNotice(`✓ ${label} copié dans le presse-papiers`);
      window.setTimeout(() => setCopiedNotice(""), 2200);
    })
    .catch((error) => {
      console.error(error);
      setCopiedNotice("Impossible de copier cette section.");
      window.setTimeout(() => setCopiedNotice(""), 2200);
    });
}

function toggleReportSection(sectionKey: string) {
  setOpenReportSections((currentSections) => ({
    ...currentSections,
    [sectionKey]: !(currentSections[sectionKey] ?? true),
  }));
}

function renderGenerationProgress() {
  const steps = [
    "🎙️ Transcription audio…",
    "🧠 Analyse de la réunion…",
    "📝 Rédaction du compte rendu…",
    "✅ Vérification finale…",
  ];
  const progress = ((generationStepIndex + 1) / steps.length) * 100;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 space-y-2">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`flex items-center gap-2 text-sm ${
              index <= generationStepIndex ? "text-gray-950" : "text-gray-400"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                index <= generationStepIndex ? "bg-gray-950" : "bg-gray-300"
              }`}
            />
            {step}
          </div>
        ))}
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-gray-900 transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function renderReportContent(report: string) {
  const sections: { title: string | null; content: string[] }[] = [];
  let currentSection: { title: string | null; content: string[] } = {
    title: null,
    content: [],
  };

  report.split("\n").forEach((line) => {
    const headingMatch = line.match(/^#\s+(.+)$/);

    if (headingMatch) {
      if (currentSection.title || currentSection.content.join("").trim()) {
        sections.push(currentSection);
      }

      currentSection = {
        title: headingMatch[1].trim(),
        content: [],
      };
      return;
    }

    currentSection.content.push(line);
  });

  if (currentSection.title || currentSection.content.join("").trim()) {
    sections.push(currentSection);
  }

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {sections.map((section, index) =>
        section.title ? (
          <section
            key={`${section.title}-${index}`}
            className="space-y-4"
          >
            {(() => {
              const sectionKey = `${section.title}-${index}`;
              const sectionText =
                section.content.join("\n").trim() ||
                getEmptySectionMessage(section.title);
              const isOpen = openReportSections[sectionKey] ?? true;

              return (
                <>
                  <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => toggleReportSection(sectionKey)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold text-gray-950"
                    >
                      <span className="text-gray-500">{isOpen ? "▼" : "▶"}</span>
                      <span>{section.title}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        copySectionContent(sectionText, section.title || "Section")
                      }
                      className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 transition hover:bg-gray-100"
                    >
                      📋 Copier
                    </button>
                  </div>

                  {isOpen && (
                    <div className="whitespace-pre-wrap text-[15px] leading-7 text-gray-700">
                      {sectionText}
                    </div>
                  )}
                </>
              );
            })()}
          </section>
        ) : (
          <div
            key={`intro-${index}`}
            className="whitespace-pre-wrap text-[15px] leading-7 text-gray-700"
          >
            {section.content.join("\n").trim()}
          </div>
        )
      )}
    </div>
  );
}

async function askAndUpdateTaskDueDate(task: Task) {
  const dueDate = prompt(
    "Nouvelle échéance au format AAAA-MM-JJ :",
    task.due_date || ""
  );

  if (dueDate === null) return;

  await updateTaskDueDate(task.id, dueDate);
  closeAllMenus();
}
async function sendTaskToResponsible(task: Task) {
  if (!task.responsible_employee_id && !task.responsible) {
    alert("Aucun responsable identifié pour cette tâche.");
    return;
  }

  const responsibleEmployee = task.responsible_employee_id
    ? employees.find((employee) => employee.id === task.responsible_employee_id)
    : employees.find((employee) => {
        const employeeName = employee.name.toLowerCase().trim();
        const responsibleName = task.responsible?.toLowerCase().trim() || "";

        return (
          employeeName === responsibleName ||
          employeeName.includes(responsibleName) ||
          responsibleName.includes(employeeName)
        );
      });

  if (!responsibleEmployee) {
    alert("Responsable introuvable dans la liste des collaborateurs.");
    return;
  }

  if (!responsibleEmployee.email?.trim()) {
    alert(
      `Impossible d'envoyer la tâche : aucun email n'est renseigné pour ${responsibleEmployee.name}.`
    );
    return;
  }

  const isHistoryTask = task.meeting_id === openedHistoryMeetingId;
  const meetingTitle =
    (isHistoryTask ? historyTitle : currentTitle) || "Réunion sans titre";
  const meetingDate = isHistoryTask ? historyDate : currentMeetingDate;
  const meetingParticipants = isHistoryTask
    ? historyParticipants
    : currentParticipants;
  const meetingReport = isHistoryTask ? historyMessage : message;
  const meetingId = isHistoryTask ? openedHistoryMeetingId : currentMeetingId;

  const response = await fetch("/api/send-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      emails: [responsibleEmployee.email],
      title: meetingTitle,
      subject: `Tâche assignée - ${meetingTitle}`,
      meetingDate,
      participants: meetingParticipants.map((participant) => participant.name),
      summary: `Une tâche vous a été assignée suite à la réunion "${meetingTitle}".`,
      report: meetingReport,
      tasks: [
        {
          action: task.action,
          due_date: task.due_date,
          status: normalizeTaskStatus(task.status),
        },
      ],
      ctaUrl: getBrieflyReportUrl(meetingId),
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

function getTaskStatusBadgeClass(status: TaskStatus) {
  if (status === "Fait") {
    return "bg-green-100 text-green-700 hover:bg-green-200";
  }

  if (status === "En cours") {
    return "bg-orange-100 text-orange-700 hover:bg-orange-200";
  }

  return "bg-red-100 text-red-700 hover:bg-red-200";
}

function getTaskStatusLabel(status: TaskStatus) {
  if (status === "Fait") {
    return "🟢 Fait";
  }

  if (status === "En cours") {
    return "🟠 En cours";
  }

  return "🔴 À faire";
}

function renderTaskStatusBadge(task: Task, className = "mt-3") {
  const status = normalizeTaskStatus(task.status);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        updateTaskStatus(task, getNextTaskStatus(task));
      }}
      className={`${className} inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getTaskStatusBadgeClass(
        status
      )}`}
    >
      {getTaskStatusLabel(status)}
    </button>
  );
}

function renderTaskMenu(task: Task) {
  return (
    <>
      <button
        type="button"
        data-menu-trigger
        aria-label={`Ouvrir le menu de la tâche ${task.action}`}
        aria-expanded={openTaskMenuId === task.id}
        onClick={(e) => {
          e.stopPropagation();

          const shouldOpenMenu = openTaskMenuId !== task.id;

          closeAllMenus();

          if (shouldOpenMenu) {
            setOpenTaskMenuId(task.id);
          }
        }}
        className="absolute right-3 top-3 px-2 text-gray-500 hover:text-black"
      >
        ⋯
      </button>

      {openTaskMenuId === task.id && (
        <div
          data-menu-content
          onClick={(e) => e.stopPropagation()}
          className="absolute right-3 top-10 z-50 min-w-[240px] overflow-hidden rounded border bg-white shadow-lg"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditingTaskId(task.id);
              setEditedTaskAction(task.action);
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
          >
            Modifier la tâche
          </button>

          {editingTaskId === task.id && (
            <div className="space-y-2 border-t border-gray-100 px-3 py-2">
              <textarea
                value={editedTaskAction}
                onChange={(e) => setEditedTaskAction(e.target.value)}
                className="min-h-20 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateTaskAction(task);
                  }}
                  className="flex-1 rounded bg-black px-3 py-1.5 text-sm text-white"
                >
                  Enregistrer
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTaskId(null);
                    setEditedTaskAction("");
                  }}
                  className="rounded border px-3 py-1.5 text-sm"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              downloadTaskCalendar(task);
              closeAllMenus();
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
          >
            Ajouter au calendrier
          </button>

          <div className="border-t border-gray-100 px-3 py-2">
            <label
              htmlFor={`task-responsible-${task.id}`}
              className="mb-1 block text-xs font-medium text-gray-600"
            >
              Modifier le responsable
            </label>

            <select
              id={`task-responsible-${task.id}`}
              value={getTaskResponsibleEmployeeId(task)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();

                if (e.target.value === "new") {
                  setNewResponsibleTaskId(task.id);
                  setNewResponsibleForm({ name: "", role: "", email: "" });
                  return;
                }

                const employeeId = Number(e.target.value);

                if (!employeeId) return;

                updateTaskResponsible(task, employeeId);
              }}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">Choisir un responsable</option>
              <option value="new">Ajouter un nouveau responsable</option>

              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name} - {employee.role || "Sans rôle"}
                </option>
              ))}
            </select>

            {newResponsibleTaskId === task.id && (
              <div
                className="mt-3 space-y-2 border-t border-gray-100 pt-3"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={newResponsibleForm.name}
                  onChange={(e) =>
                    setNewResponsibleForm((currentForm) => ({
                      ...currentForm,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Nom complet"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />

                <input
                  type="text"
                  value={newResponsibleForm.role}
                  onChange={(e) =>
                    setNewResponsibleForm((currentForm) => ({
                      ...currentForm,
                      role: e.target.value,
                    }))
                  }
                  placeholder="Rôle"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />

                <input
                  type="email"
                  value={newResponsibleForm.email}
                  onChange={(e) =>
                    setNewResponsibleForm((currentForm) => ({
                      ...currentForm,
                      email: e.target.value,
                    }))
                  }
                  placeholder="Email"
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      createResponsibleAndAssignTask(task);
                    }}
                    className="flex-1 rounded bg-black px-3 py-1.5 text-sm text-white"
                  >
                    Créer et assigner
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewResponsibleTaskId(null);
                      setNewResponsibleForm({ name: "", role: "", email: "" });
                    }}
                    className="rounded border px-3 py-1.5 text-sm"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              askAndUpdateTaskDueDate(task);
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
          >
            Modifier l’échéance
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              sendTaskToResponsible(task);
              closeAllMenus();
            }}
            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
          >
            Envoyer au responsable
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteTask(task.id);
            }}
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
          >
            Supprimer la tâche
          </button>
        </div>
      )}
    </>
  );
}
function getPendingTasksByResponsible(
  selectedTaskIds?: number[],
  sourceTasks: Task[] = tasks
) {
  const pendingTasks = sourceTasks.filter(
    (task) => normalizeTaskStatus(task.status) !== "Fait"
  );
  const tasksByEmployee = new Map<Employee, Task[]>();
  const ignoredTasks: string[] = [];

  pendingTasks.forEach((task) => {
    if (selectedTaskIds && !selectedTaskIds.includes(task.id)) {
      return;
    }

    const responsibleEmployee = task.responsible_employee_id
      ? employees.find((employee) => employee.id === task.responsible_employee_id)
      : null;

    if (!responsibleEmployee) {
      ignoredTasks.push(`${task.action} : aucun responsable assigné`);
      return;
    }

    if (!responsibleEmployee.email?.trim()) {
      ignoredTasks.push(
        `${task.action} : aucun email pour ${responsibleEmployee.name}`
      );
      return;
    }

    const currentTasks = tasksByEmployee.get(responsibleEmployee) || [];
    tasksByEmployee.set(responsibleEmployee, [...currentTasks, task]);
  });

  return { tasksByEmployee, ignoredTasks, pendingTasks };
}

async function confirmSendSelectedTasks() {
  const { tasksByEmployee, ignoredTasks, pendingTasks } =
    getPendingTasksByResponsible(selectedBulkTaskIds, bulkTaskSource);
  const uncheckedCount = pendingTasks.filter(
    (task) => !selectedBulkTaskIds.includes(task.id)
  ).length;
  const ignoredCount = ignoredTasks.length + uncheckedCount;

  if (tasksByEmployee.size === 0) {
    setEmailStatus(
      `Aucune tâche envoyée. ${ignoredCount} tâche(s) ignorée(s).`
    );
    setShowBulkTasksModal(false);
    return;
  }

  try {
    setEmailStatus("Envoi des tâches en cours...");

    for (const [employee, employeeTasks] of tasksByEmployee) {
      const isHistorySource =
        openedHistoryMeetingId !== null &&
        employeeTasks.some((task) => task.meeting_id === openedHistoryMeetingId);
      const emailTitle =
        (isHistorySource ? historyTitle : currentTitle) ||
        "Compte rendu de réunion";
      const emailDate = isHistorySource ? historyDate : currentMeetingDate;
      const emailParticipants = isHistorySource
        ? historyParticipants
        : currentParticipants;
      const emailReport = isHistorySource ? historyMessage : message;
      const emailMeetingId = isHistorySource
        ? openedHistoryMeetingId
        : currentMeetingId;

      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: [employee.email],
          title: emailTitle,
          subject: `Tâches à faire - ${emailTitle}`,
          meetingDate: emailDate,
          participants: emailParticipants.map((participant) => participant.name),
          summary: `Voici vos tâches à faire suite à la réunion "${emailTitle}".`,
          report: emailReport,
          tasks: employeeTasks.map((task) => ({
            action: task.action,
            due_date: task.due_date,
            status: normalizeTaskStatus(task.status),
          })),
          ctaUrl: getBrieflyReportUrl(emailMeetingId),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur pendant l'envoi des tâches.");
      }
    }

    const ignoredMessage =
      ignoredTasks.length > 0
        ? ` ${ignoredTasks.length} tâche(s) ignorée(s) : ${ignoredTasks.join(
            " ; "
          )}`
        : "";

    setEmailStatus(`${tasksByEmployee.size} emails envoyés, ${ignoredCount} tâches ignorées.${ignoredMessage}`);
    setShowBulkTasksModal(false);
  } catch (error) {
    console.error(error);
    setEmailStatus("Erreur pendant l'envoi des tâches.");
  }
}

function getDashboardPeriodTasks() {
  const dashboardMeetings = meetings.filter((meeting) =>
    isDateInDashboardPeriod(meeting.created_at, dashboardPeriod)
  );
  const dashboardMeetingIds = new Set(
    dashboardMeetings.map((meeting) => meeting.id)
  );

  return dashboardTasks.filter((task) => {
    if (dashboardMeetingIds.has(task.meeting_id)) {
      return true;
    }

    return isDateInDashboardPeriod(
      getTaskPeriodDate(task, meetings),
      dashboardPeriod
    );
  });
}

function openReminderModal() {
  const periodTasks = getDashboardPeriodTasks();
  const { overdueTasks } = getUrgentTasks(periodTasks);
  const openTasks = dedupeTasksById(getOpenTasks(periodTasks));

  setReminderTaskSource(openTasks);
  setSelectedReminderTaskIds([
    ...new Set(dedupeTasksById(overdueTasks).map((task) => task.id)),
  ]);
  setShowOtherReminderTasks(false);
  setReminderStatus("");
  setShowReminderModal(true);
}

function closeReminderModal() {
  setShowReminderModal(false);
  setShowOtherReminderTasks(false);
  setReminderStatus("");
  setReminderTaskSource([]);
  setSelectedReminderTaskIds([]);
}

async function confirmReminderEmails() {
  const selectedTasks = dedupeTasksById(reminderTaskSource).filter((task) =>
    selectedReminderTaskIds.includes(task.id)
  );
  const tasksByEmployee = new Map<Employee, Task[]>();
  const ignoredTasks: string[] = [];

  selectedTasks.forEach((task) => {
    const employee = task.responsible_employee_id
      ? employees.find(
          (currentEmployee) => currentEmployee.id === task.responsible_employee_id
        )
      : null;

    if (!employee) {
      ignoredTasks.push(`${task.action} : aucun responsable assigné`);
      return;
    }

    if (!employee.email?.trim()) {
      ignoredTasks.push(`${task.action} : aucun email pour ${employee.name}`);
      return;
    }

    const currentTasks = tasksByEmployee.get(employee) || [];
    tasksByEmployee.set(employee, [...currentTasks, task]);
  });

  if (tasksByEmployee.size === 0) {
    const ignoredMessage =
      ignoredTasks.length > 0 ? ` ${ignoredTasks.join(" ; ")}` : "";
    setReminderStatus(
      `Aucune relance envoyée. ${ignoredTasks.length} tâche(s) ignorée(s).${ignoredMessage}`
    );
    return;
  }

  try {
    setReminderStatus("Relance des tâches en cours...");

    for (const [employee, employeeTasks] of tasksByEmployee) {
      await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: [employee.email],
          title: "Relance de tâches en retard",
          subject: "Relance - tâches en retard",
          summary: "Voici les tâches à relancer dans Briefly.",
          report: "Relance de tâches en retard.",
          tasks: employeeTasks.map((task) => ({
            action: task.action,
            due_date: task.due_date,
            status: normalizeTaskStatus(task.status),
          })),
          ctaUrl: getBrieflyReportUrl(null),
        }),
      }).then(async (response) => {
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Erreur pendant la relance.");
        }
      });

      // Future extension point: trigger an in-app notification here.
    }

    const ignoredMessage =
      ignoredTasks.length > 0 ? ` ${ignoredTasks.join(" ; ")}` : "";
    const sentTaskCount = [...tasksByEmployee.values()].reduce(
      (total, employeeTasks) => total + employeeTasks.length,
      0
    );
    setReminderStatus(
      `${tasksByEmployee.size} emails envoyés, ${sentTaskCount} tâche(s) relancée(s), ${ignoredTasks.length} tâche(s) ignorée(s).${ignoredMessage}`
    );
  } catch (error) {
    console.error(error);
    setReminderStatus("Erreur pendant la relance des tâches.");
  }
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
async function loadHistoryMeetingTasks(meetingId: number) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  setHistoryTasks(data || []);
}

async function loadHistoryMeetingParticipants(meetingId: number) {
  const { data, error } = await supabase
    .from("meeting_participants")
    .select("employees(*)")
    .eq("meeting_id", meetingId);

  if (error) {
    console.error(error);
    return;
  }

  const participants =
    (data as MeetingParticipantRow[] | null)
      ?.flatMap((item) => item.employees || [])
      ?.filter((employee): employee is Employee => Boolean(employee)) || [];
  setHistoryParticipants(participants);
}

async function openHistoryMeetingInline(meeting: Meeting) {
  closeAllMenus();
  setHistoryScrollBeforeOpen(window.scrollY);
  setOpenedHistoryMeetingId(meeting.id);
  setHistoryTitle(meeting.title);
  setHistoryDate(new Date(meeting.created_at).toLocaleString("fr-FR"));
  setHistoryMessage(meeting.report);
  setHistoryParticipants([]);
  setHistoryTasks([]);
  setIsEditingHistory(false);
  setEditedHistoryTitle("");
  setEditedHistoryReport("");
  setIsHistoryParticipantsOpen(false);
  setIsHistoryTasksOpen(false);
  await Promise.all([
    loadHistoryMeetingTasks(meeting.id),
    loadHistoryMeetingParticipants(meeting.id),
  ]);
}

async function openDashboardMeetingInHistory(meeting: Meeting) {
  closeAllMenus();
  setMeetingSearch("");

  const folderId = meeting.folder_id;

  if (folderId) {
    setExpandedFolderIds((currentIds) =>
      currentIds.includes(folderId)
        ? currentIds
        : [...currentIds, folderId]
    );
  }

  setActiveSection("history");
  await openHistoryMeetingInline(meeting);

  window.setTimeout(() => {
    document
      .getElementById(`history-meeting-${meeting.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 120);
}

function closeHistoryMeetingInline() {
  setOpenedHistoryMeetingId(null);
  setHistoryTitle("");
  setHistoryDate("");
  setHistoryMessage("");
  setHistoryParticipants([]);
  setHistoryTasks([]);
  setIsEditingHistory(false);
  setEditedHistoryTitle("");
  setEditedHistoryReport("");
  setIsHistoryParticipantsOpen(false);
  setIsHistoryTasksOpen(false);
  window.setTimeout(() => {
    window.scrollTo({ top: historyScrollBeforeOpen, behavior: "smooth" });
  }, 0);
}

function resetCurrentReport() {
  setCurrentTitle("");
  setCurrentMeetingId(null);
  setCurrentMeetingDate("");
  setCurrentParticipants([]);
  setMessage("");
  setReportError("");
  setEditedTitle("");
  setEditedReport("");
  setTasks([]);
  setIsEditing(false);
  setIsCurrentParticipantsOpen(false);
  setIsCurrentTasksOpen(false);
}

function hasCurrentUnsavedChanges() {
  return isEditing && (editedReport !== message || editedTitle !== currentTitle);
}

function hasHistoryUnsavedChanges() {
  return (
    isEditingHistory &&
    (editedHistoryReport !== historyMessage || editedHistoryTitle !== historyTitle)
  );
}

function requestCloseCurrentReport() {
  if (hasCurrentUnsavedChanges()) {
    setPendingCloseTarget("current");
    return;
  }

  resetCurrentReport();
}

function requestCloseHistoryMeeting() {
  if (hasHistoryUnsavedChanges()) {
    setPendingCloseTarget("history");
    return;
  }

  closeHistoryMeetingInline();
}

async function saveBeforeClosing() {
  if (pendingCloseTarget === "current") {
    await saveEditedReport();
    resetCurrentReport();
  }

  if (pendingCloseTarget === "history") {
    await saveEditedHistoryReport();
    closeHistoryMeetingInline();
  }

  setPendingCloseTarget(null);
}

function ignoreChangesAndClose() {
  const target = pendingCloseTarget;
  setPendingCloseTarget(null);

  if (target === "current") {
    resetCurrentReport();
  }

  if (target === "history") {
    closeHistoryMeetingInline();
  }
}
const filteredEmployees = employees.filter((employee) => {
  const search = employeeSearch.toLowerCase();

  return (
    employee.name.toLowerCase().includes(search) ||
    employee.role.toLowerCase().includes(search)
  );
});
const filteredParticipantEmployees = employees.filter((employee) => {
  const search = participantSearch.toLowerCase();

  return (
    employee.name.toLowerCase().includes(search) ||
    employee.role.toLowerCase().includes(search) ||
    employee.email?.toLowerCase().includes(search)
  );
});

function getMeetingSearchText(meeting: Meeting) {
  const folder = getMeetingFolderById(meeting.folder_id);
  const meetingTasks = getMeetingTasks(meeting.id);
  const participants = meetingParticipantsByMeetingId[meeting.id] || [];

  return [
    folder?.name,
    folder?.description,
    meeting.title,
    meeting.file_name,
    meeting.report,
    new Date(meeting.created_at).toLocaleString("fr-FR"),
    ...participants.flatMap((participant) => [
      participant.name,
      participant.role,
      participant.email,
    ]),
    ...meetingTasks.flatMap((task) => [
      task.action,
      task.responsible,
      task.due_date,
      normalizeTaskStatus(task.status),
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getTaskSearchText(task: Task) {
  const meeting = meetings.find((currentMeeting) => currentMeeting.id === task.meeting_id);
  const folder = getMeetingFolderById(meeting?.folder_id);
  const responsibleEmployee = task.responsible_employee_id
    ? employees.find((employee) => employee.id === task.responsible_employee_id)
    : null;
  const participants = meeting ? meetingParticipantsByMeetingId[meeting.id] || [] : [];

  return [
    task.action,
    task.responsible,
    task.due_date,
    normalizeTaskStatus(task.status),
    meeting?.title,
    meeting?.file_name,
    meeting?.report,
    folder?.name,
    folder?.description,
    responsibleEmployee?.name,
    responsibleEmployee?.role,
    responsibleEmployee?.email,
    ...participants.flatMap((participant) => [
      participant.name,
      participant.role,
      participant.email,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getEmployeeSearchText(employee: Employee) {
  const employeeTasks = dashboardTasks.filter(
    (task) =>
      task.responsible_employee_id === employee.id ||
      task.responsible?.toLowerCase() === employee.name.toLowerCase()
  );
  const participantMeetings = meetings.filter((meeting) =>
    (meetingParticipantsByMeetingId[meeting.id] || []).some(
      (participant) => participant.id === employee.id
    )
  );

  return [
    employee.name,
    employee.role,
    employee.email,
    ...employeeTasks.map((task) => task.action),
    ...participantMeetings.map((meeting) => meeting.title),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const filteredMeetings = meetings.filter((meeting) => {
  const search = meetingSearch.toLowerCase();
  const matchesSearch = !search || getMeetingSearchText(meeting).includes(search);

  return matchesSearch;
});

const folderGroups = meetingFolders
  .map((folder) => ({
    folder,
    meetings: filteredMeetings.filter((meeting) => meeting.folder_id === folder.id),
  }))
  .filter((group) => group.meetings.length > 0 || !meetingSearch.trim());
const unfiledMeetings = filteredMeetings.filter((meeting) => !meeting.folder_id);
const folderModalMeetings =
  folderModalMode === "add" && activeFolder
    ? meetings.filter((meeting) => meeting.folder_id !== activeFolder.id)
    : folderModalMode === "remove" && activeFolder
      ? meetings.filter((meeting) => meeting.folder_id === activeFolder.id)
      : meetings;

			const filteredTasks = tasks.filter((task) => {
	  const taskStatus = normalizeTaskStatus(task.status);
	  const matchesResponsible =
	    selectedResponsible === "Tous" ||
	    task.responsible === selectedResponsible;
	
	  const matchesStatus =
	    taskStatusFilter === "all" ||
	    (taskStatusFilter === "done" && taskStatus === "Fait") ||
	    (taskStatusFilter === "progress" && taskStatus === "En cours") ||
	    (taskStatusFilter === "todo" && taskStatus === "À faire");

	  return matchesResponsible && matchesStatus;
	});

  function renderHistoryMeetingCard(meeting: Meeting) {
    return (
      <div
        key={meeting.id}
        id={`history-meeting-${meeting.id}`}
        className="relative scroll-mt-6 rounded-lg border bg-white p-4 pr-12"
      >
        <button
          type="button"
          data-menu-trigger
          aria-label={`Ouvrir le menu de la réunion ${meeting.title}`}
          aria-expanded={openMeetingMenuId === meeting.id}
          onClick={(e) => {
            e.stopPropagation();

            const shouldOpenMenu = openMeetingMenuId !== meeting.id;

            closeAllMenus();

            if (shouldOpenMenu) {
              setOpenMeetingMenuId(meeting.id);
            }
          }}
          className="absolute right-3 top-3 px-2 text-gray-500 hover:text-black"
        >
          ⋯
        </button>

        {openMeetingMenuId === meeting.id && (
          <div
            data-menu-content
            onClick={(e) => e.stopPropagation()}
            className="absolute right-3 top-10 z-50 min-w-[220px] overflow-hidden rounded border bg-white shadow-lg"
          >
            {meetingFolders.length > 0 || meeting.folder_id ? (
              <div className="py-1">
                {meetingFolders.length > 0 && (
                  <>
                <p className="px-3 py-1 text-xs font-semibold text-gray-500">
                  Déplacer vers un dossier
                </p>
                {meetingFolders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await updateMeetingFolder([meeting.id], folder.id);
                      closeAllMenus();
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    📁 {folder.name}
                  </button>
                ))}
                  </>
                )}
                {meeting.folder_id && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await updateMeetingFolder([meeting.id], null);
                      closeAllMenus();
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    Retirer du dossier
                  </button>
                )}
              </div>
            ) : (
              <p className="px-3 py-2 text-sm text-gray-500">
                Aucun dossier disponible.
              </p>
            )}
          </div>
        )}

        <p className="font-semibold">{meeting.title}</p>
        <p className="text-sm text-gray-500">
          {new Date(meeting.created_at).toLocaleString("fr-FR")}
        </p>
        <p className="text-sm text-gray-500">{meeting.file_name}</p>

        <div className="mt-3 flex gap-3">
          <button
            onClick={() => {
              closeAllMenus();
              openHistoryMeetingInline(meeting);
            }}
            className="rounded bg-black px-3 py-1 text-sm text-white"
          >
            Ouvrir
          </button>

          <button
            onClick={() => {
              closeAllMenus();
              downloadMeetingPDF(meeting);
            }}
            className="rounded border px-3 py-1 text-sm"
          >
            PDF
          </button>

          <button
            onClick={() => {
              closeAllMenus();
              deleteMeeting(meeting.id);
            }}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white"
          >
            Supprimer
          </button>
        </div>

        {openedHistoryMeetingId === meeting.id && (
          <div className="mt-4 rounded border bg-gray-50 p-4">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-600">
                  Compte rendu ouvert
                </p>
              </div>

              <button
                type="button"
                onClick={requestCloseHistoryMeeting}
                className="rounded border px-3 py-1 text-sm"
              >
                Fermer
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  if (isEditingHistory) {
                    setEditedHistoryTitle("");
                    setEditedHistoryReport("");
                    setIsEditingHistory(false);
                    return;
                  }

                  setEditedHistoryTitle(historyTitle);
                  setEditedHistoryReport(historyMessage);
                  setIsEditingHistory(true);
                }}
                className={`rounded px-3 py-1 text-sm ${
                  isEditingHistory
                    ? "border bg-white text-black"
                    : "bg-black text-white"
                }`}
              >
                {isEditingHistory ? "Annuler la modification" : "Modifier"}
              </button>

              <button
                type="button"
                onClick={downloadHistoryReportPDF}
                className="rounded border px-3 py-1 text-sm"
              >
                PDF
              </button>

              <button
                type="button"
                onClick={() => openSendReportModal("history")}
                className="rounded border px-3 py-1 text-sm"
              >
                📤 Envoyer
              </button>
            </div>

            <div className="mb-4">
              {isEditingHistory ? (
                <input
                  type="text"
                  value={editedHistoryTitle}
                  onChange={(e) => setEditedHistoryTitle(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-xl font-bold"
                />
              ) : (
                <h3 className="text-xl font-bold">
                  {historyTitle || "Compte rendu de réunion"}
                </h3>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-600">
                <span>📅 {historyDate || "Date non renseignée"}</span>
                <span>⏱️ Durée non renseignée</span>
                <span>👥 {historyParticipants.length} participant(s)</span>
              </div>
            </div>

            <div className="mb-4 rounded border bg-white">
              <button
                type="button"
                onClick={() =>
                  setIsHistoryParticipantsOpen(
                    (currentIsOpen) => !currentIsOpen
                  )
                }
                className="flex w-full items-center justify-between px-3 py-2 text-left font-semibold"
              >
                <span>Participants présents ({historyParticipants.length})</span>
                <span className="text-gray-500">
                  {isHistoryParticipantsOpen ? "▼" : "▶"}
                </span>
              </button>

              {isHistoryParticipantsOpen && (
                <div className="border-t px-3 py-3">
                  {historyParticipants.length > 0 ? (
                    <ul className="list-inside list-disc text-sm text-gray-700">
                      {historyParticipants.map((participant) => (
                        <li key={participant.id}>
                          {participant.name}
                          {participant.role ? ` (${participant.role})` : ""}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Aucun participant renseigné.
                    </p>
                  )}
                </div>
              )}
              </div>

            {isEditingHistory ? (
              <div>
                <textarea
                  value={editedHistoryReport}
                  onChange={(e) => setEditedHistoryReport(e.target.value)}
                  className="min-h-[300px] w-full rounded border p-3"
                />

                {(editedHistoryReport !== historyMessage ||
                  editedHistoryTitle !== historyTitle) && (
                <div className="mt-3 flex gap-3 transition-all duration-200">
                  <button
                    type="button"
                    onClick={saveEditedHistoryReport}
                    className="rounded bg-black px-4 py-2 text-white"
                  >
                    Enregistrer
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditedHistoryTitle("");
                      setEditedHistoryReport("");
                      setIsEditingHistory(false);
                    }}
                    className="rounded border px-4 py-2"
                  >
                    Annuler
                  </button>
                </div>
                )}
              </div>
            ) : (
              <>
                {hasSensitiveInformation(historyMessage) && (
                  <p className="mb-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    🔒 Ce compte rendu contient des informations sensibles.
                  </p>
                )}
                {renderReportContent(historyMessage)}
              </>
            )}

            <div className="mt-4 rounded border bg-white">
              <button
                type="button"
                onClick={() =>
                  setIsHistoryTasksOpen((currentIsOpen) => !currentIsOpen)
                }
                className="flex w-full items-center justify-between px-3 py-2 text-left font-semibold"
              >
                <span>Tâches ({historyTasks.length})</span>
                <span className="flex items-center gap-2">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      copySectionContent(
                        historyTasks.length > 0
                          ? historyTasks.map((task) => task.action).join("\n")
                          : "Aucune tâche n’a été identifiée.",
                        "Tâches"
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        copySectionContent(
                          historyTasks.length > 0
                            ? historyTasks.map((task) => task.action).join("\n")
                            : "Aucune tâche n’a été identifiée.",
                          "Tâches"
                        );
                      }
                    }}
                    className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
                  >
                    📋 Copier
                  </span>
                  <span className="text-gray-500">
                    {isHistoryTasksOpen ? "▼" : "▶"}
                  </span>
                </span>
              </button>

              {isHistoryTasksOpen && (
                <div className="space-y-2 border-t p-3">
                  {historyTasks.length > 0 ? (
                  <>
                  {historyTasks.map((task) => {
                    const isCompleted = normalizeTaskStatus(task.status) === "Fait";

                    return (
                      <div
                        key={task.id}
                        className={`relative rounded border p-2 pr-12 ${getTaskDueDateClass(
                          task
                        )}`}
                      >
                        {renderTaskMenu(task)}

                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p
                            className={`font-medium ${
                              isCompleted ? "text-green-800" : ""
                            }`}
                          >
                            {task.action}
                          </p>

                          {renderTaskStatusBadge(task, "mt-0")}
                        </div>

                        <p className="text-sm text-gray-600">
                          Responsable : {task.responsible || "Non attribué"}
                        </p>
                        <p className="text-sm text-gray-600">
                          Échéance : {task.due_date || "Non renseignée"}
                        </p>
                        {isCompleted && task.completed_at && (
                          <p className="text-sm text-green-700">
                            Terminé le : {formatCompletedAt(task.completed_at)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  </>
                  ) : (
                    <p className="text-sm text-gray-600">
                      Aucune tâche n’a été identifiée.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center p-8">
      <h1 className="text-4xl font-bold mt-12 mb-6">Briefly</h1>

      <p className="mb-8 text-center">
        Transformez vos réunions audio en comptes rendus clairs.
      </p>

		      <nav className="mb-10 flex flex-wrap justify-center gap-2 rounded-full bg-gray-100 p-1">
	        {[
	          ["dashboard", "Tableau de bord"],
	          ["new", "Nouvelle réunion"],
	          ["report", "Compte rendu ouvert"],
          ["history", "Historique"],
          ["collaborators", "Collaborateurs"],
        ].map(([section, label]) => (
          <button
            key={section}
            type="button"
            onClick={() => {
              closeAllMenus();
              setActiveSection(section as AppSection);
            }}
	            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
	              activeSection === section ? "bg-black text-white" : "text-gray-700 hover:bg-white"
	            }`}
          >
            {label}
          </button>
        ))}
	      </nav>

      {copiedNotice && (
        <p className="mb-6 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm">
          {copiedNotice}
        </p>
      )}
	
		      {activeSection === "dashboard" && (
		        <section className="w-full max-w-5xl p-2 sm:p-6">
	          {(() => {
	            const dashboardMeetings = meetings.filter((meeting) =>
	              isDateInDashboardPeriod(meeting.created_at, dashboardPeriod)
	            );
	            const periodTasks = getDashboardPeriodTasks();
	            const todoTasks = periodTasks.filter(
	              (task) => normalizeTaskStatus(task.status) === "À faire"
	            );
	            const inProgressTasks = periodTasks.filter(
	              (task) => normalizeTaskStatus(task.status) === "En cours"
	            );
	            const doneTasks = periodTasks.filter(
	              (task) => normalizeTaskStatus(task.status) === "Fait"
	            );
	            const { overdueTasks } = getUrgentTasks(periodTasks);
	            const statCards = [
	              {
		                key: "meetings" as const,
		                label: "Réunions",
		                value: dashboardMeetings.length,
		                tone: "border-gray-200 bg-white",
		              },
		              {
		                key: "todo" as const,
		                label: "Tâches à faire",
		                value: todoTasks.length,
		                tone: "border-red-200 bg-red-50",
		              },
		              {
		                key: "progress" as const,
		                label: "Tâches en cours",
		                value: inProgressTasks.length,
		                tone: "border-orange-200 bg-orange-50",
		              },
		              {
		                key: "done" as const,
		                label: "Tâches terminées",
		                value: doneTasks.length,
		                tone: "border-green-200 bg-green-50",
		              },
		              {
		                key: "overdue" as const,
		                label: "Tâches en retard",
		                value: overdueTasks.length,
		                tone: "border-red-200 bg-red-50",
		              },
		            ];
		            const selectedTasks =
		              dashboardSelection === "todo"
		                ? todoTasks
		                : dashboardSelection === "progress"
		                  ? inProgressTasks
		                  : dashboardSelection === "done"
		                    ? doneTasks
		                    : dashboardSelection === "overdue"
		                      ? overdueTasks
		                      : [];
		            const selectedTitle =
		              statCards.find((card) => card.key === dashboardSelection)
		                ?.label || "";
		            const normalizedDashboardSearch = dashboardSearch
		              .trim()
		              .toLowerCase();
		            const dashboardSearchResults = normalizedDashboardSearch
		              ? {
		                  folders: meetingFolders.filter((folder) =>
		                    [folder.name, folder.description]
		                      .filter(Boolean)
		                      .join(" ")
		                      .toLowerCase()
		                      .includes(normalizedDashboardSearch)
		                  ),
		                  meetings: meetings.filter((meeting) =>
		                    getMeetingSearchText(meeting).includes(
		                      normalizedDashboardSearch
		                    )
		                  ),
		                  tasks: dashboardTasks.filter((task) =>
		                    getTaskSearchText(task).includes(
		                      normalizedDashboardSearch
		                    )
		                  ),
		                  employees: employees.filter((employee) =>
		                    getEmployeeSearchText(employee).includes(
		                      normalizedDashboardSearch
		                    )
		                  ),
		                }
		              : null;
		            const dashboardSearchCount = dashboardSearchResults
		              ? dashboardSearchResults.folders.length +
		                dashboardSearchResults.meetings.length +
		                dashboardSearchResults.tasks.length +
		                dashboardSearchResults.employees.length
		              : 0;

		            return (
		              <>
		                <div className="mb-6 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
		                  <div className="hidden sm:block" />
		                  <div className="text-center">
		                    <h2 className="text-2xl font-bold">Tableau de bord</h2>
		                    <p className="text-sm text-gray-600">
		                      Vue d’ensemble -{" "}
		                      {getDashboardPeriodLabel(dashboardPeriod)}.
		                    </p>
		                  </div>
	                  <label className="flex items-center justify-center gap-2 text-sm sm:justify-self-end">
	                    <span className="font-medium">Période</span>
	                    <select
	                      value={dashboardPeriod}
	                      onChange={(e) =>
	                        setDashboardPeriod(e.target.value as DashboardPeriod)
	                      }
	                      className="rounded border bg-white px-3 py-2"
	                    >
	                      <option value="week">Cette semaine</option>
	                      <option value="month">Ce mois</option>
	                      <option value="year">Cette année</option>
	                      <option value="all">Totalité</option>
		                    </select>
		                  </label>
			                </div>

		                <input
                          ref={dashboardSearchInputRef}
		                  type="text"
		                  value={dashboardSearch}
		                  onChange={(e) => {
		                    setDashboardSearch(e.target.value);
		                    setDashboardSelection(null);
		                  }}
		                  placeholder="Rechercher un dossier, une réunion, une tâche, un collaborateur..."
		                  className="mb-8 w-full rounded-xl border border-gray-200 bg-white px-5 py-4 text-lg shadow-sm outline-none transition focus:border-gray-400"
		                />

		                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
		                  {statCards.map((card) => (
		                    <button
		                      key={card.label}
		                      type="button"
		                      onClick={() =>
		                        setDashboardSelection((currentSelection) =>
		                          currentSelection === card.key ? null : card.key
		                        )
		                      }
		                      className={`rounded-xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
		                        card.tone
		                      } ${
		                        dashboardSelection === card.key
		                          ? "ring-2 ring-black"
		                          : ""
		                      }`}
		                    >
		                      <p className="text-sm text-gray-600">{card.label}</p>
		                      <p className="mt-2 text-2xl font-bold">{card.value}</p>
		                    </button>
		                  ))}
		                </div>

		                {dashboardSearchResults ? (
		                  <div className="mt-8 space-y-6">
		                    <div className="flex items-center justify-between gap-3">
		                      <h3 className="text-lg font-bold">
		                        Résultats de recherche
		                      </h3>
		                      <span className="rounded-full bg-black px-3 py-1 text-xs font-semibold text-white">
		                        {dashboardSearchCount}
		                      </span>
		                    </div>

		                    {dashboardSearchCount === 0 ? (
		                      <p className="text-sm text-gray-600">
		                        Aucun résultat trouvé.
		                      </p>
		                    ) : (
		                      <div className="grid gap-4 lg:grid-cols-2">
		                        {dashboardSearchResults.folders.length > 0 && (
		                          <div className="rounded-xl bg-gray-50 p-4">
		                            <h4 className="mb-3 font-semibold">Dossiers</h4>
		                            <div className="space-y-2">
		                              {dashboardSearchResults.folders.map((folder) => (
		                                <div key={folder.id} className="rounded bg-white p-3">
		                                  📁 {folder.name}
		                                </div>
		                              ))}
		                            </div>
		                          </div>
		                        )}

		                        {dashboardSearchResults.meetings.length > 0 && (
		                          <div className="rounded-xl bg-gray-50 p-4">
		                            <h4 className="mb-3 font-semibold">Réunions</h4>
		                            <div className="space-y-2">
		                              {dashboardSearchResults.meetings.map((meeting) => (
		                                <div key={meeting.id} className="rounded bg-white p-3">
		                                  <p className="font-medium">{meeting.title}</p>
		                                  <p className="text-sm text-gray-500">
		                                    {new Date(meeting.created_at).toLocaleString("fr-FR")}
		                                  </p>
		                                </div>
		                              ))}
		                            </div>
		                          </div>
		                        )}

		                        {dashboardSearchResults.tasks.length > 0 && (
		                          <div className="rounded-xl bg-gray-50 p-4">
		                            <h4 className="mb-3 font-semibold">Tâches</h4>
		                            <div className="space-y-2">
		                              {dashboardSearchResults.tasks.map((task) => (
		                                <div key={task.id} className="rounded bg-white p-3">
		                                  <p className="font-medium">{task.action}</p>
		                                  <p className="text-sm text-gray-600">
		                                    Responsable : {task.responsible || "Non attribué"}
		                                  </p>
		                                </div>
		                              ))}
		                            </div>
		                          </div>
		                        )}

		                        {dashboardSearchResults.employees.length > 0 && (
		                          <div className="rounded-xl bg-gray-50 p-4">
		                            <h4 className="mb-3 font-semibold">Collaborateurs</h4>
		                            <div className="space-y-2">
		                              {dashboardSearchResults.employees.map((employee) => (
		                                <div key={employee.id} className="rounded bg-white p-3">
		                                  <p className="font-medium">{employee.name}</p>
		                                  <p className="text-sm text-gray-500">
		                                    {employee.role}
		                                  </p>
		                                </div>
		                              ))}
		                            </div>
		                          </div>
		                        )}
		                      </div>
		                    )}
		                  </div>
		                ) : dashboardSelection && (
		                  <div className="mt-8 rounded-xl bg-white p-5 shadow-sm">
		                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
		                      <h3 className="text-lg font-bold">{selectedTitle}</h3>
		                      {dashboardSelection === "overdue" && (
		                        <button
		                          type="button"
		                          onClick={openReminderModal}
		                          className="rounded border px-3 py-1 text-sm"
		                        >
		                          Relancer
		                        </button>
		                      )}
		                    </div>

		                    {dashboardSelection === "meetings" ? (
		                      dashboardMeetings.length === 0 ? (
		                        <p className="text-sm text-gray-600">
		                          Aucune réunion sur cette période.
		                        </p>
		                      ) : (
		                        <div className="space-y-2">
		                          {dashboardMeetings.map((meeting) => (
		                            <button
		                              key={meeting.id}
		                              type="button"
		                              onClick={() =>
		                                openDashboardMeetingInHistory(meeting)
		                              }
		                              className="w-full cursor-pointer rounded border bg-gray-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-gray-300 hover:bg-white hover:shadow-sm"
		                            >
		                              <p className="font-semibold">{meeting.title}</p>
		                              <p className="text-sm text-gray-500">
		                                {new Date(
		                                  meeting.created_at
		                                ).toLocaleString("fr-FR")}
		                              </p>
		                            </button>
		                          ))}
		                        </div>
		                      )
		                    ) : selectedTasks.length === 0 ? (
		                      <p className="text-sm text-gray-600">
		                        Aucun élément à afficher.
		                      </p>
		                    ) : (
		                      <div className="space-y-2">
		                        {selectedTasks.map((task) => (
		                          <div
		                            key={task.id}
		                            className="rounded border bg-gray-50 p-3"
		                          >
		                            <div className="flex flex-wrap items-start justify-between gap-3">
		                              <p className="font-semibold">{task.action}</p>
		                              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
		                                {normalizeTaskStatus(task.status)}
		                              </span>
		                            </div>
		                            <p className="text-sm text-gray-600">
		                              Responsable : {task.responsible || "Non attribué"}
		                            </p>
		                            <p className="text-sm text-gray-600">
		                              Échéance : {task.due_date || "Non renseignée"}
		                            </p>
		                          </div>
		                        ))}
		                      </div>
		                    )}
		                  </div>
		                )}
		              </>
		            );
	          })()}
	        </section>
	      )}

	      {activeSection === "new" && (
	        <section className="w-full max-w-4xl p-2 sm:p-6">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-6 text-center sm:px-10">
              <h2 className="text-3xl font-bold">Nouvelle réunion</h2>
              <p className="mt-2 text-sm text-gray-600">
                Lancez un enregistrement ou importez un fichier audio.
              </p>
            </div>

            <div className="p-6 sm:p-10">
              {isRecording ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center">
                  <p className="text-sm font-semibold uppercase text-red-700">
                    🎙 Assistant à l&apos;écoute
                  </p>
                  <p className="mt-4 font-mono text-4xl font-bold text-gray-950">
                    {formatLiveMeetingDuration(liveMeetingElapsedSeconds)}
                  </p>
                  <p className="mt-3 text-sm text-gray-700">
                    L&apos;assistant analyse automatiquement la réunion.
                  </p>

                  <button
                    type="button"
                    onClick={stopRecording}
                    className="mt-6 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-red-700"
                  >
                    ■ Arrêter l&apos;enregistrement
                  </button>

                  {activeLiveMeetingId && (
                    <div className="mt-6 grid gap-4 text-left md:grid-cols-2">
                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-gray-950">Invités</h3>
                          <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                            {invitedLiveParticipantIds.length}
                          </span>
                        </div>

                        {invitedLiveParticipantIds.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            Aucun collaborateur invité
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {invitedLiveParticipantIds.map((employeeId) => {
                              const employee = employees.find(
                                (currentEmployee) =>
                                  currentEmployee.id === employeeId
                              );

                              if (!employee) return null;

                              return (
                                <div
                                  key={employee.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm"
                                >
                                  <span>👤 {employee.name}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      markLiveParticipantAsJoined(employee.id)
                                    }
                                    className="rounded bg-black px-2.5 py-1.5 text-xs font-semibold text-white"
                                  >
                                    Marquer comme rejoint
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-gray-950">
                            Participants connectés
                          </h3>
                          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-100">
                            {connectedLiveParticipantIds.length}
                          </span>
                        </div>

                        {connectedLiveParticipantIds.length === 0 ? (
                          <p className="text-sm text-gray-500">
                            Aucun participant connecté
                          </p>
                        ) : (
                          <ul className="space-y-2 text-sm text-gray-700">
                            {connectedLiveParticipantIds.map((employeeId) => {
                              const employee = employees.find(
                                (currentEmployee) =>
                                  currentEmployee.id === employeeId
                              );

                              if (!employee) return null;

                              return (
                                <li
                                  key={employee.id}
                                  className="rounded border border-gray-200 bg-gray-50 px-3 py-2 font-medium"
                                >
                                  👤 {employee.name}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingInviteEmployeeIds([]);
                        setShowInviteParticipantsModal(true);
                      }}
                      className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
                    >
                      ➕ Inviter des collaborateurs
                    </button>
                    <button
                      type="button"
                      onClick={openManualParticipantsFallback}
                      className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
                    >
                      Ajouter un participant manuellement
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mx-auto max-w-xl text-center">
                  {file ? (
                    <div className="rounded-2xl border border-green-100 bg-green-50 p-6">
                      <p className="text-lg font-bold text-green-800">
                        ✔ {message.includes("Enregistrement terminé")
                          ? "Enregistrement terminé"
                          : "Fichier sélectionné"}
                      </p>
                      <p className="mt-3 text-sm text-gray-700">
                        Durée :{" "}
                        {liveMeetingElapsedSeconds > 0
                          ? formatLiveMeetingDuration(liveMeetingElapsedSeconds)
                          : "Non renseignée"}
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {file.name}
                      </p>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startRecording}
                        className="w-full rounded-2xl bg-red-600 px-6 py-5 text-lg font-bold text-white shadow-sm transition hover:bg-red-700"
                      >
                        ● Démarrer l&apos;enregistrement
                      </button>

                      <div className="my-6 flex items-center gap-4 text-xs font-semibold uppercase text-gray-400">
                        <span className="h-px flex-1 bg-gray-200" />
                        OU
                        <span className="h-px flex-1 bg-gray-200" />
                      </div>
                    </>
                  )}

                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50">
                    📁 Choisir un fichier audio
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];

                        if (selectedFile) {
                          setFile(selectedFile);
                          setMessage("");
                          setReportError("");
                          setCurrentTitle("");
                          setLiveMeetingElapsedSeconds(0);
                        }
                      }}
                      className="sr-only"
                    />
                  </label>

                  {file && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingParticipantIds(connectedLiveParticipantIds);
                        setParticipantSearch("");
                        setShowParticipantsModal(true);
                      }}
                      className="mt-6 block w-full rounded-xl bg-black px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-gray-800"
                    >
                      Générer le compte rendu
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {activeSection === "collaborators" && (
        <section className="w-full max-w-3xl rounded-lg border p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Collaborateurs</h2>

            <button
              type="button"
              onClick={() => {
                setEditingEmployee(null);
                setEmployeeForm({ name: "", role: "", email: "" });
                setShowEmployeeModal(true);
              }}
              className="px-3 py-1 border rounded text-sm"
            >
              Ajouter
            </button>
          </div>

      {employees.length > 0 && (
        <div className="border rounded-lg p-4 w-full">
          <input
  ref={employeeSearchInputRef}
  type="text"
  placeholder="🔍 Rechercher un collaborateur..."
  value={employeeSearch}
  onChange={(e) => setEmployeeSearch(e.target.value)}
  className="w-full border rounded p-2 mb-3"
 />

          {filteredEmployees.map((employee) => (
            <div
  key={employee.id}
  className="flex items-center justify-between gap-2 mb-2"
>
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
    data-menu-trigger
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();

      const shouldOpenMenu = openEmployeeMenuId !== employee.id;

      closeAllMenus();

      if (shouldOpenMenu) {
        setOpenEmployeeMenuId(employee.id);
      }
    }}
    className="px-2 text-gray-500 hover:text-black"
  >
    ⋯
  </button>

  {openEmployeeMenuId === employee.id && (
    <div
      data-menu-content
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 mt-1 bg-white border rounded shadow z-50 min-w-[120px]"
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        setEditingEmployee(employee);
setEmployeeForm({
  name: employee.name,
  role: employee.role || "",
  email: employee.email || "",
});
setShowEmployeeModal(true);
closeAllMenus();
        }}
        className="block w-full text-left px-3 py-2 hover:bg-gray-100"
      >
        Modifier
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          closeAllMenus();
          deleteEmployee(employee.id);
        }}
        className="block w-full text-left px-3 py-2 text-red-600 hover:bg-gray-100"
      >
        Supprimer
      </button>
    </div>
  )}
</div>
            </div>
          ))}
        </div>
      )}

      {employees.length === 0 && (
        <p className="text-sm text-gray-600">
          Aucun collaborateur enregistré pour le moment.
        </p>
      )}
      
      {selectedEmployeeProfile &&
  (() => {
    const employeeTasks = tasks.filter(
  (task) =>
    task.responsible_employee_id === selectedEmployeeProfile.id
);

	    const completedTasks = employeeTasks.filter(
	      (task) => normalizeTaskStatus(task.status) === "Fait"
	    );
	
	    const inProgressTasks = employeeTasks.filter(
	      (task) => normalizeTaskStatus(task.status) === "En cours"
	    );
	
	    const pendingTasks = employeeTasks.filter(
	      (task) => normalizeTaskStatus(task.status) === "À faire"
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
          <strong>Poste / Entreprise :</strong>{" "}
          {selectedEmployeeProfile.role || "Non renseigné"}
        </p>

        <p>
          <strong>Email :</strong>{" "}
          {selectedEmployeeProfile.email || "Non renseigné"}
        </p>

        <hr className="my-3" />

        <p>📋 Tâches : {employeeTasks.length}</p>
	        <p>🔴 À faire : {pendingTasks.length}</p>
	        <p>🟠 En cours : {inProgressTasks.length}</p>
	        <p>🟢 Terminées : {completedTasks.length}</p>

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
	
	        {inProgressTasks.length > 0 && (
	          <>
	            <h5 className="font-semibold mt-3">Tâches en cours</h5>
	            <ul className="list-disc list-inside text-sm">
	              {inProgressTasks.map((task) => (
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

        </section>
      )}

      {activeSection === "report" && (
        <section className="w-full max-w-3xl rounded-lg border p-6">
          <h2 className="mb-4 text-2xl font-bold">Compte rendu ouvert</h2>

          {!message && !reportError && (
            <p className="text-sm text-gray-600">
              Aucun compte rendu n’est ouvert pour le moment.
            </p>
          )}

          {message === GENERATING_REPORT_MESSAGE && (
            renderGenerationProgress()
          )}

          {reportError && (
            <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p>{reportError}</p>

              <button
                type="button"
                onClick={() => {
                  setActiveSection("new");
                  setReportError("");
                }}
                className="mt-3 rounded border border-red-300 bg-white px-3 py-1 text-red-700"
              >
                Revenir à Nouvelle réunion
              </button>
            </div>
          )}

      {message && message !== GENERATING_REPORT_MESSAGE && !reportError && (
  <div className="flex gap-3 mt-4">
    <button
      onClick={() => {
        if (isEditing) {
          setEditedTitle("");
          setEditedReport("");
          setIsEditing(false);
          return;
        }

        setEditedTitle(currentTitle);
        setEditedReport(message);
        setIsEditing(true);
      }}
      className={`px-4 py-2 rounded ${
        isEditing ? "border bg-white text-black" : "bg-black text-white"
      }`}
    >
      {isEditing ? "Annuler la modification" : "Modifier"}
    </button>

    <button
      onClick={downloadCurrentReportPDF}
      className="px-4 py-2 border rounded"
    >
      Télécharger en PDF
    </button>

    <button
  onClick={() => openSendReportModal("current")}
  className="px-4 py-2 bg-black text-white rounded"
>
  📤 Envoyer
</button>
  </div>
)}
{emailStatus && (
  <p className="mt-3 text-sm text-gray-600">
    {emailStatus}
  </p>
)}

      {message && message !== GENERATING_REPORT_MESSAGE && !reportError && (
  <div className="mt-8 max-w-3xl w-full border rounded-lg p-6 text-left">
  <div className="mb-4 flex items-start justify-between gap-4">
    <div>
      {isEditing ? (
        <input
          type="text"
          value={editedTitle}
          onChange={(e) => setEditedTitle(e.target.value)}
          className="w-full rounded border px-3 py-2 text-2xl font-bold"
        />
      ) : (
        <h2 className="text-2xl font-bold">
          {currentTitle || "Compte rendu de réunion"}
        </h2>
      )}
    </div>

    <button
    onClick={requestCloseCurrentReport}
      className="px-3 py-1 border rounded text-sm"
    >
      Fermer
    </button>
  </div>
    <div className="mb-4 flex flex-wrap gap-3 text-sm text-gray-600">
      <span>📅 {currentMeetingDate || "Date non renseignée"}</span>
      <span>
        ⏱️{" "}
        {liveMeetingElapsedSeconds > 0
          ? formatLiveMeetingDuration(liveMeetingElapsedSeconds)
          : "Durée non renseignée"}
      </span>
      <span>👥 {currentParticipants.length} participant(s)</span>
    </div>
    <div className="mb-4 rounded border bg-gray-50">
      <button
        type="button"
        onClick={() =>
          setIsCurrentParticipantsOpen((currentIsOpen) => !currentIsOpen)
        }
        className="flex w-full items-center justify-between px-3 py-2 text-left font-semibold"
      >
        <span>Participants présents ({currentParticipants.length})</span>
        <span className="text-gray-500">
          {isCurrentParticipantsOpen ? "▼" : "▶"}
        </span>
      </button>

      {isCurrentParticipantsOpen && (
        <div className="border-t px-3 py-3">
          {currentParticipants.length > 0 ? (
            <ul className="list-disc list-inside text-sm text-gray-700">
              {currentParticipants.map((participant) => (
                <li key={participant.id}>
                  {participant.name}
                  {participant.role ? ` (${participant.role})` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">
              Aucun participant renseigné.
            </p>
          )}
        </div>
      )}
  </div>

    {isEditing ? (
      <div>
        <textarea
          value={editedReport}
          onChange={(e) => setEditedReport(e.target.value)}
          className="w-full min-h-[400px] border rounded p-3"
        />

        {(editedReport !== message || editedTitle !== currentTitle) && (
        <div className="flex gap-3 mt-4 transition-all duration-200">
          <button
            onClick={saveEditedReport}
            className="px-4 py-2 bg-black text-white rounded"
          >
            Enregistrer les modifications
          </button>

          <button
            onClick={() => {
              setEditedTitle("");
              setEditedReport("");
              setIsEditing(false);
            }}
            className="px-4 py-2 border rounded"
          >
            Annuler
          </button>
        </div>
        )}
      </div>
    ) : (
      <>
       {hasSensitiveInformation(message) && (
         <p className="mb-4 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
           🔒 Ce compte rendu contient des informations sensibles.
         </p>
       )}
	     {renderReportContent(message)}

  <div className="mt-6 border rounded-lg bg-gray-50">
    <button
      type="button"
      onClick={() => setIsCurrentTasksOpen((currentIsOpen) => !currentIsOpen)}
      className="flex w-full items-center justify-between px-4 py-3 text-left font-bold"
    >
      <span id="actions-detectees">Tâches ({tasks.length})</span>
      <span className="flex items-center gap-2">
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            copySectionContent(
              tasks.length > 0
                ? tasks.map((task) => task.action).join("\n")
                : "Aucune tâche n’a été identifiée.",
              "Tâches"
            );
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              copySectionContent(
                tasks.length > 0
                  ? tasks.map((task) => task.action).join("\n")
                  : "Aucune tâche n’a été identifiée.",
                "Tâches"
              );
            }
          }}
          className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600"
        >
          📋 Copier
        </span>
        <span className="text-gray-500">{isCurrentTasksOpen ? "▼" : "▶"}</span>
      </span>
    </button>

    {isCurrentTasksOpen && (
      <div className="border-t p-4">
        {tasks.length > 0 ? (
          <>
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

   <div className="space-y-3">
	      {filteredTasks.map((task) => (
	       <div
	  key={task.id}
	  className={`relative border rounded p-3 pr-12 transition ${getTaskDueDateClass(
	    task
	  )}`}
	>
	          {renderTaskMenu(task)}

	          <p className="font-semibold">{task.action}</p>

          <p className="text-sm text-gray-600">
            Responsable : {task.responsible || "Non attribué"}
          </p>

          <div
            className="text-sm text-gray-600"
            onClick={(e) => e.stopPropagation()}
          >
  <label className="mr-2">Échéance :</label>

  <input
    type="date"
    value={task.due_date || ""}
    onChange={(e) =>
      updateTaskDueDate(task.id, e.target.value)
    }
    className="border rounded px-2 py-1 text-sm"
  />
</div>

		          {task.completed_at && normalizeTaskStatus(task.status) === "Fait" && (
		            <p className="text-sm text-green-700">
		              Terminé le : {formatCompletedAt(task.completed_at)}
		            </p>
		          )}

	          {renderTaskStatusBadge(task)}
	        </div>
                 ))}
    </div>
          </>
        ) : (
          <p className="text-sm text-gray-600">
            Aucune tâche n’a été identifiée.
          </p>
        )}
      </div>
    )}
  </div>

      </>
    )}
  </div>
)}
        </section>
      )}



	      {activeSection === "history" && (
	        <section className="w-full max-w-3xl p-2 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">
                {openedHistoryMeetingId
                  ? "Lecture du compte rendu"
                  : "Historique des réunions"}
              </h2>
              {openedHistoryMeetingId && (
                <p className="text-sm text-gray-600">
                  Mode lecture immersive.
                </p>
              )}
            </div>

            {!openedHistoryMeetingId && (
              <button
                type="button"
                onClick={openCreateFolderModal}
                className="rounded bg-black px-3 py-2 text-sm font-semibold text-white"
              >
                Nouveau dossier de réunions
              </button>
            )}
          </div>
          {meetings.length === 0 ? (
            <p className="text-sm text-gray-600">
              Aucune réunion enregistrée pour le moment.
            </p>
          ) : openedHistoryMeetingId ? (
            <div className="space-y-3">
              {meetings
                .filter((meeting) => meeting.id === openedHistoryMeetingId)
                .map((meeting) => renderHistoryMeetingCard(meeting))}
            </div>
          ) : (
	            <>
	          <input
	  ref={meetingSearchInputRef}
	  type="text"
	  placeholder="🔍 Rechercher une réunion..."
	  value={meetingSearch}
	  onChange={(e) => setMeetingSearch(e.target.value)}
	  className="mb-6 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-gray-400"
	/>

	          <div className="space-y-3">
	            {filteredMeetings.length === 0 && folderGroups.length === 0 ? (
	              <p className="rounded border bg-gray-50 p-4 text-sm text-gray-600">
	                Aucune réunion ne correspond à cette recherche.
	              </p>
	            ) : (
	              <>
	                {folderGroups.map(({ folder, meetings: folderMeetings }) => {
	                  const isExpanded = expandedFolderIds.includes(folder.id);

	                  return (
	                    <div key={folder.id} className="rounded-lg border bg-white">
	                      <div className="relative flex items-center justify-between gap-3 p-4 pr-12">
	                        <button
	                          type="button"
	                          onClick={() =>
	                            setExpandedFolderIds((currentIds) =>
	                              currentIds.includes(folder.id)
	                                ? currentIds.filter((id) => id !== folder.id)
	                                : [...currentIds, folder.id]
	                            )
	                          }
	                          className="text-left font-semibold"
	                        >
	                          {isExpanded ? "▼" : "▶"} 📁 {folder.name}
	                        </button>

	                        <button
	                          type="button"
	                          data-menu-trigger
	                          aria-label={`Ouvrir le menu du dossier ${folder.name}`}
	                          aria-expanded={openFolderMenuId === folder.id}
	                          onClick={(e) => {
	                            e.stopPropagation();
	                            const shouldOpenMenu = openFolderMenuId !== folder.id;
	                            closeAllMenus();
	                            if (shouldOpenMenu) {
	                              setOpenFolderMenuId(folder.id);
	                            }
	                          }}
	                          className="absolute right-3 top-3 px-2 text-gray-500 hover:text-black"
	                        >
	                          ⋯
	                        </button>

	                        {openFolderMenuId === folder.id && (
	                          <div
	                            data-menu-content
	                            onClick={(e) => e.stopPropagation()}
	                            className="absolute right-3 top-10 z-50 min-w-[190px] overflow-hidden rounded border bg-white shadow-lg"
	                          >
	                            <button
	                              type="button"
	                              onClick={(e) => {
	                                e.stopPropagation();
	                                closeAllMenus();
	                                openRenameFolderModal(folder);
	                              }}
	                              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
	                            >
	                              Renommer le dossier
	                            </button>
	                            <button
	                              type="button"
	                              onClick={(e) => {
	                                e.stopPropagation();
	                                closeAllMenus();
	                                openAddMeetingsToFolderModal(folder);
	                              }}
	                              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
	                            >
	                              Ajouter des réunions
	                            </button>
	                            <button
	                              type="button"
	                              onClick={(e) => {
	                                e.stopPropagation();
	                                closeAllMenus();
	                                openRemoveMeetingsFromFolderModal(folder);
	                              }}
	                              className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
	                            >
	                              Retirer des réunions
	                            </button>
	                            <button
	                              type="button"
	                              onClick={(e) => {
	                                e.stopPropagation();
	                                deleteFolder(folder);
	                              }}
	                              className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
	                            >
	                              Supprimer le dossier
	                            </button>
	                          </div>
	                        )}
	                      </div>

	                      {isExpanded && (
	                        <div className="space-y-3 border-t bg-gray-50 p-3">
	                          {folderMeetings.length === 0 ? (
	                            <p className="text-sm text-gray-600">
	                              Aucune réunion dans ce dossier.
	                            </p>
	                          ) : (
	                            folderMeetings.map((meeting) =>
	                              renderHistoryMeetingCard(meeting)
	                            )
	                          )}
	                        </div>
	                      )}
	                    </div>
	                  );
	                })}

	                {unfiledMeetings.map((meeting) =>
	                  renderHistoryMeetingCard(meeting)
	                )}
	              </>
	            )}
	          </div>
            </>
          )}
        </section>
	      )}
{showFolderModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
    <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            {folderModalMode === "create" && "Nouveau dossier de réunions"}
            {folderModalMode === "rename" && "Renommer le dossier"}
            {folderModalMode === "add" && "Ajouter des réunions"}
            {folderModalMode === "remove" && "Retirer des réunions"}
          </h2>
          {activeFolder && (
            <p className="text-sm text-gray-600">📁 {activeFolder.name}</p>
          )}
        </div>

        <button
          type="button"
          onClick={closeFolderModal}
          className="rounded border px-3 py-1"
        >
          Fermer
        </button>
      </div>

      {(folderModalMode === "create" || folderModalMode === "rename") && (
        <label className="block text-sm font-medium">
          Nom du dossier
          <input
            type="text"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            className="mt-2 w-full rounded border px-3 py-2"
            placeholder="Ex. Client Renault"
          />
        </label>
      )}

      {folderModalMode !== "rename" && (
        <div className="mt-5">
          <p className="mb-3 font-semibold">
            {folderModalMode === "remove"
              ? "Réunions à retirer"
              : "Réunions à regrouper"}
          </p>

          {folderModalMeetings.length === 0 ? (
            <p className="rounded border bg-gray-50 p-3 text-sm text-gray-600">
              Aucune réunion disponible.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-auto rounded border p-3">
              {folderModalMeetings.map((meeting) => (
                <label
                  key={meeting.id}
                  className="flex items-start gap-2 rounded p-2 text-sm hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedFolderMeetingIds.includes(meeting.id)}
                    onChange={() => {
                      setSelectedFolderMeetingIds((currentIds) =>
                        currentIds.includes(meeting.id)
                          ? currentIds.filter((id) => id !== meeting.id)
                          : [...currentIds, meeting.id]
                      );
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">{meeting.title}</span>
                    <span className="block text-gray-500">
                      {new Date(meeting.created_at).toLocaleString("fr-FR")}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {folderStatus && (
        <p className="mt-4 rounded border bg-gray-50 p-3 text-sm text-gray-700">
          {folderStatus}
        </p>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={closeFolderModal}
          className="rounded border px-4 py-2"
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={submitFolderModal}
          className="rounded bg-black px-4 py-2 text-white"
        >
          {folderModalMode === "create" && "Créer le dossier"}
          {folderModalMode === "rename" && "Renommer"}
          {folderModalMode === "add" && "Ajouter"}
          {folderModalMode === "remove" && "Retirer"}
        </button>
      </div>
    </div>
  </div>
)}
	{showBulkTasksModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
    <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Envoyer toutes les tâches</h2>

        <button
          type="button"
          onClick={() => setShowBulkTasksModal(false)}
          className="rounded border px-3 py-1"
        >
          Fermer
        </button>
      </div>

      {(() => {
        const pendingTasks = bulkTaskSource.filter(
          (task) => normalizeTaskStatus(task.status) !== "Fait"
        );
        const groupedTasks = new Map<
          string,
          { employee: Employee | null; label: string; tasks: Task[] }
        >();

        pendingTasks.forEach((task) => {
          const employee = task.responsible_employee_id
            ? employees.find(
                (currentEmployee) =>
                  currentEmployee.id === task.responsible_employee_id
              ) || null
            : null;
          const key = employee?.id ? `employee-${employee.id}` : `task-${task.id}`;
          const label = employee?.name || task.responsible || "Non attribué";
          const currentGroup = groupedTasks.get(key) || {
            employee,
            label,
            tasks: [],
          };

          groupedTasks.set(key, {
            ...currentGroup,
            tasks: [...currentGroup.tasks, task],
          });
        });

        if (pendingTasks.length === 0) {
          return (
            <p className="text-sm text-gray-600">
              Aucune tâche à faire à envoyer.
            </p>
          );
        }

        return (
          <div className="space-y-4">
            {[...groupedTasks.values()].map((group) => {
              const hasEmail = Boolean(group.employee?.email?.trim());

              return (
                <div key={group.label} className="rounded border p-4">
                  <div className="mb-3">
                    <p className="font-semibold">{group.label}</p>
                    <p
                      className={`text-sm ${
                        hasEmail ? "text-gray-600" : "text-red-600"
                      }`}
                    >
                      {hasEmail ? group.employee?.email : "Email manquant"}
                    </p>
                  </div>

	                  <div className="space-y-2">
	                    {group.tasks.map((task) => (
	                      <div
	                        key={task.id}
	                        className="relative flex gap-2 rounded border p-2 pr-12 text-sm"
	                      >
	                        {renderTaskMenu(task)}

	                        <input
	                          id={`bulk-task-${task.id}`}
	                          type="checkbox"
	                          checked={selectedBulkTaskIds.includes(task.id)}
	                          disabled={!hasEmail}
	                          onChange={() => {
	                            if (selectedBulkTaskIds.includes(task.id)) {
	                              setSelectedBulkTaskIds(
	                                selectedBulkTaskIds.filter((id) => id !== task.id)
	                              );
	                            } else {
	                              setSelectedBulkTaskIds([
	                                ...selectedBulkTaskIds,
	                                task.id,
	                              ]);
	                            }
	                          }}
	                        />

	                        <label htmlFor={`bulk-task-${task.id}`}>
	                          {task.action}
	                          {task.due_date ? ` - ${task.due_date}` : ""}
	                        </label>
	                      </div>
	                    ))}
	                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setShowBulkTasksModal(false)}
          className="rounded border px-4 py-2"
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={confirmSendSelectedTasks}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Envoyer les tâches cochées
        </button>
      </div>
    </div>
	  </div>
)}
{showReminderModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
    <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Relancer les tâches</h2>

        <button
          type="button"
	          onClick={closeReminderModal}
          className="rounded border px-3 py-1"
        >
          Fermer
        </button>
      </div>

	      {(() => {
	        const today = getLocalDateIso();
	        const uniqueReminderTasks = dedupeTasksById(reminderTaskSource);
	        const sortByDueDate = (sourceTasks: Task[]) =>
	          [...sourceTasks].sort((firstTask, secondTask) => {
	            const firstDueDate = firstTask.due_date || "9999-12-31";
	            const secondDueDate = secondTask.due_date || "9999-12-31";
	            return firstDueDate.localeCompare(secondDueDate);
	          });
	        const overdueTasks = sortByDueDate(
	          uniqueReminderTasks.filter(
	            (task) => Boolean(task.due_date) && task.due_date! < today
	          )
	        );
	        const overdueTaskIds = new Set(overdueTasks.map((task) => task.id));
	        const inProgressTasks = sortByDueDate(
	          uniqueReminderTasks.filter(
	            (task) =>
	              !overdueTaskIds.has(task.id) &&
	              normalizeTaskStatus(task.status) === "En cours"
	          )
	        );
	        const inProgressTaskIds = new Set(
	          inProgressTasks.map((task) => task.id)
	        );
	        const todoTasks = sortByDueDate(
	          uniqueReminderTasks.filter(
	            (task) =>
	              !overdueTaskIds.has(task.id) &&
	              !inProgressTaskIds.has(task.id) &&
	              normalizeTaskStatus(task.status) === "À faire"
	          )
	        );
	        const otherTasks = dedupeTasksById([
	          ...inProgressTasks,
	          ...todoTasks,
	        ]);
	        const getTaskEmployee = (task: Task) =>
	          task.responsible_employee_id
	            ? employees.find(
	                (currentEmployee) =>
	                  currentEmployee.id === task.responsible_employee_id
	              ) || null
	            : null;
	        const renderReminderTask = (task: Task, label: string) => {
	          const employee = getTaskEmployee(task);
	          const hasEmail = Boolean(employee?.email?.trim());

	          return (
	            <label
	              key={task.id}
	              className="flex items-start gap-2 rounded border bg-white p-2 text-sm"
	            >
	              <input
	                type="checkbox"
	                checked={selectedReminderTaskIds.includes(task.id)}
	                onChange={() => {
	                  if (selectedReminderTaskIds.includes(task.id)) {
	                    setSelectedReminderTaskIds(
	                      selectedReminderTaskIds.filter((id) => id !== task.id)
	                    );
	                  } else {
	                    setSelectedReminderTaskIds([
	                      ...new Set([...selectedReminderTaskIds, task.id]),
	                    ]);
	                  }
	                }}
	              />

	              <span className="min-w-0 flex-1">
	                <span className="font-medium">{task.action}</span>
	                <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
	                  {label}
	                </span>
	                <span className="block text-gray-600">
	                  Responsable : {employee?.name || task.responsible || "Non attribué"}
	                </span>
	                <span
	                  className={`block text-gray-600 ${
	                    hasEmail ? "" : "text-red-600"
	                  }`}
	                >
	                  {hasEmail ? employee?.email : "Email manquant"}
	                </span>
	                <span className="block text-gray-600">
	                  Échéance : {task.due_date || "Non renseignée"}
	                </span>
	              </span>
	            </label>
	          );
	        };
	        const reminderSections = [
	          {
	            title: "Tâches en retard",
	            label: "En retard",
	            tasks: overdueTasks,
	            className: "border-red-200 bg-red-50",
	          },
	          ...(showOtherReminderTasks
	            ? [
	                {
	                  title: "Tâches en cours",
	                  label: "En cours",
	                  tasks: inProgressTasks,
	                  className: "border-orange-200 bg-orange-50",
	                },
	                {
	                  title: "Tâches à faire",
	                  label: "À faire",
	                  tasks: todoTasks,
	                  className: "border-blue-200 bg-blue-50",
	                },
	              ]
	            : []),
	        ];

        return (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                Les tâches en retard sont cochées par défaut.
              </p>

	              <button
	                type="button"
	                onClick={() => {
	                  if (showOtherReminderTasks) {
	                    setSelectedReminderTaskIds((currentIds) =>
	                      currentIds.filter((id) => overdueTaskIds.has(id))
	                    );
	                  }

	                  setShowOtherReminderTasks((currentValue) => !currentValue);
	                }}
	                className="rounded border px-3 py-1 text-sm"
	              >
	                {showOtherReminderTasks
	                  ? "Masquer les autres tâches"
	                  : `Afficher les autres tâches (${otherTasks.length})`}
	              </button>
            </div>

            {overdueTasks.length === 0 && (
              <p className="mb-4 rounded border bg-gray-50 p-3 text-sm text-gray-600">
                Aucune tâche en retard à relancer.
              </p>
            )}

	            <div className="space-y-4">
	              {reminderSections.map((section) => (
	                <section
	                  key={section.title}
	                  className={`rounded border p-4 ${section.className}`}
	                >
	                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
	                    <h3 className="font-semibold">{section.title}</h3>
	                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-700">
	                      {section.tasks.length}
	                    </span>
	                  </div>

	                  {section.tasks.length === 0 ? (
	                    <p className="text-sm text-gray-600">
	                      Aucune tâche dans cette catégorie.
	                    </p>
	                  ) : (
	                    <div className="space-y-2">
	                      {section.tasks.map((task) =>
	                        renderReminderTask(task, section.label)
	                      )}
	                    </div>
	                  )}
	                </section>
	              ))}
	            </div>

            {reminderStatus && (
              <p className="mt-4 rounded border bg-gray-50 p-3 text-sm text-gray-700">
                {reminderStatus}
              </p>
            )}
          </>
        );
      })()}

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
	          onClick={closeReminderModal}
          className="rounded border px-4 py-2"
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={confirmReminderEmails}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Envoyer les relances
        </button>
      </div>
    </div>
  </div>
)}
{showInviteParticipantsModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
    <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-lg bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Inviter des collaborateurs</h2>
          <p className="text-sm text-gray-600">
            Simulation prête pour de futurs liens d’invitation et la présence temps réel.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowInviteParticipantsModal(false)}
          className="rounded border px-3 py-1"
        >
          Fermer
        </button>
      </div>

      <div className="space-y-2">
        {employees.length === 0 ? (
          <p className="text-sm text-gray-600">
            Aucun collaborateur disponible.
          </p>
        ) : (
          employees.map((employee) => {
            const isInvited = invitedLiveParticipantIds.includes(employee.id);
            const isConnected = connectedLiveParticipantIds.includes(employee.id);

            return (
              <div
                key={employee.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border p-3 text-sm"
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pendingInviteEmployeeIds.includes(employee.id)}
                    disabled={isConnected}
                    onChange={() => {
                      if (pendingInviteEmployeeIds.includes(employee.id)) {
                        setPendingInviteEmployeeIds((currentIds) =>
                          currentIds.filter((currentId) => currentId !== employee.id)
                        );
                      } else {
                        setPendingInviteEmployeeIds((currentIds) => [
                          ...new Set([...currentIds, employee.id]),
                        ]);
                      }
                    }}
                  />

                  <span>
                    {employee.name}
                    {employee.role ? ` (${employee.role})` : ""}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">
                    {isConnected
                      ? "Connecté"
                      : isInvited
                        ? "Invité"
                        : "Non invité"}
                  </span>

                  {!isConnected && (
                    <button
                      type="button"
                      onClick={() => markLiveParticipantAsJoined(employee.id)}
                      className="rounded border px-2 py-1 text-xs"
                    >
                      Marquer comme rejoint
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setShowInviteParticipantsModal(false)}
          className="rounded border px-4 py-2"
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={() => inviteLiveParticipants(pendingInviteEmployeeIds)}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Inviter la sélection
        </button>
      </div>
    </div>
  </div>
)}
{showParticipantsModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
    <div className="w-full max-w-2xl rounded-lg bg-white p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
	        <h2 className="text-2xl font-bold">
	          Quels collaborateurs étaient présents ?
	        </h2>

        <button
          type="button"
          onClick={() => setShowParticipantsModal(false)}
          className="px-3 py-1 border rounded"
        >
          Fermer
        </button>
	      </div>

	      {connectedLiveParticipantIds.length > 0 ? (
	        <p className="mb-4 rounded border bg-green-50 p-3 text-sm text-green-700">
	          Les participants connectés ont été présélectionnés automatiquement.
	        </p>
	      ) : (
	        <p className="mb-4 rounded border bg-gray-50 p-3 text-sm text-gray-600">
	          Aucun participant connecté. Tu peux générer sans participant ou en sélectionner manuellement.
	        </p>
	      )}
	
	      <input
        type="text"
        placeholder="🔍 Rechercher un collaborateur..."
        value={participantSearch}
        onChange={(e) => setParticipantSearch(e.target.value)}
        className="mb-4 w-full rounded border p-2"
      />

      <div className="max-h-[45vh] space-y-2 overflow-auto">
        {filteredParticipantEmployees.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun collaborateur trouvé.</p>
        ) : (
          filteredParticipantEmployees.map((employee) => (
            <label key={employee.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={pendingParticipantIds.includes(employee.id)}
                onChange={() => {
                  if (pendingParticipantIds.includes(employee.id)) {
                    setPendingParticipantIds(
                      pendingParticipantIds.filter((id) => id !== employee.id)
                    );
                  } else {
                    setPendingParticipantIds([
                      ...pendingParticipantIds,
                      employee.id,
                    ]);
                  }
                }}
              />

              <span>
                {employee.name}
                {employee.role ? ` (${employee.role})` : ""}
                {employee.email ? ` - ${employee.email}` : ""}
              </span>
            </label>
          ))
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setShowParticipantsModal(false)}
          className="px-4 py-2 border rounded"
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={async () => {
            setSelectedEmployees(pendingParticipantIds);
            setShowParticipantsModal(false);
            setActiveSection("report");
            await handleUpload(pendingParticipantIds);
          }}
          className="px-4 py-2 bg-black text-white rounded"
        >
          Générer le compte rendu
        </button>
      </div>
    </div>
  </div>
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
{showSendReportModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
    <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-xl">
      {(() => {
        const reportParticipants =
          sendReportContext === "current"
            ? currentParticipants
            : historyParticipants;
        const participantIds = new Set(
          reportParticipants.map((participant) => participant.id)
        );
        const otherEmployees = employees.filter(
          (employee) => !participantIds.has(employee.id)
        );
        const renderRecipient = (employee: Employee, isParticipant: boolean) => (
          <label
            key={employee.id}
            className="flex items-start gap-3 rounded border border-gray-200 bg-gray-50 p-3 text-sm"
          >
            <input
              type="checkbox"
              checked={emailRecipients.includes(employee.id)}
              onChange={() => {
                setEmailRecipients((currentRecipients) =>
                  currentRecipients.includes(employee.id)
                    ? currentRecipients.filter((id) => id !== employee.id)
                    : [...currentRecipients, employee.id]
                );
              }}
              className="mt-1"
            />
            <span>
              <span className="block font-medium text-gray-950">
                {employee.name}
                {isParticipant ? " · participant" : ""}
              </span>
              <span className="block text-gray-600">
                {employee.email || "Email manquant"}
              </span>
              {employee.role && (
                <span className="block text-gray-500">{employee.role}</span>
              )}
            </span>
          </label>
        );

        return (
          <>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">Envoyer le compte rendu</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Les participants présents sont présélectionnés.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSendReportModal(false)}
                className="rounded border px-3 py-1 text-sm"
              >
                Fermer
              </button>
            </div>

            <div className="space-y-3">
              <div className="rounded-lg border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() =>
                    setIsSendParticipantsOpen((currentIsOpen) => !currentIsOpen)
                  }
                  className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold"
                >
                  <span>
                    Participants présents ({reportParticipants.length})
                  </span>
                  <span className="text-gray-500">
                    {isSendParticipantsOpen ? "▼" : "▶"}
                  </span>
                </button>
                {isSendParticipantsOpen && (
                <div className="space-y-2 border-t border-gray-100 p-3">
                  {reportParticipants.length > 0 ? (
                    reportParticipants.map((employee) =>
                      renderRecipient(employee, true)
                    )
                  ) : (
                    <p className="rounded border bg-gray-50 p-3 text-sm text-gray-600">
                      Aucun participant renseigné.
                    </p>
                  )}
                </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() =>
                    setIsSendOthersOpen((currentIsOpen) => !currentIsOpen)
                  }
                  className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold"
                >
                  <span>Autres collaborateurs ({otherEmployees.length})</span>
                  <span className="text-gray-500">
                    {isSendOthersOpen ? "▼" : "▶"}
                  </span>
                </button>
                {isSendOthersOpen && (
                <div className="space-y-2 border-t border-gray-100 p-3">
                  {otherEmployees.length > 0 ? (
                    otherEmployees.map((employee) =>
                      renderRecipient(employee, false)
                    )
                  ) : (
                    <p className="rounded border bg-gray-50 p-3 text-sm text-gray-600">
                      Aucun autre collaborateur.
                    </p>
                  )}
                </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSendReportModal(false)}
                className="rounded border px-4 py-2"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmSendReportModal}
                className="rounded bg-black px-4 py-2 font-semibold text-white"
              >
                Envoyer
              </button>
            </div>
          </>
        );
      })()}
    </div>
  </div>
)}
{pendingCloseTarget && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
      <h2 className="text-xl font-bold">
        Modifications non enregistrées
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Vous avez des modifications non enregistrées. Voulez-vous les enregistrer avant de quitter ?
      </p>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={saveBeforeClosing}
          className="rounded bg-black px-4 py-2 text-sm font-semibold text-white"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={ignoreChangesAndClose}
          className="rounded border px-4 py-2 text-sm"
        >
          Ignorer
        </button>
        <button
          type="button"
          onClick={() => setPendingCloseTarget(null)}
          className="rounded border px-4 py-2 text-sm"
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
                onClick={() => {
                  closeAllMenus();
                  setShowTrash(false);
                }}
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
                  <div
                    key={meeting.id}
                    className="relative border rounded-lg p-4 pr-12"
                  >
                    <button
                      type="button"
                      data-menu-trigger
                      aria-label={`Ouvrir le menu de la réunion ${meeting.title}`}
                      aria-expanded={openTrashMeetingMenuId === meeting.id}
                      onClick={(e) => {
                        e.stopPropagation();

                        const shouldOpenMenu =
                          openTrashMeetingMenuId !== meeting.id;

                        closeAllMenus();

                        if (shouldOpenMenu) {
                          setOpenTrashMeetingMenuId(meeting.id);
                        }
                      }}
                      className="absolute top-3 right-3 px-2 text-gray-500 hover:text-black"
                    >
                      ⋯
                    </button>

                    {openTrashMeetingMenuId === meeting.id && (
                      <div
                        data-menu-content
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-3 top-10 z-50 min-w-[220px] overflow-hidden rounded border bg-white shadow-lg"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeAllMenus();
                            restoreMeeting(meeting.id);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                        >
                          Restaurer
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeAllMenus();
                            permanentlyDeleteMeeting(meeting.id);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
                        >
                          Supprimer définitivement
                        </button>
                      </div>
                    )}

                    <p className="font-semibold">{meeting.title}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(meeting.created_at).toLocaleString("fr-FR")}
                    </p>
                    <p className="text-sm text-gray-500">
                      {meeting.file_name}
                    </p>

                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => {
                          closeAllMenus();
                          restoreMeeting(meeting.id);
                        }}
                        className="px-3 py-1 bg-black text-white rounded text-sm"
                      >
                        Restaurer
                      </button>

                      <button
                        onClick={() => {
                          closeAllMenus();
                          permanentlyDeleteMeeting(meeting.id);
                        }}
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
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveEmployeeForm();
      }}
      className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md"
    >
      <h2 className="text-xl font-bold mb-4">
        {editingEmployee ? "Modifier le collaborateur" : "Ajouter un collaborateur"}
      </h2>

      <div className="space-y-3">
        <input
          ref={employeeNameInputRef}
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
          placeholder="Poste / Entreprise"
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
          type="submit"
          className="px-4 py-2 bg-black text-white rounded"
        >
          Enregistrer
        </button>
      </div>
    </form>
  </div>
)}
    </main>
  );
}
