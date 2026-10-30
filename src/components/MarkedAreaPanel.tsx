import { useEffect, useState } from "react";
import { Check, Eye, Hexagon, Loader2, Mountain, Pencil, Plus, Share2, Trash2, Undo2, X } from "lucide-react";
import { useSurveyStore } from "../store/useSurveyStore";
import { useMarkedAreaStore } from "../store/useMarkedAreaStore";
import { useMarkedLocationStore } from "../store/useMarkedLocationStore";
import { useTrackRecorderStore } from "../store/useTrackRecorderStore";
import {
  AREA_COLORS,
  areaInputError,
  formatArea,
  formatLength,
  getMarkedAreaPolicy,
  ringArea,
  ringPerimeter,
} from "../utils/markedAreas";
import type { LngLat, MarkedArea } from "../types/markedArea";
import { ShareLinkBox } from "./ShareLinkBox";
import { AreaContourBox } from "./AreaContourBox";

interface FormState {
  editingId: string | null;
  name: string;
  color: string;
  notes: string;
  ring: LngLat[];
}

const inputClass =
  "w-full bg-sand-50 border border-sand-200 rounded-lg px-2.5 py-1.5 text-base sm:text-xs text-ink placeholder:text-sand-500 outline-none focus:border-gold-300";

// Marked Areas: draw polygons on the map, see their size, focus on one (the rest of the map
// goes dark), and share one as a link anyone can open without signing in.
export const MarkedAreaPanel = () => {
  const { user, subscriptionStatus, isAdmin } = useSurveyStore();
  const policy = getMarkedAreaPolicy({ hasUser: !!user, subscriptionStatus, isAdmin });
  const {
    isPanelOpen,
    setPanelOpen,
    areas,
    isLoading,
    error,
    clearError,
    isDrawing,
    draft,
    startDrawing,
    undoPoint,
    stopDrawing,
    focusId,
    setFocus,
    selectedId,
    select,
    init,
    reset,
    createArea,
    updateArea,
    deleteArea,
  } = useMarkedAreaStore();
  const isTrackRecorderOpen = useTrackRecorderStore((s) => s.isPanelOpen);
  const isMarkedLocationsOpen = useMarkedLocationStore((s) => s.isPanelOpen);

  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [contourId, setContourId] = useState<string | null>(null);
  const contourMeta = useMarkedAreaStore((s) => s.contourMeta);

  // Load on login, clear on logout
  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId) init(userId);
    else reset();
  }, [userId, init, reset]);

  // The Track Recorder and Marked Locations panels use the same spot on screen
  useEffect(() => {
    if (isTrackRecorderOpen || isMarkedLocationsOpen) setPanelOpen(false);
  }, [isTrackRecorderOpen, isMarkedLocationsOpen, setPanelOpen]);

  if (!policy.canUse) return null;

  const atLimit = policy.limit !== null && areas.length >= policy.limit;

  // --- Drawing bar (the panel steps aside while the user taps the map)
  if (isDrawing) {
    const size = draft.length >= 3 ? formatArea(ringArea(draft)) : null;
    const finish = () => {
      stopDrawing();
      setForm((f) => (f ? { ...f, ring: draft } : { editingId: null, name: "", color: AREA_COLORS[0], notes: "", ring: draft }));
      setPanelOpen(true);
    };
    const cancel = () => {
      stopDrawing();
      setPanelOpen(true);
    };
    return (
      <div className="fixed z-[60] left-3 right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[420px] rounded-xl bg-white/95 backdrop-blur-md border border-gold-200 shadow-2xl px-3 py-2.5 text-ink">
        <div className="flex items-center gap-2 text-xs">
          <Hexagon size={14} className="text-gold-700 shrink-0" />
          <span className="font-bold flex-1 min-w-0">
            {draft.length < 3 ? "Tap the map to add the corners of the area" : `${draft.length} points · ${size}`}
          </span>
        </div>
        <div className="mt-2 flex gap-1.5">
          <button
            onClick={undoPoint}
            disabled={draft.length === 0}
            className="cursor-pointer flex items-center gap-1 px-3 py-2 rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 text-xs font-bold disabled:opacity-40"
          >
            <Undo2 size={13} /> Undo
          </button>
          <button
            onClick={cancel}
            className="cursor-pointer px-3 py-2 rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 text-xs font-bold"
          >
            Cancel
          </button>
          <button
            onClick={finish}
            disabled={draft.length < 3}
            className="cursor-pointer flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold disabled:opacity-40"
          >
            <Check size={13} /> Done
          </button>
        </div>
      </div>
    );
  }

  if (!isPanelOpen) return null;

  const openNew = () => {
    setForm(null);
    setFormError(null);
    clearError();
    startDrawing([]);
    setPanelOpen(false);
  };
  const openEdit = (a: MarkedArea) => {
    setForm({ editingId: a.id, name: a.name, color: a.color, notes: a.notes ?? "", ring: a.ring });
    setFormError(null);
    setShareId(null);
  };
  const redraw = () => {
    if (!form) return;
    startDrawing(form.ring);
    setPanelOpen(false);
  };

  const save = async () => {
    if (!form) return;
    const problem = areaInputError(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const input = { name: form.name, color: form.color, notes: form.notes || null, ring: form.ring };
      const saved = form.editingId ? await updateArea(form.editingId, input) : await createArea(input);
      setForm(null);
      select(saved.id);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await deleteArea(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed z-[60] left-3 right-3 bottom-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-6 md:w-[420px] max-h-[70vh] max-h-[70dvh] flex flex-col bg-white/95 backdrop-blur-md border border-gold-200 rounded-xl text-ink shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-sand-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Hexagon size={16} className="text-gold-700 shrink-0" />
          <h3 className="text-sm font-bold truncate">Marked Areas</h3>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 ${
              atLimit ? "bg-brick-50 text-brick-600 border-brick-200" : "bg-gold-50 text-gold-700 border-gold-200"
            }`}
          >
            {policy.limit === null ? `${areas.length} · unlimited` : `${areas.length} / ${policy.limit}`}
          </span>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink"
          title="Close"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {(error || formError) && (
          <div className="text-[11px] p-2 rounded-lg border bg-brick-50 border-brick-200 text-brick-600">{formError || error}</div>
        )}

        {form ? (
          // --- New / edit form
          <div className="space-y-2.5">
            <div className="text-xs font-bold">{form.editingId ? "Edit area" : "New area"}</div>
            <div className="rounded-lg bg-sand-50 border border-sand-200 px-2.5 py-2 text-[11px] text-sand-700 flex items-center justify-between gap-2">
              <span>
                {form.ring.length} points · <strong>{formatArea(ringArea(form.ring))}</strong> · perimeter{" "}
                {formatLength(ringPerimeter(form.ring))}
              </span>
              <button onClick={redraw} className="cursor-pointer shrink-0 text-gold-700 font-bold hover:underline">
                Redraw
              </button>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
                placeholder="e.g. Camp ground Surya Kencana"
                className={inputClass}
                aria-label="Area name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Outline colour</label>
              <div className="flex flex-wrap gap-1.5">
                {AREA_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setForm({ ...form, color: c })}
                    aria-label={`Colour ${c}`}
                    aria-pressed={form.color === c}
                    className={`cursor-pointer w-7 h-7 rounded-full border-2 ${form.color === c ? "border-ink scale-110" : "border-sand-200"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-sand-600">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                maxLength={2000}
                rows={3}
                placeholder="Access, rules, water, hazards..."
                className={`${inputClass} resize-none`}
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setForm(null);
                  setFormError(null);
                }}
                className="cursor-pointer px-3 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-sand-700 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                {form.editingId ? "Save changes" : "Save area"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              onClick={openNew}
              disabled={atLimit}
              className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={14} /> Add area
            </button>
            {atLimit && (
              <p className="text-[10px] text-sand-600 text-center">
                Your {subscriptionStatus} plan allows {policy.limit} areas. Delete one or upgrade for more.
              </p>
            )}

            {isLoading && areas.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-sand-500">
                <Loader2 size={14} className="animate-spin" /> Loading areas...
              </div>
            ) : areas.length === 0 ? (
              <p className="py-6 text-center text-xs text-sand-500">
                No areas yet. Press Add area and tap the map to draw one.
              </p>
            ) : (
              areas.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-lg border p-2.5 ${selectedId === a.id ? "border-gold-300 bg-gold-50/50" : "border-sand-200 bg-white"}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-1 w-3 h-3 rounded-full shrink-0 border border-sand-300" style={{ backgroundColor: a.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold truncate">{a.name}</div>
                      <div className="text-[10px] text-sand-600">
                        {formatArea(a.areaM2)} · perimeter {formatLength(a.perimeterM)}
                      </div>
                      {a.notes && <p className="mt-1 text-[10px] text-sand-600 line-clamp-2">{a.notes}</p>}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      onClick={() => {
                        setFocus(focusId === a.id ? null : a.id);
                        select(a.id);
                      }}
                      aria-pressed={focusId === a.id}
                      className={`cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                        focusId === a.id ? "bg-forest-800 text-white" : "bg-sand-100 hover:bg-sand-200 text-ink"
                      }`}
                    >
                      <Eye size={11} /> {focusId === a.id ? "Focused" : "Focus"}
                    </button>
                    <button
                      onClick={() => openEdit(a)}
                      className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg bg-sand-100 hover:bg-sand-200 text-ink text-[10px] font-bold"
                    >
                      <Pencil size={11} /> Edit
                    </button>
                    {policy.canShare && (
                      <button
                        onClick={() => {
                          setShareId(shareId === a.id ? null : a.id);
                          setContourId(null);
                        }}
                        aria-pressed={shareId === a.id}
                        className={`cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                          shareId === a.id ? "bg-gold-500 text-white" : "bg-sand-100 hover:bg-sand-200 text-ink"
                        }`}
                      >
                        <Share2 size={11} /> Share
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setContourId(contourId === a.id ? null : a.id);
                        setShareId(null);
                      }}
                      aria-pressed={contourId === a.id}
                      className={`cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                        contourId === a.id ? "bg-gold-500 text-white" : "bg-sand-100 hover:bg-sand-200 text-ink"
                      }`}
                    >
                      <Mountain size={11} /> Contours
                      {contourMeta[a.id] && <span className="w-1.5 h-1.5 rounded-full bg-forest-600" aria-label="has uploaded contours" />}
                    </button>
                    {confirmDeleteId === a.id ? (
                      <span className="flex items-center gap-1 ml-auto text-[10px] text-brick-600">
                        Delete?
                        <button
                          onClick={() => remove(a.id)}
                          disabled={busyId === a.id}
                          className="cursor-pointer px-2 py-1 rounded-lg bg-brick-600 text-white font-bold"
                        >
                          {busyId === a.id ? <Loader2 size={11} className="animate-spin" /> : "Yes"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="cursor-pointer px-2 py-1 rounded-lg bg-sand-100 text-sand-700 font-bold"
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(a.id)}
                        className="cursor-pointer ml-auto p-1 rounded-lg hover:bg-brick-50 text-brick-600"
                        title="Delete area"
                        aria-label={`Delete ${a.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  {contourId === a.id && (
                    <div className="mt-2">
                      <AreaContourBox key={a.id} area={a} allowed={policy.canShare} />
                    </div>
                  )}
                  {shareId === a.id && (
                    <div className="mt-2">
                      <ShareLinkBox key={a.id} what="this area" />
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
};
