import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            N
          </span>
          NoteShare
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          {user ? (
            <>
              <Link href="/notes/new" className="hover:text-foreground">
                New note
              </Link>
              <span className="hidden text-foreground sm:inline">
                {user.email}
              </span>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="hover:text-foreground">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
