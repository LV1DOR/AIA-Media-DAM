"use client";
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  Suspense,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Folder,
  FolderPlus,
  Grid2X2,
  Image as ImageIcon,
  Layers,
  Link as LinkIcon,
  List,
  Loader2,
  Lock,
  LogOut,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UploadCloud,
  Video,
  X,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Users,
  File,
  ExternalLink,
  Tags,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import * as Dialog from "@radix-ui/react-dialog";
import { BulkTags } from "./components/tag-editor";
import { FilesSidebar } from "./components/files/sidebar";
import { FilesHeader } from "./components/files/header";
import { SidebarProvider } from "./components/ui/sidebar";
import { ImageGallery, GallerySkeleton } from "./components/ui/image-gallery";
import {
  orderAssets,
  nextSelection,
  buildNativeSearch,
  type GalleryMode,
  type GallerySort,
} from "./lib/gallery-model";
const AssetViewer = React.lazy(() => import("./components/asset-viewer"));
import {
  formatBytes,
  MAX_CHUNK,
  type Staff,
  type Asset,
  type Field,
  type Transfer,
} from "@aia/contracts";
type Product = "media" | "transfer";
import { api, post } from "./lib/api";
import { MfaChallenge } from "./components/mfa-challenge";
import { PASSWORD_HINT, PASSWORD_PATTERN } from "@aia/contracts";
import {
  AttachmentUpload,
  type AttachmentUploadItem,
} from "./components/beui/components/motion/attachment-upload";
import { StaffAvatar } from "./components/staff-avatar";
import { NewPassword } from "./components/new-password";
import { DownloadAllText } from "./components/download-all-text";
import { BackgroundSettings } from "./components/background-settings";
import { SignInBackground } from "./components/sign-in-background";
import { AccountCreation } from "./components/account-creation";
import GlassSurface from "./components/react-bits/GlassSurface";
import { ExpiryCountdown, useExpiry } from "./components/expiry-countdown";
const when = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      });
};
const initial = (name: string) =>
  name
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const stateLabel = (state: number) =>
  state === 0 ? "In library" : state === 2 ? "Archived" : "Unavailable";
