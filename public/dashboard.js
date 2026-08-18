document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  const openSettings = document.getElementById('openSettings');
  const closeSettings = document.getElementById('closeSettings');
  const logoutBtn = document.getElementById('logoutBtn');
  const historyList = document.getElementById('historyList');

  // Ouverture / Fermeture du panneau paramètres
  if (openSettings) {
    openSettings.addEventListener('click', () => sidebar.classList.add('open'));
  }
  if (closeSettings) {
    closeSettings.addEventListener('click', () => sidebar.classList.remove('open'));
  }

  // Gestion de la déconnexion
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      window.location.href = '/login.html';
    });
  }

  // Chargement des chefs d'équipe dans le selecteur
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
      console.error("Erreur lors du chargement des chefs:", err);
    }
  }

  // Chargement de l'historique des bons de travail
  async function loadHistory() {
    try {
      const res = await fetch('/api/work-orders');
      if (res.ok) {
        const orders = await res.json();
        if (historyList) {
          if (orders.length === 0) {
            historyList.innerHTML = '<p style="color: var(--text-gray);">Aucun bon de travail pour le moment.</p>';
            return;
          }
          historyList.innerHTML = orders.map(o => `
            <div class="history-item" data-id="${o.id}">
              <div><strong>${o.title}</strong> - ${o.client_name || 'Client N/A'}</div>
              <div><span style="color:${o.status === 'Terminé' ? '#22c55e' : '#f97316'}">${o.status}</span></div>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.error("Erreur lors du chargement de l'historique:", err);
    }
  }

  loadChefs();
  loadHistory();
});