import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) {
    redirect("/workflows/blank");
  }

  return (
    <main className="min-h-screen flex items-center justify-center dot-grid">
      <SignIn forceRedirectUrl="/workflows/blank" signUpUrl="/sign-up" />
    </main>
  );
}
