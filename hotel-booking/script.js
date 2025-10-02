/*
===============================================
File: script.js
Author: Team 7
Description:
  SPA frontend-only Hotel Booking System with Integrated UI
  - Data persisted in localStorage
  - Full CRUD for all modules
  - Authentication & Role-based access
  - Integrated customer and management interface
Version: 1.0
===============================================
*/

/* =========================
   Data Model & Utilities
   ========================= */

const STORAGE_KEY = "hbs_data_v3";

/**
 * generateId
 * Simple incremental id generator given a collection
 */
function generateId(arr) {
  if (!arr || arr.length === 0) return 1;
  const ids = arr.map(x => 
    x.id || x.role_id || x.user_id || x.booking_id || 
    x.service_id || x.payment_id || x.room_id || 
    x.type_id || x.booking_service_id
  ).filter(id => id !== undefined);
  
  if (ids.length === 0) return 1;
  return Math.max(...ids) + 1;
}

/**
 * formatMoney
 * Format currency in VND
 */
function formatMoney(v) {
  return new Intl.NumberFormat('vi-VN', { 
    style: 'currency', 
    currency: 'VND' 
  }).format(v);
}

/**
 * Simple password hashing (for demo purposes only)
 */
function simpleHash(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

/**
 * Check date overlap for bookings
 */
function checkOverlap(roomId, startISO, endISO, excludeBookingId = null) {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (end <= start) return true;

  return state.bookings.some(b => {
    if (b.booking_id === excludeBookingId) return false;
    if (b.room_id !== roomId) return false;
    if (b.status === 'CANCELLED') return false;
    
    const bStart = new Date(b.check_in_date);
    const bEnd = new Date(b.check_out_date);
    return (start < bEnd) && (bStart < end);
  });
}

/**
 * Calculate total nights between two dates
 */
function calculateNights(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/* =========================
   Sample Data
   ========================= */

const sampleData = {
  roles: [
    { role_id: 1, role_name: "Admin", description: "Quản trị hệ thống" },
    { role_id: 2, role_name: "Manager", description: "Quản lý khách sạn" },
    { role_id: 3, role_name: "Staff", description: "Nhân viên lễ tân" },
    { role_id: 4, role_name: "Customer", description: "Khách hàng" }
  ],
  users: [
    { user_id: 1, full_name: "Nguyễn Văn Admin", email: "admin@hotel.com", phone: "0901234567", address: "Hà Nội", role_id: 1, password_hash: simpleHash("admin123") },
    { user_id: 2, full_name: "Trần Thị Manager", email: "manager@hotel.com", phone: "0912345678", address: "Hà Nội", role_id: 2, password_hash: simpleHash("manager123") },
    { user_id: 3, full_name: "Lê Văn Staff", email: "staff@hotel.com", phone: "0923456789", address: "Hà Nội", role_id: 3, password_hash: simpleHash("staff123") },
    { user_id: 4, full_name: "Nguyễn Văn Khách", email: "customer@email.com", phone: "0934567890", address: "Hà Nội", role_id: 4, password_hash: simpleHash("123456") }
  ],
  roomTypes: [
    { type_id: 1, name: "Phòng Standard", description: "Phòng tiêu chuẩn", capacity: 2, base_price: 500000 },
    { type_id: 2, name: "Phòng Deluxe", description: "Phòng cao cấp", capacity: 4, base_price: 800000 },
    { type_id: 3, name: "Phòng Suite", description: "Phòng hạng sang", capacity: 3, base_price: 1200000 }
  ],
  rooms: [
    { room_id: 1, type_id: 1, room_number: "101", status: "Available", features: "TV, WiFi, Điều hòa" },
    { room_id: 2, type_id: 1, room_number: "102", status: "Available", features: "TV, WiFi, Điều hòa" },
    { room_id: 3, type_id: 2, room_number: "201", status: "Available", features: "TV, WiFi, Điều hòa, Minibar" },
    { room_id: 4, type_id: 2, room_number: "202", status: "Maintenance", features: "TV, WiFi, Điều hòa, Minibar" },
    { room_id: 5, type_id: 3, room_number: "301", status: "Available", features: "TV, WiFi, Điều hòa, Minibar, View" }
  ],
  services: [
    { service_id: 1, name: "Bữa sáng", description: "Buffet sáng", price: 100000 },
    { service_id: 2, name: "Đón sân bay", description: "Dịch vụ đón tiễn sân bay", price: 200000 },
    { service_id: 3, name: "Spa", description: "Dịch vụ spa và massage", price: 500000 },
    { service_id: 4, name: "Giặt ủi", description: "Dịch vụ giặt ủi", price: 80000 }
  ],
  bookings: [
    { booking_id: 1, user_id: 4, room_id: 1, check_in_date: "2025-10-05", check_out_date: "2025-10-07", number_of_guests: 2, status: "CONFIRMED", total_amount: 1000000 }
  ],
  bookingServices: [
    { booking_service_id: 1, booking_id: 1, service_id: 1, quantity: 2, price: 200000 }
  ],
  payments: [
    { payment_id: 1, booking_id: 1, amount: 1000000, payment_method: "Credit Card", payment_date: "2025-10-02", status: "PAID" }
  ],
  currentUser: null
};

/**
 * Load data from localStorage or initialize with sample data
 */
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
    return JSON.parse(JSON.stringify(sampleData));
  }
  try {
    return JSON.parse(raw);
  } catch (ex) {
    console.error("Invalid storage data, resetting.", ex);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleData));
    return JSON.parse(JSON.stringify(sampleData));
  }
}

/**
 * Save data to localStorage
 */
function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/* =========================
   App State
   ========================= */

let state = loadData();

