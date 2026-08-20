// public/app.js - Portail Cadexair Operations v3.1

// 1. GESTION DU TIROIR / DRAWER PARAMÈTRES ET DÉCONNEXION
function ouvrirDrawerParametres() {
    const drawer = document.getElementById('drawer-parametres');
    if (drawer) {
        drawer.classList.add('active');
    }
}

function fermerDrawerParametres() {
    const drawer = document.getElementById('drawer-parametres');
    if (drawer) {
        drawer.classList.remove('active');
    }
}

function fermerDrawerSiFond(event) {
    if (event.target.id === 'drawer-parametres') {
        fermerDrawerParametres();
    }
}

function deconnexion() {
    // Effacer cookies ou tokens locaux
    document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    localStorage.clear();

    fermerDrawerParametres();

    // Rediriger ou mettre à jour l'UI
    alert('Vous avez été déconnecté avec succès.');
    window.location.reload();
}

// 2. GESTION DES EMPLOIÉS ET DE L'AFFECTATION DYNAMIQUE
let globalEmployeesList = [];

async function loadEmployeesList() {
    try {
        const res = await fetch('/api/employees');
        if (res.ok) {
            globalEmployeesList = await res.json();
        }
    } catch (e) {
        console.error('Erreur chargement liste employés:', e);
    }
}

function ajouterEmployeAffecte() {
    const container = document.getElementById('liste-employes-affectes');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'employe-row';

    let optionsHtml = '<option value="">-- Sélectionner un employé --</option>';
    if (globalEmployeesList.length > 0) {
        globalEmployeesList.forEach(emp => {
            optionsHtml += `<option value="${emp.id}">${emp.full_name}</option>`;
        });
    } else {
        // Fallback local si l'API n'est pas connectée
        const fallback = ['Clément', 'Guillaume', 'Justin'];
        fallback.forEach(name => {
            optionsHtml += `<option value="${name}">${name}</option>`;
        });
    }

    row.innerHTML = `
        <select class="select-employe-affecte" style="flex: 1; padding: 10px; background: var(--bg-input); border: 1px solid var(--border-color); color: var(--text-main); border-radius: 6px;" required>
            ${optionsHtml}
        </select>
        <button type="button" class="btn-remove-emp" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(row);
}

// 3. SAISIE DES HEURES TRAVAILLÉES
function toggleSaisieHeures() {
    const section = document.getElementById('section-saisie-heures');
    if (section) {
        if (section.style.display === 'none' || section.style.display === '') {
            section.style.display = 'block';
            section.scrollIntoView({ behavior: 'smooth' });
        } else {
            section.style.display = 'none';
        }
    }
}

// 4. CHARGEMENT AUTOMATIQUE DES CHEFS D'ÉQUIPE
async function loadChefsDropdown() {
    const selectElement = document.getElementById('assignedTo');
    if (!selectElement) return;

    try {
        const response = await fetch('/api/chefs');
        if (!response.ok) throw new Error('Erreur réseau lors de la récupération des chefs.');

        const chefs = await response.json();

        selectElement.innerHTML = '<option value="">-- Sélectionner un chef d équipe --</option>';

        if (chefs.length === 0) {
            const option = document.createElement('option');
            option.disabled = true;
            option.textContent = 'Aucun chef d équipe disponible';
            selectElement.appendChild(option);
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
        console.error('Erreur au chargement des chefs d équipe :', error);
        // Direct fallback option pour la démo locale
        selectElement.innerHTML = `
            <option value="">-- Sélectionner un chef d équipe --</option>
            <option value="1">Guillaume (Chef Équipe / Admin)</option>
            <option value="2">Clément (Chef Équipe)</option>
        `;
    }
}

// INITIALISATION AU CHARGEMENT
document.addEventListener('DOMContentLoaded', () => {
    loadChefsDropdown();
    loadEmployeesList();
});
