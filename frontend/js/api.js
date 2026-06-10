const API = {
  async request(method, path, body = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`/api${path}`, options);

      // Check for force password change
      if (response.status === 403) {
        const data = await response.json();
        if (data.forceChange) {
          window.location.href = '/change-password.html';
          return;
        }
      }

      // Redirect on unauthorized (skip for the login endpoint itself)
      if (response.status === 401 && !path.includes('/auth/login')) {
        window.location.href = '/login.html';
        return;
      }

      // Handle other error statuses
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      throw err;
    }
  },

  auth: {
    login: (username, password) => API.request('POST', '/auth/login', { username, password }),
    logout: () => API.request('POST', '/auth/logout'),
    me: () => API.request('GET', '/auth/me'),
    changePassword: (currentPassword, newPassword) =>
      API.request('POST', '/auth/change-password', { currentPassword, newPassword })
  },

  entries: {
    getAll: () => API.request('GET', '/entries'),
    getSummary: () => API.request('GET', '/entries/summary'),
    create: (amount, description, entryDate) =>
      API.request('POST', '/entries', { amount, description, entryDate }),
    delete: (id) => API.request('DELETE', `/entries/${id}`)
  },

  users: {
    getAll: () => API.request('GET', '/users'),
    create: (username, password) =>
      API.request('POST', '/users', { username, password }),
    delete: (id) => API.request('DELETE', `/users/${id}`),
    resetPassword: (id) => API.request('POST', `/users/${id}/reset-password`),
    toggleRole: (id) => API.request('PUT', `/users/${id}/role`)
  },

  backup: {
    download: async () => {
      const response = await fetch('/api/backup', {
        method: 'GET',
        credentials: 'include'
      });
      if (response.status === 401) { window.location.href = '/login.html'; return; }
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const date = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `repairfund-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    restore: (data) => API.request('POST', '/backup/restore', data)
  }
};