/* =========================
   Authentication System
   ========================= */

function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('main-app').classList.add('hidden');
  state.currentUser = null;
  saveData(state);
}

function showRegisterScreen() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('register-screen').classList.remove('hidden');
}

function showMainApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('register-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');
  updateUIForCurrentUser();
}

function handleLogin(email, password) {
  const user = state.users.find(u => u.email === email);
  
  if (!user) {
    alert("Email không tồn tại trong hệ thống");
    return false;
  }
  
  if (user.password_hash !== simpleHash(password)) {
    alert("Mật khẩu không chính xác");
    return false;
  }
  
  state.currentUser = user;
  saveData(state);
  showMainApp();
  return true;
}

function handleRegister(userData) {
  const { name, email, phone, address, password, confirm } = userData;
  
  if (password !== confirm) {
    alert("Mật khẩu xác nhận không khớp");
    return false;
  }
  
  if (state.users.find(u => u.email === email)) {
    alert("Email đã tồn tại trong hệ thống");
    return false;
  }
  
  const newId = generateId(state.users);
  const newUser = {
    user_id: newId,
    full_name: name,
    email: email,
    phone: phone,
    address: address,
    role_id: 4,
    password_hash: simpleHash(password)
  };
  
  state.users.push(newUser);
  saveData(state);
  
  alert("Đăng ký thành công! Vui lòng đăng nhập.");
  showLoginScreen();
  return true;
}

function handleLogout() {
  if (confirm("Bạn có chắc chắn muốn đăng xuất?")) {
    showLoginScreen();
  }
}

/* =========================
   UI Management
   ========================= */

function updateUIForCurrentUser() {
  const currentUser = state.currentUser;
  if (!currentUser) return;
  
  const userRole = state.roles.find(r => r.role_id === currentUser.role_id);
  
  document.getElementById('current-user').textContent = `Xin chào, ${currentUser.full_name}`;
  document.getElementById('user-role').textContent = userRole.role_name;
  document.getElementById('welcome-message').textContent = 
    `Chào mừng ${currentUser.full_name} đến với hệ thống đặt phòng khách sạn`;
  
  applyUIRestrictions(userRole);
  renderDashboard();
}

function applyUIRestrictions(userRole) {
  const roleName = userRole.role_name;
  
  document.querySelectorAll('[data-role]').forEach(el => {
    el.style.display = 'none';
  });
  
  if (roleName === 'Admin') {
    document.querySelectorAll('[data-role]').forEach(el => {
      el.style.display = '';
    });
  } else if (roleName === 'Manager') {
    document.querySelectorAll('[data-role="staff"], [data-role="manager"]').forEach(el => {
      el.style.display = '';
    });
  } else if (roleName === 'Staff') {
    document.querySelectorAll('[data-role="staff"]').forEach(el => {
      el.style.display = '';
    });
  }
}

function setActiveSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");

  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelector(`.nav-btn[data-section="${id}"]`)?.classList.add("active");
  
  // Render section-specific content
  switch(id) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'booking':
      renderBookingSection();
      break;
    case 'my-bookings':
      renderMyBookings();
      break;
    case 'rooms':
      renderRooms();
      break;
    case 'services':
      renderServices();
      break;
    case 'bookings':
      renderBookings();
      break;
    case 'users':
      renderUsers();
      break;
    case 'payments':
      renderPayments();
      break;
  }
}

/* =========================
   Dashboard
   ========================= */

function renderDashboard() {
  const currentUser = state.currentUser;
  const userRole = state.roles.find(r => r.role_id === currentUser.role_id);
  
  // Update stats
  const availableRooms = state.rooms.filter(r => r.status === 'Available').length;
  const myBookings = state.bookings.filter(b => b.user_id === currentUser.user_id).length;
  const totalBookings = state.bookings.length;
  const pendingPayments = state.payments.filter(p => p.status === 'PENDING').length;
  
  document.getElementById('stat-available-rooms').textContent = availableRooms;
  document.getElementById('stat-my-bookings').textContent = myBookings;
  document.getElementById('stat-total-bookings').textContent = totalBookings;
  document.getElementById('stat-pending-payments').textContent = pendingPayments;
  
  // Show/hide sections based on role
  if (userRole.role_name === 'Customer') {
    renderFeaturedRooms();
    document.getElementById('quick-actions').style.display = 'none';
  } else {
    document.getElementById('featured-rooms').style.display = 'none';
    document.getElementById('quick-actions').style.display = 'block';
  }
}

function renderFeaturedRooms() {
  const roomsGrid = document.getElementById('rooms-grid');
  roomsGrid.innerHTML = '';
  
  const availableRooms = state.rooms.filter(room => room.status === 'Available');
  
  availableRooms.slice(0, 6).forEach(room => {
    const roomType = state.roomTypes.find(t => t.type_id === room.type_id);
    const roomCard = document.createElement('div');
    roomCard.className = 'room-card';
    roomCard.innerHTML = `
      <div class="room-image">🏨</div>
      <div class="room-content">
        <div class="room-title">Phòng ${room.room_number}</div>
        <div class="room-type">${roomType?.name || 'Unknown'}</div>
        <div class="room-features">
          <span class="room-feature">👥 ${roomType?.capacity || 2} người</span>
          <span class="room-feature">🛏️ ${Math.ceil((roomType?.capacity || 2) / 2)} giường</span>
        </div>
        <div class="room-description">${roomType?.description || ''}</div>
        <div class="room-price">${formatMoney(roomType?.base_price || 0)}/đêm</div>
        <button class="book-btn" onclick="startBooking(${room.room_id})">
          Đặt ngay
        </button>
      </div>
    `;
    roomsGrid.appendChild(roomCard);
  });
}

