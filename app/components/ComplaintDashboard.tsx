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
import type { AuthUser, ComplaintRow, ComplaintType, ComplaintStatus } from "../../lib/db";
import { apiFetch } from "../../lib/api-client";

type ComplaintForm = Omit<ComplaintRow, "id" | "createdAt" | "entryBy">;

const emptyForm: ComplaintForm = {
  userId: "",
  phoneNumber: "",
  whatsappNumber: "",
  complaintType: "",
  status: "pending",
  details: "",
  vlan: "",
  pop: "",
};

function formatBangladeshDate(value: string) {
  return new Intl.DateTimeFormat("en-BD", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
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

function parseFilterDate(value: string, endOfMinute = false) {
  if (!value) return undefined;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return undefined;
  return endOfMinute ? timestamp + 59_999 : timestamp;
}

function Icon({ name }: { name: "plus" | "search" | "arrow" | "chevron" | "close" | "pulse" | "inbox" | "clock" | "tag" | "edit" | "trash" | "user" | "logout" | "whatsapp" | "telephone" }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === "chevron") return <svg {...common}><path d="m8 10 4 4 4-4" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "pulse") return <svg {...common}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>;
  if (name === "inbox") return <svg {...common}><path d="M4 5h16v14H4z" /><path d="M4 14h4l2 2h4l2-2h4" /></svg>;
  if (name === "tag") return <svg {...common}><path d="M20 13 13 20l-9-9V4h7l9 9Z" /><path d="M8 8h.01" /></svg>;
  if (name === "edit") return <svg {...common}><path d="m4 16-.7 4.7L8 20l11.5-11.5a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m14.5 6.5 3 3" /></svg>;
  if (name === "trash") return <svg {...common}><path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3" /><path d="M5 20c.7-3.1 3-5 7-5s6.3 1.9 7 5" /></svg>;
  if (name === "logout") return <svg {...common}><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></svg>;
  if (name === "whatsapp") return <svg {...common}><path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.1A8 8 0 1 1 20 11.5Z" /><path d="M8.6 8.2c.2-.3.5-.3.8-.2l1.1.6c.3.2.4.5.2.8l-.5.7c.6 1.1 1.5 2 2.6 2.6l.7-.5c.3-.2.6-.1.8.2l.6 1.1c.2.3.1.6-.2.8-.5.4-1.1.6-1.7.4-2.1-.6-4.2-2.8-4.8-4.8-.2-.6 0-1.2.4-1.7Z" /></svg>;
  if (name === "telephone") return <svg {...common}><path d="M6.8 3.5 9.5 3l1.6 4-1.9 1.5a14 14 0 0 0 6.3 6.3l1.5-1.9 4 1.6-.5 2.7c-.2 1-1.1 1.7-2.1 1.6C10.8 18.2 5.8 13.2 5.2 5.6c-.1-1 .6-1.9 1.6-2.1Z" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>;
}

