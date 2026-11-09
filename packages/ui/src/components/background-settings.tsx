"use client";
import { useEffect, useState } from "react";
import { api, post } from "../lib/api";
type Photo = { id: string; title: string; url: string };
export function BackgroundSettings() {
  const [photos, setPhotos] = useState<Photo[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    api("/admin/backgrounds")
      .then((result) => {
        if (active) setPhotos(result.photos);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="background-settings">
      <h3>Public background photos</h3>
      <p>
        Choose the photos shown behind login and signup. Uploaded photos are
        public. Your private media library stays private.
      </p>
      <p className="helper">
        Up to 12 still JPEG, PNG or WebP images, 8 MB each. Photos are resized
        and metadata is removed. The default public tiles appear when this list
        is empty.
      </p>
      <label className="background-upload">
        Upload public photos
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={loading || busy || photos.length >= 12}
          onChange={async (event) => {
            const files = Array.from(event.currentTarget.files || []);
            event.currentTarget.value = "";
            if (!files.length) return;
            setBusy(true);
            setError("");
            setMessage("");
            let uploaded = 0;
            try {
              if (photos.length + files.length > 12)
                throw new Error(
                  "Choose at most " + (12 - photos.length) + " more photos.",
                );
              for (const file of files) {
                if (file.size > 8 * 1024 ** 2)
                  throw new Error(file.name + " exceeds 8 MB.");
                const form = new FormData();
                form.append("photo", file);
                const result = await api("/admin/backgrounds", {
                  method: "POST",
                  body: form,
                });
                setPhotos(result.photos);
                uploaded++;
              }
              setMessage(
                "Background photos updated. New login and signup page loads will use them.",
              );
            } catch (e) {
              setError(
                (e as Error).message +
                  (uploaded ? " Earlier photos in this batch were saved." : ""),
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {loading && <p role="status">Loading background photos…</p>}
      {busy && <p role="status">Updating photos…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
      <div className="background-photo-list">
        {photos.map((photo) => (
          <figure key={photo.id}>
            <img src={photo.url} alt={photo.title} />
            <figcaption>{photo.title}</figcaption>
            <button
              className="button secondary small"
              disabled={busy}
              aria-label={"Remove " + photo.title}
              onClick={async () => {
                setBusy(true);
                setError("");
                setMessage("");
                try {
                  const result = await post(
                    "/admin/backgrounds/" + photo.id + "/remove",
                  );
                  setPhotos(result.photos);
                  setMessage("Background photo removed.");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove
            </button>
          </figure>
        ))}
      </div>
      {!loading && !photos.length && (
        <p>Using the default public photo tiles.</p>
      )}
    </section>
  );
}
