import { db } from "@/lib/db";

// ============================================================
// Seed script — populate admin-editable content with existing
// hardcoded values. Run once via: bun run db:seed
// Safe to re-run (upsert pattern — won't duplicate, will update).
// ============================================================

async function main() {
  console.log("🌱 Seeding admin-editable content...");

  // 1. SiteSetting (singleton)
  const setting = await db.siteSetting.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      // Hero
      heroBadge: "Dipetik pagi, sampai rumah siang",
      heroTitleA: "Sayur & Buah",
      heroTitleHighlight: "Segar Harian",
      heroTitleB: "dari Petani Lokal",
      heroSubtitle:
        "Belanja sayuran organik dan buah-buahan pilihan langsung dari kebun. Tanpa perantara, harga jujur, kualitas terjamin.",
      heroCtaPrimary: "Mulai Belanja",
      heroCtaSecondary: "Lihat Promo",
      // Promo
      promoId: "promo-akhir-pekan-v1",
      promoTitle: "Promo Akhir Pekan!",
      promoDescription:
        "Diskon hingga 25% untuk semua sayuran organik. Berlaku sampai akhir minggu.",
      // Contact
      contactPhone: "0800-1234-5678",
      contactEmail: "halo@sayurbox.id",
      contactAddress: "Jl. Petani Sejahtera No. 88, Jakarta Selatan",
      contactHours: "Setiap hari, 08.00 - 21.00 WIB",
      // About
      aboutBadge: "Tentang Kami",
      aboutTitleA: "Dari Kebun Petani,",
      aboutTitleHighlight: "Langsung ke Meja Makan",
      aboutTitleB: "Keluargamu",
      aboutSubtitle:
        "SayurBox lahir dari kepedulian pada petani Indonesia. Kami menghubungkan petani lokal langsung dengan konsumen — tanpa perantara, tanpa bahan kimia, dengan harga yang adil untuk semua pihak.",
      aboutStoryH3: "Misi Kami 🌱",
      aboutStoryP1:
        "Indonesia adalah negara agraris yang kaya, tapi banyak petani masih kesulitan menjual hasil panen dengan harga layak. Sementara itu, konsumen kota sulit mendapatkan sayur & buah benar-benar segar.",
      aboutStoryP2:
        "SayurBox menjembatani kedua pihak: petani mendapat harga adil, konsumen mendapat produk segar dengan harga jujur. Win-win untuk semua.",
      aboutStat1Value: "5.000+",
      aboutStat1Label: "Pelanggan Bahagia",
      aboutStat2Value: "120+",
      aboutStat2Label: "Petani Mitra",
      aboutStat3Value: "15",
      aboutStat3Label: "Kota Terjangkau",
      aboutStat4Value: "4.9/5",
      aboutStat4Label: "Rating Pengguna",
      aboutValue1Title: "Segar dari Kebun",
      aboutValue1Desc:
        "Dipetik pagi hari, dikirim langsung tanpa middle-man. Kualitas terjaga, nutrisi maksimal.",
      aboutValue2Title: "Harga Adil untuk Petani",
      aboutValue2Desc:
        "Kami bayar petani dengan harga layak. Tanpa eksploitasi, hubungan jangka panjang yang saling menguntungkan.",
      aboutValue3Title: "100% Organik Pilihan",
      aboutValue3Desc:
        "Sayuran organik tanpa pestisida. Sehat untuk keluarga, ramah untuk bumi.",
      aboutValue4Title: "Antar 2 Jam",
      aboutValue4Desc:
        "Pesan sekarang, sampai siang. Rantai pasok pendek = kesegaran terjaga maksimal.",
      // Footer
      footerBrandText:
        "Marketplace sayur & buah segar langsung dari petani lokal. Mendukung ekonomi petani Indonesia.",
      footerTagline: "Sayur & Buah Segar",
      // Branding (Sprint 11)
      brandName: "SayurBox",
      metaDescription:
        "Belanja sayuran dan buah segar langsung dari petani lokal. Antar cepat, kualitas terjamin. Terintegrasi dengan ERPNext.",
      socialInstagram: null,
      socialFacebook: null,
      socialTwitter: null,
      socialTiktok: null,
      socialWhatsapp: null,
    },
  });
  console.log("  ✓ SiteSetting seeded:", setting.id);

  // 2. FAQs
  const faqs: { q: string; a: string }[] = [
    {
      q: "Bagaimana cara memesan di SayurBox?",
      a: "Pilih produk yang kamu inginkan, klik 'Tambah' untuk masuk keranjang. Setelah selesai, klik ikon keranjang lalu 'Checkout Sekarang'. Isi data pengiriman, pilih metode pembayaran, lalu 'Buat Pesanan'. Pesanan akan diproses dan dikirim sesuai jadwal pengiriman yang dipilih.",
    },
    {
      q: "Berapa lama waktu pengiriman?",
      a: "Kami mengantarkan pesanan dalam waktu 2-4 jam untuk wilayah kota metropolitan. Untuk pengiriman di luar kota, estimasi 1-2 hari kerja. Kamu akan menerima notifikasi via WhatsApp/email ketika pesanan sedang dalam perjalanan.",
    },
    {
      q: "Apakah ada minimum order?",
      a: "Tidak ada minimum order! Tapi untuk mendapatkan gratis ongkir, belanja minimal Rp50.000. Di bawah nominal tersebut, ongkir flat Rp9.000 berlaku untuk wilayah kota.",
    },
    {
      q: "Metode pembayaran apa saja yang tersedia?",
      a: "Kami menerima 3 metode pembayaran: (1) COD — bayar tunai di tempat saat pesanan tiba, (2) Transfer bank (BCA, Mandiri, BNI, BRI), dan (3) E-Wallet (GoPay, OVO, DANA, ShopeePay). Semua transaksi aman dan terenkripsi.",
    },
    {
      q: "Apakah sayuran & buah benar-benar segar?",
      a: "Ya! Semua produk dipetik langsung dari kebun petani mitra pada pagi hari, lalu dikirim ke gudang kami untuk quality check, dan diteruskan ke konsumen di hari yang sama. Rantai pasok pendek = kesegaran maksimal. Jika kamu menerima produk yang tidak segar, hubungi kami dalam 24 jam untuk penggantian gratis.",
    },
    {
      q: "Apakah semua produk organik?",
      a: "Tidak semua, tapi kami menandai produk organik dengan badge 'Organik' hijau di kartu produk. Produk organik ditanam tanpa pestisida sintetis dan disertasi dari lembaga organik terpercaya. Produk non-organik masih aman dikonsumsi karena ditanam dengan praktik pertanian yang baik (GAP).",
    },
    {
      q: "Bagaimana kebijakan refund dan retur?",
      a: "Jika produk yang kamu terima rusak, busuk, atau tidak sesuai pesanan, hubungi customer service dalam 24 jam dengan foto bukti. Kami akan menggantikan gratis atau refund 100%. Untuk perubahan pikiran, refund berlaku untuk produk kemasan yang belum dibuka dalam 3 hari.",
    },
    {
      q: "Bisakah saya jadwalkan pengiriman untuk hari tertentu?",
      a: "Ya! Saat checkout, pilih tanggal & slot waktu pengiriman yang kamu inginkan (pagi 09-12, siang 12-15, sore 15-18, atau malam 18-21). Cocok untuk yang ingin pesan sayur untuk masak akhir pekan atau kebutuhan kantin harian.",
    },
  ];
  for (let i = 0; i < faqs.length; i++) {
    await db.fAQ.upsert({
      where: { id: `seed-faq-${i}` },
      update: { question: faqs[i].q, answer: faqs[i].a, order: i },
      create: {
        id: `seed-faq-${i}`,
        question: faqs[i].q,
        answer: faqs[i].a,
        order: i,
        published: true,
      },
    });
  }
  console.log(`  ✓ ${faqs.length} FAQs seeded`);

  // 3. Testimonials
  const testimonials = [
    {
      name: "Dewi Lestari",
      role: "Ibu Rumah Tangga",
      avatar: "👩",
      rating: 5,
      text: "Sayurannya benar-benar segar! Bayam yang saya pesan masih hijau cerah dan renyah, beda banget sama yang di pasar. Pengiriman juga cepat, pesan pagi sampai siang.",
      location: "Jakarta Selatan",
    },
    {
      name: "Andi Pratama",
      role: "Chef Restoran",
      avatar: "👨‍🍳",
      rating: 5,
      text: "Sebagai chef, kualitas bahan adalah segalanya. SayurBox jadi supplier utama restoran saya. Tomatnya ranum, herbs-nya harum, dan harganya bersaing dengan pasar tradisional.",
      location: "Bandung",
    },
    {
      name: "Siti Nurhaliza",
      role: "Pegawai Kantoran",
      avatar: "👩‍💼",
      rating: 5,
      text: "Praktis banget! Tinggal pesan dari HP, sampai rumah langsung. Paket hemat mingguan jadi solusi untuk masak harian tanpa repot ke pasar setiap hari.",
      location: "Tangerang",
    },
    {
      name: "Budi Santoso",
      role: "Ayah 2 Anak",
      avatar: "👨",
      rating: 4.5,
      text: "Anak-anak saya jadi doyan sayur karena SayurBox. Buahnya manis-manis, sayurnya segar. Customer service-nya juga responsif. Recommended!",
      location: "Depok",
    },
    {
      name: "Rina Marlina",
      role: "Food Blogger",
      avatar: "👩‍🎨",
      rating: 5,
      text: "Saya review banyak grocery store, SayurBox salah satu yang terbaik. Transparan soal asal produk, organik certification jelas. Worth every rupiah!",
      location: "Bekasi",
    },
    {
      name: "Hendra Wijaya",
      role: "Fitness Enthusiast",
      avatar: "🏃",
      rating: 5,
      text: "Paket juice cleanse-nya jadi favorit. Sayur & buah organik, dipetik segar, langsung sampai. Diet sehat jadi lebih mudah dan terjangkau.",
      location: "Jakarta Pusat",
    },
  ];
  for (let i = 0; i < testimonials.length; i++) {
    await db.testimonial.upsert({
      where: { id: `seed-testimonial-${i}` },
      update: { ...testimonials[i], order: i },
      create: {
        id: `seed-testimonial-${i}`,
        ...testimonials[i],
        order: i,
        published: true,
      },
    });
  }
  console.log(`  ✓ ${testimonials.length} testimonials seeded`);

  // 4. CategorySettings
  const categories = [
    {
      name: "Sayuran",
      emoji: "🥬",
      description: "Sayuran segar langsung dari kebun petani lokal",
      gradient: "from-green-400 to-emerald-600",
    },
    {
      name: "Buah",
      emoji: "🍎",
      description: "Buah-buahan segar pilihan dengan kualitas premium",
      gradient: "from-rose-400 to-red-600",
    },
    {
      name: "Herbal",
      emoji: "🌿",
      description: "Rempah dan tanaman herbal untuk dapur & kesehatan",
      gradient: "from-lime-400 to-green-600",
    },
    {
      name: "Paket",
      emoji: "🧺",
      description: "Paket sayur & buah mingguan dengan harga hemat",
      gradient: "from-amber-400 to-orange-600",
    },
  ];
  for (let i = 0; i < categories.length; i++) {
    await db.categorySetting.upsert({
      where: { name: categories[i].name },
      update: { ...categories[i], order: i },
      create: {
        ...categories[i],
        order: i,
        published: true,
      },
    });
  }
  console.log(`  ✓ ${categories.length} categories seeded`);

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
