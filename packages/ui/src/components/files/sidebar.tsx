"use client";
// Adapted from Square UI Files/components/files/sidebar.tsx, MIT revision 192f96a.
// Mock stores, document actions, storage widgets and sample identities removed.
import {
  FolderClosed,
  Images,
  Send,
  Plus,
  Settings,
  ArrowUpRight,
  ChevronsUpDown,
  UserCircle,
} from "lucide-react";
import { useRef, useState } from "react";
import { StaffAvatar } from "../staff-avatar";
import { StorageMeter } from "../storage-meter";
import type { Staff } from "@aia/contracts";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../ui/sidebar";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
export function FilesSidebar({
  user,
  product,
  section,
  onNavigate,
  onCreate,
  onSettings,
  mediaUrl,
  transferUrl,
}: {
  user: Staff;
  product: "media" | "transfer";
  section: string;
  onNavigate: (value: string) => void;
  onCreate: () => void;
  onSettings: () => void;
  mediaUrl: string;
  transferUrl: string;
}) {
  const { setOpenMobile, isMobile, setOpen } = useSidebar();
  const hovered = useRef(false),
    keyboard = useRef(false);
  const [accountOpen, setAccountOpen] = useState(false),
    [storageOpen, setStorageOpen] = useState(false);
  const menuItems =
    product === "media"
      ? [
          { label: "Library", value: "library", icon: Images },
          { label: "Collections", value: "collections", icon: FolderClosed },
          { label: "Transfers", value: "transfers", icon: Send },
        ]
      : [{ label: "Transfers", value: "transfers", icon: Send }];
  return (
    <Sidebar
      collapsible="icon"
      className="aia-sidebar"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" && !isMobile) {
          hovered.current = true;
          setOpen(true);
        }
      }}
      onPointerLeave={() => {
        hovered.current = false;
        if (!isMobile && !keyboard.current && !accountOpen && !storageOpen)
          setOpen(false);
      }}
      onPointerDownCapture={() => {
        keyboard.current = false;
      }}
      onFocusCapture={(event) => {
        if (!isMobile && event.target.matches(":focus-visible")) {
          keyboard.current = true;
          setOpen(true);
        }
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          keyboard.current = false;
          if (!hovered.current && !accountOpen && !storageOpen && !isMobile)
            setOpen(false);
        }
      }}
    >
      <SidebarHeader className="p-5 pb-3">
        <a href="/" className="sidebar-brand flex min-h-12 items-center gap-3">
          <img
            src="/aia-logo.png"
            alt="AIA"
            className="sidebar-logo-full h-9 w-16 object-contain"
          />
          <span className="sidebar-logo-compact">
            <img src="/aia-logo.png" alt="AIA" />
          </span>
          <div className="group-data-[collapsible=icon]:hidden">
            <strong className="block text-sm font-semibold tracking-tight">
              AIA {product === "media" ? "Media" : "Transfer"}
            </strong>
            <span className="text-[10px] text-muted-foreground">
              Algarve International Circuit
            </span>
          </div>
        </a>
      </SidebarHeader>
      <SidebarContent className="px-3 pt-4">
        <Button
          aria-label={
            product === "media" && section !== "transfers"
              ? "Upload media"
              : "New transfer"
          }
          className="sidebar-create mb-5 w-full justify-start gap-2 group-data-[collapsible=icon]:px-2"
          onClick={onCreate}
        >
          <Plus className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">
            {product === "media" && section !== "transfers"
              ? "Upload media"
              : "New transfer"}
          </span>
        </Button>
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="mb-2 text-[10px] uppercase tracking-widest">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    aria-label={item.label}
                    isActive={section === item.value}
                    tooltip={item.label}
                    onClick={() => {
                      onNavigate(item.value);
                      if (isMobile) setOpenMobile(false);
                    }}
                    className="h-10 gap-3"
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {product === "transfer" && (
          <SidebarGroup className="mt-7 p-0">
            <SidebarGroupLabel className="text-[10px] uppercase tracking-widest">
              Connected apps
            </SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Open Media">
                  <a href={mediaUrl}>
                    <ArrowUpRight className="size-4" />
                    <span>AIA Media</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {user.role === "admin" && (
          <div className="group-data-[collapsible=icon]:hidden">
            <StorageMeter
              onOpenChange={(open) => {
                setStorageOpen(open);
                if (
                  !open &&
                  !hovered.current &&
                  !keyboard.current &&
                  !accountOpen &&
                  !isMobile
                )
                  setOpen(false);
              }}
            />
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onSettings}
              tooltip="Settings"
              aria-label="Settings"
            >
              <Settings className="size-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <DropdownMenu
          open={accountOpen}
          onOpenChange={(open) => {
            setAccountOpen(open);
            if (!open && !hovered.current && !keyboard.current && !isMobile)
              setOpen(false);
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              className="sidebar-account flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-sidebar-accent"
              aria-label="Open account menu"
            >
              <StaffAvatar user={user} className="sidebar-user-avatar" />
              <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <strong className="block truncate text-xs">{user.name}</strong>
                <span className="text-[11px] capitalize text-muted-foreground">
                  {user.role === "reviewer" ? "Media editor" : user.role}
                </span>
              </span>
              <ChevronsUpDown className="size-3.5 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end">
            <DropdownMenuItem onClick={onSettings}>
              <UserCircle />
              Account & settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