function Brand({
  product = "media",
  light = false,
}: {
  product?: Product;
  light?: boolean;
}) {
  return (
    <a className={"brand " + (light ? "light" : "")} href="/">
      <img className="brand-logo" src="/aia-logo.png" alt="AIA" />
      <span className="brand-name">
        {product === "media" ? "Media" : "Transfer"}
        <small>ALGARVE INTERNATIONAL CIRCUIT</small>
      </span>
    </a>
  );
}
function IconFile({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  return (
    <span
      className={
        "file-icon " +
        (["jpg", "jpeg", "png", "tiff", "webp"].includes(ext || "")
          ? "image"
          : ext === "mp4" || ext === "mov"
            ? "video"
            : "")
      }
    >
      {["jpg", "jpeg", "png", "tiff", "webp"].includes(ext || "") ? (
        <ImageIcon size={22} />
      ) : ext === "mp4" || ext === "mov" ? (
        <Video size={22} />
      ) : (
        <File size={22} />
      )}
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
  panel = false,
  inline = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  panel?: boolean;
  inline?: boolean;
  className?: string;
}) {
  const opener = useRef<Element | null>(
    typeof document === "undefined" ? null : document.activeElement,
  );
  if (inline)
    return (
      <section
        id="transfer-upload"
        className="inline-upload"
        aria-label={title}
      >
        <h2 className="sr-only">{title}</h2>
        {children}
      </section>
    );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const target = opener.current;
            if (target instanceof HTMLElement && target.isConnected)
              target.focus();
            else document.querySelector<HTMLElement>("main")?.focus();
          }}
          className={
            "modal " +
            className +
            " " +
            (wide ? "wide " : "") +
            (panel ? "asset-detail-panel" : "")
          }
        >
          <div className="modal-head">
            <Dialog.Title asChild>
              <h2>{title}</h2>
            </Dialog.Title>
            <button
              className="icon-button"
              aria-label="Close dialog"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function ErrorText({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      <AlertCircle size={16} />
      {error}
    </p>
  ) : null;
}
function Login({
  product,
  onLogin,
}: {
  product: Product;
  onLogin: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [challenge, setChallenge] = useState<{ expiresAt: string } | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      const result = await post("/auth/login", {
        username: f.get("username"),
        password: f.get("password"),
      });
      if (result.mfaRequired) {
        form.reset();
        setChallenge(result);
      } else onLogin();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-screen centered-sign-in">
      <SignInBackground />
      <main className="login-panel">
        <div className="login-form">
          <div className="login-card-brand">
            <Brand product={product} />
          </div>
          {challenge ? (
            <MfaChallenge
              expiresAt={challenge.expiresAt}
              onBack={() => {
                setChallenge(null);
                setError("");
              }}
              onSuccess={onLogin}
            />
          ) : (
            <>
              <h2>Your workspace awaits.</h2>
              <p>Sign in with your staff account.</p>
              <form onSubmit={submit}>
                <label>
                  Username
                  <input
                    name="username"
                    autoComplete="username"
                    required
                    autoFocus
                    placeholder="Your username"
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="Your password"
                  />
                </label>
                <ErrorText error={error} />
                <button className="button primary full" disabled={busy}>
                  {busy ? (
                    <Loader2 className="spin" size={18} />
                  ) : (
                    <ArrowRight size={18} />
                  )}
                  Sign in
                </button>
              </form>
            </>
          )}
          <div className="login-note">
            <ShieldCheck size={18} />
            <span>
              Staff access only.
              <br />
              Contact your AIA administrator for an account or password reset.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
function MfaSetup({
  onDone,
  required = false,
}: {
  onDone: () => void;
  required?: boolean;
}) {
  const [setup, setSetup] = useState<{ uri: string; secret: string } | null>(
      null,
    ),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function start() {
    try {
      setSetup(await post("/auth/mfa/setup"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function confirm(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post("/auth/mfa/confirm", { code });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mfa-setup">
      <span className="large-icon">
        <ShieldCheck />
      </span>
      <h2>Secure your staff account</h2>
      <p>
        {required
          ? "Administrator accounts require an authenticator."
          : "Add an authenticator for an extra layer of protection."}{" "}
        Use an authenticator app to scan this code.
      </p>
      {!setup ? (
        <button className="button primary" onClick={start}>
          Set up authenticator
        </button>
      ) : (
        <>
          <div className="qr">
            <QRCodeSVG value={setup.uri} size={176} />
          </div>
          <details>
            <summary>Enter a setup key instead</summary>
            <code className="secret-key">{setup.secret}</code>
          </details>
          <form onSubmit={confirm}>
            <label>
              Code from your authenticator
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6}"
              />
            </label>
            <button className="button primary full" disabled={busy}>
              {busy ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Check size={16} />
              )}
              Confirm setup
            </button>
          </form>
        </>
      )}
      <ErrorText error={error} />
    </div>
  );
}
export function Workspace({ product }: { product: Product }) {
  const [user, setUser] = useState<Staff | null>(null),
    [loading, setLoading] = useState(true),
    [needsMfa, setNeedsMfa] = useState(false),
    [origins, setOrigins] = useState({ mediaUrl: "/", transferUrl: "/" }),
    [section, setSection] = useState(
      product === "media" ? "library" : "transfers",
    ),
    [search, setSearch] = useState(""),
    [searchChips, setSearchChips] = useState<string[]>([]),
    [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [page, setPage] = useState(0),
    [assets, setAssets] = useState<Asset[]>([]),
    [total, setTotal] = useState(0),
    [selected, setSelected] = useState<Set<number>>(new Set()),
    [collections, setCollections] = useState<any[]>([]),
    [transfers, setTransfers] = useState<Transfer[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [detail, setDetail] = useState<number | null>(null),
    [shareAssets, setShareAssets] = useState<Asset[] | null>(null),
    [uploadOpen, setUploadOpen] = useState(false),
    [transferDetail, setTransferDetail] = useState<Transfer | null>(null),
    [settings, setSettings] = useState(false),
    [resume, setResume] = useState<Transfer | null>(null),
    [viewMode, setViewMode] = useState<GalleryMode>("masonry"),
    [sort, setSort] = useState<GallerySort>("recent"),
    [viewerId, setViewerId] = useState<number | null>(null),
    [filterOpen, setFilterOpen] = useState(false),
    [metadataFilter, setMetadataFilter] = useState({
      year: "",
      event: "",
      championship: "",
    }),
    [collectionDialog, setCollectionDialog] = useState(false),
    [collectionTarget, setCollectionTarget] = useState<{
      ref: number;
      name: string;
    } | null>(null),
    [existingCollection, setExistingCollection] = useState(""),
    [collectionBusy, setCollectionBusy] = useState(false),
    [bulkTags, setBulkTags] = useState(false),
    [bulkEditing, setBulkEditing] = useState(false),
    [uploadVersion, setUploadVersion] = useState(0),
    [collectionName, setCollectionName] = useState("");
  const assetPool = useRef(new Map<number, Asset>()),
    selectionAnchor = useRef<number | null>(null),
    requestEpoch = useRef(0),
    selectedRef = useRef(selected);
  selectedRef.current = selected;
  const displayAssets = useMemo(
    () => orderAssets(assets, sort),
    [assets, sort],
  );
  const refreshUser = useCallback(async () => {
    try {
      const data = await api("/auth/me");
      setUser(data.user);
      setNeedsMfa(!!data.needsMfaEnrollment);
      setOrigins({ mediaUrl: data.mediaUrl, transferUrl: data.transferUrl });
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const next = buildNativeSearch([...searchChips, search], metadataFilter);
      if (next !== query) {
        setQuery(next);
        setPage(0);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, searchChips, metadataFilter, query]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timeout);
  }, [toast]);
  const loadData = useCallback(async () => {
    if (!user || needsMfa) return;
    const epoch = ++requestEpoch.current;
    setBusy(true);
    setError("");
    try {
      if (section === "library") {
        if (query.length > 200)
          throw new Error(
            "Search and filters together must be 200 characters or fewer.",
          );
        if (!user.libraryAccess) {
          setAssets([]);
          setTotal(0);
          return;
        }
        const data = await api(
          "/library?" +
            new URLSearchParams({
              search: query,
              page: String(page),
              state: "0",
              kind,
            }),
        );
        if (epoch !== requestEpoch.current) return;
        const visibleIds = new Set<number>(data.items.map((a: Asset) => a.id));
        for (const id of assetPool.current.keys())
          if (!visibleIds.has(id) && !selectedRef.current.has(id))
            assetPool.current.delete(id);
        for (const asset of data.items) assetPool.current.set(asset.id, asset);
        setAssets(data.items);
        setTotal(data.total);
      } else if (section === "collections") {
        const data = await api("/collections");
        if (epoch === requestEpoch.current) setCollections(data.collections);
      } else {
        const data = await api("/transfers");
        if (epoch === requestEpoch.current) setTransfers(data.transfers);
      }
    } catch (e) {
      if (epoch === requestEpoch.current) setError((e as Error).message);
    } finally {
      if (epoch === requestEpoch.current) setBusy(false);
    }
  }, [user, needsMfa, section, query, page, kind]);
  useEffect(() => {
    void loadData();
    return () => {
      ++requestEpoch.current;
    };
  }, [loadData]);
  useEffect(() => {
    assetPool.current.clear();
    setSelected(new Set());
    setAssets([]);
    setShareAssets(null);
    setDetail(null);
    setViewerId(null);
  }, [user?.id]);
  useEffect(() => {
    if (!collectionDialog) {
      setCollectionTarget(null);
      setExistingCollection("");
      setCollectionName("");
      return;
    }
    let active = true;
    api("/collections")
      .then((data) => {
        if (active) setCollections(data.collections);
      })
      .catch((e) => setToast(e.message));
    return () => {
      active = false;
    };
  }, [collectionDialog]);
  useEffect(() => {
    if (section !== "transfers" || !user) return;
    const t = setInterval(() => void loadData(), 30000);
    return () => clearInterval(t);
  }, [section, user, loadData]);
  useEffect(() => {
    setSelected(new Set());
    selectionAnchor.current = null;
  }, [kind, query, section]);
  useEffect(() => {
    if (!selected.size) return;
    const exit = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        document.querySelector(
          '[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]',
        )
      )
        return;
      setSelected(new Set());
      selectionAnchor.current = null;
    };
    document.addEventListener("keydown", exit);
    return () => document.removeEventListener("keydown", exit);
  }, [selected.size]);
  const choose = useCallback(
    (id: number, range = false) => {
      setSelected((old) => {
        const next = nextSelection(
          old,
          id,
          displayAssets.map((a) => a.id),
          selectionAnchor.current,
          range,
        );
        return next;
      });
      if (!range) selectionAnchor.current = id;
    },
    [displayAssets],
  );
  async function showTransfer(t: Transfer) {
    try {
      setTransferDetail((await api("/transfers/" + t.id)).transfer);
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function createCollection(e: FormEvent) {
    e.preventDefault();
    if (collectionBusy) return;
    setCollectionBusy(true);
    try {
      if (collectionTarget)
        await post("/collections/" + collectionTarget.ref, {
          name: collectionName,
        });
      else if (existingCollection) {
        const result = await post(
          "/collections/" + existingCollection + "/members",
          { action: "add", resourceIds: [...selected] },
        );
        if (result.failed.length)
          throw new Error(
            `${result.updated.length} added; ${result.failed.length} could not be added. Check source permissions before retrying.`,
          );
      } else {
        const result = await post("/collections", {
          name: collectionName,
          resourceIds: [...selected],
        });
        if (result.failed?.length) {
          setSelected(new Set(result.failed));
          setExistingCollection(String(result.id));
          setCollections((await api("/collections")).collections);
          throw new Error(
            `Collection created, but ${result.failed.length} assets could not be added. Choose the existing collection to retry.`,
          );
        }
      }
      setCollectionDialog(false);
      setToast(collectionTarget ? "Collection renamed" : "Collection saved");
      setSelected(new Set());
      void loadData();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setCollectionBusy(false);
    }
  }
  async function shareCollection(id: number) {
    try {
      const data = await api(
        "/library?" +
          new URLSearchParams({
            search: "!collection" + id,
            page: "0",
            state: "0",
            kind: "all",
          }),
      );
      if (data.total > 100)
        throw new Error(
          "Open this collection and select up to 100 library assets to share.",
        );
      const items: Asset[] = [...data.items];
      for (let p = 1; items.length < data.total; p++) {
        const more = await api(
          "/library?" +
            new URLSearchParams({
              search: "!collection" + id,
              page: String(p),
              state: "0",
              kind: "all",
            }),
        );
        if (!more.items.length)
          throw new Error(
            "Collection changed. Open it and select assets again.",
          );
        items.push(...more.items);
      }
      const unique = [...new Map(items.map((a) => [a.id, a])).values()];
      if (!unique.length)
        throw new Error("This collection has no available assets to share.");
      if (unique.length > 100)
        throw new Error("Select up to 100 assets in the collection to share.");
      setShareAssets(unique);
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  async function removeCollectionMembers(id: number) {
    try {
      const result = await post("/collections/" + id + "/members", {
        action: "remove",
        resourceIds: [...selected],
      });
      setSelected(new Set(result.failed));
      setToast(
        `${result.updated.length} removed from collection${result.failed.length ? `; ${result.failed.length} failed` : ""}. Source media is retained.`,
      );
      void loadData();
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  if (loading)
    return (
      <div className="startup">
        <Brand product={product} />
        <Loader2 className="spin" />
        <span>Opening your workspace…</span>
      </div>
    );
  if (!user) return <Login product={product} onLogin={refreshUser} />;
  if (needsMfa)
    return (
      <div className="enrollment-page">
        <Brand product={product} />
        <MfaSetup required onDone={refreshUser} />
        <button
          className="text-button"
          onClick={async () => {
            await post("/auth/logout");
            void refreshUser();
          }}
        >
          Sign out
        </button>
      </div>
    );
  const library = section === "library";
  const selectedAssets = [...selected]
    .map((id) => assetPool.current.get(id))
    .filter((a): a is Asset => !!a);
  return (
    <SidebarProvider
      defaultOpen={false}
      className="media-workspace"
      style={{ "--sidebar-width-icon": "4.5rem" } as React.CSSProperties}
    >
      <FilesSidebar
        user={user}
        product={product}
        section={section}
        onNavigate={(value) => {
          setSection(value);
          setSearch("");
          setMetadataFilter({ year: "", event: "", championship: "" });
          setPage(0);
        }}
        onCreate={() => {
          if (section === "collections") setCollectionDialog(true);
          else if (section === "transfers") {
            document
              .getElementById("transfer-upload")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
            document
              .querySelector<HTMLInputElement>(
                "#transfer-upload input:not([type=file])",
              )
              ?.focus();
          } else {
            setResume(null);
            setUploadOpen(true);
          }
        }}
        onSettings={() => setSettings(true)}
        mediaUrl={origins.mediaUrl}
        transferUrl={origins.transferUrl}
      />
      <div
        className={
          "media-main " + (section === "transfers" ? "transfers-workspace" : "")
        }
      >
        <FilesHeader
          section={section}
          search={library ? search : undefined}
          onSearch={setSearch}
          chips={searchChips}
          onChipsChange={setSearchChips}
          suggestions={Array.from(
            new Set(
              assets
                .flatMap((asset) => [asset.title, asset.event, asset.year])
                .filter(Boolean),
            ),
          )}
          loading={busy}
          searchKey={"aia:" + user.id + ":library-recents"}
          onCreate={() => {
            if (section === "collections") setCollectionDialog(true);
            else if (section === "transfers") {
              document
                .getElementById("transfer-upload")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
              document
                .querySelector<HTMLInputElement>(
                  "#transfer-upload input:not([type=file])",
                )
                ?.focus();
            } else {
              setResume(null);
              setUploadOpen(true);
            }
          }}
          createLabel={
            section === "collections"
              ? "New collection"
              : section === "transfers"
                ? "New transfer"
                : "Upload media"
          }
        />
        <main className="media-content" tabIndex={-1}>
          <div className="media-title">
            <div>
              <h1>
                {section === "library"
                  ? "Media library"
                  : section === "collections"
                    ? "Collections"
                    : "Transfers"}
              </h1>
              <p>
                {section === "library"
                  ? "Your photography and films, in one place."
                  : section === "collections"
                    ? "Curated selections for every project and event."
                    : "Send files securely and share media with external partners, teams and agencies."}
              </p>
            </div>
          </div>
          <ErrorText error={error} />
          {library && (
            <>
              <div className="library-toolbar">
                <div className="filter-tabs">
                  {[
                    ["all", "All media"],
                    ["photo", "Photos"],
                    ["video", "Videos"],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={kind === key ? "selected" : ""}
                      onClick={() => {
                        setKind(key);
                        setPage(0);
                      }}
                    >
                      {key === "photo" ? (
                        <ImageIcon size={16} />
                      ) : key === "video" ? (
                        <Video size={16} />
                      ) : (
                        <Layers size={16} />
                      )}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                <div className="toolbar-controls">
                  <button
                    className="button secondary small"
                    aria-expanded={filterOpen}
                    onClick={() => setFilterOpen(!filterOpen)}
                  >
                    <SlidersHorizontal size={14} />
                    Filters
                  </button>
                  <select
                    aria-label="Sort current page"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as GallerySort)}
                  >
                    <option value="recent">Newest first</option>
                    <option value="oldest">Oldest on page</option>
                    <option value="name">Name on page</option>
                  </select>
                  <div className="view-toggle">
                    {(["grid", "masonry", "list"] as const).map((mode) => (
                      <button
                        key={mode}
                        aria-label={mode + " view"}
                        aria-pressed={viewMode === mode}
                        className={viewMode === mode ? "selected" : ""}
                        onClick={() => setViewMode(mode)}
                      >
                        {mode === "list" ? (
                          <List size={16} />
                        ) : mode === "masonry" ? (
                          <Layers size={16} />
                        ) : (
                          <Grid2X2 size={16} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {filterOpen && (
                <div className="metadata-filters">
                  {(["year", "event"] as const).map((field) => (
                    <label key={field}>
                      {field[0].toUpperCase() + field.slice(1)}
                      <input
                        value={metadataFilter[field]}
                        onChange={(e) => {
                          setMetadataFilter((current) => ({
                            ...current,
                            [field]: e.target.value,
                          }));
                          setPage(0);
                        }}
                        placeholder={
                          field === "year" ? "e.g. 2026" : "Search " + field
                        }
                      />
                    </label>
                  ))}
                  <button
                    className="text-button"
                    onClick={() =>
                      setMetadataFilter({
                        year: "",
                        event: "",
                        championship: "",
                      })
                    }
                  >
                    Clear filters
                  </button>
                </div>
              )}
              <div className="results-line">
                <span>
                  {busy
                    ? "Finding media…"
                    : `${total.toLocaleString()} ${total === 1 ? "asset" : "assets"}`}
                  {query && (
                    <>
                      {" "}
                      matching <strong>“{query}”</strong>
                    </>
                  )}
                </span>
                <button
                  className="text-button"
                  onClick={() =>
                    setSelected((current) => {
                      const next = new Set(current);
                      const all = displayAssets.every((a) => next.has(a.id));
                      for (const a of displayAssets) {
                        if (all) next.delete(a.id);
                        else next.add(a.id);
                      }
                      if (next.size > 100) {
                        setToast("Select up to 100 assets per action.");
                        return current;
                      }
                      return next;
                    })
                  }
                >
                  {displayAssets.length &&
                  displayAssets.every((a) => selected.has(a.id))
                    ? "Deselect page"
                    : `Select page (${displayAssets.length})`}
                </button>
              </div>
              {selected.size > 0 && (
                <div className="selection-bar">
                  <button
                    className="button selection-done"
                    onClick={() => {
                      setSelected(new Set());
                      selectionAnchor.current = null;
                    }}
                  >
                    <X size={18} /> Done
                  </button>
                  <strong aria-live="polite">{selected.size} selected</strong>
                  {user.role !== "marketer" && (
                    <button
                      className="button small light"
                      onClick={() => setBulkTags(true)}
                    >
                      <Tags size={16} /> Edit tags
                    </button>
                  )}
                  <button
                    className="button small light"
                    onClick={() => {
                      for (const a of selectedAssets)
                        window.open(
                          "/api/library/" + a.id + "/download",
                          "_blank",
                          "noopener",
                        );
                      setToast(
                        "Original downloads requested. Your browser may ask to allow multiple downloads.",
                      );
                    }}
                  >
                    Download
                  </button>
                  {user.role !== "marketer" && (
                    <button
                      className="button small light"
                      onClick={() => setBulkEditing(true)}
                    >
                      Edit metadata
                    </button>
                  )}
                  <button
                    className="button small light"
                    onClick={() => setShareAssets(selectedAssets)}
                  >
                    <Send size={16} />
                    Share
                  </button>
                  <button
                    className="button small light"
                    onClick={() => setCollectionDialog(true)}
                  >
                    <FolderPlus size={16} />
                    Add to collection
                  </button>
                  {/^!collection\d+$/.test(query) && (
                    <button
                      className="button small light"
                      onClick={() =>
                        void removeCollectionMembers(Number(query.slice(11)))
                      }
                    >
                      Remove from collection
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={() => setSelected(new Set())}
                  >
                    Clear selection
                  </button>
                </div>
              )}
              {!user.libraryAccess ? (
                <div className="empty-state">
                  <Lock size={34} />
                  <h3>Library access is not assigned</h3>
                  <p>
                    Your account can use AIA Transfer. Ask an administrator to
                    add library access.
                  </p>
                  <a className="button secondary" href={origins.transferUrl}>
                    Open Transfer
                    <ArrowUpRight size={16} />
                  </a>
                </div>
              ) : busy && !assets.length ? (
                <GallerySkeleton />
              ) : !assets.length ? (
                <div className="empty-state">
                  <ImageIcon size={36} />
                  <h3>
                    {query
                      ? "No matching media"
                      : "A fresh perspective starts here"}
                  </h3>
                  <p>
                    {query
                      ? "Try a different search or clear your filters."
                      : "Upload your first photos and films to the library."}
                  </p>
                  {query && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        setSearch("");
                        setSearchChips([]);
                      }}
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <ImageGallery
                  assets={displayAssets}
                  mode={viewMode}
                  selected={selected}
                  onSelect={choose}
                  onOpen={setDetail}
                  onPreview={setViewerId}
                  onShare={setShareAssets}
                  busy={busy}
                  canEditTags={user.role !== "marketer"}
                  onTagsSaved={() => void loadData()}
                />
              )}
              {total > 48 && (
                <div className="pagination">
                  <span>
                    Page {page + 1} of {Math.ceil(total / 48)}
                  </span>
                  <button
                    className="button secondary small"
                    disabled={page === 0 || busy}
                    onClick={() => {
                      setPage(page - 1);
                    }}
                  >
                    <ArrowLeft size={15} />
                    Previous
                  </button>
                  <button
                    className="button secondary small"
                    disabled={(page + 1) * 48 >= total || busy}
                    onClick={() => {
                      setPage(page + 1);
                    }}
                  >
                    Next
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}
            </>
          )}
          {section === "collections" && (
            <>
              {busy ? (
                <div className="loading-row">
                  <Loader2 className="spin" />
                  Loading collections…
                </div>
              ) : !collections.some(
                  (c) => !String(c.name).startsWith("[AIA Transfer]"),
                ) ? (
                <div className="empty-state">
                  <FolderPlus size={36} />
                  <h3>A place for your next project</h3>
                  <p>Create a collection to keep related media together.</p>
                  <button
                    className="button secondary"
                    onClick={() => setCollectionDialog(true)}
                  >
                    Create collection
                  </button>
                </div>
              ) : (
                <div className="collection-grid">
                  {collections
                    .filter((c) => !String(c.name).startsWith("[AIA Transfer]"))
                    .map((c) => (
                      <article
                        key={c.ref}
                        className="collection-card focus-card"
                      >
                        <button
                          className="collection-open"
                          onClick={() => {
                            setSection("library");
                            setSearch("!collection" + c.ref);
                            setPage(0);
                          }}
                        >
                          <div className="collection-art">
                            <Folder size={46} />
                            <span>COLLECTION</span>
                          </div>
                          <strong>{c.name || "Untitled collection"}</strong>
                          <span>
                            Open collection
                            <ArrowRight size={16} />
                          </span>
                        </button>
                        <div className="collection-actions">
                          <button
                            className="text-button"
                            onClick={() => {
                              setCollectionTarget(c);
                              setCollectionName(c.name);
                              setCollectionDialog(true);
                            }}
                          >
                            Rename
                          </button>
                          <button
                            className="text-button"
                            onClick={() => void shareCollection(Number(c.ref))}
                          >
                            Share collection
                          </button>
                        </div>
                      </article>
                    ))}
                </div>
              )}
            </>
          )}
          {section === "transfers" && (
            <div className="transfers-dashboard">
              <UploadDialog
                key={uploadVersion}
                inline
                library={false}
                resume={null}
                onClose={() => {}}
                onLibraryDone={() => {}}
                onCreated={(t) => {
                  setTransferDetail(t);
                  setUploadVersion((v) => v + 1);
                  void loadData();
                }}
              />
              <RecentTransfers
                transfers={transfers}
                busy={busy}
                onOpen={(t) => void showTransfer(t)}
                onRefresh={() => void loadData()}
              />
            </div>
          )}
          <footer className="content-footer">
            <span>Autódromo Internacional do Algarve</span>
            <span>
              AIA {product === "media" ? "Media" : "Transfer"} · Creative
              workspace
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {bulkTags && (
        <BulkTags
          assets={selectedAssets}
          onClose={() => setBulkTags(false)}
          onSaved={() => void loadData()}
        />
      )}
      {viewerId !== null && (
        <Suspense
          fallback={
            <div className="toast" role="status">
              Opening fullscreen viewer…
            </div>
          }
        >
          <AssetViewer
            id={viewerId}
            assets={displayAssets}
            onClose={() => setViewerId(null)}
          />
        </Suspense>
      )}
      {detail !== null && (
        <AssetDetail
          id={detail}
          user={user}
          onClose={() => setDetail(null)}
          onCollection={(ref) => {
            setDetail(null);
            setSection("library");
            setSearch("!collection" + ref);
            setMetadataFilter({ year: "", event: "", championship: "" });
            setPage(0);
          }}
          onChanged={() => {
            void loadData();
            setToast("Asset updated");
          }}
          onShare={(asset) => {
            setDetail(null);
            setShareAssets([asset]);
          }}
        />
      )}
      {shareAssets && (
        <ShareDialog
          assets={shareAssets}
          onClose={() => setShareAssets(null)}
          onCreated={(t) => {
            setShareAssets(null);
            setSelected(new Set());
            setTransferDetail(t);
            setToast("Library share created");
          }}
        />
      )}
      {uploadOpen && (
        <UploadDialog
          library={product === "media" && section !== "transfers"}
          resume={resume}
          onClose={() => {
            setUploadOpen(false);
            setResume(null);
            void loadData();
          }}
          onCreated={(t) => {
            setUploadOpen(false);
            setResume(null);
            setTransferDetail(t);
            void loadData();
          }}
          onLibraryDone={() => {
            setUploadOpen(false);
            setSection("library");
            setPage(0);
            void loadData();
            setToast("Media added to the library");
          }}
        />
      )}
      {transferDetail && (
        <TransferDialog
          transfer={transferDetail}
          onClose={() => setTransferDetail(null)}
          onRevoked={() => {
            setTransferDetail(null);
            void loadData();
            setToast("Transfer revoked");
          }}
          onResume={(t) => {
            setTransferDetail(null);
            setResume(t);
            setUploadOpen(true);
          }}
          notify={setToast}
        />
      )}
      {settings && (
        <SettingsDialog
          user={user}
          onClose={() => setSettings(false)}
          onUpdated={refreshUser}
          onLogout={async () => {
            await post("/auth/logout");
            setSettings(false);
            setUser(null);
          }}
        />
      )}
      {bulkEditing && (
        <BulkMetadata
          assets={selectedAssets}
          onClose={() => setBulkEditing(false)}
          onChanged={() => {
            void loadData();
          }}
        />
      )}
      {collectionDialog && (
        <Modal
          title={collectionTarget ? "Rename collection" : "Add to collection"}
          onClose={() => setCollectionDialog(false)}
        >
          <form className="dialog-form" onSubmit={createCollection}>
            <p className="muted">
              {selected.size
                ? `${selected.size} selected assets will be added.`
                : collectionTarget
                  ? "Choose a new name for this collection."
                  : "Give your new collection a name."}
            </p>
            {!collectionTarget && selected.size > 0 && (
              <label>
                Destination
                <select
                  value={existingCollection}
                  onChange={(e) => setExistingCollection(e.target.value)}
                >
                  <option value="">Create a new collection</option>
                  {collections
                    .filter((c) => !String(c.name).startsWith("[AIA Transfer]"))
                    .map((c) => (
                      <option key={c.ref} value={c.ref}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {!existingCollection && (
              <label>
                Collection name
                <input
                  required
                  autoFocus
                  maxLength={100}
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="For example, Race weekend highlights"
                />
              </label>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setCollectionDialog(false)}
              >
                Cancel
              </button>
              <button className="button primary" disabled={collectionBusy}>
                <FolderPlus size={17} />
                {collectionBusy
                  ? "Saving?"
                  : collectionTarget
                    ? "Save name"
                    : existingCollection
                      ? "Add selected assets"
                      : "Create collection"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </SidebarProvider>
  );
}

function BulkMetadata({
  assets,
  onClose,
  onChanged,
}: {
  assets: Asset[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [fields, setFields] = useState<Field[]>([]),
    [field, setField] = useState(""),
    [value, setValue] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (assets.length)
      void api("/library/" + assets[0].id)
        .then((d) => setFields(d.fields))
        .catch((e) => setError(e.message));
  }, [assets]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await post("/library/bulk-metadata", {
        resourceIds: assets.map((a) => a.id),
        fields: [{ id: Number(field), value }],
      });
      setMessage(result.updated.length + " assets updated.");
      if (result.failed.length)
        setError(
          "Some native updates failed: " +
            result.failed.join(", ") +
            ". Check these assets before retrying; completed updates remain saved.",
        );
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Edit selected media" onClose={onClose}>
      <form className="dialog-form" onSubmit={save}>
        <p>
          Replace one metadata value on {assets.length} selected assets. Native
          permissions apply to every file.
        </p>
        <label>
          Field
          <select
            required
            value={field}
            onChange={(e) => setField(e.target.value)}
          >
            <option value="">Choose a field</option>
            {fields
              .filter((f) => [0, 1, 9].includes(f.type))
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
          </select>
        </label>
        <label>
          New value
          <textarea
            maxLength={5000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <p className="helper">
          An empty value clears this field. For controlled vocabulary fields,
          use existing native values. Each asset is saved independently.
        </p>
        <ErrorText error={error} />
        {message && <p role="status">{message}</p>}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Close
          </button>
          <button className="button primary" disabled={busy || !field}>
            {busy ? "Saving…" : "Apply to selection"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AssetDetail({
  id,
  user,
  onClose,
  onChanged,
  onShare,
  onCollection,
}: {
  id: number;
  user: Staff;
  onClose: () => void;
  onChanged: () => void;
  onShare: (asset: Asset) => void;
  onCollection: (ref: number) => void;
}) {
  const [data, setData] = useState<{
      asset: Asset;
      fields: Field[];
      collections?: { ref: number; name: string }[];
      collectionsAvailable?: boolean;
    } | null>(null),
    [previewFailed, setPreviewFailed] = useState(false),
    [editing, setEditing] = useState(false),
    [values, setValues] = useState<Record<number, string>>({}),
    [fieldOptions, setFieldOptions] = useState<
      Record<number, { id: number; value: string }[]>
    >({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const loadDetail = useCallback(async () => {
    try {
      const detail = await api("/library/" + id);
      setData(detail);
      setValues(
        Object.fromEntries(detail.fields.map((f: Field) => [f.id, f.value])),
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);
  useEffect(() => {
    if (editing && data)
      for (const field of data.fields.filter((f) => [2, 3].includes(f.type))) {
        void api("/library/fields/" + field.id + "/options")
          .then((result) =>
            setFieldOptions((current) => ({
              ...current,
              [field.id]: result.options,
            })),
          )
          .catch((error) => setError(error.message));
      }
  }, [editing, data?.asset.id]);
  async function updateState(state: number) {
    setBusy(true);
    try {
      await post("/library/" + id + "/state", { state });
      await loadDetail();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const fields = data!.fields
        .filter((f) => values[f.id] !== f.value)
        .map((f) => ({ id: f.id, value: values[f.id] }));
      if (fields.length) await post("/library/" + id + "/metadata", { fields });
      setEditing(false);
      await loadDetail();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={data?.asset.title || "Asset details"}
      onClose={onClose}
      wide
      panel
    >
      <ErrorText error={error} />
      {!data ? (
        <div className="loading-row">
          <Loader2 className="spin" />
          Loading asset…
        </div>
      ) : (
        <>
          <div className="detail-preview">
            {previewFailed ? (
              <p className="muted" role="status">
                Preview unavailable. You can download the original below.
              </p>
            ) : data.asset.kind === "video" ? (
              <video
                controls
                onError={() => setPreviewFailed(true)}
                preload="metadata"
                src={"/api/library/" + id + "/video"}
                poster={"/api/library/" + id + "/preview"}
              />
            ) : (
              <img
                src={"/api/library/" + id + "/preview"}
                alt={data.asset.title}
                onError={() => setPreviewFailed(true)}
              />
            )}
          </div>
          <div className="detail-body">
            <div className="detail-meta">
              <span
                className={
                  "status " + (data.asset.state === 0 ? "active" : "draft")
                }
              >
                {stateLabel(data.asset.state)}
              </span>
              <span>{data.asset.extension.toUpperCase()}</span>
              <span>Asset #{id}</span>
            </div>
            <div className="detail-actions">
              <a
                className="button secondary"
                href={"/api/library/" + id + "/download"}
                download
              >
                <ArrowDownToLine size={17} />
                Download original
              </a>
              {data.asset.state === 0 && data.asset.access === 0 && (
                <button
                  className="button primary"
                  onClick={() => onShare(data.asset)}
                >
                  <Send size={17} />
                  Share
                </button>
              )}
              {user.role !== "marketer" && (
                <button
                  className="button secondary"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "Cancel editing" : "Edit metadata"}
                </button>
              )}
            </div>
            <section
              className="detail-collections"
              aria-label="Collection membership"
            >
              <h3>Collections</h3>
              {data.collectionsAvailable === false ? (
                <p className="muted">
                  Collection membership is temporarily unavailable.
                </p>
              ) : data.collections?.length ? (
                <div>
                  {data.collections.map((c) => (
                    <button
                      type="button"
                      className="button secondary small"
                      key={c.ref}
                      onClick={() => onCollection(c.ref)}
                    >
                      <Folder size={14} />
                      {c.name || "Untitled collection"}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">Not in an accessible collection.</p>
              )}
            </section>
            <form onSubmit={save}>
              <div className="metadata-grid">
                {data.fields
                  .filter((f) => f.value || editing)
                  .map((f) => (
                    <div className="metadata-item" key={f.id}>
                      <label>
                        {f.title || f.name}
                        {editing && [2, 3].includes(f.type) ? (
                          <select
                            multiple={f.type === 2}
                            disabled={!fieldOptions[f.id]}
                            value={
                              f.type === 2
                                ? (values[f.id] || "")
                                    .split(",")
                                    .map((v) => v.trim())
                                    .filter(Boolean)
                                : values[f.id] || ""
                            }
                            onChange={(e) =>
                              setValues({
                                ...values,
                                [f.id]:
                                  f.type === 2
                                    ? Array.from(
                                        e.target.selectedOptions,
                                        (o) => o.value,
                                      ).join(",")
                                    : e.target.value,
                              })
                            }
                          >
                            {f.type === 3 && (
                              <option value="">
                                {fieldOptions[f.id]
                                  ? "Not set"
                                  : "Loading choices…"}
                              </option>
                            )}
                            {fieldOptions[f.id]?.map((option) => (
                              <option key={option.id} value={option.value}>
                                {option.value}
                              </option>
                            ))}
                          </select>
                        ) : editing ? (
                          <textarea
                            value={values[f.id] || ""}
                            maxLength={5000}
                            rows={2}
                            onChange={(e) =>
                              setValues({ ...values, [f.id]: e.target.value })
                            }
                          />
                        ) : (
                          <span>{f.value || "—"}</span>
                        )}
                      </label>
                    </div>
                  ))}
              </div>
              {editing && (
                <button className="button primary" disabled={busy}>
                  {busy ? (
                    <Loader2 className="spin" size={16} />
                  ) : (
                    <Check size={16} />
                  )}
                  Save metadata
                </button>
              )}
            </form>
            {user.role !== "marketer" && (
              <div className="asset-lifecycle">
                <span>ASSET LIFECYCLE</span>
                {data.asset.state === 2 && (
                  <button
                    className="button small primary"
                    disabled={busy}
                    onClick={() => updateState(0)}
                  >
                    Restore to library
                  </button>
                )}
                {data.asset.state !== 2 && (
                  <button
                    className="button small secondary"
                    disabled={busy}
                    onClick={() => updateState(2)}
                  >
                    Archive
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
function TransferFields({
  compact = false,
  title,
  setTitle,
  note,
  setNote,
  days,
  setDays,
  password,
  setPassword,
  limit,
  setLimit,
}: {
  compact?: boolean;
  title: string;
  setTitle: (s: string) => void;
  note: string;
  setNote: (s: string) => void;
  days: number;
  setDays: (n: number) => void;
  password: string;
  setPassword: (s: string) => void;
  limit: string;
  setLimit: (s: string) => void;
}) {
  if (compact)
    return (
      <div className="compact-transfer-fields">
        <label>
          Transfer title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
            placeholder="Give this handoff a name"
          />
        </label>
        <div className="form-grid">
          <label>
            <span>
              <Clock size={15} /> Link expiry
            </span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[1, 3, 7, 14, 30].map((n) => (
                <option key={n} value={n}>
                  After {n} {n === 1 ? "day" : "days"}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              <Lock size={15} /> Password (optional)
            </span>
            <input
              aria-label="Transfer password optional"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Add a password"
            />
          </label>
        </div>
        <details>
          <summary>Message & download limit</summary>
          <label>
            Message optional
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={2}
            />
          </label>
          <label>
            Download starts allowed
            <input
              type="number"
              value={limit}
              min={1}
              max={10000}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="Unlimited"
            />
          </label>
        </details>
      </div>
    );
  return (
    <>
      <label>
        Transfer title
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          required
          placeholder="Give this handoff a name"
        />
      </label>
      <label>
        Message <span className="muted">optional</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={2}
          placeholder="A little context for the recipient"
        />
      </label>
      <div className="form-grid">
        <label>
          <span>
            <Clock size={14} />
            Link expiry
          </span>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[1, 3, 7, 14, 30].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? "After 1 day" : `After ${n} days`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Download starts allowed
          <input
            type="number"
            min={1}
            max={10000}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Unlimited"
          />
        </label>
      </div>
      <label>
        <span>
          <Lock size={14} />
          Transfer password <span className="muted">optional</span>
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          maxLength={128}
          placeholder="Add a password for the recipient"
        />
      </label>
    </>
  );
}
function ShareDialog({
  assets,
  onClose,
  onCreated,
}: {
  assets: Asset[];
  onClose: () => void;
  onCreated: (t: Transfer) => void;
}) {
  const [title, setTitle] = useState(
      assets.length === 1
        ? assets[0].title
        : `AIA media selection · ${assets.length} assets`,
    ),
    [note, setNote] = useState(""),
    [days, setDays] = useState(7),
    [password, setPassword] = useState(""),
    [limit, setLimit] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { transfer } = await post("/transfers", {
        title,
        note,
        days,
        password,
        downloadLimit: limit ? Number(limit) : null,
        resourceIds: assets.map((a) => a.id),
      });
      onCreated(transfer);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Share from your library" onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <div className="share-selection">
          <span className="large-icon">
            <Layers size={23} />
          </span>
          <div>
            <strong>
              {assets.length} library {assets.length === 1 ? "asset" : "assets"}
            </strong>
            <span>From Library · originals stay in your library</span>
          </div>
        </div>
        <TransferFields
          {...{
            title,
            setTitle,
            note,
            setNote,
            days,
            setDays,
            password,
            setPassword,
            limit,
            setLimit,
          }}
        />
        <p className="helper">
          <ShieldCheck size={15} />
          Links are available on the AIA network. No staff account is needed to
          receive files.
        </p>
        <ErrorText error={error} />
        <div className="modal-actions">
          <button className="button secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={busy || !assets.length}>
            {busy ? (
              <Loader2 className="spin" size={17} />
            ) : (
              <LinkIcon size={17} />
            )}
            Create share link
          </button>
        </div>
      </form>
    </Modal>
  );
}
function UploadDialog({
  inline = false,
  library,
  resume,
  onClose,
  onCreated,
  onLibraryDone,
}: {
  inline?: boolean;
  library: boolean;
  resume: Transfer | null;
  onClose: () => void;
  onCreated: (t: Transfer) => void;
  onLibraryDone: () => void;
}) {
  const [attachmentItems, setAttachmentItems] = useState<
      AttachmentUploadItem[]
    >([]),
    [title, setTitle] = useState(resume?.title || ""),
    [note, setNote] = useState(resume?.note || ""),
    [days, setDays] = useState(7),
    [password, setPassword] = useState(""),
    [limit, setLimit] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState<Record<string, number>>({}),
    [active, setActive] = useState<Transfer | null>(resume),
    [paused, setPaused] = useState(false),
    [processing, setProcessing] = useState(false),
    [currentId, setCurrentId] = useState(""),
    [failedId, setFailedId] = useState("");
  const abort = useRef<AbortController | null>(null),
    currentFile = useRef(""),
    sendRunning = useRef(false);
  const files = attachmentItems.map((item) => item.file!).filter(Boolean);
  useEffect(() => () => abort.current?.abort(), []);
  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (sendRunning.current || !files.length) return;
    sendRunning.current = true;
    setBusy(true);
    setPaused(false);
    setError("");
    abort.current = new AbortController();
    try {
      if (library) {
        for (let i = 0; i < files.length; i++) {
          if (progress[attachmentItems[i].id] === 100) continue;
          currentFile.current = attachmentItems[i].id;
          setCurrentId(attachmentItems[i].id);
          const file = files[i];
          const form = new FormData();
          form.set("file", file);
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const signal = abort.current!.signal,
              cancel = () => xhr.abort();
            const cleanup = () => {
              signal.removeEventListener("abort", cancel);
              xhr.upload.onprogress = null;
            };
            xhr.open("POST", "/api/library/upload?size=" + file.size);
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable)
                setProgress((p) => ({
                  ...p,
                  [attachmentItems[i].id]: Math.min(
                    99,
                    Math.round((event.loaded / event.total) * 100),
                  ),
                }));
            };
            xhr.onload = () => {
              cleanup();
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else {
                let message = "Library upload failed";
                try {
                  message = JSON.parse(xhr.responseText).error || message;
                } catch {}
                reject(new Error(message));
              }
            };
            xhr.onerror = () => {
              cleanup();
              reject(
                new Error("The upload connection ended. Retry this file."),
              );
            };
            xhr.onabort = () => {
              cleanup();
              reject(new DOMException("Cancelled", "AbortError"));
            };
            signal.addEventListener("abort", cancel, { once: true });
            xhr.send(form);
          });
          setProgress((p) => ({ ...p, [attachmentItems[i].id]: 100 }));
        }
        onLibraryDone();
        return;
      }
      let transfer = active;
      if (transfer) {
        transfer = (await api("/transfers/" + transfer.id)).transfer;
        setActive(transfer);
      } else {
        transfer = (
          await post("/transfers", {
            title,
            note,
            days,
            password,
            downloadLimit: limit ? Number(limit) : null,
            files: files.map((f) => ({ name: f.name, size: f.size })),
          })
        ).transfer;
        setActive(transfer);
      }
      abort.current.signal.throwIfAborted();
      const pending = transfer!.files!;
      if (
        pending.length !== files.length ||
        pending.some(
          (f, i) => f.name !== files[i].name || f.size !== files[i].size,
        )
      )
        throw new Error(
          "To resume, select the same files in their original order.",
        );
      for (let i = 0; i < files.length; i++) {
        currentFile.current = attachmentItems[i].id;
        setCurrentId(attachmentItems[i].id);
        const file = files[i],
          record = pending[i];
        if (record.complete) {
          setProgress((p) => ({ ...p, [attachmentItems[i].id]: 100 }));
          continue;
        }
        for (
          let offset = record.uploadedBytes;
          offset < file.size;
          offset += MAX_CHUNK
        ) {
          const end = Math.min(file.size, offset + MAX_CHUNK);
          const response = await api(
            "/transfers/" +
              transfer!.id +
              "/chunk?" +
              new URLSearchParams({
                fileId: record.id,
                offset: String(offset),
              }),
            {
              method: "POST",
              body: file.slice(offset, end),
              headers: { "Content-Type": "application/octet-stream" },
              signal: abort.current.signal,
            },
          );
          setProgress((p) => ({
            ...p,
            [attachmentItems[i].id]: Math.min(
              99,
              Math.round((response.uploadedBytes / file.size) * 100),
            ),
          }));
        }
        abort.current.signal.throwIfAborted();
        setProcessing(true);
        await post("/transfers/" + transfer!.id + "/complete-file", {
          fileId: record.id,
        });
        setProcessing(false);
        setProgress((p) => ({ ...p, [attachmentItems[i].id]: 100 }));
      }
      abort.current.signal.throwIfAborted();
      onCreated(
        (await post("/transfers/" + transfer!.id + "/activate")).transfer,
      );
    } catch (e) {
      setFailedId(currentFile.current);
      if ((e as Error).name === "AbortError") {
        setPaused(true);
        setError(
          library
            ? "Library upload cancelled. Completed files are already in the library; remove them from the selection before retrying."
            : "Upload paused. Keep these files selected and choose Resume upload.",
        );
      } else setError((e as Error).message);
    } finally {
      setProcessing(false);
      setBusy(false);
      sendRunning.current = false;
      setCurrentId("");
    }
  }
  const count = files.length;
  return (
    <Modal
      inline={inline}
      title={
        library
          ? "Upload to your library"
          : resume || active
            ? "Resume your transfer"
            : "Send a new transfer"
      }
      onClose={() => {
        if (processing) {
          setError(
            "Native file processing is finishing. Keep this window open.",
          );
          return;
        }
        abort.current?.abort();
        onClose();
      }}
    >
      <form className="dialog-form" onSubmit={send}>
        {resume && (
          <p className="helper">
            Select the original files in their original order. Confirmed chunks
            are already saved.
          </p>
        )}
        <AttachmentUpload
          value={attachmentItems.map((item) => ({
            ...item,
            progress: progress[item.id],
            status:
              progress[item.id] === 100
                ? "complete"
                : busy && currentId === item.id
                  ? "uploading"
                  : error && failedId === item.id && !paused
                    ? "failed"
                    : "idle",
            error: failedId === item.id ? error : undefined,
          }))}
          onValueChange={(items) => {
            setAttachmentItems(
              items.map((item) => ({
                ...item,
                kind:
                  item.kind === "audio" ||
                  (item.kind === "image" &&
                    !/^image\/(jpeg|png|webp|gif|avif)$/.test(
                      item.file?.type || "",
                    ))
                    ? "file"
                    : item.kind,
              })),
            );
            if (!title && !resume)
              setTitle(
                items.length === 1
                  ? items[0].name
                  : `AIA transfer - ${items.length} files`,
              );
            setError("");
          }}
          onFilesRejected={(_, reason) =>
            setError(
              reason === "max-files"
                ? "Choose up to 100 files"
                : reason === "too-small"
                  ? "Each file must be at least 1 byte"
                  : "Each file must be at most 20 GiB",
            )
          }
          onRetry={() => {
            if (!busy) void send();
          }}
          accept={
            library
              ? ".jpg,.jpeg,.png,.webp,.tif,.tiff,.dng,.cr2,.nef,.arw,.mp4,.mov,.m4v,.webm"
              : undefined
          }
          disabled={busy || processing}
          maxFiles={100}
          maxFileSize={20 * 1024 ** 3}
          title={
            inline
              ? "Drop files here to transfer"
              : "Drag and drop or browse files"
          }
          description={
            library
              ? "Photos and video - Up to 20 GiB per file - 100 files"
              : "Up to 20 GiB per file - 100 files per transfer"
          }
          attachmentsLabel="Selected files"
          className="aia-attachment-upload"
          classNames={{
            dropzone: "aia-attachment-dropzone",
            row: "aia-attachment-row",
          }}
        />
        {!library && !active && (
          <TransferFields
            compact={inline}
            {...{
              title,
              setTitle,
              note,
              setNote,
              days,
              setDays,
              password,
              setPassword,
              limit,
              setLimit,
            }}
          />
        )}
        {library && (
          <p className="helper">
            <ShieldCheck size={16} />
            Completed uploads are added directly to the library.
          </p>
        )}
        <ErrorText error={error} />
        {processing && (
          <p role="status" className="helper">
            Finalizing and encrypting your file. Large files can take several
            minutes on NAS storage. The link is not published yet.
          </p>
        )}
        <div className="modal-actions">
          {!inline && (
            <button
              className="button secondary"
              type="button"
              disabled={processing}
              onClick={() => {
                abort.current?.abort();
                onClose();
              }}
            >
              Close
            </button>
          )}
          {busy ? (
            <button
              className="button secondary"
              type="button"
              disabled={processing}
              onClick={(event) => {
                event.preventDefault();
                abort.current?.abort();
              }}
            >
              <Pause size={16} />
              {processing
                ? "Finalizing…"
                : library
                  ? "Cancel upload"
                  : "Pause upload"}
            </button>
          ) : (
            <button className="button primary" disabled={!count}>
              {paused || active ? (
                <Play size={16} />
              ) : (
                <UploadCloud size={17} />
              )}{" "}
              {library
                ? "Upload to library"
                : active
                  ? "Resume upload"
                  : inline
                    ? "Create transfer"
                    : "Upload & create link"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
function TransferDialog({
  transfer,
  onClose,
  onRevoked,
  onResume,
  notify,
}: {
  transfer: Transfer;
  onClose: () => void;
  onRevoked: () => void;
  onResume: (t: Transfer) => void;
  notify: (s: string) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(transfer.link || "");
      notify("Transfer link copied");
    } catch {
      setError("Select and copy the link below.");
    }
  }
  async function revoke() {
    setBusy(true);
    try {
      const result = await post("/transfers/" + transfer.id + "/revoke");
      if (result.cleanupPending)
        notify("Access is blocked. Source cleanup will retry.");
      onRevoked();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={transfer.title} onClose={onClose}>
      <div className="dialog-form">
        <div className="transfer-summary">
          <span className={"transfer-row-icon " + transfer.source}>
            {transfer.source === "library" ? (
              <Layers size={26} />
            ) : (
              <Send size={26} />
            )}
          </span>
          <div>
            <span className={"status " + transfer.state}>
              {transfer.state === "revoking"
                ? "Cleanup pending"
                : transfer.state}
            </span>
            <p>
              {transfer.source === "library"
                ? "From Library"
                : "Temporary Upload"}{" "}
              · {transfer.fileCount}{" "}
              {transfer.fileCount === 1 ? "file" : "files"}
            </p>
          </div>
        </div>
        {transfer.state === "active" && (
          <>
            <label>
              Share link
              <div className="copy-field">
                <input
                  value={transfer.link || ""}
                  readOnly
                  onFocus={(e) => e.target.select()}
                />
                <button className="button primary" onClick={copy}>
                  <Copy size={16} />
                  Copy
                </button>
              </div>
            </label>
            <p className="helper">
              <LinkIcon size={15} />
              Recipients do not need a staff account.
            </p>
            <a
              className="text-button link-preview"
              href={transfer.link}
              target="_blank"
              rel="noreferrer"
            >
              Preview recipient page
              <ExternalLink size={14} />
            </a>
          </>
        )}
        {transfer.note && <p className="transfer-note">{transfer.note}</p>}
        <div className="transfer-facts">
          <span>
            <Clock size={16} />
            <small>EXPIRES</small>
            <strong>{when(transfer.expiresAt)}</strong>
          </span>
          <span>
            <Lock size={16} />
            <small>PASSWORD</small>
            <strong>
              {transfer.passwordProtected ? "Protected" : "Not set"}
            </strong>
          </span>
          <span>
            <ArrowDownToLine size={16} />
            <small>DOWNLOAD STARTS</small>
            <strong>
              {transfer.downloads}
              {transfer.downloadLimit ? ` / ${transfer.downloadLimit}` : ""}
            </strong>
          </span>
        </div>
        <div className="transfer-file-list">
          {transfer.files?.map((f) => (
            <div className="upload-file" key={f.id}>
              <IconFile name={f.name} />
              <div>
                <strong>{f.name}</strong>
                <span>
                  {f.size ? formatBytes(f.size) : "Original file"}
                  {!f.complete
                    ? ` · ${Math.round((f.uploadedBytes / f.size) * 100)}% uploaded`
                    : ""}
                </span>
              </div>
              {f.complete && <Check size={16} className="green" />}
            </div>
          ))}
        </div>
        <ErrorText error={error} />
        <div className="modal-actions">
          {transfer.state === "draft" && (
            <button
              className="button primary"
              onClick={() => onResume(transfer)}
            >
              <Play size={16} />
              Resume upload
            </button>
          )}
          {["active", "draft", "revoking"].includes(transfer.state) && (
            <button
              className={"button " + (confirm ? "danger" : "secondary")}
              disabled={busy}
              onClick={() => (confirm ? void revoke() : setConfirm(true))}
            >
              {busy ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Trash2 size={16} />
              )}{" "}
              {confirm ? "Confirm revoke" : "Revoke transfer"}
            </button>
          )}
          <button className="button secondary" onClick={onClose}>
            Done
          </button>
        </div>
        {confirm && (
          <p className="helper">
            Revoking immediately blocks the link and requests removal of
            temporary source files. Library originals stay in the library.
          </p>
        )}
      </div>
    </Modal>
  );
}
function SettingsDialog({
  user,
  onClose,
  onUpdated,
  onLogout,
}: {
  user: Staff;
  onClose: () => void;
  onUpdated: () => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState("account"),
    [users, setUsers] = useState<(Staff & { disabled: boolean })[]>([]),
    [events, setEvents] = useState<any[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [adding, setAdding] = useState(false),
    [resetTarget, setResetTarget] = useState<Staff | null>(null),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<any>(null);
  const reloadUsers = useCallback(async () => {
    try {
      setUsers((await api("/admin/users")).users);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (tab === "team") void reloadUsers();
    if (tab === "audit")
      void api("/admin/audit")
        .then((d) => setEvents(d.events))
        .catch((e) => setError(e.message));
    if (tab === "status")
      void api("/admin/status")
        .then(setStatus)
        .catch((e) => setError(e.message));
  }, [tab, reloadUsers]);
  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await post("/auth/password", {
        current: f.get("current"),
        password: f.get("password"),
      });
      onLogout();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <Modal
      title="Settings & account"
      onClose={onClose}
      wide
      className="settings-modal"
    >
      <div className="settings-tabs">
        {[
          ["account", "Account"],
          ...(user.role === "admin"
            ? [
                ["team", "Staff"],
                ["backgrounds", "Background photos"],
                ["audit", "Activity"],
                ["status", "Service status"],
              ]
            : []),
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "selected" : ""}
            onClick={() => {
              setTab(key);
              setError("");
              setMessage("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="dialog-form">
        <ErrorText error={error} />
        {message && (
          <p className="success" role="status">
            {message}
          </p>
        )}
        {tab === "account" && (
          <>
            <div className="account-card">
              <StaffAvatar user={user} className="avatar large" />
              <div>
                <h3>{user.name}</h3>
                <p>
                  @{user.username} ·{" "}
                  {user.role === "reviewer" ? "Media editor" : user.role}
                </p>
              </div>
              <span className="status active">
                <ShieldCheck size={13} />
                {user.mfaEnabled ? "Authenticator enabled" : "Password sign-in"}
              </span>
            </div>
            {!user.mfaEnabled && (
              <MfaSetup
                onDone={() => {
                  onUpdated();
                  setMessage("Authenticator enabled");
                }}
              />
            )}
            <details className="settings-section">
              <summary>Change your password</summary>
              <form className="dialog-form" onSubmit={changePassword}>
                <label>
                  Current password
                  <input
                    type="password"
                    name="current"
                    required
                    autoComplete="current-password"
                  />
                </label>
                <NewPassword label="New password" name="password" required />
                <button className="button secondary">Update password</button>
              </form>
            </details>
            <button className="button secondary" onClick={onLogout}>
              <LogOut size={16} />
              Sign out
            </button>
          </>
        )}
        {tab === "backgrounds" && user.role === "admin" && (
          <BackgroundSettings />
        )}
        {tab === "team" && (
          <>
            <div className="table-heading">
              <h3>Staff accounts</h3>
              <button
                className="button primary small"
                onClick={() => setAdding(!adding)}
              >
                <Plus size={16} />
                Add staff
              </button>
            </div>
            {adding && (
              <AccountCreation
                onDone={() => {
                  setAdding(false);
                  void reloadUsers();
                }}
              />
            )}
            {resetTarget && (
              <form
                className="dialog-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  setBusy(true);
                  setError("");
                  try {
                    await post("/admin/users/" + resetTarget.id, {
                      password: data.get("newStaffPassword"),
                    });
                    form.reset();
                    setResetTarget(null);
                    setMessage(
                      "Password reset and existing sessions ended. Share the new password privately.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <NewPassword
                  label={"New password for " + resetTarget.name}
                  name="newStaffPassword"
                  required
                />
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => setResetTarget(null)}
                  >
                    Cancel
                  </button>
                  <button className="button primary" disabled={busy}>
                    Reset password
                  </button>
                </div>
              </form>
            )}
            <div className="staff-list">
              {users.map((u) => (
                <div className="staff-row" key={u.id}>
                  <StaffAvatar user={u} className="avatar small" />
                  <div>
                    <strong>{u.name}</strong>
                    <small>
                      @{u.username} ·{" "}
                      {u.role === "reviewer" ? "Media editor" : u.role} ·{" "}
                      {u.libraryAccess ? "Library & Transfer" : "Transfer only"}
                    </small>
                  </div>
                  <span
                    className={"status " + (u.disabled ? "revoked" : "active")}
                  >
                    {u.disabled
                      ? "Disabled"
                      : u.invitationPending
                        ? "Invitation pending"
                        : "Active"}
                  </span>
                  {u.invitationPending && !u.disabled && (
                    <button
                      className="text-button"
                      onClick={async () => {
                        try {
                          const result = await post(
                            "/admin/users/" + u.id + "/invitation",
                          );
                          setMessage("New invitation: " + result.invitationUrl);
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Create new invitation
                    </button>
                  )}
                  {u.id !== user.id && (
                    <>
                      {!u.invitationPending && (
                        <button
                          className="text-button"
                          onClick={() => {
                            setResetTarget(u);
                            setError("");
                          }}
                        >
                          Reset password
                        </button>
                      )}
                      <button
                        className="text-button"
                        onClick={async () => {
                          try {
                            await post("/admin/users/" + u.id, {
                              disabled: !u.disabled,
                            });
                            await reloadUsers();
                          } catch (e) {
                            setError((e as Error).message);
                          }
                        }}
                      >
                        {u.disabled ? "Enable" : "Disable"}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="helper">
              Disabling an account ends its staff sessions and blocks its
              transfer links. Library permissions are assigned per account.
            </p>
          </>
        )}
        {tab === "audit" && (
          <div className="activity-list">
            {events.length ? (
              events.map((event, i) => (
                <div key={i}>
                  <span className="activity-dot" />
                  <div>
                    <strong>
                      {String(event.action).replaceAll(".", " · ")}
                    </strong>
                    <small>{new Date(event.at).toLocaleString()}</small>
                  </div>
                  <code>{String(event.subject).slice(0, 12)}</code>
                </div>
              ))
            ) : (
              <p className="muted">No activity yet.</p>
            )}
          </div>
        )}
        {tab === "status" && (
          <>
            {status ? (
              <div className="service-grid">
                <div>
                  <span className="status active">
                    <i />
                    Available
                  </span>
                  <h3>Application API</h3>
                  <p>Version {status.version}</p>
                </div>
                <div>
                  <small>STORAGE FREE</small>
                  <h3>
                    {status.freeBytes === null
                      ? "Not available"
                      : formatBytes(status.freeBytes)}
                  </h3>
                  <p>Registry filesystem</p>
                </div>
                <div>
                  <small>STAFF ACCOUNTS</small>
                  <h3>{status.staffCount}</h3>
                  <p>Active staff</p>
                </div>
                <div>
                  <small>SOURCE CLEANUP</small>
                  <h3>{status.pendingCleanup}</h3>
                  <p>Pending retry</p>
                </div>
              </div>
            ) : (
              <Loader2 className="spin" />
            )}
            <p className="helper">
              This installation serves the AIA network. External Internet
              delivery and corporate sign-in are not configured.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
export function PublicTransfer({ id }: { id: string }) {
  const [data, setData] = useState<any>(null),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  const loadPage = useCallback(async () => {
    try {
      setData(await api("/public/" + id));
      setUnavailable(false);
    } catch (e) {
      setError((e as Error).message);
      setUnavailable(true);
    }
  }, [id]);
  useEffect(() => {
    void loadPage();
  }, [loadPage]);
  const seconds = useExpiry(data?.expiresAt);
  const expired = seconds === 0;
  async function unlock(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/public/" + id + "/authorize", { password });
      setPassword("");
      await loadPage();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="recipient-page">
      <main>
        <GlassSurface
          className="receiver-glass"
          width="100%"
          height="auto"
          borderRadius={24}
          distortionScale={-30}
          redOffset={0}
          greenOffset={0}
          blueOffset={0}
          displace={0.3}
          backgroundOpacity={0.6}
          saturation={1.1}
          refraction
          renderer="auto"
        >
          <div className="recipient-brand">
            <Brand product="media" />
            <span className="recipient-media-word">Media</span>
          </div>
          {expired ? (
            <>
              <h1>Transfer expired</h1>
              <p>
                This sharing link is inactive. Ask the sender for a new
                transfer.
              </p>
            </>
          ) : unavailable ? (
            <>
              <h1>This sharing link is inactive.</h1>
              <p>
                The link may have expired, been revoked, or reached its download
                limit. Ask the sender for a new transfer.
              </p>
              <ErrorText error={error} />
            </>
          ) : !data ? (
            <div className="loading-row">
              <Loader2 className="spin" />
              Opening your transfer…
            </div>
          ) : (
            <>
              <span className="eyebrow">
                {data.locked
                  ? "PASSWORD-PROTECTED TRANSFER"
                  : "YOUR FILES ARE READY"}
              </span>
              <h1>{data.title}</h1>
              {data.locked ? (
                <>
                  <p>
                    The sender protected this transfer with a password.
                    <br />
                    Enter it below to see and download your files.
                  </p>
                  <form className="recipient-password" onSubmit={unlock}>
                    <label>
                      Transfer password
                      <input
                        autoFocus
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        maxLength={128}
                        required
                        autoComplete="off"
                      />
                    </label>
                    <ErrorText error={error} />
                    <button className="button primary full" disabled={busy}>
                      {busy ? (
                        <Loader2 className="spin" size={17} />
                      ) : (
                        <Lock size={17} />
                      )}
                      Unlock transfer
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <p>{data.note || "Shared with you by the AIA team."}</p>
                  <div className="recipient-facts">
                    <span>
                      {data.files.length}{" "}
                      {data.files.length === 1 ? "file" : "files"}
                    </span>
                    {data.downloadLimit && (
                      <>
                        <i />
                        <span>
                          {Math.max(0, data.downloadLimit - data.downloads)}{" "}
                          download starts left
                        </span>
                      </>
                    )}
                  </div>
                  <ExpiryCountdown
                    expiresAt={data.expiresAt}
                    seconds={seconds}
                  />
                  <div className="recipient-files">
                    {data.files.map((f: any) => (
                      <div className="recipient-file" key={f.id}>
                        <IconFile name={f.name} />
                        <div>
                          <strong>{f.name}</strong>
                          <span>
                            {f.size ? formatBytes(f.size) : "Original file"}
                          </span>
                        </div>
                        <a
                          className="button secondary"
                          href={"/api/public/" + id + "/files/" + f.id}
                          onClick={(e) => {
                            if (Date.parse(data.expiresAt) <= Date.now())
                              e.preventDefault();
                          }}
                          download={f.name}
                        >
                          <ArrowDownToLine size={17} />
                          <span>Download</span>
                        </a>
                      </div>
                    ))}
                  </div>
                  {data.files.length > 1 && (
                    <>
                      <button
                        className="button primary full receiver-download-all"
                        onClick={() => {
                          if (Date.parse(data.expiresAt) <= Date.now()) return;
                          const link = document.createElement("a");
                          link.href = "/api/public/" + id + "/archive";
                          link.download = data.title + ".zip";
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                        }}
                      >
                        <ArrowDownToLine size={19} />
                        <DownloadAllText count={data.files.length} />
                      </button>
                      <small className="download-all-note">
                        ZIP containing full-quality original files.
                      </small>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </GlassSurface>
      </main>
    </div>
  );
}

function RecentTransfers({
  transfers,
  busy,
  onOpen,
  onRefresh,
}: {
  transfers: Transfer[];
  busy: boolean;
  onOpen: (t: Transfer) => void;
  onRefresh: () => void;
}) {
  const [all, setAll] = useState(false);
  return (
    <section className="recent-transfers" aria-label="Recent transfers">
      <div className="recent-heading">
        <h2>Recent transfers</h2>
        <button className="text-button" onClick={() => setAll((v) => !v)}>
          {all ? "Show recent" : "View all"}
          <ArrowRight size={16} />
        </button>
      </div>
      {busy && !transfers.length ? (
        <p role="status">Loading transfers...</p>
      ) : !transfers.length ? (
        <div className="recent-empty">
          <Send size={32} />
          <h3>No transfers yet</h3>
          <p>Select your files to create the first handoff.</p>
        </div>
      ) : (
        <ul>
          {transfers.slice(0, all ? undefined : 4).map((t) => (
            <li key={t.id}>
              <button
                className="recent-transfer-name"
                onClick={() => onOpen(t)}
              >
                <span className={"transfer-real-icon " + t.source}>
                  {t.source === "library" ? (
                    <Layers size={24} />
                  ) : (
                    <File size={24} />
                  )}
                </span>
                <span>
                  <strong>{t.title}</strong>
                  <small>
                    {t.fileCount} {t.fileCount === 1 ? "file" : "files"}
                    {t.totalBytes
                      ? " / " + formatBytes(t.totalBytes)
                      : ""} -{" "}
                    {t.source === "library"
                      ? "From library"
                      : "Temporary upload"}
                  </small>
                </span>
              </button>
              <div className="recent-transfer-status">
                <span className={"status " + t.state}>
                  {t.state === "active"
                    ? "Available"
                    : t.state === "revoking"
                      ? "Cleanup pending"
                      : t.state[0].toUpperCase() + t.state.slice(1)}
                </span>
                <small>Expires {when(t.expiresAt)}</small>
              </div>
              <span className="transfer-download-count" title="Download starts">
                <ArrowDownToLine size={16} />
                {t.downloads}
              </span>
              <button
                className="icon-button"
                aria-label={"Open " + t.title}
                onClick={() => onOpen(t)}
              >
                <MoreHorizontal size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="text-button recent-refresh" onClick={onRefresh}>
        Refresh history
      </button>
    </section>
  );
}