export default function ComplaintDashboard({ user }: { user: AuthUser }) {
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [complaintTypes, setComplaintTypes] = useState<ComplaintType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingComplaintId, setDeletingComplaintId] = useState<number | null>(null);
  const [isSavingType, setIsSavingType] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<number | null>(null);
  const [form, setForm] = useState<ComplaintForm>(emptyForm);
  const [editingComplaintId, setEditingComplaintId] = useState<number | null>(null);
  const [newTypeName, setNewTypeName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [typeError, setTypeError] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ComplaintStatus>("all");
  const [complaintTypeFilter, setComplaintTypeFilter] = useState("all");
  const [entryByFilter, setEntryByFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);

  const handleLogout = async () => {
    setIsAccountMenuOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  };

  useEffect(() => {
    apiFetch("/api/complaints")
      .then((response) => response.json())
      .then((payload: { complaints: ComplaintRow[] }) => setComplaints(payload.complaints))
      .catch(() => setError("Could not load complaint notes."))
      .finally(() => setIsLoading(false));

    apiFetch("/api/complaint-types")
      .then((response) => response.json())
      .then((payload: { complaintTypes: ComplaintType[] }) => setComplaintTypes(payload.complaintTypes))
      .catch(() => setTypeError("Could not load complaint types."));
  }, []);

  const handleEditComplaint = (complaint: ComplaintRow) => {
    setError("");
    setEditingComplaintId(complaint.id);
    setForm({
      userId: complaint.userId,
      phoneNumber: complaint.phoneNumber,
      whatsappNumber: complaint.whatsappNumber,
      complaintType: complaint.complaintType,
      status: complaint.status,
      details: complaint.details,
      vlan: complaint.vlan,
      pop: complaint.pop,
    });
    setIsModalOpen(true);
  };

  const handleDeleteComplaint = async (complaint: ComplaintRow) => {
    if (!window.confirm(`Delete the complaint for ${complaint.userId}? This cannot be undone.`)) return;
    setError("");
    setDeletingComplaintId(complaint.id);
    try {
      const response = await apiFetch(`/api/complaints/${complaint.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to delete complaint.");
      setComplaints((current) => current.filter((currentComplaint) => currentComplaint.id !== complaint.id));
      if (editingComplaintId === complaint.id) {
        setEditingComplaintId(null);
        setForm(emptyForm);
        setIsModalOpen(false);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete complaint.");
    } finally {
      setDeletingComplaintId(null);
    }
  };

  const entryByOptions = useMemo(() => Array.from(new Set(complaints.map((complaint) => complaint.entryBy).filter(Boolean))).sort((first, second) => first.localeCompare(second)), [complaints]);
  const complaintTypeOptions = useMemo(() => Array.from(new Set([...complaintTypes.map((type) => type.name), ...complaints.map((complaint) => complaint.complaintType).filter(Boolean)])).sort((first, second) => first.localeCompare(second)), [complaintTypes, complaints]);
  const filteredComplaints = useMemo(() => {
    const fromTime = parseFilterDate(dateFrom);
    const toTime = parseFilterDate(dateTo, true);

    return complaints.filter((complaint) => {
      const createdTime = new Date(complaint.createdAt).getTime();
      return (statusFilter === "all" || complaint.status === statusFilter)
        && (complaintTypeFilter === "all" || complaint.complaintType === complaintTypeFilter)
        && (entryByFilter === "all" || complaint.entryBy === entryByFilter)
        && (fromTime === undefined || createdTime >= fromTime)
        && (toTime === undefined || createdTime <= toTime);
    });
  }, [complaints, complaintTypeFilter, dateFrom, dateTo, entryByFilter, statusFilter]);
  const hasActiveFilters = statusFilter !== "all" || complaintTypeFilter !== "all" || entryByFilter !== "all" || Boolean(dateFrom) || Boolean(dateTo);

  const clearFilters = () => {
    setStatusFilter("all");
    setComplaintTypeFilter("all");
    setEntryByFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  const columns = useMemo<ColumnDef<ComplaintRow>[]>(() => [
    {
      accessorKey: "userId",
      header: "User ID",
      cell: ({ getValue }) => <span className="user-id">{String(getValue())}</span>,
    },
    {
      accessorKey: "entryBy",
      header: "Entry by",
      cell: ({ getValue }) => <span className="entry-by-cell">{String(getValue())}</span>,
    },
    {
      accessorKey: "phoneNumber",
      header: "Phone number",
      cell: ({ getValue }) => {
        const phoneNumber = String(getValue());
        const dialNumber = toDialNumber(phoneNumber);
        const whatsappNumber = toWhatsAppNumber(phoneNumber);
        return <span className="contact-cell"><span className="muted-cell">{phoneNumber}</span><span className="contact-actions"><a className="contact-action-button telephone" href={`tel:${dialNumber}`} aria-label={`Call ${phoneNumber}`} title="Call phone number"><Icon name="telephone" /></a></span></span>;
      },
    },
    {
      accessorKey: "whatsappNumber",
      header: "WhatsApp number",
      cell: ({ getValue }) => {
        const whatsappNumber = String(getValue());
        const internationalNumber = toWhatsAppNumber(whatsappNumber);
        return <span className="contact-cell"><span className="muted-cell">{whatsappNumber || "—"}</span>{whatsappNumber && <span className="contact-actions"><a className="contact-action-button whatsapp" href={`https://wa.me/${internationalNumber}`} target="_blank" rel="noreferrer" aria-label={`Send WhatsApp message to ${whatsappNumber}`} title="Send WhatsApp message"><Icon name="whatsapp" /></a></span>}</span>;
      },
    },
    {
      accessorKey: "complaintType",
      header: "Complaint type",
      cell: ({ getValue }) => <span className="type-pill">{String(getValue())}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => {
        const status = String(getValue()) as ComplaintStatus;
        return <span className={`status-pill ${status}`}>{status === "completed" ? "Completed" : "Pending"}</span>;
      },
    },
    {
      accessorKey: "createdAt",
      header: "Date (BD)",
      cell: ({ getValue }) => <span className="date-cell">{formatBangladeshDate(String(getValue()))}</span>,
    },
    {
      accessorKey: "details",
      header: "Details text",
      cell: ({ getValue }) => <span className="details-cell">{String(getValue())}</span>,
    },
    {
      accessorKey: "vlan",
      header: "VLAN",
      cell: ({ getValue }) => <span className="mono-cell">{String(getValue()) || "—"}</span>,
    },
    {
      accessorKey: "pop",
      header: "POP",
      cell: ({ getValue }) => <span className="pop-cell">{String(getValue()) ? <><span className="status-dot" />{String(getValue())}</> : "—"}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => <div className="complaint-actions"><button type="button" className="type-action-button" onClick={() => handleEditComplaint(row.original)} aria-label={`Edit complaint ${row.original.userId}`}><Icon name="edit" /></button><button type="button" className="type-action-button danger" onClick={() => handleDeleteComplaint(row.original)} disabled={deletingComplaintId === row.original.id} aria-label={`Delete complaint ${row.original.userId}`}><Icon name="trash" /></button></div>,
    },
  ], [deletingComplaintId, editingComplaintId]);

  const table = useReactTable({
    data: filteredComplaints,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 6 } },
  });

  const openCreateComplaint = () => {
    setError("");
    setEditingComplaintId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);
    const isEditing = editingComplaintId !== null;
    try {
      const response = await apiFetch(isEditing ? `/api/complaints/${editingComplaintId}` : "/api/complaints", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Unable to ${isEditing ? "update" : "save"} complaint.`);
      setComplaints((current) => isEditing ? current.map((complaint) => complaint.id === editingComplaintId ? payload.complaint : complaint) : [payload.complaint, ...current]);
      setForm(emptyForm);
      setEditingComplaintId(null);
      setIsModalOpen(false);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to save complaint.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTypeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTypeError("");
    setIsSavingType(true);
    const editedType = editingTypeId ? complaintTypes.find((type) => type.id === editingTypeId) : undefined;
    try {
      const response = await apiFetch(editingTypeId ? `/api/complaint-types/${editingTypeId}` : "/api/complaint-types", {
        method: editingTypeId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTypeName }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Unable to ${editingTypeId ? "update" : "save"} complaint type.`);
      setComplaintTypes((current) => editingTypeId ? current.map((type) => type.id === editingTypeId ? payload.complaintType : type) : [...current, payload.complaintType]);
      if (editedType) {
        setComplaints((current) => current.map((complaint) => complaint.complaintType === editedType.name ? { ...complaint, complaintType: payload.complaintType.name } : complaint));
        setForm((current) => current.complaintType === editedType.name ? { ...current, complaintType: payload.complaintType.name } : current);
      } else {
        setForm((current) => ({ ...current, complaintType: payload.complaintType.name }));
      }
      setNewTypeName("");
      setEditingTypeId(null);
      setIsTypeModalOpen(false);
    } catch (submissionError) {
      setTypeError(submissionError instanceof Error ? submissionError.message : "Unable to save complaint type.");
    } finally {
      setIsSavingType(false);
    }
  };

  const handleEditType = (type: ComplaintType) => {
    setTypeError("");
    setEditingTypeId(type.id);
    setNewTypeName(type.name);
    setIsTypeModalOpen(true);
  };

  const handleDeleteType = async (type: ComplaintType) => {
    if (!window.confirm(`Delete “${type.name}”? Existing complaint notes will be kept.`)) return;
    setTypeError("");
    setDeletingTypeId(type.id);
    try {
      const response = await apiFetch(`/api/complaint-types/${type.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to delete complaint type.");
      setComplaintTypes((current) => current.filter((currentType) => currentType.id !== type.id));
      setForm((current) => current.complaintType === type.name ? { ...current, complaintType: "" } : current);
      if (editingTypeId === type.id) {
        setEditingTypeId(null);
        setNewTypeName("");
      }
    } catch (deleteError) {
      setTypeError(deleteError instanceof Error ? deleteError.message : "Unable to delete complaint type.");
    } finally {
      setDeletingTypeId(null);
    }
  };

  const total = complaints.length;
  const pendingCount = complaints.filter((complaint) => complaint.status === "pending").length;
  const todayCount = complaints.filter((complaint) => new Date(complaint.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" })).length;

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="dashboard">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark"><Icon name="pulse" /></div>
            <div>
              <p className="eyebrow">Operations console</p>
              <h1>PulseDesk</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="live-indicator"><span className="live-dot" />System live</span>
            <span className="user-email">{user.email}</span>
            <div className="account-menu-wrap">
              <button className="avatar avatar-button" aria-label="Open account menu" aria-haspopup="menu" aria-expanded={isAccountMenuOpen} onClick={() => setIsAccountMenuOpen((current) => !current)}>{user.email.slice(0, 2).toUpperCase()}</button>
              {isAccountMenuOpen && <div className="account-menu" role="menu"><a className="account-menu-item" role="menuitem" href="/profile" onClick={() => setIsAccountMenuOpen(false)}><Icon name="user" /><span>Profile</span></a><button className="account-menu-item danger" role="menuitem" onClick={handleLogout}><Icon name="logout" /><span>Logout</span></button></div>}
            </div>
          </div>
        </header>

        <div className="hero-row">
          <div>
            <p className="eyebrow gradient-eyebrow">Customer care / Network</p>
            <h2>Complaint notes</h2>
            <p className="hero-copy">Keep every customer signal close to the network context that matters.</p>
          </div>
          <div className="hero-actions">
            <button className="secondary-button hero-secondary" onClick={() => { setTypeError(""); setEditingTypeId(null); setNewTypeName(""); setIsTypeModalOpen(true); }}><Icon name="tag" /> Complaint types</button>
            <button className="primary-button" onClick={openCreateComplaint}><Icon name="plus" /> Add complaint <Icon name="arrow" /></button>
          </div>
        </div>

        <section className="metrics-grid" aria-label="Complaint summary">
          <article className="metric-card featured-card">
            <div className="metric-icon"><Icon name="inbox" /></div>
            <div><p className="metric-label">Total notes</p><p className="metric-value">{total}</p></div>
            <span className="metric-trend">+12.5% <span>this week</span></span>
          </article>
          <article className="metric-card">
            <div className="metric-icon amber"><Icon name="clock" /></div>
            <div><p className="metric-label">Logged today</p><p className="metric-value">{todayCount}</p></div>
            <span className="metric-caption">BD standard time</span>
          </article>
          <article className="metric-card">
            <div className="metric-icon violet"><Icon name="pulse" /></div>
            <div><p className="metric-label">Pending signals</p><p className="metric-value">{pendingCount}</p></div>
            <span className="metric-caption">Needs attention</span>
          </article>
        </section>

        <section className="workspace-card">
           <div className="table-toolbar">
             <div className="table-toolbar-head">
             <div>
               <div className="section-title-row"><h3>All complaint notes</h3><span className="count-badge">{total}</span></div>
               <p className="section-copy">Sort, search, and scan the latest customer-reported issues.</p>
             </div>
             <label className="search-box">
              <Icon name="search" />
              <input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Search notes..." aria-label="Search complaints" />
               <kbd>⌘ K</kbd>
             </label>
             </div>
             <div className="table-filters" aria-label="Complaint filters">
               <label className="filter-field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | ComplaintStatus)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="completed">Completed</option></select></label>
               <label className="filter-field"><span>Complaint type</span><select value={complaintTypeFilter} onChange={(event) => setComplaintTypeFilter(event.target.value)}><option value="all">All types</option>{complaintTypeOptions.map((complaintType) => <option key={complaintType} value={complaintType}>{complaintType}</option>)}</select></label>
               <label className="filter-field"><span>Entry by</span><select value={entryByFilter} onChange={(event) => setEntryByFilter(event.target.value)}><option value="all">All users</option>{entryByOptions.map((entryBy) => <option key={entryBy} value={entryBy}>{entryBy}</option>)}</select></label>
               <label className="filter-field"><span>From</span><input type="datetime-local" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Filter from date and time" /></label>
               <label className="filter-field"><span>To</span><input type="datetime-local" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Filter to date and time" /></label>
               <button type="button" className="clear-filters" onClick={clearFilters} disabled={!hasActiveFilters}>Clear filters</button>
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
                 {isLoading ? <tr><td colSpan={11} className="empty-state">Loading complaint notes…</td></tr> : table.getRowModel().rows.length === 0 ? <tr><td colSpan={11} className="empty-state">No complaint notes match your search.</td></tr> : table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <span>Showing <strong>{table.getRowModel().rows.length}</strong> of <strong>{table.getFilteredRowModel().rows.length}</strong> matching notes</span>
            <div className="pagination">
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</button>
              <span>Page <strong>{table.getState().pagination.pageIndex + 1}</strong> / {table.getPageCount() || 1}</span>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next <Icon name="arrow" /></button>
            </div>
          </div>
        </section>
        <p className="footer-note"><span className="shield-mark">✦</span> Local-first workspace · Data stays on this device</p>
      </section>

      {isModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setIsModalOpen(false); }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-header"><div><p className="eyebrow gradient-eyebrow">{editingComplaintId ? "Update record" : "New record"}</p><h3 id="modal-title">{editingComplaintId ? "Edit complaint note" : "Add complaint note"}</h3><p>{editingComplaintId ? "Refresh the customer and network details." : "Capture the issue while the context is fresh."}</p></div><button className="icon-button" onClick={() => { setEditingComplaintId(null); setForm(emptyForm); setIsModalOpen(false); }} aria-label="Close modal"><Icon name="close" /></button></div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
               <label>User ID<input required value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} placeholder="CUS-10482" /></label>
               <label>Phone number<input required value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="01711 456 220" /></label>
               <label>WhatsApp number <span className="optional-label">(optional)</span><input value={form.whatsappNumber} onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })} placeholder="01711 456 220" /></label>
              <label>Complaint type<select required value={form.complaintType} onChange={(event) => setForm({ ...form, complaintType: event.target.value })}><option value="">{complaintTypes.length ? "Select a type" : "Loading types…"}</option>{complaintTypes.map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}</select></label>
              <label>Status<select required value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ComplaintStatus })}><option value="pending">Pending</option><option value="completed">Completed</option></select></label>
               <label>VLAN <span className="optional-label">(optional)</span><input value={form.vlan} onChange={(event) => setForm({ ...form, vlan: event.target.value })} placeholder="VLAN-210" /></label>
               <label>POP <span className="optional-label">(optional)</span><input value={form.pop} onChange={(event) => setForm({ ...form, pop: event.target.value })} placeholder="Gulshan-2" /></label>
              <label className="wide-field">Details text<textarea required rows={4} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="Describe the customer’s issue, symptoms, and any troubleshooting already done..." /></label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setEditingComplaintId(null); setForm(emptyForm); setIsModalOpen(false); }}>Cancel</button><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : editingComplaintId ? "Save changes" : "Save complaint"} <Icon name="arrow" /></button></div>
          </form>
        </section>
      </div>}

      {isTypeModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setIsTypeModalOpen(false); }}>
        <section className="modal-card type-modal-card" role="dialog" aria-modal="true" aria-labelledby="type-modal-title">
          <div className="modal-header"><div><p className="eyebrow gradient-eyebrow">Complaint setup</p><h3 id="type-modal-title">{editingTypeId ? "Edit complaint type" : "Add complaint type"}</h3><p>{editingTypeId ? "Rename this type wherever it appears in your workspace." : "Create a reusable type for the complaint form."}</p></div><button className="icon-button" onClick={() => { setEditingTypeId(null); setNewTypeName(""); setIsTypeModalOpen(false); }} aria-label="Close complaint type modal"><Icon name="close" /></button></div>
          <form onSubmit={handleTypeSubmit}>
            <label className="type-input-label">Complaint type name<input required autoFocus maxLength={60} value={newTypeName} onChange={(event) => setNewTypeName(event.target.value)} placeholder="Example: Fiber cut" /></label>
            {typeError && <p className="form-error">{typeError}</p>}
            <div className="type-list-heading"><span>Available types</span><span>{complaintTypes.length}</span></div>
            <div className="type-list">{complaintTypes.map((type) => <div className="type-list-item" key={type.id}><span className="type-list-name"><Icon name="tag" />{type.name}</span><span className="type-list-actions"><button type="button" className="type-action-button" onClick={() => handleEditType(type)} aria-label={`Edit ${type.name}`}><Icon name="edit" /></button><button type="button" className="type-action-button danger" onClick={() => handleDeleteType(type)} disabled={deletingTypeId === type.id} aria-label={`Delete ${type.name}`}><Icon name="trash" /></button></span></div>)}</div>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setEditingTypeId(null); setNewTypeName(""); setIsTypeModalOpen(false); }}>Cancel</button><button className="primary-button" type="submit" disabled={isSavingType}>{isSavingType ? "Saving…" : editingTypeId ? "Save changes" : "Add type"} <Icon name={editingTypeId ? "edit" : "plus"} /></button></div>
          </form>
        </section>
      </div>}

    </main>
  );
}
