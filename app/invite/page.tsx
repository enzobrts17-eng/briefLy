"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type OrganizationRole = "ADMIN" | "MANAGER" | "COLLABORATEUR";

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

type AuthMode = "login" | "signup";

function getAuthErrorMessage(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Veuillez confirmer votre adresse email avant de vous connecter.";
  }

  if (normalizedMessage.includes("user already registered")) {
    return "Adresse email déjà utilisée. Connectez-vous pour accepter l’invitation.";
  }

  if (normalizedMessage.includes("password")) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }

  return message || "Une erreur est survenue.";
}

export default function InvitePage() {
  const [token] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("token") || ""
      : ""
  );
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
    });

    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const acceptInvitation = useCallback(
    async (user: User, currentInvitation: Invitation) => {
      if (isAccepting) return;

      setIsAccepting(true);
      setError("");
      setStatus("Rattachement à l’entreprise en cours...");

      const profilePayload = {
        id: user.id,
        organization_id: currentInvitation.organization_id,
        role: currentInvitation.role,
        first_name: currentInvitation.first_name || firstName.trim() || null,
        last_name: currentInvitation.last_name || lastName.trim() || null,
        full_name:
          `${currentInvitation.first_name || firstName} ${
            currentInvitation.last_name || lastName
          }`.trim() ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "",
        email: user.email || currentInvitation.email,
        job_title: currentInvitation.job_title,
        status: "active",
      };

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(profilePayload);

      if (profileError) {
        console.error("Erreur création profil invitation:", profileError);
        setError("Impossible de rattacher votre profil à l’entreprise.");
        setIsAccepting(false);
        return;
      }

      const { error: invitationError } = await supabase
        .from("invitations")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", currentInvitation.id)
        .eq("email", currentInvitation.email);

      if (invitationError) {
        console.error("Erreur acceptation invitation:", invitationError);
        setError(
          "Votre profil est créé, mais l’invitation n’a pas pu être finalisée."
        );
        setIsAccepting(false);
        return;
      }

      setInvitation({ ...currentInvitation, status: "accepted" });
      setStatus("Invitation acceptée. Bienvenue dans Briefly.");
      setIsAccepting(false);
    },
    [firstName, isAccepting, lastName]
  );

  useEffect(() => {
    async function loadInvitation() {
      if (!token) {
        setError("Lien d’invitation invalide.");
        return;
      }

      setIsLoading(true);
      setError("");

      const { data, error: invitationError } = await supabase
        .rpc("get_invitation_by_token", { invitation_token: token })
        .single();

      setIsLoading(false);

      if (invitationError || !data) {
        console.error("Erreur chargement invitation:", invitationError);
        setError("Invitation introuvable ou expirée.");
        return;
      }

      const loadedInvitation = data as Invitation;
      setInvitation(loadedInvitation);
      setEmail(loadedInvitation.email || "");
      setFirstName(loadedInvitation.first_name || "");
      setLastName(loadedInvitation.last_name || "");

      if (loadedInvitation.status === "accepted") {
        setStatus("Cette invitation a déjà été acceptée.");
      }

      if (
        loadedInvitation.status === "pending" &&
        new Date(loadedInvitation.expires_at).getTime() < Date.now()
      ) {
        setError("Cette invitation a expiré.");
      }
    }

    loadInvitation();
  }, [token]);

  useEffect(() => {
    if (!authUser || !invitation || invitation.status !== "pending") return;
    if (new Date(invitation.expires_at).getTime() < Date.now()) return;

    const timeoutId = window.setTimeout(() => {
      acceptInvitation(authUser, invitation);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [acceptInvitation, authUser, invitation]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation) return;

    setError("");
    setStatus("");
    setIsSubmitting(true);

    if (authMode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: window.location.href,
          data: {
            full_name: `${firstName} ${lastName}`.trim(),
          },
        },
      });

      setIsSubmitting(false);

      if (signUpError) {
        setError(getAuthErrorMessage(signUpError.message));
        return;
      }

      if (data.user && data.session) {
        setAuthUser(data.user);
        return;
      }

      setStatus(
        "Compte créé. Vérifiez votre email, puis revenez sur ce lien pour rejoindre l’entreprise."
      );
      return;
    }

    const { data, error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

    setIsSubmitting(false);

    if (loginError) {
      setError(getAuthErrorMessage(loginError.message));
      return;
    }

    setAuthUser(data.user);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-10 text-gray-950">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_440px]">
        <section className="hidden lg:block">
          <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-lg font-bold text-white">
            B
          </div>
          <h1 className="max-w-xl text-5xl font-bold tracking-tight">
            Rejoindre Briefly
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-8 text-gray-600">
            Accédez à l’espace de travail de votre entreprise et collaborez sur
            les réunions, tâches et comptes rendus.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-100 sm:p-8">
          <div>
            <p className="text-sm font-semibold text-gray-500">Invitation</p>
            <h2 className="mt-2 text-2xl font-bold">
              {invitation
                ? `${invitation.first_name || ""} ${invitation.last_name || ""}`.trim() ||
                  invitation.email
                : "Briefly"}
            </h2>
            {invitation && (
              <p className="mt-2 text-sm text-gray-600">
                Rôle prévu :{" "}
                <span className="font-semibold text-gray-950">
                  {invitation.role}
                </span>
              </p>
            )}
          </div>

          {isLoading && (
            <p className="mt-6 text-sm text-gray-500">Chargement de l’invitation...</p>
          )}

          {error && (
            <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </div>
          )}

          {status && (
            <div className="mt-6 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-100">
              {status}
            </div>
          )}

          {invitation && invitation.status === "pending" && !authUser && !error && (
            <>
              <div className="mt-7 grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setAuthMode("login")}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    authMode === "login" ? "bg-white shadow-sm" : "text-gray-500"
                  }`}
                >
                  Connexion
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode("signup")}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    authMode === "signup" ? "bg-white shadow-sm" : "text-gray-500"
                  }`}
                >
                  Inscription
                </button>
              </div>

              <form onSubmit={submitAuth} className="mt-6 space-y-3">
                {authMode === "signup" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Prénom"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                    />
                    <input
                      type="text"
                      placeholder="Nom"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                    />
                  </div>
                )}

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                />
                <input
                  type="password"
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  {isSubmitting
                    ? "Validation..."
                    : authMode === "signup"
                      ? "Créer mon compte"
                      : "Se connecter"}
                </button>
              </form>
            </>
          )}

          {authUser && invitation?.status === "accepted" && (
            <Link
              href="/"
              className="mt-7 block rounded-xl bg-black px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Ouvrir Briefly
            </Link>
          )}
        </section>
      </div>
    </main>
  );
}
