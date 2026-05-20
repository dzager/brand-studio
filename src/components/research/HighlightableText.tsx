/**
 * HighlightableText — Renders source text with selectable highlighting
 *
 * Features:
 * - Detects text selection via window.getSelection()
 * - Shows floating toolbar with "Highlight" + color options
 * - Renders existing highlights with colored backgrounds
 * - Supports adding notes to highlights
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Highlighter, X, MessageSquare, Trash2, Bookmark } from "lucide-react";
import CollectionPicker from "./CollectionPicker";
import { cn } from "@/lib/utils";

export interface Highlight {
    text: string;
    note?: string;
    color: string;
    startOffset?: number;
}

interface HighlightableTextProps {
    content: string;
    highlights: Highlight[];
    onHighlightsChange: (highlights: Highlight[]) => void;
    className?: string;
    /** For CollectionPicker — save highlights to a snippet collection */
    companyId?: string;
    projectId?: string;
    sourceUrl?: string;
    sourceTitle?: string;
}

const HIGHLIGHT_COLORS = [
    { id: "yellow", bg: "bg-yellow-200/60 dark:bg-yellow-500/20", border: "border-yellow-400", label: "Yellow" },
    { id: "green", bg: "bg-green-200/60 dark:bg-green-500/20", border: "border-green-400", label: "Green" },
    { id: "blue", bg: "bg-blue-200/60 dark:bg-blue-500/20", border: "border-blue-400", label: "Blue" },
    { id: "pink", bg: "bg-pink-200/60 dark:bg-pink-500/20", border: "border-pink-400", label: "Pink" },
    { id: "purple", bg: "bg-purple-200/60 dark:bg-purple-500/20", border: "border-purple-400", label: "Purple" },
];

function getColorClasses(colorId: string) {
    return HIGHLIGHT_COLORS.find(c => c.id === colorId) ?? HIGHLIGHT_COLORS[0];
}

