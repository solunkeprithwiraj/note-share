"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ShareLink = {
  id: string;
  token: string;
  shareType: "ONE_TIME" | "TIME_BASED";
  accessType: "PUBLIC" | "PASSWORD_PROTECTED";
  expiresAt: string | null;
  usedAt: string | null;
  isRevoked: boolean;
  viewCount: number;
  createdAt: string;
};

type Note = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  shareLinks: ShareLink[];
};

function linkStatus(l: ShareLink): string {
  if (l.isRevoked) return "revoked";
  if (l.shareType === "ONE_TIME" && l.usedAt) return "used";
  if (
    l.shareType === "TIME_BASED" &&
    l.expiresAt &&
    new Date(l.expiresAt) <= new Date()
  )
    return "expired";
  return "active";
}

export default function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [note, setNote] = useState<Note | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/notes/${id}`);
    setLoading(false);
    if (!res.ok) {
      setError(
        res.status === 401 ? "You must be logged in." : "Note not found.",
      );
      return;
    }
    setNote(await res.json());
  }

  useEffect(() => {
    load();
  }, [id]);

  async function revoke(token: string) {
    await fetch(`/api/share/${token}/revoke`, { method: "POST" });
    toast.success("Link revoked");
    load();
  }

  const base = typeof window !== "undefined" ? window.location.origin : "";

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center text-muted-foreground">
        Loading...
      </main>
    );
  }

  if (error || !note) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>{error || "Not found"}</p>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Go to login
        </Link>
      </main>
    );
  }

  return (
    <main className="flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{note.title}</h1>
          <Link href="/notes/new" className={buttonVariants()}>
            New note
          </Link>
        </div>

        <Card>
          <CardContent className="whitespace-pre-wrap text-muted-foreground">
            {note.content}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Share links</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {note.shareLinks.map((l) => {
                  const status = linkStatus(l);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        {l.shareType === "ONE_TIME" ? "One-time" : "Time-based"}
                      </TableCell>
                      <TableCell>
                        {l.accessType === "PUBLIC" ? "Public" : "Password"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            status === "active" ? "default" : "secondary"
                          }
                        >
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell>{l.viewCount}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${base}/share/${l.token}`,
                            );
                            toast.success("Link copied");
                          }}
                        >
                          Copy
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        {status === "active" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => revoke(l.token)}
                          >
                            Revoke
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {note.shareLinks.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      No share links yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
