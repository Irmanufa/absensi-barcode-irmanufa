// ============================================
// IRMANUFA QR ABSENSI - SCRIPT UTAMA
// VERSI FINAL - DOWNLOAD TIDAK TERPOTONG
// ============================================

const CONFIG = {
  STORAGE_KEYS: {
    AUTH: "irmanufa_auth",
    AUTH_USER: "irmanufa_auth_user",
    MEMBERS: "irmanufa_members",
    ATTENDANCE: "irmanufa_attendance",
    KEGIATAN: "irmanufa_kegiatan",
  },
  USERS: {
    admin: { username: "admin", password: "admin123", name: "Admin IRMANUFA", role: "Super Admin" },
    tasya: { username: "tasya", password: "tasya123", name: "Tasya Amelia Putri", role: "Sekretaris I" },
    lidya: { username: "lidya", password: "lidya123", name: "Lidya Febrianti", role: "Sekretaris II" }
  }
};

const CHART_COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#1A535C", "#FF9F1C", "#9B5DE5", "#00BBF9", "#F15BB5", "#00F5D4", "#FEE440"];

let AppState = {
  members: [],
  attendance: [],
  activeSection: "dashboard",
  qrScanner: null,
  attendanceChart: null,
  divisionChart: null,
  currentQRMember: null,
  currentQRCanvas: null,
  lastScanTime: 0,
  currentFlashStatus: false,
  currentKegiatan: "",
  currentUser: null
};

// ==================== SOUND PLAYER ====================
function playSound(soundName) {
  try {
    const audio = new Audio(soundName);
    audio.volume = 0.8;
    audio.play().catch(e => console.log("Audio error:", e));
  } catch (e) { console.log("Sound error:", e); }
}

