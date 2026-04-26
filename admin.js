document.addEventListener('DOMContentLoaded', () => {
    const loginContainer = document.getElementById('login-container');
    const dashboardContainer = document.getElementById('dashboard-container');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const passwordInput = document.getElementById('password');
    const errorMsg = document.getElementById('error-msg');
    const totalVisitsEl = document.getElementById('total-visits');
    const pagesTableBody = document.querySelector('#pages-table tbody');

    function checkAuth() {
        fetch('/api/check-auth')
            .then(res => res.json())
            .then(data => {
                if (data.isAdmin) {
                    showDashboard();
                } else {
                    showLogin();
                }
            });
    }

    function showLogin() {
        loginContainer.style.display = 'block';
        dashboardContainer.style.display = 'none';
    }

    function showDashboard() {
        loginContainer.style.display = 'none';
        dashboardContainer.style.display = 'block';
        loadStats();
    }

    function loadStats() {
        fetch('/api/stats')
            .then(res => res.json())
            .then(data => {
                if(data.error) return;
                totalVisitsEl.textContent = data.total;
                pagesTableBody.innerHTML = '';
                data.pages.forEach(p => {
                    const tr = document.createElement('tr');
                    const tdPage = document.createElement('td');
                    tdPage.textContent = p.page;
                    const tdCount = document.createElement('td');
                    tdCount.textContent = p.count;
                    tr.appendChild(tdPage);
                    tr.appendChild(tdCount);
                    pagesTableBody.appendChild(tr);
                });
            });
    }

    loginBtn.addEventListener('click', () => {
        const password = passwordInput.value;
        fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                errorMsg.textContent = '';
                passwordInput.value = '';
                showDashboard();
            } else {
                errorMsg.textContent = data.message || 'Login fehlgeschlagen';
            }
        });
    });

    logoutBtn.addEventListener('click', () => {
        fetch('/api/logout', { method: 'POST' })
            .then(() => showLogin());
    });

    checkAuth();
});
