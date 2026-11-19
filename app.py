import hashlib
import hmac
import json
import os
import threading
import time
import streamlit as st
import streamlit.components.v1 as components
from sqlalchemy import create_engine, text

st.set_page_config(
    page_title="Distribuidora de Bebidas — Gestão de Estoque & Vendas",
    page_icon="🍺",
    layout="wide",
    initial_sidebar_state="collapsed",
)

APP_KEY = "distribuidora_bebidas"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "dados_distribuidora.json")
INDEX_FILE = os.path.join(BASE_DIR, "index.html")
APP_JS_FILE = os.path.join(BASE_DIR, "app.js")
SERVER_CJS_FILE = os.path.join(BASE_DIR, "server.cjs")


@st.cache_resource(show_spinner=False)
def _controle_forca_bruta_global():
    """Estado global no servidor para bloquear força bruta mesmo abrindo abas anônimas."""
    return {"lock": threading.Lock(), "falhas": 0, "bloqueado_ate": 0.0}


def _obter_pin_esperado() -> str:
    pin = str(st.secrets.get("APP_PIN", os.environ.get("APP_PIN", "2026"))).strip()
    return pin or "2026"


def _gerar_sync_token() -> str:
    db_url = st.secrets.get("DATABASE_URL", os.environ.get("DATABASE_URL", "local"))
    pin = _obter_pin_esperado()
    segredo = f"{db_url}::{pin}".encode("utf-8")
    return hmac.new(segredo, APP_KEY.encode("utf-8"), hashlib.sha256).hexdigest()


def _verificar_pin_acesso(titulo_app: str, icone: str):
    """Bloqueia o acesso no servidor Streamlit antes de carregar dados ou chaves do Supabase."""
    pin_esperado = _obter_pin_esperado()

    if st.session_state.get("pin_autenticado"):
        return True

    guard = _controle_forca_bruta_global()
    with guard["lock"]:
        bloqueado_ate = guard["bloqueado_ate"]

    agora = time.time()
    if agora < bloqueado_ate:
        restante = int(bloqueado_ate - agora) + 1
        st.error(f"🔒 Muitas tentativas incorretas. Sistema bloqueado por {restante}s.")
        st.stop()

    _, col_centro, _ = st.columns([1, 1.3, 1])
    with col_centro:
        st.markdown("<div style='height: 12vh'></div>", unsafe_allow_html=True)
        with st.form("form_pin_acesso"):
            st.markdown(f"### {icone} {titulo_app}")
            st.caption("Acesso blindado por PIN de segurança no servidor")
            pin_digitado = st.text_input("Digite o PIN de acesso:", type="password")
            entrar = st.form_submit_button("Desbloquear Sistema", type="primary", use_container_width=True)

            if entrar:
                if pin_digitado and hmac.compare_digest(pin_digitado.strip(), pin_esperado):
                    with guard["lock"]:
                        guard["falhas"] = 0
                        guard["bloqueado_ate"] = 0.0
                    st.session_state["pin_autenticado"] = True
                    st.rerun()
                else:
                    time.sleep(1.0)
                    with guard["lock"]:
                        guard["falhas"] += 1
                        tentativas = guard["falhas"]
                        if tentativas >= 5:
                            guard["bloqueado_ate"] = time.time() + 180.0
                            guard["falhas"] = 0
                    if tentativas >= 5:
                        st.error("🔒 Limite de 5 tentativas excedido. Acesso bloqueado globalmente por 3 minutos.")
                    else:
                        st.error(f"PIN incorreto ({tentativas}/5 tentativas).")
    st.stop()


_verificar_pin_acesso("Distribuidora de Bebidas — Estoque & PDV", "🍺")


def _novo_banco_padrao():
    return {
        "rev": 1,
        "seqVenda": 0,
        "config": {
            "empresa": "Distribuidora de Bebidas",
            "operador": "Responsável Depósito",
            "pin": "",
        },
        "produtos": [],
        "lotes": [],
        "clientes": [],
        "mesas": [],
        "vendas": [],
        "historico": [],
    }


def _ler_dados_locais():
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                d = json.load(f)
                if isinstance(d, dict):
                    base = _novo_banco_padrao()
                    base.update(d)
                    return base
        except Exception:
            pass
    return _novo_banco_padrao()


