const express = require('express');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cookieParser());

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const MASTER_EMAIL = 'glesieur@cadexair.com';

// Middleware d'authentification par cookie / Token
async function authenticateToken(req, res, next) {
    const token = req.cookies.access_token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Accès refusé. Non authentifié.' });

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) throw new Error('Session invalide');
        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expirée ou invalide.' });
    }
}

// Middleware Admin
async function isAdmin(req, res, next) {
    if (req.user.email === MASTER_EMAIL) return next();

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();

    if (profile && profile.role === 'admin') return next();
    return res.status(403).json({ error: 'Droits d admin requis.' });
}

// 1. Obtenir la liste des Chefs d'Équipe
app.get('/api/chefs', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, username, department')
            .in('role', ['admin', 'chef']);

        if (error) throw error;

        const formatted = (data || []).map(c => ({
            id: c.id,
            name: c.full_name || c.username || 'Chef anonyme',
            department: c.department
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Fetch Chefs Error:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des chefs.' });
    }
});

// 2. Obtenir la liste des Employés Terrain
app.get('/api/employees', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('full_name', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Fetch Employees Error:', error);
        res.status(500).json({ error: 'Erreur chargement employés.' });
    }
});

// 3. Créer un Employé Terrain (Admin)
app.post('/api/employees', authenticateToken, isAdmin, async (req, res) => {
    const { fullName } = req.body;
    const cleanName = typeof fullName === 'string' ? fullName.trim() : '';

    if (!cleanName || cleanName.length < 2) {
        return res.status(400).json({ error: 'Le nom de l employe est invalide.' });
    }

    try {
        const { data, error } = await supabase
            .from('employees')
            .insert([{ full_name: cleanName }])
            .select();

        if (error) throw error;
        res.status(201).json({ message: 'Employe cree avec succes !', data });
    } catch (error) {
        console.error('Create Employee Error:', error);
        res.status(500).json({ error: error.message || 'Erreur lors de la creation.' });
    }
});

// 4. Supprimer un Employé Terrain (Admin)
app.delete('/api/employees/:id', authenticateToken, isAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase.from('employees').delete().eq('id', id);
        if (error) throw error;
        res.status(200).json({ message: 'Employe supprime.' });
    } catch (error) {
        console.error('Delete Employee Error:', error);
        res.status(500).json({ error: error.message || 'Erreur lors de la suppression.' });
    }
});

// 5. Créer un Bon de Travail
app.post('/api/work-orders', authenticateToken, async (req, res) => {
    const {
        clientName, clientAddress, contactName, contactPhone, appointmentDate, appointmentTime,
        department, nbHottes, assignedTo, description, techniciansLog
    } = req.body;

    try {
        const { data, error } = await supabase.from('work_orders').insert([{
            title: 'Bon de travail',
            client_name: String(clientName || '').trim(),
            client_address: String(clientAddress || '').trim(),
            contact_name: String(contactName || '').trim(),
            contact_phone: String(contactPhone || '').trim(),
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
            department: String(department || '').trim(),
            nb_hottes: parseInt(nbHottes) || 0,
            assigned_to: assignedTo || null,
            description: String(description || '').trim(),
            technicians_log: Array.isArray(techniciansLog) ? techniciansLog : [],
            created_by: req.user.id
        }]).select();

        if (error) throw error;
        res.status(201).json({ message: 'Bon de travail cree !', data });
    } catch (error) {
        console.error('Create Work Order Error:', error);
        res.status(500).json({ error: error.message || 'Erreur lors de la creation du bon.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur Portail Cadexair actif sur le port ${PORT}`));
