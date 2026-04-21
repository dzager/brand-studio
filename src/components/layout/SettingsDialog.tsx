import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useModelDefaults } from "@/hooks/useModelDefaults";
import type { ModelDefaults } from "@/hooks/useModelDefaults";
import { RotateCcw, Pen, ImageIcon, Zap } from "lucide-react";

type ModelInfo = {
    id: string;
    label: string;
    provider: string;
    capabilities: string[];
};

const CATEGORIES: {
    key: keyof ModelDefaults;
    label: string;
    description: string;
    icon: React.ReactNode;
    capability: string;
}[] = [
    {
        key: "writing",
        label: "Writing",
        description: "Article generation, humanization, shortening",
        icon: <Pen className="h-4 w-4" />,
        capability: "writing",
    },
    {
        key: "imageGeneration",
        label: "Image Generation",
        description: "AI image creation and compositing",
        icon: <ImageIcon className="h-4 w-4" />,
        capability: "imageGeneration",
    },
    {
        key: "utility",
        label: "Utility",
        description: "Prompt generation, style recommendation, interlinking",
        icon: <Zap className="h-4 w-4" />,
        capability: "utility",
    },
];

export default function SettingsDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { defaults, setDefault, resetDefaults, FACTORY_DEFAULTS } = useModelDefaults();
    const [models, setModels] = useState<ModelInfo[]>([]);

    useEffect(() => {
        if (!open) return;
        fetch("/api/models")
            .then((r) => r.json())
            .then((data) => {
                if (data?.models && Array.isArray(data.models)) {
                    setModels(data.models);
                }
            })
            .catch(() => {});
    }, [open]);

    function modelsForCategory(capability: string) {
        return models.filter((m) => m.capabilities?.includes(capability));
    }

    function isDefault(key: keyof ModelDefaults) {
        return defaults[key] === FACTORY_DEFAULTS[key];
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Settings
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        Configure default AI models for each process category.
                    </p>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Default Models
                    </h3>

                    {CATEGORIES.map((cat, i) => {
                        const available = modelsForCategory(cat.capability);
                        const currentValue = defaults[cat.key];

                        return (
                            <div key={cat.key}>
                                {i > 0 && <Separator className="mb-4" />}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">{cat.icon}</span>
                                        <Label className="text-sm font-medium">{cat.label}</Label>
                                        {!isDefault(cat.key) && (
                                            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                                                Custom
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                                    <select
                                        value={currentValue}
                                        onChange={(e) => setDefault(cat.key, e.target.value)}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        {available.length > 0
                                            ? available.map((m) => (
                                                  <option key={m.id} value={m.id}>
                                                      {m.label}
                                                      {m.provider !== "openai"
                                                          ? ` (${m.provider})`
                                                          : ""}
                                                  </option>
                                              ))
                                            : <option value={currentValue}>{currentValue}</option>
                                        }
                                    </select>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <DialogFooter className="flex-row justify-between sm:justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetDefaults}
                        className="gap-1.5 text-muted-foreground"
                    >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset to Defaults
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
