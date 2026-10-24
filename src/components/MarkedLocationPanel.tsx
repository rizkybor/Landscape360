import { useEffect, useMemo, useState } from "react";
import {
  Binoculars,
  Check,
  Crosshair,
  DoorOpen,
  Download,
  Droplets,
  Flag,
  House,
  Loader2,
  LocateFixed,
  Lock,
  LogOut,
  MapPin,
  MapPinned,
  MapPinPlus,
  Mountain,
  Pencil,
  RefreshCw,
  Search,
  Share2,
  SquareParking,
  Tent,
  Trash2,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useSurveyStore } from "../store/useSurveyStore";
import { useMapStore } from "../store/useMapStore";
import { useTrackRecorderStore } from "../store/useTrackRecorderStore";
import { useMarkedLocationStore } from "../store/useMarkedLocationStore";
import { MarkedLocationShareManager } from "./MarkedLocationShareManager";
import { CONTACT_ADMIN_LABEL } from "../config";
import {
  CATEGORY_META,
  getMarkedLocationPolicy,
  isValidCoordinate,
  parseTags,
  toGpx,
} from "../utils/markedLocations";
import {
  MARKED_LOCATION_CATEGORIES,
  type MarkedLocation,
  type MarkedLocationCategory,
} from "../types/markedLocation";

const CATEGORY_ICONS: Record<MarkedLocationCategory, LucideIcon> = {
  poi: MapPin,
  camp: Tent,
  summit: Mountain,
  water: Droplets,
  shelter: House,
  viewpoint: Binoculars,
  trailhead: Flag,
  hazard: TriangleAlert,
  cave: DoorOpen,
  parking: SquareParking,
};

type Tab = "mine" | "shared" | "all";

interface FormState {
  name: string;
  category: MarkedLocationCategory;
  lat: string;
  lng: string;
  elevation: string;
  address: string;
  contact: string;
  description: string;
  tags: string;
}

const emptyForm: FormState = {
  name: "",
  category: "poi",
  lat: "",
  lng: "",
  elevation: "",
  address: "",
  contact: "",
  description: "",
  tags: "",
};

const toForm = (l: MarkedLocation): FormState => ({
  name: l.name,
  category: l.category,
  lat: String(l.lat),
  lng: String(l.lng),
  elevation: l.elevationM != null ? String(l.elevationM) : "",
  address: l.address ?? "",
  contact: l.contact ?? "",
  description: l.description ?? "",
  tags: l.tags.join(", "),
});

const roundCoord = (value: number) => String(Math.round(value * 1e6) / 1e6);

const inputClass =
  "w-full bg-sand-50 border border-sand-200 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-sand-500 outline-none focus:border-gold-300";
const labelClass = "text-[9px] uppercase font-bold tracking-wider text-sand-500";

