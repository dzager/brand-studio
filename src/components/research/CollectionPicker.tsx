/**
 * CollectionPicker — Popover for selecting or creating a snippet collection
 *
 * Used by ResearchDetail and HighlightableText to save snippets.
 * Fetches collections for the current company, shows inline create.
 */
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Bookmark, Plus, Check, Loader2, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SnippetPayload {
    text: string;
    note?: string;
    source_url?: string;
    source_title?: string;
    research_project_id?: string;
    color?: string;
}

interface CollectionSummary {
    id: string;
    name: string;
    snippet_count: number;
}

interface CollectionPickerProps {
    companyId: string;
    snippet: SnippetPayload;
    /** Compact mode shows just an icon button */
    compact?: boolean;
    className?: string;
    onSaved?: (collectionId: string, collectionName: string) => void;
}

export default function CollectionPicker({
    companyId,
    snippet,
    compact = false,
    className,
    onSaved,
}: CollectionPickerProps) {
    const [open, setOpen] = useState(false);
    const [collections, setCollections] = useState<CollectionSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);

    // Create new collection
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    // Fetch collections when popover opens
    const fetchCollections = useCallback(async () => {
        if (!companyId) return;
        setLoading(true);
        try {
            const r = await fetch(`/api/snippet-collections?company_id=${companyId}`);
            const data = await r.json();
            if (Array.isArray(data)) setCollections(data);
        } catch { /* Non-blocking */ }
        finally { setLoading(false); }
    }, [companyId]);

    useEffect(() => {
        if (open) {
            fetchCollections();
            setSaved(null);
        }
    }, [open, fetchCollections]);

    // Add snippet to a collection
    async function addToCollection(collectionId: string) {
        setSaving(collectionId);
        try {
            const r = await fetch(`/api/snippet-collections/${collectionId}/add-snippet`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(snippet),
            });
            if (!r.ok) throw new Error("Failed to save");
            setSaved(collectionId);
            const collName = collections.find(c => c.id === collectionId)?.name ?? "";
            onSaved?.(collectionId, collName);
            // Update local count
            setCollections(prev =>
                prev.map(c => c.id === collectionId ? { ...c, snippet_count: c.snippet_count + 1 } : c)
            );
            // Auto-close after a brief delay
            setTimeout(() => setOpen(false), 600);
        } catch { /* Non-blocking */ }
        finally { setSaving(null); }
    }

    // Create a new collection and add the snippet to it
    async function createAndAdd() {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const createResp = await fetch("/api/snippet-collections", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim(), company_id: companyId }),
            });
            const created = await createResp.json();
            if (!createResp.ok) throw new Error(created.error || "Create failed");

            // Add the snippet to the new collection
            await fetch(`/api/snippet-collections/${created.id}/add-snippet`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(snippet),
            });

            setSaved(created.id);
            setShowCreate(false);
            setNewName("");
            onSaved?.(created.id, created.name);
            fetchCollections();
            setTimeout(() => setOpen(false), 600);
        } catch { /* Non-blocking */ }
        finally { setCreating(false); }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                {compact ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-6 w-6 p-0 text-muted-foreground hover:text-primary",
                            className
                        )}
                        title="Save to collection"
                    >
                        <Bookmark className="h-3 w-3" />
                    </Button>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                            "h-7 text-[10px] gap-1 text-primary hover:text-primary",
                            className
                        )}
                    >
                        <Bookmark className="h-3 w-3" />
                        Save
                    </Button>
                )}
            </PopoverTrigger>
            <PopoverContent
                className="w-64 p-2"
                align="start"
                side="bottom"
                sideOffset={4}
            >
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                        Save to collection
                    </p>

                    {loading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : collections.length === 0 && !showCreate ? (
                        <div className="text-center py-3">
                            <FolderOpen className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground/40" />
                            <p className="text-xs text-muted-foreground mb-2">No collections yet</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={() => setShowCreate(true)}
                            >
                                <Plus className="h-3 w-3" />
                                Create first collection
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Existing collections */}
                            <div className="max-h-48 overflow-y-auto space-y-0.5">
                                {collections.map((c) => {
                                    const isSaving = saving === c.id;
                                    const isSaved = saved === c.id;
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => addToCollection(c.id)}
                                            disabled={!!saving || isSaved}
                                            className={cn(
                                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors text-sm",
                                                isSaved
                                                    ? "bg-green-500/10 text-green-600"
                                                    : "hover:bg-muted/60"
                                            )}
                                        >
                                            {isSaved ? (
                                                <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                                            ) : isSaving ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                            ) : (
                                                <Bookmark className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            )}
                                            <span className="flex-1 truncate">{c.name}</span>
                                            <Badge
                                                variant="outline"
                                                className="text-[9px] px-1 py-0 shrink-0"
                                            >
                                                {c.snippet_count}
                                            </Badge>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Divider + Create new */}
                            {!showCreate ? (
                                <button
                                    onClick={() => setShowCreate(true)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors border-t border-border/50 mt-1 pt-1.5"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>New collection</span>
                                </button>
                            ) : (
                                <div className="border-t border-border/50 mt-1 pt-1.5 space-y-1.5 px-1">
                                    <Input
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="Collection name…"
                                        className="h-7 text-xs"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") createAndAdd();
                                            if (e.key === "Escape") { setShowCreate(false); setNewName(""); }
                                        }}
                                        autoFocus
                                        disabled={creating}
                                    />
                                    <div className="flex gap-1 justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 text-xs px-2"
                                            onClick={() => { setShowCreate(false); setNewName(""); }}
                                            disabled={creating}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-6 text-xs px-2 gap-1"
                                            onClick={createAndAdd}
                                            disabled={creating || !newName.trim()}
                                        >
                                            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                            Create & Save
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
