# syntax=docker/dockerfile:1
# SMERP — Página Principal (Hub estático) servida pelo Nginx.
# Imagem leve: apenas copia os arquivos estáticos para o Nginx.

FROM nginx:alpine

# Remove a config padrão e aplica a nossa
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos do site
COPY index.html styles.css script.js config.js /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

# O proxy do EasyPanel deste app aponta para a porta 80 (solucaomoveis_erp:80)
EXPOSE 80

# OBS: sem HEALTHCHECK do Docker de propósito. Um healthcheck com "localhost"
# falha porque localhost resolve para IPv6 (::1) e o Nginx só escuta em IPv4,
# marcando o container como unhealthy e fazendo o EasyPanel devolver 502.
# O EasyPanel já monitora a saúde do serviço por conta própria.

CMD ["nginx", "-g", "daemon off;"]
