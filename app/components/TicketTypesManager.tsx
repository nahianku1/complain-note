"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AuthUser, TicketType } from "../../lib/db";
import { apiFetch } from "../../lib/api-client";

const emptyType = { name: "" };

function Icon({ name }: { name: "pulse" | "arrow" | "tag" | "edit" | "trash" | "copy" | "plus" | "search" | "close" }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "pulse") return <svg {...common}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === "tag") return <svg {...common}><path d="M20 13 13 20l-9-9V4h7l9 9Z" /><path d="M8 8h.01" /></svg>;
  if (name === "edit") return <svg {...common}><path d="m4 16-.7 4.7L8 20l11.5-11.5a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m14.5 6.5 3 3" /></svg>;
  if (name === "trash") return <svg {...common}><path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
  if (name === "copy") return <svg {...common}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
}

export default function TicketTypesManager({ user }: { user: AuthUser }) {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState(emptyType.name);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [isSavingType, setIsSavingType] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<number | null>(null);
  const [duplicatingTypeId, setDuplicatingTypeId] = useState<number | null>(null);
  const [typeError, setTypeError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);

  useEffect(() => {
    apiFetch("/api/ticket-types")
      .then((response) => response.json())
      .then((payload: { ticketTypes: TicketType[] }) => setTicketTypes(payload.ticketTypes))
      .catch(() => setTypeError("Could not load ticket types."))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!isFormOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSavingType) closeForm();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFormOpen, isSavingType]);

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingTypeId(null);
    setNewTypeName(emptyType.name);
    setTypeError("");
  };

  const openCreateForm = () => {
    setTypeError("");
    setStatusMessage("");
    setEditingTypeId(null);
    setNewTypeName(emptyType.name);
    setIsFormOpen(true);
  };

  const openEditForm = (type: TicketType) => {
    setTypeError("");
    setStatusMessage("");
    setEditingTypeId(type.id);
    setNewTypeName(type.name);
    setIsFormOpen(true);
  };

  const handleTypeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTypeError("");
    setStatusMessage("");
    setIsSavingType(true);
    try {
      const response = await apiFetch(editingTypeId ? `/api/ticket-types/${editingTypeId}` : "/api/ticket-types", {
        method: editingTypeId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTypeName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Unable to ${editingTypeId ? "update" : "save"} ticket type.`);
      setTicketTypes((current) => editingTypeId ? current.map((type) => type.id === editingTypeId ? payload.ticketType : type) : [...current, payload.ticketType]);
      setStatusMessage(editingTypeId ? `“${payload.ticketType.name}” updated.` : `“${payload.ticketType.name}” added to your ticket types.`);
      closeForm();
    } catch (submissionError) {
      setTypeError(submissionError instanceof Error ? submissionError.message : "Unable to save ticket type.");
    } finally {
      setIsSavingType(false);
    }
  };

  const handleDuplicateType = async (type: TicketType) => {
    setTypeError("");
    setStatusMessage("");
    setDuplicatingTypeId(type.id);

    const existingNames = new Set(ticketTypes.map((ticketType) => ticketType.name));
    let copyNumber = 1;
    let suffix = " (Copy)";
    let name = `${type.name.slice(0, 60 - suffix.length).trimEnd()}${suffix}`;
    while (existingNames.has(name)) {
      copyNumber += 1;
      suffix = ` (Copy ${copyNumber})`;
      name = `${type.name.slice(0, 60 - suffix.length).trimEnd()}${suffix}`;
    }

    try {
      const response = await apiFetch("/api/ticket-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to duplicate ticket type.");
      setTicketTypes((current) => [...current, payload.ticketType]);
      setStatusMessage(`“${type.name}” duplicated as “${payload.ticketType.name}”.`);
    } catch (duplicateError) {
      setTypeError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate ticket type.");
    } finally {
      setDuplicatingTypeId(null);
    }
  };

  const handleDeleteType = async (type: TicketType) => {
    if (!window.confirm(`Delete “${type.name}”? Existing tickets will be kept.`)) return;
    setTypeError("");
    setStatusMessage("");
    setDeletingTypeId(type.id);
    try {
      const response = await apiFetch(`/api/ticket-types/${type.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to delete ticket type.");
      setTicketTypes((current) => current.filter((currentType) => currentType.id !== type.id));
      if (editingTypeId === type.id) closeForm();
      setStatusMessage(`“${type.name}” deleted.`);
    } catch (deleteError) {
      setTypeError(deleteError instanceof Error ? deleteError.message : "Unable to delete ticket type.");
    } finally {
      setDeletingTypeId(null);
    }
  };

  const columns = useMemo<ColumnDef<TicketType>[]>(() => [
    {
      accessorKey: "name",
      header: "Ticket type",
      cell: ({ getValue }) => <span className="type-name-cell"><Icon name="tag" />{String(getValue())}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="ticket-actions">
          <button type="button" className="type-action-button" onClick={() => openEditForm(row.original)} aria-label={`Edit ${row.original.name}`} title="Edit ticket type"><Icon name="edit" /></button>
          <button type="button" className="type-action-button" onClick={() => handleDuplicateType(row.original)} disabled={duplicatingTypeId === row.original.id} aria-label={`Duplicate ${row.original.name}`} title="Duplicate ticket type"><Icon name="copy" /></button>
          <button type="button" className="type-action-button danger" onClick={() => handleDeleteType(row.original)} disabled={deletingTypeId === row.original.id} aria-label={`Delete ${row.original.name}`} title="Delete ticket type"><Icon name="trash" /></button>
        </div>
      ),
    },
  ], [deletingTypeId, duplicatingTypeId, editingTypeId]);

  const table = useReactTable({
    data: ticketTypes,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <main className="app-shell ticket-types-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="ticket-types-page">
        <header className="profile-page-nav">
          <a className="profile-brand" href="/"><span className="brand-mark"><Icon name="pulse" /></span><span><small>Operations console</small><strong>TicketDesk</strong></span></a>
          <div className="type-page-nav-actions">
            <span className="user-email">{user.email}</span>
            <a className="back-link" href="/">Back to workspace <Icon name="arrow" /></a>
          </div>
        </header>

        <div className="hero-row ticket-types-hero">
          <div>
            <p className="eyebrow gradient-eyebrow">Ticket setup</p>
            <h2>Ticket types</h2>
            <p className="hero-copy">Create and maintain the reusable categories offered in every ticket.</p>
          </div>
          <div className="hero-actions">
            <button className="primary-button" onClick={openCreateForm}><Icon name="plus" /> Add ticket type <Icon name="arrow" /></button>
          </div>
        </div>

        {typeError && <div className="settings-alert error" role="alert">{typeError}</div>}
        {!typeError && statusMessage && <div className="settings-alert success" role="status">{statusMessage}</div>}

        {isFormOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSavingType) closeForm(); }}>
          <section className="modal-card ticket-type-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-type-modal-title" aria-describedby="ticket-type-modal-description">
            <div className="modal-header">
              <div>
                <p className="eyebrow gradient-eyebrow">Ticket setup</p>
                <h3 id="ticket-type-modal-title">{editingTypeId ? "Edit ticket type" : "Add ticket type"}</h3>
                <p id="ticket-type-modal-description">{editingTypeId ? "Rename this type — existing tickets that use it are updated too." : "Create a reusable type for the ticket form."}</p>
              </div>
              <button type="button" className="icon-button" onClick={closeForm} disabled={isSavingType} aria-label="Close ticket type dialog"><Icon name="close" /></button>
            </div>
            {typeError && <div className="settings-alert error" role="alert">{typeError}</div>}
            <form className="settings-form ticket-type-form" onSubmit={handleTypeSubmit}>
              <label><span>Ticket type name<span className="field-required">*</span></span><input required autoFocus maxLength={60} value={newTypeName} onChange={(event) => setNewTypeName(event.target.value)} placeholder="Example: Fiber cut" /></label>
              <div className="modal-actions">
                <button type="button" className="secondary-button" onClick={closeForm} disabled={isSavingType}>Cancel</button>
                <button className="primary-button" type="submit" disabled={isSavingType}>{isSavingType ? "Saving…" : editingTypeId ? "Save changes" : "Add ticket type"} <Icon name={editingTypeId ? "edit" : "plus"} /></button>
              </div>
            </form>
          </section>
        </div>}

        <section className="workspace-card ticket-types-table-card">
          <div className="table-toolbar">
            <div className="table-toolbar-head">
              <div>
                <div className="section-title-row"><h3>All ticket types</h3><span className="count-badge">{ticketTypes.length}</span></div>
                <p className="section-copy">{ticketTypes.length === 1 ? "1 type is offered in the ticket form." : `${ticketTypes.length} types are offered in the ticket form.`}</p>
              </div>
              <label className="search-box">
                <Icon name="search" />
                <input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Search types..." aria-label="Search ticket types" />
              </label>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{headerGroup.headers.map((header) => <th key={header.id} onClick={header.column.getToggleSortingHandler()} className={header.column.getCanSort() ? "sortable" : ""}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                </th>)}</tr>)}
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={2} className="empty-state">Loading ticket types…</td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={2} className="empty-state">No ticket types match your search.</td></tr> : table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <span>Showing <strong>{table.getRowModel().rows.length}</strong> of <strong>{table.getFilteredRowModel().rows.length}</strong> matching types</span>
          </div>
        </section>

        <p className="footer-note"><span className="shield-mark">✦</span> Local-first workspace · Type changes apply to the ticket form immediately</p>
      </section>
    </main>
  );
}
