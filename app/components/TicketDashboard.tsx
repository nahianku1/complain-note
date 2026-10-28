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
import type { AuthUser, TicketRow, TicketType, TicketStatus, TeamWithMembers, TechnicianRow } from "../../lib/db";
import { apiFetch } from "../../lib/api-client";

type TicketForm = Omit<TicketRow, "id" | "createdAt" | "entryBy">;

const emptyForm: TicketForm = {
  userId: "",
  phoneNumber: "",
  whatsappNumber: "",
  address: "",
  ticketType: "",
  status: "pending",
  details: "",
  vlan: "",
  pop: "",
  assignedTo: "",
  assignedType: "",
  assignedId: null,
  completedBy: "",
  completedDate: "",
  closedBy: "",
  closedDate: "",
  cancelledBy: "",
  cancelledDate: "",
};

function formatBangladeshDate(value: string) {
  if (!value) return "—";
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

function parseFilterDate(value: string, endOfDay = false) {
  if (!value) return undefined;
  const time = endOfDay ? "23:59:59.999" : "00:00:00";
  const timestamp = new Date(`${value}T${time}+06:00`).getTime();
  if (Number.isNaN(timestamp)) return undefined;
  return timestamp;
}

function Icon({ name }: { name: "plus" | "search" | "arrow" | "chevron" | "close" | "pulse" | "inbox" | "clock" | "check" | "tag" | "edit" | "trash" | "copy" | "user" | "users" | "logout" | "whatsapp" | "telephone" }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "search") return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
  if (name === "chevron") return <svg {...common}><path d="m8 10 4 4 4-4" /></svg>;
  if (name === "close") return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === "pulse") return <svg {...common}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>;
  if (name === "inbox") return <svg {...common}><path d="M4 5h16v14H4z" /><path d="M4 14h4l2 2h4l2-2h4" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 13 4 4L19 7" /></svg>;
  if (name === "tag") return <svg {...common}><path d="M20 13 13 20l-9-9V4h7l9 9Z" /><path d="M8 8h.01" /></svg>;
  if (name === "edit") return <svg {...common}><path d="m4 16-.7 4.7L8 20l11.5-11.5a2.1 2.1 0 0 0-3-3L5 17Z" /><path d="m14.5 6.5 3 3" /></svg>;
  if (name === "trash") return <svg {...common}><path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
  if (name === "copy") return <svg {...common}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></svg>;
  if (name === "user") return <svg {...common}><circle cx="12" cy="8" r="3" /><path d="M5 20c.7-3.1 3-5 7-5s6.3 1.9 7 5" /></svg>;
  if (name === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (name === "logout") return <svg {...common}><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></svg>;
  if (name === "whatsapp") return <svg {...common}><path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.1A8 8 0 1 1 20 11.5Z" /><path d="M8.6 8.2c.2-.3.5-.3.8-.2l1.1.6c.3.2.4.5.2.8l-.5.7c.6 1.1 1.5 2 2.6 2.6l.7-.5c.3-.2.6-.1.8.2l.6 1.1c.2.3.1.6-.2.8-.5.4-1.1.6-1.7.4-2.1-.6-4.2-2.8-4.8-4.8-.2-.6 0-1.2.4-1.7Z" /></svg>;
  if (name === "telephone") return <svg {...common}><path d="M6.8 3.5 9.5 3l1.6 4-1.9 1.5a14 14 0 0 0 6.3 6.3l1.5-1.9 4 1.6-.5 2.7c-.2 1-1.1 1.7-2.1 1.6C10.8 18.2 5.8 13.2 5.2 5.6c-.1-1 .6-1.9 1.6-2.1Z" /></svg>;
  return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>;
}

