// =========================================================
// DASHBOARD.JS - LOGIQUE CLIENT PORTAIL CADEXAIR
// =========================================================

// Stockage local de l'historique pour le filtrage en direct
let allWorkOrders = [];

document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  setupEventListeners();
});

// 1. Initialisation globale du tableau de bord
async function initDashboard() {
  await Promise.all([
    loadChefsDropdown(),
    loadEmployeesList(),
    loadWorkOrdersHistory()
  ]);
}

// 2. Configuration des écouteurs d'événements
function setupEventListeners() {
  // Formulaires
  const workOrderForm = document.getElementById('workOrderForm');
  if (workOrderForm) workOrderForm.addEventListener('submit', handleCreateWorkOrder);

  const createUserForm = document.getElementById('createUserForm');
  if (createUserForm) createUserForm.addEventListener('submit', handleCreateUser);

  const addEmployeeForm = document.getElementById('addEmployeeForm');
  if (addEmployeeForm) addEmployeeForm.addEventListener('submit', handleAddEmployee);

  // Déconnexion
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  // Filtres de l'historique
  const searchInput = document.getElementById('searchHistoryInput');
  if (searchInput) searchInput.addEventListener('input', filterWorkOrders);

  const filterChefSelect = document.getElementById('filterChefSelect');
  if (filterChefSelect) filterChefSelect.addEventListener('change', filterWorkOrders);

  // Navigation par onglets (Tabs UI)
  const navItems = document.querySelectorAll('[data-tab-target]');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('data-tab-target');
      switchTab(targetId);
    });
  });
}

// =========================================================
// GESTION DE LA NAVIGATION & SESSION
// =========================================================

function switchTab(targetId) {
  const tabs = document.querySelectorAll('.tab-content');
  const navs = document.querySelectorAll('[data-tab-target]');

  tabs.forEach(tab => {
    if (tab.id === targetId) {
      tab.classList.remove('hidden');
    } else {
      tab.classList.add('hidden');
    }
  });

  navs.forEach(nav => {
    if (nav.getAttribute('data-tab-target') === targetId) {
      nav.classList.add('active', 'bg-slate-700', 'text-white');
      nav.classList.remove('text-slate-400');
    } else {
      nav.classList.remove('active', 'bg-slate-700', 'text-white');
      nav.classList.add('text-slate-400');
    }
  });
}

async function handleLogout() {
  try {
    const response = await fetch('/api/logout', { method: 'POST' });
    if (response.ok) {
      window.location.href = '/login.html';
    } else {
      alert('Erreur lors de la déconnexion.');
    }
  } catch (error) {
    console.error('Logout error:', error);
    alert('Erreur réseau lors de la déconnexion.');
  }
}

// =========================================================
// 1. CHEFS D'ÉQUIPE (DROPDOWNS)
// =========================================================