const downloadFile = (filename: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const MarkedLocationPanel = () => {
  const { user, subscriptionStatus, isAdmin, isPlotMode, setPlotMode } = useSurveyStore();
  const policy = getMarkedLocationPolicy({ hasUser: !!user, subscriptionStatus, isAdmin });
  const triggerFlyTo = useMapStore((s) => s.triggerFlyTo);
  const isTrackRecorderOpen = useTrackRecorderStore((s) => s.isPanelOpen);

  const {
    isPanelOpen,
    setPanelOpen,
    locations,
    sharedLocations,
    adminLocations,
    isLoading,
    error,
    clearError,
    selectedId,
    select,
    isPicking,
    pickedPoint,
    startPicking,
    stopPicking,
    setPickedPoint,
    showAllOnMap,
    setShowAllOnMap,
    init,
    reset,
    loadLocations,
    loadShared,
    loadAll,
    createLocation,
    updateLocation,
    deleteLocation,
    leaveShared,
  } = useMarkedLocationStore();

  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const [formMode, setFormMode] = useState<{ editingId: string | null } | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [sharingIds, setSharingIds] = useState<string[] | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Load on login, clear on logout
  const userId = user?.id ?? null;
  useEffect(() => {
    if (userId) init(userId);
    else reset();
  }, [userId, init, reset]);

  // The Track Recorder panel uses the same spot on screen
  useEffect(() => {
    if (isTrackRecorderOpen) setPanelOpen(false);
  }, [isTrackRecorderOpen, setPanelOpen]);

  // Fill the form with a position picked on the map
  useEffect(() => {
    if (!pickedPoint) return;
    setForm((f) => ({
      ...f,
      lat: roundCoord(pickedPoint.lat),
      lng: roundCoord(pickedPoint.lng),
      elevation: pickedPoint.elevationM != null ? String(pickedPoint.elevationM) : f.elevation,
    }));
  }, [pickedPoint]);

  const tabLocations: MarkedLocation[] =
    tab === "mine" ? locations : tab === "shared" ? sharedLocations : adminLocations;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tabLocations;
    return tabLocations.filter((l) =>
      [l.name, l.address, l.description, l.contact, ...l.tags, CATEGORY_META[l.category]?.label]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [tabLocations, query]);

  if (!user || !policy.canUse) return null;

  const atLimit = policy.maxLocations !== null && locations.length >= policy.maxLocations;
  const usageLabel =
    policy.maxLocations === null ? `${locations.length} · Unlimited` : `${locations.length} / ${policy.maxLocations}`;

  const ownerOf = (l: MarkedLocation) => {
    if (tab === "shared") {
      const s = sharedLocations.find((x) => x.id === l.id);
      return s ? (s.ownerName ?? s.ownerEmailMasked) : null;
    }
    if (tab === "all") {
      const a = adminLocations.find((x) => x.id === l.id);
      return a ? (a.ownerEmail ?? a.ownerName) : null;
    }
    return null;
  };

  const canEdit = (l: MarkedLocation) => l.userId === user.id || isAdmin;

  // --- Tabs / list actions

  const switchTab = (next: Tab) => {
    setTab(next);
    setCheckedIds([]);
    setSharingIds(null);
    setConfirmDeleteId(null);
    if (next === "mine") loadLocations();
    if (next === "shared") loadShared();
    if (next === "all") loadAll();
  };

  const refresh = () => (tab === "mine" ? loadLocations() : tab === "shared" ? loadShared() : loadAll());

  const focus = (l: MarkedLocation) => {
    select(l.id);
    triggerFlyTo({ center: [l.lng, l.lat], zoom: Math.max(useMapStore.getState().zoom, 15) });
  };

  const toggleChecked = (id: string) =>
    setCheckedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const exportGpx = (items: MarkedLocation[]) => {
    if (items.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`landscape360-locations-${stamp}.gpx`, toGpx(items), "application/gpx+xml");
  };

  const runBusy = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await action();
    } catch (err) {
      useMarkedLocationStore.setState({ error: (err as Error).message });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (l: MarkedLocation) =>
    runBusy(l.id, async () => {
      await deleteLocation(l.id);
      setCheckedIds((ids) => ids.filter((x) => x !== l.id));
      setConfirmDeleteId(null);
    });

  const handleLeave = (l: MarkedLocation) =>
    runBusy(l.id, async () => {
      await leaveShared(l.id);
      setConfirmDeleteId(null);
    });

  // --- Form

  const openCreate = () => {
    setForm({ ...emptyForm });
    setFormError(null);
    setPickedPoint(null);
    setFormMode({ editingId: null });
  };

  const openEdit = (l: MarkedLocation) => {
    setForm(toForm(l));
    setFormError(null);
    setPickedPoint(null);
    setFormMode({ editingId: l.id });
  };

  const closeForm = () => {
    setFormMode(null);
    setPickedPoint(null);
    stopPicking();
  };

  const handlePickOnMap = () => {
    // A map click would otherwise also add a Navigator survey point
    if (isPlotMode) setPlotMode(false);
    select(null);
    startPicking();
  };

  const fillFromMapCenter = () => {
    const [lng, lat] = useMapStore.getState().center;
    setForm((f) => ({ ...f, lat: roundCoord(lat), lng: roundCoord(lng) }));
  };

  const fillFromGps = () => {
    if (!navigator.geolocation) {
      setFormError("Location is not available on this device");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setForm((f) => ({
          ...f,
          lat: roundCoord(pos.coords.latitude),
          lng: roundCoord(pos.coords.longitude),
          elevation: pos.coords.altitude != null ? String(Math.round(pos.coords.altitude)) : f.elevation,
        }));
      },
      (err) => {
        setIsLocating(false);
        setFormError(`Could not get your location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = Number(form.lat);
    const lng = Number(form.lng);
    const elevation = form.elevation.trim() === "" ? null : Number(form.elevation);

    if (!form.name.trim()) return setFormError("Name is required");
    if (form.lat.trim() === "" || form.lng.trim() === "" || !isValidCoordinate(lng, lat)) {
      return setFormError("Set a valid position: pick it on the map or enter latitude and longitude");
    }
    if (elevation !== null && !Number.isFinite(elevation)) return setFormError("Elevation must be a number");

    const input = {
      name: form.name.trim(),
      category: form.category,
      lat,
      lng,
      elevationM: elevation,
      address: form.address,
      contact: form.contact,
      description: form.description,
      tags: parseTags(form.tags),
    };

    setIsSaving(true);
    setFormError(null);
    try {
      const saved = formMode?.editingId
        ? await updateLocation(formMode.editingId, input)
        : await createLocation(input);
      closeForm();
      focus(saved);
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  // Compact bar while picking, so the map is free to click (the form keeps its state)
  if (isPanelOpen && isPicking) {
    return (
      <div className="fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-white/95 backdrop-blur-md border border-gold-300 text-ink text-xs shadow-2xl">
        <Crosshair size={14} className="text-gold-700 animate-pulse" />
        <span className="font-bold">Tap the map to place the location</span>
        <button
          onClick={stopPicking}
          className="cursor-pointer px-2 py-0.5 rounded-full bg-sand-100 hover:bg-sand-200 text-sand-700 font-bold"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (!isPanelOpen) return null;

  const checkedLocations = tabLocations.filter((l) => checkedIds.includes(l.id));

  return (
    <div className="fixed z-[60] left-3 right-3 bottom-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:bottom-6 md:w-[420px] max-h-[70vh] flex flex-col bg-white/95 backdrop-blur-md border border-gold-200 rounded-xl text-ink shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-sand-200 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <MapPinned size={16} className="text-gold-700 shrink-0" />
          <h3 className="text-sm font-bold truncate">Marked Locations</h3>
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 ${
              atLimit ? "bg-brick-50 text-brick-600 border-brick-200" : "bg-gold-50 text-gold-700 border-gold-200"
            }`}
            title={isAdmin ? "Admin · All Access" : `${subscriptionStatus} plan`}
          >
            {usageLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setPanelOpen(false)}
            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {!formMode && (
        <div className="flex gap-1 p-2 border-b border-sand-100 shrink-0">
          {(["mine", "shared", ...(isAdmin ? (["all"] as const) : [])] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              className={`cursor-pointer flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                tab === t ? "bg-gold-50 text-gold-700" : "text-sand-600 hover:bg-sand-50"
              }`}
            >
              {t === "mine"
                ? `Mine (${locations.length})`
                : t === "shared"
                  ? `Shared (${sharedLocations.length})`
                  : `All Users${adminLocations.length ? ` (${adminLocations.length})` : ""}`}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mx-3 mt-2 text-[11px] p-2 rounded-lg border bg-brick-50 border-brick-200 text-brick-600 flex justify-between items-start gap-2 shrink-0">
          <span>{error}</span>
          <button onClick={clearError} className="cursor-pointer text-brick-600 hover:text-ink shrink-0">
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3">
        {formMode ? (
          /* --- Create / edit form --- */
          <form onSubmit={handleSave} className="space-y-2.5">
            <div className="text-xs font-bold">{formMode.editingId ? "Edit location" : "New location"}</div>

            <div className="space-y-1">
              <label className={labelClass}>Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={120}
                required
                placeholder="e.g. Pos 3 Gunung Gede"
                className={inputClass}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Category</label>
              <div className="grid grid-cols-5 gap-1">
                {MARKED_LOCATION_CATEGORIES.map((c) => {
                  const Icon = CATEGORY_ICONS[c];
                  const active = form.category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, category: c })}
                      className={`cursor-pointer flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-[9px] leading-tight transition-colors ${
                        active ? "border-gold-300 bg-gold-50 text-ink" : "border-sand-200 bg-sand-50 text-sand-600 hover:bg-sand-100"
                      }`}
                      title={CATEGORY_META[c].label}
                    >
                      <Icon size={14} style={{ color: CATEGORY_META[c].color }} />
                      <span className="truncate w-full text-center">{CATEGORY_META[c].label.split(" ")[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Position *</label>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={handlePickOnMap}
                  className="cursor-pointer flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gold-500 hover:bg-gold-400 text-white text-[10px] font-bold"
                >
                  <Crosshair size={12} /> Pick on map
                </button>
                <button
                  type="button"
                  onClick={fillFromMapCenter}
                  className="cursor-pointer flex items-center justify-center gap-1 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-ink text-[10px] font-bold"
                >
                  <MapPin size={12} /> Map center
                </button>
                <button
                  type="button"
                  onClick={fillFromGps}
                  disabled={isLocating}
                  className="cursor-pointer flex items-center justify-center gap-1 py-1.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-ink text-[10px] font-bold disabled:opacity-50"
                >
                  {isLocating ? <Loader2 size={12} className="animate-spin" /> : <LocateFixed size={12} />} My GPS
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <input
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  inputMode="decimal"
                  placeholder="Latitude"
                  aria-label="Latitude"
                  className={`${inputClass} font-mono`}
                />
                <input
                  value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })}
                  inputMode="decimal"
                  placeholder="Longitude"
                  aria-label="Longitude"
                  className={`${inputClass} font-mono`}
                />
                <input
                  value={form.elevation}
                  onChange={(e) => setForm({ ...form, elevation: e.target.value })}
                  inputMode="decimal"
                  placeholder="Elev. (m)"
                  aria-label="Elevation"
                  className={`${inputClass} font-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={labelClass}>Area / Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  maxLength={200}
                  placeholder="Village, district"
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Contact</label>
                <input
                  value={form.contact}
                  onChange={(e) => setForm({ ...form, contact: e.target.value })}
                  maxLength={120}
                  placeholder="Ranger, phone"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={2000}
                rows={3}
                placeholder="Access, conditions, water availability, notes..."
                className={`${inputClass} resize-none`}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Tags</label>
              <input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="Comma separated, e.g. basecamp, water, 2024"
                className={inputClass}
              />
            </div>

            {formError && <div className="text-[11px] text-brick-600">{formError}</div>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closeForm}
                className="cursor-pointer px-3 py-2 rounded-lg bg-sand-50 hover:bg-sand-100 text-sand-700 text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {formMode.editingId ? "Save Changes" : "Save Location"}
              </button>
            </div>
          </form>
        ) : (
          /* --- Lists --- */
          <div className="space-y-2">
            {tab === "mine" && !policy.canShare && (
              <div className="p-2 rounded-lg bg-sand-50 border border-sand-200 text-[10px] text-sand-700 flex items-start gap-2">
                <Lock size={12} className="shrink-0 mt-0.5 text-sand-500" />
                <span>
                  {subscriptionStatus} plan: up to {policy.maxLocations} locations. Sharing with other users needs Pro
                  or Enterprise. <strong className="text-gold-700">{CONTACT_ADMIN_LABEL}</strong> to upgrade.
                </span>
              </div>
            )}

            {tab === "all" && (
              <label className="flex items-center gap-2 p-2 rounded-lg bg-forest-50 border border-forest-200 text-[11px] text-forest-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllOnMap}
                  onChange={(e) => setShowAllOnMap(e.target.checked)}
                  className="accent-forest-700"
                />
                Show every account's locations on the map
              </label>
            )}

            <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sand-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, tag, area..."
                  className={`${inputClass} pl-8`}
                />
              </div>
              <button
                onClick={() => exportGpx(filtered)}
                disabled={filtered.length === 0}
                className="cursor-pointer shrink-0 p-2 rounded-lg bg-sand-50 border border-sand-200 hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors disabled:opacity-40"
                title="Export the listed locations as GPX"
              >
                <Download size={14} />
              </button>
              {tab === "mine" && (
                <button
                  onClick={openCreate}
                  disabled={atLimit}
                  className="cursor-pointer shrink-0 flex items-center gap-1 px-3 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={atLimit ? `Limit of ${policy.maxLocations} locations reached` : "Add a location"}
                >
                  <MapPinPlus size={14} /> Add
                </button>
              )}
            </div>

            {tab === "mine" && atLimit && (
              <p className="text-[10px] text-brick-600">
                You have reached the {policy.maxLocations}-location limit of your plan. Delete a location or{" "}
                {CONTACT_ADMIN_LABEL.toLowerCase()} to upgrade.
              </p>
            )}

            {checkedIds.length > 0 && (
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-gold-50 border border-gold-200">
                <span className="text-[11px] font-bold text-gold-700 flex-1">{checkedIds.length} selected</span>
                {tab === "mine" && policy.canShare && (
                  <button
                    onClick={() => setSharingIds(checkedIds)}
                    className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg bg-gold-500 hover:bg-gold-400 text-white text-[10px] font-bold"
                  >
                    <Share2 size={11} /> Share
                  </button>
                )}
                <button
                  onClick={() => exportGpx(checkedLocations)}
                  className="cursor-pointer flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-gold-200 hover:bg-gold-100 text-gold-700 text-[10px] font-bold"
                >
                  <Download size={11} /> GPX
                </button>
                <button
                  onClick={() => {
                    setCheckedIds([]);
                    setSharingIds(null);
                  }}
                  className="cursor-pointer p-1 rounded hover:bg-gold-100 text-gold-700"
                  title="Clear selection"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {sharingIds && sharingIds.length > 1 && (
              <MarkedLocationShareManager
                locationIds={sharingIds}
                onClose={() => setSharingIds(null)}
                onShared={() => setCheckedIds([])}
              />
            )}

            {isLoading && tabLocations.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-sand-500">
                <Loader2 size={14} className="animate-spin" /> Loading locations...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-sand-500">
                {query
                  ? "No locations match your search"
                  : tab === "mine"
                    ? "No marked locations yet. Press Add to save your first place."
                    : tab === "shared"
                      ? "Nobody has shared a location with you yet"
                      : "No locations saved by any account yet"}
              </div>
            ) : (
              filtered.map((l) => {
                const Icon = CATEGORY_ICONS[l.category] ?? MapPin;
                const owner = ownerOf(l);
                const isSelected = selectedId === l.id;
                const isBusy = busyId === l.id;
                const isOwn = l.userId === user.id;
                return (
                  <div
                    key={l.id}
                    className={`p-2.5 rounded-xl border transition-colors ${
                      isSelected ? "bg-gold-50 border-gold-300" : "bg-sand-50 border-sand-100 hover:border-sand-200"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checkedIds.includes(l.id)}
                        onChange={() => toggleChecked(l.id)}
                        className="mt-1 accent-gold-500 cursor-pointer"
                        aria-label={`Select ${l.name}`}
                      />
                      <button onClick={() => focus(l)} className="cursor-pointer flex-1 min-w-0 text-left" title="Show on map">
                        <div className="flex items-center gap-1.5">
                          <Icon size={13} className="shrink-0" style={{ color: CATEGORY_META[l.category]?.color }} />
                          <span className="text-xs font-bold text-ink truncate">{l.name}</span>
                        </div>
                        <div className="text-[10px] text-sand-500 truncate">
                          {CATEGORY_META[l.category]?.label}
                          {l.elevationM != null && ` · ${Math.round(l.elevationM)} m`}
                          {l.address && ` · ${l.address}`}
                        </div>
                        {owner && <div className="text-[10px] text-gold-700 truncate">By {owner}</div>}
                        {l.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {l.tags.map((tag) => (
                              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white border border-sand-200 text-sand-600">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        {isBusy && <Loader2 size={13} className="animate-spin text-sand-600" />}
                        {isOwn && policy.canShare && (
                          <button
                            onClick={() => setSharingIds(sharingIds?.length === 1 && sharingIds[0] === l.id ? null : [l.id])}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-gold-50 text-gold-700 transition-colors"
                            title="Share this location"
                          >
                            <Share2 size={13} />
                          </button>
                        )}
                        {canEdit(l) && (
                          <button
                            onClick={() => openEdit(l)}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                        )}
                        {confirmDeleteId === l.id ? (
                          <>
                            <button
                              onClick={() => (tab === "shared" ? handleLeave(l) : handleDelete(l))}
                              disabled={isBusy}
                              className="cursor-pointer p-1.5 rounded-lg bg-brick-50 hover:bg-brick-100 text-brick-600 transition-colors"
                              title="Confirm"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 transition-colors"
                              title="Cancel"
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : tab === "shared" ? (
                          <button
                            onClick={() => setConfirmDeleteId(l.id)}
                            className="cursor-pointer p-1.5 rounded-lg hover:bg-brick-50 text-brick-600 transition-colors"
                            title="Remove from my list"
                          >
                            <LogOut size={13} />
                          </button>
                        ) : (
                          canEdit(l) && (
                            <button
                              onClick={() => setConfirmDeleteId(l.id)}
                              className="cursor-pointer p-1.5 rounded-lg hover:bg-brick-50 text-brick-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {confirmDeleteId === l.id && (
                      <div className="mt-1.5 text-[10px] text-brick-600">
                        {tab === "shared"
                          ? "Remove this location from your list? The owner keeps it."
                          : isOwn
                            ? "Delete this location permanently? People you shared it with lose access."
                            : "Delete this location from the owner's account permanently?"}
                      </div>
                    )}

                    {sharingIds?.length === 1 && sharingIds[0] === l.id && (
                      <MarkedLocationShareManager locationIds={[l.id]} onClose={() => setSharingIds(null)} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
