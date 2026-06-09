let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('entryDate').value = today;

  await loadUserInfo();
  await loadEntries();
  await updateBalance();

  // Show admin link if user is admin
  if (currentUser && currentUser.role === 'admin') {
    document.getElementById('adminLink').style.display = 'block';
    document.getElementById('adminLink').href = '/admin.html';
  }
});

async function loadUserInfo() {
  try {
    currentUser = await API.auth.me();
    document.getElementById('username').textContent = currentUser.username;
    document.getElementById('userRole').textContent = currentUser.role;
  } catch (err) {
    console.error('Load user info error:', err);
  }
}

async function loadEntries() {
  try {
    const entries = await API.entries.getAll();
    const table = document.getElementById('entriesTable');

    if (entries.length === 0) {
      table.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No contributions yet</td></tr>';
      return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';
    const currentUserId = currentUser && currentUser.id;

    table.innerHTML = '';
    for (const entry of entries) {
      const canDelete = isAdmin || entry.user_id === currentUserId;
      const tr = document.createElement('tr');

      const tdDate = document.createElement('td');
      tdDate.textContent = new Date(entry.entry_date).toLocaleDateString();
      tr.appendChild(tdDate);

      const tdUser = document.createElement('td');
      tdUser.textContent = entry.username;
      tr.appendChild(tdUser);

      const tdAmount = document.createElement('td');
      tdAmount.className = 'text-success';
      tdAmount.textContent = '$' + parseFloat(entry.amount).toFixed(2);
      tr.appendChild(tdAmount);

      const tdDesc = document.createElement('td');
      tdDesc.textContent = entry.description || '-';
      tr.appendChild(tdDesc);

      const tdAction = document.createElement('td');
      if (canDelete) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-danger';
        btn.textContent = 'Delete';
        btn.addEventListener('click', () => deleteEntry(entry.id));
        tdAction.appendChild(btn);
      }
      tr.appendChild(tdAction);

      table.appendChild(tr);
    }
  } catch (err) {
    console.error('Load entries error:', err);
    document.getElementById('entriesTable').innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading entries</td></tr>';
  }
}

async function updateBalance() {
  try {
    const summary = await API.entries.getSummary();
    document.getElementById('totalBalance').textContent = `$${parseFloat(summary.total).toFixed(2)}`;
  } catch (err) {
    console.error('Update balance error:', err);
  }
}

async function deleteEntry(entryId) {
  if (!confirm('Delete this contribution?')) {
    return;
  }

  try {
    await API.entries.delete(entryId);
    await loadEntries();
    await updateBalance();
  } catch (err) {
    alert('Error deleting entry: ' + err.message);
  }
}

document.getElementById('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const amount = document.getElementById('amount').value;
  const entryDate = document.getElementById('entryDate').value;
  const description = document.getElementById('description').value;
  const errorDiv = document.getElementById('error');
  const successDiv = document.getElementById('success');

  errorDiv.classList.add('d-none');
  successDiv.classList.add('d-none');

  try {
    await API.entries.create(parseFloat(amount), description, entryDate);
    successDiv.classList.remove('d-none');

    // Reset form
    document.getElementById('entryForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('entryDate').value = today;

    // Reload data
    await loadEntries();
    await updateBalance();

    // Hide success message
    setTimeout(() => {
      successDiv.classList.add('d-none');
    }, 3000);
  } catch (err) {
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('d-none');
  }
});

document.getElementById('changePasswordBtn').addEventListener('click', () => {
  window.location.href = '/change-password.html';
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await API.auth.logout();
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout error:', err);
    window.location.href = '/login.html';
  }
});
