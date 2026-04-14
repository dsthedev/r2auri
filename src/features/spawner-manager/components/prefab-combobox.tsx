import { useRef, useState } from "react";
import { CheckIcon } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PrefabCombobox({
  imageMap,
  onChange,
  options,
  placeholder,
  value,
}: {
  imageMap?: Map<string, string>;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredOptions = value
    ? options.filter((option) => option.toLowerCase().includes(value.toLowerCase()))
    : options;

  const handleBlur = (event: React.FocusEvent) => {
    if (!containerRef.current?.contains(event.relatedTarget as Node)) {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full" onBlur={handleBlur}>
      <div className="relative flex items-center">
        {imageMap && value && imageMap.get(value) && (
          <img
            src={imageMap.get(value)}
            alt={value}
            className="absolute left-2 top-1/2 z-10 h-8 w-8 -translate-y-1/2 object-contain"
          />
        )}
        <Input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Search..."}
          className={cn(imageMap && value && imageMap.get(value) && "pl-12")}
          autoComplete="off"
        />
      </div>

      {open && filteredOptions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full border border-border bg-popover shadow-md">
          <div className="max-h-48 overflow-y-auto p-1">
            {filteredOptions.map((option) => {
              const imageUrl = imageMap?.get(option);
              return (
                <button
                  key={option}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center px-2 py-1.5 text-left text-sm hover:bg-muted",
                    value === option && "bg-muted"
                  )}
                >
                  <CheckIcon className={cn("mr-2 size-4 shrink-0", value === option ? "opacity-100" : "opacity-0")} />
                  {imageUrl && (
                    <img src={imageUrl} alt={option} className="mr-2 h-7 w-7 shrink-0 object-contain" />
                  )}
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}