export default function HighlightableText({
    content,
    highlights,
    onHighlightsChange,
    className,
    companyId,
    projectId,
    sourceUrl,
    sourceTitle,
}: HighlightableTextProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [toolbar, setToolbar] = useState<{ x: number; y: number; text: string } | null>(null);
    const [selectedColor, setSelectedColor] = useState("yellow");
    const [editingNote, setEditingNote] = useState<number | null>(null);
    const [noteText, setNoteText] = useState("");

    // Handle text selection
    const handleMouseUp = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !containerRef.current) {
            // Delay hiding toolbar to allow clicking toolbar buttons
            setTimeout(() => {
                const sel = window.getSelection();
                if (!sel || sel.isCollapsed) setToolbar(null);
            }, 200);
            return;
        }

        const range = selection.getRangeAt(0);
        if (!containerRef.current.contains(range.commonAncestorContainer)) {
            return;
        }

        const selectedText = selection.toString().trim();
        if (selectedText.length < 5) return;

        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();

        setToolbar({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top - 8,
            text: selectedText,
        });
    }, []);

    // Add a highlight
    const addHighlight = useCallback(() => {
        if (!toolbar) return;
        const newHighlight: Highlight = {
            text: toolbar.text,
            color: selectedColor,
        };
        onHighlightsChange([...highlights, newHighlight]);
        setToolbar(null);
        window.getSelection()?.removeAllRanges();
    }, [toolbar, selectedColor, highlights, onHighlightsChange]);

    // Remove a highlight
    const removeHighlight = useCallback((index: number) => {
        const next = highlights.filter((_, i) => i !== index);
        onHighlightsChange(next);
        setEditingNote(null);
    }, [highlights, onHighlightsChange]);

    // Save note on a highlight
    const saveNote = useCallback((index: number) => {
        const next = highlights.map((h, i) =>
            i === index ? { ...h, note: noteText.trim() || undefined } : h
        );
        onHighlightsChange(next);
        setEditingNote(null);
        setNoteText("");
    }, [highlights, noteText, onHighlightsChange]);

    // Render text with inline highlights
    const renderContent = useCallback(() => {
        if (highlights.length === 0) {
            return content.split("\n").map((line, i) => (
                <span key={i}>
                    {line}
                    {i < content.split("\n").length - 1 && <br />}
                </span>
            ));
        }

        // Simple approach: render full text and mark highlighted segments
        let remaining = content;
        const parts: { text: string; highlight?: Highlight; highlightIndex?: number }[] = [];

        // Sort highlights by position in text (first occurrence)
        const sortedHighlights = highlights
            .map((h, i) => ({ ...h, originalIndex: i, pos: content.indexOf(h.text) }))
            .filter(h => h.pos >= 0)
            .sort((a, b) => a.pos - b.pos);

        let lastEnd = 0;
        for (const sh of sortedHighlights) {
            if (sh.pos < lastEnd) continue; // skip overlapping
            if (sh.pos > lastEnd) {
                parts.push({ text: content.slice(lastEnd, sh.pos) });
            }
            parts.push({ text: sh.text, highlight: sh, highlightIndex: sh.originalIndex });
            lastEnd = sh.pos + sh.text.length;
        }
        if (lastEnd < content.length) {
            parts.push({ text: content.slice(lastEnd) });
        }

        // Also collect highlights not found in text (for display below)
        const unfoundHighlights = highlights
            .map((h, i) => ({ ...h, originalIndex: i }))
            .filter(h => content.indexOf(h.text) < 0);

        return (
            <>
                {parts.map((part, i) => {
                    if (part.highlight) {
                        const colorClasses = getColorClasses(part.highlight.color);
                        return (
                            <mark
                                key={i}
                                className={cn(
                                    colorClasses.bg,
                                    "rounded px-0.5 cursor-pointer transition-all hover:ring-2 hover:ring-primary/30",
                                    "border-b-2",
                                    colorClasses.border
                                )}
                                title={part.highlight.note || "Click to add a note"}
                                onClick={() => {
                                    if (editingNote === part.highlightIndex) {
                                        setEditingNote(null);
                                    } else {
                                        setEditingNote(part.highlightIndex!);
                                        setNoteText(part.highlight!.note || "");
                                    }
                                }}
                            >
                                {part.text.split("\n").map((line, j) => (
                                    <span key={j}>
                                        {line}
                                        {j < part.text.split("\n").length - 1 && <br />}
                                    </span>
                                ))}
                            </mark>
                        );
                    }
                    return part.text.split("\n").map((line, j) => (
                        <span key={`${i}-${j}`}>
                            {line}
                            {j < part.text.split("\n").length - 1 && <br />}
                        </span>
                    ));
                })}
            </>
        );
    }, [content, highlights, editingNote]);

    return (
        <div className={cn("relative", className)}>
            {/* Text Content */}
            <div
                ref={containerRef}
                onMouseUp={handleMouseUp}
                className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 select-text cursor-text"
            >
                {renderContent()}
            </div>

            {/* Floating Highlight Toolbar */}
            {toolbar && (
                <div
                    className="absolute z-50 flex items-center gap-1 px-2 py-1.5 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95"
                    style={{
                        left: `${Math.max(0, toolbar.x - 100)}px`,
                        top: `${toolbar.y - 44}px`,
                    }}
                >
                    {HIGHLIGHT_COLORS.map(color => (
                        <button
                            key={color.id}
                            onClick={() => setSelectedColor(color.id)}
                            className={cn(
                                "w-5 h-5 rounded-full border-2 transition-transform",
                                color.bg,
                                color.border,
                                selectedColor === color.id && "scale-125 ring-2 ring-primary/50"
                            )}
                            title={color.label}
                        />
                    ))}
                    <div className="w-px h-5 bg-border mx-1" />
                    <Button size="sm" variant="default" className="h-7 px-2 text-xs gap-1" onClick={addHighlight}>
                        <Highlighter className="h-3 w-3" />
                        Highlight
                    </Button>
                    {companyId && (
                        <CollectionPicker
                            companyId={companyId}
                            snippet={{
                                text: toolbar.text,
                                source_url: sourceUrl,
                                source_title: sourceTitle,
                                research_project_id: projectId,
                                color: selectedColor,
                            }}
                            compact={false}
                        />
                    )}
                </div>
            )}

            {/* Note Editor (inline, below highlighted text) */}
            {editingNote !== null && highlights[editingNote] && (
                <div className="mt-2 p-2 rounded-md border border-border bg-muted/50 space-y-1.5 animate-in fade-in-0 slide-in-from-top-1">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">
                            Note on highlight
                        </span>
                        <div className="flex-1" />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={() => removeHighlight(editingNote)}
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => setEditingNote(null)}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="flex gap-1.5">
                        <Input
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Add a note..."
                            className="h-7 text-xs"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") saveNote(editingNote);
                            }}
                            autoFocus
                        />
                        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => saveNote(editingNote)}>
                            Save
                        </Button>
                        {companyId && (
                            <CollectionPicker
                                companyId={companyId}
                                snippet={{
                                    text: highlights[editingNote].text,
                                    note: highlights[editingNote].note,
                                    source_url: sourceUrl,
                                    source_title: sourceTitle,
                                    research_project_id: projectId,
                                    color: highlights[editingNote].color,
                                }}
                                compact={false}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Highlight Summary Bar */}
            {highlights.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Highlighter className="h-3 w-3" />
                    <span>{highlights.length} highlight{highlights.length !== 1 ? "s" : ""}</span>
                    {highlights.some(h => h.note) && (
                        <span>· {highlights.filter(h => h.note).length} with notes</span>
                    )}
                </div>
            )}
        </div>
    );
}
