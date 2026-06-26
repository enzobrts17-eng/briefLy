"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";

type Employee = {
  id: number;
  user_id?: string | null;
  name: string;
  role: string;
  email: string;
};

export default function EmployeesPage() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setAuthUser(session?.user || null);
      setIsAuthLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user || null);
      setIsAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    loadEmployees();
    // Chargement volontairement lié au changement d'utilisateur connecté.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]);

  async function loadEmployees() {
    if (!authUser) return;

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", authUser.id)
      .order("name");

    if (error) {
      console.error(error);
      return;
    }

    setEmployees(data || []);
  }

  async function addEmployee() {
    if (!authUser) return;
    if (!name) return;

    const { error } = await supabase.from("employees").insert({
      user_id: authUser.id,
      name,
      role,
      email,
    });

    if (error) {
      console.error(error);
      return;
    }

    setName("");
    setRole("");
    setEmail("");

    await loadEmployees();
  }

  if (isAuthLoading) {
    return <main className="p-8">Chargement...</main>;
  }

  if (!authUser) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <h1 className="mb-3 text-3xl font-bold">Briefly</h1>
        <p className="text-gray-600">
          Connectez-vous depuis la page principale pour accéder aux membres.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">
        Membres
      </h1>

      <div className="border rounded-lg p-4 mb-8">
        <h2 className="font-bold mb-4">
          Ajouter un membre
        </h2>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Nom"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border p-2 rounded"
          />

          <input
            type="text"
            placeholder="Poste"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border p-2 rounded"
          />

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border p-2 rounded"
          />

          <button
            onClick={addEmployee}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Ajouter
          </button>
        </div>
      </div>

      <h2 className="text-2xl font-bold mb-4">
        Liste des membres
      </h2>

      <div className="space-y-3">
        {employees.map((employee) => (
          <div
            key={employee.id}
            className="border rounded-lg p-4"
          >
            <p className="font-bold">{employee.name}</p>
            <p>{employee.role}</p>
            <p className="text-gray-500">{employee.email}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
