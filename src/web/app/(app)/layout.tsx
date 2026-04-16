import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20 border border-accent/40 text-accent font-semibold">
            N
          </span>
          <span className="font-semibold">NextFlow</span>
        </div>
        <UserButton />
      </header>
      <div className="h-[calc(100vh-56px)]">{children}</div>
    </div>
  );
}
