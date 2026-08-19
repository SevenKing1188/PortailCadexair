document.addEventListener('DOMContentLoaded', async () => {
  // Sélection des éléments HTML principaux
  const settingsBtn = document.getElementById('settings-btn');
  const sidePanel = document.getElementById('side-panel');
  const closePanelBtn = document.getElementById('close-panel-btn');
  
  const createUserForm = document.getElementById('create-user-form');
  const workOrderForm = document.getElementById('work-order-form');
  const assignedToSelect = document.getElementById('assignedTo') || document.querySelector('select[name="assignedTo"]');
  const workOrdersList = document.getElementById('work-orders-list');
  const logoutBtn = document.getElementById('logout-btn');

  // GESTION DU PANNEAU LATÉRAL (PARAMÈTRES)
  if (settingsBtn && sidePanel) {
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sidePanel.classList.toggle('open');
    });
  }

  if (closePanelBtn && sidePanel) {
    closePanelBtn.addEventListener('click', () => {
      sidePanel.classList.remove('open');
    });
  }

  // Chargement initial des données
  await loadChefs();
  await loadWorkOrders();

  // Helper pour sécuriser l'affichage contre les failles XSS
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 1. Chargement de la liste des chefs d'équipe
  async function loadChefs() {
    if (!assignedToSelect) return;

    try {
      const response = await fetch('/api/chefs');
      if (!response.ok) throw new Error('Impossible de charger les chefs d\'équipe.');

      const chefs = await response.json();
      assignedToSelect.innerHTML = '<option value="">Sélectionner un chef d\'équipe</option>';

      chefs.forEach(chef => {
        const option = document.createElement('option');
        option.value = chef.id;

        const deptLabel = chef.department ? ` (${chef.department})` : '';
        option.textContent = `${chef.username}${deptLabel}`;

        assignedToSelect.appendChild(option);
      });
    } catch (error) {
      console.error('❌ Erreur chargement chefs :', error.message);
    }
  }

  // 2. Soumission du formulaire de création de Bon de Travail
  if (workOrderForm) {
    workOrderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = workOrderForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const formData = new FormData(workOrderForm);
      const payload = {
        title: formData.get('title'),
        clientName: formData.get('clientName'),
        clientAddress: formData.get('clientAddress'),
        appointmentDate: formData.get('appointmentDate'),
        appointmentTime: formData.get('appointmentTime'),
        department: formData.get('department'),
        nbHottes: formData.get('nbHottes'),
        nbPortesAcces: formData.get('nbPortesAcces'),
        nbVentilateurs: formData.get('nbVentilateurs'),
        assignedTo: formData.get('assignedTo'),
        description: formData.get('description')
      };

      try {
        const response = await fetch('/api/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'Erreur lors de la création du bon.');
          return;
        }

        alert(data.message || 'Bon de travail créé avec succès !');
        workOrderForm.reset();
        await loadWorkOrders();
      } catch (error) {
        alert('Erreur réseau lors de la création du bon.');
        console.error(error);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // 3. Soumission du formulaire de création d'Utilisateur
  if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = createUserForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const formData = new FormData(createUserForm);
      const payload = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
        role: formData.get('role'),
        department: formData.get('department')
      };

      try {
        const response = await fetch('/api/create-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          alert(data.error || 'Erreur lors de la création de l\'utilisateur.');
          return;
        }

        alert(data.message || 'Utilisateur créé avec succès !');
        createUserForm.reset();
        await loadChefs();
      } catch (error) {
        alert('Erreur réseau lors de la création de l\'utilisateur.');
        console.error(error);
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // 4. Récupération et affichage des Bons de Travail
  async function loadWorkOrders() {
    if (!workOrdersList) return;

    try {
      const response = await fetch('/api/work-orders');
      if (!response.ok) throw new Error('Erreur lors du chargement des bons.');

      const orders = await response.json();
      workOrdersList.innerHTML = '';

      if (orders.length === 0) {
        workOrdersList.innerHTML = '<p>Aucun bon de travail trouvé.</p>';
        return;
      }

      orders.forEach(order => {
        const card = document.createElement('div');
        card.className = 'work-order-card';
        card.innerHTML = `
          <h3>${escapeHTML(order.title || 'Tâche sans titre')} - ${escapeHTML(order.client_name || 'Client inconnu')}</h3>
          <p><strong>Département :</strong> ${escapeHTML(order.department || 'N/A')}</p>
          <p><strong>Chef assigné :</strong> ${escapeHTML(order.profiles?.username || 'Non assigné')}</p>
          <p><strong>Rendez-vous :</strong> ${escapeHTML(order.appointment_date || 'N/A')} à ${escapeHTML(order.appointment_time || 'N/A')}</p>
          <p><strong>Adresse :</strong> ${escapeHTML(order.client_address || 'N/A')}</p>
          <p><strong>Équipements :</strong> Hottes (${order.nb_hottes || 0}) | Portes (${order.nb_portes_acces || 0}) | Vent. (${order.nb_ventilateurs || 0})</p>
          <p><strong>Description :</strong> ${escapeHTML(order.description || 'Aucune')}</p>
          <p><strong>Statut :</strong> <span class="badge ${order.status === 'Terminé' ? 'success' : 'pending'}">${escapeHTML(order.status || 'En attente')}</span></p>
        `;
        workOrdersList.appendChild(card);
      });
    } catch (error) {
      console.error('❌ Erreur chargement bons :', error.message);
    }
  }

  // 5. Gestion de la déconnexion
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        await fetch('/api/logout', { method: 'POST' });
      } catch (error) {
        console.error('Erreur réseau lors de la déconnexion :', error);
      } finally {
        window.location.href = '/login.html';
      }
    });
  }
});
