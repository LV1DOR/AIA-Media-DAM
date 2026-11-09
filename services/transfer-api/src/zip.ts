import { ZipArchive } from "archiver";
import { Readable } from "node:stream";

/** Archive original streams without image decoding, resizing or transcoding. */
export function originalZip(
  files: { name: string; open: () => Promise<Response> }[],
  signal: AbortSignal,
) {
  const archive = new ZipArchive({ store: true, forceZip64: true });
  const names = new Set<string>();
  for (const file of files) {
    const base =
      file.name
        .replaceAll("\\", "/")
        .split("/")
        .pop()!
        .replace(/[\x00-\x1f\x7f]/g, "")
        .replace(/[<>:"|?*]/g, "_")
        .replace(/[. ]+$/, "")
        .slice(0, 180) || "file";
    let name = base,
      n = 2;
    while (names.has(name.toLowerCase())) {
      const dot = base.lastIndexOf(".");
      name =
        dot > 0
          ? `${base.slice(0, dot)} (${n++})${base.slice(dot)}`
          : `${base} (${n++})`;
    }
    names.add(name.toLowerCase());
    const input = Readable.from(
      (async function* () {
        signal.throwIfAborted();
        const response = await file.open();
        if (signal.aborted || response.status !== 200 || !response.body) {
          await response.body?.cancel();
          throw new Error("Original file unavailable");
        }
        const reader = response.body.getReader();
        const cancel = () => {
          void reader.cancel().catch(() => {});
        };
        signal.addEventListener("abort", cancel, { once: true });
        try {
          while (true) {
            signal.throwIfAborted();
            const { done, value } = await reader.read();
            if (done) break;
            yield value;
          }
          signal.throwIfAborted();
        } finally {
          signal.removeEventListener("abort", cancel);
          await reader.cancel().catch(() => {});
        }
      })(),
    );
    input.on("error", (error) => archive.destroy(error));
    archive.append(input, { name });
  }
  signal.addEventListener(
    "abort",
    () => archive.destroy(new Error("Download stopped")),
    { once: true },
  );
  return archive;
}
