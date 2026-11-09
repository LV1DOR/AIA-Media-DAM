"use client";
// Adapted from Square UI Files/components/files/header.tsx, MIT revision 192f96a.
import { useEffect, useState } from "react";
import { Sun, Moon, Plus, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import { MorphingSearchChips } from "../beui/components/motion/morphing-search-chips";
import { SidebarTrigger } from "../ui/sidebar";
export function FilesHeader({
  section,
  search,
  onSearch,
  onCreate,
  createLabel,
  chips = [],
  onChipsChange,
  suggestions = [],
  loading = false,
  searchKey,
}: {
  chips?: string[];
  onChipsChange?: (chips: string[]) => void;
  suggestions?: string[];
  loading?: boolean;
  searchKey?: string;
  section: string;
  search?: string;
  onSearch: (value: string) => void;
  onCreate: () => void;
  createLabel: string;
}) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const value = localStorage.getItem("aia-theme") === "dark";
    setDark(value);
    document.documentElement.classList.toggle("dark", value);
  }, []);
  return (
    <header className="aia-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6">
      <SidebarTrigger className="-ml-1 md:hidden" />
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <span className="hidden sm:block">Workspace</span>
        <ChevronRight className="hidden size-3 sm:block" />
        <span className="font-medium capitalize text-foreground">
          {section === "library" ? "Media library" : section}
        </span>
      </nav>
      <div className="flex-1" />
      {search !== undefined && (
        <div className="aia-library-search">
          <MorphingSearchChips
            query={search}
            onQueryChange={onSearch}
            chips={chips}
            onChipsChange={onChipsChange}
            suggestions={suggestions}
            storageKey={searchKey}
            label="Search your library"
            placeholder="Search your library..."
            side="bottom"
            maxChips={8}
            loading={loading}
            normalize={(term) => term.trim().slice(0, 120) || null}
          />
        </div>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
        onClick={() => {
          const next = !dark;
          setDark(next);
          document.documentElement.classList.toggle("dark", next);
          localStorage.setItem("aia-theme", next ? "dark" : "light");
        }}
      >
        {dark ? <Sun /> : <Moon />}
      </Button>
      <Button onClick={onCreate} className="gap-2">
        <Plus className="size-4" />
        <span className="hidden sm:inline">{createLabel}</span>
        <span className="sm:hidden">New</span>
      </Button>
    </header>
  );
}
