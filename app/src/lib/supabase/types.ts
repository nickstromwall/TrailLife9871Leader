// Domain types for the troop signup app.
// Until we generate types from Supabase, these hand-rolled interfaces
// keep the rest of the app type-safe.

export type EventRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  season: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_published: boolean;
  archived_at: string | null;
  cloned_from: string | null;
  theme: EventTheme;
  created_at: string;
  updated_at: string;
};

export type EventTheme = "trail-life-green" | "trail-life-gold" | "neutral";

export type SlotRow = {
  id: string;
  event_id: string;
  sort_order: number;
  group_label: string | null;
  title: string;
  subtitle: string | null;
  description: string | null;
  spots: number;
  leadership: boolean;
  scripture: string | null;
  time_commitment: string | null;
  reports_to: string | null;
  success_bullets: string[];
  not_this_bullets: string[];
  prefilled_names: string[];
  is_locked: boolean;
  created_at: string;
};

export type SignupRow = {
  id: string;
  slot_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type SlotWithSignups = SlotRow & {
  signups: SignupRow[];
};

export type EventWithSlots = EventRow & {
  slots: SlotWithSignups[];
};

export function slotFilledCount(slot: SlotWithSignups): number {
  return slot.prefilled_names.length + slot.signups.length;
}

export function slotStatus(slot: SlotWithSignups): "open" | "partial" | "filled" {
  const filled = slotFilledCount(slot);
  if (filled >= slot.spots) return "filled";
  if (filled > 0) return "partial";
  return "open";
}

export function slotDisplayNames(slot: SlotWithSignups): string[] {
  return [...slot.prefilled_names, ...slot.signups.map((s) => s.name)];
}
