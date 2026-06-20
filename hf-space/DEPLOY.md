# Deploy — Yutubo Backend no HuggingFace Spaces

Instruções passo a passo de deploy do backend no HuggingFace Spaces (SDK Docker).
Referência para a Story 1.2, Fases 3 e 4 (ação manual de @devops / humano).

> URL pública esperada: `https://juan-felipe1-yutubo-backend.hf.space`

---

## Pré-requisitos

- Conta HuggingFace (username: `Juan-Felipe1`) — criar em https://huggingface.co se necessário.
- Git instalado e configurado.
- Token de escrita do HuggingFace (Settings → Access Tokens → New token, role `write`).
  Usado como senha ao fazer `git push` para o Space.

---

## Passo 1 — Criar o Space

1. Acessar https://huggingface.co → botão **New** → **Space**.
2. Owner: `Juan-Felipe1`.
3. Space name: `yutubo-backend`.
4. License: à escolha (ex: MIT).
5. SDK: **Docker** (selecionar "Blank" / Dockerfile próprio — NÃO um template pré-pronto).
6. Visibility: **Public**.
7. Clicar **Create Space**.

O Space nasce vazio com a URL:
`https://huggingface.co/spaces/Juan-Felipe1/yutubo-backend`

---

## Passo 2 — Clonar o Space localmente

A partir da raiz do repositório Yutubo:

```bash
git clone https://huggingface.co/spaces/Juan-Felipe1/yutubo-backend hf-clone
```

Isso cria a pasta `hf-clone/` (já listada no .gitignore do repo, não versionar).

> Se o clone pedir autenticação, use o username HuggingFace e o token de escrita
> (do pré-requisito) como senha.

---

## Passo 3 — Copiar os arquivos para o clone

```bash
# Dockerfile na raiz do Space
cp Dockerfile hf-clone/

# README com os metadados YAML obrigatórios do HuggingFace
cp hf-space/README.md hf-clone/README.md

# Código do backend (o Dockerfile faz COPY backend/ .)
cp -r backend/ hf-clone/backend/
```

Estrutura esperada dentro de `hf-clone/`:

```
hf-clone/
├── Dockerfile
├── README.md      ← com bloco YAML (sdk: docker, title, emoji, ...)
└── backend/
    ├── server.js
    ├── package.json
    ├── lib/
    └── routes/
```

> Não copie `backend/node_modules` nem `backend/tmp` / `backend/cookies` —
> o `npm install --production` roda dentro do build. O `.gitignore` do backend
> já evita versionar esses diretórios.

---

## Passo 4 — Commit e push (dispara o build)

```bash
cd hf-clone
git add .
git commit -m "feat: initial deploy yutubo backend"
git push
```

O HuggingFace inicia o build do Docker automaticamente após o push (~3-5 min).

---

## Passo 5 — Aguardar o build e verificar status

Acompanhar em: https://huggingface.co/spaces/Juan-Felipe1/yutubo-backend

- Aba **Logs** mostra o build em tempo real (apt-get, pip yt-dlp, Deno, npm install).
- Status esperado ao final: **Running** (verde).
- Se falhar: ler os logs de build na aba "Logs" e corrigir o Dockerfile / arquivos.

---

## Passo 6 — Verificar o health check

```bash
curl https://juan-felipe1-yutubo-backend.hf.space/api/health
# Esperado: {"status":"ok","version":"1.0.0"}  (HTTP 200)
```

Smoke test do analyze (confirma yt-dlp + Deno funcionais no container):

```bash
curl -X POST https://juan-felipe1-yutubo-backend.hf.space/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=jNQXAC9IVRw"}'
# Esperado: JSON com title, channel, duration, qualities
```

> Se o analyze retornar "Sign in to confirm you're not a bot", o IP do datacenter
> HuggingFace foi bloqueado pelo YouTube. Mitigação: exportar `cookies.txt` do browser
> (extensão "Get cookies.txt locally") e enviar via `POST /api/cookies`.

---

## Passo 7 — Configurar CORS via Settings → Variables

O backend lê `CORS_ORIGINS` (lista separada por vírgula) em `backend/lib/config.js`.
Default é `*` (qualquer origem) — em produção, restringir ao domínio do frontend Vercel.

1. No Space: **Settings → Variables and secrets**.
2. Adicionar uma **Variable** (não secret, valor não sensível):
   - Name: `CORS_ORIGINS`
   - Value: URL do frontend Vercel, ex: `https://yutubo.vercel.app`
     (múltiplas origens separadas por vírgula, sem espaços extras).
3. Opcional: `NODE_ENV=production` (já definido como fallback no Dockerfile).
4. Reiniciar o Space para aplicar: **Settings → Factory reboot**
   (ou um push vazio: `git commit --allow-empty -m "chore: reboot" && git push`).

---

## Atualizações futuras

Para redeployar após mudanças no backend ou Dockerfile:

```bash
# Na raiz do repo, recopiar os arquivos alterados para hf-clone/
cp Dockerfile hf-clone/
cp -r backend/ hf-clone/backend/

cd hf-clone
git add .
git commit -m "fix: <descrição da mudança>"
git push
```

O build reinicia automaticamente a cada push.

---

## Comportamento de Sleep (esperado, não é bug)

O Space dorme após 48h de inatividade. O primeiro request após o sleep leva
~30-60s (cold start) e depois normaliza. O AC-10 da Story 1.2 documenta isso como
comportamento esperado — não há requisito de uptime 24/7.
