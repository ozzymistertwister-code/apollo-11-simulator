#!/usr/bin/env bash
set -Eeuo pipefail

# Run on the existing VPS as root from this server/ directory. This extends
# syst8m-chat and does not create a service or modify any other site.
readonly APP_DIR=/opt/syst8m-chat
readonly NGINX=/etc/nginx/sites-available/sys8m
readonly STAMP=$(date -u +%Y%m%dT%H%M%SZ)

install -d -o root -g root -m 0755 /var/lib/apollo-11-simulator
install -o root -g root -m 0644 apollo_api.py "$APP_DIR/apollo_api.py"
cp -a "$APP_DIR/app.py" "$APP_DIR/app.py.before-apollo-$STAMP"
python3 - "$APP_DIR/app.py" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
if "from apollo_api import router as apollo_router" not in text:
    path.write_text(text.rstrip() + "\nfrom apollo_api import router as apollo_router\napp.include_router(apollo_router)\n")
PY
cp -a "$NGINX" "$NGINX.before-apollo-$STAMP"
python3 - "$NGINX" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
location = """    location ^~ /apollo/api/ {
        limit_req zone=syst8m_chat_limit burst=5 nodelay;
        client_max_body_size 32k;
        proxy_pass http://127.0.0.1:8008;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 15s;
        proxy_connect_timeout 5s;
        proxy_send_timeout 15s;
    }

"""
if 'location ^~ /apollo/api/' not in text:
    marker = '    # BEGIN olgabelovapsy-preview'
    if marker not in text:
        raise SystemExit('nginx insertion marker missing')
    path.write_text(text.replace(marker, location + marker, 1))
PY
nginx -t
systemctl restart syst8m-chat
nginx -s reload
printf 'Apollo API installation complete; backups use suffix %s\n' "$STAMP"
