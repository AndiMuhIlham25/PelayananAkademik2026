# Website Pengaduan FT UNTAD + Google Sheets + Email Notification

Versi ini mendukung:
- Mahasiswa
- Dosen
- Operator Prodi
- Tenaga Kependidikan

Data akan tersimpan ke Google Sheets dan setiap aduan baru akan mengirim notifikasi email ke:

akademikfatek2025@gmail.com

## File

- index.html
- Code.gs
- README.txt

## Penting soal Spreadsheet di email akademik

Saya tidak bisa langsung membuat Google Spreadsheet di akun akademikfatek2025@gmail.com dari sini, karena pembuatan file Google Sheets harus dilakukan dari akun Google yang sedang login.

Agar spreadsheet benar-benar ada di email akademikfatek2025@gmail.com, lakukan salah satu:

Pilihan terbaik:
1. Login Google menggunakan akademikfatek2025@gmail.com
2. Buat Google Spreadsheet dari akun itu
3. Pasang Apps Script dari file Code.gs
4. Deploy Web App

Pilihan kedua:
1. Buat spreadsheet dari akun kamu
2. Klik Share
3. Tambahkan akademikfatek2025@gmail.com sebagai Editor
4. Centang Notify people jika ingin email akademik dapat notifikasi share

## Cara Koneksi

1. Buat Google Spreadsheet baru.
2. Rename tab/sheet menjadi: Aduan
3. Buka Extensions > Apps Script.
4. Hapus kode default.
5. Copy isi file Code.gs lalu paste ke Apps Script.
6. Klik Save.
7. Klik Deploy > New deployment.
8. Pilih type: Web app.
9. Isi:
   - Execute as: Me
   - Who has access: Anyone
10. Klik Deploy.
11. Izinkan permission Google.
12. Copy Web app URL.
13. Buka index.html di editor.
14. Cari:
   const GOOGLE_SCRIPT_URL = "PASTE_URL_WEB_APP_GOOGLE_APPS_SCRIPT_DI_SINI";
15. Ganti dengan URL Web App tadi.
16. Simpan index.html.
17. Buka index.html di browser dan coba kirim aduan.

## Kolom Spreadsheet

- Timestamp
- Kode Aduan / Identitas
- Nama Lengkap
- Status Pelapor
- Jenis Identitas
- Nomor Identitas
- Kontak WA / Email
- Program Studi / Unit
- Kategori Aduan
- Prioritas
- Judul Aduan
- Detail Permasalahan
- Status Aduan
- Catatan Operator
- User Agent

## Notifikasi Email

Setiap submit berhasil, sistem mengirim email ke:

akademikfatek2025@gmail.com

Isi email:
- Nama pelapor
- Status pelapor
- Identitas
- Kontak
- Prodi/unit
- Kategori
- Prioritas
- Judul
- Detail masalah
- Link Spreadsheet

## Catatan

Kalau notifikasi email tidak masuk:
- Pastikan Apps Script dideploy dengan permission benar.
- Pastikan Execute as: Me.
- Pastikan akun Google mengizinkan MailApp saat proses deploy.
- Cek folder Spam/Promotions.
- Cek kuota email Google Apps Script.


UPDATE TERBARU:
- Dashboard membaca data dari Spreadsheet lewat ?action=list.
- Kalau Spreadsheet kosong, tampilan dashboard akan 0 dan tabel kosong.
- Status pelayanan otomatis terbuka 08.00 WITA dan tertutup 16.00 WITA.
