// ArticleEditor.tsx — Tiptap-powered rich text editor for article content
// Supports Visual (WYSIWYG), HTML source, and Markdown view/edit modes

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import TurndownService from "turndown";
import { marked } from "marked";
import { useState, useCallback, useEffect, useImperativeHandle, forwardRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
    Bold, Italic, Heading2, Heading3, Pilcrow, Link2, List,
    ListOrdered, ImageIcon, Eye, Code, Undo2, Redo2, Quote,
    Minus, Type, FileText,
} from "lucide-react";

export type ArticleEditorHandle = {
    /** Get the current HTML content */
    getHTML: () => string;
    /** Replace the editor content with new HTML */
    setContent: (html: string) => void;
    /** Insert an image at the current cursor position (or end if no cursor) */
    insertImage: (src: string, alt?: string) => void;
    /** Get the Tiptap editor instance */
    getEditor: () => ReturnType<typeof useEditor> | null;
};

type Props = {
    initialContent: string;
    /** Called whenever the editor content changes (debounced would be caller's responsibility) */
    onChange?: (html: string) => void;
    /** Triggered when the user clicks the image button in the toolbar */
    onImageButtonClick?: () => void;
    className?: string;
};

const ArticleEditor = forwardRef<ArticleEditorHandle, Props>(
    ({ initialContent, onChange, onImageButtonClick, className }, ref) => {
        const [viewMode, setViewMode] = useState<"visual" | "html" | "markdown">("visual");
        const [htmlSource, setHtmlSource] = useState(initialContent);
        const [markdownSource, setMarkdownSource] = useState("");

        // HTML → Markdown converter (memoized to avoid re-creating on every render)
        const turndown = useMemo(() => {
            const td = new TurndownService({
                headingStyle: "atx",
                hr: "---",
                bulletListMarker: "-",
                codeBlockStyle: "fenced",
                emDelimiter: "*",
                strongDelimiter: "**",
            });
            // Preserve image alt text and src
            td.addRule("image", {
                filter: "img",
                replacement: (_content, node) => {
                    const el = node as HTMLImageElement;
                    const alt = el.getAttribute("alt") || "";
                    const src = el.getAttribute("src") || "";
                    return `![${alt}](${src})`;
                },
            });
            return td;
        }, []);

        /** Convert HTML string to Markdown */
        const htmlToMarkdown = useCallback((html: string) => {
            return turndown.turndown(html);
        }, [turndown]);

        /** Convert Markdown string to HTML */
        const markdownToHtml = useCallback((md: string) => {
            return marked.parse(md, { async: false }) as string;
        }, []);

        const editor = useEditor({
            immediatelyRender: false,
            extensions: [
                StarterKit.configure({
                    heading: { levels: [2, 3, 4] },
                    undoRedo: { depth: 100 },
                }),
                Image.configure({
                    inline: false,
                    allowBase64: true,
                    HTMLAttributes: {
                        class: "rounded-lg max-w-full h-auto",
                        loading: "lazy",
                    },
                }),
                Link.configure({
                    openOnClick: false,
                    HTMLAttributes: {
                        class: "text-primary underline underline-offset-2",
                        rel: "noopener noreferrer nofollow",
                    },
                }),
                Placeholder.configure({
                    placeholder: "Start writing your article…",
                }),
                CharacterCount,
            ],
            content: initialContent,
            editorProps: {
                attributes: {
                    class: "outline-none min-h-[250px] max-h-[500px] overflow-y-auto p-3 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none",
                },
            },
            onUpdate: ({ editor: ed }) => {
                const html = ed.getHTML();
                setHtmlSource(html);
                onChange?.(html);
            },
        });

        // Expose imperative API to parent
        useImperativeHandle(ref, () => ({
            getHTML: () => {
                if (viewMode === "html") return htmlSource;
                if (viewMode === "markdown") return markdownToHtml(markdownSource);
                return editor?.getHTML() ?? htmlSource;
            },
            setContent: (html: string) => {
                setHtmlSource(html);
                editor?.commands.setContent(html);
                // If currently viewing markdown, also update the markdown source
                if (viewMode === "markdown") {
                    setMarkdownSource(htmlToMarkdown(html));
                }
            },
            insertImage: (src: string, alt?: string) => {
                if (editor) {
                    editor.chain().focus().setImage({ src, alt: alt ?? "" }).run();
                }
            },
            getEditor: () => editor,
        }), [editor, htmlSource, viewMode, markdownSource, htmlToMarkdown, markdownToHtml]);

        // Sync when switching modes
        const switchToVisual = useCallback(() => {
            if (viewMode === "html" && editor) {
                editor.commands.setContent(htmlSource);
            } else if (viewMode === "markdown" && editor) {
                const converted = markdownToHtml(markdownSource);
                setHtmlSource(converted);
                editor.commands.setContent(converted);
            }
            setViewMode("visual");
        }, [viewMode, editor, htmlSource, markdownSource, markdownToHtml]);

        const switchToHtml = useCallback(() => {
            if (viewMode === "visual" && editor) {
                setHtmlSource(editor.getHTML());
            } else if (viewMode === "markdown") {
                const converted = markdownToHtml(markdownSource);
                setHtmlSource(converted);
            }
            setViewMode("html");
        }, [viewMode, editor, markdownSource, markdownToHtml]);

        const switchToMarkdown = useCallback(() => {
            if (viewMode === "visual" && editor) {
                const html = editor.getHTML();
                setHtmlSource(html);
                setMarkdownSource(htmlToMarkdown(html));
            } else if (viewMode === "html") {
                setMarkdownSource(htmlToMarkdown(htmlSource));
            }
            setViewMode("markdown");
        }, [viewMode, editor, htmlSource, htmlToMarkdown]);

        // Sync htmlSource when initial content changes (e.g. after Consul rewrite)
        useEffect(() => {
            if (editor && initialContent !== editor.getHTML()) {
                setHtmlSource(initialContent);
                if (viewMode === "visual") {
                    editor.commands.setContent(initialContent);
                }
            }
        // Only react to initialContent changes, not editor changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [initialContent]);

        if (!editor) return null;

        const wordCount = editor.storage.characterCount?.words?.() ?? 0;
        const charCount = editor.storage.characterCount?.characters?.() ?? 0;

        return (
            <div className={cn("space-y-0", className)}>
                {/* Mode toggle + word count */}
                <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {wordCount.toLocaleString()} words · {charCount.toLocaleString()} chars
                        </span>
                    </div>
                    <div className="flex border border-border rounded-md overflow-hidden">
                        <button
                            onClick={switchToVisual}
                            className={cn(
                                "px-3 py-1 text-xs flex items-center gap-1 transition-colors",
                                viewMode === "visual"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background hover:bg-muted"
                            )}
                        >
                            <Eye className="h-3 w-3" /> Visual
                        </button>
                        <button
                            onClick={switchToMarkdown}
                            className={cn(
                                "px-3 py-1 text-xs flex items-center gap-1 transition-colors",
                                viewMode === "markdown"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background hover:bg-muted"
                            )}
                        >
                            <FileText className="h-3 w-3" /> Markdown
                        </button>
                        <button
                            onClick={switchToHtml}
                            className={cn(
                                "px-3 py-1 text-xs flex items-center gap-1 transition-colors",
                                viewMode === "html"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-background hover:bg-muted"
                            )}
                        >
                            <Code className="h-3 w-3" /> HTML
                        </button>
                    </div>
                </div>

                {/* Visual mode */}
                {viewMode === "visual" && (
                    <>
                        {/* Toolbar */}
                        <div className="flex gap-1 flex-wrap p-1.5 bg-muted border border-border border-b-0 rounded-t-md items-center">
                            {/* Text formatting */}
                            <ToolbarButton
                                icon={<Bold className="h-3.5 w-3.5" />}
                                tooltip="Bold"
                                active={editor.isActive("bold")}
                                onClick={() => editor.chain().focus().toggleBold().run()}
                            />
                            <ToolbarButton
                                icon={<Italic className="h-3.5 w-3.5" />}
                                tooltip="Italic"
                                active={editor.isActive("italic")}
                                onClick={() => editor.chain().focus().toggleItalic().run()}
                            />

                            <Separator orientation="vertical" className="h-5 mx-0.5" />

                            {/* Headings */}
                            <ToolbarButton
                                icon={<Heading2 className="h-3.5 w-3.5" />}
                                tooltip="Heading 2"
                                active={editor.isActive("heading", { level: 2 })}
                                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                            />
                            <ToolbarButton
                                icon={<Heading3 className="h-3.5 w-3.5" />}
                                tooltip="Heading 3"
                                active={editor.isActive("heading", { level: 3 })}
                                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                            />
                            <ToolbarButton
                                icon={<Pilcrow className="h-3.5 w-3.5" />}
                                tooltip="Paragraph"
                                active={editor.isActive("paragraph") && !editor.isActive("heading")}
                                onClick={() => editor.chain().focus().setParagraph().run()}
                            />

                            <Separator orientation="vertical" className="h-5 mx-0.5" />

                            {/* Lists */}
                            <ToolbarButton
                                icon={<List className="h-3.5 w-3.5" />}
                                tooltip="Bullet List"
                                active={editor.isActive("bulletList")}
                                onClick={() => editor.chain().focus().toggleBulletList().run()}
                            />
                            <ToolbarButton
                                icon={<ListOrdered className="h-3.5 w-3.5" />}
                                tooltip="Ordered List"
                                active={editor.isActive("orderedList")}
                                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            />

                            <Separator orientation="vertical" className="h-5 mx-0.5" />

                            {/* Block elements */}
                            <ToolbarButton
                                icon={<Quote className="h-3.5 w-3.5" />}
                                tooltip="Blockquote"
                                active={editor.isActive("blockquote")}
                                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                            />
                            <ToolbarButton
                                icon={<Minus className="h-3.5 w-3.5" />}
                                tooltip="Horizontal Rule"
                                onClick={() => editor.chain().focus().setHorizontalRule().run()}
                            />
                            <ToolbarButton
                                icon={<Type className="h-3.5 w-3.5" />}
                                tooltip="Code Block"
                                active={editor.isActive("codeBlock")}
                                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                            />

                            <Separator orientation="vertical" className="h-5 mx-0.5" />

                            {/* Link */}
                            <ToolbarButton
                                icon={<Link2 className="h-3.5 w-3.5" />}
                                tooltip="Insert Link"
                                active={editor.isActive("link")}
                                onClick={() => {
                                    if (editor.isActive("link")) {
                                        editor.chain().focus().unsetLink().run();
                                        return;
                                    }
                                    const url = prompt("Enter URL:");
                                    if (url) {
                                        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
                                    }
                                }}
                            />

                            {/* Image (fires parent callback) */}
                            {onImageButtonClick && (
                                <ToolbarButton
                                    icon={<ImageIcon className="h-3.5 w-3.5" />}
                                    tooltip="Insert Image"
                                    onClick={onImageButtonClick}
                                />
                            )}

                            <Separator orientation="vertical" className="h-5 mx-0.5" />

                            {/* Undo / Redo */}
                            <ToolbarButton
                                icon={<Undo2 className="h-3.5 w-3.5" />}
                                tooltip="Undo"
                                disabled={!editor.can().undo()}
                                onClick={() => editor.chain().focus().undo().run()}
                            />
                            <ToolbarButton
                                icon={<Redo2 className="h-3.5 w-3.5" />}
                                tooltip="Redo"
                                disabled={!editor.can().redo()}
                                onClick={() => editor.chain().focus().redo().run()}
                            />
                        </div>

                        {/* Editor surface */}
                        <div className="rounded-b-md border border-border bg-background">
                            <EditorContent editor={editor} />
                        </div>
                    </>
                )}

                {/* Markdown mode */}
                {viewMode === "markdown" && (
                    <Textarea
                        value={markdownSource}
                        onChange={(e) => setMarkdownSource(e.target.value)}
                        rows={18}
                        className="font-mono text-xs leading-relaxed"
                        placeholder="# Heading\n\nWrite in **Markdown** here…"
                    />
                )}

                {/* HTML mode */}
                {viewMode === "html" && (
                    <Textarea
                        value={htmlSource}
                        onChange={(e) => setHtmlSource(e.target.value)}
                        rows={14}
                        className="font-mono text-xs"
                    />
                )}
            </div>
        );
    }
);

ArticleEditor.displayName = "ArticleEditor";
export default ArticleEditor;

// ── Toolbar Button ──────────────────────────────────────────────────────────

function ToolbarButton({
    icon,
    tooltip,
    active,
    disabled,
    onClick,
}: {
    icon: React.ReactNode;
    tooltip: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
}) {
    return (
        <Button
            variant="outline"
            size="sm"
            className={cn(
                "h-7 w-7 p-0 transition-colors",
                active && "bg-primary/15 border-primary/30 text-primary"
            )}
            title={tooltip}
            disabled={disabled}
            onMouseDown={(e) => {
                e.preventDefault(); // prevent editor blur
                onClick();
            }}
        >
            {icon}
        </Button>
    );
}
