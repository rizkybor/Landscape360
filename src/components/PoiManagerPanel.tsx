import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  Crosshair,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Check,
  X,
} from "lucide-react";
import {
  POI_CATEGORIES,
  POI_CATEGORY_LABELS,
  createPoi,
  deletePoi,
  listAllPois,
  poiInputError,
  updatePoi,
  type PoiCategory,
  type PoiInput,
  type PointOfInterest,
} from "../lib/pointsOfInterest";
import { usePoiStore } from "../store/usePoiStore";
import { useMapStore } from "../store/useMapStore";
import { ScrollShadowArea } from "./ScrollShadowArea";

const ICONS: Record<PoiCategory, string> = {
  poi: "/house.svg",
  basecamp: "/house.svg",
  mountain: "/mountain.svg",
  water: "/water.svg",
  river: "/river.svg",
  cliff: "/cliff.svg",
  cave: "/cave.svg",
};

const inputClass =
  "w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-base sm:text-xs text-ink placeholder:text-sand-500 outline-none focus:border-forest-300";
const ROWS_PAGE = 30;

interface FormState {
  name: string;
  subtitle: string;
  description: string;
  category: PoiCategory;
  lat: string;
  lng: string;
  isPublished: boolean;
}

const emptyForm = (center: [number, number]): FormState => ({
  name: "",
  subtitle: "",
  description: "",
  category: "mountain",
  lat: center[1].toFixed(6),
  lng: center[0].toFixed(6),
  isPublished: true,
});

const toForm = (p: PointOfInterest): FormState => ({
  name: p.name,
  subtitle: p.subtitle ?? "",
  description: p.description ?? "",
  category: p.category,
  lat: String(p.lat),
  lng: String(p.lng),
  isPublished: p.isPublished,
});

const toInput = (f: FormState): PoiInput => ({
  name: f.name,
  subtitle: f.subtitle,
  description: f.description,
  category: f.category,
  lat: Number(f.lat),
  lng: Number(f.lng),
  isPublished: f.isPublished,
});