function startBooking(roomId) {
  setActiveSection('booking');
  const room = state.rooms.find(r => r.room_id === roomId);
  if (room) {
    document.getElementById('room-type').value = room.type_id;
    searchAvailableRooms();
  }
}

/* =========================
   Booking Section
   ========================= */

function renderBookingSection() {
  // Populate room types dropdown
  const roomTypeSelect = document.getElementById('room-type');
  roomTypeSelect.innerHTML = '<option value="">Tất cả loại phòng</option>';
  state.roomTypes.forEach(type => {
    roomTypeSelect.innerHTML += `<option value="${type.type_id}">${type.name}</option>`;
  });
  
  // Set default dates
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  document.getElementById('check-in').value = today;
  document.getElementById('check-out').value = tomorrow;
  
  // Clear available rooms
  document.getElementById('available-rooms').innerHTML = '';
}

function searchAvailableRooms() {
  const checkIn = document.getElementById('check-in').value;
  const checkOut = document.getElementById('check-out').value;
  const guests = parseInt(document.getElementById('guests').value);
  const roomTypeId = document.getElementById('room-type').value;
  
  if (!checkIn || !checkOut) {
    alert('Vui lòng chọn ngày nhận và trả phòng');
    return;
  }
  
  if (new Date(checkOut) <= new Date(checkIn)) {
    alert('Ngày trả phòng phải sau ngày nhận phòng');
    return;
  }
  
  const availableRoomsContainer = document.getElementById('available-rooms');
  availableRoomsContainer.innerHTML = '<h3>Đang tìm phòng...</h3>';
  
  setTimeout(() => {
    const availableRooms = state.rooms.filter(room => {
      // Check room status
      if (room.status !== 'Available') return false;
      
      // Check room type filter
      if (roomTypeId && room.type_id != roomTypeId) return false;
      
      // Check capacity
      const roomType = state.roomTypes.find(t => t.type_id === room.type_id);
      if (roomType && roomType.capacity < guests) return false;
      
      // Check booking overlap
      return !checkOverlap(room.room_id, checkIn, checkOut);
    });
    
    renderAvailableRooms(availableRooms, checkIn, checkOut, guests);
  }, 500);
}