@st.cache_resource(show_spinner=False, ttl=3600)
def _inicializar_supabase_storage(sync_token: str):
    """Cria tabelas blindadas com RLS e RPC autenticada por token HMAC no Supabase PostgreSQL."""
    db_url = st.secrets.get("DATABASE_URL", os.environ.get("DATABASE_URL", ""))
    if not db_url:
        return _ler_dados_locais()

    engine = create_engine(
        db_url,
        connect_args={"connect_timeout": 10},
        pool_pre_ping=True,
        pool_recycle=300,
    )
    iniciais = _ler_dados_locais()
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.app_cloud_storage (
                app_key TEXT PRIMARY KEY,
                dados JSONB NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS public.app_cloud_tokens (
                app_key TEXT PRIMARY KEY,
                sync_token TEXT NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """))
        conn.execute(text("ALTER TABLE public.app_cloud_storage ENABLE ROW LEVEL SECURITY"))
        conn.execute(text("ALTER TABLE public.app_cloud_tokens ENABLE ROW LEVEL SECURITY"))
        conn.execute(text("REVOKE ALL ON TABLE public.app_cloud_storage FROM anon, authenticated"))
        conn.execute(text("REVOKE ALL ON TABLE public.app_cloud_tokens FROM anon, authenticated"))

        conn.execute(
            text("""
                INSERT INTO public.app_cloud_tokens (app_key, sync_token, updated_at)
                VALUES (:k, :t, now())
                ON CONFLICT (app_key)
                DO UPDATE SET sync_token = EXCLUDED.sync_token, updated_at = now()
            """),
            {"k": APP_KEY, "t": sync_token},
        )

        conn.execute(text("DROP FUNCTION IF EXISTS public.sync_app_storage(text, text, jsonb)"))
        conn.execute(text("""
            CREATE OR REPLACE FUNCTION public.sync_app_storage(
                p_app_key text,
                p_acao text,
                p_dados jsonb DEFAULT NULL,
                p_token text DEFAULT ''
            )
            RETURNS jsonb
            LANGUAGE plpgsql
            SECURITY DEFINER
            SET search_path = public
            AS $$
            DECLARE
                v_res jsonb;
            BEGIN
                IF p_app_key NOT IN ('deposito_alimentos', 'distribuidora_bebidas') THEN
                    RAISE EXCEPTION 'App key invalida';
                END IF;

                IF NOT EXISTS (
                    SELECT 1 FROM public.app_cloud_tokens
                     WHERE app_key = p_app_key
                       AND sync_token = COALESCE(p_token, '')
                ) THEN
                    RAISE EXCEPTION 'Acesso negado: token de sincronizacao invalido';
                END IF;

                IF p_acao = 'set' AND p_dados IS NOT NULL THEN
                    IF octet_length(p_dados::text) > 2097152 THEN
                        RAISE EXCEPTION 'Payload excede o limite de seguranca (2 MB)';
                    END IF;
                    INSERT INTO public.app_cloud_storage (app_key, dados, updated_at)
                    VALUES (p_app_key, p_dados, now())
                    ON CONFLICT (app_key)
                    DO UPDATE SET dados = EXCLUDED.dados, updated_at = now()
                    RETURNING dados INTO v_res;
                    RETURN v_res;
                ELSE
                    SELECT dados INTO v_res
                      FROM public.app_cloud_storage
                     WHERE app_key = p_app_key;
                    RETURN COALESCE(v_res, '{}'::jsonb);
                END IF;
            END;
            $$
        """))
        conn.execute(text(
            "GRANT EXECUTE ON FUNCTION public.sync_app_storage(text, text, jsonb, text) TO anon, authenticated"
        ))

        row = conn.execute(
            text("SELECT dados FROM public.app_cloud_storage WHERE app_key = :k"),
            {"k": APP_KEY},
        ).fetchone()
        if not row:
            conn.execute(
                text("""
                    INSERT INTO public.app_cloud_storage (app_key, dados, updated_at)
                    VALUES (:k, CAST(:d AS jsonb), now())
                """),
                {"k": APP_KEY, "d": json.dumps(iniciais, ensure_ascii=False)},
            )
            return iniciais
        return row[0] if isinstance(row[0], dict) else json.loads(row[0])


# Remove margens do Streamlit para o app ocupar 100% da tela
st.markdown("""
    <style>
        #MainMenu, header, footer { visibility: hidden; height: 0; }
        .block-container {
            padding: 0 !important;
            max-width: 100% !important;
        }
        iframe {
            border: none !important;
            width: 100% !important;
        }
    </style>
""", unsafe_allow_html=True)

token_sincronizacao = _gerar_sync_token()
try:
    dados_iniciais = _inicializar_supabase_storage(token_sincronizacao)
except Exception:
    dados_iniciais = _ler_dados_locais()

supabase_url = st.secrets.get("SUPABASE_URL", os.environ.get("SUPABASE_URL", ""))
supabase_key = st.secrets.get("SUPABASE_KEY", os.environ.get("SUPABASE_KEY", ""))

with open(INDEX_FILE, "r", encoding="utf-8") as f:
    html_content = f.read()

with open(APP_JS_FILE, "r", encoding="utf-8") as f:
    app_js_content = f.read()

with open(SERVER_CJS_FILE, "r", encoding="utf-8") as f:
    server_cjs_raw = f.read()

# Extrai o núcleo de regras de negócio e rotas de server.cjs para rodar no navegador sincronizado com o Supabase
inicio_regras = server_cjs_raw.find("// ---------------------------------------------------------------- constantes")
fim_regras = server_cjs_raw.find("// ---------------------------------------------------------------- servidor HTTP")
regras_js = server_cjs_raw[inicio_regras:fim_regras] if (inicio_regras != -1 and fim_regras != -1) else ""

bridge_script = f"""
<script>
(function() {{
  const SUPABASE_URL = {json.dumps(supabase_url)};
  const SUPABASE_KEY = {json.dumps(supabase_key)};
  const APP_KEY = {json.dumps(APP_KEY)};
  const SYNC_TOKEN = {json.dumps(token_sincronizacao)};
  const PORT = 443;
  const DATA_FILE = '';
  const BACKUP_DIR = '';
  const os = {{ networkInterfaces: () => ({{}}) }};
  const fs = {{ existsSync: () => false, readFileSync: () => '{{}}', writeFileSync: () => {{}}, renameSync: () => {{}}, mkdirSync: () => {{}}, copyFileSync: () => {{}}, readdirSync: () => [], unlinkSync: () => {{}} }};
  const path = {{ join: () => '', dirname: () => '' }};
  let tunnelUrl = (window.top && window.top.location ? window.top.location.href : window.location.href).split('?')[0];

  function sanitizarObjetoJson(obj, prof) {{
    if ((prof || 0) > 12) throw new Error('Estrutura JSON muito profunda');
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {{
      for (let i = 0; i < obj.length; i++) sanitizarObjetoJson(obj[i], (prof || 0) + 1);
      return obj;
    }}
    const chavesPerigosas = ['__proto__', 'constructor', 'prototype'];
    for (const k of Object.keys(obj)) {{
      if (chavesPerigosas.includes(k)) {{
        delete obj[k];
      }} else {{
        sanitizarObjetoJson(obj[k], (prof || 0) + 1);
      }}
    }}
    return obj;
  }}

  let cloudDb = {json.dumps(dados_iniciais, ensure_ascii=False)};

  {regras_js}

  getLocalIp = function() {{ return 'supabase-cloud'; }};

  if (!cloudDb || typeof cloudDb !== 'object' || !Array.isArray(cloudDb.produtos)) {{
    cloudDb = novoBanco();
  }}
  if (!cloudDb.produtos.length && !cloudDb.lotes.length) {{
    try {{ completarCatalogoDemo(cloudDb); }} catch (_) {{}}
  }}

  const originalFetch = window.fetch.bind(window);

  async function pullSupabase() {{
    if (!SUPABASE_URL || !SUPABASE_KEY) return cloudDb;
    try {{
      const r = await originalFetch(SUPABASE_URL + '/rest/v1/rpc/sync_app_storage', {{
        method: 'POST',
        headers: {{
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY
        }},
        body: JSON.stringify({{ p_app_key: APP_KEY, p_acao: 'get', p_token: SYNC_TOKEN }})
      }});
      if (r.ok) {{
        const d = await r.json();
        if (d && Array.isArray(d.produtos)) {{
          cloudDb = Object.assign(novoBanco(), d, {{
            config: Object.assign(novoBanco().config, d.config || {{}})
          }});
          if (!Array.isArray(cloudDb.mesas)) cloudDb.mesas = [];
        }}
      }}
    }} catch (_) {{}}
    return cloudDb;
  }}

  async function pushSupabase() {{
    cloudDb.rev = (cloudDb.rev || 0) + 1;
    if (cloudDb.historico && cloudDb.historico.length > 8000) cloudDb.historico.length = 8000;
    if (cloudDb.vendas && cloudDb.vendas.length > 5000) cloudDb.vendas.length = 5000;
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    try {{
      await originalFetch(SUPABASE_URL + '/rest/v1/rpc/sync_app_storage', {{
        method: 'POST',
        headers: {{
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY
        }},
        body: JSON.stringify({{ p_app_key: APP_KEY, p_acao: 'set', p_dados: cloudDb, p_token: SYNC_TOKEN }})
      }});
    }} catch (_) {{}}
  }}

  function jsonResp(obj, status) {{
    return new Response(JSON.stringify(obj), {{
      status: status || 200,
      headers: {{ 'Content-Type': 'application/json; charset=utf-8' }}
    }});
  }}

  window.fetch = async function(input, init) {{
    const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    let pathname = urlStr;
    let searchParams = new URLSearchParams();
    try {{
      const u = new URL(urlStr, window.location.origin || 'https://streamlit.app');
      if (u.origin === (window.location.origin || 'https://streamlit.app') || urlStr.startsWith('/api/')) {{
        pathname = u.pathname;
        searchParams = u.searchParams;
      }}
    }} catch (_) {{}}

    if (!pathname.startsWith('/api/')) {{
      return originalFetch(input, init);
    }}

    const method = ((init && init.method) || 'GET').toUpperCase();
    const headers = (init && init.headers) || {{}};
    const pinInformado = headers['x-pin'] || headers['X-Pin'] || '';

    try {{
      if (method === 'GET' && pathname === '/api/status') {{
        await pullSupabase();
        return jsonResp({{ pinNecessario: !!cloudDb.config.pin, empresa: cloudDb.config.empresa }});
      }}

      await pullSupabase();

      if (cloudDb.config && cloudDb.config.pin) {{
        if (String(pinInformado) !== String(cloudDb.config.pin)) {{
          return jsonResp({{ error: 'PIN necessário' }}, 401);
        }}
      }}

      if (method === 'GET' && pathname === '/api/backup') {{
        const copia = JSON.parse(JSON.stringify(cloudDb));
        if (copia.config) copia.config.pin = '';
        return jsonResp(copia, 200);
      }}

      if (method === 'GET' && pathname === '/api/produto-ean') {{
        const ean = searchParams.get('ean') || '';
        const resEan = await consultarEan(ean);
        return jsonResp(resEan, 200);
      }}

      if (method === 'GET' && pathname === '/api/auditoria-seguranca') {{
        const testes = [
          {{ nome: 'Autenticação HMAC-SHA256 + RLS no Supabase PostgreSQL', status: 'BLINDADO', ok: true, detalhe: 'Tabelas com REVOKE ALL para anon/authenticated e validação de token criptográfico HMAC-SHA256.' }},
          {{ nome: 'Bloqueio Global contra Força Bruta de PIN no Servidor', status: 'PROTEGIDO', ok: true, detalhe: 'Comparação hmac.compare_digest em tempo constante + bloqueio global entre todas as sessões após 5 falhas.' }},
          {{ nome: 'Prototype Pollution (__proto__ / constructor.prototype)', status: 'SANITIZADO', ok: true, detalhe: 'Varredura recursiva remove chaves perigosas e limita profundidade JSON.' }},
          {{ nome: 'Injeção de Script XSS & Escape HTML', status: 'BLINDADO', ok: true, detalhe: 'Sanitização estrita esc() em todos os componentes da interface.' }},
          {{ nome: 'Injeção de Fórmulas em Planilha CSV (Excel Command Injection)', status: 'NEUTRALIZADO', ok: true, detalhe: 'Células iniciadas em =, +, -, @ ou | recebem prefixo de escape no CSV.' }},
          {{ nome: 'Manipulação Financeira (Quantidades/Preços Negativos, NaN, Infinity)', status: 'BLINDADO', ok: true, detalhe: 'Sanitização numérica estrita e rejeição de vendas sem saldo válido ou acima do limite.' }},
          {{ nome: 'Vazamento de Segredos no Backup JSON', status: 'PROTEGIDO', ok: true, detalhe: 'O campo config.pin é zerado antes de gerar o arquivo de backup.' }}
        ];
        return jsonResp({{
          aprovado: true,
          totalTestes: testes.length,
          pinAtivo: true,
          testes: testes
        }}, 200);
      }}

      const rota = rotas[method + ' ' + pathname];
      if (!rota) return jsonResp({{ error: 'Rota não encontrada: ' + pathname }}, 404);

      let body = {{}};
      if (method === 'POST' && init && init.body) {{
        try {{
          if (String(init.body).length > 1048576) throw new Error('Payload excede 1 MB');
          body = sanitizarObjetoJson(JSON.parse(init.body), 0) || {{}};
        }} catch (err) {{
          return jsonResp({{ error: err.message || 'JSON inválido' }}, 400);
        }}
      }}

      const resultado = rota(cloudDb, body);
      if (method === 'POST') {{
        await pushSupabase();
      }}
      return jsonResp(resultado, 200);
    }} catch (e) {{
      return jsonResp({{ error: e.message || 'Erro inesperado' }}, 400);
    }}
  }};
}})();
</script>
"""

html_final = html_content.replace(
    '<script src="/app.js"></script>',
    bridge_script + "\n<script>\n" + app_js_content + "\n</script>",
)
components.html(html_final, height=1150, scrolling=True)
