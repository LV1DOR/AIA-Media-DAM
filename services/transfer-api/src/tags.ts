import { ResourceSpace, UpstreamError, type RsIdentity } from "./adapters.js";
export const foldTag = (name: string) =>
  name.normalize("NFKC").trim().toLocaleLowerCase("en");
export async function readTags(rs: ResourceSpace, who: RsIdentity, id: number) {
  await rs.detail(who, id);
  const fields = await rs.call<any[]>(who, "get_resource_field_data", {
    resource: String(id),
  });
  const field = fields.find(
    (f) => f.name === "keywords" && Number(f.type) === 9,
  );
  if (!field) throw new UpstreamError(404);
  const nodes = await rs.call<{ ref: number; name: string }[]>(
    who,
    "get_nodes",
    { ref: String(field.ref) },
  );
  const options = nodes.map((n) => ({
    id: Number(n.ref),
    name: String(n.name),
  }));
  const tags = String(field.value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // Never drop an unresolvable value while performing an apparently additive edit.
  if (tags.some((t) => !options.some((n) => foldTag(n.name) === foldTag(t))))
    throw new UpstreamError(502);
  const editable =
    (await rs.call(who, "get_edit_access", { resource: String(id) })) === true;
  return {
    fieldId: Number(field.ref),
    tags,
    options,
    editable,
    canCreate: editable && Number(field.type) === 9,
  };
}
export async function writeTags(
  rs: ResourceSpace,
  who: RsIdentity,
  id: number,
  input: {
    mode: "add" | "remove" | "replace";
    tags: string[];
    expected?: string[];
  },
) {
  const current = await readTags(rs, who, id);
  if (!current.editable) throw new UpstreamError(403);
  if (
    input.expected &&
    JSON.stringify(current.tags.map(foldTag).sort()) !==
      JSON.stringify(input.expected.map(foldTag).sort())
  )
    throw new Error("Tags changed. Reload this asset before saving again.");
  const requested = [
    ...new Map(
      input.tags.map((t) => [foldTag(t), t.normalize("NFKC").trim()]),
    ).values(),
  ];
  const wanted = new Map(
    (input.mode === "replace" ? [] : current.tags).map((t) => [foldTag(t), t]),
  );
  for (const tag of requested) {
    if (input.mode === "remove") wanted.delete(foldTag(tag));
    else wanted.set(foldTag(tag), tag);
  }
  if (wanted.size > 100)
    throw new Error("An asset may contain at most 100 tags in this editor.");
  const ids: number[] = [];
  for (const name of wanted.values()) {
    let node = current.options.find((n) => foldTag(n.name) === foldTag(name));
    if (!node) {
      // Native set_node enforces current user/field node-creation permissions.
      const created = await rs.call(who, "set_node", {
        ref: "NULL",
        resource_type_field: String(current.fieldId),
        name,
      });
      if (
        (typeof created !== "number" &&
          !(typeof created === "string" && /^\d+$/.test(created))) ||
        !Number.isSafeInteger(Number(created)) ||
        Number(created) <= 0
      )
        throw new UpstreamError(403);
      node = { id: Number(created), name };
    }
    ids.push(node.id);
  }
  const result = await rs.call(who, "update_field", {
    resource: String(id),
    field: String(current.fieldId),
    value: ids.join(","),
    nodevalues: "1",
  });
  if (result !== true) throw new UpstreamError(403);
  return { tags: [...wanted.values()] };
}

// Serialize this service's tag saves so concurrent additive requests cannot
// overwrite each other's reads or create duplicate canonical names here.
// Other native clients remain outside this lock; the source API has no CAS.
let pendingTagWrite: Promise<void> = Promise.resolve();
export async function serializeTagWrite<T>(work: () => Promise<T>): Promise<T> {
  const previous = pendingTagWrite;
  let release!: () => void;
  pendingTagWrite = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await work();
  } finally {
    release();
  }
}
