document.getElementById('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('newEmail').value,
      password: document.getElementById('newPassword').value
    })
  });
  const data = await res.json();
  const statusDiv = document.getElementById('statusMsg');
  if (res.ok) {
    statusDiv.style.color = 'green';
    statusDiv.innerText = data.message;
    e.target.reset();
  } else {
    statusDiv.style.color = 'red';
    statusDiv.innerText = data.error;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/index.html';
});