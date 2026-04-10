import { useState } from "react";
import {
  SmartPatternMetadata,
  SmartPatternId,
  DEFAULT_SMART_PATTERNS,
  getDefaultPatternIds,
  addCustomPattern,
  canDeletePattern,
} from "@/types/smart-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash, Plus, Eye, EyeSlash } from "@phosphor-icons/react";
import "./smart-pattern-settings.css";

interface SmartPatternSettingsProps {
  patterns: SmartPatternMetadata[];
  onChange: (patterns: SmartPatternMetadata[]) => void;
}

interface FormState {
  title: string;
  description: string;
  pattern: string;
  minLinesToShow: string;
  error?: string;
}

export function SmartPatternSettings({
  patterns,
  onChange,
}: SmartPatternSettingsProps) {
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    title: "",
    description: "",
    pattern: "",
    minLinesToShow: "5",
  });

  const defaultIds = getDefaultPatternIds();

  const handleTogglePattern = (id: SmartPatternId) => {
    const updated = patterns.map((p) =>
      p.id === id ? { ...p, enabled: !p.enabled } : p,
    );
    onChange(updated);
  };

  const handleDeletePattern = (id: SmartPatternId) => {
    if (canDeletePattern(id)) {
      onChange(patterns.filter((p) => p.id !== id));
    }
  };

  const validateForm = (): boolean => {
    if (!formState.title.trim()) {
      setFormState((s) => ({ ...s, error: "Title is required" }));
      return false;
    }
    if (!formState.pattern.trim()) {
      setFormState((s) => ({ ...s, error: "Pattern is required" }));
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

    // Try to compile the regex to check validity
    try {
      new RegExp(formState.pattern);
    } catch (err) {
      setFormState((s) => ({
        ...s,
        error: `Invalid regex pattern: ${(err as Error).message}`,
      }));
      return false;
    }

    return true;
  };

  const handleAddPattern = () => {
    if (!validateForm()) return;

    const minLines = parseInt(formState.minLinesToShow, 10);
    const updated = addCustomPattern(
      patterns,
      formState.title,
      formState.description,
      formState.pattern,
      minLines,
    );
    onChange(updated);

    setFormState({
      title: "",
      description: "",
      pattern: "",
      minLinesToShow: "5",
    });
    setShowForm(false);
  };

  const handleUpdatePattern = (
    id: SmartPatternId,
    field: keyof SmartPatternMetadata,
    value: unknown,
  ) => {
    const updated = patterns.map((p) =>
      p.id === id ? { ...p, [field]: value } : p,
    );
    onChange(updated);
  };

  const customPatterns = patterns.filter((p) => !defaultIds.has(p.id));

  return (
    <div className="smart-pattern-settings">
      {customPatterns.length > 0 && (
        <div className="sp-section">
          <h3 className="sp-heading">Custom Patterns</h3>
          <p className="sp-description">
            Your custom patterns. You can edit or delete them at any time.
          </p>

          <div className="sp-list">
            {customPatterns.map((pattern) => (
              <div key={pattern.id} className="sp-item sp-item-custom">
                <div className="sp-item-header">
                  <div className="sp-item-title-group">
                    <Input
                      type="text"
                      value={pattern.title}
                      onChange={(e) =>
                        handleUpdatePattern(pattern.id, "title", e.target.value)
                      }
                      className="sp-title-input"
                    />
                  </div>
                  <div className="sp-item-controls">
                    <button
                      onClick={() => handleTogglePattern(pattern.id)}
                      className="sp-toggle-btn"
                      title={pattern.enabled ? "Disable" : "Enable"}
                    >
                      {pattern.enabled ? (
                        <Eye size={16} />
                      ) : (
                        <EyeSlash size={16} />
                      )}
                    </button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeletePattern(pattern.id)}
                      className="sp-delete-btn"
                    >
                      <Trash size={16} />
                    </Button>
                  </div>
                </div>

                <textarea
                  value={pattern.description}
                  onChange={(e) =>
                    handleUpdatePattern(
                      pattern.id,
                      "description",
                      e.target.value,
                    )
                  }
                  className="sp-description-input"
                  placeholder="Pattern description"
                />

                <div className="sp-pattern-group">
                  <label htmlFor={`pattern-${pattern.id}`} className="sp-label">
                    Regex Pattern:
                  </label>
                  <Input
                    id={`pattern-${pattern.id}`}
                    type="text"
                    value={pattern.pattern || ""}
                    onChange={(e) =>
                      handleUpdatePattern(pattern.id, "pattern", e.target.value)
                    }
                    className="sp-pattern-input"
                    placeholder="e.g., (Error|Warning): .*"
                  />
                </div>

                <div className="sp-min-lines">
                  <label
                    htmlFor={`min-lines-custom-${pattern.id}`}
                    className="sp-label"
                  >
                    Min Lines to Show:
                  </label>
                  <Input
                    id={`min-lines-custom-${pattern.id}`}
                    type="number"
                    min="1"
                    value={pattern.minLinesToShow}
                    onChange={(e) =>
                      handleUpdatePattern(
                        pattern.id,
                        "minLinesToShow",
                        parseInt(e.target.value, 10) || 1,
                      )
                    }
                    className="sp-number-input"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sp-section">
        {!showForm ? (
          <Button
            variant="outline"
            onClick={() => setShowForm(true)}
            className="sp-add-btn"
          >
            <Plus size={16} className="mr-2" />
            Add Custom Pattern
          </Button>
        ) : (
          <div className="sp-form">
            <h4 className="sp-form-title">Create New Pattern</h4>

            {formState.error && (
              <div className="sp-error">{formState.error}</div>
            )}

            <div className="sp-form-group">
              <label htmlFor="sp-title" className="sp-label">
                Title
              </label>
              <Input
                id="sp-title"
                placeholder="Pattern name"
                value={formState.title}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    title: e.target.value,
                    error: undefined,
                  }))
                }
              />
            </div>

            <div className="sp-form-group">
              <label htmlFor="sp-description" className="sp-label">
                Description
              </label>
              <textarea
                id="sp-description"
                placeholder="What does this pattern find?"
                value={formState.description}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    description: e.target.value,
                    error: undefined,
                  }))
                }
                className="sp-textarea"
              />
            </div>

            <div className="sp-form-group">
              <label htmlFor="sp-pattern" className="sp-label">
                Regex Pattern
              </label>
              <Input
                id="sp-pattern"
                placeholder="e.g., (Error|Warning): .*"
                value={formState.pattern}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    pattern: e.target.value,
                    error: undefined,
                  }))
                }
              />
              <p className="sp-help-text">
                Enter a JavaScript regex pattern. Double backslashes for regex
                escaping.
              </p>
            </div>

            <div className="sp-form-group">
              <label htmlFor="sp-minlines" className="sp-label">
                Minimum Lines to Show
              </label>
              <Input
                id="sp-minlines"
                type="number"
                min="1"
                value={formState.minLinesToShow}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    minLinesToShow: e.target.value,
                    error: undefined,
                  }))
                }
              />
            </div>

            <div className="sp-form-actions">
              <Button onClick={handleAddPattern} className="sp-submit-btn">
                Create Pattern
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setFormState({
                    title: "",
                    description: "",
                    pattern: "",
                    minLinesToShow: "5",
                    error: undefined,
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="sp-section">
        <h3 className="sp-heading">Default Patterns (Protected)</h3>
        <p className="sp-description">
          Built-in patterns help reduce noise in logs. You can disable them but
          cannot delete them. Edit their titles and descriptions as needed.
        </p>

        <div className="sp-list">
          {DEFAULT_SMART_PATTERNS.map((pattern) => (
            <div key={pattern.id} className="sp-item sp-item-default">
              <div className="sp-item-header">
                <div className="sp-item-title-group">
                  <Input
                    type="text"
                    value={pattern.title}
                    onChange={(e) =>
                      handleUpdatePattern(pattern.id, "title", e.target.value)
                    }
                    className="sp-title-input"
                  />
                  <Badge variant="secondary" className="sp-protected-badge">
                    Protected
                  </Badge>
                </div>
                <button
                  onClick={() => handleTogglePattern(pattern.id)}
                  className="sp-toggle-btn"
                  title={pattern.enabled ? "Disable" : "Enable"}
                >
                  {pattern.enabled ? <Eye size={16} /> : <EyeSlash size={16} />}
                </button>
              </div>

              <textarea
                value={pattern.description}
                onChange={(e) =>
                  handleUpdatePattern(pattern.id, "description", e.target.value)
                }
                className="sp-description-input"
                placeholder="Pattern description"
              />

              <div className="sp-min-lines">
                <label htmlFor={`min-lines-${pattern.id}`} className="sp-label">
                  Min Lines to Show:
                </label>
                <Input
                  id={`min-lines-${pattern.id}`}
                  type="number"
                  min="1"
                  value={pattern.minLinesToShow}
                  onChange={(e) =>
                    handleUpdatePattern(
                      pattern.id,
                      "minLinesToShow",
                      parseInt(e.target.value, 10) || 1,
                    )
                  }
                  className="sp-number-input"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
