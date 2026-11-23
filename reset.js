
        // Pamiętaj o podmianie adresu API, jeśli używasz innego w projekcie
        const API = "";
        
        // Wyciągamy token (tajny kod) z linku URL
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
            document.getElementById('reset-form-container').innerHTML = 
                "<p style='color: var(--danger); font-weight: bold;'>Błąd: Brakujący lub nieprawidłowy link.</p>";
        }

        async function saveNewPassword() {
            const pass1 = document.getElementById('new-pass').value;
            const pass2 = document.getElementById('new-pass-confirm').value;
            const msgEl = document.getElementById('msg');

            if (!pass1 || !pass2) {
                msgEl.innerText = "Uzupełnij oba pola!";
                msgEl.style.color = "var(--danger)";
                return;
            }

            if (pass1 !== pass2) {
                msgEl.innerText = "Hasła nie są identyczne!";
                msgEl.style.color = "var(--danger)";
                return;
            }

            msgEl.innerText = "Zapisywanie...";
            msgEl.style.color = "var(--text-muted)";

            try {
                const res = await fetch(`${API}/api/reset-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: token, newPassword: pass1 })
                });

                const data = await res.json();

                if (res.ok) {
                    document.getElementById('reset-form-container').classList.add('hidden');
                    document.getElementById('success-container').classList.remove('hidden');
                } else {
                    msgEl.innerText = data.error || "Wystąpił błąd.";
                    msgEl.style.color = "var(--danger)";
                }
            } catch (e) {
                msgEl.innerText = "Błąd połączenia z serwerem.";
                msgEl.style.color = "var(--danger)";
            }
        }
    

    function toggleVisibility(inputId, iconId) {
        const input = document.getElementById(inputId);
        const icon = document.getElementById(iconId);
        if (input.type === "password") {
            input.type = "text";
            icon.classList.remove("fa-eye");
            icon.classList.add("fa-eye-slash");
            icon.style.color = "white"; // Podświetla ikonkę po kliknięciu
        } else {
            input.type = "password";
            icon.classList.remove("fa-eye-slash");
            icon.classList.add("fa-eye");
            icon.style.color = "var(--text-muted)";
        }
    }
