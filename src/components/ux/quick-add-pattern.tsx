import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SmartPatternMetadata, SmartPatternId } from "@/types/smart-patterns";

interface QuickAddPatternProps {
  onAddPattern: (pattern: SmartPatternMetadata) => void;
}

export function QuickAddPattern({ onAddPattern }: QuickAddPatternProps) {
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState({
    title: "",
    description: "",
    pattern: "",
    minLinesToShow: "5",
    error: "",
  });

  const resetForm = () => {
    setFormState({
      title: "",
      description: "",
      pattern: "",
      minLinesToShow: "5",
      error: "",
    });
    setShowForm(false);
  };

  const validateForm = (): boolean => {
    if (!formState.title.trim()) {
      setFormState((s) => ({ ...s, error: "Title is required" }));
      return false;
    }
    if (!formState.pattern.trim()) {
      setFormState((s) => ({ ...s, error: "Pattern (regex) is required" }));
      return false;
    }

    const minLines = parseInt(formState.minLinesToShow, 10);
    if (isNaN(minLines) || minLines < 1) {
      setFormState((s) => ({
        ...s,
        error: "Minimum lines must be a positive number",
      }));
      return false;
    }

    try {
      new RegExp(formState.pattern);
    } catch (err) {
      setFormState((s) => ({
        ...s,
        error: `Invalid regex: ${(err as Error).message}`,
      }));
      return false;
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const minLines = parseInt(formState.minLinesToShow, 10);
    const newPattern: SmartPatternMetadata = {
      id: `custom-${Date.now()}` as SmartPatternId,
      title: formState.title,
      description: formState.description,
      pattern: formState.pattern,
      minLinesToShow: minLines,
      enabled: true,
    };

    onAddPattern(newPattern);
    resetForm();
  };

  if (!showForm) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 w-full"
        onClick={() => setShowForm(true)}
      >
        <Plus size={14} />
        Quick Add Custom Pattern
      </Button>
    );
  }

  return (
    <Card className="border border-border/80 bg-card/50">
      <CardHeader>
        <CardTitle className="text-base">Quick Add Custom Pattern</CardTitle>
        <CardDescription>
          Create a regex pattern to detect and filter log lines while inspecting this log
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Pattern Title
              </span>
              <Input
                placeholder="e.g., My Custom Filter"
                value={formState.title}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, title: e.target.value, error: "" }))
                }
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Min Lines to Show
              </span>
              <Input
                type="number"
                min="1"
                placeholder="5"
                value={formState.minLinesToShow}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, minLinesToShow: e.target.value, error: "" }))
                }
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Description (optional)
            </span>
            <Input
              placeholder="What does this pattern detect?"
              value={formState.description}
              onChange={(e) =>
                setFormState((s) => ({ ...s, description: e.target.value, error: "" }))
              }
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Regex Pattern
            </span>
            <Input
              placeholder="e.g., (Error|Warning).*modname"
              value={formState.pattern}
              onChange={(e) =>
                setFormState((s) => ({ ...s, pattern: e.target.value, error: "" }))
              }
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Regex will match against log message and source combined
            </p>
          </label>

          {formState.error && (
            <div className="border border-destructive/60 bg-destructive/10 px-3 py-2 text-sm text-destructive rounded">
              {formState.error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="gap-1.5"
            >
              <Plus size={14} />
              Add Pattern
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
