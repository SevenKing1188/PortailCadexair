document.addEventListener('DOMContentLoaded', () => {
  // Initialisation des données
  loadChefsDropdown();
  loadEmployeesList();
  loadWorkOrders();

  // Événements des formulaires
  setupFormListeners();
});

// 1. Déconnexion
async function handleLogout() {
  try {
    const res = await fetch('/api/logout', { method: 'POST' });
    if (res.ok) window.location.href = '/login.html';
  } catch (err) {
    console.error('Erreur déconnexion :', err);
  }
}

// 2. Charger les chefs d'équipe dans le select du bon de travail
async function loadChefsDropdown() {
  const selectElement = document.getElementById('assignedTo');
  if (!selectElement) return;

  try {
    const response = await fetch('/api/chefs');
    if (!response.ok) throw new Error('Erreur lors de la récupération des chefs.');

    const chefs = await response.json();
    selectElement.innerHTML = '<option value="">-- Sélectionner un chef d\'équipe --</option>';

    if (chefs.length === 0) {
      selectElement.innerHTML += '<option disabled>Aucun chef d\'équipe disponible</option>';
      return;
    }

    chefs.forEach(chef => {
      const option = document.createElement('option');
      option.value = chef.id;
      const deptSuffix = chef.department ? ` (${chef.department})` : '';
      option.textContent = `${chef.name}${deptSuffix}`;
      selectElement.appendChild(option);
    });
  } catch (error) {
    console.error('Erreur chefs dropdown :', error);
  }
}

// 3. Charger et afficher la liste des employés terrain
async function loadEmployeesList() {
  const listContainer = document.getElementById('employeesList');
  if (!listContainer) return;

  try {
    const res = await fetch('/api/employees');
    const employees = await res.json();

    listContainer.innerHTML = '';
    if (employees.length === 0) {
      listContainer.innerHTML = '<li>Aucun employé terrain enregistré.</li>';
      return;
    }

    employees.forEach(emp => {
      const li = document.createElement('li');
      li.className = 'flex-between';
      li.innerHTML = `
        <span>${emp.full_name}</span>
        <button onclick="deleteEmployee('${emp.id}')" class="btn-danger-sm">Supprimer</button>
      `;
      listContainer.appendChild(li);
    });
  } catch (err) {
    console.error('Erreur employés :', err);
  }
}

// 4. Ajouter un employé terrain
async function handleAddEmployee(e) {
  e.preventDefault();
  const input = document.getElementById('employeeFullName');
  const fullName = input?.value.trim();

  if (!fullName) return alert('Veuillez entrer un nom.');

  try {
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName })
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    alert('Employé ajouté avec succès !');
    input.value = '';
    loadEmployeesList();
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

// 5. Supprimer un employé terrain
async function deleteEmployee(id) {
  if (!confirm('Voulez-vous vraiment supprimer cet employé ?')) return;

  try {
    const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    loadEmployeesList();
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

// 6. Créer un Utilisateur (Chef ou Admin)
async function handleCreateUser(e) {
  e.preventDefault();
  const form = e.target;
  const body = {
    email: form.email.value,
    password: form.password.value,
    username: form.username.value,
    role: form.role.value,
    department: form.department?.value || ''
  };

  try {
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    alert('Utilisateur créé avec succès !');
    form.reset();
    loadChefsDropdown(); // Recharge la liste au cas où c'est un nouveau chef
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

// 7. Créer un Bon de Travail
async function handleCreateWorkOrder(e) {
  e.preventDefault();
  const form = e.target;
  const body = {
    clientName: form.clientName.value,
    clientAddress: form.clientAddress.value,
    contactName: form.contactName.value,
    contactPhone: form.contactPhone.value,
    appointmentDate: form.appointmentDate.value,
    appointmentTime: form.appointmentTime.value,
    department: form.department.value,
    nbHottes: form.nbHottes.value,
    nbPortesAcces: form.nbPortesAcces.value,
    nbVentilateurs: form.nbVentilateurs.value,
    assignedTo: form.assignedTo.value || null,
    description: form.description.value
  };

  try {
    const res = await fetch('/api/work-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    alert('Bon de travail créé !');
    form.reset();
    loadWorkOrders();
  } catch (err) {
    alert(`Erreur : ${err.message}`);
  }
}

// 8. Obtenir et afficher les bons de travail
async function loadWorkOrders() {
  const container = document.getElementById('workOrdersList');
  if (!container) return;

  try {
    const res = await fetch('/api/work-orders');
    const data = await res.json();

    container.innerHTML = '';
    if (data.length === 0) {
      container.innerHTML = '<p>Aucun bon de travail enregistré.</p>';
      return;
    }

    data.forEach(order => {
      const chefName = order.profiles?.full_name || order.profiles?.username || 'Non assigné';
      const card = document.createElement('div');
      card.className = 'card-work-order';
      card.innerHTML = `
        <h3>${order.client_name} - ${order.appointment_date}</h3>
        <p><strong>Adresse :</strong> ${order.client_address}</p>
        <p><strong>Chef d'équipe :</strong> ${chefName}</p>
        <p><strong>Département :</strong> ${order.department}</p>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Erreur bons de travail :', err);
  }
}

// Attachement des événements aux formulaires
function setupFormListeners() {
  const createUserForm = document.getElementById('createUserForm');
  if (createUserForm) createUserForm.addEventListener('submit', handleCreateUser);

  const addEmployeeForm = document.getElementById('addEmployeeForm');
  if (addEmployeeForm) addEmployeeForm.addEventListener('submit', handleAddEmployee);

  const workOrderForm = document.getElementById('workOrderForm');
  if (workOrderForm) workOrderForm.addEventListener('submit', handleCreateWorkOrder);

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
}