function renderAvailableRooms(rooms, checkIn, checkOut, guests) {
  const availableRoomsContainer = document.getElementById('available-rooms');
  
  if (rooms.length === 0) {
    availableRoomsContainer.innerHTML = `
      <div class="no-rooms">
        <h3>Không tìm thấy phòng phù hợp</h3>
        <p>Vui lòng thử lại với tiêu chí khác</p>
      </div>
    `;
    return;
  }
  
  availableRoomsContainer.innerHTML = `
    <h3>${rooms.length} phòng phù hợp</h3>
    <div class="rooms-list">
      ${rooms.map(room => {
        const roomType = state.roomTypes.find(t => t.type_id === room.type_id);
        const nights = calculateNights(checkIn, checkOut);
        const basePrice = roomType.base_price * nights;
        
        return `
          <div class="available-room">
            <div class="room-info">
              <h4>Phòng ${room.room_number} - ${roomType.name}</h4>
              <p>${roomType.description}</p>
              <div class="room-details">
                <span>👥 ${roomType.capacity} người</span>
                <span>🛏️ ${Math.ceil(roomType.capacity / 2)} giường</span>
                <span>🏨 ${nights} đêm</span>
              </div>
              <div class="room-features">${room.features}</div>
            </div>
            <div class="room-pricing">
              <div class="price-breakdown">
                <div>${formatMoney(roomType.base_price)} x ${nights} đêm</div>
                <div class="total-price">${formatMoney(basePrice)}</div>
              </div>
              <button class="book-now-btn primary" onclick="showBookingForm(${room.room_id}, '${checkIn}', '${checkOut}', ${guests})">
                Chọn phòng
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function showBookingForm(roomId, checkIn, checkOut, guests) {
  const room = state.rooms.find(r => r.room_id === roomId);
  const roomType = state.roomTypes.find(t => t.type_id === room.type_id);
  const nights = calculateNights(checkIn, checkOut);
  const basePrice = roomType.base_price * nights;
  
  openModal({
    title: `Đặt phòng ${room.room_number}`,
    body: () => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="booking-summary">
          <h4>Thông tin đặt phòng</h4>
          <p><strong>Phòng:</strong> ${room.room_number} - ${roomType.name}</p>
          <p><strong>Ngày nhận:</strong> ${checkIn}</p>
          <p><strong>Ngày trả:</strong> ${checkOut}</p>
          <p><strong>Số đêm:</strong> ${nights}</p>
          <p><strong>Số khách:</strong> ${guests}</p>
          <p><strong>Giá phòng:</strong> ${formatMoney(basePrice)}</p>
        </div>
        
        <div class="services-selection">
          <h4>Dịch vụ bổ sung</h4>
          ${state.services.map(service => `
            <label class="service-checkbox">
              <input type="checkbox" value="${service.service_id}" data-price="${service.price}">
              <span>${service.name} - ${formatMoney(service.price)}</span>
            </label>
          `).join('')}
        </div>
        
        <div class="total-amount">
          <h4>Tổng cộng: <span id="booking-total">${formatMoney(basePrice)}</span></h4>
        </div>
      `;
      return div;
    },
    onSubmit: () => {
      const selectedServices = Array.from(document.querySelectorAll('.service-checkbox input:checked'))
        .map(input => ({
          service_id: parseInt(input.value),
          price: parseFloat(input.dataset.price),
          quantity: 1
        }));
      
      const servicesTotal = selectedServices.reduce((sum, service) => sum + service.price, 0);
      const totalAmount = basePrice + servicesTotal;
      
      const newBooking = {
        booking_id: generateId(state.bookings),
        user_id: state.currentUser.user_id,
        room_id: roomId,
        check_in_date: checkIn,
        check_out_date: checkOut,
        number_of_guests: guests,
        status: 'PENDING',
        total_amount: totalAmount
      };
      
      state.bookings.push(newBooking);
      
      // Add booking services
      selectedServices.forEach(service => {
        state.bookingServices.push({
          booking_service_id: generateId(state.bookingServices),
          booking_id: newBooking.booking_id,
          service_id: service.service_id,
          quantity: service.quantity,
          price: service.price
        });
      });
      
      saveData(state);
      alert('Đặt phòng thành công!');
      setActiveSection('my-bookings');
      return true;
    }
  });
}

/* =========================
   My Bookings
   ========================= */

function renderMyBookings() {
  const tbody = document.querySelector('#tbl-my-bookings tbody');
  tbody.innerHTML = '';
  
  const myBookings = state.bookings.filter(b => b.user_id === state.currentUser.user_id);
  
  myBookings.forEach(booking => {
    const room = state.rooms.find(r => r.room_id === booking.room_id);
    const roomType = state.roomTypes.find(t => t.type_id === room.type_id);
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${booking.booking_id}</td>
      <td>${room.room_number} - ${roomType.name}</td>
      <td>${booking.check_in_date}</td>
      <td>${booking.check_out_date}</td>
      <td>${formatMoney(booking.total_amount)}</td>
      <td><span class="status-${booking.status.toLowerCase()}">${booking.status}</span></td>
      <td>
        <button class="btn btn-edit" onclick="viewBookingDetails(${booking.booking_id})">Xem</button>
        ${booking.status === 'PENDING' ? `
          <button class="btn btn-delete" onclick="cancelBooking(${booking.booking_id})">Hủy</button>
        ` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function viewBookingDetails(bookingId) {
  const booking = state.bookings.find(b => b.booking_id === bookingId);
  const room = state.rooms.find(r => r.room_id === booking.room_id);
  const roomType = state.roomTypes.find(t => t.type_id === room.type_id);
  const bookingServices = state.bookingServices.filter(bs => bs.booking_id === bookingId);
  
  openModal({
    title: `Chi tiết đơn đặt #${bookingId}`,
    body: () => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="booking-details">
          <p><strong>Phòng:</strong> ${room.room_number} - ${roomType.name}</p>
          <p><strong>Ngày nhận:</strong> ${booking.check_in_date}</p>
          <p><strong>Ngày trả:</strong> ${booking.check_out_date}</p>
          <p><strong>Số khách:</strong> ${booking.number_of_guests}</p>
          <p><strong>Trạng thái:</strong> ${booking.status}</p>
          
          ${bookingServices.length > 0 ? `
            <h4>Dịch vụ đã chọn:</h4>
            <ul>
              ${bookingServices.map(bs => {
                const service = state.services.find(s => s.service_id === bs.service_id);
                return `<li>${service.name} - ${formatMoney(bs.price)}</li>`;
              }).join('')}
            </ul>
          ` : ''}
          
          <h4>Tổng cộng: ${formatMoney(booking.total_amount)}</h4>
        </div>
      `;
      return div;
    },
    onSubmit: () => true
  });
}

function cancelBooking(bookingId) {
  if (confirm('Bạn có chắc chắn muốn hủy đơn đặt này?')) {
    const booking = state.bookings.find(b => b.booking_id === bookingId);
    booking.status = 'CANCELLED';
    saveData(state);
    renderMyBookings();
    alert('Đã hủy đơn đặt thành công');
  }
}

/* =========================
   Rooms Management
   ========================= */

function renderRooms() {
  const tbody = document.querySelector('#tbl-rooms tbody');
  tbody.innerHTML = '';
  
  state.rooms.forEach(room => {
    const roomType = state.roomTypes.find(t => t.type_id === room.type_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${room.room_id}</td>
      <td>${room.room_number}</td>
      <td>${roomType.name}</td>
      <td><span class="status-${room.status.toLowerCase()}">${room.status}</span></td>
      <td>${formatMoney(roomType.base_price)}</td>
      <td>
        <button class="btn btn-edit" onclick="showRoomForm(${room.room_id})">Sửa</button>
        <button class="btn btn-delete" onclick="deleteRoom(${room.room_id})">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function showRoomForm(roomId = null) {
  const room = roomId ? state.rooms.find(r => r.room_id === roomId) : null;
  const isEdit = !!room;
  
  openModal({
    title: isEdit ? 'Sửa thông tin phòng' : 'Thêm phòng mới',
    body: () => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="form-group">
          <label for="f_room_number">Số phòng *</label>
          <input type="text" id="f_room_number" value="${isEdit ? room.room_number : ''}" required>
        </div>
        
        <div class="form-group">
          <label for="f_room_type">Loại phòng *</label>
          <select id="f_room_type" required>
            ${state.roomTypes.map(type => `
              <option value="${type.type_id}" ${isEdit && room.type_id === type.type_id ? 'selected' : ''}>
                ${type.name}
              </option>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label for="f_room_status">Tình trạng *</label>
          <select id="f_room_status" required>
            <option value="Available" ${isEdit && room.status === 'Available' ? 'selected' : ''}>Có sẵn</option>
            <option value="Occupied" ${isEdit && room.status === 'Occupied' ? 'selected' : ''}>Đã thuê</option>
            <option value="Maintenance" ${isEdit && room.status === 'Maintenance' ? 'selected' : ''}>Bảo trì</option>
            <option value="Cleaning" ${isEdit && room.status === 'Cleaning' ? 'selected' : ''}>Đang dọn</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="f_room_features">Tiện nghi</label>
          <input type="text" id="f_room_features" value="${isEdit ? room.features : ''}" placeholder="TV, WiFi, Điều hòa...">
        </div>
      `;
      return div;
    },
    onSubmit: () => {
      const roomNumber = document.getElementById('f_room_number').value.trim();
      const typeId = parseInt(document.getElementById('f_room_type').value);
      const status = document.getElementById('f_room_status').value;
      const features = document.getElementById('f_room_features').value.trim();
      
      if (!roomNumber) {
        alert('Vui lòng nhập số phòng');
        return false;
      }
      
      if (isEdit) {
        room.room_number = roomNumber;
        room.type_id = typeId;
        room.status = status;
        room.features = features;
      } else {
        const newRoom = {
          room_id: generateId(state.rooms),
          room_number: roomNumber,
          type_id: typeId,
          status: status,
          features: features
        };
        state.rooms.push(newRoom);
      }
      
      saveData(state);
      renderRooms();
      return true;
    }
  });
}

function deleteRoom(roomId) {
  if (confirm('Bạn có chắc chắn muốn xóa phòng này?')) {
    // Check if room has active bookings
    const hasBookings = state.bookings.some(b => 
      b.room_id === roomId && b.status !== 'CANCELLED'
    );
    
    if (hasBookings) {
      alert('Không thể xóa phòng đang có đơn đặt hoạt động');
      return;
    }
    
    state.rooms = state.rooms.filter(r => r.room_id !== roomId);
    saveData(state);
    renderRooms();
    alert('Đã xóa phòng thành công');
  }
}

/* =========================
   Services Management
   ========================= */

function renderServices() {
  const tbody = document.querySelector('#tbl-services tbody');
  tbody.innerHTML = '';
  
  state.services.forEach(service => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${service.service_id}</td>
      <td>${service.name}</td>
      <td>${formatMoney(service.price)}</td>
      <td>
        <button class="btn btn-edit" onclick="showServiceForm(${service.service_id})">Sửa</button>
        <button class="btn btn-delete" onclick="deleteService(${service.service_id})">Xóa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function showServiceForm(serviceId = null) {
  const service = serviceId ? state.services.find(s => s.service_id === serviceId) : null;
  const isEdit = !!service;
  
  openModal({
    title: isEdit ? 'Sửa dịch vụ' : 'Thêm dịch vụ mới',
    body: () => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="form-group">
          <label for="f_service_name">Tên dịch vụ *</label>
          <input type="text" id="f_service_name" value="${isEdit ? service.name : ''}" required>
        </div>
        
        <div class="form-group">
          <label for="f_service_description">Mô tả</label>
          <textarea id="f_service_description">${isEdit ? service.description : ''}</textarea>
        </div>
        
        <div class="form-group">
          <label for="f_service_price">Giá *</label>
          <input type="number" id="f_service_price" value="${isEdit ? service.price : ''}" min="0" required>
        </div>
      `;
      return div;
    },
    onSubmit: () => {
      const name = document.getElementById('f_service_name').value.trim();
      const description = document.getElementById('f_service_description').value.trim();
      const price = parseFloat(document.getElementById('f_service_price').value);
      
      if (!name) {
        alert('Vui lòng nhập tên dịch vụ');
        return false;
      }
      
      if (isEdit) {
        service.name = name;
        service.description = description;
        service.price = price;
      } else {
        const newService = {
          service_id: generateId(state.services),
          name: name,
          description: description,
          price: price
        };
        state.services.push(newService);
      }
      
      saveData(state);
      renderServices();
      return true;
    }
  });
}

