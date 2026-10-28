"use client";

import {
  type ColumnDef,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AuthUser, TechnicianRow, TeamWithMembers } from "../../lib/db";
import { apiFetch } from "../../lib/api-client";

type TeamForm = {
  name: string;
  technicianIds: number[];
};

const emptyForm: TeamForm = { name: "", technicianIds: [] };

function formatBangladeshDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-BD", {
      timeZone: "Asia/Dhaka",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function toDialNumber(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function toWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `880${digits.slice(1)}`;
  return digits;
}

function Icon({
  name,
}: {
  name:
    | "pulse"
    | "arrow"
    | "edit"
    | "trash"
    | "plus"
    | "search"
    | "close"
    | "users"
    | "user"
    | "whatsapp"
    | "telephone"
    | "home"
    | "check"
    | "chevron";
}) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "pulse") return <svg {...common}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === "chevron") return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>;
  if (name === "edit") return <svg {...common}><path d="m4 16-.7 4.7L8 20l11.5-11.5a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m14.5 6.5 3 3" /></svg>;
  if (name === "trash") return <svg {...common}><path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === "user") return <svg {...common}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
  if (name === "whatsapp") return <svg {...common}><path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.1A8 8 0 1 1 20 11.5Z" /><path d="M8.6 8.2c.2-.3.5-.3.8-.2l1.1.6c.3.2.4.5.2.8l-.5.7c.6 1.1 1.5 2 2.6 2.6l.7-.5c.3-.2.6-.1.8.2l.6 1.1c.2.3.1.6-.2.8-.5.4-1.1.6-1.7.4-2.1-.6-4.2-2.8-4.8-4.8-.2-.6 0-1.2.4-1.7Z" /></svg>;
  if (name === "telephone") return <svg {...common}><path d="M6.8 3.5 9.5 3l1.6 4-1.9 1.5a14 14 0 0 0 6.3 6.3l1.5-1.9 4 1.6-.5 2.7c-.2 1-1.1 1.7-2.1 1.6C10.8 18.2 5.8 13.2 5.2 5.6c-.1-1 .6-1.9 1.6-2.1Z" /></svg>;
  if (name === "home") return <svg {...common}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 13 4 4L19 7" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>;
}

