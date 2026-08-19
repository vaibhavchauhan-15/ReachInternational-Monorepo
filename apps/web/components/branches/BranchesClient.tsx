"use client";

import { useState } from "react";
import {
  AnimatedBuilding2,
  AnimatedPlus,
  AnimatedWrench,
  AnimatedUsers,
  AnimatedPackage,
  AnimatedAlertTriangle,
  AnimatedMapPin,
  AnimatedPhone,
  AnimatedMail,
  AnimatedEdit,
} from "@/components/ui/animated-icons";
import type { Branch } from "@/lib/types/database";
import { createBranchAction, updateBranchAction } from "@/app/actions/branches";

export interface BranchWithMetrics extends Branch {
  machines_count?: number;
  employees_count?: number;
  inventory_items_count?: number;
  open_complaints_count?: number;
}

export interface BranchesClientProps {
  branches: BranchWithMetrics[];
  canCreateBranch?: boolean;
  canEditBranch?: boolean;
}

export function BranchesClient({ branches, canCreateBranch = false, canEditBranch = false }: BranchesClientProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchWithMetrics | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states for Creation
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Form states for Editing
  const [editName, setEditName] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const res = await createBranchAction({
      code,
      name,
      city,
      state,
      address,
      phone,
      email,
    });

    setSubmitting(false);

    if (res.success) {
      setShowCreateModal(false);
      setCode("");
      setName("");
      setCity("");
      setState("");
      setAddress("");
      setPhone("");
      setEmail("");
    } else {
      alert(`Error creating branch: ${res.error}`);
    }
  };

  const openEditModal = (b: BranchWithMetrics) => {
    setEditingBranch(b);
    setEditName(b.name);
    setEditCity(b.city);
    setEditState(b.state);
    setEditAddress(b.address || "");
    setEditPhone(b.phone || "");
    setEditEmail(b.email || "");
  };

  const handleUpdateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBranch) return;
    setSubmitting(true);

    const res = await updateBranchAction(editingBranch.id, {
      name: editName,
      city: editCity,
      state: editState,
      address: editAddress,
      phone: editPhone,
      email: editEmail,
    });

    setSubmitting(false);

    if (res.success) {
      setEditingBranch(null);
    } else {
      alert(`Error updating branch: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--color-ink)] flex items-center gap-2">
            <AnimatedBuilding2 size={20} className="text-sky-600 dark:text-sky-400" />
            Branch & Location Directory
          </h1>
          <p className="text-xs text-[var(--color-mute)] mt-0.5">
            Single-branch organization structure (Delhi Branch Headquarters).
          </p>
        </div>

        {canCreateBranch && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <AnimatedPlus size={16} /> Add Branch (Super Admin)
          </button>
        )}
      </div>

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {branches.map((b) => (
          <div
            key={b.id}
            className="p-5 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4 hover:border-sky-500/30 transition-all shadow-sm relative group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 font-extrabold text-sm border border-sky-500/20">
                  {b.code}
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[var(--color-ink)]">{b.name}</h3>
                  <p className="text-xs text-[var(--color-mute)] flex items-center gap-1">
                    <AnimatedMapPin size={12} className="text-rose-500" /> {b.city}, {b.state}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
                  {b.status}
                </span>

                {canEditBranch && (
                  <button
                    onClick={() => openEditModal(b)}
                    className="p-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-sky-600 hover:border-sky-500/40 transition-all cursor-pointer"
                    title="Edit Operational Info"
                  >
                    <AnimatedEdit size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[var(--color-hairline)] text-center">
              <div className="p-2 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                <p className="text-[10px] font-bold text-[var(--color-mute)] flex items-center justify-center gap-1">
                  <AnimatedWrench size={12} className="text-sky-500" /> Machines
                </p>
                <p className="text-lg font-black text-[var(--color-ink)] mt-0.5">
                  {b.machines_count ?? 0}
                </p>
              </div>

              <div className="p-2 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                <p className="text-[10px] font-bold text-[var(--color-mute)] flex items-center justify-center gap-1">
                  <AnimatedUsers size={12} className="text-emerald-500" /> Staff
                </p>
                <p className="text-lg font-black text-[var(--color-ink)] mt-0.5">
                  {b.employees_count ?? 0}
                </p>
              </div>

              <div className="p-2 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                <p className="text-[10px] font-bold text-[var(--color-mute)] flex items-center justify-center gap-1">
                  <AnimatedPackage size={12} className="text-purple-500" /> Store Parts
                </p>
                <p className="text-lg font-black text-[var(--color-ink)] mt-0.5">
                  {b.inventory_items_count ?? 0}
                </p>
              </div>

              <div className="p-2 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-hairline)]">
                <p className="text-[10px] font-bold text-[var(--color-mute)] flex items-center justify-center gap-1">
                  <AnimatedAlertTriangle size={12} className="text-amber-500" /> Open CMP
                </p>
                <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                  {b.open_complaints_count ?? 0}
                </p>
              </div>
            </div>

            {/* Address & Contact Info */}
            <div className="text-xs text-[var(--color-mute)] space-y-1 pt-1 font-medium">
              {b.address && <p className="truncate">📍 {b.address}</p>}
              <div className="flex items-center justify-between text-[11px]">
                {b.phone && <span className="flex items-center gap-1"><AnimatedPhone size={12} className="text-sky-500" /> {b.phone}</span>}
                {b.email && <span className="flex items-center gap-1"><AnimatedMail size={12} className="text-purple-500" /> {b.email}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Branch Modal (Super Admin only) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedBuilding2 size={20} className="text-sky-600 dark:text-sky-400" />
              Create New Branch Office
            </h2>
            <form onSubmit={handleCreateBranch} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Branch Code *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. MUM-01"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Branch Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Mumbai Main Branch"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. Maharashtra"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Plot / Industrial Area Address"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mumbai@company.com"
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold"
                >
                  Save Branch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Branch Operational Info Modal (Admin & Super Admin) */}
      {editingBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-4">
            <h2 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedBuilding2 size={20} className="text-sky-600 dark:text-sky-400" />
              Edit Operational Branch Info ({editingBranch.code})
            </h2>
            <form onSubmit={handleUpdateBranch} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="flex-1 py-2 rounded-xl border border-[var(--color-hairline)] text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