// ==================== TOAST ====================
const Toast = {
  container: null,
  init() {
    if (this.container) return;
    this.container = document.createElement("div");
    this.container.className = "toast-container";
    document.body.appendChild(this.container);
  },
  show(message, type = "info", title = "") {
    this.init();
    const titles = { success: "✓ Berhasil!", error: "✗ Gagal!", warning: "⚠ Peringatan!", info: "ℹ Informasi" };
    const icons = { success: "fa-check-circle", error: "fa-exclamation-circle", warning: "fa-exclamation-triangle", info: "fa-info-circle" };
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><div class="toast-content"><div class="toast-title">${title || titles[type]}</div><div class="toast-message">${message}</div></div><button class="toast-close">&times;</button>`;
    toast.querySelector(".toast-close").onclick = () => toast.remove();
    this.container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  },
  success(msg, title = "") { this.show(msg, "success", title); },
  error(msg, title = "") { this.show(msg, "error", title); },
  warning(msg, title = "") { this.show(msg, "warning", title); },
  info(msg, title = "") { this.show(msg, "info", title); }
};

// ==================== LOAD DATA ====================
function loadData() {
  let storedMembers = localStorage.getItem(CONFIG.STORAGE_KEYS.MEMBERS);
  if (!storedMembers || storedMembers === "[]") {
    if (typeof IRMANUFA_DATA !== 'undefined' && IRMANUFA_DATA.members) {
      AppState.members = IRMANUFA_DATA.members.map((m, idx) => ({
        id: String(idx + 1), code: m.code, name: m.name, gender: m.gender,
        position: m.position || "Anggota", division: m.division, status: m.status,
      }));
      localStorage.setItem(CONFIG.STORAGE_KEYS.MEMBERS, JSON.stringify(AppState.members));
    } else {
      AppState.members = [];
    }
  } else {
    AppState.members = JSON.parse(storedMembers);
  }
  let storedAttendance = localStorage.getItem(CONFIG.STORAGE_KEYS.ATTENDANCE);
  AppState.attendance = storedAttendance ? JSON.parse(storedAttendance) : [];
  
  const savedKegiatan = localStorage.getItem(CONFIG.STORAGE_KEYS.KEGIATAN);
  AppState.currentKegiatan = savedKegiatan || "Rapat Koordinasi IRMANUFA";
}

function saveMembers() { localStorage.setItem(CONFIG.STORAGE_KEYS.MEMBERS, JSON.stringify(AppState.members)); }
function saveAttendance() { localStorage.setItem(CONFIG.STORAGE_KEYS.ATTENDANCE, JSON.stringify(AppState.attendance)); }
function saveKegiatan(kegiatan) { AppState.currentKegiatan = kegiatan; localStorage.setItem(CONFIG.STORAGE_KEYS.KEGIATAN, kegiatan); }

// ==================== HELPER FUNCTIONS ====================
function formatDate(date = new Date()) {
  return date.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function formatDateShort(date = new Date()) {
  return date.toLocaleDateString("id-ID", { year: "numeric", month: "numeric", day: "numeric" });
}
function formatTime(date = new Date()) {
  return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function getMemberById(id) { return AppState.members.find(m => m.id === id); }
function getMemberByCode(code) { return AppState.members.find(m => m.code === code); }
function isAlreadyAttended(memberId) {
  const today = new Date().toDateString();
  return AppState.attendance.some(a => a.memberId === memberId && new Date(a.timestamp).toDateString() === today);
}
function getGenderText(gender) { return gender === "L" ? "Laki-laki" : "Perempuan"; }

// ==================== ATTENDANCE ====================
function recordAttendance(memberId, method = "qr") {
  const member = getMemberById(memberId);
  if (!member) { Toast.error("Anggota tidak ditemukan!"); playSound("takkenal.mp3"); return false; }
  if (member.status !== "active") { Toast.warning(`${member.name} adalah anggota PASIF!`); playSound("takkenal.mp3"); return false; }
  if (isAlreadyAttended(memberId)) { Toast.warning(`${member.name} sudah absen hari ini!`); playSound("sudah.mp3"); return false; }

  const attendance = {
    id: Date.now(), memberId: member.id, memberCode: member.code, memberName: member.name,
    memberGender: member.gender, division: member.division, position: member.position,
    timestamp: new Date().toISOString(), date: formatDate(), dateShort: formatDateShort(),
    time: formatTime(), method: method, kegiatan: AppState.currentKegiatan,
  };
  AppState.attendance.push(attendance);
  saveAttendance();
  updateAllDisplays();
  playSound("berhasil.mp3");
  Toast.success(`${member.name} berhasil absen!`, "Absensi Berhasil");
  renderTodayScanHistory();
  return true;
}

// ==================== TABEL HASIL SCAN HARI INI ====================
function renderTodayScanHistory() {
  const container = document.getElementById("todayScanHistory");
  if (!container) return;
  
  const today = new Date().toDateString();
  const todayAttendance = AppState.attendance.filter(a => new Date(a.timestamp).toDateString() === today);
  
  if (todayAttendance.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Belum ada scan hari ini</p></div>';
    return;
  }
  
  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width:100%; border-collapse: collapse;">
        <thead><tr style="background: #f1f5f9;"><th style="padding: 10px;">No</th><th style="padding: 10px;">Nama</th><th style="padding: 10px;">Divisi</th><th style="padding: 10px;">Waktu</th><th style="padding: 10px;">Aksi</th></tr></thead>
        <tbody>
          ${todayAttendance.map((a, i) => `<tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px;">${i+1}</td>
              <td style="padding: 10px;"><strong>${a.memberName}</strong></td>
              <td style="padding: 10px;">${a.division}</td>
              <td style="padding: 10px;">${a.time}</td>
              <td style="padding: 10px;">
                <button class="btn btn-warning btn-sm" onclick="editAttendanceById(${a.id})" style="padding: 4px 8px; margin-right: 5px;"><i class="fas fa-edit"></i> Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteAttendanceById(${a.id})" style="padding: 4px 8px;"><i class="fas fa-trash"></i> Hapus</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function editAttendanceById(attendanceId) {
  const attendance = AppState.attendance.find(a => a.id == attendanceId);
  if (!attendance) return;
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3><i class="fas fa-edit"></i> Edit Data Absensi</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div>
      <div class="input-group"><label>Nama</label><input type="text" value="${attendance.memberName}" disabled style="background:#f1f5f9;"></div>
      <div class="input-group"><label>Divisi</label><input type="text" value="${attendance.division}" disabled></div>
      <div class="input-group"><label>Waktu</label><input type="time" id="editTime" value="${attendance.time}"></div>
      <div class="input-group"><label>Tanggal</label><input type="date" id="editDate" value="${attendance.dateShort.split("/").reverse().join("-")}"></div>
      <div class="input-group"><label>Kegiatan</label><input type="text" id="editKegiatan" value="${attendance.kegiatan || AppState.currentKegiatan}"></div>
      <div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-primary" onclick="saveEditAttendance(${attendance.id})">Simpan</button></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveEditAttendance(id) {
  const newTime = document.getElementById("editTime")?.value;
  const newDate = document.getElementById("editDate")?.value;
  const newKegiatan = document.getElementById("editKegiatan")?.value;
  const index = AppState.attendance.findIndex(a => a.id == id);
  if (index !== -1) {
    if (newDate) { const d = new Date(newDate); AppState.attendance[index].date = formatDate(d); AppState.attendance[index].dateShort = formatDateShort(d); AppState.attendance[index].timestamp = d.toISOString(); }
    if (newTime) AppState.attendance[index].time = newTime;
    if (newKegiatan) AppState.attendance[index].kegiatan = newKegiatan;
    saveAttendance(); updateAllDisplays(); renderTodayScanHistory(); Toast.success("Data diupdate!");
  }
  document.querySelector(".modal-overlay")?.remove();
}

function deleteAttendanceById(id) {
  showConfirmModal("Hapus Data", "Yakin hapus data ini?", () => {
    AppState.attendance = AppState.attendance.filter(a => a.id != id);
    saveAttendance(); updateAllDisplays(); renderTodayScanHistory(); Toast.success("Data dihapus!");
  });
}

// ==================== QR SCANNER ====================
async function startScanner() {
  const container = document.getElementById("reader");
  if (!container) return;
  if (AppState.qrScanner) { try { await AppState.qrScanner.stop(); AppState.qrScanner = null; } catch(e) {} }
  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memulai kamera...</p></div>';
  const html5QrCode = new Html5Qrcode("reader");
  AppState.qrScanner = html5QrCode;
  html5QrCode.start({ facingMode: "environment" }, { fps: 30, qrbox: { width: 250, height: 250 } }, (decodedText) => {
    const now = Date.now();
    if (now - AppState.lastScanTime < 2000) return;
    AppState.lastScanTime = now;
    let member = null;
    try { const qrData = JSON.parse(decodedText); member = getMemberByCode(qrData.code); } catch(e) { member = getMemberByCode(decodedText); }
    if (member) {
      if (member.status === "active") {
        if (!isAlreadyAttended(member.id)) recordAttendance(member.id, "qr");
        else { Toast.warning(`${member.name} sudah absen!`); playSound("sudah.mp3"); }
      } else { Toast.warning(`${member.name} anggota PASIF!`); playSound("takkenal.mp3"); }
    } else { Toast.error("QR Code tidak dikenali!"); playSound("takkenal.mp3"); }
  }).catch(() => {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Gagal akses kamera!</p><button class="btn btn-primary" onclick="startScanner()">Coba Lagi</button></div>';
    Toast.error("Gagal akses kamera!");
  });
}

function stopScanner() {
  if (AppState.qrScanner) { AppState.qrScanner.stop(); AppState.qrScanner = null; AppState.currentFlashStatus = false; document.getElementById("reader").innerHTML = '<div class="empty-state"><i class="fas fa-qrcode"></i><p>Scanner siap. Klik "Mulai Scan"</p></div>'; Toast.info("Scanner dihentikan"); }
}

async function toggleFlash() {
  if (!AppState.qrScanner) { Toast.warning("Scanner belum dimulai!"); return; }
  try {
    const video = document.querySelector("#reader video");
    if (!video) { Toast.warning("Kamera belum aktif!"); return; }
    const stream = video.srcObject;
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities && track.getCapabilities().torch) {
        const newState = !AppState.currentFlashStatus;
        await track.applyConstraints({ advanced: [{ torch: newState }] });
        AppState.currentFlashStatus = newState;
        const btn = document.getElementById("flashToggleBtn");
        if (btn) { btn.classList.toggle("active", newState); btn.innerHTML = `<i class="fas fa-lightbulb"></i> Flash ${newState ? "ON" : "OFF"}`; }
        Toast.info(`Flash ${newState ? "ON" : "OFF"}`);
      } else { Toast.warning("Device tidak support flash!"); }
    }
  } catch(e) { Toast.warning("Gagal flash!"); }
}

// ==================== QR GENERATOR ====================
function updateMemberSelect() {
  const select = document.getElementById("memberSelect");
  if (select) {
    const active = AppState.members.filter(m => m.status === "active");
    select.innerHTML = '<option value="">✨-- Pilih Anggota Aktif --✨</option>' + active.map(m => `<option value="${m.id}">${m.code} - ${m.name} (${m.division})</option>`).join("");
  }
}

