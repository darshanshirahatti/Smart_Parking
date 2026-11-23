import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Car, KeyRound, LoaderCircle, Mail, Phone } from "lucide-react";
import {
  AuthUser,
  getCurrentUser,
  loginWithEmail,
  normalizeIndianPhoneNumber,
  logout,
  registerWithEmail,
  requestPhoneCode,
  verifyPhoneCode,
} from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AuthGateProps {
  children: (user: AuthUser, signOut: () => Promise<void>) => ReactNode;
}

type SignInMethod = "email" | "phone";

export function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<SignInMethod>("email");
  const [registering, setRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const signedInUser = registering
        ? await registerWithEmail(email, password)
        : await loginWithEmail(email, password);
      setUser(signedInUser);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleRequestCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const normalizedPhone = normalizeIndianPhoneNumber(phone);
      setPhone(normalizedPhone);
      const result = await requestPhoneCode(normalizedPhone);
      setCodeSent(true);
      setNotice(result.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not send verification code.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setUser(await verifyPhoneCode(phone.trim(), code.trim()));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Phone verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    setError("");
    try {
      await logout();
      setUser(null);
      setCodeSent(false);
      setCode("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not sign out.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        Checking sign-in…
      </div>
    );
  }

  if (user) return <>{children(user, signOut)}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500">
            <Car className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">SmartPark</h1>
            <p className="text-sm text-slate-500">Sign in to continue</p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setMethod("email");
              setError("");
              setNotice("");
            }}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
              method === "email" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <Mail className="h-4 w-4" />
            Email
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod("phone");
              setError("");
              setNotice("");
            }}
            className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
              method === "phone" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            <Phone className="h-4 w-4" />
            Mobile OTP
          </button>
        </div>

        {method === "email" ? (
          <>
            <h2 className="mb-4 text-lg font-semibold text-slate-800">
              {registering ? "Create your account" : "Welcome back"}
            </h2>
            <form className="space-y-4" onSubmit={handleEmailSubmit}>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Email address
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                Password
                <Input
                  type="password"
                  autoComplete={registering ? "new-password" : "current-password"}
                  required
                  minLength={registering ? 10 : 1}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={registering ? "At least 10 characters" : "Your password"}
                />
              </label>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {registering ? "Create account" : "Sign in"}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-slate-600">
              {registering ? "Already have an account?" : "New to SmartPark?"}{" "}
              <button
                type="button"
                className="font-semibold text-emerald-700 hover:underline"
                onClick={() => {
                  setRegistering(!registering);
                  setError("");
                  setNotice("");
                }}
              >
                {registering ? "Sign in" : "Create account"}
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className="mb-1 text-lg font-semibold text-slate-800">Sign in with your phone</h2>
            <p className="mb-4 text-sm text-slate-500">
              Enter your 10-digit Indian mobile number. We’ll add +91 automatically.
            </p>
            {!codeSent ? (
              <form className="space-y-4" onSubmit={handleRequestCode}>
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  Mobile number
                  <Input
                    type="tel"
                    autoComplete="tel"
                    required
                    maxLength={20}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="9876543210"
                  />
                </label>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                  Send verification code
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleVerifyCode}>
                <p className="text-sm text-slate-600">Enter the code sent to {phone}.</p>
                <label className="block space-y-1.5 text-sm font-medium text-slate-700">
                  Verification code
                  <Input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    required
                    pattern="[0-9]{4,10}"
                    maxLength={10}
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Enter SMS code"
                  />
                </label>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                  Verify and sign in
                </Button>
                <button
                  type="button"
                  className="w-full text-sm font-medium text-emerald-700 hover:underline"
                  onClick={() => {
                    setCodeSent(false);
                    setCode("");
                    setError("");
                    setNotice("");
                  }}
                >
                  Change phone number
                </button>
              </form>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </p>
        )}
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <KeyRound className="h-3.5 w-3.5" />
          Your reservations are shared with signed-in users.
        </p>
      </section>
    </main>
  );
}
