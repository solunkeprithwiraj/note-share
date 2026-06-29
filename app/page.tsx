import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="flex max-w-xl flex-col items-center text-center">
        <span className="mb-6 flex size-12 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
          N
        </span>
        <h1 className="text-4xl font-semibold tracking-tight">
          Share notes with secure, expiring links
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Create a note and generate a one-time or time-based link. Add a
          password, revoke anytime, and track exactly how many times it was
          viewed.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/notes/new" className={buttonVariants()}>
            Create a note
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline" })}
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
