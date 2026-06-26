"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import jsPDF from "jspdf";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type Meeting = {
  id: number;
  user_id?: string | null;
  organization_id?: number | null;
  title: string;
  file_name: string;
  created_at: string;
  report: string;
  folder_id?: number | null;
};

type MeetingFolder = {
  id: number;
  user_id?: string | null;
  organization_id?: number | null;
  name: string;
  description?: string | null;
  color?: string | null;
  created_at: string;
};

type Employee = {
  id: number;
  user_id?: string | null;
  organization_id?: number | null;
  name: string;
  role: string;
  email: string;
};

type TaskFromAI = {
  action: string;
  responsible?: string;
  responsible_employee_id?: number | null;
  due_date?: string;
  priority?: string | null;
  context?: string | null;
};

type PendingDetectedTask = TaskFromAI & {
  tempId: string;
  meetingId: number;
};

type ApiResponse = {
  title: string;
  report: string;
  tasks?: TaskFromAI[];
  error?: string;
};

type MemorySource = {
  meeting_id: number;
  title: string;
  date: string;
  author?: string | null;
  minute?: string | null;
  excerpt?: string | null;
};

type MemorySearchResponse = {
  answer: string;
  sources: MemorySource[];
  error?: string;
};

type TaskStatus = "À faire" | "En cours" | "Terminée" | "En retard";

type Task = {
  id: number;
  user_id?: string | null;
  organization_id?: number | null;
  created_by?: string | null;
  priority?: "Basse" | "Normale" | "Haute" | "Urgente" | null;
  meeting_id: number;
  created_at?: string;
  action: string;
  responsible: string | null;
  responsible_employee_id?: number | null;
  due_date: string | null;
  status: TaskStatus;
  completed_at?: string | null;
};

type ActivityLog = {
  id: number;
  organization_id: number;
  actor_id: string | null;
  actor_name: string | null;
  action_type: string;
  description: string;
  entity_type: string | null;
  entity_id: number | null;
  created_at: string;
};

type MeetingParticipantRow = {
  user_id?: string | null;
  organization_id?: number | null;
  employees: Employee | Employee[] | null;
};

type MeetingParticipantSearchRow = {
  user_id?: string | null;
  organization_id?: number | null;
  meeting_id: number;
  employees: Employee | Employee[] | null;
};

type AppSection =
  | "dashboard"
  | "new"
  | "report"
  | "history"
  | "collaborators"
  | "profile"
  | "organization";
type DashboardPeriod = "today" | "week" | "month" | "year" | "all";
type DashboardSelection =
  | "meetings"
  | "todo"
  | "progress"
  | "done"
  | "overdue"
  | null;

const GENERATING_REPORT_MESSAGE = "Génération du compte rendu en cours...";
type AuthMode = "login" | "signup" | "forgot" | "update-password";
type UserProfile = {
  id: string;
  organization_id: number | null;
  role: "ADMIN" | "MANAGER" | "COLLABORATEUR" | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  company: string | null;
  created_at: string;
};

type Organization = {
  id: number;
  name: string;
  logo_url: string | null;
  industry: string | null;
  employee_count: string | null;
  created_at: string;
  created_by: string | null;
};

type OrganizationRole = "ADMIN" | "MANAGER" | "COLLABORATEUR";
type CollaboratorStatus = "active" | "suspended";

type OrganizationMember = {
  id: string;
  organization_id: number | null;
  role: OrganizationRole | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_title: string | null;
  status: CollaboratorStatus | null;
  created_at: string;
};

type Invitation = {
  id: number;
  organization_id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  role: OrganizationRole;
  token: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  invited_by: string | null;
};

