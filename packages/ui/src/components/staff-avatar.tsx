"use client";
import { useState } from "react";
import type { Staff } from "@aia/contracts";
export function StaffAvatar({
  user,
  className = "staff-avatar",
}: {
  user: Staff;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={"staff-avatar " + className}
      role="img"
      aria-label={user.name}
    >
      <span aria-hidden="true">
        {user.name
          .split(/\s+/)
          .map((n) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </span>
      {user.hasProfilePhoto && !failed && (
        <img
          src={"/api/staff/" + user.id + "/photo"}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
