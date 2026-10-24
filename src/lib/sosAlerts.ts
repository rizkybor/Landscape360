import { supabase } from './supabaseClient';
import type { SosFix } from './sos';

// S.O.S alerts sent to the admin (sos_alerts, 20261024000015). The phone keeps the latest
// report of each S.O.S in an outbox until the server has it, so alerts raised without
// signal are sent as soon as the connection is back (while the app is open).

export interface SosReport {
  clientId: string; // one per S.O.S, made on the phone
  startedAt: string; // ISO
  status: 'active' | 'resolved';
  message: string;
  fix: SosFix | null;
  battery: number | null;
}

const OUTBOX_KEY = 'l360-sos-outbox';

const readOutbox = (): Record<string, SosReport> => {
  try {
    const raw = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const writeOutbox = (box: Record<string, SosReport>) => {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(box));
  } catch {
    // Storage blocked: the report is still sent while the screen is open
  }
};

export const pendingSosReports = () => Object.values(readOutbox());

export const sendSosReport = async (r: SosReport) => {
  const { error } = await supabase.rpc('sos_report', {
    p_client_id: r.clientId,
    p_started_at: r.startedAt,
    p_status: r.status,
    p_message: r.message.trim() || null,
    p_lat: r.fix?.lat ?? null,
    p_lng: r.fix?.lng ?? null,
    p_accuracy: r.fix?.accuracy ?? null,
    p_elevation: r.fix?.elevation ?? null,
    p_battery: r.battery,
    p_located_at: r.fix ? new Date(r.fix.time).toISOString() : null,
  });
  if (error) {
    throw new Error(
      /could not find the function|PGRST202/i.test(`${error.message} ${error.code ?? ''}`)
        ? 'S.O.S alerts are not set up yet (run the 20261024000015 migration)'
        : error.message,
    );
  }
};

let flushing: Promise<boolean> | null = null;

/** Sends every report still in the outbox. Resolves true when nothing is left. */
export const flushSosOutbox = (): Promise<boolean> => {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      for (const report of Object.values(readOutbox())) {
        await sendSosReport(report);
        const box = readOutbox();
        // Only drop it if no newer report for the same S.O.S arrived while sending
        if (JSON.stringify(box[report.clientId]) === JSON.stringify(report)) {
          delete box[report.clientId];
          writeOutbox(box);
        }
      }
      return Object.keys(readOutbox()).length === 0;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
};

/** Keeps the latest report of an S.O.S and tries to send it now */
export const queueSosReport = (report: SosReport) => {
  const box = readOutbox();
  box[report.clientId] = report;
  writeOutbox(box);
  return flushSosOutbox();
};

// --- Admin -------------------------------------------------------------------------------

export interface SosAlert {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  phone: string | null;
  organization: string | null;
  status: 'active' | 'resolved';
  message: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  elevation: number | null;
  battery: number | null;
  locatedAt: string | null;
  startedAt: string;
  receivedAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedNote: string | null;
  pointCount: number;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export const listSosAlerts = async (onlyActive: boolean): Promise<SosAlert[]> => {
  const { data, error } = await supabase.rpc('admin_sos_alerts', { p_only_active: onlyActive, p_limit: 100 });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    email: (r.email as string) ?? '',
    name: (r.name as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    organization: (r.organization as string | null) ?? null,
    status: r.status === 'resolved' ? 'resolved' : 'active',
    message: (r.message as string | null) ?? null,
    lat: num(r.lat),
    lng: num(r.lng),
    accuracy: num(r.accuracy),
    elevation: num(r.elevation),
    battery: num(r.battery),
    locatedAt: (r.located_at as string | null) ?? null,
    startedAt: r.started_at as string,
    receivedAt: r.received_at as string,
    updatedAt: r.updated_at as string,
    resolvedAt: (r.resolved_at as string | null) ?? null,
    resolvedNote: (r.resolved_note as string | null) ?? null,
    pointCount: Number(r.point_count ?? 0),
  }));
};

export const resolveSosAlert = async (id: string, note: string) => {
  const { error } = await supabase.rpc('admin_resolve_sos', { p_id: id, p_note: note.trim() || null });
  if (error) throw new Error(error.message);
};
