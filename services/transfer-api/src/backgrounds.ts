import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Store, UserRow } from "./store.js";
import { token } from "./security.js";
type Fail = (status: number, message: string) => never;
let activeImages = 0;
export async function normalizePhoto(
  bytes: Buffer,
  profile: boolean,
  fail: Fail,
) {
  if (activeImages >= 2)
    fail(429, "Photos are processing. Please try again shortly.");
  activeImages++;
  try {
    const detected = await fileTypeFromBuffer(bytes);
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(detected?.mime || "")
    )
      fail(400, "Choose a still JPEG, PNG or WebP image");
    const image = sharp(bytes, {
      limitInputPixels: 24_000_000,
      failOn: "error",
    });
    const meta = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(meta.format || "") ||
      (meta.pages || 1) > 1
    )
      return fail(400, "Choose a still JPEG, PNG or WebP image");
    return await image
      .rotate()
      .resize(
        profile
          ? { width: 512, height: 512, fit: "cover" }
          : {
              width: 1200,
              height: 900,
              fit: "inside",
              withoutEnlargement: true,
            },
      )
      .webp({ quality: 82 })
      .toBuffer();
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error;
    return fail(400, "The image cannot be read, or exceeds 24 megapixels");
  } finally {
    activeImages--;
  }
}
export function registerBackgrounds(
  app: FastifyInstance,
  store: Store,
  admin: (request: FastifyRequest) => UserRow,
  fail: Fail,
) {
  const photos = () =>
    store
      .all<{ id: string; title: string }>(
        "SELECT id,title FROM background_photos ORDER BY rowid",
      )
      .map((photo) => ({
        ...photo,
        url: "/api/public/backgrounds/" + photo.id + "/image",
      }));
  app.get("/api/public/backgrounds", async () => ({ photos: photos() }));
  app.get("/api/public/backgrounds/:id/image", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!/^[A-Za-z0-9_-]{43}$/.test(id))
      fail(404, "Background photo not found");
    const photo =
      store.get<{ data: Uint8Array }>(
        "SELECT data FROM background_photos WHERE id=?",
        id,
      ) || fail(404, "Background photo not found");
    return reply.type("image/webp").send(Buffer.from(photo.data));
  });
  app.get("/api/admin/backgrounds", async (request) => {
    admin(request);
    return { photos: photos(), limit: 12 };
  });
  app.post(
    "/api/admin/backgrounds",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request) => {
      const user = admin(request);
      if (
        store.get<{ count: number }>(
          "SELECT COUNT(*) AS count FROM background_photos",
        )!.count >= 12
      )
        fail(
          409,
          "Remove a background photo before adding another (maximum 12)",
        );
      const file = await request.file({
        limits: { files: 1, fileSize: 8 * 1024 ** 2, fields: 0 },
      });
      if (!file) fail(400, "Choose a photo to upload");
      const bytes = await file.toBuffer();
      const data = await normalizePhoto(bytes, false, fail);
      if (data.length > 1024 ** 2) fail(400, "Choose a smaller image");
      // Recheck after decoding, which yields to concurrent uploads.
      if (
        store.get<{ count: number }>(
          "SELECT COUNT(*) AS count FROM background_photos",
        )!.count >= 12
      )
        fail(409, "Maximum 12 background photos");
      const id = token(),
        title =
          file.filename.replace(/[\x00-\x1f]/g, "").slice(0, 80) ||
          "Background photo";
      store.run(
        "INSERT INTO background_photos(id,title,data,created_at) VALUES(?,?,?,?)",
        id,
        title,
        data,
        new Date().toISOString(),
      );
      store.audit(user.id, "background.published", id);
      return { photos: photos() };
    },
  );
  app.post("/api/admin/backgrounds/:id/remove", async (request) => {
    const user = admin(request),
      { id } = request.params as { id: string };
    if (!/^[A-Za-z0-9_-]{43}$/.test(id))
      fail(404, "Background photo not found");
    store.run("DELETE FROM background_photos WHERE id=?", id);
    store.audit(user.id, "background.removed", id);
    return { photos: photos() };
  });
}