function generateMemberQR() {
  const member = getMemberById(document.getElementById("memberSelect")?.value);
  if (!member) { Toast.warning("Pilih anggota dulu!"); return; }
  if (member.status !== "active") { Toast.warning(`Anggota ${member.name} PASIF!`); return; }
  
  const qrContainer = document.getElementById("qrCodeDisplay");
  const infoContainer = document.getElementById("memberInfoDisplay");
  if (!qrContainer) return;
  qrContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Membuat QR...</p></div>';
  
  QRCode.toCanvas(document.createElement("canvas"), JSON.stringify({ code: member.code, name: member.name, gender: member.gender, position: member.position, division: member.division, status: member.status }), { width: 400, margin: 2, color: { dark: "#059669", light: "#ffffff" } }, (err, canvas) => {
    if (err) { qrContainer.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Gagal!</p></div>'; Toast.error("Gagal buat QR!"); return; }
    AppState.currentQRCanvas = canvas;
    AppState.currentQRMember = member;
    qrContainer.innerHTML = "";
    canvas.style.width = "200px";
    canvas.style.height = "200px";
    qrContainer.appendChild(canvas);
    if (infoContainer) {
      infoContainer.innerHTML = `<div class="member-info-card"><h4><i class="fas fa-id-card"></i> DATA DIRI</h4><p><strong>Nama:</strong> ${member.name}</p><p><strong>JK:</strong> ${getGenderText(member.gender)}</p><p><strong>Kode:</strong> ${member.code}</p><p><strong>Jabatan:</strong> ${member.position || "Anggota"}</p><p><strong>Divisi:</strong> ${member.division}</p><p><strong>Status:</strong> <span class="status-badge status-active">AKTIF</span></p></div>`;
    }
    Toast.success(`QR untuk ${member.name} berhasil!`);
  });
}

// ==================== DOWNLOAD QR CODE (TIDAK TERPOTONG) ====================
function downloadQRAsPNG() {
  if (!AppState.currentQRCanvas || !AppState.currentQRMember) { Toast.warning("Generate QR dulu!"); return; }
  
  const member = AppState.currentQRMember;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  // UKURAN BESAR AGAR TIDAK TERPOTONG
  const qrSize = 450;
  const padding = 40;
  const w = qrSize + padding * 2;
  const h = qrSize + 380;
  
  canvas.width = w;
  canvas.height = h;
  
  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  
  // Border
  ctx.strokeStyle = "#059669";
  ctx.lineWidth = 5;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  
  // Header
  ctx.fillStyle = "#059669";
  ctx.fillRect(0, 0, w, 65);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Inter";
  ctx.textAlign = "center";
  ctx.fillText("IRMANUFA QR CODE", w/2, 43);
  
  // QR Code
  ctx.drawImage(AppState.currentQRCanvas, padding, 80, qrSize, qrSize);
  
  // Title
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 20px Inter";
  ctx.fillText("DATA DIRI ANGGOTA", w/2, qrSize + 125);
  
  // Garis
  ctx.beginPath();
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.moveTo(padding, qrSize + 145);
  ctx.lineTo(w - padding, qrSize + 145);
  ctx.stroke();
  
  // Data
  ctx.font = "14px Inter";
  ctx.fillStyle = "#334155";
  ctx.textAlign = "left";
  let y = qrSize + 175;
  const lineH = 30;
  
  ctx.fillText(`Nama Lengkap      : ${member.name}`, padding + 25, y);
  ctx.fillText(`Jenis Kelamin     : ${getGenderText(member.gender)}`, padding + 25, y + lineH);
  ctx.fillText(`Kode Member       : ${member.code}`, padding + 25, y + lineH*2);
  ctx.fillText(`Jabatan           : ${member.position || "Anggota"}`, padding + 25, y + lineH*3);
  ctx.fillText(`Divisi            : ${member.division}`, padding + 25, y + lineH*4);
  ctx.fillText(`Status            : AKTIF`, padding + 25, y + lineH*5);
  
  // Footer
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px Inter";
  ctx.textAlign = "center";
  ctx.fillText(`Dicetak: ${formatDate()}`, w/2, h - 30);
  ctx.font = "10px Inter";
  ctx.fillText("Sistem Absensi Digital IRMANUFA", w/2, h - 12);
  
  // Download
  const link = document.createElement("a");
  link.download = `QR_${member.name.replace(/\s/g, "_")}_${member.code}.png`;
  link.href = canvas.toDataURL();
  link.click();
  Toast.success("QR Code berhasil diunduh!");
}

function downloadQRAsPDF() {
  if (!AppState.currentQRCanvas || !AppState.currentQRMember) { Toast.warning("Generate QR dulu!"); return; }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const member = AppState.currentQRMember;
  
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, 210, 45, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text("IRMANUFA QR ABSENSI", 105, 25, { align: "center" });
  doc.setFontSize(10);
  doc.text("Ikatan Remaja Masjid Jami Nurul Falah", 105, 36, { align: "center" });
  
  const qrUrl = AppState.currentQRCanvas.toDataURL();
  doc.addImage(qrUrl, "PNG", 55, 55, 100, 100);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("DATA DIRI ANGGOTA", 105, 175, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let y = 195;
  doc.text(`Nama Lengkap      : ${member.name}`, 25, y);
  doc.text(`Jenis Kelamin     : ${getGenderText(member.gender)}`, 25, y + 9);
  doc.text(`Kode Member       : ${member.code}`, 25, y + 18);
  doc.text(`Jabatan           : ${member.position || "Anggota"}`, 25, y + 27);
  doc.text(`Divisi            : ${member.division}`, 25, y + 36);
  doc.text(`Status            : AKTIF`, 25, y + 45);
  
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 270, 210, 27, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Dicetak: ${formatDate()}`, 105, 282, { align: "center" });
  doc.text("Sistem Absensi Digital IRMANUFA", 105, 290, { align: "center" });
  
  doc.save(`QR_${member.name.replace(/\s/g, "_")}_${member.code}.pdf`);
  Toast.success("PDF berhasil diunduh!");
}

// ==================== CRUD MEMBERS ====================
function showAddMemberModal() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3><i class="fas fa-user-plus"></i> Tambah Anggota</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div>
    <div class="input-group"><label>Kode</label><input type="text" id="memberCode" placeholder="26.09.001"></div>
    <div class="input-group"><label>Nama</label><input type="text" id="memberName"></div>
    <div class="input-group"><label>JK</label><select id="memberGender"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div>
    <div class="input-group"><label>Jabatan</label><input type="text" id="memberPosition"></div>
    <div class="input-group"><label>Divisi</label><input type="text" id="memberDivision"></div>
    <div class="input-group"><label>Status</label><select id="memberStatus"><option value="active">Aktif</option><option value="passive">Pasif</option></select></div>
    <div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-primary" onclick="saveNewMember()">Simpan</button></div></div>`;
  document.body.appendChild(modal);
}

function saveNewMember() {
  const code = document.getElementById("memberCode")?.value.trim();
  const name = document.getElementById("memberName")?.value.trim();
  const gender = document.getElementById("memberGender")?.value;
  const position = document.getElementById("memberPosition")?.value.trim();
  const division = document.getElementById("memberDivision")?.value.trim();
  const status = document.getElementById("memberStatus")?.value;
  if (!code || !name) { Toast.warning("Kode dan Nama harus diisi!"); return; }
  if (AppState.members.some(m => m.code === code)) { Toast.warning("Kode sudah ada!"); return; }
  const newId = (Math.max(...AppState.members.map(m => parseInt(m.id)), 0) + 1).toString();
  AppState.members.push({ id: newId, code, name, gender, position: position || "Anggota", division: division || "Divisi Baru", status });
  saveMembers(); updateAllDisplays(); updateMemberSelect();
  document.querySelector(".modal-overlay")?.remove();
  Toast.success(`Anggota ${name} ditambahkan!`);
}

function showEditMemberModal(id) {
  const member = getMemberById(id);
  if (!member) return;
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3><i class="fas fa-user-edit"></i> Edit Anggota</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div>
    <div class="input-group"><label>Kode</label><input type="text" id="memberCode" value="${member.code}"></div>
    <div class="input-group"><label>Nama</label><input type="text" id="memberName" value="${member.name.replace(/"/g, "&quot;")}"></div>
    <div class="input-group"><label>JK</label><select id="memberGender"><option value="L" ${member.gender === "L" ? "selected" : ""}>Laki-laki</option><option value="P" ${member.gender === "P" ? "selected" : ""}>Perempuan</option></select></div>
    <div class="input-group"><label>Jabatan</label><input type="text" id="memberPosition" value="${member.position || ""}"></div>
    <div class="input-group"><label>Divisi</label><input type="text" id="memberDivision" value="${member.division || ""}"></div>
    <div class="input-group"><label>Status</label><select id="memberStatus"><option value="active" ${member.status === "active" ? "selected" : ""}>Aktif</option><option value="passive" ${member.status === "passive" ? "selected" : ""}>Pasif</option></select></div>
    <div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-primary" onclick="updateExistingMember('${id}')">Simpan</button></div></div>`;
  document.body.appendChild(modal);
}

