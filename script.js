// ============================================
// IRMANUFA QR ABSENSI - SCRIPT UTAMA
// VERSI FINAL - FULLY FIXED
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
    admin: { username: "admin", password: "admin123", name: "Admin IRMANUFA", role: "Super Admin", avatar: "admin.png", avatarFallback: "fas fa-user-tie" },
    tasya: { username: "tasya", password: "tasya123", name: "Tasya Amelia Putri", role: "Sekretaris I", avatar: "tasya.png", avatarFallback: "fas fa-user-circle" },
    lidya: { username: "lidya", password: "lidya123", name: "Lidya Febrianti", role: "Sekretaris II", avatar: "lidya.png", avatarFallback: "fas fa-user-circle" }
  }
};

const CHART_COLORS = ["#FF6B6B", "#4ECDC4", "#FFE66D", "#1A535C", "#FF9F1C", "#9B5DE5", "#00BBF9", "#F15BB5", "#00F5D4", "#FEE440", "#132A13", "#DC2F02", "#4895EF", "#E63946", "#F77F00", "#6A4C93", "#3D5A80", "#EE6C4D", "#98C1D9", "#293241"];

let AppState = {
  members: [],
  attendance: [],
  activeSection: "dashboard",
  qrScanner: null,
  attendanceChart: null,
  divisionChart: null,
  currentQRMember: null,
  currentQRCanvas: null,
  isScanning: false,
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
    audio.play().catch(e => console.log("Audio play error:", e));
  } catch (e) { console.log("Sound error:", e); }
}

function preloadAudios() {
  const sounds = ["berhasil.mp3", "sudah.mp3", "takkenal.mp3"];
  sounds.forEach(sound => {
    const audio = new Audio();
    audio.preload = "auto";
    audio.src = sound;
  });
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

// ==================== FUNGSI KEGIATAN ====================
function loadKegiatan() {
  const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.KEGIATAN);
  AppState.currentKegiatan = saved || "Rapat Koordinasi IRMANUFA";
}
function saveKegiatan(kegiatan) {
  AppState.currentKegiatan = kegiatan;
  localStorage.setItem(CONFIG.STORAGE_KEYS.KEGIATAN, kegiatan);
}

// ==================== FITUR FLASH ====================
async function toggleFlash() {
  if (!AppState.qrScanner) { Toast.warning("Scanner belum dimulai!"); return; }
  try {
    const videoElement = document.querySelector("#reader video");
    if (!videoElement) { Toast.warning("Kamera belum aktif!"); return; }
    const stream = videoElement.srcObject;
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities && track.getCapabilities().torch) {
        const newFlashState = !AppState.currentFlashStatus;
        await track.applyConstraints({ advanced: [{ torch: newFlashState }] });
        AppState.currentFlashStatus = newFlashState;
        const flashBtn = document.getElementById("flashToggleBtn");
        if (flashBtn) {
          flashBtn.classList.toggle("active", newFlashState);
          flashBtn.innerHTML = `<i class="fas fa-lightbulb"></i> Flash ${newFlashState ? "ON" : "OFF"}`;
        }
        Toast.info(`Flash ${newFlashState ? "ON" : "OFF"}`);
      } else { Toast.warning("Device tidak mendukung flash!"); }
    }
  } catch (e) { console.error("Flash error:", e); Toast.warning("Gagal mengontrol flash!"); }
}

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
  loadKegiatan();
}

function saveMembers() { localStorage.setItem(CONFIG.STORAGE_KEYS.MEMBERS, JSON.stringify(AppState.members)); }
function saveAttendance() { localStorage.setItem(CONFIG.STORAGE_KEYS.ATTENDANCE, JSON.stringify(AppState.attendance)); }

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
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="padding: 12px; text-align: left;">No</th>
            <th style="padding: 12px; text-align: left;">Nama</th>
            <th style="padding: 12px; text-align: left;">Divisi</th>
            <th style="padding: 12px; text-align: left;">Waktu</th>
            <th style="padding: 12px; text-align: left;">Aksi</th>
           </tr>
        </thead>
        <tbody>
          ${todayAttendance.map((a, i) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px;">${i + 1}</td>
              <td style="padding: 12px;"><strong>${a.memberName}</strong></td>
              <td style="padding: 12px;">${a.division}</td>
              <td style="padding: 12px;">${a.time}</td>
              <td style="padding: 12px;">
                <button class="btn btn-warning btn-sm" onclick="editAttendanceById(${a.id})" style="padding: 4px 10px; margin-right: 5px;"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteAttendanceById(${a.id})" style="padding: 4px 10px;"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function editAttendanceById(attendanceId) {
  const attendance = AppState.attendance.find(a => a.id == attendanceId);
  if (attendance) showEditAttendanceModal(attendance);
}

function deleteAttendanceById(attendanceId) {
  showConfirmModal("Hapus Data Absensi", "Apakah Anda yakin ingin menghapus data absensi ini?", () => {
    AppState.attendance = AppState.attendance.filter(a => a.id != attendanceId);
    saveAttendance();
    updateAllDisplays();
    renderTodayScanHistory();
    Toast.success("Data absensi berhasil dihapus!");
  });
}

function showEditAttendanceModal(attendance) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3><i class="fas fa-edit"></i> Edit Data Absensi</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div>
      <div class="input-group"><label>Nama Anggota</label><input type="text" value="${attendance.memberName}" disabled style="background:#f1f5f9;"></div>
      <div class="input-group"><label>Divisi</label><input type="text" value="${attendance.division}" disabled style="background:#f1f5f9;"></div>
      <div class="input-group"><label>Waktu Absensi</label><input type="time" id="editTime" value="${attendance.time}"></div>
      <div class="input-group"><label>Tanggal Absensi</label><input type="date" id="editDate" value="${attendance.dateShort.split("/").reverse().join("-")}"></div>
      <div class="input-group"><label>Nama Kegiatan</label><input type="text" id="editKegiatan" value="${attendance.kegiatan || AppState.currentKegiatan}"></div>
      <div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-primary" onclick="saveEditAttendance(${attendance.id})">Simpan</button></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function saveEditAttendance(attendanceId) {
  const newTime = document.getElementById("editTime")?.value;
  const newDate = document.getElementById("editDate")?.value;
  const newKegiatan = document.getElementById("editKegiatan")?.value;
  const index = AppState.attendance.findIndex(a => a.id == attendanceId);
  if (index !== -1) {
    if (newDate) { const dateObj = new Date(newDate); AppState.attendance[index].date = formatDate(dateObj); AppState.attendance[index].dateShort = formatDateShort(dateObj); AppState.attendance[index].timestamp = dateObj.toISOString(); }
    if (newTime) AppState.attendance[index].time = newTime;
    if (newKegiatan) AppState.attendance[index].kegiatan = newKegiatan;
    saveAttendance(); updateAllDisplays(); renderTodayScanHistory(); Toast.success("Data berhasil diupdate!");
  }
  document.querySelector(".modal-overlay")?.remove();
}

