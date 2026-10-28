"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AuthUser, TechnicianRow } from "../../lib/db";
import { apiFetch } from "../../lib/api-client";

type TechnicianForm = {
  name: string;
  mobile1: string;
  mobile2: string;
  whatsappNumber: string;
  address: string;
  nid: string;
  fatherName: string;
  motherName: string;
};

const emptyForm: TechnicianForm = {
  name: "",
  mobile1: "",
  mobile2: "",
  whatsappNumber: "",
  address: "",
  nid: "",
  fatherName: "",
  motherName: "",
};

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
    | "user"
    | "telephone"
    | "whatsapp"
    | "id-card"
    | "users"
    | "home";
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
  if (name === "edit") return <svg {...common}><path d="m4 16-.7 4.7L8 20l11.5-11.5a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m14.5 6.5 3 3" /></svg>;
  if (name === "trash") return <svg {...common}><path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "user") return <svg {...common}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === "id-card") return <svg {...common}><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>;
  if (name === "home") return <svg {...common}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
  if (name === "whatsapp") return <svg {...common}><path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.1A8 8 0 1 1 20 11.5Z" /><path d="M8.6 8.2c.2-.3.5-.3.8-.2l1.1.6c.3.2.4.5.2.8l-.5.7c.6 1.1 1.5 2 2.6 2.6l.7-.5c.3-.2.6-.1.8.2l.6 1.1c.2.3.1.6-.2.8-.5.4-1.1.6-1.7.4-2.1-.6-4.2-2.8-4.8-4.8-.2-.6 0-1.2.4-1.7Z" /></svg>;
  if (name === "telephone") return <svg {...common}><path d="M6.8 3.5 9.5 3l1.6 4-1.9 1.5a14 14 0 0 0 6.3 6.3l1.5-1.9 4 1.6-.5 2.7c-.2 1-1.1 1.7-2.1 1.6C10.8 18.2 5.8 13.2 5.2 5.6c-.1-1 .6-1.9 1.6-2.1Z" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>;
}

