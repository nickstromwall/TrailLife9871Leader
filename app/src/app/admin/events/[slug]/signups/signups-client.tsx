"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EventRow, SignupRow, SlotRow } from "@/lib/supabase/types";

export function SignupsClient({
  event,
  slots,
  signups,
}: {
  event: EventRow;
  slots: SlotRow[];
  signups: SignupRow[];
}) {
  const router = useRouter();
  const [filterSlot, setFilterSlot] = useState<string>("");
  const [query, setQuery] = useState("");

  const slotsById = useMemo(() => {
    const map = new Map<string, SlotRow>();
    slots.forEach((s) => map.set(s.id, s));
    return map;
  }, [slots]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return signups.filter((s) => {
      if (filterSlot && s.slot_id !== filterSlot) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").includes(q)
      );
    });
  }, [signups, filterSlot, query]);

  async function deleteSignup(id: string) {
    if (
      !window.confirm(
        "Delete this signup? The spot becomes available again immediately.",
      )
    ) {
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("signups").delete().eq("id", id);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  function exportCsv() {
    const rows = [
      ["Timestamp", "Slot", "Group", "Name", "Email", "Phone", "Notes"],
      ...filtered.map((s) => {
        const slot = slotsById.get(s.slot_id);
        return [
          s.created_at,
          slot?.title ?? "(deleted)",
          slot?.group_label ?? "",
          s.name,
          s.email ?? "",
          s.phone ?? "",
          s.notes ?? "",
        ];
      }),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => {
            const v = String(cell ?? "");
            return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.slug}-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex gap-2 flex-wrap items-end mb-4">
        <label className="text-sm">
          <div className="font-semibold mb-1">Filter by slot</div>
          <select
            value={filterSlot}
            onChange={(e) => setFilterSlot(e.target.value)}
            className="border-2 border-stone-200 rounded-lg px-3 py-2"
          >
            <option value="">All slots</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm flex-1 min-w-[200px]">
          <div className="font-semibold mb-1">Search</div>
          <input
            type="text"
            placeholder="name, email, or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border-2 border-stone-200 rounded-lg px-3 py-2"
          />
        </label>
        <button
          onClick={exportCsv}
          className="bg-stone-900 text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          Export CSV ({filtered.length})
        </button>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left">
            <tr>
              <Th>When</Th>
              <Th>Slot</Th>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="text-center text-stone-500 py-8 text-sm"
                >
                  No signups match.
                </td>
              </tr>
            ) : (
              filtered.map((s) => {
                const slot = slotsById.get(s.slot_id);
                return (
                  <tr key={s.id} className="border-t border-stone-100">
                    <Td>
                      {new Date(s.created_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </Td>
                    <Td>
                      <div className="font-semibold">
                        {slot?.title ?? "(deleted slot)"}
                      </div>
                      {slot?.group_label ? (
                        <div className="text-xs text-stone-500">
                          {slot.group_label}
                        </div>
                      ) : null}
                    </Td>
                    <Td>{s.name}</Td>
                    <Td className="text-stone-600">{s.email ?? ""}</Td>
                    <Td className="text-stone-600">{s.phone ?? ""}</Td>
                    <Td>
                      <button
                        onClick={() => deleteSignup(s.id)}
                        className="text-red-700 text-xs hover:underline"
                      >
                        Delete
                      </button>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="text-xs font-bold uppercase tracking-wider text-stone-500 px-3 py-2">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