export default function Home() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authFullName, setAuthFullName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authStatus, setAuthStatus] = useState("");
  const [authError, setAuthError] = useState("");
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationForm, setOrganizationForm] = useState({
    name: "",
    industry: "",
  });
  const [organizationStatus, setOrganizationStatus] = useState("");
  const [organizationError, setOrganizationError] = useState("");
  const [isOrganizationSaving, setIsOrganizationSaving] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [organizationMembers, setOrganizationMembers] = useState<
    OrganizationMember[]
  >([]);
  const [organizationInvitations, setOrganizationInvitations] = useState<
    Invitation[]
  >([]);
  const [collaboratorSearch, setCollaboratorSearch] = useState("");
  const [collaboratorFilter, setCollaboratorFilter] = useState<
    "all" | "admins" | "managers" | "collaborators" | "pending"
  >("all");
  const [openCollaboratorMenuId, setOpenCollaboratorMenuId] = useState<
    string | null
  >(null);
  const [inviteForm, setInviteForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    job_title: "",
    role: "COLLABORATEUR" as OrganizationRole,
  });
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    job_title: "",
  });
  const [profileStatus, setProfileStatus] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [showDeleteRecordingConfirm, setShowDeleteRecordingConfirm] =
    useState(false);
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
  const [participantSearch, setParticipantSearch] = useState("");
  const [meetingSearch, setMeetingSearch] = useState("");
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [debouncedDashboardSearch, setDebouncedDashboardSearch] = useState("");
  const [isDashboardSearchPanelOpen, setIsDashboardSearchPanelOpen] =
    useState(false);
  const [memoryAnswer, setMemoryAnswer] = useState("");
  const [memorySources, setMemorySources] = useState<MemorySource[]>([]);
  const [memoryError, setMemoryError] = useState("");
  const [memoryRecentSearches, setMemoryRecentSearches] = useState<string[]>(
    []
  );
  const [isMemorySearching, setIsMemorySearching] = useState(false);
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
const [copiedSectionLabel, setCopiedSectionLabel] = useState("");
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
  const [pendingDetectedTasks, setPendingDetectedTasks] = useState<
    PendingDetectedTask[]
  >([]);
  const [creatingDetectedTaskIds, setCreatingDetectedTaskIds] = useState<
    string[]
  >([]);
  const [dashboardTasks, setDashboardTasks] = useState<Task[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [workspaceError, setWorkspaceError] = useState("");
  const [dashboardPeriod, setDashboardPeriod] =
    useState<DashboardPeriod>("week");
  const [dashboardSelection, setDashboardSelection] =
    useState<DashboardSelection>("todo");
  const [selectedDashboardTaskId, setSelectedDashboardTaskId] = useState<
    number | null
  >(null);
  const [activeSection, setActiveSection] = useState<AppSection>("dashboard");
  const [openedHistoryMeetingId, setOpenedHistoryMeetingId] = useState<
    number | null
  >(null);
  const [historyReturnSection, setHistoryReturnSection] =
    useState<AppSection | null>(null);
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
  const [highlightedDashboardTaskId, setHighlightedDashboardTaskId] = useState<
    number | null
  >(null);
  const [focusedDashboardTaskId, setFocusedDashboardTaskId] = useState<
    number | null
  >(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const employeeNameInputRef = useRef<HTMLInputElement | null>(null);
  const dashboardSearchContainerRef = useRef<HTMLDivElement | null>(null);
  const dashboardSearchInputRef = useRef<HTMLInputElement | null>(null);
  const meetingSearchInputRef = useRef<HTMLInputElement | null>(null);
  const employeeSearchInputRef = useRef<HTMLInputElement | null>(null);
  const lastAssistantSearchRef = useRef("");
const [openTaskMenuId, setOpenTaskMenuId] = useState<number | null>(null);
const [openMeetingMenuId, setOpenMeetingMenuId] = useState<number | null>(null);
const [openFolderMenuId, setOpenFolderMenuId] = useState<number | null>(null);
const [openTrashMeetingMenuId, setOpenTrashMeetingMenuId] = useState<
  number | null
>(null);
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
    setOpenCollaboratorMenuId(null);
    setOpenTrashMeetingMenuId(null);
    setIsUserMenuOpen(false);
    setNewResponsibleTaskId(null);
    setEditingTaskId(null);
    setEditedTaskAction("");
  }, []);

  function getCurrentUserId() {
    return authUser?.id || null;
  }

  function getCurrentOrganizationId() {
    return organization?.id || userProfile?.organization_id || null;
  }

  function isCurrentUserAdmin() {
    return userProfile?.role === "ADMIN";
  }

  function canManageTeam() {
    return userProfile?.role === "ADMIN" || userProfile?.role === "MANAGER";
  }

  function getWorkspaceScopeColumn() {
    return getCurrentOrganizationId() ? "organization_id" : "user_id";
  }

  function getWorkspaceScopeValue() {
    return getCurrentOrganizationId() || getCurrentUserId() || "";
  }


  function getAuthErrorMessage(message: string) {
    const normalizedMessage = message.toLowerCase();

    if (normalizedMessage.includes("invalid login credentials")) {
      return "Adresse email ou mot de passe incorrect.";
    }

    if (normalizedMessage.includes("email not confirmed")) {
      return "Veuillez confirmer votre adresse email avant de vous connecter.";
    }

    if (normalizedMessage.includes("user already registered")) {
      return "Adresse email déjà utilisée.";
    }

    if (normalizedMessage.includes("invalid email")) {
      return "Adresse email invalide.";
    }

    if (normalizedMessage.includes("password")) {
      return "Le mot de passe doit contenir au moins 6 caractères.";
    }

    if (normalizedMessage.includes("user not found")) {
      return "Compte introuvable.";
    }

    return message || "Une erreur est survenue. Réessaie dans quelques instants.";
  }

  function getProfileDisplayName(): string {
    return (
      userProfile?.full_name ||
      authUser?.user_metadata?.full_name ||
      authUser?.email?.split("@")[0] ||
      "Utilisateur"
    );
  }

  function getUserInitials() {
    const displayName = getProfileDisplayName();
    const initials = displayName
      .split(" ")
      .filter((part): part is string => Boolean(part))
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join("");

    return initials || authUser?.email?.[0]?.toUpperCase() || "B";
  }

  function getInitialsFromName(displayName: string, email?: string) {
    const initials = displayName
      .split(" ")
      .filter((part): part is string => Boolean(part))
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");

    return initials || email?.[0]?.toUpperCase() || "B";
  }

  function getAvatarColor(seed?: string | null) {
    const palette = [
      "bg-slate-900",
      "bg-zinc-700",
      "bg-stone-700",
      "bg-emerald-700",
      "bg-teal-700",
      "bg-cyan-700",
      "bg-blue-700",
      "bg-indigo-700",
      "bg-violet-700",
      "bg-rose-700",
    ];
    const source = seed || "briefly";
    const index = Array.from(source).reduce(
      (total, character) => total + character.charCodeAt(0),
      0
    );

    return palette[index % palette.length];
  }

  function renderInitialsAvatar({
    displayName,
    email,
    seed,
    sizeClass = "h-9 w-9",
  }: {
    displayName: string;
    email?: string | null;
    seed?: string | null;
    sizeClass?: string;
  }) {
    return (
      <span
        className={`${sizeClass} ${getAvatarColor(
          seed || email || displayName
        )} inline-flex items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm ring-1 ring-black/5`}
      >
        {getInitialsFromName(displayName, email || undefined)}
      </span>
    );
  }

  function renderUserAvatar(sizeClass = "h-9 w-9") {
    return renderInitialsAvatar({
      displayName: getProfileDisplayName(),
      email: authUser?.email,
      seed: authUser?.id || authUser?.email,
      sizeClass,
    });
  }

  useEffect(() => {
    let isMounted = true;

    async function loadAuthSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error(error);
      }

      if (isMounted) {
        setAuthUser(session?.user || null);
        setIsAuthLoading(false);
      }
    }

    loadAuthSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user || null);
      if (!session?.user) {
        setUserProfile(null);
      }
      setIsAuthLoading(false);

      if (event === "PASSWORD_RECOVERY") {
        setAuthMode("update-password");
        setAuthStatus("Choisissez un nouveau mot de passe.");
        setAuthError("");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      return;
    }

    loadUserProfile();
    // Chargement volontairement lié au changement d'utilisateur connecté.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !organization) {
      return;
    }

    loadMeetings();
    loadDeletedMeetings();
	    loadMeetingFolders();
    loadEmployees();
    loadOrganizationMembers();
    loadOrganizationInvitations();
    loadMeetingParticipantIndex();
	    loadDashboardTasks();
    loadActivityLogs();
    // Les fonctions de chargement dépendent de la session et de l'organisation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
	  }, [authUser, organization]);

  useEffect(() => {
    const organizationId = getCurrentOrganizationId();
    if (!authUser || !organizationId) return;

    const reloadWorkspace = () => {
      loadMeetings();
      loadDeletedMeetings();
      loadMeetingFolders();
      loadEmployees();
      loadMeetingParticipantIndex();
      loadDashboardTasks();
      loadOrganizationMembers();
      loadOrganizationInvitations();
      loadActivityLogs();
    };

    const channel = supabase
      .channel(`briefly-organization-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meetings",
          filter: `organization_id=eq.${organizationId}`,
        },
        reloadWorkspace
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `organization_id=eq.${organizationId}`,
        },
        reloadWorkspace
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_folders",
          filter: `organization_id=eq.${organizationId}`,
        },
        reloadWorkspace
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "employees",
          filter: `organization_id=eq.${organizationId}`,
        },
        reloadWorkspace
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `organization_id=eq.${organizationId}`,
        },
        reloadWorkspace
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_logs",
          filter: `organization_id=eq.${organizationId}`,
        },
        loadActivityLogs
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          setWorkspaceError(
            "Le temps réel Supabase n’est pas disponible. Active Realtime sur les tables de l’organisation."
          );
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
    // Abonnement lié au workspace courant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, organization?.id, userProfile?.organization_id]);

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
    const timeoutId = window.setTimeout(() => {
      setDebouncedDashboardSearch(dashboardSearch.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [dashboardSearch]);

  useEffect(() => {
    function closeDashboardSearchPanel(event: MouseEvent) {
      if (
        dashboardSearchContainerRef.current &&
        !dashboardSearchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDashboardSearchPanelOpen(false);
      }
    }

    document.addEventListener("mousedown", closeDashboardSearchPanel);

    return () => {
      document.removeEventListener("mousedown", closeDashboardSearchPanel);
    };
  }, []);

  useEffect(() => {
    if (activeSection !== "dashboard") {
      return;
    }

    const query = debouncedDashboardSearch.trim();

    if (!query || !isAssistantQuestion(query)) {
      if (!query) {
        lastAssistantSearchRef.current = "";
      }
      return;
    }

    if (lastAssistantSearchRef.current === query) {
      return;
    }

    lastAssistantSearchRef.current = query;
    searchCompanyMemory(query);
    // Recherche IA déclenchée uniquement après debounce sur la question dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, debouncedDashboardSearch]);

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
      if (showDeleteRecordingConfirm) {
        setShowDeleteRecordingConfirm(false);
        return true;
      }
      if (showInviteModal) {
        setShowInviteModal(false);
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
    showDeleteRecordingConfirm,
    showFolderModal,
    showInviteParticipantsModal,
    showInviteModal,
    showParticipantsModal,
    showReminderModal,
    showSendReportModal,
    showTrash,
  ]);

  async function loadUserProfile() {
    if (!authUser) return;
    setIsProfileLoading(true);

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    if (error) {
      console.error("Erreur chargement profil:", error);
      setIsProfileLoading(false);
      return;
    }

    let profile = data as UserProfile | null;

    if (!profile) {
      const { data: createdProfile, error: profileCreationError } = await supabase
        .from("profiles")
        .upsert({
          id: authUser.id,
          full_name: authUser.user_metadata?.full_name || "",
          email: authUser.email || "",
          role: null,
          organization_id: null,
        })
        .select("*")
        .single();

      if (profileCreationError) {
        console.error("Erreur création profil:", profileCreationError);
        setIsProfileLoading(false);
        return;
      }

      profile = createdProfile as UserProfile;
    }

    setUserProfile(profile);
    setProfileForm({
      full_name: profile.full_name || "",
      job_title: profile.job_title || "",
    });

    if (profile.organization_id) {
      const { data: organizationData, error: organizationLoadError } =
        await supabase
          .from("organizations")
          .select("*")
          .eq("id", profile.organization_id)
          .maybeSingle();

      if (organizationLoadError) {
        console.error("Erreur chargement entreprise:", organizationLoadError);
        setOrganization(null);
        setIsProfileLoading(false);
        return;
      }

      setOrganization((organizationData as Organization | null) || null);
    } else {
      setOrganization(null);
    }

    setIsProfileLoading(false);
  }

  async function saveUserProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authUser) return;

    setProfileStatus("");
    setProfileError("");
    setIsProfileSaving(true);

    const payload = {
      id: authUser.id,
      full_name: profileForm.full_name.trim(),
      email: authUser.email || "",
      job_title: profileForm.job_title.trim() || null,
    };

    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload)
      .select("*")
      .single();

    setIsProfileSaving(false);

    if (error) {
      console.error(error);
      setProfileError("Impossible d’enregistrer le profil.");
      return;
    }

    setUserProfile(data as UserProfile);
    setProfileStatus("Profil mis à jour.");
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authUser) return;

    const name = organizationForm.name.trim();
    const industry = organizationForm.industry.trim();

    if (!name) {
      setOrganizationError("Indiquez le nom de votre entreprise.");
      return;
    }

    setOrganizationStatus("");
    setOrganizationError("");
    setIsOrganizationSaving(true);

    const { data, error } = await supabase
      .rpc("create_organization_workspace", {
        organization_name: name,
        organization_industry: industry || null,
      })
      .single();

    setIsOrganizationSaving(false);

    if (error || !data) {
      console.error("Erreur Supabase création espace de travail:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });
      setOrganizationError(
        error?.message ||
          "Impossible de créer votre espace de travail. Consultez la console pour le détail Supabase."
      );
      return;
    }

    const createdOrganization = data as Organization;
    setOrganization(createdOrganization);
    await loadUserProfile();
    setActiveSection("dashboard");
    setOrganizationStatus("Espace de travail créé.");
  }

  async function loadOrganizationMembers() {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Erreur chargement membres:", error);
      return;
    }

    setOrganizationMembers((data || []) as OrganizationMember[]);
  }

  async function loadOrganizationInvitations() {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;

    const { data, error } = await supabase
      .from("invitations")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur chargement invitations:", error);
      return;
    }

    setOrganizationInvitations((data || []) as Invitation[]);
  }

  function createInvitationToken() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authUser || !organization || !canManageTeam()) {
      setOrganizationError("Seuls les administrateurs et managers peuvent inviter.");
      return;
    }

    const email = inviteForm.email.trim().toLowerCase();
    if (!email || !inviteForm.first_name.trim() || !inviteForm.last_name.trim()) {
      setOrganizationError("Prénom, nom et email sont obligatoires.");
      return;
    }

    setOrganizationError("");
    setOrganizationStatus("");

    const token = createInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    const invitationPayload = {
      organization_id: organization.id,
      email,
      first_name: inviteForm.first_name.trim(),
      last_name: inviteForm.last_name.trim(),
      job_title: inviteForm.job_title.trim() || null,
      role: inviteForm.role,
      token,
      status: "pending",
      expires_at: expiresAt.toISOString(),
      invited_by: authUser.id,
    };

    const { data, error } = await supabase
      .from("invitations")
      .insert(invitationPayload)
      .select("*")
      .single();

    if (error || !data) {
      console.error("Erreur création invitation:", error);
      setOrganizationError("Impossible de créer l’invitation.");
      return;
    }

    const response = await fetch("/api/invitations/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        firstName: inviteForm.first_name.trim(),
        lastName: inviteForm.last_name.trim(),
        organizationName: organization.name,
        inviterName: getProfileDisplayName(),
        token,
        inviteUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/invite?token=${token}`
            : "",
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      console.error(result);
      setOrganizationError(
        "Invitation créée, mais l’email n’a pas pu être envoyé."
      );
    } else {
      setOrganizationStatus("Invitation envoyée.");
    }

    setOrganizationInvitations((currentInvitations) => [
      data as Invitation,
      ...currentInvitations,
    ]);
    await logActivity({
      actionType: "invitation.created",
      description: `${getProfileDisplayName()} a invité ${inviteForm.first_name.trim()} ${inviteForm.last_name.trim()}.`,
      entityType: "invitation",
      entityId: (data as Invitation).id,
    });
    setInviteForm({
      first_name: "",
      last_name: "",
      email: "",
      job_title: "",
      role: "COLLABORATEUR",
    });
    setShowInviteModal(false);
  }

  async function resendInvitation(invitation: Invitation) {
    if (!organization || !isCurrentUserAdmin()) return;
    const confirmed = window.confirm("Renvoyer cette invitation ?");
    if (!confirmed) return;

    const response = await fetch("/api/invitations/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: invitation.email,
        firstName: invitation.first_name || "",
        lastName: invitation.last_name || "",
        organizationName: organization.name,
        inviterName: getProfileDisplayName(),
        token: invitation.token,
        inviteUrl:
          typeof window !== "undefined"
            ? `${window.location.origin}/invite?token=${invitation.token}`
            : "",
      }),
    });

    setOrganizationStatus(
      response.ok
        ? "Invitation renvoyée."
        : "Impossible de renvoyer l’invitation."
    );
  }

  async function updateInvitationRole(
    invitation: Invitation,
    role: OrganizationRole
  ) {
    if (!isCurrentUserAdmin()) return;
    const confirmed = window.confirm(`Changer le rôle en ${role} ?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("invitations")
      .update({ role })
      .eq("id", invitation.id)
      .eq("organization_id", organization?.id);

    if (error) {
      console.error(error);
      setOrganizationError("Impossible de changer le rôle de l’invitation.");
      return;
    }

    setOrganizationInvitations((currentInvitations) =>
      currentInvitations.map((currentInvitation) =>
        currentInvitation.id === invitation.id
          ? { ...currentInvitation, role }
          : currentInvitation
      )
    );
  }

  async function revokeInvitation(invitation: Invitation) {
    if (!isCurrentUserAdmin()) return;
    const confirmed = window.confirm("Supprimer cette invitation ?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", invitation.id)
      .eq("organization_id", organization?.id);

    if (error) {
      console.error(error);
      setOrganizationError("Impossible de supprimer l’invitation.");
      return;
    }

    setOrganizationInvitations((currentInvitations) =>
      currentInvitations.filter(
        (currentInvitation) => currentInvitation.id !== invitation.id
      )
    );
    setOrganizationStatus("Invitation supprimée.");
  }

  async function updateMemberRole(member: OrganizationMember, role: OrganizationRole) {
    if (!isCurrentUserAdmin()) return;
    const confirmed = window.confirm(`Changer le rôle en ${role} ?`);
    if (!confirmed) return;

    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", member.id)
      .eq("organization_id", organization?.id);

    if (error) {
      console.error(error);
      setOrganizationError("Impossible de changer le rôle.");
      return;
    }

    setOrganizationMembers((currentMembers) =>
      currentMembers.map((currentMember) =>
        currentMember.id === member.id ? { ...currentMember, role } : currentMember
      )
    );
    await logActivity({
      actionType: "member.role_changed",
      description: `${getProfileDisplayName()} a changé le rôle de ${
        member.full_name || member.email || "un membre"
      } en ${role}.`,
      entityType: "profile",
      entityId: null,
    });
  }

  async function updateMemberStatus(
    member: OrganizationMember,
    status: CollaboratorStatus
  ) {
    if (!isCurrentUserAdmin()) return;
    const confirmed = window.confirm(
      status === "suspended"
        ? "Suspendre ce membre ?"
        : "Réactiver ce membre ?"
    );
    if (!confirmed) return;

    const { error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", member.id)
      .eq("organization_id", organization?.id);

    if (error) {
      console.error(error);
      setOrganizationError("Impossible de modifier le statut.");
      return;
    }

    setOrganizationMembers((currentMembers) =>
      currentMembers.map((currentMember) =>
        currentMember.id === member.id
          ? { ...currentMember, status }
          : currentMember
      )
    );
    await logActivity({
      actionType: "member.status_changed",
      description: `${getProfileDisplayName()} a ${
        status === "suspended" ? "suspendu" : "réactivé"
      } ${member.full_name || member.email || "un membre"}.`,
      entityType: "profile",
      entityId: null,
    });
  }

  async function removeMember(member: OrganizationMember) {
    if (!isCurrentUserAdmin()) return;
    const confirmed = window.confirm("Supprimer ce membre de l’entreprise ?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("profiles")
      .update({ organization_id: null, role: null, status: "suspended" })
      .eq("id", member.id)
      .eq("organization_id", organization?.id);

    if (error) {
      console.error(error);
      setOrganizationError("Impossible de supprimer ce membre.");
      return;
    }

    setOrganizationMembers((currentMembers) =>
      currentMembers.filter((currentMember) => currentMember.id !== member.id)
    );
    await logActivity({
      actionType: "member.removed",
      description: `${getProfileDisplayName()} a supprimé ${
        member.full_name || member.email || "un membre"
      } de l’entreprise.`,
      entityType: "profile",
      entityId: null,
    });
  }

  async function resendConfirmationEmail() {
    const email = authEmail.trim();

    if (!email) {
      setAuthError("Indiquez votre adresse email.");
      return;
    }

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      setAuthError(getAuthErrorMessage(error.message));
      return;
    }

    setAuthStatus("Email de confirmation renvoyé.");
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthStatus("");
    setNeedsEmailConfirmation(false);

    const email = authEmail.trim();
    const password = authPassword.trim();
    const fullName = authFullName.trim();

    if (authMode === "forgot") {
      const emailToReset = resetEmail.trim() || email;

      if (!emailToReset) {
        setAuthError("Indiquez votre adresse email.");
        return;
      }

      setIsAuthSubmitting(true);

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(
          emailToReset,
          {
            redirectTo:
              typeof window !== "undefined" ? window.location.origin : undefined,
          }
        );

        if (error) {
          setAuthError(getAuthErrorMessage(error.message));
          return;
        }

        setAuthStatus("Email de réinitialisation envoyé.");
        setResetEmail("");
      } finally {
        setIsAuthSubmitting(false);
      }

      return;
    }

    if (authMode === "update-password") {
      if (!newPassword.trim()) {
        setAuthError("Indiquez un nouveau mot de passe.");
        return;
      }

      setIsAuthSubmitting(true);

      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword.trim(),
        });

        if (error) {
          setAuthError(getAuthErrorMessage(error.message));
          return;
        }

        setAuthStatus("Mot de passe mis à jour.");
        setNewPassword("");
        setAuthMode("login");
      } finally {
        setIsAuthSubmitting(false);
      }

      return;
    }

    if (!email || !password || (authMode === "signup" && !fullName)) {
      setAuthError("Tous les champs obligatoires doivent être renseignés.");
      return;
    }

    setIsAuthSubmitting(true);

    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          const translatedError = getAuthErrorMessage(error.message);
          setAuthError(translatedError);
          setNeedsEmailConfirmation(
            error.message.toLowerCase().includes("email not confirmed")
          );
          return;
        }

        setAuthStatus("Connexion réussie.");
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        setAuthError(getAuthErrorMessage(error.message));
        return;
      }

      if (data.user) {
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: fullName,
          email,
        });

        if (profileError) {
          console.error("Erreur création profil:", profileError);
          setAuthStatus(
            "Compte créé. Le profil sera finalisé après application du SQL profiles."
          );
        } else {
          setAuthStatus(
            data.session
              ? "Compte créé. Bienvenue dans Briefly."
              : "Compte créé. Vérifiez votre email pour confirmer votre adresse."
          );
        }
      }

      setAuthFullName("");
      setAuthEmail("");
      setAuthPassword("");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSignOut() {
    closeAllMenus();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error(error);
      return;
    }

    setAuthUser(null);
    setMeetings([]);
    setDeletedMeetings([]);
    setMeetingFolders([]);
    setEmployees([]);
    setTasks([]);
    setDashboardTasks([]);
    resetCurrentReport();
    closeHistoryMeetingInline({ restoreScroll: false, returnToSource: false });
  }

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
    const userId = getCurrentUserId();
    if (!userId) return;

    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setMeetings(data || []);
  }

  async function loadDeletedMeetings() {
    const userId = getCurrentUserId();
    if (!userId) return;

    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setDeletedMeetings(data || []);
  }

	  async function loadMeetingFolders() {
      const userId = getCurrentUserId();
      if (!userId) return;

	    const { data, error } = await supabase
	      .from("meeting_folders")
	      .select("*")
        .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
    const userId = getCurrentUserId();
    if (!userId) return false;

	    const { error } = await supabase
	      .from("meetings")
	      .update({ folder_id: folderId })
        .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
      const userId = getCurrentUserId();
      if (!userId) return;
      const organizationId = getCurrentOrganizationId();

      const { data, error } = await supabase
        .from("meeting_folders")
        .insert({
          user_id: userId,
          organization_id: organizationId,
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
      await logActivity({
        actionType: "folder.created",
        description: `${getProfileDisplayName()} a créé le dossier “${createdFolder.name}”.`,
        entityType: "meeting_folder",
        entityId: createdFolder.id,
      });
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
      const userId = getCurrentUserId();
      if (!userId) return;

      const { error } = await supabase
        .from("meeting_folders")
        .update({ name: trimmedName })
        .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
    const userId = getCurrentUserId();
    if (!userId) return;

    const detached = await updateMeetingFolder(
      meetings
        .filter((meeting) => meeting.folder_id === folder.id)
        .map((meeting) => meeting.id),
      null
    );

    if (!detached) return;

    const { error } = await supabase
      .from("meeting_folders")
      .delete()
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
      .eq("id", folder.id);

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
    const userId = getCurrentUserId();
    if (!userId) return;

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setEmployees(data || []);
  }

  async function loadMeetingParticipantIndex() {
    const userId = getCurrentUserId();
    if (!userId) return;

    const { data, error } = await supabase
      .from("meeting_participants")
      .select("meeting_id, employees(*)")
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue());

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
    const userId = getCurrentUserId();
    if (!userId) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setDashboardTasks((data || []) as Task[]);
  }

  async function loadActivityLogs() {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;

    const { data, error } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Erreur chargement journal d’activité:", error);
      setWorkspaceError(error.message);
      return;
    }

    setActivityLogs((data || []) as ActivityLog[]);
  }

  async function logActivity({
    actionType,
    description,
    entityType,
    entityId,
  }: {
    actionType: string;
    description: string;
    entityType?: string;
    entityId?: number | null;
  }) {
    const organizationId = getCurrentOrganizationId();
    if (!organizationId) return;

    const { error } = await supabase.from("activity_logs").insert({
      organization_id: organizationId,
      actor_id: getCurrentUserId(),
      actor_name: getProfileDisplayName(),
      action_type: actionType,
      description,
      entity_type: entityType || null,
      entity_id: entityId || null,
    });

    if (error) {
      console.error("Erreur journal d’activité:", error);
    }
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

  function clearTemporaryRecording() {
    setFile(null);
    setMessage("");
    setReportError("");
    setCurrentTitle("");
    setLiveMeetingElapsedSeconds(0);
    setSelectedEmployees([]);
    setPendingParticipantIds([]);
    endLiveMeetingSession();
    setShowDeleteRecordingConfirm(false);
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
  const userId = getCurrentUserId();
  if (!userId) return;
  const organizationId = getCurrentOrganizationId();

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
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
      user_id: userId,
      organization_id: organizationId,
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

  async function deleteMeeting(id: number) {
    const userId = getCurrentUserId();
    if (!userId) return;

    const confirmed = window.confirm(
      "Es-tu sûr de vouloir supprimer cette réunion ? Elle sera placée dans la corbeille pendant 30 jours."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("meetings")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    await loadMeetings();
    await loadDeletedMeetings();
  }

  async function restoreMeeting(id: number) {
    const userId = getCurrentUserId();
    if (!userId) return;

    const { error } = await supabase
      .from("meetings")
      .update({
        deleted_at: null,
      })
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    await loadMeetings();
    await loadDeletedMeetings();
  }

  async function permanentlyDeleteMeeting(id: number) {
    const userId = getCurrentUserId();
    if (!userId) return;

    const confirmed = window.confirm(
      "Supprimer définitivement cette réunion ? Cette action est irréversible."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("meetings")
      .delete()
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
      .eq("id", id);

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

  function normalizeTaskPriority(priority: string | null | undefined) {
    const normalizedPriority = (priority || "").trim().toLowerCase();

    if (normalizedPriority === "haute" || normalizedPriority === "urgent") {
      return "Haute";
    }

    if (normalizedPriority === "basse") {
      return "Basse";
    }

    if (normalizedPriority === "urgente") {
      return "Urgente";
    }

    return "Normale";
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
  if (!tasks || tasks.length === 0) return [];
  const userId = getCurrentUserId();
  if (!userId) return [];
  const organizationId = getCurrentOrganizationId();

  const tasksToInsert = tasks.map((task) => {
  const assignment = findBestResponsible(task);

  return {
    user_id: userId,
    organization_id: organizationId,
    created_by: userId,
    meeting_id: meetingId,
    action: task.action,
    responsible: assignment.employee?.name || task.responsible || null,
    responsible_employee_id: assignment.employee?.id || null,
    due_date: normalizeTaskDueDate(task.due_date),
    priority: normalizeTaskPriority(task.priority),
    status: "À faire",
  };
});
  const { data, error } = await supabase
    .from("tasks")
    .insert(tasksToInsert)
    .select("*");

  if (error) {
    console.error(error);
    throw error;
  }

  return (data || []) as Task[];
}

  async function saveMeeting(
  title: string,
  report: string,
	  fileName: string,
	  participantIds: number[] = selectedEmployees,
	  folderId: number | null = null
) {
    const userId = getCurrentUserId();
    if (!userId) return null;
    const organizationId = getCurrentOrganizationId();

    const meetingPayload: {
      user_id: string;
      organization_id: number | null;
      title: string;
      report: string;
      file_name: string;
      folder_id?: number | null;
    } = {
      user_id: userId,
      organization_id: organizationId,
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
        user_id: userId,
        organization_id: organizationId,
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
  await logActivity({
    actionType: "meeting.created",
    description: `${getProfileDisplayName()} a créé la réunion “${title}”.`,
    entityType: "meeting",
    entityId: data.id,
  });
}
    if (data && participantIds.length > 0) {
      const participantsToInsert = participantIds.map((employeeId) => ({
        user_id: userId,
        organization_id: organizationId,
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

  function getDetectedTaskResponsibleLabel(task: TaskFromAI) {
    if (task.responsible_employee_id) {
      const employee = employees.find(
        (currentEmployee) => currentEmployee.id === task.responsible_employee_id
      );

      if (employee) return employee.name;
    }

    return task.responsible || "Non attribué";
  }

  function ignoreDetectedTask(tempId: string) {
    setPendingDetectedTasks((currentTasks) =>
      currentTasks.filter((task) => task.tempId !== tempId)
    );
  }

  async function createDetectedTasks(tasksToCreate: PendingDetectedTask[]) {
    if (tasksToCreate.length === 0) return;

    const taskIds = tasksToCreate.map((task) => task.tempId);
    setCreatingDetectedTaskIds((currentIds) => [
      ...new Set([...currentIds, ...taskIds]),
    ]);

    try {
      const createdTasks = await saveTasks(
        tasksToCreate[0].meetingId,
        tasksToCreate
      );

      if (createdTasks.length > 0) {
        setTasks((currentTasks) => [...currentTasks, ...createdTasks]);
        setDashboardTasks((currentTasks) => [...createdTasks, ...currentTasks]);
        setPendingDetectedTasks((currentTasks) =>
          currentTasks.filter((task) => !taskIds.includes(task.tempId))
        );
        await logActivity({
          actionType: "tasks.created",
          description:
            createdTasks.length === 1
              ? `${getProfileDisplayName()} a créé la tâche “${createdTasks[0].action}”.`
              : `${getProfileDisplayName()} a créé ${createdTasks.length} tâches détectées automatiquement.`,
          entityType: "task",
          entityId: createdTasks[0]?.id || null,
        });
      }
    } catch (error) {
      console.error("Erreur création tâches détectées:", error);
      alert("Impossible de créer la tâche détectée. Consulte la console.");
    } finally {
      setCreatingDetectedTaskIds((currentIds) =>
        currentIds.filter((taskId) => !taskIds.includes(taskId))
      );
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
  participantIds
);

if (!savedMeetingId) {
  setReportError("Le compte rendu a été généré, mais la sauvegarde a échoué.");
  setMessage("");
  return;
}

await loadMeetingTasks(savedMeetingId);
setPendingDetectedTasks(
  (data.tasks || []).map((task, index) => ({
    ...task,
    tempId: `${savedMeetingId}-${index}-${Date.now()}`,
    meetingId: savedMeetingId,
  }))
);
setCreatingDetectedTaskIds([]);
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
    if (normalizeTaskStatus(task.status) === "Terminée") {
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
  const userId = getCurrentUserId();
  if (!userId) return;

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
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
      (task) => normalizeTaskStatus(task.status) !== "Terminée"
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
    const userId = getCurrentUserId();
    if (!userId) {
      return { reportTasks: [], participants: [] };
    }

    const [tasksResponse, participantsResponse] = await Promise.all([
      supabase
        .from("tasks")
        .select("*")
        .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
        .eq("meeting_id", meetingId)
        .order("created_at", { ascending: true }),
      supabase
        .from("meeting_participants")
        .select("employees(*)")
        .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
    const userId = getCurrentUserId();
    if (!userId) return;

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
      .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
  const userId = getCurrentUserId();
  if (!userId) return;

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
  if (status === "Fait" || status === "Terminée") {
    return "Terminée";
  }

  if (status === "En cours" || status === "En retard") {
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
    return "Terminée";
  }

  if (currentStatus === "Terminée" && task.due_date && task.due_date < getLocalDateIso()) {
    return "En retard";
  }

  return "À faire";
}

function getEffectiveTaskStatus(task: Task): TaskStatus {
  const status = normalizeTaskStatus(task.status);

  if (
    status !== "Terminée" &&
    task.due_date &&
    task.due_date < getLocalDateIso()
  ) {
    return "En retard";
  }

  return status;
}

function getTaskMeeting(task: Task) {
  return meetings.find((meeting) => meeting.id === task.meeting_id) || null;
}

function getTaskResponsibleEmployee(task: Task) {
  if (task.responsible_employee_id) {
    return (
      employees.find((employee) => employee.id === task.responsible_employee_id) ||
      null
    );
  }

  const responsibleName = task.responsible?.toLowerCase().trim();

  if (!responsibleName) return null;

  return (
    employees.find(
      (employee) => employee.name.toLowerCase().trim() === responsibleName
    ) || null
  );
}

function getTaskPriorityClass(priority: string | null | undefined) {
  const normalizedPriority = normalizeTaskPriority(priority);

  if (normalizedPriority === "Urgente") {
    return "bg-red-50 text-red-700 ring-red-100";
  }

  if (normalizedPriority === "Haute") {
    return "bg-orange-50 text-orange-700 ring-orange-100";
  }

  if (normalizedPriority === "Basse") {
    return "bg-gray-50 text-gray-600 ring-gray-100";
  }

  return "bg-blue-50 text-blue-700 ring-blue-100";
}

function getDashboardTaskTitle(selection: DashboardSelection) {
  if (selection === "meetings") return "Réunions";
  if (selection === "progress") return "Tâches en cours";
  if (selection === "done") return "Tâches terminées";
  if (selection === "overdue") return "Tâches en retard";
  return "Mes tâches ouvertes";
}

async function updateTaskStatus(task: Task, status: TaskStatus) {
  const userId = getCurrentUserId();
  if (!userId) return;

  const completedAt = status === "Terminée" ? new Date().toISOString() : null;
  const updatePayload = {
    status,
    completed_at: completedAt,
  };

  const { error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
        .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
  await logActivity({
    actionType:
      status === "Terminée" ? "task.completed" : "task.status_changed",
    description:
      status === "Terminée"
        ? `${getProfileDisplayName()} a terminé la tâche “${task.action}”.`
        : `${getProfileDisplayName()} a passé la tâche “${task.action}” en ${status}.`,
    entityType: "task",
    entityId: task.id,
  });
}

async function updateTaskAction(task: Task) {
  const userId = getCurrentUserId();
  if (!userId) return;

  const nextAction = editedTaskAction.trim();

  if (!nextAction) {
    alert("Le texte de la tâche ne peut pas être vide.");
    return;
  }

  const { error } = await supabase
    .from("tasks")
    .update({ action: nextAction })
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
  const userId = getCurrentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
  const userId = getCurrentUserId();
  if (!userId) return;
  const currentTask =
    dashboardTasks.find((task) => task.id === taskId) ||
    tasks.find((task) => task.id === taskId) ||
    historyTasks.find((task) => task.id === taskId);

  const { error } = await supabase
    .from("tasks")
    .update({ due_date: dueDate || null })
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
    .eq("id", taskId);

  if (error) {
    console.error(error);
    return;
  }

  updateTaskEverywhere(taskId, (task) => ({
    ...task,
    due_date: dueDate || null,
  }));
  if (currentTask) {
    await logActivity({
      actionType: "task.due_date_changed",
      description: `${getProfileDisplayName()} a modifié la date limite de “${currentTask.action}”.`,
      entityType: "task",
      entityId: taskId,
    });
  }
}
async function updateTaskResponsible(task: Task, employeeId: number) {
  const userId = getCurrentUserId();
  if (!userId) return;

  const employee = employees.find((e) => e.id === employeeId);

  if (!employee) {
    alert("Membre introuvable.");
    return;
  }

  const updatePayload = {
    responsible: employee.name,
    responsible_employee_id: employee.id,
  };

  const { error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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
  await logActivity({
    actionType: "task.responsible_changed",
    description: `${employee.name} a pris la responsabilité de “${task.action}”.`,
    entityType: "task",
    entityId: task.id,
  });

  closeAllMenus();
}

async function updateTaskPriority(task: Task, priority: Task["priority"]) {
  const userId = getCurrentUserId();
  if (!userId) return;

  const normalizedPriority = normalizeTaskPriority(priority) as Task["priority"];

  const { error } = await supabase
    .from("tasks")
    .update({ priority: normalizedPriority })
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
    .eq("id", task.id);

  if (error) {
    console.error(error);
    alert("Erreur lors de la modification de la priorité.");
    return;
  }

  updateTaskEverywhere(task.id, (currentTask) => ({
    ...currentTask,
    priority: normalizedPriority,
  }));
  await logActivity({
    actionType: "task.priority_changed",
    description: `${getProfileDisplayName()} a passé la priorité de “${task.action}” à ${normalizedPriority}.`,
    entityType: "task",
    entityId: task.id,
  });
}

async function createResponsibleAndAssignTask(task: Task) {
  const userId = getCurrentUserId();
  if (!userId) return;
  const organizationId = getCurrentOrganizationId();

  if (!newResponsibleForm.name.trim()) {
    alert("Le nom du responsable est obligatoire.");
    return;
  }

  const { data, error } = await supabase
    .from("employees")
    .insert({
      user_id: userId,
      organization_id: organizationId,
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
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
    .eq("id", task.id);

  if (updateError) {
    console.error(updateError);
    alert("Le membre a été créé, mais la tâche n'a pas pu être assignée.");
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

  if (status === "Terminée") {
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
  if (period === "today") return "Aujourd’hui";
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

  if (period === "today") {
    return getLocalDateIso(date) === getLocalDateIso();
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
    (task) => normalizeTaskStatus(task.status) !== "Terminée"
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
    /mot de passe|password|identifiant confidentiel|code confidentiel/i,
    /salaire|rémunération|bulletin de paie|prime|bonus/i,
    /donnée bancaire|carte bancaire|coordonnées bancaires|numéro de carte/i,
    /confidentiel|secret|information personnelle|donnée personnelle/i,
    /numéro de sécurité sociale|nss|données personnelles/i,
  ].some((pattern) => pattern.test(report));
}

function copySectionContent(content: string, label: string) {
  navigator.clipboard
    ?.writeText(content)
    .then(() => {
      setCopiedNotice("✓ Copié");
      setCopiedSectionLabel(label);
      window.setTimeout(() => {
        setCopiedNotice("");
        setCopiedSectionLabel("");
      }, 1000);
    })
    .catch((error) => {
      console.error(error);
      setCopiedNotice("Impossible de copier cette section.");
      setCopiedSectionLabel("");
      window.setTimeout(() => setCopiedNotice(""), 1000);
    });
}

function toggleReportSection(sectionKey: string) {
  setOpenReportSections((currentSections) => ({
    ...currentSections,
    [sectionKey]: !(currentSections[sectionKey] ?? true),
  }));
}

function canCopyReportSection(title: string | null) {
  const normalizedTitle = (title || "").toLowerCase();

  return [
    "résumé exécutif",
    "points clés",
    "décisions prises",
    "risques ou points à clarifier",
  ].some((sectionTitle) => normalizedTitle.includes(sectionTitle));
}

function renderHighlightedText(text: string, query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return text;
  }

  const escapedQuery = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escapedQuery})`, "gi"));

  return parts.map((part, index) =>
    part.toLowerCase() === trimmedQuery.toLowerCase() ? (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-yellow-100 px-0.5 text-gray-950"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function getDashboardSelectionForTask(task: Task): Exclude<DashboardSelection, "meetings" | null> {
  const { overdueTasks } = getUrgentTasks([task]);

  if (overdueTasks.length > 0) {
    return "overdue";
  }

  const taskStatus = normalizeTaskStatus(task.status);

  if (taskStatus === "En cours") {
    return "progress";
  }

  if (taskStatus === "Terminée") {
    return "done";
  }

  return "todo";
}

function focusDashboardTask(task: Task) {
  setDashboardSelection(getDashboardSelectionForTask(task));
  setFocusedDashboardTaskId(task.id);
  setHighlightedDashboardTaskId(task.id);

  window.setTimeout(() => {
    document
      .getElementById("dashboard-selection-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 80);

  window.setTimeout(() => {
    setHighlightedDashboardTaskId((currentTaskId) =>
      currentTaskId === task.id ? null : currentTaskId
    );
  }, 2100);
}

function clearDashboardSearchFocus() {
  setFocusedDashboardTaskId(null);
  setHighlightedDashboardTaskId(null);
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
    <div className="space-y-5">
      {sections.map((section, index) =>
        section.title ? (
          <section
            key={`${section.title}-${index}`}
            className="group rounded-xl border border-gray-200 bg-gray-50/80 p-4 transition duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:bg-white hover:shadow-sm"
          >
            {(() => {
              const sectionKey = `${section.title}-${index}`;
              const sectionText =
                section.content.join("\n").trim() ||
                getEmptySectionMessage(section.title);
              const isOpen = openReportSections[sectionKey] ?? true;
              const canCopy = canCopyReportSection(section.title);
              const copyLabel =
                copiedNotice === "✓ Copié" &&
                copiedSectionLabel === section.title
                  ? "✓ Copié"
                  : "📋";

              return (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleReportSection(sectionKey)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left text-sm font-semibold text-gray-950"
                    >
                      <span
                        className="inline-block text-gray-500 transition-transform duration-200"
                      >
                        {isOpen ? "▼" : "▶"}
                      </span>
                      <span>{section.title}</span>
                    </button>

                    {canCopy && (
                      <button
                        type="button"
                        title="Copier cette section"
                        aria-label="Copier cette section"
                        onClick={() =>
                          copySectionContent(
                            sectionText,
                            section.title || "Section"
                          )
                        }
                        className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 opacity-0 shadow-sm transition duration-200 hover:bg-gray-100 group-hover:opacity-100"
                      >
                        {copyLabel}
                      </button>
                    )}
                  </div>

                  {isOpen && (
                    <div className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-gray-700">
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
    alert("Responsable introuvable dans la liste des membres.");
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
  if (status === "Terminée") {
    return "bg-green-100 text-green-700 hover:bg-green-200";
  }

  if (status === "En cours") {
    return "bg-orange-100 text-orange-700 hover:bg-orange-200";
  }

  return "bg-red-100 text-red-700 hover:bg-red-200";
}

function getTaskStatusLabel(status: TaskStatus) {
  if (status === "Terminée") {
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
    (task) => normalizeTaskStatus(task.status) !== "Terminée"
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
  const userId = getCurrentUserId();
  if (!userId) return;

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  setHistoryTasks(data || []);
}

async function loadHistoryMeetingParticipants(meetingId: number) {
  const userId = getCurrentUserId();
  if (!userId) return;

  const { data, error } = await supabase
    .from("meeting_participants")
    .select("employees(*)")
    .eq(getWorkspaceScopeColumn(), getWorkspaceScopeValue())
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

async function openHistoryMeetingInline(
  meeting: Meeting,
  returnSection: AppSection | null = null
) {
  closeAllMenus();
  setHistoryScrollBeforeOpen(window.scrollY);
  setHistoryReturnSection(returnSection);
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

async function openDashboardMeetingInHistory(
  meeting: Meeting,
  returnSection: AppSection = "dashboard"
) {
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
  await openHistoryMeetingInline(meeting, returnSection);

  window.setTimeout(() => {
    document
      .getElementById(`history-meeting-${meeting.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 120);
}

function closeHistoryMeetingInline(
  options: { restoreScroll?: boolean; returnToSource?: boolean } = {}
) {
  const { restoreScroll = true, returnToSource = true } = options;
  const returnSection = returnToSource ? historyReturnSection : null;

  setOpenedHistoryMeetingId(null);
  setHistoryReturnSection(null);
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
  if (returnSection) {
    setActiveSection(returnSection);
    return;
  }

  if (restoreScroll) {
    window.setTimeout(() => {
      window.scrollTo({ top: historyScrollBeforeOpen, behavior: "smooth" });
    }, 0);
  }
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
  setPendingDetectedTasks([]);
  setCreatingDetectedTaskIds([]);
  setIsEditing(false);
  setIsCurrentParticipantsOpen(false);
  setIsCurrentTasksOpen(false);
}

function resetTemporaryNavigationState() {
  setDashboardSearch("");
  setMeetingSearch("");
  setCollaboratorSearch("");
  setParticipantSearch("");
  clearDashboardSearchFocus();
}

function navigateToSection(section: AppSection) {
  closeAllMenus();

  if (activeSection === "history" && section !== "history" && openedHistoryMeetingId) {
    closeHistoryMeetingInline({ restoreScroll: false, returnToSource: false });
  }

  resetTemporaryNavigationState();
  setActiveSection(section);
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
const collaboratorSearchText = collaboratorSearch.toLowerCase().trim();
const normalizedMembers = organizationMembers.map((member) => {
  const fullName =
    member.full_name ||
    `${member.first_name || ""} ${member.last_name || ""}`.trim() ||
    member.email ||
    "Membre";

  return {
    type: "member" as const,
    key: `member-${member.id}`,
    id: member.id,
    firstName: member.first_name || fullName.split(" ")[0] || "",
    lastName:
      member.last_name ||
      fullName.split(" ").slice(1).join(" ") ||
      "",
    displayName: fullName,
    email: member.email || "",
    jobTitle: member.job_title || "",
    role: member.role || "COLLABORATEUR",
    status: member.status === "suspended" ? "Suspendu" : "Actif",
    joinedAt: member.created_at,
    raw: member,
  };
});
const normalizedInvitations = organizationInvitations.map((invitation) => ({
  type: "invitation" as const,
  key: `invitation-${invitation.id}`,
  id: String(invitation.id),
  firstName: invitation.first_name || "",
  lastName: invitation.last_name || "",
  displayName:
    `${invitation.first_name || ""} ${invitation.last_name || ""}`.trim() ||
    invitation.email,
  email: invitation.email,
  jobTitle: invitation.job_title || "",
  role: invitation.role,
  status:
    invitation.status === "accepted"
      ? "Invitation acceptée"
      : "Invitation envoyée",
  joinedAt: invitation.created_at,
  raw: invitation,
}));
const filteredCollaborators = [
  ...normalizedMembers,
  ...normalizedInvitations.filter((invitation) => invitation.raw.status !== "accepted"),
].filter((collaborator) => {
  const searchableText = [
    collaborator.firstName,
    collaborator.lastName,
    collaborator.displayName,
    collaborator.email,
    collaborator.jobTitle,
  ]
    .join(" ")
    .toLowerCase();

  const matchesSearch =
    !collaboratorSearchText || searchableText.includes(collaboratorSearchText);
  const matchesFilter =
    collaboratorFilter === "all" ||
    (collaboratorFilter === "admins" && collaborator.role === "ADMIN") ||
    (collaboratorFilter === "managers" && collaborator.role === "MANAGER") ||
    (collaboratorFilter === "collaborators" &&
      collaborator.role === "COLLABORATEUR") ||
    (collaboratorFilter === "pending" &&
      collaborator.type === "invitation" &&
      collaborator.raw.status === "pending");

  return matchesSearch && matchesFilter;
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

function getMeetingAuthorName(meeting: Meeting) {
  if (!meeting.user_id) return null;

  const member = organizationMembers.find(
    (currentMember) => currentMember.id === meeting.user_id
  );

  return member?.full_name || member?.email || null;
}

function buildCompanyMemoryCorpus() {
  return meetings.map((meeting) => {
    const participants = meetingParticipantsByMeetingId[meeting.id] || [];
    const meetingTasks = getMeetingTasks(meeting.id);
    const folder = getMeetingFolderById(meeting.folder_id);

    return {
      meeting_id: meeting.id,
      title: meeting.title,
      date: meeting.created_at,
      author: getMeetingAuthorName(meeting),
      folder: folder?.name || null,
      report: meeting.report,
      participants: participants.map((participant) => ({
        name: participant.name,
        role: participant.role,
        email: participant.email,
      })),
      tasks: meetingTasks.map((task) => ({
        action: task.action,
        responsible: task.responsible,
        due_date: task.due_date,
        status: normalizeTaskStatus(task.status),
        priority: task.priority || null,
      })),
    };
  });
}

function isAssistantQuestion(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return false;

  return (
    normalizedQuery.includes("?") ||
    /^(qui|que|quoi|quand|où|ou|comment|pourquoi|combien|quelles?|résume|resume|montre|liste|affiche|donne|retrouve)\b/.test(
      normalizedQuery
    ) ||
    normalizedQuery.split(/\s+/).length >= 5
  );
}

function getQuickCommand(query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) return null;

  if (
    ["créer une réunion", "creer une reunion", "nouvelle réunion", "nouvelle reunion"].some(
      (command) => command.startsWith(normalizedQuery) || normalizedQuery === command
    )
  ) {
    return {
      label: "Créer une réunion",
      description: "Ouvrir l’onglet Nouvelle réunion",
      action: () => navigateToSection("new"),
    };
  }

  if (
    ["inviter un membre", "inviter membre", "nouveau membre"].some(
      (command) => command.startsWith(normalizedQuery) || normalizedQuery === command
    )
  ) {
    return {
      label: "Inviter un membre",
      description: "Ouvrir le formulaire d’invitation",
      action: () => {
        setShowInviteModal(true);
      },
    };
  }

  if (
    ["afficher les tâches en retard", "tâches en retard", "taches en retard"].some(
      (command) => command.startsWith(normalizedQuery) || normalizedQuery === command
    )
  ) {
    return {
      label: "Afficher les tâches en retard",
      description: "Filtrer le tableau de bord sur les tâches en retard",
      action: () => {
        clearDashboardSearchFocus();
        setDashboardSelection("overdue");
        window.setTimeout(() => {
          document
            .getElementById("dashboard-selection-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      },
    };
  }

  if (
    [
      "afficher les réunions de cette semaine",
      "afficher les reunions de cette semaine",
      "réunions de cette semaine",
      "reunions de cette semaine",
    ].some(
      (command) => command.startsWith(normalizedQuery) || normalizedQuery === command
    )
  ) {
    return {
      label: "Afficher les réunions de cette semaine",
      description: "Filtrer le tableau de bord sur les réunions de la semaine",
      action: () => {
        clearDashboardSearchFocus();
        setDashboardPeriod("week");
        setDashboardSelection("meetings");
        window.setTimeout(() => {
          document
            .getElementById("dashboard-selection-panel")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      },
    };
  }

  if (
    ["nouvelle tâche", "nouvelle tache", "créer une tâche", "creer une tache"].some(
      (command) => command.startsWith(normalizedQuery) || normalizedQuery === command
    )
  ) {
    return {
      label: "Nouvelle tâche",
      description: "Afficher les tâches ouvertes",
      action: () => {
        clearDashboardSearchFocus();
        setDashboardSelection("todo");
      },
    };
  }

  return null;
}

function openEmployeeProfile(employee: Employee) {
  closeAllMenus();
  setEditingEmployee(employee);
  setEmployeeForm({
    name: employee.name,
    role: employee.role,
    email: employee.email,
  });
  setShowEmployeeModal(true);
}

function getDashboardSmartSuggestions() {
  const baseSuggestions = [
    "Qu’avons-nous décidé concernant le budget ?",
    "Qui devait envoyer le devis ?",
    "Quand avons-nous parlé du budget ?",
    "Résumer les réunions de cette semaine.",
  ];
  const normalizedQuery = dashboardSearch.trim().toLowerCase();

  if (!normalizedQuery) {
    return baseSuggestions;
  }

  const meetingSuggestions = meetings
    .filter((meeting) => getMeetingSearchText(meeting).includes(normalizedQuery))
    .slice(0, 3)
    .map((meeting) => `Que sait-on de ${meeting.title} ?`);
  const taskSuggestions = dashboardTasks
    .filter((task) => getTaskSearchText(task).includes(normalizedQuery))
    .slice(0, 2)
    .map((task) => `Quel est le suivi de la tâche "${task.action}" ?`);
  const employeeSuggestions = employees
    .filter((employee) => getEmployeeSearchText(employee).includes(normalizedQuery))
    .slice(0, 2)
    .map((employee) => `Montre-moi les réunions où ${employee.name} apparaît.`);
  const folderSuggestions = meetingFolders
    .filter((folder) =>
      [folder.name, folder.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    )
    .slice(0, 2)
    .map((folder) => `Que sait-on du dossier ${folder.name} ?`);

  return [
    ...new Set([
      ...meetingSuggestions,
      ...taskSuggestions,
      ...employeeSuggestions,
      ...folderSuggestions,
      ...baseSuggestions,
    ]),
  ].slice(0, 6);
}

async function searchCompanyMemory(queryOverride?: string) {
  const query = (queryOverride ?? dashboardSearch).trim();

  if (!query) {
    setMemoryError("Saisissez une question pour interroger la mémoire.");
    return;
  }

  if (meetings.length === 0) {
    setMemoryAnswer("");
    setMemorySources([]);
    setMemoryError("Aucune réunion n’est encore disponible dans la mémoire.");
    return;
  }

  setDashboardSearch(query);
  setIsMemorySearching(true);
  setMemoryError("");
  setMemoryAnswer("");
  setMemorySources([]);

  try {
    const response = await fetch("/api/memory-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        corpus: buildCompanyMemoryCorpus(),
      }),
    });
    const data = (await response.json()) as MemorySearchResponse;

    if (!response.ok) {
      throw new Error(data.error || "Recherche impossible pour le moment.");
    }

    setMemoryAnswer(data.answer);
    setMemorySources(data.sources || []);
    setMemoryRecentSearches((currentSearches) => [
      query,
      ...currentSearches.filter((currentQuery) => currentQuery !== query),
    ].slice(0, 6));
  } catch (error) {
    console.error("Erreur recherche Mémoire :", error);
    setMemoryError(
      error instanceof Error
        ? error.message
        : "Erreur pendant la recherche dans la mémoire."
    );
  } finally {
    setIsMemorySearching(false);
  }
}

async function openMemorySource(source: MemorySource) {
  const meeting = meetings.find(
    (currentMeeting) => currentMeeting.id === source.meeting_id
  );

  if (!meeting) {
    setMemoryError("Réunion introuvable dans l’espace de travail.");
    return;
  }

  await openDashboardMeetingInHistory(meeting, "dashboard");
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
	    (taskStatusFilter === "done" && taskStatus === "Terminée") ||
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
                  Réunion ouverte
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
                    const isCompleted = normalizeTaskStatus(task.status) === "Terminée";

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

  function renderAuthScreen() {
    const isSignup = authMode === "signup";
    const isForgotPassword = authMode === "forgot";
    const isUpdatingPassword = authMode === "update-password";
    const authTitle = isSignup
      ? "Créer un compte"
      : isForgotPassword
        ? "Réinitialiser le mot de passe"
        : isUpdatingPassword
          ? "Nouveau mot de passe"
          : "Connexion";

    return (
      <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-950">
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-10 lg:grid-cols-[1fr_440px]">
          <div className="px-2">
            <div className="mb-10 inline-flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                B
              </span>
              <span className="text-sm font-semibold tracking-wide">Briefly</span>
            </div>

            <h1 className="max-w-2xl text-5xl font-bold tracking-tight sm:text-6xl">
              Bienvenue sur Briefly
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-gray-600">
              L’assistant intelligent qui transforme vos réunions en actions.
            </p>

            <div className="mt-10 grid max-w-2xl gap-3 text-sm text-gray-600 sm:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                Comptes rendus fiables
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                Tâches actionnables
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                Suivi sécurisé
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/70 sm:p-8">
            {!isForgotPassword && !isUpdatingPassword && (
              <div className="mb-7 grid grid-cols-2 rounded-full bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                    setAuthStatus("");
                    setNeedsEmailConfirmation(false);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    authMode === "login"
                      ? "bg-black text-white"
                      : "text-gray-700 hover:bg-white"
                  }`}
                >
                  Connexion
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signup");
                    setAuthError("");
                    setAuthStatus("");
                    setNeedsEmailConfirmation(false);
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    authMode === "signup"
                      ? "bg-black text-white"
                      : "text-gray-700 hover:bg-white"
                  }`}
                >
                  Inscription
                </button>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-2xl font-bold">{authTitle}</h2>
              <p className="mt-2 text-sm text-gray-600">
                {isForgotPassword
                  ? "Recevez un lien Supabase sécurisé pour réinitialiser votre mot de passe."
                  : isUpdatingPassword
                    ? "Saisissez votre nouveau mot de passe pour finaliser la récupération."
                    : "Accédez à votre espace de travail Briefly."}
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {isSignup && (
                <label className="block text-sm font-medium text-gray-700">
                  Nom
                  <input
                    type="text"
                    value={authFullName}
                    onChange={(e) => setAuthFullName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-gray-500"
                    placeholder="Votre nom"
                    autoComplete="name"
                  />
                </label>
              )}

              {isUpdatingPassword ? (
                <label className="block text-sm font-medium text-gray-700">
                  Nouveau mot de passe
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-gray-500"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </label>
              ) : (
                <label className="block text-sm font-medium text-gray-700">
                  Email
                  <input
                    type="email"
                    value={isForgotPassword ? resetEmail : authEmail}
                    onChange={(e) =>
                      isForgotPassword
                        ? setResetEmail(e.target.value)
                        : setAuthEmail(e.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-gray-500"
                    placeholder="vous@entreprise.com"
                    autoComplete="email"
                  />
                </label>
              )}

              {!isForgotPassword && !isUpdatingPassword && (
                <label className="block text-sm font-medium text-gray-700">
                  Mot de passe
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-gray-500"
                    placeholder="••••••••"
                    autoComplete={isSignup ? "new-password" : "current-password"}
                  />
                </label>
              )}

              {authMode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("forgot");
                    setAuthError("");
                    setAuthStatus("");
                    setResetEmail(authEmail);
                  }}
                  className="text-sm font-medium text-gray-600 underline-offset-4 hover:text-black hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              )}

              {authError && (
                <div className="space-y-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <p>{authError}</p>
                  {needsEmailConfirmation && (
                    <button
                      type="button"
                      onClick={resendConfirmationEmail}
                      className="font-semibold underline-offset-4 hover:underline"
                    >
                      Renvoyer l’email de confirmation
                    </button>
                  )}
                </div>
              )}

              {authStatus && (
                <p className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {authStatus}
                </p>
              )}

              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="w-full rounded-xl bg-black px-4 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {isAuthSubmitting
                  ? "Patientez..."
                  : isForgotPassword
                    ? "Envoyer le lien"
                    : isUpdatingPassword
                      ? "Mettre à jour"
                      : isSignup
                        ? "Créer mon compte"
                        : "Se connecter"}
              </button>

              {(isForgotPassword || isUpdatingPassword) && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                    setAuthStatus("");
                  }}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold transition hover:bg-gray-50"
                >
                  Retour à la connexion
                </button>
              )}
            </form>
          </div>
        </section>
      </main>
    );
  }

  function renderOrganizationOnboarding() {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <button
          type="button"
          onClick={handleSignOut}
          className="absolute left-5 top-5 rounded-full px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-white hover:text-black hover:shadow-sm"
        >
          ← Retour à la connexion
        </button>

        <section className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-200/70 sm:p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-black font-bold text-white">
              B
            </div>
            <h1 className="text-3xl font-bold">Bienvenue sur Briefly.</h1>
            <p className="mt-3 text-gray-600">
              Commençons par créer votre espace de travail.
            </p>
          </div>

          <form onSubmit={createOrganization} className="grid gap-4">
            <label className="block text-sm font-medium text-gray-700">
              Nom de l’entreprise
              <input
                type="text"
                value={organizationForm.name}
                onChange={(e) =>
                  setOrganizationForm((currentForm) => ({
                    ...currentForm,
                    name: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-gray-500"
                placeholder="Entreprise Martin"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Secteur d’activité
              <input
                type="text"
                value={organizationForm.industry}
                onChange={(e) =>
                  setOrganizationForm((currentForm) => ({
                    ...currentForm,
                    industry: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-gray-500"
                placeholder="Conseil, industrie, services..."
              />
            </label>

            {organizationError && (
              <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {organizationError}
              </p>
            )}
            {organizationStatus && (
              <p className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                {organizationStatus}
              </p>
            )}

            <button
              type="submit"
              disabled={isOrganizationSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-5 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isOrganizationSaving && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              )}
              {isOrganizationSaving
                ? "Création de votre espace…"
                : "Créer mon espace"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 text-sm text-gray-600 shadow-sm">
          Chargement de Briefly...
        </div>
      </main>
    );
  }

  if (!authUser) {
    return renderAuthScreen();
  }

  if (isProfileLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5 text-sm text-gray-600 shadow-sm">
          Chargement de votre espace...
        </div>
      </main>
    );
  }

  if (!organization) {
    return renderOrganizationOnboarding();
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center p-8">
      <div className="absolute left-4 top-4 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm">
        🏢 {organization.name}
      </div>

      <div className="absolute right-4 top-4 z-40">
        <button
          type="button"
          data-menu-trigger
          onClick={(e) => {
            e.stopPropagation();
            setIsUserMenuOpen((currentIsOpen) => !currentIsOpen);
          }}
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2 py-2 text-sm shadow-sm transition hover:shadow-md"
          aria-label="Ouvrir le menu utilisateur"
        >
          {renderUserAvatar("h-8 w-8")}
          <span className="hidden max-w-[180px] truncate pr-2 text-gray-700 sm:block">
            {getProfileDisplayName()}
          </span>
        </button>

        {isUserMenuOpen && (
          <div
            data-menu-content
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
          >
            <button
              type="button"
              onClick={() => {
                setActiveSection("profile");
                setIsUserMenuOpen(false);
              }}
              className="block w-full border-b border-gray-100 p-4 text-left transition hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                {renderUserAvatar("h-10 w-10")}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {getProfileDisplayName()}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    {authUser.email}
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveSection("organization");
                setIsUserMenuOpen(false);
              }}
              className="block w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
            >
              Entreprise
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSection("organization");
                setOrganizationStatus(
                  "Les paramètres avancés arriveront dans une prochaine étape."
                );
                setIsUserMenuOpen(false);
              }}
              className="block w-full px-4 py-3 text-left text-sm hover:bg-gray-50"
            >
              Paramètres
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="block w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Déconnexion
            </button>
          </div>
        )}
      </div>

      <h1 className="text-4xl font-bold mt-12 mb-6">Briefly</h1>

      <p className="mb-8 text-center">
        Transformez vos réunions audio en comptes rendus clairs.
      </p>

		      <nav className="mb-10 flex flex-wrap justify-center gap-2 rounded-full bg-gray-100 p-1">
	        {[
	          ["dashboard", "Tableau de bord"],
	          ["new", "Nouvelle réunion"],
	          ["report", "Réunion ouverte"],
          ["history", "Historique"],
          ["collaborators", "Membres"],
        ].map(([section, label]) => (
          <button
            key={section}
            type="button"
            onClick={() => navigateToSection(section as AppSection)}
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

      {activeSection === "profile" && (
        <section className="w-full max-w-3xl p-2 sm:p-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {renderUserAvatar("h-16 w-16")}
                <div>
                  <h2 className="text-2xl font-bold">
                    {getProfileDisplayName()}
                  </h2>
                  <p className="text-sm text-gray-600">
                    Profil utilisateur
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveSection("dashboard")}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold transition hover:bg-gray-50"
              >
                Retour
              </button>
            </div>

            <form onSubmit={saveUserProfile} className="grid gap-4">
              <div className="grid gap-4 rounded-2xl bg-gray-50 p-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-gray-700">
                  Nom
                  <input
                    type="text"
                    value={profileForm.full_name}
                    onChange={(e) =>
                      setProfileForm((currentForm) => ({
                        ...currentForm,
                        full_name: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-gray-500"
                    placeholder="Votre nom complet"
                  />
                </label>

                <label className="block text-sm font-medium text-gray-700">
                  Fonction
                  <input
                    type="text"
                    value={profileForm.job_title}
                    onChange={(e) =>
                      setProfileForm((currentForm) => ({
                        ...currentForm,
                        job_title: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-gray-500"
                    placeholder="Directeur financier"
                  />
                </label>
              </div>

              <div className="grid gap-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600 sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-gray-900">
                    Entreprise
                  </span>
                  <br />
                  {organization?.name || "Non rattaché"}
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Email</span>
                  <br />
                  {authUser.email}
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Avatar</span>
                  <br />
                  Initiales automatiques : {getUserInitials()}
                </p>
                <p>
                  <span className="font-semibold text-gray-900">
                    Compte créé le
                  </span>
                  <br />
                  {userProfile?.created_at
                    ? new Date(userProfile.created_at).toLocaleString("fr-FR")
                    : "Non renseigné"}
                </p>
              </div>

              {profileError && (
                <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {profileError}
                </p>
              )}
              {profileStatus && (
                <p className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {profileStatus}
                </p>
              )}

              <button
                type="submit"
                disabled={isProfileSaving}
                className="rounded-xl bg-black px-5 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:bg-gray-400"
              >
                {isProfileSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </form>
          </div>
        </section>
      )}

      {activeSection === "organization" && (
        <section className="w-full max-w-3xl p-2 sm:p-6">
          <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {organization.logo_url ? (
                  <span
                    className="h-16 w-16 rounded-2xl bg-cover bg-center ring-1 ring-gray-200"
                    style={{ backgroundImage: `url(${organization.logo_url})` }}
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-950 text-xl font-bold text-white">
                    {organization.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <div>
                  <h2 className="text-2xl font-bold">Entreprise</h2>
                  <p className="text-sm text-gray-600">
                    Structure préparée pour les futures équipes Briefly.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveSection("dashboard")}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold transition hover:bg-gray-50"
              >
                Retour
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Nom</p>
                <p className="mt-1 font-semibold">{organization.name}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Secteur
                </p>
                <p className="mt-1 font-semibold">
                  {organization.industry || "Non renseigné"}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Membres
                </p>
                <p className="mt-1 font-semibold">
                  {organization.employee_count || "Non renseigné"}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Créée le
                </p>
                <p className="mt-1 font-semibold">
                  {new Date(organization.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Administrateur
                </p>
                <p className="mt-1 font-semibold">
                  {getProfileDisplayName()} · {authUser.email}
                </p>
              </div>
            </div>

            {organizationStatus && (
              <p className="mt-5 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
                {organizationStatus}
              </p>
            )}

            {canManageTeam() && (
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setOrganizationError("");
                    setOrganizationStatus("");
                    setShowInviteModal(true);
                  }}
                  className="rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                >
                  Inviter un membre
                </button>
              </div>
            )}
          </div>
        </section>
      )}
	
	      {activeSection === "dashboard" && (
	        <section className="w-full max-w-5xl p-2 sm:p-6">
	          {(() => {
              const periodMeetings = meetings.filter((meeting) =>
                isDateInDashboardPeriod(meeting.created_at, dashboardPeriod)
              );
	            const periodTasks = getDashboardPeriodTasks();
	            const inProgressTasks = periodTasks.filter(
	              (task) => getEffectiveTaskStatus(task) === "En cours"
	            );
	            const doneTasks = periodTasks.filter(
	              (task) => getEffectiveTaskStatus(task) === "Terminée"
	            );
              const openTasks = periodTasks.filter(
                (task) => getEffectiveTaskStatus(task) !== "Terminée"
              );
	            const overdueTasks = periodTasks.filter(
                  (task) => getEffectiveTaskStatus(task) === "En retard"
                );
	            const statCards = [
	              {
		                key: "meetings" as const,
		                label: "Réunions",
		                value: periodMeetings.length,
		                tone: "border-gray-200 bg-white",
		              },
		              {
		                key: "todo" as const,
		                label: "Tâches ouvertes",
		                value: openTasks.length,
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
		                ? openTasks
		                : dashboardSelection === "progress"
		                  ? inProgressTasks
		                  : dashboardSelection === "done"
		                    ? doneTasks
		                    : dashboardSelection === "overdue"
		                      ? overdueTasks
		                      : [];
		            const visibleSelectedTasks = focusedDashboardTaskId
		              ? selectedTasks.filter(
		                  (task) => task.id === focusedDashboardTaskId
		                )
		              : selectedTasks;
		            const isShowingFocusedDashboardTask =
		              Boolean(focusedDashboardTaskId) &&
		              visibleSelectedTasks.length > 0;
		            const selectedTitle = getDashboardTaskTitle(dashboardSelection);
                    const selectedDashboardTask = selectedDashboardTaskId
                      ? dashboardTasks.find(
                          (task) => task.id === selectedDashboardTaskId
                        ) || null
                      : null;
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
                          organizations: organization &&
                            [organization.name, organization.industry]
                              .filter(Boolean)
                              .join(" ")
                              .toLowerCase()
                              .includes(normalizedDashboardSearch)
                            ? [organization]
                            : [],
                          decisions: meetings
                            .filter((meeting) =>
                              meeting.report
                                .toLowerCase()
                                .includes(normalizedDashboardSearch)
                            )
                            .slice(0, 8)
                            .map((meeting) => ({
                              meeting,
                              excerpt:
                                meeting.report
                                  .split("\n")
                                  .find((line) =>
                                    line
                                      .toLowerCase()
                                      .includes(normalizedDashboardSearch)
                                  )
                                  ?.replace(/^#\s*/, "")
                                  .trim() || meeting.title,
                            })),
		                }
		              : null;
		            const dashboardSearchCount = dashboardSearchResults
		              ? dashboardSearchResults.folders.length +
		                dashboardSearchResults.meetings.length +
		                dashboardSearchResults.tasks.length +
		                dashboardSearchResults.employees.length +
                        dashboardSearchResults.organizations.length +
                        dashboardSearchResults.decisions.length
		              : 0;
                    const quickCommand = getQuickCommand(dashboardSearch);
                    const shouldShowAssistant =
                      Boolean(dashboardSearch.trim()) &&
                      (isMemorySearching || memoryAnswer || memoryError);
                    const recentMeetings = meetings.slice(0, 3);
                    const openDashboardTasks = openTasks.slice(0, 3);
                    const suggestedMembers = employees.slice(0, 3);
                    const suggestedFolders = meetingFolders.slice(0, 3);
                    const frequentQuestions = getDashboardSmartSuggestions().slice(
                      0,
                      4
                    );

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
		                      onChange={(e) => {
		                        clearDashboardSearchFocus();
		                        setDashboardPeriod(e.target.value as DashboardPeriod);
		                      }}
	                      className="rounded border bg-white px-3 py-2"
	                    >
	                      <option value="today">Aujourd’hui</option>
	                      <option value="week">Cette semaine</option>
	                      <option value="month">Ce mois</option>
	                      <option value="year">Cette année</option>
	                      <option value="all">Totalité</option>
		                    </select>
		                  </label>
			                </div>

                    <div
                      ref={dashboardSearchContainerRef}
                      className="relative mb-8"
                    >
		                  <input
                        ref={dashboardSearchInputRef}
		                    type="text"
		                    value={dashboardSearch}
		                    onFocus={() => setIsDashboardSearchPanelOpen(true)}
		                    onChange={(e) => {
		                      setDashboardSearch(e.target.value);
		                      setDashboardSelection(null);
		                      clearDashboardSearchFocus();
                          setIsDashboardSearchPanelOpen(true);
                          if (!e.target.value.trim()) {
                            setMemoryAnswer("");
                            setMemorySources([]);
                            setMemoryError("");
                          }
		                    }}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;

                          const command = getQuickCommand(dashboardSearch);

                          if (command) {
                            e.preventDefault();
                            command.action();
                            setIsDashboardSearchPanelOpen(false);
                            return;
                          }

                          if (isAssistantQuestion(dashboardSearch)) {
                            e.preventDefault();
                            searchCompanyMemory();
                            setIsDashboardSearchPanelOpen(false);
                          }
                        }}
		                    placeholder="Rechercher une réunion, une tâche ou poser une question..."
		                    className="w-full rounded-xl border border-gray-200 bg-white px-5 py-4 text-lg shadow-sm outline-none transition focus:border-gray-400"
		                  />

                      {isDashboardSearchPanelOpen &&
                        (!dashboardSearch.trim() || quickCommand) && (
                        <div
                          className="absolute left-0 right-0 top-full z-40 mt-2 max-h-[70vh] overflow-auto rounded-3xl border border-gray-200 bg-white p-4 text-left shadow-2xl"
                          onMouseDown={(event) => event.preventDefault()}
                        >
                          {dashboardSearch.trim() && quickCommand ? (
                            <button
                              type="button"
                              onClick={() => {
                                quickCommand.action();
                                setIsDashboardSearchPanelOpen(false);
                              }}
                              className="mb-3 flex w-full items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-left transition hover:bg-gray-100"
                            >
                              <span>
                                <span className="block text-sm font-semibold text-gray-950">
                                  {quickCommand.label}
                                </span>
                                <span className="block text-xs text-gray-500">
                                  {quickCommand.description}
                                </span>
                              </span>
                              <span className="text-sm text-gray-400">↵</span>
                            </button>
                          ) : null}

                          {!dashboardSearch.trim() && (
                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  📄 Réunions récentes
                                </h4>
                                <div className="space-y-1">
                                  {recentMeetings.length === 0 ? (
                                    <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                      Aucune réunion récente.
                                    </p>
                                  ) : (
                                    recentMeetings.map((meeting) => (
                                      <button
                                        key={meeting.id}
                                        type="button"
                                        onClick={() => {
                                          setIsDashboardSearchPanelOpen(false);
                                          openDashboardMeetingInHistory(meeting);
                                        }}
                                        className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-gray-50"
                                      >
                                        {meeting.title}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  👥 Membres
                                </h4>
                                <div className="space-y-1">
                                  {suggestedMembers.length === 0 ? (
                                    <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                      Aucun membre.
                                    </p>
                                  ) : (
                                    suggestedMembers.map((employee) => (
                                      <button
                                        key={employee.id}
                                        type="button"
                                        onClick={() => {
                                          setIsDashboardSearchPanelOpen(false);
                                          openEmployeeProfile(employee);
                                        }}
                                        className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-gray-50"
                                      >
                                        {employee.name}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  ✅ Tâches ouvertes
                                </h4>
                                <div className="space-y-1">
                                  {openDashboardTasks.length === 0 ? (
                                    <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                      Aucune tâche ouverte.
                                    </p>
                                  ) : (
                                    openDashboardTasks.map((task) => (
                                      <button
                                        key={task.id}
                                        type="button"
                                        onClick={() => {
                                          setIsDashboardSearchPanelOpen(false);
                                          focusDashboardTask(task);
                                        }}
                                        className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-gray-50"
                                      >
                                        {task.action}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div>
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  📁 Dossiers
                                </h4>
                                <div className="space-y-1">
                                  {suggestedFolders.length === 0 ? (
                                    <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                                      Aucun dossier.
                                    </p>
                                  ) : (
                                    suggestedFolders.map((folder) => (
                                      <button
                                        key={folder.id}
                                        type="button"
                                        onClick={() => {
                                          setDashboardSearch(folder.name);
                                          setIsDashboardSearchPanelOpen(false);
                                        }}
                                        className="block w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-gray-50"
                                      >
                                        {folder.name}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>

                              <div className="md:col-span-2">
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  💡 Questions fréquentes
                                </h4>
                                <div className="grid gap-1 sm:grid-cols-2">
                                  {frequentQuestions.map((suggestion) => (
                                    <button
                                      key={suggestion}
                                      type="button"
                                      onClick={() => {
                                        setDashboardSearch(suggestion);
                                        setIsDashboardSearchPanelOpen(false);
                                        searchCompanyMemory(suggestion);
                                      }}
                                      className="rounded-xl px-3 py-2 text-left text-sm transition hover:bg-gray-50"
                                    >
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="md:col-span-2">
                                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                  Commandes rapides
                                </h4>
                                <div className="grid gap-1 sm:grid-cols-2">
                                  {[
                                    "Créer une réunion",
                                    "Créer une tâche",
                                    "Inviter un membre",
                                    "Afficher les tâches en retard",
                                    "Afficher les réunions de cette semaine",
                                  ].map((commandLabel) => {
                                    const command = getQuickCommand(commandLabel);

                                    return (
                                      <button
                                        key={commandLabel}
                                        type="button"
                                        onClick={() => {
                                          command?.action();
                                          setIsDashboardSearchPanelOpen(false);
                                        }}
                                        className="rounded-xl px-3 py-2 text-left text-sm font-medium transition hover:bg-gray-50"
                                      >
                                        {commandLabel}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {memoryRecentSearches.length > 0 && (
                                <div className="md:col-span-2">
                                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Recherches récentes
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {memoryRecentSearches.map((recentQuery) => (
                                      <span
                                        key={recentQuery}
                                        className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600 ring-1 ring-gray-100"
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDashboardSearch(recentQuery);
                                            setIsDashboardSearchPanelOpen(false);
                                            searchCompanyMemory(recentQuery);
                                          }}
                                          className="font-medium hover:text-gray-950"
                                        >
                                          {recentQuery}
                                        </button>
                                        <button
                                          type="button"
                                          aria-label={`Supprimer ${recentQuery}`}
                                          onClick={() =>
                                            setMemoryRecentSearches(
                                              (currentSearches) =>
                                                currentSearches.filter(
                                                  (currentQuery) =>
                                                    currentQuery !== recentQuery
                                                )
                                            )
                                          }
                                          className="text-gray-400 hover:text-gray-900"
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

		                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
		                  {statCards.map((card) => (
		                    <button
		                      key={card.label}
		                      type="button"
		                      onClick={() => {
		                        clearDashboardSearchFocus();
                            setSelectedDashboardTaskId(null);
		                        setDashboardSelection(card.key);
		                      }}
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

                    {shouldShowAssistant && (
                      <div className="mt-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Assistant Briefly
                            </p>
                            <h3 className="mt-1 text-lg font-bold">
                              Réponse à votre question
                            </h3>
                          </div>
                          {isMemorySearching && (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                              Analyse...
                            </span>
                          )}
                        </div>

                        {isMemorySearching ? (
                          <div className="space-y-2">
                            <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                            <div className="h-3 w-4/5 animate-pulse rounded bg-gray-100" />
                            <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                          </div>
                        ) : memoryError ? (
                          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {memoryError}
                          </p>
                        ) : (
                          <div className="whitespace-pre-wrap text-[15px] leading-7 text-gray-800">
                            {memoryAnswer}
                          </div>
                        )}

                        {!isMemorySearching && memorySources.length > 0 && (
                          <div className="mt-5 border-t border-gray-100 pt-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h4 className="text-sm font-semibold text-gray-900">
                                Sources
                              </h4>
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                                {memorySources.length}
                              </span>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {memorySources.map((source) => (
                                <div
                                  key={`${source.meeting_id}-${source.title}`}
                                  className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                                >
                                  <p className="font-semibold text-gray-950">
                                    📄 {source.title}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-500">
                                    {source.date
                                      ? new Date(source.date).toLocaleString(
                                          "fr-FR"
                                        )
                                      : "Date non renseignée"}
                                  </p>
                                  {source.excerpt && (
                                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-700">
                                      {source.excerpt}
                                    </p>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openMemorySource(source)}
                                    className="mt-3 rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                                  >
                                    Ouvrir la réunion
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

		                {dashboardSearchResults && (
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
		                      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-600">
		                        <p className="text-2xl">🔍</p>
		                        <p className="mt-2">Aucun résultat trouvé</p>
		                      </div>
		                    ) : (
		                      <div className="grid gap-4 lg:grid-cols-2">
                            {dashboardSearchResults.organizations.length > 0 && (
                              <div className="rounded-xl bg-gray-50 p-4">
                                <h4 className="mb-3 font-semibold">Entreprise</h4>
                                <div className="space-y-2">
                                  {dashboardSearchResults.organizations.map(
                                    (currentOrganization) => (
                                      <button
                                        key={currentOrganization.id}
                                        type="button"
                                        onClick={() =>
                                          navigateToSection("organization")
                                        }
                                        className="w-full cursor-pointer rounded-lg bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                      >
                                        <p className="font-medium">
                                          {renderHighlightedText(
                                            currentOrganization.name,
                                            dashboardSearch
                                          )}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                          {renderHighlightedText(
                                            currentOrganization.industry ||
                                              "Secteur non renseigné",
                                            dashboardSearch
                                          )}
                                        </p>
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

		                        {dashboardSearchResults.folders.length > 0 && (
		                          <div className="rounded-xl bg-gray-50 p-4">
		                            <h4 className="mb-3 font-semibold">Dossiers</h4>
		                            <div className="space-y-2">
		                              {dashboardSearchResults.folders.map((folder) => (
		                                <div
		                                  key={folder.id}
		                                  className="rounded-lg bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
		                                >
		                                  📁 {renderHighlightedText(folder.name, dashboardSearch)}
		                                </div>
		                              ))}
		                            </div>
		                          </div>
		                        )}

                            {dashboardSearchResults.decisions.length > 0 && (
                              <div className="rounded-xl bg-gray-50 p-4">
                                <h4 className="mb-3 font-semibold">
                                  Décisions et contenus
                                </h4>
                                <div className="space-y-2">
                                  {dashboardSearchResults.decisions.map(
                                    ({ meeting, excerpt }) => (
                                      <button
                                        key={`decision-${meeting.id}-${excerpt}`}
                                        type="button"
                                        onClick={() =>
                                          openDashboardMeetingInHistory(meeting)
                                        }
                                        className="w-full cursor-pointer rounded-lg bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                                      >
                                        <p className="font-medium">
                                          {renderHighlightedText(
                                            excerpt,
                                            dashboardSearch
                                          )}
                                        </p>
                                        <p className="mt-1 text-sm text-gray-500">
                                          {meeting.title} ·{" "}
                                          {new Date(
                                            meeting.created_at
                                          ).toLocaleDateString("fr-FR")}
                                        </p>
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            )}

		                        {dashboardSearchResults.meetings.length > 0 && (
		                          <div className="rounded-xl bg-gray-50 p-4">
		                            <h4 className="mb-3 font-semibold">Réunions</h4>
		                            <div className="space-y-2">
		                              {dashboardSearchResults.meetings.map((meeting) => (
		                                <button
		                                  key={meeting.id}
		                                  type="button"
		                                  onClick={() =>
		                                    openDashboardMeetingInHistory(meeting)
		                                  }
		                                  className="w-full cursor-pointer rounded-lg bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
		                                >
		                                  <p className="font-medium">
		                                    {renderHighlightedText(
		                                      meeting.title,
		                                      dashboardSearch
		                                    )}
		                                  </p>
		                                  <p className="text-sm text-gray-500">
		                                    {new Date(meeting.created_at).toLocaleString("fr-FR")}
		                                  </p>
		                                </button>
		                              ))}
		                            </div>
		                          </div>
		                        )}

		                        {dashboardSearchResults.tasks.length > 0 && (
		                          <div className="rounded-xl bg-gray-50 p-4">
		                            <h4 className="mb-3 font-semibold">Tâches</h4>
		                            <div className="space-y-2">
		                              {dashboardSearchResults.tasks.map((task) => (
		                                <button
		                                  key={task.id}
		                                  type="button"
		                                  onClick={() => focusDashboardTask(task)}
		                                  className="w-full cursor-pointer rounded-lg bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
		                                >
		                                  <p className="font-medium">
		                                    {renderHighlightedText(
		                                      task.action,
		                                      dashboardSearch
		                                    )}
		                                  </p>
		                                  <p className="text-sm text-gray-600">
		                                    Responsable :{" "}
		                                    {renderHighlightedText(
		                                      task.responsible || "Non attribué",
		                                      dashboardSearch
		                                    )}
		                                  </p>
		                                </button>
		                              ))}
		                            </div>
		                          </div>
		                        )}

		                        {dashboardSearchResults.employees.length > 0 && (
		                          <div className="rounded-xl bg-gray-50 p-4">
		                            <h4 className="mb-3 font-semibold">Membres</h4>
		                            <div className="space-y-2">
		                              {dashboardSearchResults.employees.map((employee) => (
		                                <button
		                                  key={employee.id}
                                          type="button"
                                          onClick={() => openEmployeeProfile(employee)}
		                                  className="w-full cursor-pointer rounded-lg bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
		                                >
		                                  <p className="font-medium">
		                                    {renderHighlightedText(
		                                      employee.name,
		                                      dashboardSearch
		                                    )}
		                                  </p>
		                                  <p className="text-sm text-gray-500">
		                                    {renderHighlightedText(
		                                      employee.role,
		                                      dashboardSearch
		                                    )}
		                                  </p>
		                                </button>
		                              ))}
		                            </div>
		                          </div>
		                        )}
		                      </div>
		                    )}
		                  </div>
		                )}

		                  <div
		                    id="dashboard-selection-panel"
		                    className="mt-8 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-6"
		                  >
		                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Liste
                            </p>
		                        <h3 className="mt-1 text-xl font-bold">
                              {selectedTitle}
                            </h3>
                          </div>
		                      {dashboardSelection === "overdue" && (
		                        <button
		                          type="button"
		                          onClick={openReminderModal}
		                          className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold transition hover:bg-gray-50"
		                        >
		                          Relancer
		                        </button>
		                      )}
		                    </div>

		                    {isShowingFocusedDashboardTask && (
		                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
		                        <span>
		                          Affichage d’une tâche issue de la recherche.
		                        </span>
		                        <button
		                          type="button"
		                          onClick={clearDashboardSearchFocus}
		                          className="font-semibold text-gray-950 underline-offset-4 hover:underline"
		                        >
		                          ← Retour à toutes les tâches
		                        </button>
		                      </div>
		                    )}

		                    {dashboardSelection === "meetings" ? (
		                      periodMeetings.length === 0 ? (
		                        <p className="text-sm text-gray-600">
		                          Aucune réunion sur cette période.
		                        </p>
		                      ) : (
		                        <div className="space-y-2">
		                          {periodMeetings.map((meeting) => (
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
		                    ) : visibleSelectedTasks.length === 0 ? (
		                      <p className="rounded-2xl bg-gray-50 px-4 py-5 text-sm text-gray-600">
		                        Aucune tâche à afficher.
		                      </p>
		                    ) : (
		                      <div className="grid gap-3">
		                        {visibleSelectedTasks.map((task) => {
                              const responsibleEmployee =
                                getTaskResponsibleEmployee(task);
                              const responsibleName =
                                responsibleEmployee?.name ||
                                task.responsible ||
                                "Non attribué";
                              const taskMeeting = getTaskMeeting(task);
                              const taskStatus = getEffectiveTaskStatus(task);

                              return (
		                          <div
		                            key={task.id}
		                            id={`dashboard-task-${task.id}`}
		                            className={`rounded-2xl border p-4 transition duration-300 hover:-translate-y-0.5 hover:shadow-md ${
		                              highlightedDashboardTaskId === task.id
		                                ? "border-yellow-300 bg-yellow-50 shadow-md"
		                                : "border-gray-100 bg-gray-50"
		                            }`}
		                          >
                                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-semibold text-gray-950">
                                          {task.action}
                                        </h4>
                                        <span
                                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getTaskStatusBadgeClass(
                                            taskStatus
                                          )}`}
                                        >
                                          {taskStatus}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-sm text-gray-500">
                                        Réunion : {taskMeeting?.title || "Non renseignée"}
                                      </p>
                                    </div>

                                    <div className="grid gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:min-w-[420px]">
                                      <div className="flex items-center gap-2">
                                        {renderInitialsAvatar({
                                          displayName: responsibleName,
                                          email: responsibleEmployee?.email,
                                          seed:
                                            responsibleEmployee?.email ||
                                            responsibleName,
                                          sizeClass: "h-8 w-8",
                                        })}
                                        <span className="truncate">
                                          {responsibleName}
                                        </span>
                                      </div>
                                      <span
                                        className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getTaskPriorityClass(
                                          task.priority
                                        )}`}
                                      >
                                        {normalizeTaskPriority(task.priority)}
                                      </span>
                                      <span>
                                        Échéance : {task.due_date || "Non renseignée"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelectedDashboardTaskId(task.id)
                                        }
                                        className="w-fit rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800"
                                      >
                                        Voir
                                      </button>
                                    </div>
                                  </div>
		                          </div>
                              );
                            })}
		                      </div>
		                    )}
		                  </div>

                    <div className="mt-8 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-bold">
                            Journal d’activité
                          </h3>
                          <p className="text-sm text-gray-500">
                            Les dernières actions de l’espace de travail.
                          </p>
                        </div>
                      </div>

                      {workspaceError && (
                        <p className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-100">
                          {workspaceError}
                        </p>
                      )}

                      {activityLogs.length === 0 ? (
                        <div className="rounded-xl bg-gray-50 px-4 py-5 text-sm text-gray-600">
                          L’activité de l’entreprise apparaîtra ici dès qu’une
                          réunion, une tâche ou une invitation sera créée.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {activityLogs.map((activity) => (
                            <div
                              key={activity.id}
                              className="rounded-xl bg-gray-50 px-4 py-3"
                            >
                              <p className="text-sm font-medium text-gray-900">
                                {activity.description}
                              </p>
                              <p className="mt-1 text-xs text-gray-500">
                                {new Date(activity.created_at).toLocaleString(
                                  "fr-FR"
                                )}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {selectedDashboardTask && (
                      <div className="fixed inset-0 z-50 flex justify-end bg-black/20 p-3 sm:p-6">
                        <button
                          type="button"
                          aria-label="Fermer le détail de la tâche"
                          onClick={() => setSelectedDashboardTaskId(null)}
                          className="absolute inset-0 cursor-default"
                        />
                        <aside className="relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                          {(() => {
                            const task = selectedDashboardTask;
                            const responsibleEmployee =
                              getTaskResponsibleEmployee(task);
                            const responsibleName =
                              responsibleEmployee?.name ||
                              task.responsible ||
                              "Non attribué";
                            const taskMeeting = getTaskMeeting(task);
                            const taskActivities = activityLogs.filter(
                              (activity) =>
                                activity.entity_type === "task" &&
                                activity.entity_id === task.id
                            );

                            return (
                              <>
                                <div className="border-b border-gray-100 p-6">
                                  <div className="flex items-start justify-between gap-4">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Détail de la tâche
                                      </p>
                                      <h3 className="mt-2 text-2xl font-bold text-gray-950">
                                        {task.action}
                                      </h3>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSelectedDashboardTaskId(null)
                                      }
                                      className="rounded-full border border-gray-200 px-3 py-1 text-sm transition hover:bg-gray-50"
                                    >
                                      Fermer
                                    </button>
                                  </div>
                                </div>

                                <div className="flex-1 space-y-6 overflow-auto p-6">
                                  <div className="rounded-2xl bg-gray-50 p-4">
                                    <p className="text-sm font-semibold text-gray-950">
                                      Description
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-gray-600">
                                      {task.action}
                                    </p>
                                  </div>

                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <label className="text-sm font-medium text-gray-700">
                                      Responsable
                                      <select
                                        value={getTaskResponsibleEmployeeId(task)}
                                        onChange={(event) => {
                                          const employeeId = Number(
                                            event.target.value
                                          );
                                          if (employeeId) {
                                            updateTaskResponsible(task, employeeId);
                                          }
                                        }}
                                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                                      >
                                        <option value="">
                                          Non attribué
                                        </option>
                                        {employees.map((employee) => (
                                          <option
                                            key={employee.id}
                                            value={employee.id}
                                          >
                                            {employee.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>

                                    <label className="text-sm font-medium text-gray-700">
                                      Statut
                                      <select
                                        value={normalizeTaskStatus(task.status)}
                                        onChange={(event) =>
                                          updateTaskStatus(
                                            task,
                                            event.target.value as TaskStatus
                                          )
                                        }
                                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                                      >
                                        <option value="À faire">À faire</option>
                                        <option value="En cours">En cours</option>
                                        <option value="Terminée">Terminée</option>
                                        <option value="En retard">En retard</option>
                                      </select>
                                    </label>

                                    <label className="text-sm font-medium text-gray-700">
                                      Priorité
                                      <select
                                        value={normalizeTaskPriority(task.priority)}
                                        onChange={(event) =>
                                          updateTaskPriority(
                                            task,
                                            event.target.value as Task["priority"]
                                          )
                                        }
                                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                                      >
                                        <option value="Basse">Basse</option>
                                        <option value="Normale">Normale</option>
                                        <option value="Haute">Haute</option>
                                        <option value="Urgente">Urgente</option>
                                      </select>
                                    </label>

                                    <label className="text-sm font-medium text-gray-700">
                                      Date limite
                                      <input
                                        type="date"
                                        value={task.due_date || ""}
                                        onChange={(event) =>
                                          updateTaskDueDate(
                                            task.id,
                                            event.target.value
                                          )
                                        }
                                        className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                                      />
                                    </label>
                                  </div>

                                  <div className="rounded-2xl bg-gray-50 p-4">
                                    <p className="text-sm font-semibold text-gray-950">
                                      Responsable actuel
                                    </p>
                                    <div className="mt-3 flex items-center gap-3">
                                      {renderInitialsAvatar({
                                        displayName: responsibleName,
                                        email: responsibleEmployee?.email,
                                        seed:
                                          responsibleEmployee?.email ||
                                          responsibleName,
                                      })}
                                      <div>
                                        <p className="text-sm font-medium text-gray-950">
                                          {responsibleName}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                          {responsibleEmployee?.role ||
                                            "Aucun poste renseigné"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-2xl bg-gray-50 p-4">
                                    <p className="text-sm font-semibold text-gray-950">
                                      Réunion d’origine
                                    </p>
                                    <p className="mt-2 text-sm text-gray-600">
                                      {taskMeeting?.title || "Non renseignée"}
                                    </p>
                                    {taskMeeting && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openDashboardMeetingInHistory(
                                            taskMeeting
                                          )
                                        }
                                        className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-gray-50"
                                      >
                                        Ouvrir la réunion
                                      </button>
                                    )}
                                  </div>

                                  <div className="rounded-2xl bg-gray-50 p-4">
                                    <p className="text-sm font-semibold text-gray-950">
                                      Historique
                                    </p>
                                    {taskActivities.length === 0 ? (
                                      <p className="mt-2 text-sm text-gray-500">
                                        Aucun changement enregistré pour cette tâche.
                                      </p>
                                    ) : (
                                      <div className="mt-3 space-y-2">
                                        {taskActivities.map((activity) => (
                                          <div
                                            key={activity.id}
                                            className="rounded-xl bg-white px-3 py-2"
                                          >
                                            <p className="text-sm text-gray-800">
                                              {activity.description}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                              {new Date(
                                                activity.created_at
                                              ).toLocaleString("fr-FR")}
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div className="rounded-2xl bg-gray-50 p-4">
                                    <p className="text-sm font-semibold text-gray-950">
                                      Commentaires
                                    </p>
                                    <p className="mt-2 text-sm text-gray-500">
                                      Les commentaires seront disponibles dans une prochaine évolution.
                                    </p>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </aside>
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
                            Aucun membre invité
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
                      ➕ Inviter des membres
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
                    <div className="relative rounded-2xl border border-green-100 bg-green-50 p-6">
                      {message.includes("Enregistrement terminé") && (
                        <button
                          type="button"
                          onClick={() => setShowDeleteRecordingConfirm(true)}
                          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-green-800 transition hover:bg-white/70"
                          aria-label="Supprimer l’enregistrement temporaire"
                        >
                          ×
                        </button>
                      )}
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
        <section className="w-full max-w-5xl p-2 sm:p-6">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-500">
                  {organization?.name || "Espace Briefly"}
                </p>
                <h2 className="mt-1 text-3xl font-bold text-gray-950">
                  Membres
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-gray-600">
                  Gérez les membres de l’entreprise, les invitations et les
                  rôles qui prépareront les prochaines permissions de Briefly.
                </p>
              </div>

              {canManageTeam() && (
                <button
                  type="button"
                  onClick={() => {
                    setOrganizationError("");
                    setOrganizationStatus("");
                    setInviteForm({
                      first_name: "",
                      last_name: "",
                      email: "",
                      job_title: "",
                      role: "COLLABORATEUR",
                    });
                    setShowInviteModal(true);
                  }}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
                >
                  Inviter un membre
                </button>
              )}
            </div>

            {(organizationStatus || organizationError) && (
              <div
                className={`mt-5 rounded-xl px-4 py-3 text-sm ${
                  organizationError
                    ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                    : "bg-green-50 text-green-700 ring-1 ring-green-100"
                }`}
              >
                {organizationError || organizationStatus}
              </div>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                ref={employeeSearchInputRef}
                type="text"
                placeholder="Rechercher par prénom, nom, email ou fonction..."
                value={collaboratorSearch}
                onChange={(e) => setCollaboratorSearch(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gray-500"
              />

              <div className="flex flex-wrap gap-2">
                {[
                  ["all", "Tous"],
                  ["admins", "Administrateurs"],
                  ["managers", "Managers"],
                  ["collaborators", "Membres"],
                  ["pending", "Invitations en attente"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setCollaboratorFilter(
                        value as
                          | "all"
                          | "admins"
                          | "managers"
                          | "collaborators"
                          | "pending"
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      collaboratorFilter === value
                        ? "bg-black text-white"
                        : "bg-gray-50 text-gray-700 ring-1 ring-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {filteredCollaborators.length === 0 && (
                <div className="rounded-2xl bg-gray-50 px-5 py-8 text-center text-sm text-gray-500 ring-1 ring-gray-100">
                  Aucun membre trouvé.
                </div>
              )}

              {filteredCollaborators.map((collaborator) => {
                const isSuspended = collaborator.status === "Suspendu";
                const isPending = collaborator.type === "invitation";

                return (
                  <div
                    key={collaborator.key}
                    className="flex flex-col gap-4 rounded-2xl bg-gray-50 p-4 ring-1 ring-gray-100 transition hover:bg-white hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {renderInitialsAvatar({
                        displayName: collaborator.displayName,
                        email: collaborator.email,
                        seed: collaborator.id,
                        sizeClass: "h-11 w-11 shrink-0",
                      })}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-semibold text-gray-950">
                            {collaborator.displayName}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              isSuspended
                                ? "bg-red-50 text-red-700 ring-1 ring-red-100"
                                : isPending
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                                  : "bg-green-50 text-green-700 ring-1 ring-green-100"
                            }`}
                          >
                            {collaborator.status}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-gray-600">
                          {collaborator.jobTitle || "Fonction non renseignée"}
                        </p>
                        <p className="mt-1 truncate text-sm text-gray-500">
                          {collaborator.email || "Email non renseigné"}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Arrivée :{" "}
                          {collaborator.joinedAt
                            ? new Date(collaborator.joinedAt).toLocaleDateString(
                                "fr-FR"
                              )
                            : "Non renseignée"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                        {collaborator.role}
                      </span>

                      {isCurrentUserAdmin() && (
                        <div className="relative">
                          <button
                            type="button"
                            data-menu-trigger
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              const shouldOpenMenu =
                                openCollaboratorMenuId !== collaborator.key;
                              closeAllMenus();

                              if (shouldOpenMenu) {
                                setOpenCollaboratorMenuId(collaborator.key);
                              }
                            }}
                            className="rounded-full px-3 py-1 text-xl leading-none text-gray-500 transition hover:bg-gray-100 hover:text-black"
                            aria-label="Menu membre"
                          >
                            ⋯
                          </button>

                          {openCollaboratorMenuId === collaborator.key && (
                            <div
                              data-menu-content
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-sm shadow-lg"
                            >
                              {collaborator.type === "member" ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setProfileStatus("");
                                      setOrganizationStatus(
                                        "La modification détaillée des profils sera disponible dans les paramètres membres."
                                      );
                                      closeAllMenus();
                                    }}
                                    className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                                  >
                                    Modifier
                                  </button>
                                  <div className="border-t border-gray-100 py-1">
                                    {(["ADMIN", "MANAGER", "COLLABORATEUR"] as const).map(
                                      (role) => (
                                        <button
                                          key={role}
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            closeAllMenus();
                                            updateMemberRole(collaborator.raw, role);
                                          }}
                                          className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                                        >
                                          Changer le rôle : {role}
                                        </button>
                                      )
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      closeAllMenus();
                                      updateMemberStatus(
                                        collaborator.raw,
                                        collaborator.raw.status === "suspended"
                                          ? "active"
                                          : "suspended"
                                      );
                                    }}
                                    className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                                  >
                                    {collaborator.raw.status === "suspended"
                                      ? "Réactiver"
                                      : "Suspendre"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      closeAllMenus();
                                      removeMember(collaborator.raw);
                                    }}
                                    className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
                                  >
                                    Supprimer
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      closeAllMenus();
                                      resendInvitation(collaborator.raw);
                                    }}
                                    className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                                  >
                                    Renvoyer l’invitation
                                  </button>
                                  <div className="border-t border-gray-100 py-1">
                                    {(["ADMIN", "MANAGER", "COLLABORATEUR"] as const).map(
                                      (role) => (
                                        <button
                                          key={role}
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            closeAllMenus();
                                            updateInvitationRole(
                                              collaborator.raw,
                                              role
                                            );
                                          }}
                                          className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                                        >
                                          Changer le rôle : {role}
                                        </button>
                                      )
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      closeAllMenus();
                                      revokeInvitation(collaborator.raw);
                                    }}
                                    className="block w-full px-4 py-2 text-left text-red-600 hover:bg-red-50"
                                  >
                                    Supprimer
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {activeSection === "report" && (
        <section className="w-full max-w-3xl rounded-lg border p-6">
          <h2 className="mb-4 text-2xl font-bold">Réunion ouverte</h2>

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

  <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 className="text-lg font-bold">
          Tâches détectées automatiquement
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Validez uniquement les actions réellement à créer.
        </p>
      </div>

      {pendingDetectedTasks.length > 0 && (
        <button
          type="button"
          onClick={() => createDetectedTasks(pendingDetectedTasks)}
          disabled={creatingDetectedTaskIds.length > 0}
          className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          Créer toutes les tâches
        </button>
      )}
    </div>

    {pendingDetectedTasks.length === 0 ? (
      <p className="rounded-xl bg-gray-50 px-4 py-4 text-sm text-gray-600">
        Aucune tâche détectée pendant cette réunion.
      </p>
    ) : (
      <div className="grid gap-3">
        {pendingDetectedTasks.map((detectedTask) => {
          const isCreating = creatingDetectedTaskIds.includes(
            detectedTask.tempId
          );

          return (
            <div
              key={detectedTask.tempId}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
            >
              <div className="grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-gray-950">
                    👤 Responsable
                  </span>
                  <br />
                  {getDetectedTaskResponsibleLabel(detectedTask)}
                </p>
                <p>
                  <span className="font-semibold text-gray-950">
                    📅 Échéance
                  </span>
                  <br />
                  {detectedTask.due_date || "Non renseignée"}
                </p>
                <p className="sm:col-span-2">
                  <span className="font-semibold text-gray-950">
                    📝 Description
                  </span>
                  <br />
                  {detectedTask.action}
                </p>
                <p>
                  <span className="font-semibold text-gray-950">
                    🔥 Priorité
                  </span>
                  <br />
                  {normalizeTaskPriority(detectedTask.priority)}
                </p>
                <p>
                  <span className="font-semibold text-gray-950">Statut</span>
                  <br />
                  À faire
                </p>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => createDetectedTasks([detectedTask])}
                  disabled={isCreating}
                  className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  ✅ {isCreating ? "Création..." : "Créer"}
                </button>
                <button
                  type="button"
                  onClick={() => ignoreDetectedTask(detectedTask.tempId)}
                  disabled={isCreating}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  ❌ Ignorer
                </button>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>

  <div className="mt-6 border rounded-lg bg-gray-50">
    <button
      type="button"
      onClick={() => setIsCurrentTasksOpen((currentIsOpen) => !currentIsOpen)}
      className="flex w-full items-center justify-between px-4 py-3 text-left font-bold"
    >
      <span id="actions-detectees">Tâches ({tasks.length})</span>
      <span className="flex items-center gap-2">
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

		          {task.completed_at && normalizeTaskStatus(task.status) === "Terminée" && (
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
          (task) => normalizeTaskStatus(task.status) !== "Terminée"
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
          <h2 className="text-2xl font-bold">Inviter des membres</h2>
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
            Aucun membre disponible.
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
	          Quels membres étaient présents ?
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
        placeholder="🔍 Rechercher un membre..."
        value={participantSearch}
        onChange={(e) => setParticipantSearch(e.target.value)}
        className="mb-4 w-full rounded border p-2"
      />

      <div className="max-h-[45vh] space-y-2 overflow-auto">
        {filteredParticipantEmployees.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun membre trouvé.</p>
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
                  <span>Autres membres ({otherEmployees.length})</span>
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
                      Aucun autre membre.
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
        {editingEmployee ? "Modifier le membre" : "Ajouter un membre"}
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
      {showDeleteRecordingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-950">
              Supprimer cet enregistrement ?
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Êtes-vous sûr de vouloir supprimer cet enregistrement ?
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteRecordingConfirm(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold transition hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={clearTemporaryRecording}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={sendInvitation}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="mb-5">
              <h2 className="text-xl font-bold">Inviter un membre</h2>
              <p className="mt-1 text-sm text-gray-600">
                Le membre recevra un email pour rejoindre{" "}
                {organization?.name || "votre entreprise"}.
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Prénom"
                value={inviteForm.first_name}
                onChange={(e) =>
                  setInviteForm((currentForm) => ({
                    ...currentForm,
                    first_name: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-gray-500"
              />
              <input
                type="text"
                placeholder="Nom"
                value={inviteForm.last_name}
                onChange={(e) =>
                  setInviteForm((currentForm) => ({
                    ...currentForm,
                    last_name: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-gray-500"
              />
              <input
                type="email"
                placeholder="Email"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm((currentForm) => ({
                    ...currentForm,
                    email: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-gray-500"
              />
              <input
                type="text"
                placeholder="Fonction"
                value={inviteForm.job_title}
                onChange={(e) =>
                  setInviteForm((currentForm) => ({
                    ...currentForm,
                    job_title: e.target.value,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-gray-500"
              />
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm((currentForm) => ({
                    ...currentForm,
                    role: e.target.value as OrganizationRole,
                  }))
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-gray-500"
              >
                <option value="COLLABORATEUR">Membre</option>
                <option value="MANAGER">Manager</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-xl bg-black px-4 py-2 text-sm font-semibold text-white"
              >
                Envoyer l’invitation
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
