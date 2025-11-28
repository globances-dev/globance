import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useToast } from "../hooks/use-toast";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${window.location.origin}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error("Failed to send reset link");
      }

      setSubmitted(true);
      toast({
        title: "Success!",
        description: "Password reset link sent to your email",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to send reset link",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
            {/* Back Button */}
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
                <h1 className="text-3xl font-bold mb-2">Check Your Email</h1>
                <p className="text-muted-foreground mb-6">
                  We've sent a password reset link to {email}. Click the link to
                  create a new password.
                </p>

                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-6">
                  <p className="text-sm text-green-600">
                    ✓ Reset link sent successfully. The link will expire in 1 hour.
                  </p>
                </div>

                <button
                  onClick={() => navigate("/login")}
                  className="w-full px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Back to Login
                </button>
              </>
            ) : (
              <>
                {/* Form State */}
                <h1 className="text-3xl font-bold mb-2">Forgot Password?</h1>
                <p className="text-muted-foreground mb-8">
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors"
                      placeholder="you@example.com"
                    />
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full px-4 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-card text-muted-foreground">
                      Remember your password?
                    </span>
                  </div>
                </div>

                {/* Login Link */}
                <Link
                  to="/login"
                  className="w-full px-4 py-3 border border-primary text-primary font-semibold rounded-lg hover:bg-primary/10 transition-colors text-center block"
                >
                  Back to Login
                </Link>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
