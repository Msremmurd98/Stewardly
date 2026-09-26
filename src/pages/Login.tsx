import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      navigate(location.state?.from ?? "/dashboard", { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-background px-6 pt-safe pb-safe">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-3xl font-extrabold text-foreground">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Log In To Stewardly To Continue.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            required
            icon={<Mail className="h-4 w-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            icon={<Lock className="h-4 w-4" />}
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="text-muted"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Logging in..." : "Log In"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-foreground underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
