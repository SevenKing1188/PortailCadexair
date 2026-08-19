document.addEventListener('DOMContentLoaded', async () => {
  // 1. Sélection des éléments DOM
  const settingsBtn = document.getElementById('settings-btn');
  const sidePanel = document.getElementById('side-panel');
  const closePanelBtn = document.getElementById('close-panel-btn');
  const workOrderForm = document.getElementById('work-order-form');
  const createUserForm = document.getElementById('create-user-form');
  const addTechBtn = document.getElementById('add-tech-btn');
  const techContainer = document.getElementById('technicians-container');
  const logoutBtn = document.getElementById('logout-btn');
  const assignedToSelect = document.getElementById('assignedTo');

  // 2. Gestion du Panneau Latéral (Paramètres)
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => sidePanel.classList.add('open'));
  }
  if (closePanelBtn) {
    closePanelBtn.addEventListener('click', () => sidePanel.classList.remove('open'));
  }

  // 3. Gestion dynamique des techniciens (Ajout de lignes)
  if (addTechBtn) {
    addTechBtn.addEventListener('click', () => {
      const div = document.createElement('div');
      div.className = 'tech-row';
      div.style.display = 'flex';
      div.style.gap = '10px';
      div.style.marginBottom = '5px';
      div.innerHTML = `
        <input type="text" name="techName[]" placeholder="Nom technicien" required>
        <input type="number" name="techHours[]" placeholder="Heures" required>
        <button type="button" onclick="this.parentElement.remove()">X</button>
      `;
      techContainer.appendChild(div);
    });
  }

  // 4. Chargement des chefs d'équipe dans le select
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
    } catch (err) {
      console.error("Erreur chargement chefs:", err);
    }
  };
  loadChefs();

  // 5. Soumission du formulaire Bon de travail
  if (workOrderForm) {
    workOrderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(workOrderForm);
      
      // Extraction des listes dynamiques
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

      try {
        const res = await fetch('/api/work-orders', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          alert('Bon de travail créé avec succès !');
          workOrderForm.reset();
          // Optionnel : Réinitialiser les lignes de techniciens ici si nécessaire
        } else {
          const err = await res.json();
          alert('Erreur : ' + (err.error || 'Une erreur est survenue'));
        }
      } catch (err) {
        alert('Erreur de connexion au serveur.');
      }
    });
  }

  // 6. Soumission Création Utilisateur (Admin)
  if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(createUserForm);
      const payload = Object.fromEntries(formData.entries());

      try {
        const res = await fetch('/api/create-user', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          alert('Utilisateur créé avec succès !');
          createUserForm.reset();
        } else {
          const err = await res.json();
          alert('Erreur : ' + (err.error || 'Erreur lors de la création'));
        }
      } catch (err) {
        alert('Erreur de connexion au serveur.');
      }
    });
  }

  // 7. Déconnexion
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/index.html';
      } catch (err) {
        console.error("Erreur déconnexion:", err);
      }
    });
  }
});
