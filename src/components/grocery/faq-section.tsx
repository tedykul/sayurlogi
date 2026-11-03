"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  HelpCircle,
  MessageCircleQuestion,
  ShoppingBag,
  Truck,
  CreditCard,
  Leaf,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Section "FAQ" — accordion of frequently asked questions.
 * Anchor target: #faq (with scroll-mt-24 for sticky header offset).
 *
 * FAQs are categorized into 4 groups with distinct icon + accent color,
 * applied as a left accent bar on each accordion item for scanability.
 */

type FaqCategory = "pemesanan" | "pengiriman" | "pembayaran" | "produk";

interface FaqItem {
  q: string;
  a: string;
  category: FaqCategory;
}

const CATEGORY_META: Record<
  FaqCategory,
  { icon: LucideIcon; accent: string; label: string }
> = {
  pemesanan: { icon: ShoppingBag, accent: "bg-primary", label: "Pemesanan" },
  pengiriman: { icon: Truck, accent: "bg-cyan-500", label: "Pengiriman" },
  pembayaran: { icon: CreditCard, accent: "bg-amber-500", label: "Pembayaran" },
  produk: { icon: Leaf, accent: "bg-orange-500", label: "Produk" },
};

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Bagaimana cara memesan di SayurLogi?",
    a: "Pilih produk yang kamu inginkan, klik 'Tambah' untuk masuk keranjang. Setelah selesai, klik ikon keranjang lalu 'Checkout Sekarang'. Isi data pengiriman, pilih metode pembayaran, lalu 'Buat Pesanan'. Pesanan akan diproses dan dikirim sesuai jadwal pengiriman yang dipilih.",
    category: "pemesanan",
  },
  {
    q: "Apakah ada minimum order?",
    a: "Tidak ada minimum order! Tapi untuk mendapatkan gratis ongkir, belanja minimal Rp50.000. Di bawah nominal tersebut, ongkir flat Rp9.000 berlaku untuk wilayah kota.",
    category: "pemesanan",
  },
  {
    q: "Berapa lama waktu pengiriman?",
    a: "Kami mengantarkan pesanan dalam waktu 2-4 jam untuk wilayah kota metropolitan. Untuk pengiriman di luar kota, estimasi 1-2 hari kerja. Kamu akan menerima notifikasi via WhatsApp/email ketika pesanan sedang dalam perjalanan.",
    category: "pengiriman",
  },
  {
    q: "Bisakah saya jadwalkan pengiriman untuk hari tertentu?",
    a: "Ya! Saat checkout, pilih tanggal & slot waktu pengiriman yang kamu inginkan (pagi 09-12, siang 12-15, sore 15-18, atau malam 18-21). Cocok untuk yang ingin pesan sayur untuk masak akhir pekan atau kebutuhan kantin harian.",
    category: "pengiriman",
  },
  {
    q: "Metode pembayaran apa saja yang tersedia?",
    a: "Kami menerima 3 metode pembayaran: (1) COD — bayar tunai di tempat saat pesanan tiba, (2) Transfer bank (BCA, Mandiri, BNI, BRI), dan (3) E-Wallet (GoPay, OVO, DANA, ShopeePay). Semua transaksi aman dan terenkripsi.",
    category: "pembayaran",
  },
  {
    q: "Apakah sayuran & buah benar-benar segar?",
    a: "Ya! Semua produk dipetik langsung dari kebun petani mitra pada pagi hari, lalu dikirim ke gudang kami untuk quality check, dan diteruskan ke konsumen di hari yang sama. Rantai pasok pendek = kesegaran maksimal. Jika kamu menerima produk yang tidak segar, hubungi kami dalam 24 jam untuk penggantian gratis.",
    category: "produk",
  },
  {
    q: "Apakah semua produk organik?",
    a: "Tidak semua, tapi kami menandai produk organik dengan badge 'Organik' hijau di kartu produk. Produk organik ditanam tanpa pestisida sintetis dan disertasi dari lembaga organik terpercaya. Produk non-organik masih aman dikonsumsi karena ditanam dengan praktik pertanian yang baik (GAP).",
    category: "produk",
  },
  {
    q: "Bagaimana kebijakan refund dan retur?",
    a: "Jika produk yang kamu terima rusak, busuk, atau tidak sesuai pesanan, hubungi customer service dalam 24 jam dengan foto bukti. Kami akan menggantinya gratis atau refund 100%. Untuk perubahan pikiran, refund berlaku untuk produk kemasan yang belum dibuka dalam 3 hari.",
    category: "produk",
  },
];

interface FaqSectionProps {
  /** DB-driven FAQs. If empty/missing, falls back to hardcoded defaults. */
  faqs?: { id: string; q: string; a: string }[];
  /** Open contact sheet (mobile only — desktop scrolls to #kontak) */
  onOpenContactSheet?: () => void;
}

