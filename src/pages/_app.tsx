import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import GateModal from "@/components/layout/GateModal";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider delayDuration={300}>
        <GateModal>
          <Component {...pageProps} />
        </GateModal>
      </TooltipProvider>
    </ThemeProvider>
  );
}