// ==================== QR SCANNER ====================
async function startScanner() {
  const container = document.getElementById("reader");
  if (!container) return;
  if (AppState.qrScanner) { try { await AppState.qrScanner.stop(); AppState.qrScanner = null; } catch (e) {} }
  container.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Memulai kamera...</p></div>';
  const html5QrCode = new Html5Qrcode("reader");
  AppState.qrScanner = html5QrCode;
  const config = { fps: 30, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
  html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
    const now = Date.now();
    if (now - AppState.lastScanTime < 2000) return;
    AppState.lastScanTime = now;
    let member = null;
    try { const qrData = JSON.parse(decodedText); member = getMemberByCode(qrData.code); } catch (e) { member = getMemberByCode(decodedText); }
    if (member) {
      if (member.status === "active") {
        if (!isAlreadyAttended(member.id)) { recordAttendance(member.id, "qr"); }
        else { Toast.warning(`${member.name} sudah absen hari ini!`); playSound("sudah.mp3"); }
      } else { Toast.warning(`${member.name} adalah anggota PASIF!`); playSound("takkenal.mp3"); }
    } else { Toast.error("QR Code tidak dikenali!"); playSound("takkenal.mp3"); }
  }).catch((err) => {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Gagal mengakses kamera!</p><button class="btn btn-primary" style="margin-top: 10px;" onclick="startScanner()"><i class="fas fa-redo"></i> Coba Lagi</button></div>';
    Toast.error("Gagal mengakses kamera!"); AppState.qrScanner = null;
  });
}

function stopScanner() {
  if (AppState.qrScanner) { AppState.qrScanner.stop(); AppState.qrScanner = null; AppState.currentFlashStatus = false; document.getElementById("reader").innerHTML = '<div class="empty-state"><i class="fas fa-qrcode"></i><p>Scanner siap. Klik "Mulai Scan"</p></div>'; Toast.info("Scanner dihentikan"); }
}

// ==================== QR GENERATOR ====================
function updateMemberSelect() {
  const select = document.getElementById("memberSelect");
  if (select) { 
    const activeMembers = AppState.members.filter(m => m.status === "active"); 
    select.innerHTML = '<option value="">✨-- Pilih Anggota Aktif --✨</option>' + activeMembers.map(m => `<option value="${m.id}">${m.code} - ${m.name} (${m.division})</option>`).join(""); 
  }
}

function generateMemberQR() {
  const memberSelect = document.getElementById("memberSelect");
  const memberId = memberSelect?.value;
  const member = getMemberById(memberId);
  
  if (!member) { Toast.warning("Pilih anggota terlebih dahulu!"); return; }
  if (member.status !== "active") { Toast.warning(`Anggota ${member.name} berstatus PASIF!`); return; }
  
  const qrContainer = document.getElementById("qrCodeDisplay");
  const infoContainer = document.getElementById("memberInfoDisplay");
  if (!qrContainer) return;
  
  qrContainer.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>Membuat QR Code...</p></div>';
  
  const qrData = JSON.stringify({
    code: member.code,
    name: member.name,
    gender: member.gender,
    position: member.position || "Anggota",
    division: member.division,
    status: member.status
  });
  
  QRCode.toCanvas(document.createElement("canvas"), qrData, {
    width: 300,
    margin: 2,
    color: { dark: "#059669", light: "#ffffff" }
  }, function(error, canvas) {
    if (error) {
      qrContainer.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Gagal membuat QR Code</p></div>';
      Toast.error("Gagal membuat QR Code");
      return;
    }
    
    AppState.currentQRCanvas = canvas;
    AppState.currentQRMember = member;
    
    qrContainer.innerHTML = "";
    canvas.style.width = "200px";
    canvas.style.height = "200px";
    qrContainer.appendChild(canvas);
    
    if (infoContainer) {
      infoContainer.innerHTML = `
        <div class="member-info-card">
          <h4><i class="fas fa-id-card"></i> DATA DIRI ANGGOTA</h4>
          <p><strong>Nama:</strong> ${member.name}</p>
          <p><strong>JK:</strong> ${getGenderText(member.gender)}</p>
          <p><strong>Kode:</strong> ${member.code}</p>
          <p><strong>Jabatan:</strong> ${member.position || "Anggota"}</p>
          <p><strong>Divisi:</strong> ${member.division}</p>
          <p><strong>Status:</strong> <span class="status-badge status-active">AKTIF</span></p>
        </div>
      `;
    }
    Toast.success(`QR Code untuk ${member.name} berhasil dibuat`);
  });
}

function downloadQRAsPNG() {
  if (!AppState.currentQRCanvas || !AppState.currentQRMember) { Toast.warning("Generate QR Code terlebih dahulu!"); return; }
  const member = AppState.currentQRMember;
  const finalCanvas = document.createElement("canvas");
  const ctx = finalCanvas.getContext("2d");
  const qrSize = 400, padding = 30;
  const width = qrSize + padding * 2;
  const height = qrSize + 200;
  finalCanvas.width = width;
  finalCanvas.height = height;
  
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#059669";
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, width - 10, height - 10);
  ctx.fillStyle = "#059669";
  ctx.fillRect(0, 0, width, 50);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px Inter";
  ctx.textAlign = "center";
  ctx.fillText("IRMANUFA QR CODE", width / 2, 33);
  ctx.drawImage(AppState.currentQRCanvas, padding, 60, qrSize, qrSize);
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 14px Inter";
  ctx.fillText("DATA DIRI ANGGOTA", width / 2, qrSize + 85);
  ctx.font = "12px Inter";
  ctx.fillStyle = "#334155";
  ctx.textAlign = "left";
  const startY = qrSize + 110;
  ctx.fillText(`Nama: ${member.name}`, padding + 20, startY);
  ctx.fillText(`Jenis Kelamin: ${getGenderText(member.gender)}`, padding + 20, startY + 22);
  ctx.fillText(`Kode Member: ${member.code}`, padding + 20, startY + 44);
  ctx.fillText(`Jabatan: ${member.position || "Anggota"}`, padding + 20, startY + 66);
  ctx.fillText(`Divisi: ${member.division}`, padding + 20, startY + 88);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px Inter";
  ctx.textAlign = "center";
  ctx.fillText(`Dicetak: ${formatDate()}`, width / 2, height - 15);
  
  const link = document.createElement("a");
  link.download = `QR_${member.name.replace(/\s/g, "_")}_${member.code}.png`;
  link.href = finalCanvas.toDataURL();
  link.click();
  Toast.success("QR Code berhasil diunduh!");
}

