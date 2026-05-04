import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Root index page — redirects to the Studio.
 * All other internal links (404, 500, articles) point to "/" expecting
 * the Studio experience, so we keep this as a thin client-side redirect.
 */
export default function IndexRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/studio");
    }, [router]);

    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="animate-pulse text-muted-foreground text-sm">
                Loading…
            </div>
        </div>
    );
}
