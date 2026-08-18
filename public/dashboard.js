document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const openSettings = document.getElementById('openSettings');
  const closeSettings = document.getElementById('closeSettings');
  const logoutBtn = document.getElementById('logoutBtn');
  const historyList = document.getElementById('historyList');
  const createUserForm = document.getElementById('createUserForm');
  const workOrderForm = document.getElementById('workOrderForm');
  const detailsModal = document.getElementById('detailsModal');
  const closeModalBtn = document.getElementById('closeModalBtn');

  // Gestion du Panneau Paramètres
  if (openSettings) {
    openSettings.addEventListener('click', () => sidebar.classList.add('open'));
  }
  if (closeSettings) {
    closeSettings.addEventListener('click', () => sidebar.classList.remove('open'));
  }

  // Déconnexion
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/index.html';
    });
  }

  // Fermeture Modale
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      detailsModal.style.display = 'none';
    });
  }

  // Chargement des chefs d'équipe
  async function loadChefs() {
    try {
      const res = await fetch('/api/chefs');
      if (res.ok) {
        const chefs = await res.json();
        const select = document.getElementById('woAssignee');
        if (select) {
          select.innerHTML = chefs.map(c => `<option value="${c.id}">${c.username} (${c.department})</option>`).join('');
        }
      }
    } catch (err) {
      console.error("Erreur chefs :", err);
    }
  }

  // Chargement de l'historique
  async function loadHistory() {
    try {
      const res = await fetch('/api/work-orders');
      if (res.ok) {
        const orders = await res.json();
        if (historyList) {
          if (orders.length === 0) {
            historyList.innerHTML = '<p style="color: var(--text-gray);">Aucun bon de travail enregistré.</p>';
            return;
          }
          historyList.innerHTML = orders.map(o => `
            <div class="history-item" data-id="${o.id}">
              <div><strong>${o.title}</strong> - ${o.client_name || 'Client N/A'}</div>
              <div><span style="color:${o.status === 'Terminé' ? '#22c55e' : '#f97316'}">${o.status}</span></div>
            </div>
          `).join('');

          // Ajout des écouteurs de clic sur l'historique
          document.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
              const id = item.getAttribute('data-id');
              const order = orders.find(o => o.id == id);
              if (order) showOrderDetails(order);
            });
          });
        }
      }
    } catch (err) {
      console.error("Erreur historique :", err);
    }
  }

  // Affichage des détails d'un bon de travail
  function showOrderDetails(o) {
    document.getElementById('modalTitle').innerText = o.title;
    document.getElementById('modalBody').innerHTML = `
      <p><strong>Client :</strong> ${o.client_name || 'N/A'}</p>
      <p><strong>Adresse :</strong> ${o.client_address || 'N/A'}</p>
      <p><strong>Rendez-vous :</strong> ${o.appointment_date || ''} à ${o.appointment_time || ''}</p>
      <p><strong>Équipements :</strong> ${o.nb_hottes} Hottes, ${o.nb_portes_acces} Portes, ${o.nb_ventilateurs} Ventilateurs</p>
      <p><strong>Département :</strong> ${o.department}</p>
      <p><strong>Description :</strong> ${o.description}</p>
      <p><strong>Statut :</strong> ${o.status}</p>
    `;
    detailsModal.style.display = 'flex';
  }

  // Soumission : Création Utilisateur
  if (createUserForm) {
    createUserForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value,
        role: document.getElementById('role').value,
        department: document.getElementById('department').value
      };

      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      alert(data.message || data.error);
      if (res.ok) createUserForm.reset();
    });
  }

  // Soumission : Bon de Travail
  if (workOrderForm) {
    workOrderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById('woTitle').value,
        clientName: document.getElementById('clientName').value,
        clientAddress: document.getElementById('clientAddress').value,
        appointmentDate: document.getElementById('appointmentDate').value,
        appointmentTime: document.getElementById('appointmentTime').value,
        nbHottes: document.getElementById('nbHottes').value,
        nbPortesAcces: document.getElementById('nbPortesAcces').value,
        nbVentilateurs: document.getElementById('nbVentilateurs').value,
        department: document.getElementById('woDepartment').value,
        assignedTo: document.getElementById('woAssignee').value,
        description: document.getElementById('woDescription').value
      };

      const res = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      alert(data.message || data.error);
      if (res.ok) {
        workOrderForm.reset();
        loadHistory();
      }
    });
  }

  loadChefs();
  loadHistory();
});
