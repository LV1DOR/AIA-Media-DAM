import { createApp } from "./app.js";
const need = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const { app, cleanup } = await createApp({
  dataDir: process.env.AIA_DATA_DIR || ".local/app-data",
  masterKey: need("AIA_MASTER_KEY"),
  mediaOrigin: need("AIA_MEDIA_ORIGIN"),
  transferOrigin: need("AIA_TRANSFER_ORIGIN"),
  secureCookies: process.env.AIA_SECURE_COOKIES !== "false",
  rsUrl: need("AIA_RS_URL"),
  gokapiUrl: need("AIA_GOKAPI_URL"),
  gokapiKey: need("AIA_GOKAPI_KEY"),
  bootstrapPassword: process.env.AIA_BOOTSTRAP_PASSWORD,
  rsIdentity:
    process.env.AIA_RS_USER && process.env.AIA_RS_KEY
      ? { user: process.env.AIA_RS_USER, key: process.env.AIA_RS_KEY }
      : undefined,
  logger: true,
  rsProvisionIdentity:
    process.env.AIA_RS_PROVISION_USER && process.env.AIA_RS_PROVISION_KEY
      ? {
          user: process.env.AIA_RS_PROVISION_USER,
          key: process.env.AIA_RS_PROVISION_KEY,
        }
      : undefined,
});
void cleanup().catch(() => app.log.error("Startup cleanup will retry"));
await app.listen({
  host: process.env.AIA_BIND || "0.0.0.0",
  port: Number(process.env.AIA_API_PORT || 4100),
});
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
