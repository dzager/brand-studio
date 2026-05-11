import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Copy, FileText, CheckCircle2, Lightbulb, Target, BarChart3 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export interface BriefData {
    summary: string;
    key_themes: { theme: string; evidence: string[] }[];
    content_angles: { angle: string; rationale: string; target_keyword?: string }[];
    supporting_data: string[];
}

interface ResearchBriefProps {
    brief: BriefData;
    onCreateArticle: (angle: string) => void;
    className?: string;
}

export default function ResearchBrief({ brief, onCreateArticle, className }: ResearchBriefProps) {
    const [copied, setCopied] = useState(false);

    function copyBrief() {
        const text = [
            `# Research Brief\n`, brief.summary,
            `\n## Key Themes`,
            ...brief.key_themes.map(t => `\n### ${t.theme}\n${t.evidence.map(e => `- ${e}`).join("\n")}`),
            `\n## Content Angles`,
            ...brief.content_angles.map(a => `- **${a.angle}**: ${a.rationale}`),
            `\n## Supporting Data`,
            ...brief.supporting_data.map(d => `- ${d}`),
        ].join("\n");
        navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }

    return (
        <div className={cn("space-y-5", className)}>
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <h3 className="text-sm font-semibold">Executive Summary</h3>
                    <div className="flex-1" />
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={copyBrief}>
                        {copied ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        {copied ? "Copied" : "Copy Brief"}
                    </Button>
                </div>
                <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">{brief.summary}</p>
            </div>
            <Separator />
            {brief.key_themes.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <Target className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold">Key Themes</h3>
                        <Badge variant="outline" className="text-[10px]">{brief.key_themes.length}</Badge>
                    </div>
                    <div className="space-y-3">
                        {brief.key_themes.map((theme, i) => (
                            <Card key={i} className="border-border/50">
                                <CardContent className="p-3">
                                    <p className="text-sm font-medium mb-1.5">{theme.theme}</p>
                                    <ul className="space-y-0.5">
                                        {theme.evidence.map((e, j) => (
                                            <li key={j} className="text-xs text-muted-foreground flex gap-1.5">
                                                <span className="text-primary/60 shrink-0">•</span>{e}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
            <Separator />
            {brief.content_angles.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-green-500" />
                        <h3 className="text-sm font-semibold">Article Angles</h3>
                    </div>
                    <div className="space-y-2">
                        {brief.content_angles.map((angle, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/[0.02] transition-colors group">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{angle.angle}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{angle.rationale}</p>
                                    {angle.target_keyword && <Badge variant="secondary" className="mt-1.5 text-[10px]">🎯 {angle.target_keyword}</Badge>}
                                </div>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onCreateArticle(angle.angle)}>
                                    <FileText className="h-3 w-3" />Create
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {brief.supporting_data.length > 0 && (<>
                <Separator />
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                        <h3 className="text-sm font-semibold">Supporting Data</h3>
                    </div>
                    <ul className="space-y-1">
                        {brief.supporting_data.map((d, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-blue-400 shrink-0">📊</span>{d}</li>
                        ))}
                    </ul>
                </div>
            </>)}
        </div>
    );
}
