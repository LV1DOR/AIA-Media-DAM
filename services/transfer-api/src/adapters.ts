import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import makeFetchCookie from "fetch-cookie";
import { CookieJar } from "tough-cookie";
import { load } from "cheerio";
import type { Asset, Field } from "@aia/contracts";
export type RsIdentity = { user: string; key: string };
type Row = Record<string, any>;
export class UpstreamError extends Error {
  constructor(public status = 502) {
    super("The media service could not complete this request");
  }
}
export function sourceUrl(value: string, base: string) {
  const url = new URL(value, base);
  if (url.origin !== new URL(base).origin || url.username || url.password)
    throw new UpstreamError();
  return url.toString();
}
export class ResourceSpace {
  constructor(public base: string) {}
  async call<T = any>(
    identity: RsIdentity,
    fn: string,
    params: Record<string, string> = {},
    file?: { blob: Blob; name: string },
  ): Promise<T> {
    const query = new URLSearchParams({
      user: identity.user,
      function: fn,
      ...params,
    }).toString();
    const sign = createHash("sha256")
      .update(identity.key + query)
      .digest("hex");
    let body: URLSearchParams | FormData = new URLSearchParams({
      query,
      sign,
      user: identity.user,
    });
    if (file) {
      const form = new FormData();
      for (const [k, v] of body) form.set(k, v);
      form.set("file", file.blob, file.name);
      body = form;
    }
    const response = await fetch(this.base + "/api/", {
      method: "POST",
      body,
      redirect: "error",
      signal: AbortSignal.timeout(file ? 3600_000 : 120000),
    });
    if (!response.ok) throw new UpstreamError(response.status);
    // ResourceSpace r29907 signals successful multipart uploads with an empty 204.
    if (response.status === 204 && fn === "upload_multipart")
      return { status: "success" } as T;
    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new UpstreamError();
    }
    if (data === false || data?.error || data?.status === "fail")
      throw new UpstreamError(403);
    return data as T;
  }
  asset(row: Row): Asset {
    const extension = String(row.file_extension || "").toLowerCase();
    return {
      id: Number(row.ref),
      title: String(
        row.field8 || row.title || row.file_name || `Asset ${row.ref}`,
      ),
      filename: String(
        row.file_name || row.field51 || row.field8 || `Asset ${row.ref}`,
      ),
      extension,
      kind: ["mp4", "mov", "m4v", "webm", "mxf"].includes(extension)
        ? "video"
        : [
              "jpg",
              "jpeg",
              "png",
              "tif",
              "tiff",
              "dng",
              "cr2",
              "nef",
              "arw",
              "webp",
            ].includes(extension)
          ? "photo"
          : "other",
      state: Number(row.archive || 0),
      access: Number(row.access || 0),
      year: String(row.field88 || ""),
      event: String(row.field89 || ""),
      bytes: Number(row.file_size || row.size || 0),
      created: String(row.creation_date || row.created || ""),
      previewWidth:
        Number(row.thumb_width) > 0 ? Number(row.thumb_width) : undefined,
      previewHeight:
        Number(row.thumb_height) > 0 ? Number(row.thumb_height) : undefined,
      championship: String(row.field90 || ""),
    };
  }
  async search(
    who: RsIdentity,
    search: string,
    page: number,
    state: number,
    kind = "all",
  ) {
    const result = await this.call<Row>(who, "do_search", {
      search,
      archive: String(state),
      fetchrows: `${page * 48},48`,
      order_by: "resourceid",
      sort: "DESC",
      restypes: kind === "photo" ? "1" : kind === "video" ? "3" : "",
    });
    const rows = Array.isArray(result) ? result : result.data || [];
    return {
      items: rows.map((r: Row) => this.asset(r)),
      total: Number(result.total ?? rows.length),
      page,
    };
  }
  async detail(who: RsIdentity, id: number) {
    const access = await this.call<number>(who, "get_resource_access", {
      resource: String(id),
    });
    if (Number(access) !== 0) throw new UpstreamError(403);
    const row = await this.call<Row>(who, "get_resource_data", {
      resource: String(id),
    });
    const fields = await this.call<Row[]>(who, "get_resource_field_data", {
      resource: String(id),
    });
    return {
      asset: this.asset(row),
      fields: fields
        .filter((f: Row) => f.name !== "aiareviewnotes")
        .map((f: Row): Field => ({
          id: Number(f.ref),
          name: String(f.name),
          title: String(f.title),
          value: String(f.value ?? ""),
          type: Number(f.type),
        })),
    };
  }
  async preview(
    who: RsIdentity,
    id: number,
    original = false,
    range?: string,
    video = false,
    thumbnail = false,
  ) {
    const row = await this.call<Row>(who, "get_resource_data", {
      resource: String(id),
    });
    let size = original ? "" : video ? "pre" : thumbnail ? "thm" : "scr";
    let extension = original
      ? String(row.file_extension)
      : video
        ? "mp4"
        : String(row.preview_extension || "jpg");
    if (!original && !video && !thumbnail) {
      // ResourceSpace may omit scr for smaller images and return a generic
      // file icon with HTTP 200. Select an existing preview, never the original.
      const sizes = await this.call<Row[]>(
        who,
        "get_resource_all_image_sizes",
        {
          resource: String(id),
        },
      );
      const rendition = ["scr", "pre", "thm", "col"]
        .map((code) => sizes.find((item) => item.size_code === code))
        .find(Boolean);
      if (!rendition) throw new UpstreamError(404);
      size = String(rendition.size_code);
      extension = String(rendition.extension || extension);
    }
    const url = await this.call<string>(who, "get_resource_path", {
      ref: String(id),
      size,
      generate: "0",
      extension,
      write_metadata: "0",
    });
    if (!url) throw new UpstreamError(404);
    return fetch(sourceUrl(url, this.base), {
      redirect: "error",
      headers: range ? { Range: range } : {},
    });
  }
  async upload(who: RsIdentity, name: string, blob: Blob, type: number) {
    const id = await this.call<number>(who, "create_resource", {
      resource_type: String(type),
      archive: "-1",
    });
    try {
      const result = await this.call(
        who,
        "upload_multipart",
        {
          ref: String(id),
          // Typed PHP booleans coerce the nonempty string "false" to true.
          no_exif: "0",
          revert: "0",
          autorotate: "0",
        },
        { blob, name },
      );
      if (result?.status === "fail") throw new UpstreamError();
      await this.call(who, "update_field", {
        resource: String(id),
        field: "8",
        value: name,
      });
      // Keep incomplete uploads private until file processing and metadata finish.
      // Publication is automatic; no human review/approval queue is involved.
      const published = await this.call(who, "put_resource_data", {
        resource: String(id),
        data: JSON.stringify({ archive: 0 }),
      });
      if (published !== true) throw new UpstreamError(403);
      return id;
    } catch (error) {
      try {
        await this.call(who, "delete_resource", { resource: String(id) });
      } catch {}
      throw error;
    }
  }
}
export class Gokapi {
  constructor(
    public base: string,
    private key: string,
  ) {}
  async api(
    path: string,
    method = "GET",
    headers: Record<string, string> = {},
    body?: FormData,
  ) {
    const response = await fetch(this.base + "/api/" + path, {
      method,
      headers: { apikey: this.key, ...headers },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(
        path === "chunk/complete" ? 3600_000 : 180000,
      ),
    });
    if (!response.ok) throw new UpstreamError(response.status);
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  async chunk(uuid: string, total: number, offset: number, bytes: Uint8Array) {
    const form = new FormData();
    form.set("file", new Blob([new Uint8Array(bytes)]), "chunk.bin");
    form.set("uuid", uuid);
    form.set("filesize", String(total));
    form.set("offset", String(offset));
    await this.api("chunk/add", "POST", {}, form);
  }
  async complete(
    uuid: string,
    size: number,
    name: string,
    days: number,
    password: string,
  ) {
    const headers = {
      uuid,
      filename: name,
      filesize: String(size),
      contenttype: "application/octet-stream",
      allowedDownloads: "2147483647",
      expiryDays: String(days),
      password,
      nonblocking: "false",
    };
    // Native finalization hashes/encrypts large files before returning headers.
    // Use an explicit bounded HTTP request instead of fetch's shorter header deadline.
    const target = new URL(this.base + "/api/chunk/complete");
    const result = await new Promise<Row>((resolve, reject) => {
      const send = target.protocol === "https:" ? httpsRequest : httpRequest;
      const request = send(
        target,
        {
          method: "POST",
          headers: { apikey: this.key, ...headers },
          signal: AbortSignal.timeout(3600_000),
        },
        (response) => {
          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on("data", (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 1024 ** 2) request.destroy(new UpstreamError());
            else chunks.push(chunk);
          });
          response.on("error", () => reject(new UpstreamError()));
          response.on("end", () => {
            if (response.statusCode !== 200) {
              reject(new UpstreamError(response.statusCode));
              return;
            }
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString()));
            } catch {
              reject(new UpstreamError());
            }
          });
        },
      );
      request.on("error", () => reject(new UpstreamError(504)));
      request.end();
    });
    if (
      result?.Result !== "OK" ||
      !result.FileInfo?.Id ||
      result.FileInfo.SizeBytes !== size
    )
      throw new UpstreamError();
    return result.FileInfo as Row;
  }
  async info(id: string) {
    return this.api("files/list/" + encodeURIComponent(id)) as Promise<Row>;
  }
  async find(name: string, size: number) {
    const files = await this.api("files/list");
    if (files !== null && !Array.isArray(files)) throw new UpstreamError();
    const matches = (files || []).filter(
      (f: Row) => f.Name === name && f.SizeBytes === size,
    );
    if (matches.length > 1) throw new UpstreamError();
    return matches[0] as Row | undefined;
  }
  async remove(id: string) {
    try {
      await this.api("files/delete", "DELETE", { id });
    } catch (e) {
      if (!(e instanceof UpstreamError && e.status === 404)) throw e;
    }
  }
}
/** Authenticate only the source-scoped password; never a staff/browser session. */
export async function nativeDownload(
  url: string,
  password: string,
  base: string,
  kind: "rs" | "gokapi",
  range?: string,
  signal?: AbortSignal,
) {
  const scopedFetch: typeof fetch = (input, init) =>
    fetch(
      sourceUrl(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        base,
      ),
      {
        ...init,
        signal: signal
          ? AbortSignal.any([signal, ...(init?.signal ? [init.signal] : [])])
          : init?.signal,
      },
    );
  const client = makeFetchCookie(scopedFetch, new CookieJar());
  const target = sourceUrl(url, base);
  let response = await client(target, { headers: range ? { range } : {} });
  let authenticated = false;
  for (
    let step = 0;
    step < 5 && response.headers.get("content-type")?.includes("text/html");
    step++
  ) {
    const html = await response.text();
    const $ = load(html);
    const field = kind === "rs" ? "share_password" : "password";
    const input = $(`input[name="${field}"]`);
    const form = input.closest("form");
    if (!form.length || authenticated) {
      const refresh = $('meta[http-equiv="refresh"]').attr("content");
      const refreshUrl = refresh
        ?.match(/url\s*=\s*(.+)$/i)?.[1]
        ?.trim()
        .replace(/^["']|["']$/g, "");
      const assignment = html.match(
        /(?:window\.)?location\.href\s*=\s*("(?:\\.|[^"\\])*")/,
      );
      const next =
        refreshUrl || (assignment ? JSON.parse(assignment[1]) : undefined);
      if (!next) throw new UpstreamError(410);
      response = await client(
        sourceUrl(new URL(next, response.url || base).href, base),
        { headers: range ? { range } : {} },
      );
      continue;
    }
    const values = new URLSearchParams();
    form.find("input[name]").each((_, element) => {
      const item = $(element);
      if (item.attr("type") !== "checkbox")
        values.set(item.attr("name")!, item.attr("value") || "");
    });
    values.set(field, password);
    const action = sourceUrl(
      new URL(form.attr("action") || response.url, base).toString(),
      base,
    );
    response = await client(action, {
      method: "POST",
      body: values,
      headers: { Origin: new URL(base).origin },
    });
    authenticated = true;
    if (range && !response.headers.get("content-type")?.includes("text/html")) {
      await response.body?.cancel();
      response = await client(action, { headers: { range } });
    }
  }
  if (
    !response.ok ||
    response.headers.get("content-type")?.includes("text/html")
  )
    throw new UpstreamError(410);
  return response;
}
