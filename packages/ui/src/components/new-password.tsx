"use client";
import {
  PasswordStrength,
  type PasswordRule,
} from "./uiarc/registry/components/password-strength/password-strength";
import { PASSWORD_PATTERN } from "@aia/contracts";
import type { ComponentProps } from "react";
const rules: PasswordRule[] = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
    remaining: (value) => Math.max(0, 8 - value.length),
  },
  {
    id: "capital",
    label: "An uppercase letter",
    test: (value) => /\p{Lu}/u.test(value),
  },
  { id: "number", label: "A number", test: (value) => /[0-9]/.test(value) },
  {
    id: "symbol",
    label: "A symbol",
    test: (value) => /[\p{P}\p{S}]/u.test(value),
  },
];
export function NewPassword(props: ComponentProps<typeof PasswordStrength>) {
  return (
    <div className="aia-password-strength">
      <PasswordStrength
        {...props}
        rules={rules}
        minLength={8}
        maxLength={128}
        pattern={PASSWORD_PATTERN}
        shortLength={8}
        countCharacters={(value) => value.length}
      />
    </div>
  );
}
