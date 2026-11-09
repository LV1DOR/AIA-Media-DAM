"use client";
import { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { HardDrive } from "lucide-react";
import { useIsMobile } from "../hooks/use-mobile";
import UsageMeter from "./ui/usage-meter";
type Storage = {
  available: boolean;
  label: string;
  totalBytes?: number;
  availableBytes?: number;
  usedBytes?: number;
  measuredAt?: string;
};
export function StorageMeter({
  onOpenChange,
}: { onOpenChange?: (open: boolean) => void } = {}) {
  const mobile = useIsMobile();
  const [data, setData] = useState<Storage | null>(null),
    [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    try {
      const response = await fetch("/api/storage", {
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      setData({ available: false, label: "Application data filesystem" });
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const valid = !!(
    data?.available &&
    data.totalBytes &&
    Number.isFinite(data.usedBytes)
  );
  const percent = valid
    ? Math.round((100 * data!.usedBytes!) / data!.totalBytes!)
    : null;
  return (
    <Popover.Root modal={mobile} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button className="storage-pill" aria-label="Storage usage">
          <HardDrive size={16} />
          <span>
            Filesystem storage
            <small>
              {busy
                ? "Measuring..."
                : percent === null
                  ? "Usage unavailable"
                  : percent + "% used or reserved"}
            </small>
          </span>
          {percent !== null && (
            <span className="storage-pill-track" aria-hidden="true">
              <i style={{ width: percent + "%" }} />
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="storage-popover usage-meter-scope"
          side={mobile ? "top" : "right"}
          align={mobile ? "start" : "end"}
          sideOffset={12}
          collisionPadding={12}
          role="dialog"
          aria-label="Filesystem storage usage"
        >
          {valid ? (
            <UsageMeter
              label={data!.label}
              limit={data!.totalBytes! / 1024 ** 3}
              unit="GiB"
              decimals={1}
              warnAt={2}
              segments={[
                {
                  id: "used",
                  label: "Used & reserved",
                  value: data!.usedBytes! / 1024 ** 3,
                },
              ]}
            />
          ) : (
            <>
              <h3>Usage unavailable</h3>
              <p>The filesystem measurement could not be read.</p>
            </>
          )}
          <p className="helper">
            Whole filesystem backing application data. Includes other files and
            reserved space; this is not a DAM quota or a sum of library and
            temporary transfers.
          </p>
          {data?.measuredAt && (
            <small>
              Measured {new Date(data.measuredAt).toLocaleTimeString()}
            </small>
          )}
          <button
            className="text-button"
            onClick={() => void load()}
            disabled={busy}
          >
            Refresh measurement
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
