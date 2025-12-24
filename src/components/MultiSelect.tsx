import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Removed UI component imports as they might not affect this custom implementation 
// or were missing. This custom implementation uses standard divs.

export interface MultiSelectProps {
    options: { label: string; value: string }[];
    selected: string[];
    onChange: (value: string[]) => void;
    placeholder?: string;
    className?: string;
}

export function MultiSelect({
    options,
    selected,
    onChange,
    placeholder = "Select options",
    className,
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);

    const handleSelect = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter((item) => item !== value));
        } else {
            onChange([...selected, value]);
        }
    };

    const handleRemove = (value: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(selected.filter((item) => item !== value));
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    };

    return (
        <div className={cn("relative", className)}>
            <div
                className={cn(
                    "flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
                    className
                )}
                onClick={() => setOpen(!open)}
            >
                <div className="flex flex-wrap gap-1 flex-1">
                    {selected.length > 0 ? (
                        selected.length > 1 ? (
                            <div className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md text-sm font-medium">
                                已選擇 {selected.length} 項
                            </div>
                        ) : (
                            selected.map((val) => {
                                const option = options.find((o) => o.value === val);
                                return (
                                    <div
                                        key={val}
                                        className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md text-xs"
                                    >
                                        {option?.label || val}
                                        <div
                                            className="h-3 w-3 cursor-pointer hover:text-destructive"
                                            onClick={(e) => handleRemove(val, e)}
                                        >
                                            &times;
                                        </div>
                                    </div>
                                );
                            })
                        )
                    ) : (
                        <span className="text-muted-foreground text-sm">{placeholder}</span>
                    )}
                </div>
                <div className="flex items-center gap-2 relative">
                    {selected.length > 0 && (
                        <>
                            <div
                                className="text-red-600 hover:text-red-800 font-bold cursor-pointer relative group"
                                onClick={handleClear}
                            >
                                <X className="h-4 w-4" strokeWidth={3} />
                                <div className="absolute bottom-full mb-2 right-0 bg-blue-600 text-white text-lg font-bold px-3 py-1 rounded shadow-lg z-50 whitespace-nowrap hidden group-hover:block">
                                    全部清除選項
                                </div>
                            </div>
                        </>
                    )}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </div>
            </div>

            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute z-50 w-full mt-1 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
                        <div className="p-1 max-h-60 overflow-y-auto">
                            {options.length === 0 && (
                                <div className="py-2 text-center text-sm text-muted-foreground">No options</div>
                            )}
                            {options.map((option) => {
                                const isSelected = selected.includes(option.value);
                                return (
                                    <div
                                        key={option.value}
                                        className={cn(
                                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                            isSelected ? "bg-accent/50" : ""
                                        )}
                                        onClick={() => handleSelect(option.value)}
                                    >
                                        <div className={cn(
                                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                            isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible"
                                        )}>
                                            <Check className={cn("h-4 w-4")} />
                                        </div>
                                        <span>{option.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
