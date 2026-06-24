"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Employee = {
  id: number;
  name: string;
  role: string;
  email: string;
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    loadEmployees();
  }, []);

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

  async function addEmployee() {
    if (!name) return;

    const { error } = await supabase.from("employees").insert({
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

  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">
        Collaborateurs
      </h1>

      <div className="border rounded-lg p-4 mb-8">
        <h2 className="font-bold mb-4">
          Ajouter un collaborateur
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
        Liste des collaborateurs
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