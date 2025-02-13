document.getElementById('signup-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = document.getElementById('signup-username').value;
    const password = document.getElementById('signup-password').value;
    
    const response = await fetch('/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    console.log(response)
    if (response.ok) {
      const data = await response.json();
      const token = data.token;
      const userId = data.user._id;
      console.log(data.user)
      localStorage.setItem('token', token);
      localStorage.setItem('userId', userId);
      window.location.href = '/index.html'; // Redirect to main page
    } else {
      alert('Signup failed');
    }
  });
  