function deleteService(serviceId) {
  if (confirm('Bạn có chắc chắn muốn xóa dịch vụ này?')) {
    // Check if service is used in any bookings
    const isUsed = state.bookingServices.some(bs => bs.service_id === serviceId);
    
    if (isUsed) {
      alert('Không thể xóa dịch vụ đang được sử dụng trong các đơn đặt');
      return;
    }
    
    state.services = state.services.filter(s => s.service_id !== serviceId);
    saveData(state);
    renderServices();
    alert('Đã xóa dịch vụ thành công');
  }
}

/* =========================
   Bookings Management
   ========================= */

function renderBookings() {
  const tbody = document.querySelector('#tbl-bookings tbody');
  tbody.innerHTML = '';
  
  state.bookings.forEach(booking => {
    const user = state.users.find(u => u.user_id === booking.user_id);
    const room = state.rooms.find(r => r.room_id === booking.room_id);
    const roomType = state.roomTypes.find(t => t.type_id === room.type_id);
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${booking.booking_id}</td>
      <td>${user.full_name}</td>
      <td>${room.room_number} - ${roomType.name}</td>
      <td>${booking.check_in_date}</td>
      <td>${booking.check_out_date}</td>
      <td>${formatMoney(booking.total_amount)}</td>
      <td><span class="status-${booking.status.toLowerCase()}">${booking.status}</span></td>
      <td>
        <button class="btn btn-edit" onclick="showBookingManagementForm(${booking.booking_id})">Sửa</button>
        <button class="btn" onclick="viewBookingServices(${booking.booking_id})">DV</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function showBookingManagementForm(bookingId) {
  const booking = state.bookings.find(b => b.booking_id === bookingId);
  const room = state.rooms.find(r => r.room_id === booking.room_id);
  
  openModal({
    title: `Quản lý đơn đặt #${bookingId}`,
    body: () => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="form-group">
          <label for="f_booking_status">Trạng thái *</label>
          <select id="f_booking_status" required>
            <option value="PENDING" ${booking.status === 'PENDING' ? 'selected' : ''}>Chờ xác nhận</option>
            <option value="CONFIRMED" ${booking.status === 'CONFIRMED' ? 'selected' : ''}>Đã xác nhận</option>
            <option value="CHECKED_IN" ${booking.status === 'CHECKED_IN' ? 'selected' : ''}>Đã nhận phòng</option>
            <option value="CHECKED_OUT" ${booking.status === 'CHECKED_OUT' ? 'selected' : ''}>Đã trả phòng</option>
            <option value="CANCELLED" ${booking.status === 'CANCELLED' ? 'selected' : ''}>Đã hủy</option>
          </select>
        </div>
        
        <div class="booking-info">
          <p><strong>Phòng:</strong> ${room.room_number}</p>
          <p><strong>Ngày nhận:</strong> ${booking.check_in_date}</p>
          <p><strong>Ngày trả:</strong> ${booking.check_out_date}</p>
          <p><strong>Tổng tiền:</strong> ${formatMoney(booking.total_amount)}</p>
        </div>
      `;
      return div;
    },
    onSubmit: () => {
      const status = document.getElementById('f_booking_status').value;
      booking.status = status;
      saveData(state);
      renderBookings();
      return true;
    }
  });
}

function viewBookingServices(bookingId) {
  const booking = state.bookings.find(b => b.booking_id === bookingId);
  const currentServices = state.bookingServices.filter(bs => bs.booking_id === bookingId);
  
  openModal({
    title: `Dịch vụ đơn #${bookingId}`,
    body: () => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div id="current-services">
          <h4>Dịch vụ hiện tại:</h4>
          ${currentServices.length > 0 ? 
            currentServices.map(bs => {
              const service = state.services.find(s => s.service_id === bs.service_id);
              return `
                <div class="service-item">
                  <span>${service.name} x ${bs.quantity} = ${formatMoney(bs.price)}</span>
                  <button class="btn btn-delete" onclick="removeBookingService(${bs.booking_service_id})">Xóa</button>
                </div>
              `;
            }).join('') :
            '<p>Chưa có dịch vụ nào</p>'
          }
        </div>
        
        <hr>
        
        <div class="form-group">
          <label for="f_add_service">Thêm dịch vụ</label>
          <select id="f_add_service">
            <option value="">Chọn dịch vụ</option>
            ${state.services.map(service => `
              <option value="${service.service_id}">${service.name} - ${formatMoney(service.price)}</option>
            `).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label for="f_service_quantity">Số lượng</label>
          <input type="number" id="f_service_quantity" value="1" min="1">
        </div>
        
        <button type="button" class="btn primary" onclick="addBookingService(${bookingId})">Thêm dịch vụ</button>
      `;
      return div;
    },
    onSubmit: () => true
  });
}

function addBookingService(bookingId) {
  const serviceId = parseInt(document.getElementById('f_add_service').value);
  const quantity = parseInt(document.getElementById('f_service_quantity').value);
  
  if (!serviceId) {
    alert('Vui lòng chọn dịch vụ');
    return;
  }
  
  const service = state.services.find(s => s.service_id === serviceId);
  const booking = state.bookings.find(b => b.booking_id === bookingId);
  
  const newBookingService = {
    booking_service_id: generateId(state.bookingServices),
    booking_id: bookingId,
    service_id: serviceId,
    quantity: quantity,
    price: service.price * quantity
  };
  
  state.bookingServices.push(newBookingService);
  booking.total_amount += newBookingService.price;
  
  saveData(state);
  alert('Đã thêm dịch vụ thành công');
  viewBookingServices(bookingId);
}

function removeBookingService(bookingServiceId) {
  if (confirm('Bạn có chắc chắn muốn xóa dịch vụ này?')) {
    const bookingService = state.bookingServices.find(bs => bs.booking_service_id === bookingServiceId);
    const booking = state.bookings.find(b => b.booking_id === bookingService.booking_id);
    
    booking.total_amount -= bookingService.price;
    state.bookingServices = state.bookingServices.filter(bs => bs.booking_service_id !== bookingServiceId);
    
    saveData(state);
    alert('Đã xóa dịch vụ thành công');
    viewBookingServices(bookingService.booking_id);
  }
}

/* =========================
   Users Management
   ========================= */

function renderUsers() {
  const tbody = document.querySelector('#tbl-users tbody');
  tbody.innerHTML = '';
  
  state.users.forEach(user => {
    const role = state.roles.find(r => r.role_id === user.role_id);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${user.user_id}</td>
      <td>${user.full_name}</td>
      <td>${user.email}</td>
      <td>${user.phone}</td>
      <td>${role.role_name}</td>
      <td>
        <button class="btn btn-edit" onclick="showUserForm(${user.user_id})">Sửa</button>
        ${user.user_id !== state.currentUser.user_id ? 
          `<button class="btn btn-delete" onclick="deleteUser(${user.user_id})">Xóa</button>` : 
          ''
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function showUserForm(userId = null) {
  const user = userId ? state.users.find(u => u.user_id === userId) : null;
  const isEdit = !!user;
  
  openModal({
    title: isEdit ? 'Sửa thông tin người dùng' : 'Thêm người dùng mới',
    body: () => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="form-group">
          <label for="f_user_name">Họ tên *</label>
          <input type="text" id="f_user_name" value="${isEdit ? user.full_name : ''}" required>
        </div>
        
        <div class="form-group">
          <label for="f_user_email">Email *</label>
          <input type="email" id="f_user_email" value="${isEdit ? user.email : ''}" required>
        </div>
        
        <div class="form-group">
          <label for="f_user_phone">Số điện thoại</label>
          <input type="text" id="f_user_phone" value="${isEdit ? user.phone : ''}">
        </div>
        
        <div class="form-group">
          <label for="f_user_address">Địa chỉ</label>
          <input type="text" id="f_user_address" value="${isEdit ? user.address : ''}">
        </div>
        
        <div class="form-group">
          <label for="f_user_role">Vai trò *</label>
          <select id="f_user_role" required>
            ${state.roles.map(role => `
              <option value="${role.role_id}" ${isEdit && user.role_id === role.role_id ? 'selected' : ''}>
                ${role.role_name}
              </option>
            `).join('')}
          </select>
        </div>
        
        ${!isEdit ? `
          <div class="form-group">
            <label for="f_user_password">Mật khẩu *</label>
            <input type="password" id="f_user_password" required>
          </div>
        ` : ''}
      `;
      return div;
    },
    onSubmit: () => {
      const name = document.getElementById('f_user_name').value.trim();
      const email = document.getElementById('f_user_email').value.trim();
      const phone = document.getElementById('f_user_phone').value.trim();
      const address = document.getElementById('f_user_address').value.trim();
      const roleId = parseInt(document.getElementById('f_user_role').value);
      
      if (!name || !email) {
        alert('Vui lòng nhập họ tên và email');
        return false;
      }
      
      // Check email uniqueness
      const emailExists = state.users.some(u => 
        u.email === email && u.user_id !== (user?.user_id)
      );
      
      if (emailExists) {
        alert('Email đã tồn tại trong hệ thống');
        return false;
      }
      
      if (isEdit) {
        user.full_name = name;
        user.email = email;
        user.phone = phone;
        user.address = address;
        user.role_id = roleId;
      } else {
        const password = document.getElementById('f_user_password').value;
        if (!password) {
          alert('Vui lòng nhập mật khẩu');
          return false;
        }
        
        const newUser = {
          user_id: generateId(state.users),
          full_name: name,
          email: email,
          phone: phone,
          address: address,
          role_id: roleId,
          password_hash: simpleHash(password)
        };
        state.users.push(newUser);
      }
      
      saveData(state);
      renderUsers();
      return true;
    }
  });
}

function deleteUser(userId) {
  if (confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
    // Check if user has bookings
    const hasBookings = state.bookings.some(b => b.user_id === userId);
    
    if (hasBookings) {
      alert('Không thể xóa người dùng đang có đơn đặt');
      return;
    }
    
    state.users = state.users.filter(u => u.user_id !== userId);
    saveData(state);
    renderUsers();
    alert('Đã xóa người dùng thành công');
  }
}

/* =========================
   Payments Management
   ========================= */

function renderPayments() {
  const tbody = document.querySelector('#tbl-payments tbody');
  tbody.innerHTML = '';
  
  state.payments.forEach(payment => {
    const booking = state.bookings.find(b => b.booking_id === payment.booking_id);
    const user = state.users.find(u => u.user_id === booking.user_id);
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${payment.payment_id}</td>
      <td>#${payment.booking_id} (${user.full_name})</td>
      <td>${formatMoney(payment.amount)}</td>
      <td>${payment.payment_method}</td>
      <td>${payment.payment_date}</td>
      <td><span class="status-${payment.status.toLowerCase()}">${payment.status}</span></td>
      <td>
        <button class="btn btn-edit" onclick="showPaymentForm(${payment.payment_id})">Sửa</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function showPaymentForm(paymentId = null) {
  const payment = paymentId ? state.payments.find(p => p.payment_id === paymentId) : null;
  const isEdit = !!payment;
  
  openModal({
    title: isEdit ? 'Sửa thông tin thanh toán' : 'Thêm thanh toán mới',
    body: () => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="form-group">
          <label for="f_payment_booking">Đơn đặt *</label>
          <select id="f_payment_booking" required>
            <option value="">Chọn đơn đặt</option>
            ${state.bookings.map(booking => {
              const user = state.users.find(u => u.user_id === booking.user_id);
              return `
                <option value="${booking.booking_id}" ${isEdit && payment.booking_id === booking.booking_id ? 'selected' : ''}>
                  #${booking.booking_id} - ${user.full_name} - ${formatMoney(booking.total_amount)}
                </option>
              `;
            }).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label for="f_payment_amount">Số tiền *</label>
          <input type="number" id="f_payment_amount" value="${isEdit ? payment.amount : ''}" min="0" required>
        </div>
        
        <div class="form-group">
          <label for="f_payment_method">Phương thức *</label>
          <select id="f_payment_method" required>
            <option value="Cash" ${isEdit && payment.payment_method === 'Cash' ? 'selected' : ''}>Tiền mặt</option>
            <option value="Credit Card" ${isEdit && payment.payment_method === 'Credit Card' ? 'selected' : ''}>Thẻ tín dụng</option>
            <option value="Bank Transfer" ${isEdit && payment.payment_method === 'Bank Transfer' ? 'selected' : ''}>Chuyển khoản</option>
            <option value="E-Wallet" ${isEdit && payment.payment_method === 'E-Wallet' ? 'selected' : ''}>Ví điện tử</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="f_payment_date">Ngày thanh toán *</label>
          <input type="date" id="f_payment_date" value="${isEdit ? payment.payment_date : new Date().toISOString().split('T')[0]}" required>
        </div>
        
        <div class="form-group">
          <label for="f_payment_status">Trạng thái *</label>
          <select id="f_payment_status" required>
            <option value="PENDING" ${isEdit && payment.status === 'PENDING' ? 'selected' : ''}>Chờ xử lý</option>
            <option value="PAID" ${isEdit && payment.status === 'PAID' ? 'selected' : ''}>Đã thanh toán</option>
            <option value="FAILED" ${isEdit && payment.status === 'FAILED' ? 'selected' : ''}>Thất bại</option>
            <option value="REFUNDED" ${isEdit && payment.status === 'REFUNDED' ? 'selected' : ''}>Đã hoàn tiền</option>
          </select>
        </div>
      `;
      return div;
    },
    onSubmit: () => {
      const bookingId = parseInt(document.getElementById('f_payment_booking').value);
      const amount = parseFloat(document.getElementById('f_payment_amount').value);
      const method = document.getElementById('f_payment_method').value;
      const date = document.getElementById('f_payment_date').value;
      const status = document.getElementById('f_payment_status').value;
      
      if (!bookingId || amount <= 0) {
        alert('Vui lòng kiểm tra lại thông tin thanh toán');
        return false;
      }
      
      if (isEdit) {
        payment.booking_id = bookingId;
        payment.amount = amount;
        payment.payment_method = method;
        payment.payment_date = date;
        payment.status = status;
      } else {
        const newPayment = {
          payment_id: generateId(state.payments),
          booking_id: bookingId,
          amount: amount,
          payment_method: method,
          payment_date: date,
          status: status
        };
        state.payments.push(newPayment);
      }
      
      // Update booking status if payment is completed
      if (status === 'PAID') {
        const booking = state.bookings.find(b => b.booking_id === bookingId);
        if (booking) {
          booking.status = 'CONFIRMED';
        }
      }
      
      saveData(state);
      renderPayments();
      if (!isEdit) {
        renderBookings();
      }
      return true;
    }
  });
}

/* =========================
   Modal System
   ========================= */

const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const modalCancel = document.getElementById('modal-cancel');
const modalSubmit = document.getElementById('modal-submit');

function openModal(opts) {
  modalTitle.textContent = opts.title || 'Form';
  modalBody.innerHTML = '';
  const content = opts.body ? opts.body() : document.createElement('div');
  modalBody.appendChild(content);
  modal.classList.remove('hidden');

  const submitHandler = () => {
    if (opts.onSubmit && opts.onSubmit() !== false) {
      modal.classList.add('hidden');
    }
  };

  modalSubmit.onclick = submitHandler;
  modalClose.onclick = () => modal.classList.add('hidden');
  modalCancel.onclick = () => modal.classList.add('hidden');
  modal.onclick = (e) => { 
    if (e.target === modal) modal.classList.add('hidden'); 
  };
}

/* =========================
   Event Listeners & Initialization
   ========================= */

function initEvents() {
  // Authentication events
  document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    handleLogin(email, password);
  });
  
  document.getElementById('register-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const phone = document.getElementById('register-phone').value;
    const address = document.getElementById('register-address').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;
    
    handleRegister({ name, email, phone, address, password, confirm });
  });
  
  document.getElementById('show-register').addEventListener('click', function(e) {
    e.preventDefault();
    showRegisterScreen();
  });
  
  document.getElementById('show-login').addEventListener('click', function(e) {
    e.preventDefault();
    showLoginScreen();
  });
  
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  
  // Demo account click handlers
  document.querySelectorAll('.demo-account').forEach(el => {
    el.addEventListener('click', function() {
      const email = this.getAttribute('data-email');
      const password = this.getAttribute('data-password');
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').value = password;
    });
  });
  
  // Toggle password visibility
  document.getElementById('toggle-password').addEventListener('click', function() {
    const passwordInput = document.getElementById('login-password');
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    this.textContent = type === 'password' ? '👁️' : '🙈';
  });

  // Navigation
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.style.display !== 'none') {
        setActiveSection(btn.dataset.section);
      }
    });
  });

  // Quick action buttons
  document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (section) setActiveSection(section);
    });
  });

  // Booking form
  document.getElementById('booking-form').addEventListener('submit', function(e) {
    e.preventDefault();
    searchAvailableRooms();
  });

  // Management buttons
  document.getElementById('btn-new-room').addEventListener('click', () => showRoomForm());
  document.getElementById('btn-new-service').addEventListener('click', () => showServiceForm());
  document.getElementById('btn-new-booking').addEventListener('click', () => setActiveSection('booking'));
  document.getElementById('btn-new-user').addEventListener('click', () => showUserForm());
  document.getElementById('btn-new-payment').addEventListener('click', () => showPaymentForm());

  // Set minimum dates for booking
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('check-in').min = today;
  document.getElementById('check-out').min = today;
}

function init() {
  if (state.currentUser) {
    showMainApp();
  } else {
    showLoginScreen();
  }
  
  initEvents();
  
  // Add CSS for status badges
  const style = document.createElement('style');
  style.textContent = `
    .status-available, .status-confirmed, .status-paid { color: #10b981; font-weight: 600; }
    .status-pending { color: #f59e0b; font-weight: 600; }
    .status-occupied, .status-checked_in { color: #3b82f6; font-weight: 600; }
    .status-cancelled, .status-failed, .status-maintenance { color: #ef4444; font-weight: 600; }
    .status-checked_out, .status-refunded { color: #6b7280; font-weight: 600; }
    
    .available-room {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin-bottom: 16px;
      background: white;
    }
    
    .room-info { flex: 2; }
    .room-pricing { flex: 1; text-align: right; }
    .price-breakdown { margin-bottom: 12px; }
    .total-price { font-size: 18px; font-weight: 700; color: #1e293b; }
    
    .service-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
      padding: 8px;
      border-radius: 4px;
    }
    
    .service-checkbox:hover { background: #f8fafc; }
    
    .service-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    
    .no-rooms {
      text-align: center;
      padding: 40px;
      color: #64748b;
    }
  `;
  document.head.appendChild(style);
}

// Start the application
init();