function MemberBadge({
  name,
  mobile1,
  mobile2,
  whatsappNumber,
}: {
  name: string;
  mobile1?: string;
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
      title={`${name} (M1: ${mobile1 || "—"}${mobile2 ? `, M2: ${mobile2}` : ""}${whatsappNumber ? `, WA: ${whatsappNumber}` : ""})`}
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

export default function TicketDashboard({ user }: { user: AuthUser }) {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTicketId, setDeletingTicketId] = useState<number | null>(null);
  const [duplicatingTicketId, setDuplicatingTicketId] = useState<number | null>(null);
  const [form, setForm] = useState<TicketForm>(emptyForm);
  const [editingTicketId, setEditingTicketId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [typeError, setTypeError] = useState("");
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [ticketTypeFilter, setTicketTypeFilter] = useState("all");
  const [entryByFilter, setEntryByFilter] = useState("all");
  const [completedByFilter, setCompletedByFilter] = useState("all");
  const [cancelledByFilter, setCancelledByFilter] = useState("all");
  const [closedByFilter, setClosedByFilter] = useState("all");
  const [vlanFilter, setVlanFilter] = useState("all");
  const [popFilter, setPopFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);

  const handleLogout = async () => {
    setIsAccountMenuOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  };

  useEffect(() => {
    apiFetch("/api/tickets")
      .then((response) => response.json())
      .then((payload: { tickets: TicketRow[] }) => setTickets(payload.tickets))
      .catch(() => setError("Could not load tickets."))
      .finally(() => setIsLoading(false));

    apiFetch("/api/ticket-types")
      .then((response) => response.json())
      .then((payload: { ticketTypes: TicketType[] }) => setTicketTypes(payload.ticketTypes))
      .catch(() => setTypeError("Could not load ticket types."));

    apiFetch("/api/teams")
      .then((response) => response.json())
      .then((payload: { teams?: TeamWithMembers[] }) => {
        if (payload.teams) setTeams(payload.teams);
      })
      .catch(() => {});

    apiFetch("/api/technicians")
      .then((response) => response.json())
      .then((payload: { technicians?: TechnicianRow[] }) => {
        if (payload.technicians) setTechnicians(payload.technicians);
      })
      .catch(() => {});
  }, []);

  const handleEditTicket = (ticket: TicketRow) => {
    setError("");
    setEditingTicketId(ticket.id);
    setForm({
      userId: ticket.userId,
      phoneNumber: ticket.phoneNumber,
      whatsappNumber: ticket.whatsappNumber,
      address: ticket.address ?? "",
      ticketType: ticket.ticketType,
      status: ticket.status,
      details: ticket.details,
      vlan: ticket.vlan,
      pop: ticket.pop,
      assignedTo: ticket.assignedTo || "",
      assignedType: ticket.assignedType || "",
      assignedId: ticket.assignedId ?? null,
      completedBy: ticket.completedBy || "",
      completedDate: ticket.completedDate || "",
      closedBy: ticket.closedBy || "",
      closedDate: ticket.closedDate || "",
      cancelledBy: ticket.cancelledBy || "",
      cancelledDate: ticket.cancelledDate || "",
    });
    setIsModalOpen(true);
  };

  const handleDeleteTicket = async (ticket: TicketRow) => {
    if (!window.confirm(`Delete the ticket for ${ticket.userId}? This cannot be undone.`)) return;
    setError("");
    setDeletingTicketId(ticket.id);
    try {
      const response = await apiFetch(`/api/tickets/${ticket.id}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to delete ticket.");
      setTickets((current) => current.filter((currentTicket) => currentTicket.id !== ticket.id));
      if (editingTicketId === ticket.id) {
        setEditingTicketId(null);
        setForm(emptyForm);
        setIsModalOpen(false);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete ticket.");
    } finally {
      setDeletingTicketId(null);
    }
  };

  const handleDuplicateTicket = async (ticket: TicketRow) => {
    setError("");
    setDuplicatingTicketId(ticket.id);
    try {
      const response = await apiFetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: ticket.userId,
          phoneNumber: ticket.phoneNumber,
          whatsappNumber: ticket.whatsappNumber,
          address: ticket.address,
          ticketType: ticket.ticketType,
          status: ticket.status,
          details: ticket.details,
          vlan: ticket.vlan,
          pop: ticket.pop,
          assignedTo: ticket.assignedTo,
          assignedType: ticket.assignedType,
          assignedId: ticket.assignedId,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to duplicate ticket.");
      setTickets((current) => [payload.ticket, ...current]);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Unable to duplicate ticket.");
    } finally {
      setDuplicatingTicketId(null);
    }
  };

  const entryByOptions = useMemo(() => Array.from(new Set(tickets.map((ticket) => ticket.entryBy).filter(Boolean))).sort((first, second) => first.localeCompare(second)), [tickets]);
  const completedByOptions = useMemo(() => Array.from(new Set(tickets.map((ticket) => ticket.completedBy).filter(Boolean))).sort((first, second) => first.localeCompare(second)), [tickets]);
  const cancelledByOptions = useMemo(() => Array.from(new Set(tickets.map((ticket) => ticket.cancelledBy).filter(Boolean))).sort((first, second) => first.localeCompare(second)), [tickets]);
  const closedByOptions = useMemo(() => Array.from(new Set(tickets.map((ticket) => ticket.closedBy).filter(Boolean))).sort((first, second) => first.localeCompare(second)), [tickets]);
  const ticketTypeOptions = useMemo(() => Array.from(new Set([...ticketTypes.map((type) => type.name), ...tickets.map((ticket) => ticket.ticketType).filter(Boolean)])).sort((first, second) => first.localeCompare(second)), [ticketTypes, tickets]);
  const vlanOptions = useMemo(() => Array.from(new Set(tickets.map((ticket) => ticket.vlan.trim()).filter(Boolean))).sort((first, second) => first.localeCompare(second, undefined, { numeric: true })), [tickets]);
  const popOptions = useMemo(() => Array.from(new Set(tickets.map((ticket) => ticket.pop.trim()).filter(Boolean))).sort((first, second) => first.localeCompare(second)), [tickets]);
  const filteredTickets = useMemo(() => {
    const fromTime = parseFilterDate(dateFrom);
    const toTime = parseFilterDate(dateTo, true);

    return tickets.filter((ticket) => {
      const createdTime = new Date(ticket.createdAt).getTime();
      return (statusFilter === "all" || ticket.status === statusFilter)
        && (ticketTypeFilter === "all" || ticket.ticketType === ticketTypeFilter)
        && (entryByFilter === "all" || ticket.entryBy === entryByFilter)
        && (completedByFilter === "all" || ticket.completedBy === completedByFilter)
        && (cancelledByFilter === "all" || ticket.cancelledBy === cancelledByFilter)
        && (closedByFilter === "all" || ticket.closedBy === closedByFilter)
        && (vlanFilter === "all" || ticket.vlan.trim() === vlanFilter)
        && (popFilter === "all" || ticket.pop.trim() === popFilter)
        && (
          assignedFilter === "all"
            ? true
            : assignedFilter === "unassigned"
              ? !ticket.assignedTo
              : ticket.assignedTo === assignedFilter
        )
        && (fromTime === undefined || createdTime >= fromTime)
        && (toTime === undefined || createdTime <= toTime);
    });
  }, [tickets, ticketTypeFilter, dateFrom, dateTo, entryByFilter, completedByFilter, cancelledByFilter, closedByFilter, vlanFilter, popFilter, statusFilter, assignedFilter]);
  const hasActiveFilters = statusFilter !== "all" || ticketTypeFilter !== "all" || entryByFilter !== "all" || completedByFilter !== "all" || cancelledByFilter !== "all" || closedByFilter !== "all" || vlanFilter !== "all" || popFilter !== "all" || assignedFilter !== "all" || Boolean(dateFrom) || Boolean(dateTo);

  const clearFilters = () => {
    setStatusFilter("all");
    setTicketTypeFilter("all");
    setEntryByFilter("all");
    setCompletedByFilter("all");
    setCancelledByFilter("all");
    setClosedByFilter("all");
    setVlanFilter("all");
    setPopFilter("all");
    setAssignedFilter("all");
    setDateFrom("");
    setDateTo("");
    setGlobalFilter("");
  };

  const technicianMap = useMemo(() => {
    const map = new Map<number, TechnicianRow>();
    for (const tech of technicians) map.set(tech.id, tech);
    return map;
  }, [technicians]);

  const teamMap = useMemo(() => {
    const map = new Map<number, TeamWithMembers>();
    for (const team of teams) map.set(team.id, team);
    return map;
  }, [teams]);

  const techByName = useMemo(() => {
    const map = new Map<string, TechnicianRow>();
    for (const tech of technicians) map.set(tech.name.toLowerCase().trim(), tech);
    return map;
  }, [technicians]);

  const teamByName = useMemo(() => {
    const map = new Map<string, TeamWithMembers>();
    for (const team of teams) map.set(team.name.toLowerCase().trim(), team);
    return map;
  }, [teams]);

  const columns = useMemo<ColumnDef<TicketRow>[]>(() => [
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
      accessorKey: "address",
      header: "Address",
      cell: ({ getValue }) => <span className="address-cell">{String(getValue()) || "—"}</span>,
    },
    {
      accessorKey: "ticketType",
      header: "Ticket type",
      cell: ({ getValue }) => <span className="type-pill">{String(getValue())}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ getValue }) => {
        const status = String(getValue()) as TicketStatus;
        const statusLabels: Record<TicketStatus, string> = {
          pending: "Pending",
          running: "Running",
          completed: "Completed",
          cancelled: "Cancelled",
          closed: "Closed",
        };
        return <span className={`status-pill ${status}`}>{statusLabels[status]}</span>;
      },
    },
    {
      accessorKey: "assignedTo",
      header: "Assigned to",
      cell: ({ row }) => {
        const { assignedTo, assignedType, assignedId } = row.original;
        if (!assignedTo) return <span className="muted-cell">Unassigned</span>;

        const isTech = assignedType === "technician" || (!assignedType && techByName.has(assignedTo.toLowerCase().trim()));
        const isTeam = assignedType === "team" || (!assignedType && teamByName.has(assignedTo.toLowerCase().trim()));

        if (isTech) {
          const tech = (assignedId ? technicianMap.get(assignedId) : null) || techByName.get(assignedTo.toLowerCase().trim());
          return (
            <div className="team-members-cell">
              <MemberBadge
                name={tech ? tech.name : assignedTo}
                mobile1={tech?.mobile1}
                mobile2={tech?.mobile2}
                whatsappNumber={tech?.whatsappNumber}
              />
            </div>
          );
        }

        if (isTeam) {
          const team = (assignedId ? teamMap.get(assignedId) : null) || teamByName.get(assignedTo.toLowerCase().trim());
          return (
            <div className="team-assignment-cell">
              <span className="assigned-badge team" title={assignedTo}>
                <Icon name="users" />
                <span>{assignedTo}</span>
              </span>
              {team && team.members && team.members.length > 0 && (
                <div className="team-members-cell">
                  {team.members.map((member) => (
                    <MemberBadge
                      key={member.technicianId}
                      name={member.technicianName}
                      mobile1={member.mobile1}
                      mobile2={member.mobile2}
                      whatsappNumber={member.whatsappNumber}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <div className="team-members-cell">
            <span className="team-member-badge" title={assignedTo}>
              <span className="team-member-avatar">
                {assignedTo.slice(0, 2).toUpperCase()}
              </span>
              <span className="team-member-name">{assignedTo}</span>
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "completedBy",
      header: "Completed by",
      cell: ({ getValue }) => {
        const val = String(getValue() || "");
        return val ? <span className="entry-by-cell">{val}</span> : <span className="muted-cell">—</span>;
      },
    },
    {
      accessorKey: "completedDate",
      header: "Completed date",
      cell: ({ getValue }) => {
        const val = String(getValue() || "");
        return val ? <span className="date-cell">{formatBangladeshDate(val)}</span> : <span className="muted-cell">—</span>;
      },
    },
    {
      accessorKey: "cancelledBy",
      header: "Cancelled by",
      cell: ({ getValue }) => {
        const val = String(getValue() || "");
        return val ? <span className="entry-by-cell">{val}</span> : <span className="muted-cell">—</span>;
      },
    },
    {
      accessorKey: "cancelledDate",
      header: "Cancelled time",
      cell: ({ getValue }) => {
        const val = String(getValue() || "");
        return val ? <span className="date-cell">{formatBangladeshDate(val)}</span> : <span className="muted-cell">—</span>;
      },
    },
    {
      accessorKey: "closedBy",
      header: "Closed by",
      cell: ({ getValue }) => {
        const val = String(getValue() || "");
        return val ? <span className="entry-by-cell">{val}</span> : <span className="muted-cell">—</span>;
      },
    },
    {
      accessorKey: "closedDate",
      header: "Closed date",
      cell: ({ getValue }) => {
        const val = String(getValue() || "");
        return val ? <span className="date-cell">{formatBangladeshDate(val)}</span> : <span className="muted-cell">—</span>;
      },
    },
    {
      accessorKey: "createdAt",
      header: "Creation date",
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
      cell: ({ row }) => <div className="ticket-actions"><button type="button" className="type-action-button" onClick={() => handleEditTicket(row.original)} aria-label={`Edit ticket ${row.original.userId}`} title="Edit ticket"><Icon name="edit" /></button><button type="button" className="type-action-button" onClick={() => handleDuplicateTicket(row.original)} disabled={duplicatingTicketId === row.original.id} aria-label={`Duplicate ticket ${row.original.userId}`} title="Duplicate ticket"><Icon name="copy" /></button><button type="button" className="type-action-button danger" onClick={() => handleDeleteTicket(row.original)} disabled={deletingTicketId === row.original.id} aria-label={`Delete ticket ${row.original.userId}`} title="Delete ticket"><Icon name="trash" /></button></div>,
    },
  ], [deletingTicketId, duplicatingTicketId, editingTicketId, technicianMap, teamMap, techByName, teamByName]);

  const table = useReactTable({
    data: filteredTickets,
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

  const openCreateTicket = () => {
    setError("");
    setEditingTicketId(null);
    setForm(emptyForm);
    setIsModalOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if ((form.assignedType === "technician" || form.assignedType === "tech") && !form.address?.trim()) {
      setError("Address is required when assigning to a technician.");
      return;
    }
    setIsSaving(true);
    const isEditing = editingTicketId !== null;
    try {
      const response = await apiFetch(isEditing ? `/api/tickets/${editingTicketId}` : "/api/tickets", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Unable to ${isEditing ? "update" : "save"} ticket.`);
      setTickets((current) => isEditing ? current.map((ticket) => ticket.id === editingTicketId ? payload.ticket : ticket) : [payload.ticket, ...current]);
      setForm(emptyForm);
      setEditingTicketId(null);
      setIsModalOpen(false);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to save ticket.");
    } finally {
      setIsSaving(false);
    }
  };

  const total = tickets.length;
  const pendingCount = tickets.filter((ticket) => ticket.status === "pending").length;
  const completedCount = tickets.filter((ticket) => ticket.status === "completed").length;
  const cancelledCount = tickets.filter((ticket) => ticket.status === "cancelled").length;
  const closedCount = tickets.filter((ticket) => ticket.status === "closed").length;
  const todayCount = tickets.filter((ticket) => new Date(ticket.createdAt).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" }) === new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" })).length;

  // Dynamic week-over-week trend (Asia/Dhaka timezone)
  const weekTrend = useMemo(() => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0 … Sun=6
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setHours(0, 0, 0, 0);
    startOfThisWeek.setDate(now.getDate() - dayOfWeek);
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

    const thisWeek = tickets.filter((t) => {
      const d = new Date(new Date(t.createdAt).toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
      return d >= startOfThisWeek;
    }).length;
    const lastWeek = tickets.filter((t) => {
      const d = new Date(new Date(t.createdAt).toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
      return d >= startOfLastWeek && d < startOfThisWeek;
    }).length;

    if (lastWeek === 0 && thisWeek === 0) return { pct: "0.0", up: true, label: "vs last week" };
    if (lastWeek === 0) return { pct: "100.0", up: true, label: "vs last week" };
    const pct = (((thisWeek - lastWeek) / lastWeek) * 100).toFixed(1);
    return { pct: Math.abs(Number(pct)).toFixed(1), up: thisWeek >= lastWeek, label: "vs last week" };
  }, [tickets]);

  const modalAssignedValue = useMemo(() => {
    if (form.assignedType === "technician" || form.assignedType === "tech") {
      if (form.assignedId) return `technician:${form.assignedId}`;
      const match = technicians.find((item) => item.name.toLowerCase().trim() === form.assignedTo.toLowerCase().trim());
      if (match) return `technician:${match.id}`;
    }
    if (form.assignedType === "team") {
      if (form.assignedId) return `team:${form.assignedId}`;
      const match = teams.find((item) => item.name.toLowerCase().trim() === form.assignedTo.toLowerCase().trim());
      if (match) return `team:${match.id}`;
    }
    if (form.assignedTo) {
      const matchTech = technicians.find((item) => item.name.toLowerCase().trim() === form.assignedTo.toLowerCase().trim());
      if (matchTech) return `technician:${matchTech.id}`;
      const matchTeam = teams.find((item) => item.name.toLowerCase().trim() === form.assignedTo.toLowerCase().trim());
      if (matchTeam) return `team:${matchTeam.id}`;
    }
    return "";
  }, [form.assignedType, form.assignedId, form.assignedTo, technicians, teams]);

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
               <h1>TicketDesk</h1>
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
            <h2>Tickets</h2>
            <p className="hero-copy">Keep every customer ticket close to the network context that matters.</p>
          </div>
          <div className="hero-actions">
            <Link className="primary-button hero-secondary ticket-types-link" href="/ticket-types"><Icon name="tag" /> Ticket types</Link>
            <Link className="primary-button hero-secondary technicians-link" href="/add-technician"><Icon name="user" /> Technician</Link>
            <Link className="primary-button hero-secondary teams-link" href="/add-team"><Icon name="users" /> Team</Link>
            <button className="primary-button" onClick={openCreateTicket}><Icon name="plus" /> Add ticket</button>
          </div>
        </div>

        <section className="metrics-grid" aria-label="Ticket summary">
          <article className="metric-card total-card">
            <div className="metric-icon"><Icon name="inbox" /></div>
            <p className="metric-label">Total tickets</p>
            <p className="metric-value">{total}</p>
            <span className="metric-trend" style={{ color: weekTrend.up ? "#86efac" : "#fca5a5" }}>
              {weekTrend.up ? "↑" : "↓"}{weekTrend.pct}% <span>{weekTrend.label}</span>
            </span>
          </article>
          <article className="metric-card today-card">
            <div className="metric-icon"><Icon name="clock" /></div>
            <p className="metric-label">Created today</p>
            <p className="metric-value">{todayCount}</p>
            <span className="metric-caption">Bangladesh time</span>
          </article>
          <article className="metric-card pending-card">
            <div className="metric-icon"><Icon name="pulse" /></div>
            <p className="metric-label">Pending</p>
            <p className="metric-value">{pendingCount}</p>
            <span className="metric-caption">Needs attention</span>
          </article>
          <article className="metric-card completed-card">
            <div className="metric-icon"><Icon name="check" /></div>
            <p className="metric-label">Completed</p>
            <p className="metric-value">{completedCount}</p>
            <span className="metric-caption">Resolved</span>
          </article>
          <article className="metric-card cancelled-card">
            <div className="metric-icon"><Icon name="close" /></div>
            <p className="metric-label">Cancelled</p>
            <p className="metric-value">{cancelledCount}</p>
            <span className="metric-caption">Cancelled by user</span>
          </article>
          <article className="metric-card closed-card">
            <div className="metric-icon"><Icon name="tag" /></div>
            <p className="metric-label">Closed</p>
            <p className="metric-value">{closedCount}</p>
            <span className="metric-caption">Archived</span>
          </article>
        </section>

        <section className="workspace-card">
           <div className="table-toolbar">
             <div className="table-toolbar-head">
             <div>
               <div className="section-title-row"><h3>All tickets</h3><span className="count-badge">{total}</span></div>
               <p className="section-copy">Sort, search, and scan the latest customer-reported issues.</p>
             </div>
             <label className="search-box">
              <Icon name="search" />
              <input value={globalFilter} onChange={(event) => setGlobalFilter(event.target.value)} placeholder="Search tickets..." aria-label="Search tickets" />
               <kbd>⌘ K</kbd>
             </label>
             </div>
             <div className="table-filters" aria-label="Ticket filters">
               <label className="filter-field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "all" | TicketStatus)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="running">Running</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="closed">Closed</option></select></label>
               <label className="filter-field"><span>Ticket type</span><select value={ticketTypeFilter} onChange={(event) => setTicketTypeFilter(event.target.value)}><option value="all">All types</option>{ticketTypeOptions.map((ticketType) => <option key={ticketType} value={ticketType}>{ticketType}</option>)}</select></label>
               <label className="filter-field"><span>Entry by</span><select value={entryByFilter} onChange={(event) => setEntryByFilter(event.target.value)}><option value="all">All users</option>{entryByOptions.map((entryBy) => <option key={entryBy} value={entryBy}>{entryBy}</option>)}</select></label>
                <label className="filter-field"><span>Completed by</span><select value={completedByFilter} onChange={(event) => setCompletedByFilter(event.target.value)}><option value="all">All</option>{completedByOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
                <label className="filter-field"><span>Cancelled by</span><select value={cancelledByFilter} onChange={(event) => setCancelledByFilter(event.target.value)}><option value="all">All</option>{cancelledByOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
                <label className="filter-field"><span>Closed by</span><select value={closedByFilter} onChange={(event) => setClosedByFilter(event.target.value)}><option value="all">All</option>{closedByOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
               <label className="filter-field">
                 <span>Assigned to</span>
                 <select value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)}>
                   <option value="all">All assignments</option>
                   <option value="unassigned">Unassigned</option>
                   {teams.length > 0 && (
                     <optgroup label="Teams">
                       {teams.map((t) => (
                         <option key={`f-team:${t.id}`} value={t.name}>
                           👥 {t.name}
                         </option>
                       ))}
                     </optgroup>
                   )}
                   {technicians.length > 0 && (
                     <optgroup label="Technicians">
                       {technicians.map((t) => (
                         <option key={`f-tech:${t.id}`} value={t.name}>
                           👤 {t.name}
                         </option>
                       ))}
                     </optgroup>
                   )}
                 </select>
               </label>
               <label className="filter-field"><span>VLAN</span><select value={vlanFilter} onChange={(event) => setVlanFilter(event.target.value)}><option value="all">All VLANs</option>{vlanOptions.map((vlan) => <option key={vlan} value={vlan}>{vlan}</option>)}</select></label>
               <label className="filter-field"><span>POP</span><select value={popFilter} onChange={(event) => setPopFilter(event.target.value)}><option value="all">All POPs</option>{popOptions.map((pop) => <option key={pop} value={pop}>{pop}</option>)}</select></label>
               <label className="filter-field"><span>From date</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="Filter from date" /></label>
               <label className="filter-field"><span>To date</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="Filter to date" /></label>
               <button type="button" className="clear-filters" onClick={clearFilters} disabled={!hasActiveFilters}>Clear filters</button>
             </div>
           </div>

          <div className="table-wrap">
             <table className="tickets-table">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => <tr key={headerGroup.id}>{headerGroup.headers.map((header) => <th key={header.id} onClick={header.column.getToggleSortingHandler()} className={header.column.getCanSort() ? "sortable" : ""}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                </th>)}</tr>)}
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={19} className="empty-state">Loading tickets…</td></tr>
                ) : table.getRowModel().rows.length === 0 ? (
                  <tr><td colSpan={19} className="empty-state">No tickets match your search.</td></tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            <span>Showing <strong>{table.getRowModel().rows.length}</strong> of <strong>{table.getFilteredRowModel().rows.length}</strong> matching tickets</span>
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
          <div className="modal-header"><div><p className="eyebrow gradient-eyebrow">{editingTicketId ? "Update ticket" : "New ticket"}</p><h3 id="modal-title">{editingTicketId ? "Edit ticket" : "Add ticket"}</h3><p>{editingTicketId ? "Refresh the customer and network details." : "Capture the issue while the context is fresh."}</p></div><button className="icon-button" onClick={() => { setEditingTicketId(null); setForm(emptyForm); setIsModalOpen(false); }} aria-label="Close modal"><Icon name="close" /></button></div>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <label><span>User ID<span className="field-required">*</span></span><input required value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value })} placeholder="CUS-10482" /></label>
              <label><span>Phone number<span className="field-required">*</span></span><input required value={form.phoneNumber} onChange={(event) => setForm({ ...form, phoneNumber: event.target.value })} placeholder="01711 456 220" /></label>
              <label><span>WhatsApp number <span className="optional-label">(optional)</span></span><input value={form.whatsappNumber} onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })} placeholder="01711 456 220" /></label>
              <label><span>Ticket type<span className="field-required">*</span></span><select required value={form.ticketType} onChange={(event) => { const val = event.target.value; setForm({ ...form, ticketType: val, details: val }); }}><option value="">{ticketTypes.length ? "Select a type" : "Loading types…"}</option>{ticketTypes.map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}</select>{typeError && <small className="field-error">{typeError} <a className="inline-link" href="/ticket-types">Manage types</a></small>}</label>
              <label><span>Status<span className="field-required">*</span></span><select required value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as TicketStatus })}><option value="pending">Pending</option><option value="running">Running</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="closed">Closed</option></select></label>
              <label>
                <span>Assigned to <span className="optional-label">(optional)</span></span>
                <select
                  value={modalAssignedValue}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (!val) {
                      setForm({ ...form, assignedTo: "", assignedType: "", assignedId: null });
                    } else if (val.startsWith("team:")) {
                      const id = Number(val.slice(5));
                      const t = teams.find((item) => item.id === id);
                      setForm({
                        ...form,
                        assignedTo: t ? t.name : `Team #${id}`,
                        assignedType: "team",
                        assignedId: id,
                      });
                    } else if (val.startsWith("technician:") || val.startsWith("tech:")) {
                      const id = Number(val.replace(/^technician:|^tech:/, ""));
                      const tech = technicians.find((item) => item.id === id);
                      setForm({
                        ...form,
                        assignedTo: tech ? tech.name : `Technician #${id}`,
                        assignedType: "technician",
                        assignedId: id,
                      });
                    }
                  }}
                >
                  <option value="">Unassigned</option>
                  {teams.length > 0 && (
                    <optgroup label="Teams">
                      {teams.map((t) => (
                        <option key={`m-team:${t.id}`} value={`team:${t.id}`}>
                          👥 {t.name} ({t.members.length} member{t.members.length === 1 ? "" : "s"})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {technicians.length > 0 && (
                    <optgroup label="Technicians">
                      {technicians.map((t) => (
                        <option key={`m-tech:${t.id}`} value={`technician:${t.id}`}>
                          👤 {t.name} ({t.mobile1})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <label><span>VLAN <span className="optional-label">(optional)</span></span><input value={form.vlan} onChange={(event) => setForm({ ...form, vlan: event.target.value })} placeholder="VLAN-210" /></label>
              <label><span>POP <span className="optional-label">(optional)</span></span><input value={form.pop} onChange={(event) => setForm({ ...form, pop: event.target.value })} placeholder="Gulshan-2" /></label>
              <label className="wide-field"><span>Customer address{(form.assignedType === "technician" || form.assignedType === "tech" || form.assignedType === "team") ? <span className="field-required">*</span> : <span className="optional-label">(optional)</span>}</span><input required={form.assignedType === "technician" || form.assignedType === "tech" || form.assignedType === "team"} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="House 12, Road 5, Dhanmondi, Dhaka" /></label>
              <label className="wide-field"><span>Details text<span className="field-required">*</span></span><textarea required rows={4} value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} placeholder="Describe the customer’s issue, symptoms, and any troubleshooting already done..." /></label>
              {editingTicketId && (form.completedBy || form.closedBy || form.cancelledBy) && (
                <div className="audit-info-row wide-field">
                  {form.completedBy && (
                    <span className="audit-tag">
                      ✓ Completed by: <strong>@{form.completedBy}</strong> ({formatBangladeshDate(form.completedDate)})
                    </span>
                  )}
                  {form.cancelledBy && (
                    <span className="audit-tag cancelled">
                      ✕ Cancelled by: <strong>@{form.cancelledBy}</strong> ({formatBangladeshDate(form.cancelledDate)})
                    </span>
                  )}
                  {form.closedBy && (
                    <span className="audit-tag">
                      ✦ Closed by: <strong>@{form.closedBy}</strong> ({formatBangladeshDate(form.closedDate)})
                    </span>
                  )}
                </div>
              )}
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setEditingTicketId(null); setForm(emptyForm); setIsModalOpen(false); }}>Cancel</button><button className="primary-button" type="submit" disabled={isSaving}>{isSaving ? "Saving…" : editingTicketId ? "Save changes" : "Save ticket"} <Icon name="arrow" /></button></div>
          </form>
        </section>
      </div>}


    </main>
  );
}