async function loadChefsDropdown() {
  const assignedSelect = document.getElementById('assignedTo');
  const filterChefSelect = document.getElementById('filterChefSelect');

  try {
    const response = await fetch('/api/chefs');
    if (!response.ok) throw new Error('Impossible de charger les chefs d\'équipe.');

    const chefs = await response.json();

    // Remplissage select attribution
    if (assignedSelect) {
      assignedSelect.innerHTML = '<option value="">-- Sélectionner un chef d\'équipe --</option>';
      chefs.forEach(chef => {
        const option = document.createElement('option');
        option.value = chef.id;
        const dept = chef.department ? ` (${chef.department})` : '';
        option.textContent = `${chef.name}${dept}`;
        assignedSelect.appendChild(option);
      });
    }

    // Remplissage select filtrage historique
    if (filterChefSelect) {
      filterChefSelect.innerHTML = '<option value="">Tous les chefs</option>';
      chefs.forEach(chef => {
        const option = document.createElement('option');
        option.value = chef.id;
        option.textContent = chef.name;
        filterChefSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Erreur chargement chefs:', error);
  }
}

// =========================================================
// 2. CRÉATION D'UTILISATEURS (ADMIN & CHEFS)
// =========================================================

async function handleCreateUser(event) {
  event.preventDefault();

  const email = document.getElementById('userEmail').value.trim();
  const password = document.getElementById('userPassword').value;
  const username = document.getElementById('userName').value.trim();
  const role = document.getElementById('userRole').value;
  const department = document.getElementById('userDepartment').value.trim();

  try {
    const response = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, role, department })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Erreur lors de la création.');

    alert('Compte utilisateur créé avec succès !');
    document.getElementById('createUserForm').reset();
    await loadChefsDropdown(); // Actualiser la liste des chefs si c'était un rôle chef
  } catch (error) {
    alert(`Erreur : ${error.message}`);
  }
}

// =========================================================
// 3. EMPLOYÉS TERRAIN
// =========================================================

async function loadEmployeesList() {
  const container = document.getElementById('employeesListContainer');
  if (!container) return;

  try {
    const response = await fetch('/api/employees');
    if (!response.ok) throw new Error('Impossible de charger les employés.');

    const employees = await response.json();
    container.innerHTML = '';

    if (employees.length === 0) {
      container.innerHTML = '<p class="text-slate-400 text-sm">Aucun employé enregistré.</p>';
      return;
    }

    employees.forEach(emp => {
      const item = document.createElement('div');
      item.className = 'flex justify-between items-center bg-slate-800 p-3 rounded border border-slate-700 mb-2';
      item.innerHTML = `
        <span class="text-white text-sm font-medium">${emp.full_name}</span>
        <button onclick="deleteEmployee('${emp.id}')" class="text-red-400 hover:text-red-300 text-xs px-2 py-1 bg-red-950/40 rounded border border-red-800">
          Supprimer
        </button>
      `;
      container.appendChild(item);
    });
  } catch (error) {
    console.error('Erreur chargement employés:', error);
  }
}

async function handleAddEmployee(event) {
  event.preventDefault();
  const input = document.getElementById('employeeFullName');
  if (!input) return;

  const fullName = input.value.trim();
  if (!fullName) return alert('Veuillez entrer un nom valide.');

  try {
    const response = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    alert('Employé ajouté avec succès !');
    input.value = '';
    await loadEmployeesList();
  } catch (error) {
    alert(`Erreur : ${error.message}`);
  }
}

async function deleteEmployee(id) {
  if (!confirm('Voulez-vous vraiment supprimer cet employé ?')) return;

  try {
    const response = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    const result = await response.json();

    if (!response.ok) throw new Error(result.error);

    alert('Employé supprimé.');
    await loadEmployeesList();
  } catch (error) {
    alert(`Erreur : ${error.message}`);
  }
}

// =========================================================
// 4. BONS DE TRAVAIL & HISTORIQUE
// =========================================================

async function handleCreateWorkOrder(event) {
  event.preventDefault();

  const payload = {
    clientName: document.getElementById('clientName').value.trim(),
    clientAddress: document.getElementById('clientAddress').value.trim(),
    contactName: document.getElementById('contactName').value.trim(),
    contactPhone: document.getElementById('contactPhone').value.trim(),
    appointmentDate: document.getElementById('appointmentDate').value,
    appointmentTime: document.getElementById('appointmentTime').value,
    department: document.getElementById('department').value,
    nbHottes: document.getElementById('nbHottes').value,
    nbPortesAcces: document.getElementById('nbPortesAcces').value,
    nbVentilateurs: document.getElementById('nbVentilateurs').value,
    assignedTo: document.getElementById('assignedTo').value || null,
    description: document.getElementById('description').value.trim()
  };

  try {
    const response = await fetch('/api/work-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error);

    alert('Bon de travail créé avec succès !');
    document.getElementById('workOrderForm').reset();
    await loadWorkOrdersHistory();
    switchTab('historyTab'); // Redirection vers l'historique
  } catch (error) {
    alert(`Erreur : ${error.message}`);
  }
}

async function loadWorkOrdersHistory() {
  const container = document.getElementById('workOrdersHistoryList');
  if (!container) return;

  try {
    const response = await fetch('/api/work-orders');
    if (!response.ok) throw new Error('Impossible de récupérer les bons de travail.');

    allWorkOrders = await response.json();
    renderWorkOrdersHistory(allWorkOrders);
  } catch (error) {
    console.error('Erreur chargement historique:', error);
    if (container) container.innerHTML = `<p class="text-red-400 text-sm">Erreur : ${error.message}</p>`;
  }
}

function renderWorkOrdersHistory(orders) {
  const container = document.getElementById('workOrdersHistoryList');
  if (!container) return;

  container.innerHTML = '';

  if (orders.length === 0) {
    container.innerHTML = '<p class="text-slate-400 text-sm">Aucun bon de travail trouvé.</p>';
    return;
  }

  orders.forEach(order => {
    const assignedName = order.profiles?.full_name || order.profiles?.username || 'Non assigné';
    const card = document.createElement('div');
    card.className = 'bg-slate-800 p-4 rounded-lg border-l-4 border-amber-500 shadow-md mb-3';
    card.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <h3 class="font-bold text-lg text-white">${order.client_name || 'Client Inconnu'}</h3>
        <span class="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300 font-mono">
          ${order.appointment_date || 'Sans date'} ${order.appointment_time ? 'à ' + order.appointment_time : ''}
        </span>
      </div>
      <p class="text-sm text-slate-300 mb-1"><strong>Adresse :</strong> ${order.client_address || 'N/A'}</p>
      <p class="text-sm text-slate-300 mb-2"><strong>Contact :</strong> ${order.contact_name || 'N/A'} (${order.contact_phone || 'N/A'})</p>
      
      <div class="flex flex-wrap gap-2 mb-3 text-xs">
        <span class="bg-slate-900/80 px-2.5 py-1 rounded text-amber-400 border border-slate-700">Hottes : ${order.nb_hottes}</span>
        <span class="bg-slate-900/80 px-2.5 py-1 rounded text-amber-400 border border-slate-700">Portes : ${order.nb_portes_acces}</span>
        <span class="bg-slate-900/80 px-2.5 py-1 rounded text-amber-400 border border-slate-700">Ventilateurs : ${order.nb_ventilateurs}</span>
      </div>

      ${order.description ? `<p class="text-xs text-slate-400 bg-slate-900/50 p-2 rounded mb-3 italic">"${order.description}"</p>` : ''}

      <div class="text-xs text-slate-400 border-t border-slate-700/60 pt-2 flex justify-between items-center">
        <span>Chef : <strong class="text-slate-200">${assignedName}</strong></span>
        <span>Secteur : <strong class="text-slate-200">${order.department || 'Général'}</strong></span>
      </div>
    `;
    container.appendChild(card);
  });
}

function filterWorkOrders() {
  const searchVal = (document.getElementById('searchHistoryInput')?.value || '').toLowerCase();
  const selectedChefId = document.getElementById('filterChefSelect')?.value || '';

  const filtered = allWorkOrders.filter(order => {
    const matchesSearch = (
      (order.client_name || '').toLowerCase().includes(searchVal) ||
      (order.client_address || '').toLowerCase().includes(searchVal) ||
      (order.contact_name || '').toLowerCase().includes(searchVal)
    );

    const matchesChef = selectedChefId === '' || order.assigned_to === selectedChefId;

    return matchesSearch && matchesChef;
  });

  renderWorkOrdersHistory(filtered);
}
