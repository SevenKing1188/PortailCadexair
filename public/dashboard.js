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
  const techSelectContainer = document.getElementById('technicians-select-container');
  const generateTimeEntriesBtn = document.getElementById('generate-time-entries-btn');
  const timeEntriesPanel = document.getElementById('time-entries-panel');
  const timeEntriesList = document.getElementById('time-entries-list');
  const logoutBtn = document.getElementById('logout-btn');
  const assignedToSelect = document.getElementById('assignedTo');

  let availableEmployees = [];
  let availableChefs = [];

  // Sidebar Controls
  settingsBtn?.addEventListener('click', () => sidePanel.classList.add('open'));
  closePanelBtn?.addEventListener('click', () => sidePanel.classList.remove('open'));

  // Charger tous les Chefs d'équipe
  const loadChefs = async () => {
    try {
      const res = await fetch('/api/chefs');
      availableChefs = await res.json();
      if (assignedToSelect) {
        assignedToSelect.innerHTML = '<option value="">Sélectionner un chef d\'équipe</option>';
        availableChefs.forEach(c => {
          assignedToSelect.innerHTML += `<option value="${c.id}">${c.full_name || c.username}</option>`;
        });
      }
    } catch (err) { console.error("Erreur chargement chefs:", err); }
  };

  // Charger les Employés et mettre à jour TOUTES les listes déroulantes
  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      availableEmployees = await res.json();

      // Update Liste déroulante Paramètres (Section 3)
      if (manageEmployeesSelect) {
        manageEmployeesSelect.innerHTML = '<option value="">Sélectionner un employé à supprimer</option>';
        availableEmployees.forEach(emp => {
          manageEmployeesSelect.innerHTML += `<option value="${emp.id}">${emp.full_name}</option>`;
        });
      }

      // Update dynamic employee selects in work order form
      const allEmpSelects = techSelectContainer.querySelectorAll('.employee-dropdown');
      allEmpSelects.forEach(select => {
        const currentVal = select.value;
        let options = '<option value="">Sélectionner un employé</option>';
        availableEmployees.forEach(emp => {
          options += `<option value="${emp.full_name}">${emp.full_name}</option>`;
        });
        select.innerHTML = options;
        select.value = currentVal;
      });

    } catch (err) { console.error("Erreur chargement employés:", err); }
  };

  await loadChefs();
  await loadEmployees();

  // Ajouter une ligne de sélection d'employé
  const addEmployeeSelectRow = () => {
    const div = document.createElement('div');
    div.className = 'tech-select-row';
    
    let options = '<option value="">Sélectionner un employé</option>';
    availableEmployees.forEach(emp => {
      options += `<option value="${emp.full_name}">${emp.full_name}</option>`;
    });

    div.innerHTML = `
      <select class="employee-dropdown" style="flex:1;">${options}</select>
      <button type="button" onclick="this.parentElement.remove()">X</button>
    `;
    techSelectContainer.appendChild(div);
  };

  if (techSelectContainer && techSelectContainer.children.length === 0) {
    addEmployeeSelectRow();
  }

  addTechBtn?.addEventListener('click', addEmployeeSelectRow);

  // Génération de l'onglet/section d'entrée de temps individualisée
  generateTimeEntriesBtn?.addEventListener('click', () => {
    const chefId = assignedToSelect.value;
    const selectedChef = availableChefs.find(c => c.id === chefId);

    // Extraction des employés sélectionnés
    const selectedEmpNames = [];
    const empSelects = techSelectContainer.querySelectorAll('.employee-dropdown');
    empSelects.forEach(select => {
      if (select.value) selectedEmpNames.push(select.value);
    });

    if (!chefId && selectedEmpNames.length === 0) {
      alert('Veuillez sélectionner au moins un chef d\'équipe ou un employé.');
      return;
    }

    timeEntriesList.innerHTML = '';

    // Entrée pour le Chef d'équipe
    if (selectedChef) {
      const chefRow = document.createElement('div');
      chefRow.className = 'time-row';
      chefRow.innerHTML = `
        <label>👑 Chef: ${selectedChef.full_name || selectedChef.username}</label>
        <input type="hidden" name="techLogName[]" value="${selectedChef.full_name || selectedChef.username} (Chef)">
        <input type="number" step="0.5" name="techLogHours[]" placeholder="Heures" required style="width:100px;">
      `;
      timeEntriesList.appendChild(chefRow);
    }

    // Entrée pour chaque Employé sélectionné
    selectedEmpNames.forEach(empName => {
      const empRow = document.createElement('div');
      empRow.className = 'time-row';
      empRow.innerHTML = `
        <label>👤 ${empName}</label>
        <input type="hidden" name="techLogName[]" value="${empName}">
        <input type="number" step="0.5" name="techLogHours[]" placeholder="Heures" required style="width:100px;">
      `;
      timeEntriesList.appendChild(empRow);
    });

    timeEntriesPanel.style.display = 'block';
  });

  // Soumission Bon de travail
  workOrderForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(workOrderForm);

    const logNames = formData.getAll('techLogName[]');
    const logHours = formData.getAll('techLogHours[]');
    
    if (logNames.length === 0) {
      alert('Veuillez cliquer sur "Saisir les heures de travail" pour compléter l\'entrée de temps.');
      return;
    }

    const techniciansLog = logNames.map((name, i) => ({ name, hours: logHours[i] }));

    const payload = {
      clientName: formData.get('clientName'),
      clientAddress: formData.get('clientAddress'),
      contactName: formData.get('contactName'),
      contactPhone: formData.get('contactPhone'),
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
      alert('Bon de travail créé avec succès !');
      workOrderForm.reset();
      timeEntriesList.innerHTML = '';
      timeEntriesPanel.style.display = 'none';
      techSelectContainer.innerHTML = '';
      addEmployeeSelectRow();
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

  // Section 2 : Ajouter Employé Terrain (Met à jour automatiquement la liste)
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
      await loadEmployees(); // Rafraîchit immédiatement toutes les listes déroulantes
    } else {
      const err = await res.json();
      alert('Erreur : ' + err.error);
    }
  });

  // Section 3 : Supprimer Employé
  deleteEmployeeBtn?.addEventListener('click', async () => {
    const selectedId = manageEmployeesSelect.value;
    if (!selectedId) return alert('Veuillez sélectionner un employé à supprimer.');

    if (!confirm('Confirmer la suppression de cet employé ?')) return;

    const res = await fetch(`/api/employees/${selectedId}`, { method: 'DELETE' });

    if (res.ok) {
      alert('Employé supprimé !');
      await loadEmployees(); // Rafraîchit les listes déroulantes
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
