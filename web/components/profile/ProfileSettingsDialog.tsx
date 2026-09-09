"use client";

import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { LocalImagePicker } from "@/components/profile/LocalImagePicker";
import { getBodyMeasurementCoverage } from "@/lib/profile-dashboard";
import {
  STYLE_AESTHETICS,
  FIT_PREFERENCES,
  COLOR_PALETTE,
  BRANDS,
  BUDGET_RANGES,
  OUTFIT_GOALS,
} from "@/lib/profile-options";
import { api, auth, avatar, ApiError } from "@/lib/api";
import { useAvatarStatus } from "@/lib/hooks/useAvatarStatus";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Lock, Camera } from "lucide-react";

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: number;
    name: string | null;
    email: string;
    username?: string | null;
    profileVisibility?: string;
    styleAesthetics?: string[] | null;
    fitPreferences?: string[] | null;
    [key: string]: unknown;
  };
  surface: {
    avatarDataUrl: string | null;
    bannerDataUrl: string | null;
    bio: string;
  };
  onUpdateSurface: (updates: Partial<{ avatarDataUrl: string; bannerDataUrl: string; bio: string }>) => void;
  onUserRefresh: () => void;
}

const MEASUREMENT_FIELDS: Array<{ key: string; label: string }> = [
  { key: "heightCm", label: "Height (cm)" },
  { key: "weightKg", label: "Weight (kg)" },
  { key: "chestCm", label: "Bust/Chest (cm)" },
  { key: "waistCm", label: "Waist (cm)" },
  { key: "hipsCm", label: "Hips (cm)" },
  { key: "shoulderWidthCm", label: "Shoulder Width (cm)" },
  { key: "inseamCm", label: "Inseam (cm)" },
  { key: "shoeSize", label: "Shoe Size" },
  { key: "topSize", label: "Top Size" },
  { key: "bottomSize", label: "Bottom Size" },
  { key: "dressSize", label: "Dress Size" },
  { key: "jacketSize", label: "Jacket Size" },
];

const NUMERIC_MEASUREMENT_KEYS = new Set([
  "heightCm", "weightKg", "chestCm", "waistCm",
  "hipsCm", "shoulderWidthCm", "inseamCm",
]);