function updateExistingMember(id) {
  const code = document.getElementById("memberCode")?.value.trim();
  const name = document.getElementById("memberName")?.value.trim();
  const gender = document.getElementById("memberGender")?.value;
  const position = document.getElementById("memberPosition")?.value.trim();
  const division = document.getElementById("memberDivision")?.value.trim();
  const status = document.getElementById("memberStatus")?.value;
  if (!code || !name) { Toast.warning("Kode dan Nama harus diisi!"); return; }
  if (AppState.members.some(m => m.id !== id && m.code === code)) { Toast.warning("Kode sudah dipakai!"); return; }
  const idx = AppState.members.findIndex(m => m.id === id);
  if (idx !== -1) {
    AppState.members[idx] = { ...AppState.members[idx], code, name, gender, position: position || "Anggota", division: division || "Divisi Baru", status };
    saveMembers(); updateAllDisplays(); updateMemberSelect();
    Toast.success("Data anggota diupdate!");
  }
  document.querySelector(".modal-overlay")?.remove();
}

function showDeleteConfirmModal(id) {
  const member = getMemberById(id);
  if (!member) return;
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `<div class="modal" style="max-width: 400px;"><div class="modal-header" style="background: #fee2e2;"><h3 style="color: #dc2626;"><i class="fas fa-trash-alt"></i> Hapus Anggota</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div>
    <div style="text-align: center; padding: 20px 0;"><i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f59e0b;"></i><p>Hapus <strong>${member.name}</strong>?</p></div>
    <div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-danger" onclick="confirmDeleteMember('${id}')">Hapus</button></div></div>`;
  document.body.appendChild(modal);
}

function confirmDeleteMember(id) {
  AppState.members = AppState.members.filter(m => m.id !== id);
  saveMembers(); updateAllDisplays(); updateMemberSelect();
  document.querySelector(".modal-overlay")?.remove();
  Toast.success("Anggota dihapus!");
}

// ==================== STATISTICS ====================
function getTodayAttendance() { const today = new Date().toDateString(); return AppState.attendance.filter(a => new Date(a.timestamp).toDateString() === today); }
function getStats() {
  const activeMembers = AppState.members.filter(m => m.status === "active").length;
  const todayCount = getTodayAttendance().length;
  const totalAttendance = AppState.attendance.length;
  const count = {};
  AppState.attendance.forEach(a => { count[a.memberName] = (count[a.memberName] || 0) + 1; });
  const topMembers = Object.entries(count).map(([n,c]) => ({ name: n, count: c, division: AppState.attendance.find(a => a.memberName === n)?.division || "-" })).sort((a,b) => b.count - a.count).slice(0,5);
  const divStats = {};
  AppState.members.forEach(m => { if (m.status === "active") { if (!divStats[m.division]) divStats[m.division] = { total: 0, attended: 0 }; divStats[m.division].total++; } });
  getTodayAttendance().forEach(a => { if (divStats[a.division]) divStats[a.division].attended++; });
  return { activeMembers, todayCount, totalAttendance, topMembers, divisionStats: divStats };
}

// ==================== RENDER ====================
function renderMemberTable(search = "") {
  const container = document.getElementById("memberTableBody");
  if (!container) return;
  let members = [...AppState.members];
  if (search) members = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.code.includes(search) || m.division.toLowerCase().includes(search.toLowerCase()));
  if (members.length === 0) { container.innerHTML = '<tr><td colspan="7" class="empty-state">Tidak ada anggota</td></tr>'; return; }
  const todayAttended = getTodayAttendance().map(a => a.memberId);
  container.innerHTML = members.map(m => `<tr><td style="padding: 10px;">${m.code}</td><td style="padding: 10px;"><strong>${m.name}</strong><br><small>${getGenderText(m.gender)}</small></td><td style="padding: 10px;">${m.division}</td><td style="padding: 10px;">${m.position || "Anggota"}</td><td style="padding: 10px;"><span class="status-badge ${m.status === "active" ? "status-active" : "status-passive"}">${m.status === "active" ? "Aktif" : "Pasif"}</span></td><td style="padding: 10px;"><span class="status-badge ${todayAttended.includes(m.id) ? "status-hadir" : "status-belum"}">${todayAttended.includes(m.id) ? "Hadir" : "Belum"}</span></td><td style="padding: 10px;"><button class="btn btn-warning btn-sm" onclick="showEditMemberModal('${m.id}')" style="margin-right: 5px;"><i class="fas fa-edit"></i></button><button class="btn btn-danger btn-sm" onclick="showDeleteConfirmModal('${m.id}')"><i class="fas fa-trash"></i></button></td></tr>`).join("");
}

