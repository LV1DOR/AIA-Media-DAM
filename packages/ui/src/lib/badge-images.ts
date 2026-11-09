export type BadgeImages = {
  front: string;
  back: string;
  strap: string;
  destroy: () => void;
};
function load(src: string, signal: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const done = () => signal.removeEventListener("abort", abort);
    const abort = () => {
      image.src = "";
      done();
      reject(new DOMException("Aborted", "AbortError"));
    };
    image.onload = () => {
      done();
      resolve(image);
    };
    image.onerror = () => {
      done();
      reject(new Error("Image could not be loaded"));
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else image.src = src;
  });
}
function contain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const iw = image.naturalWidth * scale,
    ih = image.naturalHeight * scale;
  ctx.drawImage(image, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  return { c, ctx };
}
function blob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error("Badge rendering unavailable")),
      "image/png",
    ),
  );
}
export function nameLines(
  name: string,
  measure: (text: string) => number,
  maxWidth: number,
) {
  const lines: string[] = [];
  let line = "";
  for (const word of name.trim().split(/\s+/)) {
    if (line && measure(line + " " + word) <= maxWidth) {
      line += " " + word;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    for (const char of Array.from(word)) {
      if (line && measure(line + char) > maxWidth) {
        lines.push(line);
        line = char;
      } else line += char;
    }
  }
  if (line) lines.push(line.trim());
  return lines;
}
export async function generateBadgeImages(
  name: string,
  photo: File | null,
  signal: AbortSignal,
): Promise<BadgeImages> {
  const urls: string[] = [];
  let photoUrl: string | undefined;
  try {
    await document.fonts.ready;
    const logo = await load("/aia-logo.png", signal);
    let portrait: HTMLImageElement | null = null;
    if (photo) {
      photoUrl = URL.createObjectURL(photo);
      portrait = await load(photoUrl, signal);
      if (portrait.naturalWidth * portrait.naturalHeight > 24_000_000)
        throw new Error("Choose a photo smaller than 24 megapixels");
    }
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const front = canvas(600, 900),
      back = canvas(600, 900),
      strap = canvas(1024, 256);
    for (const { ctx } of [front, back]) {
      ctx.fillStyle = "#f5f5ef";
      ctx.fillRect(0, 0, 600, 900);
      ctx.fillStyle = "#123f34";
      ctx.fillRect(0, 0, 600, 120);
      ctx.fillStyle = "#f5f5ef";
      ctx.fillRect(170, 20, 260, 85);
      contain(ctx, logo, 185, 30, 230, 66);
      ctx.fillStyle = "#c12431";
      ctx.fillRect(0, 120, 600, 9);
    }
    const ctx = front.ctx;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#173f32";
    let size = 45,
      lines: string[] = [];
    do {
      ctx.font = `600 ${size}px Arial, sans-serif`;
      lines = nameLines(name, (t) => ctx.measureText(t).width, 510);
      if (lines.length <= 3) break;
      size -= 2;
    } while (size >= 20);
    lines.forEach((line, i) =>
      ctx.fillText(line, 300, 166 + i * (size + 8), 510),
    );
    ctx.fillStyle = "#dde4df";
    ctx.fillRect(100, 340, 400, 405);
    if (portrait) {
      const scale = Math.max(
          400 / portrait.naturalWidth,
          405 / portrait.naturalHeight,
        ),
        w = 400 / scale,
        h = 405 / scale;
      ctx.drawImage(
        portrait,
        (portrait.naturalWidth - w) / 2,
        (portrait.naturalHeight - h) / 2,
        w,
        h,
        100,
        340,
        400,
        405,
      );
    } else {
      ctx.fillStyle = "#466354";
      ctx.font = "600 96px Arial, sans-serif";
      ctx.fillText(
        name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((n) => Array.from(n)[0])
          .join("")
          .toUpperCase(),
        300,
        490,
      );
    }
    ctx.font = "20px Arial, sans-serif";
    ctx.fillStyle = "#597067";
    ctx.fillText("AIA MEDIA", 300, 784);
    ctx.font = "16px Arial, sans-serif";
    const b = back.ctx;
    b.strokeStyle = "#dce5de";
    b.lineWidth = 2;
    for (let i = -900; i < 1000; i += 45) {
      b.beginPath();
      b.moveTo(i, 130);
      b.lineTo(i + 850, 900);
      b.stroke();
    }
    b.fillStyle = "#f5f5ef";
    b.fillRect(55, 338, 490, 220);
    contain(b, logo, 85, 360, 430, 175);
    const st = strap.ctx;
    st.fillStyle = "#f5f5ef";
    st.fillRect(0, 0, 1024, 256);
    st.fillStyle = "#123f34";
    st.fillRect(0, 0, 1024, 16);
    st.fillRect(0, 240, 1024, 16);
    for (let x = 24; x < 1024; x += 256) contain(st, logo, x, 64, 208, 128);
    for (const item of [front, back, strap]) {
      const rendered = await blob(item.c);
      urls.push(URL.createObjectURL(rendered));
      item.c.width = 0;
      item.c.height = 0;
    }
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    return {
      front: urls[0],
      back: urls[1],
      strap: urls[2],
      destroy: () => urls.forEach((url) => URL.revokeObjectURL(url)),
    };
  } catch (e) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    throw e;
  } finally {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }
}
