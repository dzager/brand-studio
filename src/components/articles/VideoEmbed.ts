// VideoEmbed.ts — Custom Tiptap node for YouTube & Vimeo responsive embeds
// Preserves <div class="youtube-embed|vimeo-embed"><iframe …/></div> when
// loading article HTML into the editor, and renders a visible preview in
// the WYSIWYG surface.

import { Node, mergeAttributes } from "@tiptap/core";

export interface VideoEmbedOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
    interface Commands<ReturnType> {
        videoEmbed: {
            setVideoEmbed: (options: { src: string; title?: string; platform?: string }) => ReturnType;
        };
    }
}

const VideoEmbed = Node.create<VideoEmbedOptions>({
    name: "videoEmbed",
    group: "block",
    atom: true, // non-editable, selectable as a unit
    draggable: true,

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            src: { default: null },
            title: { default: "" },
            platform: { default: "youtube" }, // "youtube" | "vimeo"
        };
    },

    parseHTML() {
        return [
            {
                // Match <div class="youtube-embed …"><iframe src="…" /></div>
                tag: 'div.youtube-embed',
                getAttrs(node) {
                    const el = node as HTMLElement;
                    const iframe = el.querySelector("iframe");
                    if (!iframe) return false;
                    return {
                        src: iframe.getAttribute("src") ?? "",
                        title: iframe.getAttribute("title") ?? "",
                        platform: "youtube",
                    };
                },
            },
            {
                // Match <div class="vimeo-embed …"><iframe src="…" /></div>
                tag: 'div.vimeo-embed',
                getAttrs(node) {
                    const el = node as HTMLElement;
                    const iframe = el.querySelector("iframe");
                    if (!iframe) return false;
                    return {
                        src: iframe.getAttribute("src") ?? "",
                        title: iframe.getAttribute("title") ?? "",
                        platform: "vimeo",
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { src, title, platform } = HTMLAttributes;
        const cls = platform === "vimeo" ? "vimeo-embed" : "youtube-embed";
        const allow =
            platform === "vimeo"
                ? "autoplay; fullscreen; picture-in-picture"
                : "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";

        return [
            "div",
            mergeAttributes(this.options.HTMLAttributes, {
                class: cls,
                style: "position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;margin:24px 0;border-radius:12px",
            }),
            [
                "iframe",
                {
                    src,
                    title: title ?? "",
                    style: "position:absolute;top:0;left:0;width:100%;height:100%;border:0;border-radius:12px",
                    allow,
                    allowfullscreen: "true",
                    frameborder: "0",
                },
            ],
        ];
    },

    addCommands() {
        return {
            setVideoEmbed:
                (options) =>
                ({ commands }) => {
                    return commands.insertContent({
                        type: this.name,
                        attrs: {
                            src: options.src,
                            title: options.title ?? "",
                            platform: options.platform ?? "youtube",
                        },
                    });
                },
        };
    },
});

export default VideoEmbed;
