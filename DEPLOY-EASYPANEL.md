# Deploy do SMERP (Hub) no EasyPanel

Hub central da Solução Móveis — site estático servido por Nginx em container Docker.

## Estrutura
```
erp/
├── index.html        # Página principal (hub)
├── styles.css        # Identidade visual Solução Móveis
├── script.js         # Menu mobile e interações
├── assets/           # Logo
├── Dockerfile        # nginx:alpine servindo os estáticos
├── nginx.conf        # Config do Nginx (gzip + cache)
└── .dockerignore
```

## Passo a passo no EasyPanel

1. **Subir o código no GitHub**
   ```bash
   git add .
   git commit -m "SMERP hub inicial"
   git push origin main
   ```

2. **Criar o serviço no EasyPanel**
   - Acesse o EasyPanel → **+ Create** → **App**.
   - Nome sugerido: `smerp` (gera a URL `solucaomoveis-smerp.h5xdag.easypanel.host`).
   - **Source**: GitHub → selecione o repositório do ERP, branch `main`.
   - **Build**: tipo **Dockerfile** (o EasyPanel detecta o `Dockerfile` na raiz).

3. **Porta**
   - Em **Domains/Proxy**, aponte a porta interna **80** (exposta no Dockerfile).
   - O EasyPanel cuida do HTTPS (Let's Encrypt) automaticamente.

4. **Deploy**
   - Clique em **Deploy**. A cada `git push` no `main`, o EasyPanel rebuilda e republica (zero downtime).

## Testar localmente (opcional)
```bash
docker build -t smerp-hub .
docker run --rm -p 8080:80 smerp-hub
# abra http://localhost:8080
```

## URLs dos sistemas integrados
| Sistema      | Setor                  | URL |
|--------------|------------------------|-----|
| SC Manager   | Administrativo         | https://solucaomoveis-compras.h5xdag.easypanel.host/ |
| Hora a Hora  | Fábrica / Produção     | https://solucaomoveis-horaahora.h5xdag.easypanel.host/ |
| BIP Solução  | Expedição / Logística  | https://solucaomoveis-bip.h5xdag.easypanel.host/ |
