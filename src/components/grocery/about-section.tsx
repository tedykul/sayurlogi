"use client";

import { motion } from "framer-motion";
import { Sprout, Handshake, Truck, Leaf, Users, Clock, Award, Heart } from "lucide-react";

interface AboutContent {
  aboutBadge: string | null;
  aboutTitleA: string | null;
  aboutTitleHighlight: string | null;
  aboutTitleB: string | null;
  aboutSubtitle: string | null;
  aboutStoryH3: string | null;
  aboutStoryP1: string | null;
  aboutStoryP2: string | null;
  aboutStat1Value: string | null;
  aboutStat1Label: string | null;
  aboutStat2Value: string | null;
  aboutStat2Label: string | null;
  aboutStat3Value: string | null;
  aboutStat3Label: string | null;
  aboutStat4Value: string | null;
  aboutStat4Label: string | null;
  aboutValue1Title: string | null;
  aboutValue1Desc: string | null;
  aboutValue2Title: string | null;
  aboutValue2Desc: string | null;
  aboutValue3Title: string | null;
  aboutValue3Desc: string | null;
  aboutValue4Title: string | null;
  aboutValue4Desc: string | null;
}

interface AboutSectionProps {
  content?: Partial<AboutContent>;
}

// ============================================================
// Section "Tentang SayurLogi" — clean single-column layout.
// ============================================================
// Robust layout (no 2-col grid that can break):
//   1. Heading (centered)
//   2. Story card (centered, max-w-3xl)
//   3. Stats grid (4 cards)
//   4. Values grid (4 cards)
// ============================================================

export function AboutSection({ content }: AboutSectionProps = {}) {
  const c = content || {};

  const stats = [
    { icon: Users, value: c.aboutStat1Value ?? "5.000+", label: c.aboutStat1Label ?? "Pelanggan Bahagia" },
    { icon: Sprout, value: c.aboutStat2Value ?? "120+", label: c.aboutStat2Label ?? "Petani Mitra" },
    { icon: Truck, value: c.aboutStat3Value ?? "15", label: c.aboutStat3Label ?? "Kota Terjangkau" },
    { icon: Award, value: c.aboutStat4Value ?? "4.9/5", label: c.aboutStat4Label ?? "Rating Pengguna" },
  ];

  const values = [
    { icon: Leaf, title: c.aboutValue1Title ?? "Segar dari Kebun", desc: c.aboutValue1Desc ?? "Dipetik pagi hari, dikirim langsung tanpa middle-man." },
    { icon: Handshake, title: c.aboutValue2Title ?? "Harga Adil untuk Petani", desc: c.aboutValue2Desc ?? "Kami bayar petani dengan harga layak, tanpa eksploitasi." },
    { icon: Heart, title: c.aboutValue3Title ?? "100% Organik Pilihan", desc: c.aboutValue3Desc ?? "Sayuran organik tanpa pestisida, sehat untuk keluarga." },
    { icon: Clock, title: c.aboutValue4Title ?? "Antar 2 Jam", desc: c.aboutValue4Desc ?? "Rantai pasok pendek = kesegaran terjaga maksimal." },
  ];

  return (
    <section
      id="tentang"
      className="scroll-mt-24 border-y border-border/40 bg-gradient-to-b from-primary/5 via-background to-background"
    >
      <div className="mx-auto max-w-5xl px-4 py-7 md:py-20">
        {/* Heading — centered, single column */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            <Sprout className="h-3.5 w-3.5" />
            {c.aboutBadge ?? "Cerita Kami"}
          </span>
          <h2 className="mt-4 text-2xl font-extrabold leading-tight tracking-tight md:text-4xl">
            <span className="text-muted-foreground">{c.aboutTitleA ?? "Dari Kebun Petani,"}</span>{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-transparent">
              {c.aboutTitleHighlight ?? "Langsung ke Meja Makan"}
            </span>{" "}
            <span>{c.aboutTitleB ?? "Keluargamu"}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
            {c.aboutSubtitle ?? "SayurLogi lahir dari kepedulian pada petani Indonesia. Kami menghubungkan petani lokal langsung dengan konsumen — tanpa perantara, tanpa bahan kimia, dengan harga yang adil."}
          </p>
        </motion.div>

        {/* Story card — centered, single column, max-w-3xl */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-8 max-w-3xl md:mt-12"
        >
          <div className="rounded-2xl border border-border/60 bg-card p-5 md:p-8">
            <h3 className="flex items-center justify-center gap-2 text-lg font-bold md:text-xl">
              <Sprout className="h-5 w-5 text-primary" />
              {c.aboutStoryH3 ?? "Misi Kami"}
            </h3>
            <p className="mt-3 text-center text-sm text-muted-foreground leading-relaxed md:text-[15px]">
              {c.aboutStoryP1 ?? "Indonesia negara agraris yang kaya. Tapi banyak petani masih kesulitan menjual hasil panen dengan harga layak. Sementara konsumen kota sulit mendapat sayur & buah segar."}
            </p>
            <div className="my-4 border-l-2 border-primary pl-4">
              <p className="text-sm font-semibold italic text-foreground">
                "Petani mendapat harga adil, konsumen mendapat produk segar. Win-win untuk semua."
              </p>
            </div>
            <p className="text-center text-sm text-muted-foreground leading-relaxed md:text-[15px]">
              {c.aboutStoryP2 ?? "SayurLogi menjembatani kedua pihak. Petani mendapat harga adil, konsumen mendapat produk segar dengan harga jujur."}
            </p>
          </div>
        </motion.div>

        {/* Stats grid — 4 cards, single render */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-8 grid grid-cols-2 gap-3 md:mt-12 md:grid-cols-4 md:gap-4"
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-4 text-center"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
              <span className="bg-gradient-to-r from-primary to-emerald-500 bg-clip-text text-xl font-extrabold text-transparent md:text-2xl">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground md:text-xs">{stat.label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Values grid — 4 cards */}
        <div className="mt-8 md:mt-12">
          <motion.h3
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="mb-4 text-center text-lg font-bold md:mb-6 md:text-xl"
          >
            Nilai yang Kami Pegang
          </motion.h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {values.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <value.icon className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold">{value.title}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{value.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
