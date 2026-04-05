const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // Permite chamadas de qualquer front-end (opcional, mas útil)

// ========== CONFIGURAÇÕES (podem vir de variáveis de ambiente) ==========
const LOGIN_API_URL = process.env.LOGIN_API_URL || 'https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken';
const SUBSCRIPTION_KEY = process.env.SUBSCRIPTION_KEY || '2b03c1db3884488795f79c37c069381a';
const TOKEN_API_URL = process.env.TOKEN_API_URL || 'https://edusp-api.ip.tv/registration/edusp/token';
const X_API_PLATFORM = process.env.X_API_PLATFORM || 'webclient';
const X_API_REALM = process.env.X_API_REALM || 'edusp';
const USER_AGENT = process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const TIMEOUT = parseInt(process.env.TIMEOUT || '30000');

// ========== ENDPOINT PRINCIPAL ==========
app.post('/login', async (req, res) => {
    const { user, senha } = req.body;

    if (!user || !senha) {
        return res.status(400).json({ success: false, error: 'user e senha são obrigatórios' });
    }

    try {
        // --- Passo 1: login na API da SED ---
        const loginResponse = await axios({
            method: 'post',
            url: LOGIN_API_URL,
            timeout: TIMEOUT,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'pt-BR,pt;q=0.9',
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                'Origin': 'https://saladofuturo.educacao.sp.gov.br',
                'Referer': 'https://saladofuturo.educacao.sp.gov.br/',
                'User-Agent': USER_AGENT
            },
            data: { user, senha }
        });

        const loginData = loginResponse.data;
        const token = loginData.token;
        if (!token) {
            return res.status(401).json({ success: false, error: 'Token não retornado pela primeira API' });
        }

        // Extrai telefone (opcional)
        const telefone = loginData.DadosUsuario?.A?.[0]?.NR_TELEFONE || 'Não informado';

        // --- Passo 2: troca token por auth_token ---
        const authResponse = await axios({
            method: 'post',
            url: TOKEN_API_URL,
            timeout: TIMEOUT,
            headers: {
                'accept': 'application/json',
                'accept-language': 'pt-BR,pt;q=0.9',
                'cache-control': 'no-cache',
                'content-type': 'application/json',
                'origin': 'https://saladofuturo.educacao.sp.gov.br',
                'referer': 'https://saladofuturo.educacao.sp.gov.br/',
                'user-agent': USER_AGENT,
                'x-api-platform': X_API_PLATFORM,
                'x-api-realm': X_API_REALM
            },
            data: { token }
        });

        const authData = authResponse.data;
        const authToken = authData.auth_token;
        if (!authToken) {
            return res.status(502).json({ success: false, error: 'auth_token não retornado pela segunda API' });
        }

        // Sucesso
        return res.json({
            success: true,
            auth_token: authToken,
            telefone: telefone
        });

    } catch (error) {
        console.error('Erro no proxy:', error.message);
        if (error.response) {
            // A resposta da API externa teve erro HTTP
            return res.status(error.response.status).json({
                success: false,
                error: `API externa respondeu com ${error.response.status}: ${error.response.statusText}`
            });
        }
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Rota de saúde
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'Edusp Auth Proxy (Node.js)' });
});

// Inicia o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy rodando na porta ${PORT}`);
});
