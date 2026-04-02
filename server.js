require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());
app.use(express.json());

// Proxy reverso: todas as rotas /api/* vão para a API da EDUSP
app.use('/api', createProxyMiddleware({
  target: process.env.EDUSP_API_URL || 'https://api.educacao.sp.gov.br',
  changeOrigin: true,
  pathRewrite: {
    '^/api': ''  // remove o prefixo /api ao encaminhar
  },
  onProxyReq: (proxyReq, req, res) => {
    // Headers obrigatórios da EDUSP
    proxyReq.setHeader('x-api-realm', 'edusp');
    proxyReq.setHeader('x-api-platform', 'webclient');
    proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Repassa o token se o frontend enviar
    if (req.headers['x-api-key']) {
      proxyReq.setHeader('x-api-key', req.headers['x-api-key']);
    }
    
    // Garante Content-Type para POST/PUT
    if (req.method === 'POST' || req.method === 'PUT') {
      proxyReq.setHeader('Content-Type', 'application/json');
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Erro no proxy', message: err.message });
  }
}));

// Rota de teste para saber se o proxy está online
app.get('/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy EDUSP rodando na porta ${PORT}`);
  console.log(`Encaminhando /api/* para ${process.env.EDUSP_API_URL || 'https://api.educacao.sp.gov.br'}`);
});