// ── Member badge ───────────────────────────────────────────────────────────────
function MemberBadge({
  name,
  mobile1,
  mobile2,
  whatsappNumber,
}: {
  name: string;
  mobile1: string;
  mobile2?: string;
  whatsappNumber?: string;
}) {
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "T";
  const wa = whatsappNumber ? toWhatsAppNumber(whatsappNumber) : "";
  const dial1 = mobile1 ? toDialNumber(mobile1) : "";
  const dial2 = mobile2 ? toDialNumber(mobile2) : "";

  return (
    <span
      className="team-member-badge"
      title={`${name} (M1: ${mobile1}${mobile2 ? `, M2: ${mobile2}` : ""}${whatsappNumber ? `, WA: ${whatsappNumber}` : ""})`}
    >
      <span className="team-member-avatar">{initials}</span>
      <span className="team-member-name">{name}</span>
      {mobile1 && (
        <a
          className="contact-action-button telephone team-member-call"
          href={`tel:${dial1}`}
          aria-label={`Call ${name} (1st mobile: ${mobile1})`}
          title={`Call 1st mobile: ${mobile1}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="telephone" />
        </a>
      )}
      {mobile2 && (
        <a
          className="contact-action-button telephone team-member-call"
          href={`tel:${dial2}`}
          aria-label={`Call ${name} (2nd mobile: ${mobile2})`}
          title={`Call 2nd mobile: ${mobile2}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="telephone" />
        </a>
      )}
      {whatsappNumber && (
        <a
          className="contact-action-button whatsapp team-member-wa"
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`WhatsApp ${name} (${whatsappNumber})`}
          title={`WhatsApp: ${whatsappNumber}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Icon name="whatsapp" />
        </a>
      )}
    </span>
  );
}

export default function TeamManager({ user }: { user: AuthUser }) {
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TeamForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [expanded, setExpanded] = useState<ExpandedState>(true);

  useEffect(() => {
    Promise.all([
      apiFetch("/api/teams").then((r) => r.json()),
      apiFetch("/api/technicians").then((r) => r.json()),
    ])
      .then(
        ([teamPayload, techPayload]: [
          { teams?: TeamWithMembers[]; error?: string },
          { technicians?: TechnicianRow[]; error?: string },
        ]) => {
          if (teamPayload.teams) setTeams(teamPayload.teams);
          else if (teamPayload.error) setErrorMessage(teamPayload.error);
          if (techPayload.technicians) setTechnicians(techPayload.technicians);
        },
      )
      .catch(() => setErrorMessage("Could not load data."))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) closeModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen, isSaving]);

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setErrorMessage("");
  };

  const openCreateModal = () => {
    setErrorMessage("");
    setStatusMessage("");
    setEditingId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (team: TeamWithMembers) => {
    setErrorMessage("");
    setStatusMessage("");
    setEditingId(team.id);
    setForm({
      name: team.name,
      technicianIds: team.members.map((m) => m.technicianId),
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsSaving(true);

    const isEditing = editingId !== null;
    const endpoint = isEditing ? `/api/teams/${editingId}` : "/api/teams";
    const method = isEditing ? "PATCH" : "POST";

    try {
      const response = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || `Unable to ${isEditing ? "update" : "create"} team.`);
      }

      const savedTeam = payload.team as TeamWithMembers;
      setTeams((current) =>
        isEditing
          ? current.map((t) => (t.id === editingId ? savedTeam : t))
          : [savedTeam, ...current],
      );
      setStatusMessage(
        isEditing
          ? `Team "${savedTeam.name}" updated successfully.`
          : `Team "${savedTeam.name}" created successfully.`,
      );
      closeModal();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (team: TeamWithMembers) => {
    if (!window.confirm(`Are you sure you want to delete team "${team.name}"?`)) return;
    setErrorMessage("");
    setStatusMessage("");
    setDeletingId(team.id);
    try {
      const response = await apiFetch(`/api/teams/${team.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to delete team.");
      setTeams((current) => current.filter((t) => t.id !== team.id));
      setStatusMessage(`Team "${team.name}" deleted.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to delete team.");
    } finally {
      setDeletingId(null);
    }
  };

  const columns = useMemo<ColumnDef<TeamWithMembers>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Team Name",
        cell: ({ row }) => {
          const isExpanded = row.getIsExpanded();
          return (
            <span className="team-name-cell">
              <button
                type="button"
                className={`expand-toggle-btn${isExpanded ? " is-expanded" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  row.toggleExpanded();
                }}
                title={isExpanded ? "Collapse members" : "Expand members"}
                aria-label={isExpanded ? "Collapse members" : "Expand members"}
              >
                <Icon name="chevron" />
              </button>
              <span className="team-icon-badge">
                <Icon name="users" />
              </span>
              <strong className="team-name-text">{row.original.name}</strong>
            </span>
          );
        },
      },
      {
        id: "members",
        header: "Grouped Members",
        enableSorting: false,
        cell: ({ row }) => {
          const { members } = row.original;
          if (members.length === 0) {
            return <span className="muted-cell">No members assigned</span>;
          }
          return (
            <div className="team-members-cell">
              {members.map((m) => (
                <MemberBadge
                  key={m.technicianId}
                  name={m.technicianName}
                  mobile1={m.mobile1}
                  mobile2={m.mobile2}
                  whatsappNumber={m.whatsappNumber}
                />
              ))}
            </div>
          );
        },
      },
      {
        id: "memberCount",
        header: "Count",
        accessorFn: (row) => row.members.length,
        cell: ({ row }) => (
          <span className="count-pill">{row.original.members.length}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ getValue }) => (
          <span className="date-cell">{formatBangladeshDate(String(getValue()))}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="ticket-actions">
            <button
              type="button"
              className="type-action-button"
              onClick={() => openEditModal(row.original)}
              aria-label={`Edit ${row.original.name}`}
              title="Edit team"
            >
              <Icon name="edit" />
            </button>
            <button
              type="button"
              className="type-action-button danger"
              onClick={() => handleDelete(row.original)}
              disabled={deletingId === row.original.id}
              aria-label={`Delete ${row.original.name}`}
              title="Delete team"
            >
              <Icon name="trash" />
            </button>
          </div>
        ),
      },
    ],
    [deletingId],
  );

  const table = useReactTable({
    data: teams,
    columns,
    state: { globalFilter, sorting, expanded },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = String(filterValue).toLowerCase().trim();
      if (!search) return true;
      const teamName = row.original.name.toLowerCase();
      if (teamName.includes(search)) return true;
      return row.original.members.some(
        (m) =>
          m.technicianName.toLowerCase().includes(search) ||
          m.mobile1.includes(search) ||
          m.whatsappNumber.includes(search),
      );
    },
    initialState: { pagination: { pageSize: 8 } },
  });

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="technicians-page">
        {/* Nav */}
        <header className="profile-page-nav">
          <Link className="profile-brand" href="/">
            <span className="brand-mark">
              <Icon name="pulse" />
            </span>
            <span>
              <small>Operations console</small>
              <strong>TicketDesk</strong>
            </span>
          </Link>
          <div className="type-page-nav-actions">
            <span className="user-email">{user.email}</span>
            <Link className="back-link" href="/">
              Back to workspace <Icon name="arrow" />
            </Link>
          </div>
        </header>

        {/* Hero */}
        <div className="hero-row ticket-types-hero">
          <div>
            <p className="eyebrow gradient-eyebrow">Field operations / Teams</p>
            <h2>Teams</h2>
            <p className="hero-copy">
              Organise technicians into field teams for efficient dispatch and management.
            </p>
          </div>
          <div className="hero-actions">
            <button className="primary-button" onClick={openCreateModal}>
              <Icon name="plus" /> Create team <Icon name="arrow" />
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="settings-alert success" style={{ marginBottom: "16px" }}>
            {statusMessage}
          </div>
        )}
        {errorMessage && !isModalOpen && (
          <div className="settings-alert error" style={{ marginBottom: "16px" }}>
            {errorMessage}
          </div>
        )}

        {/* Modal */}
        {isModalOpen && (
          <div
            className="modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-modal-title"
          >
            <section className="modal-card team-modal">
              <div className="modal-header flex-row">
                <div>
                  <h3 id="team-modal-title">{editingId ? "Edit team" : "Create team"}</h3>
                  <p>
                    {editingId
                      ? "Update team name and member assignments."
                      : "Name your team and assign technicians from the list."}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={closeModal}
                  disabled={isSaving}
                  aria-label="Close team dialog"
                >
                  <Icon name="close" />
                </button>
              </div>

              {errorMessage && (
                <div className="settings-alert error" role="alert" style={{ marginBottom: "16px" }}>
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
                  <label>
                    <span>
                      Team name<span className="field-required">*</span>
                    </span>
                    <input
                      required
                      autoFocus
                      maxLength={100}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Dhaka North Emergency Team"
                    />
                  </label>

                  <label>
                    <span>Select team member from technicians</span>
                    <select
                      value=""
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        if (id && !form.technicianIds.includes(id)) {
                          setForm({ ...form, technicianIds: [...form.technicianIds, id] });
                        }
                      }}
                    >
                      <option value="">
                        {technicians.length === 0
                          ? "No technicians available (add technicians first)"
                          : "-- Select technician to add to team --"}
                      </option>
                      {technicians.map((tech) => {
                        const isSelected = form.technicianIds.includes(tech.id);
                        return (
                          <option key={tech.id} value={tech.id} disabled={isSelected}>
                            {tech.name} (M1: {tech.mobile1}{tech.mobile2 ? `, M2: ${tech.mobile2}` : ""}{tech.whatsappNumber ? ` | WA: ${tech.whatsappNumber}` : ""})
                            {isSelected ? " ✓ Added" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>

                  {/* Selected members view */}
                  {form.technicianIds.length > 0 && (
                    <div className="selected-members-container">
                      <div className="selected-members-header">
                        <span>Selected team members ({form.technicianIds.length})</span>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setForm({ ...form, technicianIds: [] })}
                        >
                          Clear all
                        </button>
                      </div>
                      <div className="selected-members-chips">
                        {form.technicianIds.map((id) => {
                          const tech = technicians.find((t) => t.id === id);
                          if (!tech) return null;
                          return (
                            <span key={id} className="selected-member-chip">
                              <span className="chip-avatar">
                                {tech.name
                                  .split(" ")
                                  .filter(Boolean)
                                  .map((p) => p[0])
                                  .slice(0, 2)
                                  .join("")
                                  .toUpperCase() || "T"}
                              </span>
                              <span>{tech.name}</span>
                              {tech.mobile1 && (
                                <a
                                  className="contact-action-button telephone team-member-call"
                                  href={`tel:${toDialNumber(tech.mobile1)}`}
                                  title={`Call 1st mobile: ${tech.mobile1}`}
                                  aria-label={`Call 1st mobile ${tech.name}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Icon name="telephone" />
                                </a>
                              )}
                              {tech.mobile2 && (
                                <a
                                  className="contact-action-button telephone team-member-call"
                                  href={`tel:${toDialNumber(tech.mobile2)}`}
                                  title={`Call 2nd mobile: ${tech.mobile2}`}
                                  aria-label={`Call 2nd mobile ${tech.name}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Icon name="telephone" />
                                </a>
                              )}
                              {tech.whatsappNumber && (
                                <a
                                  className="contact-action-button whatsapp team-member-wa"
                                  href={`https://wa.me/${toWhatsAppNumber(tech.whatsappNumber)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title={`WhatsApp: ${tech.whatsappNumber}`}
                                  aria-label={`WhatsApp ${tech.name}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Icon name="whatsapp" />
                                </a>
                              )}
                              <button
                                type="button"
                                className="chip-remove"
                                onClick={() =>
                                  setForm({
                                    ...form,
                                    technicianIds: form.technicianIds.filter((x) => x !== id),
                                  })
                                }
                                aria-label={`Remove ${tech.name}`}
                                title="Remove member"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {technicians.length === 0 && (
                    <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "12px" }}>
                      No technicians added yet.{" "}
                      <Link className="inline-link" href="/add-technician">
                        Add technicians first
                      </Link>
                    </p>
                  )}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={closeModal}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button className="primary-button" type="submit" disabled={isSaving}>
                    {isSaving ? "Saving…" : editingId ? "Save changes" : "Create team"}{" "}
                    <Icon name={editingId ? "edit" : "plus"} />
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* Table */}
        <section className="workspace-card technicians-table-card">
          <div className="table-toolbar">
            <div className="table-toolbar-head">
              <div>
                <div className="section-title-row">
                  <h3>All teams (Grouped view)</h3>
                  <span className="count-badge">{teams.length}</span>
                </div>
                <p className="section-copy">
                  {teams.length === 1
                    ? "1 team registered. Click row chevrons to toggle grouped technician view."
                    : `${teams.length} teams registered. Click row chevrons to toggle grouped technician view.`}
                </p>
              </div>
              <div className="toolbar-actions-group">
                {teams.length > 0 && (
                  <button
                    type="button"
                    className="view-toggle-btn"
                    onClick={() => table.toggleAllRowsExpanded()}
                    title="Toggle all grouped views"
                  >
                    <Icon name="chevron" />
                    {table.getIsAllRowsExpanded() ? "Collapse all" : "Expand all"}
                  </button>
                )}
                <label className="search-box">
                  <Icon name="search" />
                  <input
                    value={globalFilter}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    placeholder="Search team or member…"
                    aria-label="Search teams"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table className="teams-table">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((header) => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={header.column.getCanSort() ? "sortable" : ""}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      Loading teams…
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      {globalFilter
                        ? "No teams match your search."
                        : "No teams created yet. Click “Create team” to get started."}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <Fragment key={row.id}>
                      <tr>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                      {row.getIsExpanded() && (
                        <tr className="grouped-row">
                          <td colSpan={5}>
                            <div className="grouped-members-panel">
                              <div className="grouped-panel-header">
                                <span>
                                  <Icon name="users" /> Grouped Members{" "}
                                  <span className="header-badge">
                                    {row.original.members.length}
                                  </span>
                                </span>
                                <span>Team: {row.original.name}</span>
                              </div>
                              {row.original.members.length === 0 ? (
                                <div className="empty-group-members">
                                  No members assigned to this team yet. Click edit to assign technicians.
                                </div>
                              ) : (
                                <div className="grouped-members-grid">
                                  {row.original.members.map((member) => {
                                    const initials =
                                      member.technicianName
                                        .split(" ")
                                        .filter(Boolean)
                                        .map((p) => p[0])
                                        .slice(0, 2)
                                        .join("")
                                        .toUpperCase() || "T";
                                    return (
                                      <div
                                        key={member.technicianId}
                                        className="grouped-member-card"
                                      >
                                        <div className="grouped-member-main">
                                          <span className="grouped-member-avatar">
                                            {initials}
                                          </span>
                                          <div className="grouped-member-details">
                                            <strong>{member.technicianName}</strong>
                                            <div className="grouped-contact-lines">
                                              {member.mobile1 && (
                                                <div className="assigned-contact-line">
                                                  <span className="contact-line-text">1st: {member.mobile1}</span>
                                                  <a
                                                    className="contact-action-button telephone"
                                                    href={`tel:${toDialNumber(member.mobile1)}`}
                                                    title={`Call 1st: ${member.mobile1}`}
                                                    aria-label={`Call 1st ${member.technicianName}`}
                                                  >
                                                    <Icon name="telephone" />
                                                  </a>
                                                </div>
                                              )}
                                              {member.mobile2 && (
                                                <div className="assigned-contact-line">
                                                  <span className="contact-line-text">2nd: {member.mobile2}</span>
                                                  <a
                                                    className="contact-action-button telephone"
                                                    href={`tel:${toDialNumber(member.mobile2)}`}
                                                    title={`Call 2nd: ${member.mobile2}`}
                                                    aria-label={`Call 2nd ${member.technicianName}`}
                                                  >
                                                    <Icon name="telephone" />
                                                  </a>
                                                </div>
                                              )}
                                              {member.whatsappNumber && (
                                                <div className="assigned-contact-line">
                                                  <span className="contact-line-text wa-text">WA: {member.whatsappNumber}</span>
                                                  <a
                                                    className="contact-action-button whatsapp"
                                                    href={`https://wa.me/${toWhatsAppNumber(member.whatsappNumber)}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title={`WhatsApp: ${member.whatsappNumber}`}
                                                    aria-label={`WhatsApp ${member.technicianName}`}
                                                  >
                                                    <Icon name="whatsapp" />
                                                  </a>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <span>
              Showing <strong>{table.getRowModel().rows.length}</strong> of{" "}
              <strong>{table.getFilteredRowModel().rows.length}</strong> teams
            </span>
            <div className="pagination">
              <button
                type="button"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </button>
              <span>
                Page <strong>{table.getState().pagination.pageIndex + 1}</strong> /{" "}
                {table.getPageCount() || 1}
              </span>
              <button
                type="button"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next <Icon name="arrow" />
              </button>
            </div>
          </div>
        </section>

        <p className="footer-note">
          <span className="shield-mark">✦</span> Field Operations · Data stays encrypted on this server
        </p>
      </section>
    </main>
  );
}
