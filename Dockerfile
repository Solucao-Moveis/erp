# syntax=docker/dockerfile:1
# SMERP — Página Principal (Hub estático) servida pelo Nginx.
# Imagem leve: apenas copia os arquivos estáticos para o Nginx.

FROM nginx:alpine

# Remove a config padrão e aplica a nossa
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos do site (inclui os 3 arquivos do PWA Android:
# manifest.webmanifest, sw.js e pwa.js — sem eles o "instalar na tela
# inicial" não aparece no Android).
COPY index.html styles.css script.js config.js notas.js notify.js theme.js mobilenav.js assistant.js engenharia.js manifest.webmanifest sw.js pwa.js /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

# Landing institucional pública (Solução Móveis) numa rota discreta: /institucional/
# Site estático separado (HTML/CSS/JS próprios) — não interfere no hub.
COPY landing/ /usr/share/nginx/html/institucional/

# Instalador do app de PC (Windows) servido pelo Hub: /download/SMERP-setup.exe
# É o que o botão de download da barra lateral baixa (mesma origem).
COPY download/ /usr/share/nginx/html/download/

# O proxy do EasyPanel deste app aponta para a porta 80 (solucaomoveis_erp:80)
EXPOSE 80

# OBS: sem HEALTHCHECK do Docker de propósito. Um healthcheck com "localhost"
# falha porque localhost resolve para IPv6 (::1) e o Nginx só escuta em IPv4,
# marcando o container como unhealthy e fazendo o EasyPanel devolver 502.
# O EasyPanel já monitora a saúde do serviço por conta própria.

CMD ["nginx", "-g", "daemon off;"]
