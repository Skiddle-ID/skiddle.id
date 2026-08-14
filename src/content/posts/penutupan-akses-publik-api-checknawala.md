---
title: "Penutupan Akses Publik API Checknawala"
description: "500M req/mo sunset - why the public API closed and the supporter path forward."
pubDate: 2025-11-23T15:37:40.144Z
updatedDate: 2025-11-24T00:00:00.000Z
category: infra
tags: [api, trustpositif, checknawala]
cover: ./cover-checknawala.png
featured: true
series: checkdomain
order: 2
rkey: 3m6cn7p77of2o
draft: false
---

Selama beberapa tahun terakhir, saya menyediakan API gratis di Skiddle.id agar dapat digunakan siapa saja tanpa batas. Awalnya, API ini hanya menerima sekitar **2-5 juta permintaan per bulan**, dan itu masih bisa saya tangani sendiri.

Namun dalam beberapa bulan terakhir, jumlah permintaan melonjak sangat tinggi hingga mencapai **500 juta permintaan per bulan**. Beban dan biayanya menjadi terlalu besar untuk saya tanggung sebagai layanan gratis yang saya danai pribadi.

## Masalah Penyalahgunaan

Setelah saya melakukan pengecekan lebih dalam, saya menemukan bahwa lonjakan trafik ini banyak berasal dari pihak-pihak yang menggunakan API gratis ini untuk **layanan berbayar** mereka. Ada juga aktivitas abuse dan beberapa serangan DDoS, yang membuat saya harus terus menambah kapasitas server.

Pada titik ini, layanan sudah tidak lagi memungkinkan untuk dipertahankan sebagai API publik gratis.

## Keputusan Menutup Akses Publik

Karena alasan-alasan tersebut, saya memutuskan untuk **menutup akses publik API Skiddle**.
Saat ini, hanya beberapa orang tertentu yang tetap memiliki akses terbatas.

Layanan pengecekan domain di:
**https://nawalacheck.skiddle.id/**
masih dapat digunakan sementara, tetapi juga akan **ditutup permanen pada 31 Desember 2025**.

Saya memahami bahwa ini mungkin mengecewakan sebagian pengguna, namun dalam kondisi seperti sekarang, keputusan ini tidak dapat dihindari.

---

## Langkah Selanjutnya

Dalam waktu dekat saya akan:

- Menawarkan **akses API versi terbatas** bagi mereka yang memberikan dukungan melalui **GitHub Support**.

Jika Anda ingin tetap menggunakan API ini, silakan **dukung proyek ini di GitHub**. Akses terbatas akan diberikan secara prioritas kepada para supporter, dan semua detail mengenai aturan penggunaan akan dijelaskan di **Supporter Hub Repository**.

---

## Catatan untuk GitHub Supporter

Untuk semua **GitHub Supporter** yang mungkin terdampak oleh pemblokiran otomatis:
Jika akses Anda ikut terblokir, **silakan ajukan kembali permintaan akses**. Saya akan memprosesnya dengan prioritas.

Ke depan, saya juga akan menerapkan **batasan (limit) pada semua request API**, termasuk untuk supporter. Detail lengkapnya akan tersedia di **Supporter Hub Repository**.

Terima kasih atas semua dukungan kalian sejauh ini. Tanpa dukungan tersebut, proyek ini tidak akan bisa bertahan dalam kondisi yang lebih stabil dan terkontrol.