function renderTopMembers() {
  const stats = getStats();
  const container = document.getElementById("topMembersList");
  if (!container) return;
  if (stats.topMembers.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>Belum ada data</p></div>'; return; }
  container.innerHTML = stats.topMembers.map((m,i) => `<div class="ranking-item"><div class="rank-number" style="background: ${i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#059669"};">${i+1}</div><div class="rank-info"><h4>${m.name}</h4><div class="rank-stats"><span><i class="fas fa-check-circle"></i> ${m.count} kali</span><span><i class="fas fa-users"></i> ${m.division}</span></div></div></div>`).join("");
}

function renderRecentAttendance() {
  const container = document.getElementById("recentAttendanceList");
  if (!container) return;
  const recent = [...AppState.attendance].reverse().slice(0,10);
  if (recent.length === 0) { container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Belum ada absensi</p></div>'; return; }
  container.innerHTML = recent.map(a => `<div class="ranking-item"><div class="rank-number" style="background: #10b981;">✓</div><div class="rank-info"><h4>${a.memberName}</h4><div class="rank-stats"><span><i class="fas fa-clock"></i> ${a.time}</span><span><i class="fas fa-calendar"></i> ${a.date.split(",")[0]}</span></div>${a.kegiatan ? `<div class="rank-stats"><i class="fas fa-tag"></i> ${a.kegiatan.substring(0,30)}</div>` : ""}</div></div>`).join("");
}

function updateCharts() {
  const stats = getStats();
  const ctx1 = document.getElementById("attendanceChart");
  if (ctx1) {
    const last7 = []; for (let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); last7.push({ date: d.toLocaleDateString("id-ID",{day:"numeric",month:"short"}), count: AppState.attendance.filter(a => new Date(a.timestamp).toDateString() === d.toDateString()).length }); }
    if (AppState.attendanceChart) AppState.attendanceChart.destroy();
    AppState.attendanceChart = new Chart(ctx1, { type: "line", data: { labels: last7.map(d=>d.date), datasets: [{ label: "Jumlah Absensi", data: last7.map(d=>d.count), borderColor: "#059669", backgroundColor: "rgba(5,150,105,0.1)", fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
  }
  const ctx2 = document.getElementById("divisionChart");
  if (ctx2 && Object.keys(stats.divisionStats).length > 0) {
    const names = Object.keys(stats.divisionStats);
    const rates = names.map(d => (stats.divisionStats[d].attended / stats.divisionStats[d].total) * 100);
    const colors = names.map((_,i) => CHART_COLORS[i % CHART_COLORS.length]);
    if (AppState.divisionChart) AppState.divisionChart.destroy();
    AppState.divisionChart = new Chart(ctx2, { type: "bar", data: { labels: names, datasets: [{ label: "Kehadiran (%)", data: rates, backgroundColor: colors, borderRadius: 8 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } }, x: { ticks: { rotation: 45 } } }, plugins: { tooltip: { callbacks: { label: ctx => `${ctx.raw.toFixed(1)}%` } } } } });
  }
}

function updateStatsCards() {
  const s = getStats();
  const a = document.getElementById("activeMembers"); if (a) a.textContent = s.activeMembers;
  const t = document.getElementById("todayCount"); if (t) t.textContent = s.todayCount;
  const tt = document.getElementById("totalAttendance"); if (tt) tt.textContent = s.totalAttendance;
}

function updateAllDisplays() { updateStatsCards(); renderMemberTable(); renderTopMembers(); renderRecentAttendance(); updateCharts(); }

// ==================== REPORT & WA ====================
function generateReport() {
  const start = document.getElementById("startDate")?.value;
  const end = document.getElementById("endDate")?.value;
  let data = [...AppState.attendance];
  if (start && end) { const s = new Date(start), e = new Date(end); e.setHours(23,59,59); data = data.filter(a => new Date(a.timestamp) >= s && new Date(a.timestamp) <= e); }
  if (data.length === 0) { Toast.warning("Tidak ada data"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFillColor(5,150,105); doc.rect(0,0,210,45,"F");
  doc.setTextColor(255,255,255); doc.setFontSize(18); doc.text("LAPORAN ABSENSI IRMANUFA", 105, 22, { align: "center" });
  doc.setFontSize(12); doc.text(`Kegiatan: ${AppState.currentKegiatan}`, 105, 34, { align: "center" });
  doc.setFontSize(10); doc.text(`Tanggal Cetak: ${formatDate()}`, 105, 44, { align: "center" });
  let y = 60;
  doc.setFillColor(5,150,105); doc.rect(10, y, 190, 8, "F");
  doc.setTextColor(255,255,255); doc.text("No", 15, y+6); doc.text("Nama", 40, y+6); doc.text("Divisi", 90, y+6); doc.text("Jabatan", 130, y+6); doc.text("Waktu", 170, y+6);
  y += 10; doc.setTextColor(0,0,0);
  data.slice().reverse().forEach((item,i) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(`${i+1}`, 15, y+4); doc.text(item.memberName.substring(0,25), 40, y+4); doc.text(item.division.substring(0,20), 90, y+4); doc.text(item.position.substring(0,15), 130, y+4); doc.text(item.time, 170, y+4);
    y += 7;
  });
  doc.save(`Laporan_${AppState.currentKegiatan.replace(/\s/g,"_")}_${Date.now()}.pdf`);
  Toast.success("Laporan diunduh!");
}

function exportToExcel() {
  const data = AppState.attendance.map(a => ({ Kode: a.memberCode, Nama: a.memberName, JK: a.memberGender === "L" ? "Laki-laki" : "Perempuan", Divisi: a.division, Jabatan: a.position, Tanggal: a.date, Waktu: a.time, Kegiatan: a.kegiatan || AppState.currentKegiatan }));
  if (data.length === 0) { Toast.warning("Tidak ada data"); return; }
  const headers = Object.keys(data[0]);
  const csv = [headers.join(","), ...data.map(obj => headers.map(h => JSON.stringify(obj[h] || "")).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `Absensi_IRMANUFA_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
  Toast.success("Excel berhasil!");
}

function showWhatsAppModal() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay whatsapp-modal";
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3><i class="fab fa-whatsapp"></i> Kirim WA</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div>
    <div class="input-group"><label>Nomor WA</label><input type="tel" id="waNumber" placeholder="081234567890"><small>Contoh: 6281234567890</small></div>
    <div class="input-group"><label>Laporan</label><select id="reportType"><option value="today">Absensi Hari Ini</option><option value="all">Laporan Lengkap</option></select></div>
    <div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-success" onclick="sendWhatsApp()"><i class="fab fa-whatsapp"></i> Kirim</button></div></div>`;
  document.body.appendChild(modal);
}

function sendWhatsApp() {
  let phone = document.getElementById("waNumber")?.value.trim();
  const type = document.getElementById("reportType")?.value;
  if (!phone) { Toast.warning("Masukkan nomor!"); return; }
  phone = phone.replace(/[^0-9]/g, ""); if (phone.startsWith("0")) phone = "62" + phone.substring(1); if (!phone.startsWith("62")) phone = "62" + phone;
  const stats = getStats(); const today = getTodayAttendance();
  let msg = "";
  if (type === "today") {
    msg = `📊 *LAPORAN ABSENSI HARI INI - IRMANUFA* 📊\n\n📅 *Tanggal:* ${formatDate()}\n📌 *Kegiatan:* ${AppState.currentKegiatan}\n━━━━━━━━━━━━━━━━━━━━\n✅ *Kehadiran:* ${stats.todayCount} dari ${stats.activeMembers} anggota\n📈 *Persentase:* ${Math.round((stats.todayCount/stats.activeMembers)*100)}%\n━━━━━━━━━━━━━━━━━━━━\n*Daftar Hadir:*\n${today.length > 0 ? today.map((a,i) => `${i+1}. ${a.memberName} - ${a.division} (${a.time})`).join("\n") : "Belum ada yang absen"}\n━━━━━━━━━━━━━━━━━━━━\n_Dikirim dari Sistem Absensi IRMANUFA_`;
  } else {
    msg = `📊 *LAPORAN LENGKAP ABSENSI IRMANUFA* 📊\n\n📌 *Kegiatan:* ${AppState.currentKegiatan}\n━━━━━━━━━━━━━━━━━━━━\n📈 *Total Absensi:* ${AppState.attendance.length} kali\n👥 *Total Anggota:* ${AppState.members.length} orang\n✅ *Anggota Aktif:* ${stats.activeMembers} orang\n━━━━━━━━━━━━━━━━━━━━\n_Dikirim dari Sistem Absensi IRMANUFA_`;
  }
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  document.querySelector(".modal-overlay")?.remove();
  Toast.success("Membuka WhatsApp...");
}

function resetAllData() { showConfirmModal("Reset Data", "Hapus semua data absensi?", () => { AppState.attendance = []; saveAttendance(); updateAllDisplays(); renderTodayScanHistory(); Toast.success("Data direset!"); }); }
function resetMembersToDefault() { showConfirmModal("Reset Anggota", "Reset ke data default?", () => { localStorage.removeItem(CONFIG.STORAGE_KEYS.MEMBERS); loadData(); updateAllDisplays(); updateMemberSelect(); Toast.success("Data anggota direset!"); }); }
function showConfirmModal(title, msg, onConfirm) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `<div class="modal" style="max-width: 400px;"><div class="modal-header" style="background: #fef3c7;"><h3><i class="fas fa-exclamation-triangle"></i> ${title}</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div><div style="text-align:center;padding:20px"><i class="fas fa-question-circle" style="font-size:48px;color:#f59e0b"></i><p style="margin-top:10px">${msg}</p></div><div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-danger" id="confirmBtn">Ya, Hapus</button></div></div>`;
  document.body.appendChild(modal);
  document.getElementById("confirmBtn").onclick = () => { modal.remove(); onConfirm(); };
}

// ==================== NAVIGATION ====================
function toggleMenu() { document.querySelector(".sidebar")?.classList.toggle("active"); document.querySelector(".sidebar-overlay")?.classList.toggle("active"); }
function closeMenu() { document.querySelector(".sidebar")?.classList.remove("active"); document.querySelector(".sidebar-overlay")?.classList.remove("active"); }

function showSection(section) {
  AppState.activeSection = section;
  document.querySelectorAll(".menu-item").forEach(i => { i.classList.remove("active"); if (i.dataset.section === section) i.classList.add("active"); });
  document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
  document.getElementById(section + "Section")?.classList.add("active");
  if (section === "dashboard") setTimeout(() => { updateCharts(); renderRecentAttendance(); renderTopMembers(); }, 100);
  if (section === "members") renderMemberTable();
  if (section === "scanner") { renderTodayScanHistory(); const r = document.getElementById("scanResult"); if (r) r.style.display = "none"; }
  if (section === "reports") {
    const today = new Date(); const week = new Date(); week.setDate(week.getDate()-7);
    if (document.getElementById("startDate")) { document.getElementById("startDate").value = week.toISOString().split("T")[0]; document.getElementById("endDate").value = today.toISOString().split("T")[0]; }
    const ki = document.getElementById("kegiatanName"); if (ki) { ki.value = AppState.currentKegiatan; ki.addEventListener("change", e => saveKegiatan(e.target.value)); }
  }
  if (section === "generator") { updateMemberSelect(); const qc = document.getElementById("qrCodeDisplay"); if (qc) qc.innerHTML = '<div class="empty-state"><i class="fas fa-qrcode" style="font-size:80px"></i><p>Pilih anggota dan klik Generate</p></div>'; const ic = document.getElementById("memberInfoDisplay"); if (ic) ic.innerHTML = '<div class="member-info-card"><h4>Informasi</h4><p style="text-align:center">Pilih anggota dan klik Generate</p></div>'; }
  closeMenu();
}

function logout() { showConfirmModal("Keluar", "Yakin keluar?", () => { localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH); localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_USER); location.reload(); }); }

// ==================== LOGIN ====================
let selectedUser = "admin";
function selectUser(userId) { selectedUser = userId; document.querySelectorAll(".user-option").forEach(opt => opt.classList.remove("active")); document.getElementById(`user-${userId}`).classList.add("active"); }
function handleLogin(e) { e.preventDefault(); const pwd = document.getElementById("password").value; const user = CONFIG.USERS[selectedUser]; if (user && pwd === user.password) { localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH, "true"); localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_USER, JSON.stringify({ id: selectedUser, ...user })); renderDashboard(); Toast.success(`Login berhasil! Selamat datang ${user.name}.`); } else { Toast.error("Password salah!"); } return false; }
function togglePassword() { const inp = document.getElementById("password"); const icon = document.querySelector(".toggle-password i"); if (inp.type === "password") { inp.type = "text"; icon.classList.replace("fa-eye", "fa-eye-slash"); } else { inp.type = "password"; icon.classList.replace("fa-eye-slash", "fa-eye"); } }

// ==================== RENDER DASHBOARD ====================
function renderDashboard() {
  loadData();
  const stored = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_USER);
  AppState.currentUser = stored ? JSON.parse(stored) : CONFIG.USERS.admin;
  const stats = getStats();
  const activeCount = AppState.members.filter(m => m.status === "active").length;
  const passiveCount = AppState.members.filter(m => m.status === "passive").length;
  
  document.getElementById("app").innerHTML = `
    <div class="dashboard">
      <nav class="navbar"><div class="nav-content"><div class="nav-brand"><div class="logo-icon"><i class="fas fa-mosque"></i></div><div><h1>IRMANUFA QR Absensi</h1><small>Kabinet Golden Generation</small></div></div><div class="nav-stats"><span class="stat-badge"><i class="fas fa-users"></i> ${activeCount} Aktif</span><span class="stat-badge"><i class="fas fa-calendar-check"></i> ${stats.todayCount} Hadir</span><span class="stat-badge"><i class="fas fa-user-clock"></i> ${passiveCount} Pasif</span></div><button class="hamburger-btn" onclick="toggleMenu()"><i class="fas fa-bars"></i></button></div></nav>
      <div class="sidebar"><div class="sidebar-header"><div class="user-avatar" style="display:flex;justify-content:center"><i class="fas fa-user-circle" style="font-size:48px"></i></div><div class="user-info"><h3>${AppState.currentUser.name}</h3><p>${AppState.currentUser.role}</p><div class="user-badge"><i class="fas fa-shield-alt"></i> ${AppState.currentUser.role === "Super Admin" ? "Super Admin" : "Sekretariat"}</div></div></div><div class="sidebar-menu"><a href="#" class="menu-item active" data-section="dashboard" onclick="showSection('dashboard')"><i class="fas fa-home"></i><span>Dashboard</span></a><a href="#" class="menu-item" data-section="scanner" onclick="showSection('scanner')"><i class="fas fa-qrcode"></i><span>Scan QR Code</span><span class="menu-badge">New</span></a><a href="#" class="menu-item" data-section="generator" onclick="showSection('generator')"><i class="fas fa-print"></i><span>Cetak QR Code</span></a><a href="#" class="menu-item" data-section="members" onclick="showSection('members')"><i class="fas fa-users"></i><span>Data Anggota</span></a><a href="#" class="menu-item" data-section="reports" onclick="showSection('reports')"><i class="fas fa-chart-line"></i><span>Laporan</span></a><a href="#" class="menu-item" onclick="logout()"><i class="fas fa-sign-out-alt"></i><span>Keluar</span></a></div></div>
      <div class="sidebar-overlay" onclick="closeMenu()"></div>
      <div class="main-content">
        <div class="welcome-card"><div class="welcome-text"><h2>Selamat Datang, ${AppState.currentUser.name.split(" ")[0]}!</h2><p>Sistem Absensi Digital IRMANUFA</p><small><i class="fas fa-qrcode"></i> Scan QR Code | <i class="fas fa-check-circle"></i> Hanya anggota AKTIF</small></div><div class="date-info"><div class="time" id="currentTime">${formatTime()}</div><div class="date" id="currentDate">${formatDate()}</div></div></div>
        <section id="dashboardSection" class="content-section active"><div class="stats-grid"><div class="stat-card"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-number" id="activeMembers">${stats.activeMembers}</div><div class="stat-label">Anggota Aktif</div></div><div class="stat-card"><div class="stat-icon"><i class="fas fa-calendar-day"></i></div><div class="stat-number" id="todayCount">${stats.todayCount}</div><div class="stat-label">Hadir Hari Ini</div></div><div class="stat-card"><div class="stat-icon"><i class="fas fa-chart-line"></i></div><div class="stat-number" id="totalAttendance">${stats.totalAttendance}</div><div class="stat-label">Total Absensi</div></div></div><div class="card"><div class="card-header"><i class="fas fa-chart-line"></i><h3>Tren Absensi 7 Hari</h3></div><div class="chart-wrapper"><canvas id="attendanceChart"></canvas></div></div><div class="card"><div class="card-header"><i class="fas fa-chart-pie"></i><h3>Kehadiran per Divisi</h3><small>(Warna berbeda setiap divisi)</small></div><div class="chart-wrapper"><canvas id="divisionChart"></canvas></div></div><div class="card"><div class="card-header"><i class="fas fa-trophy"></i><h3>Top 5 Terrajin</h3></div><div id="topMembersList" class="ranking-list"></div></div><div class="card"><div class="card-header"><i class="fas fa-history"></i><h3>Absensi Terbaru</h3></div><div id="recentAttendanceList" class="ranking-list"></div></div></section>
        <section id="scannerSection" class="content-section"><div class="card"><div class="card-header"><i class="fas fa-qrcode"></i><h3>Scan QR Code</h3><small>Arahkan kamera ke QR Code</small></div><div class="scanner-header"><button id="flashToggleBtn" class="flash-btn" onclick="toggleFlash()"><i class="fas fa-lightbulb"></i> Flash OFF</button></div><div class="scanner-container"><div id="reader" class="empty-state"><i class="fas fa-camera"></i><p>Scanner siap. Klik "Mulai Scan"</p></div></div><div class="action-buttons"><button class="btn btn-primary" onclick="startScanner()"><i class="fas fa-play"></i> Mulai Scan</button><button class="btn btn-danger" onclick="stopScanner()"><i class="fas fa-stop"></i> Hentikan</button></div></div><div class="card"><div class="card-header"><i class="fas fa-table"></i><h3>Hasil Scan Hari Ini</h3><small>Klik Edit/Hapus untuk mengubah data</small></div><div id="todayScanHistory"></div></div><div class="info-card"><i class="fas fa-info-circle"></i> <strong>Cara Penggunaan:</strong><ol><li>Klik "Mulai Scan" → Izinkan kamera</li><li>Arahkan ke QR Code anggota</li><li>Suara "berhasil.mp3" jika berhasil</li><li>Suara "sudah.mp3" jika sudah absen</li><li>Suara "takkenal.mp3" jika tidak dikenali</li><li>Edit/Hapus data di tabel atas</li></ol></div></section>
        <section id="generatorSection" class="content-section"><div class="card"><div class="card-header"><i class="fas fa-print"></i><h3>Cetak QR Code</h3><small>Pilih anggota untuk generate QR Code</small></div><div class="qr-generator-grid"><div class="qr-card-preview"><div class="qr-display" id="qrCodeDisplay"><i class="fas fa-qrcode" style="font-size:80px;color:#94a3b8"></i><p>Pilih anggota dan klik Generate</p></div><div class="download-buttons"><button class="btn btn-primary" onclick="downloadQRAsPNG()"><i class="fas fa-image"></i> PNG HD</button><button class="btn btn-success" onclick="downloadQRAsPDF()"><i class="fas fa-file-pdf"></i> PDF</button></div></div><div><select id="memberSelect" style="width:100%;padding:14px;border-radius:14px;border:2px solid #e2e8f0"><option value="">✨-- Pilih Anggota Aktif --✨</option></select><button class="btn btn-primary" style="width:100%;margin-top:16px" onclick="generateMemberQR()"><i class="fas fa-qrcode"></i> Generate QR Code</button><div id="memberInfoDisplay" class="member-info-card" style="margin-top:16px"><h4><i class="fas fa-info-circle"></i> Informasi</h4><p style="text-align:center">Pilih anggota dan klik "Generate QR Code"</p></div></div></div></div></section>
        <section id="membersSection" class="content-section"><div class="card"><div class="card-header"><i class="fas fa-users"></i><h3>Data Anggota</h3><small>Total: ${AppState.members.length} (${activeCount} Aktif, ${passiveCount} Pasif)</small><div style="margin-left:auto"><button class="btn btn-secondary btn-sm" onclick="resetMembersToDefault()"><i class="fas fa-undo"></i> Reset</button> <button class="btn btn-primary btn-sm" onclick="showAddMemberModal()"><i class="fas fa-plus"></i> Tambah</button></div></div><div class="search-box"><input type="text" id="memberSearch" placeholder="Cari nama/kode/divisi..." onkeyup="renderMemberTable(this.value)"></div><div class="table-container"><table class="data-table"><thead><tr><th>Kode</th><th>Nama</th><th>Divisi</th><th>Jabatan</th><th>Status</th><th>Hari Ini</th><th>Aksi</th></tr></thead><tbody id="memberTableBody"></tbody></table></div></div></section>
        <section id="reportsSection" class="content-section"><div class="card"><div class="card-header"><i class="fas fa-chart-line"></i><h3>Laporan Absensi</h3></div><div class="kegiatan-input"><label><i class="fas fa-tag"></i> Nama Kegiatan</label><input type="text" id="kegiatanName"></div><div class="report-header"><div class="report-date"><label>Dari</label><input type="date" id="startDate"><label>Sampai</label><input type="date" id="endDate"></div></div><div class="action-buttons"><button class="btn btn-primary" onclick="generateReport()"><i class="fas fa-file-pdf"></i> PDF</button><button class="btn btn-success" onclick="exportToExcel()"><i class="fas fa-file-excel"></i> Excel</button><button class="btn btn-info" onclick="showWhatsAppModal()"><i class="fab fa-whatsapp"></i> WhatsApp</button><button class="btn btn-danger" onclick="resetAllData()"><i class="fas fa-trash"></i> Reset Absensi</button></div></div><div class="stats-grid"><div class="stat-card"><div class="stat-icon"><i class="fas fa-database"></i></div><div class="stat-number">${AppState.attendance.length}</div><div class="stat-label">Total Data</div></div><div class="stat-card"><div class="stat-icon"><i class="fas fa-qrcode"></i></div><div class="stat-number">${AppState.attendance.filter(a => a.method === "qr").length}</div><div class="stat-label">QR Code</div></div><div class="stat-card"><div class="stat-icon"><i class="fas fa-user-check"></i></div><div class="stat-number">${new Set(AppState.attendance.map(a => a.memberId)).size}</div><div class="stat-label">Pernah Absen</div></div></div></section>
      </div>
    </div>
  `;
  
  updateAllDisplays(); updateMemberSelect(); renderTodayScanHistory();
  const ki = document.getElementById("kegiatanName"); if (ki) { ki.value = AppState.currentKegiatan; ki.addEventListener("change", e => saveKegiatan(e.target.value)); }
  setInterval(() => { const t = document.getElementById("currentTime"); const d = document.getElementById("currentDate"); if (t) t.textContent = formatTime(); if (d) d.textContent = formatDate(); }, 1000);
  const today = new Date(); const week = new Date(); week.setDate(week.getDate()-7);
  if (document.getElementById("startDate")) { document.getElementById("startDate").value = week.toISOString().split("T")[0]; document.getElementById("endDate").value = today.toISOString().split("T")[0]; }
}

function renderLoginPage() {
  document.getElementById("app").innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <div class="login-logo"><div class="logo-icon"><i class="fas fa-mosque"></i></div><h1>IRMANUFA QR Absensi</h1><p>Sistem Absensi Digital Berbasis QR Code</p></div>
        <div class="user-selector">
          <div id="user-admin" class="user-option active" onclick="selectUser('admin')"><div class="avatar-fallback"><i class="fas fa-user-tie"></i></div><div class="user-name">Admin</div><div class="user-role">Super Admin</div></div>
          <div id="user-tasya" class="user-option" onclick="selectUser('tasya')"><div class="avatar-fallback"><i class="fas fa-user-circle"></i></div><div class="user-name">Tasya</div><div class="user-role">Sekretaris I</div></div>
          <div id="user-lidya" class="user-option" onclick="selectUser('lidya')"><div class="avatar-fallback"><i class="fas fa-user-circle"></i></div><div class="user-name">Lidya</div><div class="user-role">Sekretaris II</div></div>
        </div>
        <form onsubmit="return handleLogin(event)">
          <div class="input-group"><label><i class="fas fa-lock"></i> Password</label><div class="password-container"><input type="password" id="password" placeholder="Masukkan password" required><button type="button" class="toggle-password" onclick="togglePassword()"><i class="fas fa-eye"></i></button></div></div>
          <div class="features"><div class="feature"><i class="fas fa-qrcode"></i><span>Scan QR Code</span></div><div class="feature"><i class="fas fa-chart-line"></i><span>Real-time Update</span></div><div class="feature"><i class="fas fa-trophy"></i><span>Ranking Anggota</span></div><div class="feature"><i class="fas fa-file-pdf"></i><span>Laporan PDF/Excel/WA</span></div></div>
          <button type="submit" class="login-btn"><i class="fas fa-sign-in-alt"></i> MASUK</button>
        </form>
        <div class="login-footer"><p>IRMANUFA Kabinet Golden Generation 2027-2029</p><p style="font-size:10px;margin-top:8px">Password: admin123 | tasya123 | lidya123</p></div>
      </div>
    </div>
  `;
}

// ==================== EXPOSE GLOBALS ====================
window.startScanner = startScanner; window.stopScanner = stopScanner; window.toggleFlash = toggleFlash;
window.generateMemberQR = generateMemberQR; window.downloadQRAsPNG = downloadQRAsPNG; window.downloadQRAsPDF = downloadQRAsPDF;
window.showAddMemberModal = showAddMemberModal; window.showEditMemberModal = showEditMemberModal;
window.updateExistingMember = updateExistingMember; window.saveNewMember = saveNewMember;
window.showDeleteConfirmModal = showDeleteConfirmModal; window.confirmDeleteMember = confirmDeleteMember;
window.generateReport = generateReport; window.exportToExcel = exportToExcel; window.showWhatsAppModal = showWhatsAppModal;
window.resetAllData = resetAllData; window.resetMembersToDefault = resetMembersToDefault;
window.toggleMenu = toggleMenu; window.closeMenu = closeMenu; window.showSection = showSection; window.logout = logout;
window.handleLogin = handleLogin; window.togglePassword = togglePassword; window.selectUser = selectUser;
window.renderMemberTable = renderMemberTable; window.editAttendanceById = editAttendanceById; window.deleteAttendanceById = deleteAttendanceById;
window.sendWhatsApp = sendWhatsApp;

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", () => {
  const isLoggedIn = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH) === "true";
  if (!isLoggedIn) renderLoginPage(); else renderDashboard();
});
