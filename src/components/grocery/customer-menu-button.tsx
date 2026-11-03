"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogIn, LogOut, Package, UserCircle, ChevronDown } from "lucide-react";
import { useCustomerStore } from "@/lib/store/customer";
import { toast } from "sonner";

// ============================================================
// CustomerMenuButton — header customer account control.
// ============================================================
// Not logged in: shows "Masuk" button (opens auth dialog).
// Logged in: shows avatar + name + dropdown menu (profile,
// order history, logout).
//
// The customer store is fetched once on mount by home-client;
// here we just read the store state.
// ============================================================

interface CustomerMenuButtonProps {
  onOpenOrderHistory?: () => void;
}

export function CustomerMenuButton({ onOpenOrderHistory }: CustomerMenuButtonProps) {
  const { customer, openAuthDialog, logout, loading } = useCustomerStore();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    toast.success("Berhasil logout");
  };

  // Loading state (fetching /api/customer/me on mount)
  if (loading) {
    return (
      <div className="h-9 w-9 rounded-full bg-secondary animate-pulse" aria-hidden="true" />
    );
  }

  // Not logged in — show Masuk button
  if (!customer) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={openAuthDialog}
        className="gap-1.5 rounded-full h-10 px-3 hover:bg-accent transition-all hover:scale-105"
        aria-label="Masuk akun"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden md:inline text-sm font-medium">Masuk</span>
      </Button>
    );
  }

  // Logged in — avatar + dropdown
  const initials = customer.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-full h-10 px-2 hover:bg-accent transition-all hover:scale-105"
          aria-label={`Akun: ${customer.name}`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {initials || "?"}
          </div>
          <span className="hidden md:inline text-sm font-medium max-w-[80px] truncate">
            {customer.name.split(" ")[0]}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{customer.name}</p>
            <p className="text-xs leading-none text-muted-foreground">{customer.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setMenuOpen(false);
            if (onOpenOrderHistory) onOpenOrderHistory();
          }}
        >
          <Package className="mr-2 h-4 w-4" />
          Riwayat Pesanan
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setMenuOpen(false);
            toast.info("Profil edit coming soon. Sementara, edit via admin panel.");
          }}
        >
          <UserCircle className="mr-2 h-4 w-4" />
          Profil Saya
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
