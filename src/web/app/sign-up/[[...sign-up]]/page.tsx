import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center dot-grid">
      <SignUp forceRedirectUrl="/workflows/blank" signInUrl="/sign-in" />
    </main>
  );
}
