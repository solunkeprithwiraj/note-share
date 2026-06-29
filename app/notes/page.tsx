"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type NoteRow = {
  id: string;
  title: string;
  createdAt: string;
  _count: { shareLinks: number };
};

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notes")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setNotes(data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex flex-1 justify-center px-4 py-10">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">My notes</h1>
          <Link href="/notes/new" className={buttonVariants()}>
            New note
          </Link>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : notes.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No notes yet. Create your first one.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <Link key={note.id} href={`/notes/${note.id}`}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{note.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(note.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {note._count.shareLinks}{" "}
                      {note._count.shareLinks === 1 ? "link" : "links"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
