"use client";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout}>
      Log out
    </Button>
  );
}
