import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/router";
import { useEffect } from "react";

// Suppress the harmless Next.js HMR "isrManifest" invalid-message console noise
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
    const _warn = console.warn.bind(console);
    console.warn = (...args: unknown[]) => {
        if (typeof args[0] === "string" && args[0].includes("isrManifest")) return;
        _warn(...args);
    };
}

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/login", "/register", "/invite"];

function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();

    const isPublicRoute = PUBLIC_ROUTES.some((route) =>
        router.pathname.startsWith(route)
    );

    useEffect(() => {
        if (!loading && !user && !isPublicRoute) {
            router.replace("/login");
        }
    }, [loading, user, isPublicRoute, router]);

    // Show nothing while checking auth (avoids flash)
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="animate-pulse text-muted-foreground text-sm">
                    Loading…
                </div>
            </div>
        );
    }

    // If not authenticated and not on a public route, show nothing (redirect will happen)
    if (!user && !isPublicRoute) {
        return null;
    }

    return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <TooltipProvider delayDuration={300}>
                <AuthProvider>
                    <AuthGuard>
                        <Component {...pageProps} />
                    </AuthGuard>
                </AuthProvider>
            </TooltipProvider>
        </ThemeProvider>
    );
}
