"use client";
import { useState, useEffect, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Tags, X, Check, Loader2 } from "lucide-react";
import { useIsMobile } from "../hooks/use-mobile";
import type { Asset } from "@aia/contracts";
type TagData = {
  fieldId: number;
  tags: string[];
  options: { id: number; name: string }[];
  editable: boolean;
  canCreate: boolean;
};
const fold = (s: string) => s.normalize("NFKC").trim().toLocaleLowerCase("en");
async function request(path: string, body?: unknown) {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Tag request failed");
  return data;
}
function TagChoices({
  data,
  value,
  onChange,
}: {
  data: TagData;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const toggle = (tag: string) =>
    onChange(
      value.some((v) => fold(v) === fold(tag))
        ? value.filter((v) => fold(v) !== fold(tag))
        : [...value, tag],
    );
  const create = search.trim().normalize("NFKC");
  return (
    <>
      <div className="tag-chips" aria-label="Chosen tags">
        {value.length ? (
          value.map((tag) => (
            <button
              key={fold(tag)}
              type="button"
              onClick={() => toggle(tag)}
              aria-label={"Remove tag " + tag}
            >
              {tag}
              <X size={12} />
            </button>
          ))
        ) : (
          <span className="helper">No tags selected</span>
        )}
      </div>
      <Command label="Search tags" className="tag-command">
        <Command.Input
          aria-label="Search tags"
          placeholder="Find a tag or type a new one"
          value={search}
          onValueChange={setSearch}
        />
        <Command.List>
          <Command.Empty>No matching tags</Command.Empty>
          {data.options.map((option) => (
            <Command.Item
              key={option.id}
              value={option.name}
              onSelect={() => toggle(option.name)}
            >
              <Check
                size={14}
                style={{
                  opacity: value.some((v) => fold(v) === fold(option.name))
                    ? 1
                    : 0,
                }}
              />
              {option.name}
            </Command.Item>
          ))}
          {data.canCreate &&
            create &&
            !/[,\r\n]/.test(create) &&
            !data.options.some((o) => fold(o.name) === fold(create)) && (
              <Command.Item
                value={"Create " + create}
                onSelect={() => {
                  if (!value.some((v) => fold(v) === fold(create)))
                    onChange([...value, create]);
                  setSearch("");
                }}
              >
                Create {create}
              </Command.Item>
            )}
        </Command.List>
      </Command>
      <small className="helper">
        New tags are subject to native field permissions.
      </small>
    </>
  );
}
export function TagPopover({
  asset,
  onSaved,
  open,
  onOpenChange,
}: {
  asset: Asset;
  onSaved: () => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const mobile = useIsMobile();
  const [data, setData] = useState<TagData | null>(null),
    [value, setValue] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setError("");
    setData(null);
    request("/library/" + asset.id + "/tags")
      .then((d) => {
        if (active) {
          setData(d);
          setValue(d.tags);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) onOpenChange(false);
    });
    if (trigger.current) observer.observe(trigger.current);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [open, asset.id]);
  async function save() {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      const result = await request("/library/tags", {
        resourceIds: [asset.id],
        mode: "replace",
        tags: value,
        expected: data.tags,
      });
      if (result.failed.length) throw new Error(result.failed[0].error);
      onSaved();
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const body = (
    <>
      {" "}
      <h3>Edit tags</h3>
      <p className="helper">{asset.title}</p>
      {!data && !error && (
        <p role="status">
          <Loader2 className="spin" size={16} /> Loading current tags...
        </p>
      )}
      {data &&
        (data.editable ? (
          <TagChoices data={data} value={value} onChange={setValue} />
        ) : (
          <p>Native edit access is not available.</p>
        ))}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="tag-actions">
        <button
          className="button secondary small"
          disabled={busy}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </button>
        <button
          className="button primary small"
          disabled={busy || !data?.editable}
          onClick={save}
        >
          {busy ? "Saving..." : "Save tags"}
        </button>
      </div>
    </>
  );
  const triggerButton = (
    <button
      ref={trigger}
      type="button"
      className="gallery-icon gallery-tag-trigger"
      aria-label={"Edit tags for " + asset.title}
    >
      <Tags size={16} />
    </button>
  );
  if (mobile)
    return (
      <Dialog.Root
        open={open}
        onOpenChange={(v) => {
          if (!busy) onOpenChange(v);
        }}
      >
        <Dialog.Trigger asChild>{triggerButton}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="tag-popover tag-mobile-sheet"
            aria-describedby={undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <Dialog.Title className="sr-only">
              Edit tags for {asset.title}
            </Dialog.Title>
            {body}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  return (
    <Popover.Root
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
    >
      <Popover.Trigger asChild>{triggerButton}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="tag-popover"
          sideOffset={10}
          align="end"
          collisionPadding={12}
          role="dialog"
          aria-label={"Edit tags for " + asset.title}
          onClick={(e) => e.stopPropagation()}
        >
          {body}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
export function BulkTags({
  assets,
  onClose,
  onSaved,
}: {
  assets: Asset[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<TagData | null>(null),
    [value, setValue] = useState<string[]>([]),
    [mode, setMode] = useState<"add" | "remove">("add"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [failed, setFailed] = useState<{ id: number; error: string }[]>([]),
    [finished, setFinished] = useState(false),
    [mixed, setMixed] = useState<string[]>([]);
  const opener = useRef<Element | null>(
    typeof document !== "undefined" ? document.activeElement : null,
  );
  useEffect(() => {
    let active = true;
    (async () => {
      const records: TagData[] = [];
      for (const asset of assets)
        records.push(await request("/library/" + asset.id + "/tags"));
      if (!active) return;
      const options = [
        ...new Map(
          records.flatMap((r) => r.options).map((o) => [fold(o.name), o]),
        ).values(),
      ];
      setData({
        ...records[0],
        options,
        canCreate: records.every((r) => r.canCreate),
        editable: records.some((r) => r.editable),
      });
      const counts = new Map<string, number>();
      for (const row of records)
        for (const name of new Set(row.tags))
          counts.set(name, (counts.get(name) || 0) + 1);
      setMixed(
        [...counts].map(
          ([name, count]) => name + " (" + count + "/" + assets.length + ")",
        ),
      );
    })().catch((e) => {
      if (active) setError(e.message);
    });
    return () => {
      active = false;
    };
  }, [assets.map((a) => a.id).join(",")]);
  async function save(retry = false) {
    setBusy(true);
    setError("");
    setProgress(0);
    setFinished(false);
    const errors: { id: number; error: string }[] = [];
    const ids = retry ? failed.map((f) => f.id) : assets.map((a) => a.id);
    for (const id of ids) {
      try {
        const result = await request("/library/tags", {
          resourceIds: [id],
          mode,
          tags: value,
        });
        errors.push(...result.failed);
      } catch (e) {
        errors.push({ id, error: (e as Error).message });
      }
      setProgress((n) => n + 1);
    }
    setFailed(errors);
    setFinished(true);
    setBusy(false);
    onSaved();
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="modal asset-detail-panel bulk-tags"
          aria-describedby="bulk-tags-effect"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (
              opener.current instanceof HTMLElement &&
              opener.current.isConnected
            )
              opener.current.focus();
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <div className="modal-head">
            <Dialog.Title>Edit tags - {assets.length} assets</Dialog.Title>
            <button
              aria-label="Close tag editor"
              className="icon-button"
              disabled={busy}
              onClick={onClose}
            >
              <X />
            </button>
          </div>
          <div className="dialog-form">
            <p id="bulk-tags-effect">
              {mode === "add"
                ? "Add chosen tags to each asset. Existing tags stay in place."
                : "Remove only chosen tags from each asset. All other tags stay in place."}{" "}
              Saves are per asset and may partially fail.
            </p>
            <label>
              Tag action
              <select
                aria-label="Tag action"
                value={mode}
                disabled={busy || finished}
                onChange={(e) => setMode(e.target.value as "add" | "remove")}
              >
                <option value="add">Add tags</option>
                <option value="remove">Remove tags</option>
              </select>
            </label>
            {mixed.length > 0 && (
              <p className="helper">Current tags: {mixed.join(", ")}</p>
            )}
            {data && !busy && !finished && (
              <TagChoices
                data={{ ...data, canCreate: data.canCreate && mode === "add" }}
                value={value}
                onChange={setValue}
              />
            )}{" "}
            {!data && !error && <p role="status">Loading selected assets...</p>}
            {error && <p role="alert">{error}</p>}
            {(busy || finished) && (
              <p role="status">
                {progress} processed - {failed.length} failed
                {finished && !failed.length ? " - Saved" : ""}
              </p>
            )}
            {failed.length > 0 && (
              <ul className="tag-failures">
                {failed.map((f) => (
                  <li key={f.id}>
                    Asset {f.id}: {f.error}
                  </li>
                ))}
              </ul>
            )}
            <div className="tag-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={onClose}
              >
                Done
              </button>
              {finished && failed.length > 0 ? (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  Retry failed assets
                </button>
              ) : (
                !finished && (
                  <button
                    className="button primary"
                    disabled={busy || !data || !value.length}
                    onClick={() => void save()}
                  >
                    {busy ? "Saving..." : "Apply tags"}
                  </button>
                )
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
