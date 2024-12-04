
// Referência ao formulário
const loginForm = document.getElementById('login-form');
console.log(loginForm);

// Referência à mensagem de erro
const errorMessage = document.getElementById('error-message');

// Credenciais corretas
const validUsername = "Emizinha";
const validPassword = "Emizinha123";

// Adiciona um evento de submissão ao formulário
loginForm.addEventListener('click', function(event) {
    event.preventDefault(); // Previne o envio padrão do formulário

    // Obtém os valores inseridos pelo usuário
    const enteredUsername = document.getElementById('username').value;
    const enteredPassword = document.getElementById('password').value;

    // Verifica se as credenciais são válidas
    console.log(enteredUsername, validUsername, enteredPassword, validPassword);
    

    if (enteredUsername === validUsername && enteredPassword === validPassword) {
        console.log("sucesso");
        
        // Redireciona para a página inicial
        window.location.href = "home.html";
    } else {
        console.log("!sucesso");
        
        // Exibe a mensagem de erro
       // alert('usuário ou senha incorretos')
       // Exibe a mensagem de erro personalizada
       errorMessage.textContent = "Usuário ou senha incorretos. Tente novamente.";
       errorMessage.style.display = "block";
       errorMessage.style.color = "red";
    }
});