function downloadQRAsPDF() {
  if (!AppState.currentQRCanvas || !AppState.currentQRMember) { Toast.warning("Generate QR Code terlebih dahulu!"); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const member = AppState.currentQRMember;
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, 210, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("IRMANUFA QR ABSENSI", 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.text("Ikatan Remaja Masjid Jami Nurul Falah", 105, 28, { align: "center" });
  const qrDataUrl = AppState.currentQRCanvas.toDataURL();
  doc.addImage(qrDataUrl, "PNG", 55, 45, 80, 80);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("DATA DIRI ANGGOTA", 105, 140, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nama Lengkap      : ${member.name}`, 25, 155);
  doc.text(`Jenis Kelamin     : ${getGenderText(member.gender)}`, 25, 165);
  doc.text(`Kode Member       : ${member.code}`, 25, 175);
  doc.text(`Jabatan           : ${member.position || "Anggota"}`, 25, 185);
  doc.text(`Divisi            : ${member.division}`, 25, 195);
  doc.text(`Status            : AKTIF`, 25, 205);
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 270, 210, 27, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.text(`Dicetak: ${formatDate()}`, 105, 282, { align: "center" });
  doc.text("Sistem Absensi Digital IRMANUFA - Kabinet Golden Generation 2027-2029", 105, 289, { align: "center" });
  doc.save(`QR_${member.name.replace(/\s/g, "_")}_${member.code}.pdf`);
  Toast.success("QR Code PDF berhasil diunduh!");
}

// ==================== CRUD MEMBERS ====================
function addMember(member) { 
  const newId = (Math.max(...AppState.members.map(m => parseInt(m.id)), 0) + 1).toString(); 
  const newMember = { ...member, id: newId }; 
  AppState.members.push(newMember); 
  saveMembers(); 
  updateAllDisplays(); 
  updateMemberSelect(); 
  Toast.success(`Anggota ${member.name} ditambahkan!`); 
}

function updateMember(id, updatedData) { 
  const index = AppState.members.findIndex(m => m.id === id); 
  if (index !== -1) { 
    AppState.members[index] = { ...AppState.members[index], ...updatedData }; 
    saveMembers(); 
    updateAllDisplays(); 
    updateMemberSelect(); 
    Toast.success(`Data anggota diupdate!`); 
  } 
}

function showDeleteConfirmModal(id) { 
  const member = getMemberById(id); 
  if (!member) return; 
  const modal = document.createElement("div"); 
  modal.className = "modal-overlay"; 
  modal.innerHTML = `<div class="modal" style="max-width: 400px;"><div class="modal-header" style="background: #fee2e2;"><h3 style="color: #dc2626;"><i class="fas fa-trash-alt"></i> Hapus Anggota</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div><div style="text-align: center; padding: 20px 0;"><i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f59e0b;"></i><p>Hapus anggota <strong>${member.name}</strong>?</p></div><div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-danger" onclick="confirmDeleteMember('${id}')">Hapus</button></div></div>`; 
  document.body.appendChild(modal); 
}

function confirmDeleteMember(id) { 
  AppState.members = AppState.members.filter(m => m.id !== id); 
  saveMembers(); 
  updateAllDisplays(); 
  updateMemberSelect(); 
  Toast.success("Anggota dihapus!"); 
  document.querySelector(".modal-overlay")?.remove(); 
}

function showAddMemberModal() { 
  const modal = document.createElement("div"); 
  modal.className = "modal-overlay"; 
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3><i class="fas fa-user-plus"></i> Tambah Anggota</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div><div class="input-group"><label>Kode</label><input type="text" id="memberCode" placeholder="26.09.001"></div><div class="input-group"><label>Nama</label><input type="text" id="memberName"></div><div class="input-group"><label>JK</label><select id="memberGender"><option value="L">Laki-laki</option><option value="P">Perempuan</option></select></div><div class="input-group"><label>Jabatan</label><input type="text" id="memberPosition"></div><div class="input-group"><label>Divisi</label><input type="text" id="memberDivision"></div><div class="input-group"><label>Status</label><select id="memberStatus"><option value="active">Aktif</option><option value="passive">Pasif</option></select></div><div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-primary" onclick="saveNewMember()">Simpan</button></div></div>`; 
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
  addMember({ code, name, gender, position: position || "Anggota", division: division || "Divisi Baru", status }); 
  document.querySelector(".modal-overlay")?.remove(); 
}

function showEditMemberModal(id) { 
  const member = getMemberById(id); 
  if (!member) return; 
  const modal = document.createElement("div"); 
  modal.className = "modal-overlay"; 
  modal.innerHTML = `<div class="modal"><div class="modal-header"><h3><i class="fas fa-user-edit"></i> Edit Anggota</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div><div class="input-group"><label>Kode</label><input type="text" id="memberCode" value="${member.code}"></div><div class="input-group"><label>Nama</label><input type="text" id="memberName" value="${member.name.replace(/"/g, "&quot;")}"></div><div class="input-group"><label>JK</label><select id="memberGender"><option value="L" ${member.gender === "L" ? "selected" : ""}>Laki-laki</option><option value="P" ${member.gender === "P" ? "selected" : ""}>Perempuan</option></select></div><div class="input-group"><label>Jabatan</label><input type="text" id="memberPosition" value="${member.position || ""}"></div><div class="input-group"><label>Divisi</label><input type="text" id="memberDivision" value="${member.division || ""}"></div><div class="input-group"><label>Status</label><select id="memberStatus"><option value="active" ${member.status === "active" ? "selected" : ""}>Aktif</option><option value="passive" ${member.status === "passive" ? "selected" : ""}>Pasif</option></select></div><div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-primary" onclick="updateExistingMember('${id}')">Simpan</button></div></div>`; 
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
  if (AppState.members.some(m => m.id !== id && m.code === code)) { Toast.warning("Kode sudah digunakan!"); return; } 
  updateMember(id, { code, name, gender, position: position || "Anggota", division: division || "Divisi Baru", status }); 
  document.querySelector(".modal-overlay")?.remove(); 
}

// ==================== STATISTICS ====================
function getTodayAttendance() { 
  const today = new Date().toDateString(); 
  return AppState.attendance.filter(a => new Date(a.timestamp).toDateString() === today); 
}

function getStats() {
  const activeMembers = AppState.members.filter(m => m.status === "active").length;
  const todayCount = getTodayAttendance().length;
  const totalAttendance = AppState.attendance.length;
  const memberCount = {}; 
  AppState.attendance.forEach(a => { memberCount[a.memberName] = (memberCount[a.memberName] || 0) + 1; });
  const topMembers = Object.entries(memberCount).map(([name, count]) => ({ name, count, division: AppState.attendance.find(a => a.memberName === name)?.division || "-" })).sort((a, b) => b.count - a.count).slice(0, 5);
  const divisionStats = {};
  AppState.members.forEach(m => { if (m.status === "active") { if (!divisionStats[m.division]) divisionStats[m.division] = { total: 0, attended: 0 }; divisionStats[m.division].total++; } });
  getTodayAttendance().forEach(a => { if (divisionStats[a.division]) divisionStats[a.division].attended++; });
  return { activeMembers, todayCount, totalAttendance, topMembers, divisionStats };
}

// ==================== RENDER FUNCTIONS ====================
function renderMemberTable(searchTerm = "") {
  const container = document.getElementById("memberTableBody");
  if (!container) return;
  let members = [...AppState.members];
  if (searchTerm) members = members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.code.toLowerCase().includes(searchTerm.toLowerCase()) || m.division.toLowerCase().includes(searchTerm.toLowerCase()));
  if (members.length === 0) { container.innerHTML = '<tr><td colspan="7" class="empty-state">Tidak ada anggota</td></tr>'; return; }
  const todayAttended = getTodayAttendance().map(a => a.memberId);
  container.innerHTML = members.map(m => `
    <tr>
      <td style="padding: 12px;">${m.code}</td>
      <td style="padding: 12px;"><strong>${m.name}</strong><br><small>${getGenderText(m.gender)}</small></td>
      <td style="padding: 12px;">${m.division}</td>
      <td style="padding: 12px;">${m.position || "Anggota"}</td>
      <td style="padding: 12px;"><span class="status-badge ${m.status === "active" ? "status-active" : "status-passive"}">${m.status === "active" ? "Aktif" : "Pasif"}</span></td>
      <td style="padding: 12px;"><span class="status-badge ${todayAttended.includes(m.id) ? "status-hadir" : "status-belum"}">${todayAttended.includes(m.id) ? "Hadir" : "Belum"}</span></td>
      <td style="padding: 12px;">
        <button class="btn btn-warning btn-sm" onclick="showEditMemberModal('${m.id}')" style="padding: 4px 10px; margin-right: 5px;"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-sm" onclick="showDeleteConfirmModal('${m.id}')" style="padding: 4px 10px;"><i class="fas fa-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

function renderTopMembers() { 
  const stats = getStats(); 
  const container = document.getElementById("topMembersList"); 
  if (!container) return; 
  if (stats.topMembers.length === 0) { 
    container.innerHTML = '<div class="empty-state"><i class="fas fa-trophy"></i><p>Belum ada data</p></div>'; 
    return; 
  } 
  container.innerHTML = stats.topMembers.map((m, i) => `
    <div style="display: flex; align-items: center; padding: 12px; background: #f1f5f9; border-radius: 12px; margin-bottom: 8px;">
      <div style="width: 36px; height: 36px; background: ${i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : "#059669"}; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 12px;">${i + 1}</div>
      <div style="flex:1;"><h4 style="margin-bottom: 4px;">${m.name}</h4><div style="display: flex; gap: 16px; font-size: 11px; color: #64748b;"><span><i class="fas fa-check-circle"></i> ${m.count} kali</span><span><i class="fas fa-users"></i> ${m.division}</span></div></div>
    </div>
  `).join(""); 
}

function renderRecentAttendance() { 
  const container = document.getElementById("recentAttendanceList"); 
  if (!container) return; 
  const recent = [...AppState.attendance].reverse().slice(0, 10); 
  if (recent.length === 0) { 
    container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>Belum ada absensi</p></div>'; 
    return; 
  } 
  container.innerHTML = recent.map(a => `
    <div style="display: flex; align-items: center; padding: 12px; background: #f1f5f9; border-radius: 12px; margin-bottom: 8px;">
      <div style="width: 36px; height: 36px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 12px;">✓</div>
      <div style="flex:1;"><h4 style="margin-bottom: 4px;">${a.memberName}</h4><div style="display: flex; gap: 16px; font-size: 11px; color: #64748b;"><span><i class="fas fa-clock"></i> ${a.time}</span><span><i class="fas fa-calendar"></i> ${a.date.split(",")[0]}</span></div>${a.kegiatan ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px;"><i class="fas fa-tag"></i> ${a.kegiatan.substring(0, 30)}</div>` : ""}</div>
    </div>
  `).join(""); 
}

function updateCharts() {
  const stats = getStats();
  const ctx1 = document.getElementById("attendanceChart");
  if (ctx1) {
    const last7Days = []; 
    for (let i = 6; i >= 0; i--) { 
      const date = new Date(); 
      date.setDate(date.getDate() - i); 
      const count = AppState.attendance.filter(a => new Date(a.timestamp).toDateString() === date.toDateString()).length; 
      last7Days.push({ date: date.toLocaleDateString("id-ID", { day: "numeric", month: "short" }), count }); 
    }
    if (AppState.attendanceChart) AppState.attendanceChart.destroy();
    AppState.attendanceChart = new Chart(ctx1, { 
      type: "line", 
      data: { 
        labels: last7Days.map(d => d.date), 
        datasets: [{ label: "Jumlah Absensi", data: last7Days.map(d => d.count), borderColor: "#059669", backgroundColor: "rgba(5,150,105,0.1)", fill: true, tension: 0.4 }] 
      }, 
      options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } } 
    });
  }
  const ctx2 = document.getElementById("divisionChart");
  if (ctx2 && Object.keys(stats.divisionStats).length > 0) {
    const divisionNames = Object.keys(stats.divisionStats);
    const attendanceRates = divisionNames.map(d => (stats.divisionStats[d].attended / stats.divisionStats[d].total) * 100);
    const divisionColors = divisionNames.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
    if (AppState.divisionChart) AppState.divisionChart.destroy();
    AppState.divisionChart = new Chart(ctx2, { 
      type: "bar", 
      data: { 
        labels: divisionNames, 
        datasets: [{ label: "Persentase Kehadiran (%)", data: attendanceRates, backgroundColor: divisionColors, borderColor: divisionColors, borderWidth: 1, borderRadius: 8 }] 
      }, 
      options: { 
        responsive: true, maintainAspectRatio: false, 
        scales: { 
          y: { beginAtZero: true, max: 100, title: { display: true, text: "Persentase (%)" }, ticks: { callback: value => value + "%" } }, 
          x: { title: { display: true, text: "Divisi" }, ticks: { rotation: 45, maxRotation: 45, minRotation: 45, font: { size: 10 } } } 
        }, 
        plugins: { tooltip: { callbacks: { label: context => `${context.raw.toFixed(1)}%` } }, legend: { position: "top" } } 
      } 
    });
  }
}

function updateStatsCards() { 
  const stats = getStats(); 
  const activeEl = document.getElementById("activeMembers"); 
  const todayEl = document.getElementById("todayCount"); 
  const totalEl = document.getElementById("totalAttendance"); 
  if (activeEl) activeEl.textContent = stats.activeMembers; 
  if (todayEl) todayEl.textContent = stats.todayCount; 
  if (totalEl) totalEl.textContent = stats.totalAttendance; 
}

function updateAllDisplays() { 
  updateStatsCards(); 
  renderMemberTable(); 
  renderTopMembers(); 
  renderRecentAttendance(); 
  updateCharts(); 
}

// ==================== REPORT & WA ====================
function generateReport() { 
  const startDate = document.getElementById("startDate")?.value; 
  const endDate = document.getElementById("endDate")?.value; 
  let data = [...AppState.attendance]; 
  if (startDate && endDate) { 
    const start = new Date(startDate); 
    const end = new Date(endDate); 
    end.setHours(23, 59, 59); 
    data = data.filter(a => { const d = new Date(a.timestamp); return d >= start && d <= end; }); 
  } 
  if (data.length === 0) { Toast.warning("Tidak ada data"); return; } 
  generatePDFWithKegiatan(data); 
}

function generatePDFWithKegiatan(data) { 
  const { jsPDF } = window.jspdf; 
  const doc = new jsPDF({ unit: "mm", format: "a4" }); 
  doc.setFillColor(5, 150, 105); 
  doc.rect(0, 0, 210, 45, "F"); 
  doc.setTextColor(255, 255, 255); 
  doc.setFontSize(18); 
  doc.text("LAPORAN ABSENSI IRMANUFA", 105, 20, { align: "center" }); 
  doc.setFontSize(12); 
  doc.text(`Kegiatan: ${AppState.currentKegiatan}`, 105, 32, { align: "center" }); 
  doc.setFontSize(10); 
  doc.text(`Tanggal Cetak: ${formatDate()}`, 105, 40, { align: "center" }); 
  let y = 55; 
  doc.setFillColor(5, 150, 105); 
  doc.rect(10, y, 190, 8, "F"); 
  doc.setTextColor(255, 255, 255); 
  doc.text("No", 15, y + 6); 
  doc.text("Nama", 40, y + 6); 
  doc.text("Divisi", 90, y + 6); 
  doc.text("Jabatan", 130, y + 6); 
  doc.text("Waktu", 170, y + 6); 
  y += 10; 
  doc.setTextColor(0, 0, 0); 
  data.slice().reverse().forEach((item, i) => { 
    if (y > 270) { doc.addPage(); y = 20; } 
    doc.text(`${i + 1}`, 15, y + 4); 
    doc.text(item.memberName.substring(0, 25), 40, y + 4); 
    doc.text(item.division.substring(0, 20), 90, y + 4); 
    doc.text(item.position.substring(0, 15), 130, y + 4); 
    doc.text(item.time, 170, y + 4); 
    y += 7; 
  }); 
  doc.save(`Laporan_Absensi_${AppState.currentKegiatan.replace(/\s/g, "_")}_${Date.now()}.pdf`); 
  Toast.success("Laporan berhasil diunduh!"); 
}

function exportToExcel() { 
  const data = AppState.attendance.map(a => ({ 
    Kode: a.memberCode, Nama: a.memberName, JK: a.memberGender === "L" ? "Laki-laki" : "Perempuan", 
    Divisi: a.division, Jabatan: a.position, Tanggal: a.date, Waktu: a.time, 
    Kegiatan: a.kegiatan || AppState.currentKegiatan, Metode: a.method === "qr" ? "QR Code" : "Manual" 
  })); 
  if (data.length === 0) { Toast.warning("Tidak ada data"); return; } 
  const headers = Object.keys(data[0]); 
  const csv = [headers.join(","), ...data.map(obj => headers.map(h => JSON.stringify(obj[h] || "")).join(","))].join("\n"); 
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); 
  const url = URL.createObjectURL(blob); 
  const a = document.createElement("a"); 
  a.href = url; 
  a.download = `Absensi_IRMANUFA_${Date.now()}.csv`; 
  a.click(); 
  URL.revokeObjectURL(url); 
  Toast.success("Data berhasil diexport!"); 
}

function showWhatsAppModal() {
  const modal = document.createElement("div");
  modal.className = "modal-overlay whatsapp-modal";
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3><i class="fab fa-whatsapp"></i> Kirim via WhatsApp</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div>
      <div class="input-group"><label>Nomor WhatsApp</label><input type="tel" id="waNumber" placeholder="081234567890"><small>Masukkan nomor tanpa awalan 0 (contoh: 6281234567890)</small></div>
      <div class="input-group"><label>Pilih Laporan</label><select id="reportType"><option value="today">Absensi Hari Ini</option><option value="all">Laporan Lengkap</option></select></div>
      <div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-success" onclick="sendWhatsApp()"><i class="fab fa-whatsapp"></i> Kirim</button></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function sendWhatsApp() {
  let phone = document.getElementById("waNumber")?.value.trim();
  const reportType = document.getElementById("reportType")?.value;
  if (!phone) { Toast.warning("Masukkan nomor WhatsApp!"); return; }
  phone = phone.replace(/[^0-9]/g, "");
  if (phone.startsWith("0")) phone = "62" + phone.substring(1);
  if (!phone.startsWith("62")) phone = "62" + phone;
  
  const stats = getStats();
  const todayAttendance = getTodayAttendance();
  let message = "";
  if (reportType === "today") {
    message = `📊 *LAPORAN ABSENSI HARI INI - IRMANUFA* 📊\n\n📅 *Tanggal:* ${formatDate()}\n📌 *Kegiatan:* ${AppState.currentKegiatan}\n━━━━━━━━━━━━━━━━━━━━\n✅ *Kehadiran:* ${stats.todayCount} dari ${stats.activeMembers} anggota aktif\n📈 *Persentase:* ${Math.round((stats.todayCount / stats.activeMembers) * 100)}%\n━━━━━━━━━━━━━━━━━━━━\n*Daftar Hadir:*\n${todayAttendance.length > 0 ? todayAttendance.map((a, i) => `${i + 1}. ${a.memberName} - ${a.division} (${a.time})`).join("\n") : "Belum ada yang absen"}\n━━━━━━━━━━━━━━━━━━━━\n_Dikirim dari Sistem Absensi IRMANUFA_`;
  } else {
    message = `📊 *LAPORAN LENGKAP ABSENSI IRMANUFA* 📊\n\n📌 *Kegiatan:* ${AppState.currentKegiatan}\n━━━━━━━━━━━━━━━━━━━━\n📈 *Total Absensi:* ${AppState.attendance.length} kali\n👥 *Total Anggota:* ${AppState.members.length} orang\n✅ *Anggota Aktif:* ${stats.activeMembers} orang\n━━━━━━━━━━━━━━━━━━━━\n_Dikirim dari Sistem Absensi IRMANUFA_`;
  }
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
  document.querySelector(".modal-overlay")?.remove();
  Toast.success("Membuka WhatsApp...");
}

function resetAllData() { 
  showConfirmModal("Hapus Semua Data Absensi", "Yakin ingin menghapus SEMUA data absensi?", () => { 
    AppState.attendance = []; 
    saveAttendance(); 
    updateAllDisplays(); 
    renderTodayScanHistory(); 
    Toast.success("Data absensi direset!"); 
  }); 
}

function resetMembersToDefault() { 
  showConfirmModal("Reset Data Anggota", "Yakin ingin mereset data anggota ke default?", () => { 
    localStorage.removeItem(CONFIG.STORAGE_KEYS.MEMBERS); 
    loadData(); 
    updateAllDisplays(); 
    updateMemberSelect(); 
    Toast.success("Data anggota direset!"); 
  }); 
}

function showConfirmModal(title, message, onConfirm) { 
  const modal = document.createElement("div"); 
  modal.className = "modal-overlay"; 
  modal.innerHTML = `<div class="modal" style="max-width: 400px;"><div class="modal-header" style="background: #fef3c7;"><h3 style="color: #d97706;"><i class="fas fa-exclamation-triangle"></i> ${title}</h3><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button></div><div style="text-align: center; padding: 20px 0;"><i class="fas fa-question-circle" style="font-size: 48px; color: #f59e0b;"></i><p style="margin-top: 10px;">${message}</p></div><div class="modal-buttons"><button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Batal</button><button class="btn btn-danger" id="confirmDeleteBtn">Ya, Hapus</button></div></div>`; 
  document.body.appendChild(modal); 
  document.getElementById("confirmDeleteBtn").onclick = () => { modal.remove(); onConfirm(); }; 
}

// ==================== NAVIGATION ====================
function toggleMenu() { document.querySelector(".sidebar")?.classList.toggle("active"); document.querySelector(".sidebar-overlay")?.classList.toggle("active"); }
function closeMenu() { document.querySelector(".sidebar")?.classList.remove("active"); document.querySelector(".sidebar-overlay")?.classList.remove("active"); }

function showSection(section) {
  AppState.activeSection = section;
  document.querySelectorAll(".menu-item").forEach(item => { item.classList.remove("active"); if (item.dataset.section === section) item.classList.add("active"); });
  document.querySelectorAll(".content-section").forEach(sec => sec.classList.remove("active"));
  document.getElementById(section + "Section")?.classList.add("active");
  if (section === "dashboard") setTimeout(() => { updateCharts(); renderRecentAttendance(); renderTopMembers(); }, 100);
  if (section === "members") renderMemberTable();
  if (section === "scanner") { renderTodayScanHistory(); const scanResultDiv = document.getElementById("scanResult"); if (scanResultDiv) scanResultDiv.style.display = "none"; }
  if (section === "reports") { 
    const today = new Date(); 
    const weekAgo = new Date(); 
    weekAgo.setDate(weekAgo.getDate() - 7); 
    if (document.getElementById("startDate")) { 
      document.getElementById("startDate").value = weekAgo.toISOString().split("T")[0]; 
      document.getElementById("endDate").value = today.toISOString().split("T")[0]; 
    } 
    const kegiatanInput = document.getElementById("kegiatanName"); 
    if (kegiatanInput) { 
      kegiatanInput.value = AppState.currentKegiatan; 
      kegiatanInput.addEventListener("change", e => saveKegiatan(e.target.value)); 
    } 
  }
  if (section === "generator") { 
    updateMemberSelect(); 
    const qrContainer = document.getElementById("qrCodeDisplay"); 
    if (qrContainer) qrContainer.innerHTML = '<div class="empty-state"><i class="fas fa-qrcode" style="font-size: 80px;"></i><p>Pilih anggota dan klik Generate</p></div>'; 
    const infoContainer = document.getElementById("memberInfoDisplay"); 
    if (infoContainer) infoContainer.innerHTML = '<div class="member-info-card"><h4><i class="fas fa-info-circle"></i> Informasi</h4><p style="text-align:center;">Pilih anggota dan klik "Generate QR Code"</p></div>'; 
  }
  closeMenu();
}

function logout() { 
  showConfirmModal("Keluar", "Yakin ingin keluar?", () => { 
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH); 
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_USER); 
    location.reload(); 
  }); 
}

// ==================== LOGIN MULTI USER ====================
let selectedUser = "admin";

function selectUser(userId) {
  selectedUser = userId;
  document.querySelectorAll(".user-option").forEach(opt => opt.classList.remove("active"));
  document.getElementById(`user-${userId}`).classList.add("active");
}

function handleLogin(e) {
  e.preventDefault();
  const password = document.getElementById("password").value;
  const user = CONFIG.USERS[selectedUser];
  if (user && password === user.password) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH, "true");
    localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_USER, JSON.stringify({ id: selectedUser, ...user }));
    renderDashboard();
    Toast.success(`Login berhasil! Selamat datang ${user.name}.`);
  } else {
    Toast.error("Password salah!");
  }
  return false;
}

function togglePassword() { 
  const input = document.getElementById("password"); 
  const icon = document.querySelector(".toggle-password i"); 
  if (input.type === "password") { 
    input.type = "text"; 
    icon.classList.replace("fa-eye", "fa-eye-slash"); 
  } else { 
    input.type = "password"; 
    icon.classList.replace("fa-eye-slash", "fa-eye"); 
  } 
}

// ==================== RENDER DASHBOARD ====================
function renderDashboard() {
  loadData();
  const storedUser = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_USER);
  AppState.currentUser = storedUser ? JSON.parse(storedUser) : CONFIG.USERS.admin;
  const stats = getStats();
  const activeCount = AppState.members.filter(m => m.status === "active").length;
  const passiveCount = AppState.members.filter(m => m.status === "passive").length;

  const avatarHtml = `<img src="${AppState.currentUser.avatar}" alt="${AppState.currentUser.name}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(255,255,255,0.3); box-shadow: 0 8px 20px rgba(0,0,0,0.2);" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'${AppState.currentUser.avatarFallback}\\' style=\\'font-size: 48px;\\'></i>'">`;

  document.getElementById("app").innerHTML = `
    <div class="dashboard">
      <nav class="navbar"><div class="nav-content"><div class="nav-brand"><div class="logo-icon"><i class="fas fa-mosque"></i></div><div><h1>IRMANUFA QR Absensi</h1><small>Kabinet Golden Generation</small></div></div><div class="nav-stats"><span class="stat-badge"><i class="fas fa-users"></i> ${activeCount} Aktif</span><span class="stat-badge"><i class="fas fa-calendar-check"></i> ${stats.todayCount} Hadir</span><span class="stat-badge"><i class="fas fa-user-clock"></i> ${passiveCount} Pasif</span></div><button class="hamburger-btn" onclick="toggleMenu()"><i class="fas fa-bars"></i></button></div></nav>
      <div class="sidebar"><div class="sidebar-header"><div class="user-avatar" style="display: flex; justify-content: center;">${avatarHtml}</div><div class="user-info" style="text-align: center;"><h3>${AppState.currentUser.name}</h3><p>${AppState.currentUser.role}</p><div class="user-badge"><i class="fas fa-shield-alt"></i> ${AppState.currentUser.role === "Super Admin" ? "Super Admin" : "Sekretariat"}</div></div></div><div class="sidebar-menu"><a href="#" class="menu-item active" data-section="dashboard" onclick="showSection('dashboard')"><i class="fas fa-home"></i><span>Dashboard</span></a><a href="#" class="menu-item" data-section="scanner" onclick="showSection('scanner')"><i class="fas fa-qrcode"></i><span>Scan QR Code</span><span class="menu-badge">New</span></a><a href="#" class="menu-item" data-section="generator" onclick="showSection('generator')"><i class="fas fa-print"></i><span>Cetak QR Code</span></a><a href="#" class="menu-item" data-section="members" onclick="showSection('members')"><i class="fas fa-users"></i><span>Data Anggota</span></a><a href="#" class="menu-item" data-section="reports" onclick="showSection('reports')"><i class="fas fa-chart-line"></i><span>Laporan</span></a><a href="#" class="menu-item" onclick="logout()"><i class="fas fa-sign-out-alt"></i><span>Keluar</span></a></div></div>
      <div class="sidebar-overlay" onclick="closeMenu()"></div>
      <div class="main-content">
        <div class="welcome-card"><div class="welcome-text"><h2>Selamat Datang, ${AppState.currentUser.name.split(" ")[0]}!</h2><p>Sistem Absensi Digital IRMANUFA</p><small><i class="fas fa-qrcode"></i> Scan QR Code | <i class="fas fa-check-circle"></i> Hanya anggota AKTIF</small></div><div class="date-info"><div class="time" id="currentTime">${formatTime()}</div><div class="date" id="currentDate">${formatDate()}</div></div></div>
        <section id="dashboardSection" class="content-section active"><div class="stats-grid"><div class="stat-card"><div class="stat-icon"><i class="fas fa-users"></i></div><div class="stat-number" id="activeMembers">${stats.activeMembers}</div><div class="stat-label">Anggota Aktif</div></div><div class="stat-card"><div class="stat-icon"><i class="fas fa-calendar-day"></i></div><div class="stat-number" id="todayCount">${stats.todayCount}</div><div class="stat-label">Hadir Hari Ini</div></div><div class="stat-card"><div class="stat-icon"><i class="fas fa-chart-line"></i></div><div class="stat-number" id="totalAttendance">${stats.totalAttendance}</div><div class="stat-label">Total Absensi</div></div></div><div class="card"><div class="card-header"><i class="fas fa-chart-line"></i><h3>Tren Absensi 7 Hari</h3></div><div class="chart-wrapper"><canvas id="attendanceChart"></canvas></div></div><div class="card"><div class="card-header"><i class="fas fa-chart-pie"></i><h3>Kehadiran per Divisi</h3><small>(Warna berbeda setiap divisi)</small></div><div class="chart-wrapper"><canvas id="divisionChart"></canvas></div></div><div class="card"><div class="card-header"><i class="fas fa-trophy"></i><h3>Top 5 Terrajin</h3></div><div id="topMembersList" class="ranking-list"></div></div><div class="card"><div class="card-header"><i class="fas fa-history"></i><h3>Absensi Terbaru</h3></div><div id="recentAttendanceList" class="ranking-list"></div></div></section>
        <section id="scannerSection" class="content-section"><div class="card"><div class="card-header"><i class="fas fa-qrcode"></i><h3>Scan QR Code</h3><small>Arahkan kamera ke QR Code</small></div><div class="scanner-header"><button id="flashToggleBtn" class="flash-btn" onclick="toggleFlash()"><i class="fas fa-lightbulb"></i> Flash OFF</button></div><div class="scanner-container"><div id="reader" class="empty-state"><i class="fas fa-camera"></i><p>Scanner siap. Klik "Mulai Scan"</p></div></div><div class="action-buttons"><button class="btn btn-primary" onclick="startScanner()"><i class="fas fa-play"></i> Mulai Scan</button><button class="btn btn-danger" onclick="stopScanner()"><i class="fas fa-stop"></i> Hentikan</button></div></div><div class="card"><div class="card-header"><i class="fas fa-table"></i><h3>Hasil Scan Hari Ini</h3><small>Klik Edit/Hapus untuk mengubah data</small></div><div id="todayScanHistory"></div></div><div class="info-card"><i class="fas fa-info-circle"></i> <strong>Info:</strong><ol><li>Klik "Mulai Scan" → Izinkan kamera</li><li>Arahkan ke QR Code anggota</li><li>Suara "berhasil.mp3" jika berhasil</li><li>Suara "sudah.mp3" jika sudah absen</li><li>Suara "takkenal.mp3" jika tidak dikenali</li><li>Edit/Hapus data di tabel atas</li></ol></div></section>
        <section id="generatorSection" class="content-section"><div class="card"><div class="card-header"><i class="fas fa-print"></i><h3>Cetak QR Code</h3><small>Pilih anggota untuk generate QR Code</small></div><div class="qr-generator-grid"><div class="qr-card-preview"><div class="qr-display" id="qrCodeDisplay" style="min-height: 250px; display: flex; flex-direction: column; align-items: center; justify-content: center;"><i class="fas fa-qrcode" style="font-size: 80px; color: #94a3b8;"></i><p style="margin-top:10px;">Pilih anggota dan klik Generate</p></div><div class="download-buttons"><button class="btn btn-primary" onclick="downloadQRAsPNG()"><i class="fas fa-image"></i> Download PNG</button><button class="btn btn-success" onclick="downloadQRAsPDF()"><i class="fas fa-file-pdf"></i> Download PDF</button></div></div><div><select id="memberSelect" style="width:100%; padding: 12px; border-radius: 12px; border: 2px solid #e2e8f0;"><option value="">✨-- Pilih Anggota Aktif --✨</option></select><button class="btn btn-primary" style="width:100%; margin-top:16px;" onclick="generateMemberQR()"><i class="fas fa-qrcode"></i> Generate QR Code</button><div id="memberInfoDisplay" class="member-info-card" style="margin-top:16px;"><h4><i class="fas fa-info-circle"></i> Informasi</h4><p style="text-align:center;">Pilih anggota dan klik "Generate QR Code"</p></div></div></div></div></section>
        <section id="membersSection" class="content-section"><div class="card"><div class="card-header"><i class="fas fa-users"></i><h3>Data Anggota</h3><small>Total: ${AppState.members.length} (${activeCount} Aktif, ${passiveCount} Pasif)</small><div style="margin-left:auto;"><button class="btn btn-secondary btn-sm" onclick="resetMembersToDefault()"><i class="fas fa-undo"></i> Reset</button> <button class="btn btn-primary btn-sm" onclick="showAddMemberModal()"><i class="fas fa-plus"></i> Tambah</button></div></div><div class="search-box"><input type="text" id="memberSearch" placeholder="Cari nama/kode/divisi..." onkeyup="renderMemberTable(this.value)"></div><div class="table-container"><table class="data-table" style="width:100%; border-collapse: collapse;"><thead><tr style="background: #f1f5f9;"><th style="padding: 12px; text-align: left;">Kode</th><th style="padding: 12px; text-align: left;">Nama</th><th style="padding: 12px; text-align: left;">Divisi</th><th style="padding: 12px; text-align: left;">Jabatan</th><th style="padding: 12px; text-align: left;">Status</th><th style="padding: 12px; text-align: left;">Hari Ini</th><th style="padding: 12px; text-align: left;">Aksi</th></tr></thead><tbody id="memberTableBody"></tbody></table></div></div></section>
        <section id="reportsSection" class="content-section"><div class="card"><div class="card-header"><i class="fas fa-chart-line"></i><h3>Laporan Absensi</h3></div><div class="kegiatan-input"><label><i class="fas fa-tag"></i> Nama Kegiatan</label><input type="text" id="kegiatanName"></div><div class="report-header"><div class="report-date"><label>Dari</label><input type="date" id="startDate"><label>Sampai</label><input type="date" id="endDate"></div></div><div class="action-buttons"><button class="btn btn-primary" onclick="generateReport()"><i class="fas fa-file-pdf"></i> PDF</button><button class="btn btn-success" onclick="exportToExcel()"><i class="fas fa-file-excel"></i> Excel</button><button class="btn btn-info" onclick="showWhatsAppModal()"><i class="fab fa-whatsapp"></i> WhatsApp</button><button class="btn btn-danger" onclick="resetAllData()"><i class="fas fa-trash"></i> Reset Absensi</button></div></div><div class="stats-grid"><div class="stat-card"><div class="stat-icon"><i class="fas fa-database"></i></div><div class="stat-number">${AppState.attendance.length}</div><div class="stat-label">Total Data</div></div><div class="stat-card"><div class="stat-icon"><i class="fas fa-qrcode"></i></div><div class="stat-number">${AppState.attendance.filter(a => a.method === "qr").length}</div><div class="stat-label">QR Code</div></div><div class="stat-card"><div class="stat-icon"><i class="fas fa-user-check"></i></div><div class="stat-number">${new Set(AppState.attendance.map(a => a.memberId)).size}</div><div class="stat-label">Pernah Absen</div></div></div></section>
      </div>
    </div>
  `;

  updateAllDisplays();
  updateMemberSelect();
  renderTodayScanHistory();

  const kegiatanInput = document.getElementById("kegiatanName");
  if (kegiatanInput) { 
    kegiatanInput.value = AppState.currentKegiatan; 
    kegiatanInput.addEventListener("change", e => saveKegiatan(e.target.value)); 
  }

  setInterval(() => { 
    const timeEl = document.getElementById("currentTime"); 
    const dateEl = document.getElementById("currentDate"); 
    if (timeEl) timeEl.textContent = formatTime(); 
    if (dateEl) dateEl.textContent = formatDate(); 
  }, 1000);

  const today = new Date(); 
  const weekAgo = new Date(); 
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (document.getElementById("startDate")) { 
    document.getElementById("startDate").value = weekAgo.toISOString().split("T")[0]; 
    document.getElementById("endDate").value = today.toISOString().split("T")[0]; 
  }
}

function renderLoginPage() {
  document.getElementById("app").innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <div class="login-logo"><div class="logo-icon"><i class="fas fa-mosque"></i></div><h1>IRMANUFA QR Absensi</h1><p>Sistem Absensi Digital Berbasis QR Code</p></div>
        <div class="user-selector" style="display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; justify-content: center;">
          <div id="user-admin" class="user-option active" onclick="selectUser('admin')" style="flex:1; min-width: 110px; text-align: center; padding: 20px 12px; border: 2px solid #e2e8f0; border-radius: 20px; cursor: pointer; transition: all 0.3s; background: white;">
            <img src="admin.png" alt="Admin" style="width: 65px; height: 65px; border-radius: 50%; object-fit: cover; margin: 0 auto 10px; display: block; border: 3px solid #e2e8f0;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width:65px; height:65px; border-radius:50%; background:#e2e8f0; margin:0 auto 10px; display:flex; align-items:center; justify-content:center;\\'><i class=\\'fas fa-user-tie\\' style=\\'font-size: 32px; color:#64748b;\\'></i></div>'">
            <div class="user-name" style="font-weight: 700; font-size: 14px; color: #1e293b; margin-top: 8px;">Admin</div>
            <div class="user-role" style="font-size: 10px; color: #64748b; margin-top: 4px;">Super Admin</div>
          </div>
          <div id="user-tasya" class="user-option" onclick="selectUser('tasya')" style="flex:1; min-width: 110px; text-align: center; padding: 20px 12px; border: 2px solid #e2e8f0; border-radius: 20px; cursor: pointer; transition: all 0.3s; background: white;">
            <img src="tasya.png" alt="Tasya Amelia" style="width: 65px; height: 65px; border-radius: 50%; object-fit: cover; margin: 0 auto 10px; display: block; border: 3px solid #e2e8f0;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width:65px; height:65px; border-radius:50%; background:#e2e8f0; margin:0 auto 10px; display:flex; align-items:center; justify-content:center;\\'><i class=\\'fas fa-user-circle\\' style=\\'font-size: 32px; color:#64748b;\\'></i></div>'">
            <div class="user-name" style="font-weight: 700; font-size: 14px; color: #1e293b; margin-top: 8px;">Tasya Amelia</div>
            <div class="user-role" style="font-size: 10px; color: #64748b; margin-top: 4px;">Sekretaris I</div>
          </div>
          <div id="user-lidya" class="user-option" onclick="selectUser('lidya')" style="flex:1; min-width: 110px; text-align: center; padding: 20px 12px; border: 2px solid #e2e8f0; border-radius: 20px; cursor: pointer; transition: all 0.3s; background: white;">
            <img src="lidya.png" alt="Lidya Febrianti" style="width: 65px; height: 65px; border-radius: 50%; object-fit: cover; margin: 0 auto 10px; display: block; border: 3px solid #e2e8f0;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'width:65px; height:65px; border-radius:50%; background:#e2e8f0; margin:0 auto 10px; display:flex; align-items:center; justify-content:center;\\'><i class=\\'fas fa-user-circle\\' style=\\'font-size: 32px; color:#64748b;\\'></i></div>'">
            <div class="user-name" style="font-weight: 700; font-size: 14px; color: #1e293b; margin-top: 8px;">Lidya Febrianti</div>
            <div class="user-role" style="font-size: 10px; color: #64748b; margin-top: 4px;">Sekretaris II</div>
          </div>
        </div>
        <form onsubmit="return handleLogin(event)">
          <div class="input-group"><label><i class="fas fa-lock"></i> Password</label><div class="password-container"><input type="password" id="password" placeholder="Masukkan password" required><button type="button" class="toggle-password" onclick="togglePassword()"><i class="fas fa-eye"></i></button></div></div>
          <div class="features"><div class="feature"><i class="fas fa-qrcode"></i><span>Scan QR Code</span></div><div class="feature"><i class="fas fa-chart-line"></i><span>Real-time Update</span></div><div class="feature"><i class="fas fa-trophy"></i><span>Ranking Anggota</span></div><div class="feature"><i class="fas fa-file-pdf"></i><span>Laporan PDF/Excel/WA</span></div></div>
          <button type="submit" class="login-btn"><i class="fas fa-sign-in-alt"></i> MASUK</button>
        </form>
        <div class="login-footer"><p>IRMANUFA Kabinet Golden Generation 2027-2029</p><p style="font-size: 10px; margin-top: 8px;">Password: admin123 | tasya123 | lidya123</p></div>
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
  preloadAudios();
  const isLoggedIn = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH) === "true";
  if (!isLoggedIn) renderLoginPage(); else renderDashboard();
});
