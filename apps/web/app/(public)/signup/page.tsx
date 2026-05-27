import { redirect } from "next/navigation";

// Signup follows the same flow as sign-in (magic link / OAuth)
export default function SignUpPage() {
  redirect("/signin");
}