// Admin: add, edit, hide and delete the points of interest everyone sees on the map
export const PoiManagerPanel = ({ onClose, onBack }: { onClose: () => void; onBack?: () => void }) => {
  const [pois, setPois] = useState<PointOfInterest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PoiCategory | "all">("all");
  // null = no form, "new" = adding, otherwise the id being edited
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(useMapStore.getState().center));
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const reloadMap = usePoiStore((s) => s.load);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPois(await listAllPois());
    } catch (err) {
      const message = (err as Error).message;
      setError(
        /points_of_interest|schema cache|does not exist/i.test(message)
          ? "Run the 20261024000012_points_of_interest migration to manage points of interest."
          : message,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flash = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(null), 2500);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pois.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q) || (p.subtitle ?? "").toLowerCase().includes(q)),
    );
  }, [pois, query, category]);

  // Rows render a page at a time as the list is scrolled
  const listKey = `${query}|${category}`;
  const [rowWindow, setRowWindow] = useState({ key: listKey, count: ROWS_PAGE });
  const rowLimit = rowWindow.key === listKey ? rowWindow.count : ROWS_PAGE;
  const showMoreRows = () => {
    if (rowLimit < filtered.length) setRowWindow({ key: listKey, count: rowLimit + ROWS_PAGE });
  };

  const startAdd = () => {
    setForm(emptyForm(useMapStore.getState().center));
    setEditing("new");
    setError(null);
  };

  const startEdit = (p: PointOfInterest) => {
    setForm(toForm(p));
    setEditing(p.id);
    setError(null);
    setConfirmDeleteId(null);
  };

  const useMapCenter = () => {
    const [lng, lat] = useMapStore.getState().center;
    setForm((f) => ({ ...f, lat: lat.toFixed(6), lng: lng.toFixed(6) }));
  };

  const afterChange = async (message: string) => {
    flash(message);
    await Promise.all([refresh(), reloadMap()]);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = toInput(form);
    const problem = poiInputError(input);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing === "new") await createPoi(input);
      else if (editing) await updatePoi(editing, input);
      const message = editing === "new" ? `${input.name.trim()} added` : `${input.name.trim()} updated`;
      setEditing(null);
      await afterChange(message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const togglePublished = async (p: PointOfInterest) => {
    setBusyId(p.id);
    setError(null);
    try {
      await updatePoi(p.id, { ...p, isPublished: !p.isPublished });
      await afterChange(p.isPublished ? `${p.name} hidden from the map` : `${p.name} shown on the map`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (p: PointOfInterest) => {
    setBusyId(p.id);
    setError(null);
    try {
      await deletePoi(p.id);
      setConfirmDeleteId(null);
      if (editing === p.id) setEditing(null);
      await afterChange(`${p.name} deleted`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const showOnMap = (p: PointOfInterest) => {
    useMapStore.getState().triggerFlyTo({ center: [p.lng, p.lat], zoom: 14, duration: 1500 });
    onClose();
  };

  const publishedCount = pois.filter((p) => p.isPublished).length;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center md:p-4 bg-ink/40 backdrop-blur-sm md:backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full h-dvh md:h-auto md:max-w-3xl bg-white border-0 md:border md:border-sand-200 rounded-none md:rounded-2xl overflow-hidden flex flex-col md:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 p-4 border-b border-sand-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="cursor-pointer p-1.5 -ml-1 text-sand-600 hover:text-ink hover:bg-sand-100 rounded-lg transition-colors"
                title="Back to User Account"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="p-2 rounded-lg bg-forest-50 text-forest-700">
              <MapPin size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink">Points of Interest</h2>
              <p className="text-[10px] text-sand-500 truncate">
                {pois.length} points · {publishedCount} on the map · visible to everyone, edited by you
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="cursor-pointer p-2 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className="cursor-pointer p-2 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 border-b border-sand-100 shrink-0">
          <div className="relative w-full sm:w-auto sm:flex-1 min-w-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-sand-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or subtitle..."
              className={`${inputClass} pl-9`}
              aria-label="Search points of interest"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PoiCategory | "all")}
            className="cursor-pointer flex-1 sm:flex-none bg-sand-50 border border-sand-200 rounded-lg px-2 py-2 text-base sm:text-[11px] text-ink outline-none"
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {POI_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {POI_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <button
            onClick={startAdd}
            className="cursor-pointer shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors"
          >
            <Plus size={14} /> Add Point
          </button>
        </div>

        {(error || notice) && (
          <div
            className={`mx-3 mt-3 text-[11px] p-2 rounded-lg border flex justify-between items-center gap-2 shrink-0 ${
              error ? "bg-brick-50 border-brick-200 text-brick-600" : "bg-forest-50 border-forest-200 text-forest-700"
            }`}
          >
            <span>{error || notice}</span>
            {error && (
              <button onClick={() => setError(null)} className="cursor-pointer text-brick-600 hover:text-ink" title="Dismiss">
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Add / edit form */}
        {editing && (
          <form
            onSubmit={save}
            className="m-3 p-3 rounded-xl bg-sand-50 border border-sand-200 grid grid-cols-1 md:grid-cols-2 gap-2 shrink-0"
          >
            <div className="md:col-span-2 text-xs font-bold text-ink">
              {editing === "new" ? "New point of interest" : "Edit point of interest"}
            </div>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name, e.g. Gunung Gede (TNGGP)"
              aria-label="Name"
              maxLength={120}
              required
              className={inputClass}
            />
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as PoiCategory })}
              aria-label="Category"
              className={`${inputClass} cursor-pointer`}
            >
              {POI_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {POI_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <input
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              placeholder="Subtitle (optional), e.g. 2.958 mdpl or Permanent"
              aria-label="Subtitle"
              maxLength={120}
              className={`${inputClass} md:col-span-2`}
            />
            <div className="md:col-span-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                placeholder="Latitude, e.g. -6.78991"
                aria-label="Latitude"
                inputMode="decimal"
                className={`${inputClass} font-mono`}
              />
              <input
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                placeholder="Longitude, e.g. 106.9832"
                aria-label="Longitude"
                inputMode="decimal"
                className={`${inputClass} font-mono`}
              />
              <button
                type="button"
                onClick={useMapCenter}
                className="cursor-pointer shrink-0 flex items-center gap-1 px-2.5 rounded-lg bg-white border border-sand-200 hover:bg-sand-100 text-sand-700 text-[11px] font-bold"
                title="Use the centre of the map (move the map to the spot first)"
              >
                <Crosshair size={13} /> Map centre
              </button>
            </div>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description (optional): access, routes, notes"
              aria-label="Description"
              maxLength={2000}
              rows={3}
              className={`${inputClass} md:col-span-2 resize-y`}
            />
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-sand-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="accent-forest-700"
                />
                Show on the map
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="cursor-pointer px-3 py-2 rounded-lg bg-white hover:bg-sand-100 text-sand-700 text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editing === "new" ? "Add Point" : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* List */}
        <ScrollShadowArea
          wrapperClassName="flex-1"
          className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2"
          onReachEnd={showMoreRows}
        >
          {isLoading && pois.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-sand-500">
              <Loader2 size={16} className="animate-spin" /> Loading points...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-sand-500">No points of interest found</div>
          ) : (
            <>
              {filtered.slice(0, rowLimit).map((p) => {
                const isBusy = busyId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-xl border transition-colors flex items-center gap-3 ${
                      p.isPublished ? "bg-sand-50 border-sand-100 hover:border-sand-200" : "bg-white border-dashed border-sand-300 opacity-70"
                    }`}
                  >
                    <div className="w-8 h-8 shrink-0 rounded-full bg-white border border-sand-200 flex items-center justify-center">
                      <img src={ICONS[p.category]} alt="" className="w-4 h-4 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-ink truncate">{p.name}</span>
                        {!p.isPublished && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-sand-100 text-sand-600 shrink-0">Hidden</span>
                        )}
                      </div>
                      <div className="text-[10px] text-sand-500 truncate">
                        {POI_CATEGORY_LABELS[p.category]}
                        {p.subtitle && ` · ${p.subtitle}`} · {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => showOnMap(p)}
                        className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink"
                        title="Show on the map"
                      >
                        <Navigation size={14} />
                      </button>
                      <button
                        onClick={() => startEdit(p)}
                        className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => togglePublished(p)}
                        disabled={isBusy}
                        className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink disabled:opacity-50"
                        title={p.isPublished ? "Hide from the map" : "Show on the map"}
                      >
                        {p.isPublished ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      {confirmDeleteId === p.id ? (
                        <>
                          <button
                            onClick={() => remove(p)}
                            disabled={isBusy}
                            className="cursor-pointer p-1.5 rounded-lg bg-brick-50 hover:bg-brick-100 text-brick-600"
                            title="Confirm delete"
                          >
                            {isBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600"
                            title="Cancel"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(p.id)}
                          className="cursor-pointer p-1.5 rounded-lg hover:bg-brick-50 text-brick-600"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length > rowLimit && (
                <div className="py-2 text-center text-[10px] text-sand-500">
                  Showing {rowLimit} of {filtered.length} ·{" "}
                  <button onClick={showMoreRows} className="cursor-pointer font-bold text-forest-700 hover:underline">
                    Show more
                  </button>
                </div>
              )}
            </>
          )}
        </ScrollShadowArea>
      </div>
    </div>
  );
};
