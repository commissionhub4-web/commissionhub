import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Eye, EyeOff, Lock, Mail, User, Clock, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../contexts/AuthContext";
import { apiRequest } from "../lib/api";

function AuthBackground({ reduceMotion }: { reduceMotion: boolean }) {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0" style={{ backgroundImage: "var(--auth-shell-layer-1)" }} />
            <div
                className="absolute inset-0 bg-[size:44px_44px] opacity-[0.12]"
                style={{ backgroundImage: "var(--auth-shell-layer-2)" }}
            />

            <motion.div
                aria-hidden
                className="absolute -top-56 left-1/2 h-[780px] w-[780px] -translate-x-1/2 rounded-full blur-[150px]"
                style={{ backgroundColor: "hsl(var(--auth-shell-orb-1) / 0.15)" }}
                animate={reduceMotion ? undefined : { scale: [1, 1.07, 1], opacity: [0.58, 0.92, 0.58] }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.div
                aria-hidden
                className="absolute -bottom-48 -left-28 h-[420px] w-[420px] rounded-full blur-[125px]"
                style={{ backgroundColor: "hsl(var(--auth-shell-orb-2) / 0.12)" }}
                animate={reduceMotion ? undefined : { x: [0, 30, 0], y: [0, -22, 0] }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
        </div>
    );
}

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgotMode, setIsForgotMode] = useState(false);
    const [pendingMessage, setPendingMessage] = useState("");
    const [shakeForm, setShakeForm] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetCode, setResetCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
    const [resetRequestStatus, setResetRequestStatus] = useState<{ type: "idle" | "success" | "error"; message: string }>({
        type: "idle",
        message: "",
    });
    const navigate = useNavigate();
    const { toast } = useToast();
    const { signup, login, requestPasswordReset, resetPassword } = useAuth();
    const reduceMotion = useReducedMotion();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setPendingMessage("");
        await new Promise((r) => setTimeout(r, 800));

        if (isSignUp) {
            const result = signup(email, password, name);
            setIsLoading(false);
            if (result.success) {
                setPendingMessage(result.message);
                toast({ title: "Account created", description: "Awaiting admin verification." });
            } else {
                setShakeForm(true);
                toast({ title: "Signup failed", description: result.message, variant: "destructive" });
            }
        } else {
            const result = login(email, password);
            setIsLoading(false);
            if (result.success) {
                toast({ title: result.message, description: "Redirecting to dashboard…" });
                navigate("/");
            } else {
                setShakeForm(true);
                if (result.message.includes("pending")) {
                    setPendingMessage(result.message);
                }
                toast({ title: "Login failed", description: result.message, variant: "destructive" });
            }
        }
    };

    const handleResetCodeRequest = async () => {
        if (!resetEmail.trim()) {
            toast({ title: "Email required", description: "Please enter your account email.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        setResetRequestStatus({ type: "idle", message: "" });

        try {
            await new Promise((r) => setTimeout(r, 300));
            const result = requestPasswordReset(resetEmail);
            if (!result.success || !result.code) {
                setShakeForm(true);
                setResetRequestStatus({ type: "error", message: result.message });
                toast({ title: "Request failed", description: result.message, variant: "destructive" });
                return;
            }

            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 15000);
            await apiRequest<{ success: boolean; message: string }>("/auth/send-reset-code", {
                method: "POST",
                body: JSON.stringify({
                    email: resetEmail.trim().toLowerCase(),
                    code: result.code,
                }),
                signal: controller.signal,
            });

            window.clearTimeout(timeoutId);
            setResetRequestStatus({ type: "success", message: "Reset code sent. Please check your Gmail inbox (and spam folder)." });
            toast({ title: "Reset code sent", description: "Check your Gmail inbox for the reset code." });
            return;
        } catch (error) {
            setShakeForm(true);
            const description =
                error instanceof DOMException && error.name === "AbortError"
                    ? "Email request timed out. Please try again."
                    : error instanceof Error
                        ? error.message
                        : "Unable to send reset email.";
            setResetRequestStatus({ type: "error", message: description });
            toast({
                title: "Email send failed",
                description,
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmNewPassword) {
            setShakeForm(true);
            toast({ title: "Password mismatch", description: "New password and confirm password must match.", variant: "destructive" });
            return;
        }

        setIsLoading(true);
        await new Promise((r) => setTimeout(r, 500));
        const result = resetPassword(resetEmail, resetCode, newPassword);
        setIsLoading(false);

        if (result.success) {
            toast({ title: "Password updated", description: "Please sign in with your new password." });
            setIsForgotMode(false);
            setIsSignUp(false);
            setEmail(resetEmail.toLowerCase().trim());
            setPassword("");
            setResetCode("");
            setNewPassword("");
            setConfirmNewPassword("");
            return;
        }

        setShakeForm(true);
        toast({ title: "Reset failed", description: result.message, variant: "destructive" });
    };

    if (pendingMessage) {
        return (
            <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
                <AuthBackground reduceMotion={reduceMotion} />

                <motion.div
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="relative z-10 w-full max-w-md"
                >
                    <Card className="border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl">
                        <CardHeader className="items-center text-center">
                            <motion.div
                                className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15"
                                animate={reduceMotion ? undefined : { boxShadow: ["0 0 0px rgba(245,158,11,0.25)", "0 0 28px rgba(245,158,11,0.35)", "0 0 0px rgba(245,158,11,0.25)"] }}
                                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                            >
                                <Clock className="h-7 w-7 text-amber-400" />
                            </motion.div>
                            <CardTitle className="text-xl font-bold tracking-tight text-foreground">
                                Verification Pending
                            </CardTitle>
                            <CardDescription className="mt-2 leading-relaxed text-muted-foreground">
                                {pendingMessage}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
                                <div className="flex items-center gap-3">
                                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                                    <span className="text-sm text-foreground">Account created successfully</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Clock className="h-4 w-4 shrink-0 text-amber-400" />
                                    <span className="text-sm text-muted-foreground">Waiting for admin approval</span>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    setPendingMessage("");
                                    setIsSignUp(false);
                                    setEmail("");
                                    setPassword("");
                                    setName("");
                                }}
                            >
                                Back to Sign In
                            </Button>
                        </CardFooter>
                    </Card>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
            <AuthBackground reduceMotion={reduceMotion} />

            <motion.div
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 w-full max-w-md"
            >
                <motion.div
                    animate={
                        shakeForm
                            ? { x: [0, -10, 10, -8, 8, -4, 4, 0] }
                            : { x: 0 }
                    }
                    transition={{ duration: 0.45, ease: "easeInOut" }}
                    onAnimationComplete={() => setShakeForm(false)}
                >
                    <Card className="overflow-hidden border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl">
                        <motion.div
                            aria-hidden
                            className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary/70 to-transparent"
                            animate={reduceMotion ? undefined : { opacity: [0.35, 0.95, 0.35] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        />

                        <CardHeader className="items-center text-center">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.94 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.35 }}
                                className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2 shadow-[0_0_34px_rgba(59,130,246,0.18)]"
                            >
                                <img
                                    src="/commissionhub-logo.png"
                                    alt="CommissionHub"
                                    className="h-24 w-auto object-contain sm:h-28 lg:h-32"
                                />
                            </motion.div>

                            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                                {isForgotMode ? "Reset your password" : isSignUp ? "Create account" : "Welcome back"}
                            </CardTitle>
                            <CardDescription className="text-muted-foreground">
                                {isForgotMode
                                    ? "Request a reset code and set a new password"
                                    : isSignUp
                                    ? "Sign up to start managing commissions"
                                    : "Sign in to your CommissionPro account"}
                            </CardDescription>
                        </CardHeader>

                        <form onSubmit={isForgotMode ? handleResetSubmit : handleSubmit}>
                            <CardContent className="space-y-4">
                                {isForgotMode ? (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="reset-email" className="text-foreground">Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    id="reset-email"
                                                    type="email"
                                                    placeholder="you@company.com"
                                                    value={resetEmail}
                                                    onChange={(e) => setResetEmail(e.target.value)}
                                                    required
                                                    className="pl-10"
                                                />
                                            </div>
                                            <Button type="button" variant="outline" className="w-full" onClick={handleResetCodeRequest} disabled={isLoading}>
                                                Send reset code to Gmail
                                            </Button>
                                            {resetRequestStatus.message && (
                                                <p className={`text-xs ${resetRequestStatus.type === "success" ? "text-emerald-400" : "text-destructive"}`}>
                                                    {resetRequestStatus.message}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="reset-code" className="text-foreground">Reset Code</Label>
                                            <Input
                                                id="reset-code"
                                                type="text"
                                                placeholder="Enter 6-digit code"
                                                value={resetCode}
                                                onChange={(e) => setResetCode(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="new-password" className="text-foreground">New Password</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    id="new-password"
                                                    type={showNewPassword ? "text" : "password"}
                                                    placeholder="••••••••"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    required
                                                    minLength={6}
                                                    className="pl-10 pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                    tabIndex={-1}
                                                >
                                                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="confirm-new-password" className="text-foreground">Confirm New Password</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    id="confirm-new-password"
                                                    type={showConfirmNewPassword ? "text" : "password"}
                                                    placeholder="••••••••"
                                                    value={confirmNewPassword}
                                                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                                                    required
                                                    minLength={6}
                                                    className="pl-10 pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                    tabIndex={-1}
                                                >
                                                    {showConfirmNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                                            We send a one-time reset code to your registered Gmail address.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <AnimatePresence initial={false}>
                                            {isSignUp && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0, y: -6 }}
                                                    animate={{ opacity: 1, height: "auto", y: 0 }}
                                                    exit={{ opacity: 0, height: 0, y: -6 }}
                                                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                                    className="space-y-2 overflow-hidden"
                                                >
                                                    <Label htmlFor="name" className="text-foreground">Full Name</Label>
                                                    <div className="relative">
                                                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                        <Input
                                                            id="name"
                                                            type="text"
                                                            placeholder="John Doe"
                                                            value={name}
                                                            onChange={(e) => setName(e.target.value)}
                                                            required
                                                            className="pl-10"
                                                        />
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        <div className="space-y-2">
                                            <Label htmlFor="email" className="text-foreground">Email</Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="you@company.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    required
                                                    className="pl-10"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="password" className="text-foreground">Password</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    id="password"
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="••••••••"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    required
                                                    minLength={6}
                                                    className="pl-10 pr-10"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                                    tabIndex={-1}
                                                >
                                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {!isSignUp && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsForgotMode(true);
                                                    setResetEmail(email);
                                                }}
                                                className="text-xs text-primary transition-colors hover:text-primary/80"
                                            >
                                                Forgot password?
                                            </button>
                                        )}

                                        <AnimatePresence initial={false}>
                                            {isSignUp && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -4 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: -4 }}
                                                    transition={{ duration: 0.22 }}
                                                    className="rounded-lg border border-[hsl(var(--warning)/0.30)] bg-[hsl(var(--warning)/0.08)] p-3"
                                                >
                                                    <p className="text-xs leading-relaxed text-[hsl(var(--warning))]">
                                                        After signing up, your account will need to be verified by an admin before you can log in.
                                                    </p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </>
                                )}
                            </CardContent>

                            <CardFooter className="flex flex-col gap-4">
                                <motion.div
                                    whileHover={{ scale: isLoading ? 1 : 1.01 }}
                                    whileTap={{ scale: isLoading ? 1 : 0.99 }}
                                    className="w-full"
                                >
                                    <Button type="submit" className="w-full" disabled={isLoading}>
                                        <span className="inline-flex items-center gap-2">
                                            {isLoading ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Please wait…
                                                </>
                                            ) : isForgotMode ? (
                                                "Reset password"
                                            ) : isSignUp ? (
                                                <>
                                                    <Sparkles className="h-4 w-4" />
                                                    Create account
                                                </>
                                            ) : (
                                                "Sign in"
                                            )}
                                        </span>
                                    </Button>
                                </motion.div>

                                {isForgotMode ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsForgotMode(false);
                                            setResetCode("");
                                            setNewPassword("");
                                            setConfirmNewPassword("");
                                        }}
                                        className="text-sm font-medium text-primary transition-colors hover:text-primary/80"
                                    >
                                        Back to sign in
                                    </button>
                                ) : (
                                    <>
                                        <p className="text-sm text-muted-foreground">
                                            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsSignUp(!isSignUp);
                                                    setPendingMessage("");
                                                }}
                                                className="font-medium text-primary transition-colors hover:text-primary/80"
                                            >
                                                {isSignUp ? "Sign in" : "Sign up"}
                                            </button>
                                        </p>

                                        {!isSignUp && (
                                            <p className="text-xs text-muted-foreground/60">
                                                Admin: admin@commissionpro.com / admin123
                                            </p>
                                        )}
                                    </>
                                )}
                            </CardFooter>
                        </form>
                    </Card>
                </motion.div>
            </motion.div>
        </div>
    );
}
