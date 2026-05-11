// AIMemeModal — Shows rotating fun facts & industry trends while waiting for Organic operations
// Designed to keep users entertained during long-running model calls

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { matchFactsForCompany, shuffleArray } from "@/lib/funFacts";

const ROTATION_INTERVAL = 6000; // 6 seconds per fact

type AIMemeModalProps = {
    open: boolean;
    onClose: () => void;
    companyName?: string;
};

export default function AIMemeModal({ open, onClose, companyName }: AIMemeModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    // Build a shuffled set of facts for this company
    const facts = useMemo(() => {
        const matched = matchFactsForCompany(companyName || "");
        return shuffleArray(matched).slice(0, 8);
    }, [companyName]);

    // Reset index when modal opens
    useEffect(() => {
        if (open) setCurrentIndex(0);
    }, [open]);

    // Auto-rotate facts
    useEffect(() => {
        if (!open || facts.length === 0) return;
        const timer = setInterval(() => {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % facts.length);
                setIsAnimating(false);
            }, 300);
        }, ROTATION_INTERVAL);
        return () => clearInterval(timer);
    }, [open, facts.length]);

    const fact = facts[currentIndex];
    if (!fact) return null;

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
            <DialogContent
                showCloseButton={false}
                className="sm:max-w-lg p-0 overflow-hidden border-0 bg-transparent ring-0 shadow-none"
            >
                <div className="relative rounded-xl overflow-hidden bg-white dark:bg-zinc-950 shadow-2xl">
                    {/* Close */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="absolute top-3 right-3 z-20 h-7 w-7 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </Button>

                    <div className="px-10 pt-10 pb-16">
                        {/* Organic logo + status */}
                        <div className="flex items-center gap-2.5 mb-10">
                            <img
                                src="/organic-logo.svg"
                                alt="Organic"
                                className="h-4 w-auto dark:invert opacity-50"
                            />
                            <span className="text-xs text-zinc-400 dark:text-zinc-500">is working on it</span>
                        </div>

                        {/* Fact content */}
                        <div
                            key={currentIndex}
                            className={cn(
                                "transition-all duration-300",
                                isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
                            )}
                        >
                            <p className="text-[10px] uppercase tracking-widest font-medium text-zinc-400 dark:text-zinc-500 mb-4">
                                Did you know
                            </p>
                            <h3 className="text-2xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-100 mb-4">
                                {fact.headline}
                            </h3>
                            <p className="text-base leading-relaxed text-zinc-500 dark:text-zinc-400">
                                {fact.body}
                            </p>
                        </div>
                    </div>

                    {/* Minimal loading bar */}
                    <div className="h-1 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full bg-zinc-300 dark:bg-zinc-600 animate-pulse" style={{ width: "100%" }} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
