document.addEventListener('DOMContentLoaded', async () => {
  const settingsBtn = document.getElementById('settings-btn');
  const sidePanel = document.getElementById('side-panel');
  const closePanelBtn = document.getElementById('close-panel-btn');
  const workOrderForm = document.getElementById('work-order-form');
  const createUserForm = document.getElementById('create-user-form');
  const createEmployeeForm = document.getElementById('create-employee-form');
  const deleteEmployeeBtn = document.getElementById('delete-employee-btn');
  const manageEmployeesSelect = document.getElementById('manage-employees-select');
  const addTechBtn = document.getElementById('add-tech-btn');
  const techContainer = document.getElementById('technicians-container');
  const logoutBtn = document.getElementById('logout-btn');
  const assignedToSelect = document.getElementById('assignedTo');

  let availableEmployees = [];

  // Sidebar controls
  settingsBtn?.addEventListener('click', () => sidePanel.classList.add('open'));
  closePanelBtn?.addEventListener('click', () => sidePanel.classList.remove('open'));

  // Charger les Chefs
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

  // Charger les Employés et rafraîchir la liste déroulante d'administration (Section 3)
  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      availableEmployees = await res.json();

      // Mise à jour du menu déroulant de suppression (Section 3)
      if (manageEmployeesSelect) {
        manageEmployeesSelect.innerHTML = '<option value="">Sélectionner un employé à supprimer</option>';
        availableEmployees.forEach(emp => {
          manageEmployeesSelect.innerHTML += `<option value="${emp.id}">${emp.full_name}</option>`;
        });
      }
    } catch (err) { console.error(err); }
  };

  await loadChefs();
  await loadEmployees();

  // Fonction pour ajouter une ligne d'entrée de temps dans le bon
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

  // Section 1 : Nouveau Chef d'équipe
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
      alert('Nouveau chef d\'équipe créé !');
      createUserForm.reset();
      await loadChefs();
    } else {
      const err = await res.json();
      alert('Erreur : ' + err.error);
    }
  });

  // Section 2 : Ajouter Employé Terrain
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
      alert('Employé terrain ajouté !');
      createEmployeeForm.reset();
      await loadEmployees();
    } else {
      const err = await res.json();
      alert('Erreur : ' + err.error);
    }
  });

  // Section 3 : Supprimer un Employé sélectionné dans la liste déroulante
  deleteEmployeeBtn?.addEventListener('click', async () => {
    const selectedId = manageEmployeesSelect.value;
    if (!selectedId) {
      alert('Veuillez sélectionner un employé à supprimer.');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir supprimer cet employé ?')) return;

    const res = await fetch(`/api/employees/${selectedId}`, {
      method: 'DELETE'
    });

    if (res.ok) {
      alert('Employé supprimé avec succès !');
      await loadEmployees();
    } else {
      const err = await res.json();
      alert('Erreur : ' + err.error);
    }
  });

  // Déconnexion
  logoutBtn?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/index.html';
  });
});
