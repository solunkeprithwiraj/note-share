"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ShareType = "ONE_TIME" | "TIME_BASED";
type AccessType = "PUBLIC" | "PASSWORD_PROTECTED";

type Result = {
  noteId: string;
  url: string;
  accessKey: string | null;
};

export default function NewNotePage() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [shareType, setShareType] = useState<ShareType>("ONE_TIME");
  const [accessType, setAccessType] = useState<AccessType>("PUBLIC");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const noteRes = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    if (!noteRes.ok) {
      setLoading(false);
      setError(
        noteRes.status === 401
          ? "You must be logged in."
          : "Failed to create note",
      );
      return;
    }
    const note = await noteRes.json();

    const body: Record<string, unknown> = { shareType, accessType };
    if (shareType === "TIME_BASED") {
      if (!expiresAt) {
        setLoading(false);
        setError("Pick an expiry time for time-based links.");
        return;
      }
      body.expiresAt = new Date(expiresAt).toISOString();
    }

    const shareRes = await fetch(`/api/notes/${note.id}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!shareRes.ok) {
      const data = await shareRes.json().catch(() => ({}));
      setError(data.error ?? "Failed to create share link");
      return;
    }
    const share = await shareRes.json();
    setResult({ noteId: note.id, url: share.url, accessKey: share.accessKey });
  }

  function copy(value: string, label: string) {
    navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  }

  if (result) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="text-green-600 dark:text-green-400">
              Share link created
            </CardTitle>
            <CardDescription>
              Send this link to whoever should read the note.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>Link</Label>
              <div className="flex gap-2">
                <Input readOnly value={result.url} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copy(result.url, "Link")}
                >
                  Copy
                </Button>
              </div>
            </div>

            {result.accessKey && (
              <div className="space-y-2">
                <Label>Access key</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={result.accessKey}
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => copy(result.accessKey ?? "", "Access key")}
                  >
                    Copy
                  </Button>
                </div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Shown once. Copy it now — you cannot retrieve it later.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="mt-4 gap-3">
            <Link
              href={`/notes/${result.noteId}`}
              className={buttonVariants({ variant: "outline" })}
            >
              Manage note
            </Link>
            <Button
              onClick={() => {
                setResult(null);
                setTitle("");
                setContent("");
                setExpiresAt("");
              }}
            >
              New note
            </Button>
          </CardFooter>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>New note</CardTitle>
          <CardDescription>
            Create a note and generate its share link.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                required
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Share type</Label>
                <Select
                  value={shareType}
                  onValueChange={(v) => setShareType(v as ShareType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONE_TIME">One-time</SelectItem>
                    <SelectItem value="TIME_BASED">Time-based</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Access</Label>
                <Select
                  value={accessType}
                  onValueChange={(v) => setAccessType(v as AccessType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public</SelectItem>
                    <SelectItem value="PASSWORD_PROTECTED">
                      Password protected
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {shareType === "TIME_BASED" && (
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expires at</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            )}
          </CardContent>
          <CardFooter className="mt-6">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating..." : "Create note & share link"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