export function FaqSection({ faqs: dbFaqs, onOpenContactSheet }: FaqSectionProps = {}) {
  // Use DB FAQs if provided and non-empty, else hardcoded defaults.
  // DB FAQs don't have category → default to "pemesanan" so they still render.
  const items: FaqItem[] =
    dbFaqs && dbFaqs.length > 0
      ? dbFaqs.map((f) => ({ q: f.q, a: f.a, category: "pemesanan" as FaqCategory }))
      : FAQ_ITEMS;

  const handleContactClick = () => {
    const el = document.getElementById("kontak");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      id="faq"
      className="scroll-mt-28 border-b border-border/40 bg-secondary/20"
    >
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-24">
        {/* Mobile: compact label (no heading/legend) */}
        <p className="mb-3 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground md:hidden">
          FAQ
        </p>

        {/* Desktop: full heading + legend (hidden on mobile) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5 }}
          className="hidden text-center md:block"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <HelpCircle className="h-3.5 w-3.5" />
            Pusat Bantuan
          </span>
          <h2 className="font-display mt-4 text-3xl font-extrabold tracking-tight text-balance md:text-5xl">
            Pertanyaan yang{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              Sering Ditanyakan
            </span>
          </h2>
          <p className="mt-4 text-base text-foreground/80 md:text-lg text-balance">
            Belum nemu jawabannya? Tim kami siap bantu di section Kontak di bawah.
          </p>

          {/* Category legend — quick visual key for the 4 categories */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
          >
            {Object.values(CATEGORY_META).map((cat) => (
              <span
                key={cat.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/50"
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", cat.accent)} />
                {cat.label}
              </span>
            ))}
          </motion.div>
        </motion.div>

        {/* Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-3 md:mt-10"
        >
          <Accordion type="single" collapsible className="space-y-2.5">
            {/* Mobile: top 5 items only. Desktop: all items */}
            {(typeof window !== 'undefined' && window.innerWidth < 768 ? items.slice(0, 5) : items).map((item, i) => {
              const cat = CATEGORY_META[item.category];
              const CatIcon = cat.icon;
              return (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-muted px-5 ring-1 ring-border shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(0,0,0,0.18)] transition-all duration-300 data-[state=open]:shadow-[0_4px_12px_rgba(0,0,0,0.08),0_16px_40px_-8px_rgba(0,0,0,0.24)] data-[state=open]:ring-primary/30"
                >
                  {/* Solid colored left accent — category color, full height */}
                  <div className={cn("absolute inset-y-0 left-0 w-1", cat.accent)} />

                  <AccordionTrigger className="py-4 pl-3 text-left text-[15px] font-semibold hover:no-underline items-center gap-3">
                    {/* Category icon — colored, matches accent bar, bigger for visibility */}
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset shadow-sm",
                        item.category === "pemesanan" && "bg-primary/15 text-primary ring-primary/20",
                        item.category === "pengiriman" && "bg-cyan-500/15 text-cyan-600 ring-cyan-500/20",
                        item.category === "pembayaran" && "bg-amber-500/15 text-amber-600 ring-amber-500/20",
                        item.category === "produk" && "bg-orange-500/15 text-orange-600 ring-orange-500/20"
                      )}
                    >
                      <CatIcon className="h-5 w-5" />
                    </span>
                    <span className="flex-1 pr-2 leading-snug">{item.q}</span>
                  </AccordionTrigger>

                  <AccordionContent className="pb-5 pl-12 pr-0 pt-0 text-sm text-foreground/80 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </motion.div>

        {/* Mobile: compact single-line CS button */}
        <button
          onClick={() => {
            if (onOpenContactSheet && window.innerWidth < 768) {
              onOpenContactSheet();
            } else {
              handleContactClick();
            }
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-card via-card to-muted/50 px-4 py-3 text-sm font-bold text-primary ring-1 ring-border shadow-sm active:scale-[0.99] transition-all md:hidden"
        >
          <MessageCircleQuestion className="h-4 w-4" />
          Masih ada pertanyaan? Hubungi CS
        </button>

        {/* Desktop: full CTA card (hidden on mobile) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="hidden md:block group relative mt-10 flex-col items-center gap-3 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-card p-6 text-center ring-1 ring-primary/20 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.15)] md:flex"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary ring-1 ring-inset ring-primary/20">
            <MessageCircleQuestion className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Masih ada pertanyaan?</h3>
            <p className="mt-1 text-sm text-foreground/70 max-w-sm">
              Tim customer service kami siap membantu 7 hari seminggu (08.00–21.00 WIB)
            </p>
          </div>
          <Button
            onClick={() => {
              if (onOpenContactSheet && window.innerWidth < 768) {
                onOpenContactSheet();
              } else {
                handleContactClick();
              }
            }}
            className="mt-2 rounded-full px-6 shadow-md transition-transform hover:scale-105"
          >
            Hubungi Kami
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