export default function TechnicianManager({ user }: { user: AuthUser }) {
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TechnicianForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);

  useEffect(() => {
    apiFetch("/api/technicians")
      .then((res) => res.json())
      .then((payload: { technicians?: TechnicianRow[]; error?: string }) => {
        if (payload.technicians) {
          setTechnicians(payload.technicians);
        } else if (payload.error) {
          setErrorMessage(payload.error);
        }
      })
      .catch(() => setErrorMessage("Could not load technicians."))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) closeModal();
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

  const openEditModal = (technician: TechnicianRow) => {
    setErrorMessage("");
    setStatusMessage("");
    setEditingId(technician.id);
    setForm({
      name: technician.name,
      mobile1: technician.mobile1,
      mobile2: technician.mobile2,
      whatsappNumber: technician.whatsappNumber || "",
      address: technician.address,
      nid: technician.nid,
      fatherName: technician.fatherName,
      motherName: technician.motherName,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setIsSaving(true);

    const isEditing = editingId !== null;
    const endpoint = isEditing ? `/api/technicians/${editingId}` : "/api/technicians";
    const method = isEditing ? "PATCH" : "POST";

    try {
      const response = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || `Unable to ${isEditing ? "update" : "add"} technician.`);
      }

      const updatedTech = payload.technician as TechnicianRow;
      setTechnicians((current) =>
        isEditing
          ? current.map((tech) => (tech.id === editingId ? updatedTech : tech))
          : [updatedTech, ...current]
      );
      setStatusMessage(
        isEditing
          ? `Technician “${updatedTech.name}” updated successfully.`
          : `Technician “${updatedTech.name}” added successfully.`
      );
      closeModal();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (technician: TechnicianRow) => {
    if (!window.confirm(`Are you sure you want to delete technician “${technician.name}”?`)) return;

    setErrorMessage("");
    setStatusMessage("");
    setDeletingId(technician.id);

    try {
      const response = await apiFetch(`/api/technicians/${technician.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Unable to delete technician.");
      }

      setTechnicians((current) => current.filter((tech) => tech.id !== technician.id));
      if (editingId === technician.id) closeModal();
      setStatusMessage(`Technician “${technician.name}” deleted.`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unable to delete technician.");
    } finally {
      setDeletingId(null);
    }
  };

  const columns = useMemo<ColumnDef<TechnicianRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ getValue }) => {
          const name = String(getValue());
          const initials = name
            .split(" ")
            .filter(Boolean)
            .map((part) => part[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "T";

          return (
            <div className="technician-name-cell">
              <span className="technician-avatar-badge">{initials}</span>
              <div>
                <strong className="technician-name">{name}</strong>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "mobile1",
        header: "Primary Mobile",
        cell: ({ getValue }) => {
          const mobile = String(getValue());
          const dial = toDialNumber(mobile);
          return (
            <span className="contact-cell">
              <span className="mono-cell">{mobile}</span>
              <span className="contact-actions">
                <a
                  className="contact-action-button telephone"
                  href={`tel:${dial}`}
                  aria-label={`Call ${mobile}`}
                  title="Call mobile"
                >
                  <Icon name="telephone" />
                </a>
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "mobile2",
        header: "Secondary Mobile",
        cell: ({ getValue }) => {
          const mobile = String(getValue() || "");
          if (!mobile) return <span className="muted-cell">—</span>;
          const dial = toDialNumber(mobile);
          return (
            <span className="contact-cell">
              <span className="mono-cell">{mobile}</span>
              <span className="contact-actions">
                <a
                  className="contact-action-button telephone"
                  href={`tel:${dial}`}
                  aria-label={`Call ${mobile}`}
                  title="Call secondary mobile"
                >
                  <Icon name="telephone" />
                </a>
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "whatsappNumber",
        header: "WhatsApp Number",
        cell: ({ getValue, row }) => {
          const raw = String(getValue() || "").trim();
          const whatsapp = raw || row.original.mobile1;
          if (!whatsapp) return <span className="muted-cell">—</span>;
          const wa = toWhatsAppNumber(whatsapp);
          return (
            <span className="contact-cell">
              <span className="mono-cell">{whatsapp}</span>
              <span className="contact-actions">
                <a
                  className="contact-action-button whatsapp"
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`WhatsApp ${whatsapp}`}
                  title="WhatsApp"
                >
                  <Icon name="whatsapp" />
                </a>
              </span>
            </span>
          );
        },
      },
      {
        accessorKey: "nid",
        header: "NID Number",
        cell: ({ getValue }) => (
          <span className="nid-pill">
            <Icon name="id-card" />
            <span className="mono-cell">{String(getValue()) || "—"}</span>
          </span>
        ),
      },
      {
        accessorKey: "address",
        header: "Address",
        cell: ({ getValue }) => (
          <span className="address-cell" title={String(getValue() || "")}>
            {String(getValue()) || "—"}
          </span>
        ),
      },
      {
        accessorKey: "fatherName",
        header: "Father's Name",
        cell: ({ getValue }) => (
          <span className="muted-cell">{String(getValue()) || "—"}</span>
        ),
      },
      {
        accessorKey: "motherName",
        header: "Mother's Name",
        cell: ({ getValue }) => (
          <span className="muted-cell">{String(getValue()) || "—"}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Added Date",
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
              title="Edit technician"
            >
              <Icon name="edit" />
            </button>
            <button
              type="button"
              className="type-action-button danger"
              onClick={() => handleDelete(row.original)}
              disabled={deletingId === row.original.id}
              aria-label={`Delete ${row.original.name}`}
              title="Delete technician"
            >
              <Icon name="trash" />
            </button>
          </div>
        ),
      },
    ],
    [deletingId]
  );

  const table = useReactTable({
    data: technicians,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <section className="technicians-page">
        {/* Navigation Bar */}
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

        {/* Hero Section */}
        <div className="hero-row ticket-types-hero">
          <div>
            <p className="eyebrow gradient-eyebrow">Field operations / Staff</p>
            <h2>Technicians</h2>
            <p className="hero-copy">
              Manage field technician profiles, emergency contacts, and National ID records.
            </p>
          </div>
          <div className="hero-actions">
            <button className="primary-button" onClick={openCreateModal}>
              <Icon name="plus" /> Add technician <Icon name="arrow" />
            </button>
          </div>
        </div>

        {/* Status and Error Alerts */}
        {errorMessage && (
          <div className="settings-alert error" role="alert">
            {errorMessage}
          </div>
        )}
        {!errorMessage && statusMessage && (
          <div className="settings-alert success" role="status">
            {statusMessage}
          </div>
        )}

        {/* Add / Edit Technician Modal */}
        {isModalOpen && (
          <div
            className="modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !isSaving) closeModal();
            }}
          >
            <section
              className="modal-card technician-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="technician-modal-title"
              aria-describedby="technician-modal-description"
            >
              <div className="modal-header">
                <div>
                  <p className="eyebrow gradient-eyebrow">Technician profile</p>
                  <h3 id="technician-modal-title">
                    {editingId ? "Edit technician" : "Add technician"}
                  </h3>
                  <p id="technician-modal-description">
                    {editingId
                      ? "Update the technician's details and contact information."
                      : "Provide all required fields to onboard a new field technician."}
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={closeModal}
                  disabled={isSaving}
                  aria-label="Close technician dialog"
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
                <div className="form-grid">
                  <label className="wide-field">
                    <span>Technician name<span className="field-required">*</span></span>
                    <input
                      required
                      autoFocus
                      maxLength={100}
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Rafiqul Islam"
                    />
                  </label>

                  <label>
                    <span>Primary mobile<span className="field-required">*</span></span>
                    <input
                      required
                      type="tel"
                      maxLength={25}
                      value={form.mobile1}
                      onChange={(e) => setForm({ ...form, mobile1: e.target.value })}
                      placeholder="e.g. 01711000111"
                    />
                  </label>

                  <label>
                    <span>Secondary mobile <span className="optional-label">(optional)</span></span>
                    <input
                      type="tel"
                      maxLength={25}
                      value={form.mobile2}
                      onChange={(e) => setForm({ ...form, mobile2: e.target.value })}
                      placeholder="e.g. 01822000222"
                    />
                  </label>

                  <label>
                    <span>WhatsApp number <span className="optional-label">(optional)</span></span>
                    <input
                      type="tel"
                      maxLength={25}
                      value={form.whatsappNumber}
                      onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                      placeholder="e.g. 01711000111"
                    />
                  </label>

                  <label>
                    <span>NID number<span className="field-required">*</span></span>
                    <input
                      required
                      maxLength={30}
                      value={form.nid}
                      onChange={(e) => setForm({ ...form, nid: e.target.value })}
                      placeholder="e.g. 1994269251000000"
                    />
                  </label>

                  <label>
                    <span>Father's name<span className="field-required">*</span></span>
                    <input
                      required
                      maxLength={100}
                      value={form.fatherName}
                      onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                      placeholder="e.g. Md. Abdul Jalil"
                    />
                  </label>

                  <label>
                    <span>Mother's name<span className="field-required">*</span></span>
                    <input
                      required
                      maxLength={100}
                      value={form.motherName}
                      onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                      placeholder="e.g. Rokeya Begum"
                    />
                  </label>

                  <label className="wide-field">
                    <span>Address<span className="field-required">*</span></span>
                    <textarea
                      required
                      rows={3}
                      maxLength={250}
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="e.g. House 45, Road 7, Sector 3, Uttara, Dhaka"
                    />
                  </label>
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
                    {isSaving
                      ? "Saving…"
                      : editingId
                      ? "Save changes"
                      : "Add technician"}{" "}
                    <Icon name={editingId ? "edit" : "plus"} />
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* Technicians Table Card */}
        <section className="workspace-card technicians-table-card">
          <div className="table-toolbar">
            <div className="table-toolbar-head">
              <div>
                <div className="section-title-row">
                  <h3>All technicians</h3>
                  <span className="count-badge">{technicians.length}</span>
                </div>
                <p className="section-copy">
                  {technicians.length === 1
                    ? "1 technician registered in the system."
                    : `${technicians.length} technicians registered in the system.`}
                </p>
              </div>

              <label className="search-box">
                <Icon name="search" />
                <input
                  value={globalFilter}
                  onChange={(event) => setGlobalFilter(event.target.value)}
                  placeholder="Search name, phone, WhatsApp, NID, address..."
                  aria-label="Search technicians"
                />
              </label>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
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
                    <td colSpan={10} className="empty-state">
                      Loading technicians…
                    </td>
                  </tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="empty-state">
                      {globalFilter
                        ? "No technicians match your search."
                        : "No technicians added yet. Click “Add technician” to create your first entry."}
                    </td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <span>
              Showing <strong>{table.getRowModel().rows.length}</strong> of{" "}
              <strong>{table.getFilteredRowModel().rows.length}</strong> matching technicians
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
