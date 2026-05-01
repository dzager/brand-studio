// AIMemeModal — Shows rotating funny AI memes while waiting for AI operations
// Designed to keep users entertained during long-running model calls

import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Meme = {
    src: string;
    caption: string;
};

const AI_MEMES: Meme[] = [
    {
        src: "/memes/ai-thinking.png",
        caption: "Your AI right now — thinking so hard it needs a coffee break ☕",
    },
    {
        src: "/memes/ai-cooking.png",
        caption: "Chef AI is cooking up your content — needs a big pot for all this flavor 🍳",
    },
    {
        src: "/memes/ai-painting.png",
        caption: "The masterpiece is almost ready… the robot just needs more paint 🎨",
    },
    {
        src: "/memes/ai-lifting.png",
        caption: "Loading 10 billion parameters — do you even lift, bro? 🏋️",
    },
    {
        src: "/memes/ai-meditation.png",
        caption: "Finding inner peace at 42% complete… Zen-Unit is vibing 🧘",
    },
    {
        src: "/memes/ai-hamster.png",
        caption: "Actual footage of our servers right now 🐹⚡",
    },
];

const ROTATION_INTERVAL = 5000; // 5 seconds per meme

type AIMemeModalProps = {
    open: boolean;
    onClose: () => void;
};

export default function AIMemeModal({ open, onClose }: AIMemeModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState<"left" | "right">("right");
    const [isAnimating, setIsAnimating] = useState(false);

    // Randomize starting meme when modal opens
    useEffect(() => {
        if (open) {
            setCurrentIndex(Math.floor(Math.random() * AI_MEMES.length));
        }
    }, [open]);

    // Auto-rotate memes
    useEffect(() => {
        if (!open) return;
        const timer = setInterval(() => {
            setDirection("right");
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentIndex((prev) => (prev + 1) % AI_MEMES.length);
                setIsAnimating(false);
            }, 300);
        }, ROTATION_INTERVAL);
        return () => clearInterval(timer);
    }, [open]);

    const goTo = useCallback((dir: "left" | "right") => {
        if (isAnimating) return;
        setDirection(dir);
        setIsAnimating(true);
        setTimeout(() => {
            setCurrentIndex((prev) => {
                if (dir === "right") return (prev + 1) % AI_MEMES.length;
                return prev === 0 ? AI_MEMES.length - 1 : prev - 1;
            });
            setIsAnimating(false);
        }, 300);
    }, [isAnimating]);

    const meme = AI_MEMES[currentIndex];

    return (
        <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
            <DialogContent
                showCloseButton={false}
                className="sm:max-w-md p-0 overflow-hidden border-0 bg-transparent ring-0 shadow-none"
            >
                <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-2xl">
                    {/* Close button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="absolute top-2 right-2 z-20 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background border border-border/50 shadow-md"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </Button>

                    {/* Header */}
                    <div className="px-4 pt-4 pb-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-lg">🤖</span>
                            <h3 className="text-sm font-semibold tracking-tight">AI is hard at work…</h3>
                            <span className="text-lg">✨</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Enjoy some robot humor while you wait</p>
                    </div>

                    {/* Meme image area */}
                    <div className="relative px-4">
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                            <img
                                key={currentIndex}
                                src={meme.src}
                                alt={meme.caption}
                                className={cn(
                                    "w-full h-full object-contain transition-all duration-300",
                                    isAnimating
                                        ? direction === "right"
                                            ? "opacity-0 translate-x-4"
                                            : "opacity-0 -translate-x-4"
                                        : "opacity-100 translate-x-0"
                                )}
                            />

                            {/* Navigation arrows */}
                            <button
                                onClick={() => goTo("left")}
                                className="absolute left-1.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm hover:bg-background/90 border border-border/50 shadow-md transition-all opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
                                style={{ opacity: 0.6 }}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => goTo("right")}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm hover:bg-background/90 border border-border/50 shadow-md transition-all opacity-0 hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
                                style={{ opacity: 0.6 }}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Caption + dots */}
                    <div className="px-4 pt-3 pb-4 space-y-2.5">
                        <p className="text-sm text-center text-muted-foreground font-medium leading-snug min-h-[40px] flex items-center justify-center">
                            {meme.caption}
                        </p>

                        {/* Dot indicators */}
                        <div className="flex items-center justify-center gap-1.5">
                            {AI_MEMES.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        if (i === currentIndex || isAnimating) return;
                                        setDirection(i > currentIndex ? "right" : "left");
                                        setIsAnimating(true);
                                        setTimeout(() => { setCurrentIndex(i); setIsAnimating(false); }, 300);
                                    }}
                                    className={cn(
                                        "h-1.5 rounded-full transition-all duration-300",
                                        i === currentIndex
                                            ? "w-4 bg-primary"
                                            : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                                    )}
                                />
                            ))}
                        </div>

                        {/* Loading indicator */}
                        <div className="flex items-center justify-center gap-2 pt-1">
                            <div className="flex gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                            <span className="text-[11px] text-muted-foreground">Processing your request</span>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
