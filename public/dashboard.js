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

  // Constructeur sécurisé d'options <option>
  const createSafeOption = (value, text) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
  };

  // Gestion des sessions expirées ou non autorisées
  const handleAuthError = (res) => {
    if (res.status === 401 || res.status === 403) {
      window.location.href = '/index.html';
      return true;
    }
    return false;
  };

  // Controles de la barre latérale
  settingsBtn?.addEventListener('click', () => sidePanel.classList.add('open'));
  closePanelBtn?.addEventListener('click', () => sidePanel.classList.remove('open'));

  // Charger la liste des Chefs d'équipe
  const loadChefs = async () => {
    try {
      const res = await fetch('/api/chefs');
      if (handleAuthError(res)) return;

      const data = await res.json();
      if (!Array.isArray(data)) {
        console.error("Format de réponse chefs invalide :", data);
        return;
      }

      availableChefs = data;
      if (assignedToSelect) {
        assignedToSelect.innerHTML = '';
        assignedToSelect.appendChild(createSafeOption('', "Sélectionner un chef d'équipe"));
        availableChefs.forEach(c => {
          const name = c.full_name || c.username || 'Chef';
          assignedToSelect.appendChild(createSafeOption(c.id, name));
        });
      }
    } catch (err) {
      console.error("Erreur de chargement des chefs :", err);
    }
  };

  // Rafraîchir toutes les listes déroulantes d'employés affichées sur la page
  const refreshAllEmployeeDropdowns = () => {
    if (!techSelectContainer) return;
    const allEmpSelects = techSelectContainer.querySelectorAll('.employee-dropdown');
    allEmpSelects.forEach(select => {
      const currentVal = select.value;
      select.innerHTML = '';
      select.appendChild(createSafeOption('', 'Sélectionner un employé'));
      if (Array.isArray(availableEmployees)) {
        availableEmployees.forEach(emp => {
          select.appendChild(createSafeOption(emp.full_name, emp.full_name));
        });
      }
      select.value = currentVal;
    });
  };

  // Charger la liste des Employés
  const loadEmployees = async () => {
    try {
      const res = await fetch('/api/employees');
      if (handleAuthError(res)) return;

      const data = await res.json();
      if (!Array.isArray(data)) {
        console.error("Format de réponse employés invalide :", data);
        return;
      }

      availableEmployees = data;

      // Mise à jour du menu déroulant dans Paramètres (Section 3)
      if (manageEmployeesSelect) {
        manageEmployeesSelect.innerHTML = '';
        manageEmployeesSelect.appendChild(createSafeOption('', 'Sélectionner un employé à supprimer'));
        availableEmployees.forEach(emp => {
          manageEmployeesSelect.appendChild(createSafeOption(emp.id, emp.full_name));
        });
      }

      refreshAllEmployeeDropdowns();

    } catch (err) {
      console.error("Erreur de chargement des employés :", err);
    }
  };

  // Ajouter un champ de sélection d'employé dans le formulaire
  const addEmployeeSelectRow = () => {
    if (!techSelectContainer) return;
    const div = document.createElement('div');
    div.className = 'tech-select-row';
    
    const select = document.createElement('select');
    select.className = 'employee-dropdown';
    select.style.flex = '1';
    select.appendChild(createSafeOption('', 'Sélectionner un employé'));

    if (Array.isArray(availableEmployees)) {
      availableEmployees.forEach(emp => {
        select.appendChild(createSafeOption(emp.full_name, emp.full_name));
      });
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'X';
    removeBtn.onclick = () => div.remove();

    div.appendChild(select);
    div.appendChild(removeBtn);
    techSelectContainer.appendChild(div);
  };

  // Initialisation au chargement de la page
  await loadChefs();
  await loadEmployees();

  if (techSelectContainer && techSelectContainer.children.length === 0) {
    addEmployeeSelectRow();
  }

  addTechBtn?.addEventListener('click', addEmployeeSelectRow);

  // Génération des lignes de saisie d'heures
  generateTimeEntriesBtn?.addEventListener('click', () => {
    const chefId = assignedToSelect.value;
    const selectedChef = availableChefs.find(c => c.id === chefId);

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

    if (selectedChef) {
      const chefRow = document.createElement('div');
      chefRow.className = 'time-row';

      const label = document.createElement('label');
      label.textContent = `👑 Chef: ${selectedChef.full_name || selectedChef.username}`;

      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = 'techLogName[]';
      hiddenInput.value = `${selectedChef.full_name || selectedChef.username} (Chef)`;

      const hoursInput = document.createElement('input');
      hoursInput.type = 'number';
      hoursInput.step = '0.5';
      hoursInput.name = 'techLogHours[]';
      hoursInput.placeholder = 'Heures';
      hoursInput.required = true;
      hoursInput.style.width = '100px';

      chefRow.appendChild(label);
      chefRow.appendChild(hiddenInput);
      chefRow.appendChild(hoursInput);
      timeEntriesList.appendChild(chefRow);
    }

    selectedEmpNames.forEach(empName => {
      const empRow = document.createElement('div');
      empRow.className = 'time-row';

      const label = document.createElement('label');
      label.textContent = `👤 ${empName}`;

      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'hidden';
      hiddenInput.name = 'techLogName[]';
      hiddenInput.value = empName;

      const hoursInput = document.createElement('input');
      hoursInput.type = 'number';
      hoursInput.step = '0.5';
      hoursInput.name = 'techLogHours[]';
      hoursInput.placeholder = 'Heures';
      hoursInput.required = true;
      hoursInput.style.width = '100px';

      empRow.appendChild(label);
      empRow.appendChild(hiddenInput);
      empRow.appendChild(hoursInput);
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
      alert('Erreur : ' + (err.error || 'Erreur lors de la création'));
    }
  });

  // Soumission : Créer un Chef d'équipe
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
      alert('Erreur : ' + (err.error || 'Erreur de création'));
    }
  });

  // Soumission : Créer un Employé Terrain
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
      alert('Erreur : ' + (err.error || 'Erreur lors de l\'ajout'));
    }
  });

  // Action : Supprimer un Employé
  deleteEmployeeBtn?.addEventListener('click', async () => {
    const selectedId = manageEmployeesSelect.value;
    if (!selectedId) return alert('Veuillez sélectionner un employé à supprimer.');

    if (!confirm('Confirmer la suppression de cet employé ?')) return;

    const res = await fetch(`/api/employees/${selectedId}`, { method: 'DELETE' });

    if (res.ok) {
      alert('Employé supprimé !');
      await loadEmployees();
    } else {
      const err = await res.json();
      alert('Erreur : ' + (err.error || 'Erreur de suppression'));
    }
  });

  // Déconnexion
  logoutBtn?.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/index.html';
  });
});
