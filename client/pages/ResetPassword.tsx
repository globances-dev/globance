import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useToast } from "../hooks/use-toast";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!token) {
      setError("Invalid reset link");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${window.location.origin}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      setSubmitted(true);
      toast({
        title: "Success!",
        description: "Password has been reset successfully",
      });

      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
      toast({
        title: "Error",
        description: err.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <header className="border-b border-border bg-card/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <img 
                src="/globance-icon.svg" 
                alt="Globance" 
                className="h-8 w-8 object-contain group-hover:opacity-80 transition-opacity"
              />
              <span className="font-bold text-lg text-foreground">
                Globance
              </span>
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md">
            <div className="card-gradient border border-border rounded-lg p-8 text-center">
              <h1 className="text-3xl font-bold mb-2">Invalid Link</h1>
              <p className="text-muted-foreground mb-6">
                The password reset link is invalid or has expired.
              </p>
              <Link
                to="/login"
                className="w-full px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-center block"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <Link to="/" className="flex items-center gap-2 group">
            <img 
              src="/globance-icon.svg" 
              alt="Globance" 
              className="h-8 w-8 object-contain group-hover:opacity-80 transition-opacity"
            />
            <span className="font-bold text-lg text-foreground">
              Globance
            </span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="card-gradient border border-border rounded-lg p-8">
            <Link
              to="/login"
              className="flex items-center gap-2 text-primary hover:text-primary/90 mb-6 text-sm font-medium"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>

            {submitted ? (
              <>
                {/* Success State */}
                <h1 className="text-3xl font-bold mb-2">Password Reset</h1>
                <p className="text-muted-foreground mb-6">
                  Your password has been successfully reset. Redirecting to login...
                </p>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-sm text-green-600">
                    ✓ Password updated successfully. You can now log in with your new password.
                  </p>
                </div>
              </>
            ) : (
              <>
                {/* Form State */}
                <h1 className="text-3xl font-bold mb-2">Create New Password</h1>
                <p className="text-muted-foreground mb-8">
                  Enter a new password for your account.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Error */}
                  {error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                      {error}
                    </div>
                  )}

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label htmlFor="confirm" className="block text-sm font-medium mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirm"
                        type={showConfirm ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
