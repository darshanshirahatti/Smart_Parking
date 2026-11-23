import { FormEvent, useState } from "react";
import { LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { verifyAdminAccess } from "@/lib/auth-api";

interface AdminLoginProps {
  defaultEmail: string;
  onAuthorized: () => void;
}

export function AdminLogin({ defaultEmail, onAuthorized }: AdminLoginProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await verifyAdminAccess(email, password);
      setPassword("");
      onAuthorized();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Admin verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
        <ShieldCheck className="h-6 w-6 text-white" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">Admin sign-in</h2>
      <p className="mt-1 text-sm text-slate-500">
        Re-enter the password for an administrator account to open this section.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          Administrator email
          <Input
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@example.com"
          />
        </label>
        <label className="block space-y-1.5 text-sm font-medium text-slate-700">
          Password
          <Input
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Administrator password"
          />
        </label>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LockKeyhole className="mr-2 h-4 w-4" />
          )}
          Verify admin access
        </Button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