export function ProfileSettingsDialog({
  open,
  onOpenChange,
  user,
  surface,
  onUpdateSurface,
  onUserRefresh,
}: ProfileSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("edit-profile");

  // Tab 1: Edit Profile state
  const [name, setName] = useState(user.name ?? "");
  const [username, setUsername] = useState(user.username ?? "");
  const [bio, setBio] = useState(surface.bio);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(surface.avatarDataUrl);
  const [bannerDataUrl, setBannerDataUrl] = useState<string | null>(surface.bannerDataUrl);
  const [profileVisibility, setProfileVisibility] = useState<"PUBLIC" | "PRIVATE">(
    (user.profileVisibility as "PUBLIC" | "PRIVATE") ?? "PUBLIC"
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // Tab 2: Style Preferences state
  const [selectedStyles, setSelectedStyles] = useState<string[]>(
    user.styleAesthetics ?? []
  );
  const [selectedFits, setSelectedFits] = useState<string[]>(
    user.fitPreferences ?? []
  );
  // Merged from the former /profile/preferences page.
  const [favoriteColors, setFavoriteColors] = useState<string[]>(
    (user.favoriteColors as string[] | undefined) ?? []
  );
  const [avoidedColors, setAvoidedColors] = useState<string[]>(
    (user.avoidedColors as string[] | undefined) ?? []
  );
  const [outfitGoals, setOutfitGoals] = useState<string[]>(
    (user.outfitGoals as string[] | undefined) ?? []
  );
  const [budgetRange, setBudgetRange] = useState<string>(
    (user.budgetRange as string | undefined) ?? ""
  );
  const [favoriteBrands, setFavoriteBrands] = useState<string[]>(
    (user.favoriteBrands as string[] | undefined) ?? []
  );
  const [sustainableInterest, setSustainableInterest] = useState<boolean>(
    (user.sustainableFashionInterest as boolean | undefined) ?? false
  );
  const [priceNote, setPriceNote] = useState<string>(
    (user.pricePreference as string | undefined) ?? ""
  );
  const [savingStyle, setSavingStyle] = useState(false);

  // Tab 3: Body Measurements state (loaded from /api/body-profile)
  const [measurements, setMeasurements] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {};
    for (const { key } of MEASUREMENT_FIELDS) {
      result[key] = "";
    }
    return result;
  });
  const [savingMeasurements, setSavingMeasurements] = useState(false);

  // Privacy: one-tap delete of avatar + body data (two-step confirm — irreversible)
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletingData, setDeletingData] = useState(false);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  // Gate the delete trigger while an avatar is generating so a concurrent
  // delete + in-flight generation can't race (M7 — mirrors the avatar page).
  const { status: avatarStatus } = useAvatarStatus();
  const isGenerating =
    avatarStatus?.status === "PENDING" || avatarStatus?.status === "RUNNING";

  // Move focus to Cancel when entering the two-step confirm so keyboard/SR users are
  // not left on <body>, one blind activation away from an irreversible delete (M10).
  useEffect(() => {
    if (confirmingDelete) cancelDeleteRef.current?.focus();
  }, [confirmingDelete]);

  // Re-sync local state when dialog reopens with fresh props
  useEffect(() => {
    // Clear the two-step delete confirm on every open/close toggle so a user who
    // enters confirm mode then dismisses (Esc/outside-click) never reopens into
    // "Confirm delete" — one accidental tap would irreversibly purge their data.
    setConfirmingDelete(false);
    setDeletingData(false);
    if (!open) return;
    setName(user.name ?? "");
    setUsername(user.username ?? "");
    setBio(surface.bio);
    setAvatarDataUrl(surface.avatarDataUrl);
    setBannerDataUrl(surface.bannerDataUrl);
    setProfileVisibility((user.profileVisibility as "PUBLIC" | "PRIVATE") ?? "PUBLIC");
    setSelectedStyles(user.styleAesthetics ?? []);
    setSelectedFits(user.fitPreferences ?? []);
    setFavoriteColors((user.favoriteColors as string[] | undefined) ?? []);
    setAvoidedColors((user.avoidedColors as string[] | undefined) ?? []);
    setOutfitGoals((user.outfitGoals as string[] | undefined) ?? []);
    setBudgetRange((user.budgetRange as string | undefined) ?? "");
    setFavoriteBrands((user.favoriteBrands as string[] | undefined) ?? []);
    setSustainableInterest(
      (user.sustainableFashionInterest as boolean | undefined) ?? false
    );
    setPriceNote((user.pricePreference as string | undefined) ?? "");

    // Fetch body measurements from the canonical source
    api
      .get<Record<string, unknown>>("/api/body-profile")
      .then((profile) => {
        const result: Record<string, string> = {};
        for (const { key } of MEASUREMENT_FIELDS) {
          const val = profile[key];
          result[key] = val !== undefined && val !== null ? String(val) : "";
        }
        setMeasurements(result);
      })
      .catch((err) => {
        // 404 means no profile yet — keep empty fields
        if (!(err instanceof ApiError && err.status === 404)) {
          console.error("Failed to load body profile", err);
        }
        const result: Record<string, string> = {};
        for (const { key } of MEASUREMENT_FIELDS) {
          result[key] = "";
        }
        setMeasurements(result);
      });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveProfile = useCallback(async () => {
    setSavingProfile(true);
    try {
      await auth.updateProfile({
        name: name || undefined,
        username: username.trim() || undefined,
        profileVisibility,
      });
      onUpdateSurface({
        bio,
        avatarDataUrl: avatarDataUrl ?? undefined,
        bannerDataUrl: bannerDataUrl ?? undefined,
      });
      onUserRefresh();
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }, [name, username, profileVisibility, bio, avatarDataUrl, bannerDataUrl, onUpdateSurface, onUserRefresh]);

  const handleSaveStyle = useCallback(async () => {
    setSavingStyle(true);
    try {
      await auth.updateProfile({
        styleAesthetics: selectedStyles,
        fitPreferences: selectedFits,
        favoriteColors,
        avoidedColors,
        outfitGoals,
        budgetRange: budgetRange || undefined,
        favoriteBrands,
        sustainableFashionInterest: sustainableInterest,
        pricePreference: priceNote || undefined,
      });
      onUserRefresh();
      toast.success("Style preferences updated");
    } catch {
      toast.error("Failed to update style preferences");
    } finally {
      setSavingStyle(false);
    }
  }, [
    selectedStyles,
    selectedFits,
    favoriteColors,
    avoidedColors,
    outfitGoals,
    budgetRange,
    favoriteBrands,
    sustainableInterest,
    priceNote,
    onUserRefresh,
  ]);

  const handleSaveMeasurements = useCallback(async () => {
    setSavingMeasurements(true);
    try {
      const payload: Record<string, string | number | null> = {};
      for (const { key } of MEASUREMENT_FIELDS) {
        const val = measurements[key];
        if (val !== "") {
          if (NUMERIC_MEASUREMENT_KEYS.has(key)) {
            const num = Number(val);
            if (Number.isNaN(num)) continue;
            payload[key] = num;
          } else {
            payload[key] = val;
          }
        } else {
          payload[key] = null;
        }
      }
      await api.post("/api/body-profile", payload);
      toast.success("Measurements updated");
    } catch {
      toast.error("Failed to update measurements");
    } finally {
      setSavingMeasurements(false);
    }
  }, [measurements]);

  const handleDeleteBodyData = useCallback(async () => {
    setDeletingData(true);
    try {
      await avatar.delete();
      toast.success("Your body data was deleted");
      setConfirmingDelete(false);
      // Clear the local measurement editor so the UI reflects the purge immediately.
      setMeasurements(() => {
        const cleared: Record<string, string> = {};
        for (const { key } of MEASUREMENT_FIELDS) cleared[key] = "";
        return cleared;
      });
      onUserRefresh();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to delete body data"
      );
    } finally {
      setDeletingData(false);
    }
  }, [onUserRefresh]);

  const handleActiveTabSave = useCallback(() => {
    if (activeTab === "edit-profile") return handleSaveProfile();
    if (activeTab === "style-preferences") return handleSaveStyle();
    if (activeTab === "body-measurements") return handleSaveMeasurements();
  }, [activeTab, handleSaveProfile, handleSaveStyle, handleSaveMeasurements]);

  const toggleStyle = useCallback((style: string) => {
    setSelectedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );
  }, []);

  const toggleFit = useCallback((fit: string) => {
    setSelectedFits((prev) =>
      prev.includes(fit) ? prev.filter((f) => f !== fit) : [...prev, fit]
    );
  }, []);

  // Generic multi-select toggle for the merged preference chip groups.
  const toggleValue = useCallback(
    (setter: Dispatch<SetStateAction<string[]>>, value: string) => {
      setter((prev) =>
        prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
      );
    },
    []
  );

  const measurementCoverage = getBodyMeasurementCoverage(
    measurements as unknown as Record<string, unknown>
  );

  const isSaving = savingProfile || savingStyle || savingMeasurements;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
      >
        <SheetHeader className="px-8 pt-8 pb-4 text-left">
          <SheetTitle className="text-xl font-semibold">Settings</SheetTitle>
        </SheetHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="px-8">
            <TabsList className="w-full justify-start bg-muted rounded-full p-1 h-auto gap-1">
              <TabsTrigger value="edit-profile" className="rounded-full text-xs px-4 py-1.5">
                Edit Profile
              </TabsTrigger>
              <TabsTrigger value="style-preferences" className="rounded-full text-xs px-4 py-1.5">
                Style Preferences
              </TabsTrigger>
              <TabsTrigger value="body-measurements" className="rounded-full text-xs px-4 py-1.5">
                Body Measurements
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Tab 1: Edit Profile */}
          <TabsContent value="edit-profile" className="px-8 py-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Identity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="settings-name" className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    id="settings-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="settings-username" className="text-xs text-muted-foreground">Username</Label>
                  <Input
                    id="settings-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="@username"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-bio" className="text-xs text-muted-foreground">Bio</Label>
                <Textarea
                  id="settings-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell people about your style..."
                  rows={3}
                  className="rounded-xl resize-none"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Appearance</h3>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex items-center justify-center border border-border">
                    {avatarDataUrl ? (
                      <img src={avatarDataUrl} alt="Avatar preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Profile photo</p>
                    <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP</p>
                  </div>
                </div>
                <LocalImagePicker onSelect={(url) => setAvatarDataUrl(url)} maxDimension={400}>
                  <Button variant="outline" size="sm" className="rounded-full text-xs" type="button">
                    Change photo
                  </Button>
                </LocalImagePicker>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-10 rounded-lg bg-muted overflow-hidden flex items-center justify-center border border-border">
                    {bannerDataUrl ? (
                      <img src={bannerDataUrl} alt="Banner preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Banner photo</p>
                    <p className="text-xs text-muted-foreground">Recommended 1200px wide</p>
                  </div>
                </div>
                <LocalImagePicker onSelect={(url) => setBannerDataUrl(url)} maxDimension={1200}>
                  <Button variant="outline" size="sm" className="rounded-full text-xs" type="button">
                    Change banner
                  </Button>
                </LocalImagePicker>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Privacy</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Profile visibility</p>
                  <p className="text-xs text-muted-foreground">Control who can see your profile</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setProfileVisibility("PUBLIC")}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      profileVisibility === "PUBLIC"
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileVisibility("PRIVATE")}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      profileVisibility === "PRIVATE"
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    Private
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Body data</p>
                  <p className="text-xs text-muted-foreground">Your measurements are never shared</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Always private</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Delete body data</p>
                  <p className="text-xs text-muted-foreground">
                    Permanently removes your avatar and measurements. This cannot be undone.
                  </p>
                </div>
                {confirmingDelete ? (
                  <div className="flex gap-2" aria-live="polite">
                    <Button
                      ref={cancelDeleteRef}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full text-xs"
                      disabled={deletingData}
                      onClick={() => setConfirmingDelete(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="rounded-full text-xs"
                      disabled={deletingData}
                      onClick={handleDeleteBodyData}
                    >
                      {deletingData ? "Deleting..." : "Confirm delete"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="rounded-full text-xs"
                    aria-expanded={confirmingDelete}
                    disabled={isGenerating}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    Delete my avatar &amp; body data
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Tab 2: Style Preferences */}
          <TabsContent value="style-preferences" className="px-8 py-6 space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Style Aesthetics</h3>
              <p className="text-xs text-muted-foreground">Select all that resonate with your style</p>
              <div className="flex flex-wrap gap-2">
                {STYLE_AESTHETICS.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => toggleStyle(style)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      selectedStyles.includes(style)
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Fit Preferences</h3>
              <p className="text-xs text-muted-foreground">How do you like your clothes to fit?</p>
              <div className="flex flex-wrap gap-2">
                {FIT_PREFERENCES.map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => toggleFit(fit)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      selectedFits.includes(fit)
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Colors */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Favorite Colors</h3>
              <p className="text-xs text-muted-foreground">Shades you reach for</p>
              <div className="flex flex-wrap gap-3">
                {COLOR_PALETTE.map(({ name, hex }) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => toggleValue(setFavoriteColors, name)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg p-1 transition-all",
                      favoriteColors.includes(name)
                        ? "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                        : "opacity-80 hover:opacity-100"
                    )}
                  >
                    <span
                      className="h-8 w-8 rounded-full border border-border shadow-sm"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-[10px] text-muted-foreground">{name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Colors to Avoid</h3>
              <p className="text-xs text-muted-foreground">Shades to keep out of your edit</p>
              <div className="flex flex-wrap gap-3">
                {COLOR_PALETTE.map(({ name, hex }) => (
                  <button
                    key={name}
                    type="button"
                    title={name}
                    onClick={() => toggleValue(setAvoidedColors, name)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg p-1 transition-all",
                      avoidedColors.includes(name)
                        ? "ring-2 ring-destructive ring-offset-2 ring-offset-background"
                        : "opacity-80 hover:opacity-100"
                    )}
                  >
                    <span
                      className="h-8 w-8 rounded-full border border-border shadow-sm"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-[10px] text-muted-foreground">{name}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Outfit goals */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Outfit Goals</h3>
              <p className="text-xs text-muted-foreground">What are you dressing for?</p>
              <div className="flex flex-wrap gap-2">
                {OUTFIT_GOALS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggleValue(setOutfitGoals, goal)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      outfitGoals.includes(goal)
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Budget & brands */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Budget Range</h3>
              <p className="text-xs text-muted-foreground">Your typical spend per piece</p>
              <div className="flex flex-wrap gap-2">
                {BUDGET_RANGES.map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() =>
                      setBudgetRange((prev) => (prev === range ? "" : range))
                    }
                    className={cn(
                      "rounded-full px-4 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      budgetRange === range
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Favorite Brands</h3>
              <p className="text-xs text-muted-foreground">Labels you love</p>
              <div className="flex flex-wrap gap-2">
                {BRANDS.map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => toggleValue(setFavoriteBrands, brand)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors",
                      favoriteBrands.includes(brand)
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="settings-sustainable"
                checked={sustainableInterest}
                onCheckedChange={(checked) => setSustainableInterest(checked === true)}
              />
              <Label htmlFor="settings-sustainable" className="cursor-pointer text-sm">
                I prefer sustainable / ethical fashion brands
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settings-price-note" className="text-xs text-muted-foreground">
                Price Notes
              </Label>
              <Input
                id="settings-price-note"
                placeholder="e.g. I prefer quality over quantity"
                value={priceNote}
                onChange={(e) => setPriceNote(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </TabsContent>

          {/* Tab 3: Body Measurements */}
          <TabsContent value="body-measurements" className="px-8 py-6 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Measurement Editor</h3>
                <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                  <Lock className="w-3 h-3" />
                  Private
                </Badge>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Profile completeness</span>
                  <span>{measurementCoverage}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all duration-300"
                    style={{ width: `${measurementCoverage}%` }}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              {MEASUREMENT_FIELDS.map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`measurement-${key}`} className="text-xs text-muted-foreground">
                    {label}
                  </Label>
                  <Input
                    id={`measurement-${key}`}
                    value={measurements[key]}
                    onChange={(e) =>
                      setMeasurements((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    placeholder="—"
                    className="rounded-xl text-sm"
                  />
                </div>
              ))}
            </div>
          </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-8 py-5 border-t border-border">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full text-sm"
          >
            Close
          </Button>
          <Button
            onClick={handleActiveTabSave}
            disabled={isSaving}
            className="rounded-full text-sm bg-foreground text-background hover:bg-foreground/90"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
