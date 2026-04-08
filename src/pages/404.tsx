import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function Custom404() {
  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileQuestion className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">Page Not Found</h2>
            <p className="text-muted-foreground">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <Button asChild className="mt-2">
              <Link href="/">Back to Studio</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
