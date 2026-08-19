document.addEventListener('DOMContentLoaded', async () => {
  const settingsBtn = document.getElementById('settings-btn');
  const sidePanel = document.getElementById('side-panel');
  const closePanelBtn = document.getElementById('close-panel-btn');
  const workOrderForm = document.getElementById('work-order-form');
  const createUserForm = document.getElementById('create-user-form');
  const createEmployeeForm = document.getElementById('create-employee-form');
  const addTechBtn = document.getElementById('add-tech-btn');
  const techContainer = document.getElementById('technicians-container');
  const logoutBtn = document.getElementById('logout-btn');
  const assignedToSelect = document.getElementById('assignedTo');

  let availableEmployees = [];

  // Sidebar toggles
  settingsBtn?.addEventListener('click', () => sidePanel.classList.add('open'));
  closePanelBtn?.addEventListener('click', () => sidePanel.classList.remove('open'));

  // Chargement des Chefs
  const loadChefs = async () => {
    try {
      const res = await fetch('/api/chefs');
      const chefs = await res.json();
      if (assignedToSelect) {
        assignedToSelect.innerHTML = '<option value="">Choisir un chef</option>';
        chefs.forEach(c => {
          assignedToSelect.innerHTML += `<option value="${c.id}">${c.username}</option>`;
        });
      }
    } catch (err) { console.error(err); }
  };

  // Chargement des Employés Terrain
  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      availableEmployees = await res.json();
    } catch (err) { console.error(err); }
  };

  await loadChefs();
  await loadEmployees();

  // Génération d'une ligne d'entrée de temps avec la liste des employés
  const createTechRow = () => {
    const div = document.createElement('div');
    div.className = 'tech-row';
    
    let options = '<option value="">Sélectionner un employé</option>';
    availableEmployees.forEach(emp => {
      options += `<option value="${emp.full_name}">${emp.full_name}</option>`;
    });

    div.innerHTML = `
      <select name="techName[]" required>${options}</select>
      <input type="number" step="0.5" name="techHours[]" placeholder="Heures" required style="width:80px;">
      <button type="button" onclick="this.parentElement.remove()">X</button>
    `;
    techContainer.appendChild(div);
  };

  // Ajout par défaut d'une première ligne
  if (techContainer && techContainer.children.length === 0) {
    createTechRow();
  }

  addTechBtn?.addEventListener('click', createTechRow);

  // Soumission Bon de Travail
  workOrderForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(workOrderForm);
    const techNames = formData.getAll('techName[]');
    const techHours = formData.getAll('techHours[]');
    const techniciansLog = techNames.map((n, i) => ({ name: n, hours: techHours[i] }));

    const payload = {
      clientName: formData.get('clientName'),
      clientAddress: formData.get('clientAddress'),
      department: formData.get('department'),
      appointmentDate: formData.get('appointmentDate'),
      appointmentTime: formData.get('appointmentTime'),
      assignedTo: formData.get('assignedTo'),
      description: formData.get('description'),
      techniciansLog: techniciansLog
    };

    const res = await fetch('/api/work-orders', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert('Bon créé !');
      workOrderForm.reset();
      techContainer.innerHTML = '';
      createTechRow();
    } else {
      const err = await res.json();
      alert('Erreur : ' + err.error);
    }
  });

  // Soumission Formulaire 1 : Créer Utilisateur
  createUserForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(createUserForm);
    const payload = Object.fromEntries(formData.entries());

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert('Utilisateur système créé !');
      createUserForm.reset();
      await loadChefs();
    } else {
      const err = await res.json();
      alert('Erreur : ' + err.error);
    }
  });

  // NOUVEAU - Soumission Formulaire 2 : Créer Employé Terrain
  createEmployeeForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(createEmployeeForm);
    const payload = { fullName: formData.get('fullName') };

    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert('Employé terrain créé !');
      createEmployeeForm.reset();
      await loadEmployees(); // Met à jour la liste pour les bons
    } else {
      const err = await res.json();
      alert('Erreur : ' + err.error);
    }
  });

  // Logout
  logoutBtn?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/index.html';
  });
});
