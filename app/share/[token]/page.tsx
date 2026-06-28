"use client";

import { useEffect, useState, useRef, use } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Note = { title: string; content: string };

type Meta = {
  accessType: "PUBLIC" | "PASSWORD_PROTECTED";
  shareType: "ONE_TIME" | "TIME_BASED";
  status: "active" | "revoked" | "expired" | "used";
};

const DEAD_MESSAGE: Record<string, string> = {
  revoked: "This link has been revoked.",
  expired: "This link has expired.",
  used: "This one-time link has already been used.",
};

export default function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [phase, setPhase] = useState<"loading" | "password" | "note" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [note, setNote] = useState<Note | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const started = useRef(false);

  async function view(pw?: string) {
    const res = await fetch(`/api/share/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pw ? { password: pw } : {}),
    });
    if (res.ok) {
      setNote(await res.json());
      setPhase("note");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setPhase("password");
      setMessage(pw ? "Wrong password." : "");
      return;
    }
    if (res.status === 429) {
      setPhase("password");
      setMessage("Too many attempts. Try again later.");
      return;
    }
    setPhase("error");
    setMessage(data.error ?? "This link is not available.");
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const res = await fetch(`/api/share/${token}`);
      if (!res.ok) {
        setPhase("error");
        setMessage("Invalid link.");
        return;
      }
      const meta: Meta = await res.json();
      if (meta.status !== "active") {
        setPhase("error");
        setMessage(DEAD_MESSAGE[meta.status] ?? "This link is not available.");
        return;
      }
      if (meta.accessType === "PASSWORD_PROTECTED") {
        setPhase("password");
        return;
      }
      view();
    })();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await view(password);
    setSubmitting(false);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {phase === "loading" && (
          <p className="text-center text-muted-foreground">Loading...</p>
        )}

        {phase === "error" && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              {message}
            </CardContent>
          </Card>
        )}

        {phase === "password" && (
          <Card>
            <CardHeader>
              <CardTitle>Protected note</CardTitle>
              <CardDescription>
                Enter the access key to view this note.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {message && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {message}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="key">Access key</Label>
                  <Input
                    id="key"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="mt-6">
                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? "Unlocking..." : "Unlock"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {phase === "note" && note && (
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{note.title}</CardTitle>
            </CardHeader>
            <CardContent className="whitespace-pre-wrap text-muted-foreground">
              {note.content}
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
