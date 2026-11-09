import { z } from "zod";
export const roles = ["admin", "reviewer", "marketer"] as const;
export type Role = (typeof roles)[number];
export type Staff = {
  id: string;
  username: string;
  name: string;
  role: Role;
  mfaEnabled: boolean;
  invitationPending?: boolean;
  hasProfilePhoto?: boolean;
  libraryAccess: boolean;
};
export type Asset = {
  id: number;
  title: string;
  filename: string;
  extension: string;
  kind: "photo" | "video" | "other";
  state: number;
  access: number;
  year: string;
  event: string;
  bytes: number;
  created: string;
  previewWidth?: number;
  previewHeight?: number;
  championship?: string;
};
export type Field = {
  id: number;
  name: string;
  title: string;
  value: string;
  type: number;
};
export type TransferFile = {
  id: string;
  name: string;
  size: number;
  uploadedBytes: number;
  complete: boolean;
};
export type Transfer = {
  id: string;
  title: string;
  note: string;
  source: "library" | "temporary";
  state: "draft" | "active" | "revoked" | "expired" | "revoking";
  createdAt: string;
  expiresAt: string;
  passwordProtected: boolean;
  downloadLimit: number | null;
  downloads: number;
  fileCount: number;
  totalBytes?: number | null;
  ownerName: string;
  files?: TransferFile[];
  link?: string;
};
export const transferInput = z.object({
  title: z.string().trim().min(1).max(120),
  note: z.string().max(1000).default(""),
  days: z.number().int().min(1).max(30).default(7),
  password: z.string().max(128).default(""),
  downloadLimit: z.number().int().min(1).max(10000).nullable().default(null),
  resourceIds: z.array(z.number().int().positive()).min(1).max(100).optional(),
  files: z
    .array(
      z.object({
        name: z.string().min(1).max(240),
        size: z
          .number()
          .int()
          .min(1)
          .max(20 * 1024 ** 3),
      }),
    )
    .min(1)
    .max(100)
    .optional(),
});
export const PASSWORD_PATTERN = String.raw`(?=.*\p{Lu})(?=.*[0-9])(?=.*[\p{P}\p{S}]).{8,128}`;
export const PASSWORD_HINT =
  "At least 8 characters, including an uppercase letter, a number and a symbol.";
export const passwordInput = z
  .string()
  .min(8, PASSWORD_HINT)
  .max(128)
  .regex(/\p{Lu}/u, PASSWORD_HINT)
  .regex(/[0-9]/, PASSWORD_HINT)
  .regex(/[\p{P}\p{S}]/u, PASSWORD_HINT);
export const userInput = z.object({
  username: z.string().regex(/^[a-zA-Z0-9._-]{3,40}$/),
  name: z.string().trim().min(1).max(80),
  password: passwordInput,
  role: z.enum(roles),
  libraryAccess: z.boolean().default(true),
  rsUser: z.string().max(100).optional(),
  rsKey: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
});
export const MAX_CHUNK = 16 * 1024 * 1024;
export const formatBytes = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : bytes >= 1024 ** 2
      ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
