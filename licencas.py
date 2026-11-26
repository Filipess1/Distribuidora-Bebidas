import datetime
import hmac
import json
import os
import secrets
from zoneinfo import ZoneInfo

import streamlit as st
from sqlalchemy import create_engine, text

# Caminho compartilhado localmente para sincronizar todas as licenças no PC do Filipe,
# com fallback local na pasta do próprio app quando rodar no Streamlit Cloud sem DATABASE_URL.
SHARED_LOCAL_LICENCAS = os.path.join(
    os.path.expanduser("~"), ".gemini", "antigravity", "scratch", "licencas_master.json"
)
APP_LOCAL_LICENCAS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "licencas_local.json")

CATALOGO_APPS = {
    "distribuidora_bebidas": {
        "nome": "Adega & Distribuidora de Bebidas (ERP + PDV)",
        "prefixo": "BEB",
        "chave_mestre": "BEB-MESTRE-2026",
        "preco_sugerido": "R$ 147,00/mês",
    },
    "deposito_alimentos": {
        "nome": "Depósito de Alimentos & Merenda FEFO",
        "prefixo": "ALI",
        "chave_mestre": "ALI-MESTRE-2026",
        "preco_sugerido": "R$ 147,00/mês",
    },
    "barbearia_app": {
        "nome": "Barbearia Clássica (Agendamento & Gestão)",
        "prefixo": "BARB",
        "chave_mestre": "BARB-MESTRE-2026",
        "preco_sugerido": "R$ 97,00/mês",
    },
    "safe_training_monitor": {
        "nome": "Safe Training Monitor (STM - Saúde & Treino)",
        "prefixo": "STM",
        "chave_mestre": "STM-MESTRE-2026",
        "preco_sugerido": "R$ 97,00/mês",
    },
}

PLANOS_DIAS = {
    "Teste Grátis (7 Dias)": 7,
    "Mensal (30 Dias)": 30,
    "Trimestral (90 Dias)": 90,
    "Semestral (180 Dias)": 180,
    "Anual (365 Dias)": 365,
    "Vitalício / Proprietário": 36500,
}


def _hoje_br() -> datetime.date:
    try:
        return datetime.datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    except Exception:
        return datetime.date.today()


def _agora_str() -> str:
    try:
        return datetime.datetime.now(ZoneInfo("America/Sao_Paulo")).strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def _obter_master_pin() -> str:
    try:
        pin = st.secrets.get("MASTER_ADMIN_PIN", "")
        if pin:
            return str(pin).strip()
    except Exception:
        pass
    return os.environ.get("MASTER_ADMIN_PIN", "2026").strip() or "2026"


def _obter_whatsapp_suporte() -> str:
    try:
        w = st.secrets.get("WHATSAPP_SUPORTE", "")
        if w:
            return str(w).strip()
    except Exception:
        pass
    return os.environ.get("WHATSAPP_SUPORTE", "5511999999999").strip()


@st.cache_resource(show_spinner=False)
def _obter_engine_licencas():
    db_url = ""
    try:
        db_url = st.secrets.get("DATABASE_URL", "")
    except Exception:
        pass
    if not db_url:
        db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        return None
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    try:
        return create_engine(db_url, pool_pre_ping=True)
    except Exception:
        return None


def _licencas_padrao() -> dict:
    hoje = _hoje_br()
    exp_vitalicio = (hoje + datetime.timedelta(days=36500)).isoformat()
    exp_demo = (hoje + datetime.timedelta(days=30)).isoformat()
    out = {}
    for app_base, info in CATALOGO_APPS.items():
        chave_m = info["chave_mestre"]
        out[chave_m] = {
            "chave": chave_m,
            "app_base": app_base,
            "cliente_nome": "Prof. Esp. Filipe Santos da Silva (Proprietário / Mestre)",
            "documento": "PROPRIETARIO",
            "whatsapp": "",
            "email": "",
            "plano": "Vitalício / Proprietário",
            "status": "ativa",
            "criada_em": hoje.isoformat(),
            "expira_em": exp_vitalicio,
            "pin_ceo": "1234",
            "pin_gerente": "2222",
            "pin_operador": "1111",
            "max_clientes": 9999,
            "is_master": True,
            "observacoes": "Licença Mestre padrão (mantém o banco de dados principal do proprietário).",
        }
        # Licença de demonstração pronta para testes comerciais
        chave_demo = f"{info['prefixo']}-DEMO-2026"
        out[chave_demo] = {
            "chave": chave_demo,
            "app_base": app_base,
            "cliente_nome": f"Cliente Demonstração ({info['prefixo']})",
            "documento": "000.000.000-00",
            "whatsapp": "",
            "email": "",
            "plano": "Mensal (30 Dias)",
            "status": "ativa",
            "criada_em": hoje.isoformat(),
            "expira_em": exp_demo,
            "pin_ceo": "1234",
            "pin_gerente": "2222",
            "pin_operador": "1111",
            "max_clientes": 50,
            "is_master": False,
            "observacoes": "Banco de dados isolado para demonstração comercial a clientes.",
        }
    return out


def _caminho_json_local() -> str:
    pasta_shared = os.path.dirname(SHARED_LOCAL_LICENCAS)
    if os.path.isdir(pasta_shared):
        return SHARED_LOCAL_LICENCAS
    return APP_LOCAL_LICENCAS


def _garantir_tabela_supabase(engine) -> bool:
    if not engine:
        return False
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS public.app_licencas_saas (
                    chave TEXT PRIMARY KEY,
                    app_base TEXT NOT NULL,
                    dados JSONB NOT NULL,
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            conn.execute(text("ALTER TABLE public.app_licencas_saas ENABLE ROW LEVEL SECURITY"))
        return True
    except Exception:
        return False


def carregar_todas_licencas() -> dict:
    licencas = _licencas_padrao()

    # 1. Tenta ler do arquivo JSON local
    caminho = _caminho_json_local()
    if os.path.exists(caminho):
        try:
            with open(caminho, "r", encoding="utf-8") as f:
                salvas = json.load(f)
                if isinstance(salvas, dict):
                    licencas.update(salvas)
        except Exception:
            pass

    # 2. Se houver PostgreSQL/Supabase configurado, sincroniza da nuvem
    engine = _obter_engine_licencas()
    if engine and _garantir_tabela_supabase(engine):
        try:
            with engine.begin() as conn:
                rows = conn.execute(
                    text("SELECT chave, dados FROM public.app_licencas_saas")
                ).fetchall()
                if rows:
                    for r in rows:
                        d = r[1] if isinstance(r[1], dict) else json.loads(r[1])
                        licencas[str(r[0]).strip().upper()] = d
                else:
                    # Inicializa as licenças padrão na nuvem
                    for k, v in licencas.items():
                        conn.execute(
                            text("""
                                INSERT INTO public.app_licencas_saas (chave, app_base, dados, updated_at)
                                VALUES (:c, :a, CAST(:d AS jsonb), now())
                                ON CONFLICT (chave) DO NOTHING
                            """),
                            {"c": k, "a": v.get("app_base", ""), "d": json.dumps(v, ensure_ascii=False)},
                        )
        except Exception:
            pass

    # Salva cache local atualizado
    try:
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(licencas, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    return licencas


def salvar_licenca(dados_licenca: dict):
    chave = str(dados_licenca.get("chave", "")).strip().upper()
    if not chave:
        return
    dados_licenca["chave"] = chave
    dados_licenca["updated_at"] = _agora_str()

    licencas = carregar_todas_licencas()
    licencas[chave] = dados_licenca

    caminho = _caminho_json_local()
    try:
        with open(caminho, "w", encoding="utf-8") as f:
            json.dump(licencas, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

    engine = _obter_engine_licencas()
    if engine and _garantir_tabela_supabase(engine):
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("""
                        INSERT INTO public.app_licencas_saas (chave, app_base, dados, updated_at)
                        VALUES (:c, :a, CAST(:d AS jsonb), now())
                        ON CONFLICT (chave) DO UPDATE SET
                            app_base = EXCLUDED.app_base,
                            dados = EXCLUDED.dados,
                            updated_at = now()
                    """),
                    {
                        "c": chave,
                        "a": dados_licenca.get("app_base", ""),
                        "d": json.dumps(dados_licenca, ensure_ascii=False),
                    },
                )
        except Exception:
            pass


def excluir_licenca(chave: str):
    chave = str(chave or "").strip().upper()
    licencas = carregar_todas_licencas()
    if chave in licencas and not licencas[chave].get("is_master"):
        del licencas[chave]
        caminho = _caminho_json_local()
        try:
            with open(caminho, "w", encoding="utf-8") as f:
                json.dump(licencas, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        engine = _obter_engine_licencas()
        if engine and _garantir_tabela_supabase(engine):
            try:
                with engine.begin() as conn:
                    conn.execute(
                        text("DELETE FROM public.app_licencas_saas WHERE chave = :c"),
                        {"c": chave},
                    )
            except Exception:
                pass


def gerar_nova_chave(app_base: str) -> str:
    prefixo = CATALOGO_APPS.get(app_base, {}).get("prefixo", "APP")
    ano = _hoje_br().year
    aleatorio = secrets.token_hex(2).upper()
    return f"{prefixo}-{ano}-{aleatorio}"


def validar_licenca(chave: str, app_base: str) -> dict:
    """Valida se a chave existe, pertence ao app_base, está ativa e dentro da validade."""
    chave_limpa = str(chave or "").strip().upper()
    licencas = carregar_todas_licencas()

    if not chave_limpa:
        return {"valida": False, "motivo": "Informe uma Chave de Licença."}

    lic = licencas.get(chave_limpa)
    if not lic:
        return {"valida": False, "motivo": "Chave de licença não encontrada."}

    if lic.get("app_base") != app_base:
        nome_correto = CATALOGO_APPS.get(lic.get("app_base", ""), {}).get("nome", lic.get("app_base"))
        return {
            "valida": False,
            "motivo": f"Esta chave pertence ao aplicativo '{nome_correto}'.",
        }

    status = str(lic.get("status", "ativa")).lower()
    if status != "ativa":
        return {
            "valida": False,
            "motivo": f"Licença {status.upper()}. Entre em contato com o suporte para regularização.",
            "licenca": lic,
        }

    hoje = _hoje_br()
    try:
        exp = datetime.date.fromisoformat(str(lic.get("expira_em", "2099-12-31"))[:10])
    except Exception:
        exp = hoje + datetime.timedelta(days=1)

    dias_restantes = (exp - hoje).days
    if dias_restantes < 0:
        return {
            "valida": False,
            "motivo": f"Licença expirada em {exp.strftime('%d/%m/%Y')}. Renove sua assinatura para continuar acessando seus dados.",
            "licenca": lic,
            "dias_restantes": dias_restantes,
        }

    # Define a chave de banco de dados isolada (Multi-Tenant):
    # A licença Mestre mantém o APP_KEY original para preservar todos os dados atuais do proprietário.
    # Cada cliente novo recebe um banco isolado: f"{app_base}::{chave_limpa}"
    if lic.get("is_master") or chave_limpa == CATALOGO_APPS.get(app_base, {}).get("chave_mestre"):
        tenant_app_key = app_base
    else:
        tenant_app_key = f"{app_base}::{chave_limpa}"

    return {
        "valida": True,
        "motivo": "Licença ativa",
        "licenca": lic,
        "dias_restantes": dias_restantes,
        "tenant_app_key": tenant_app_key,
    }


def ativar_licenca_stm_no_perfil(chave: str, user_id: str, user_email: str, sb_client=None) -> tuple[bool, str]:
    """Permite que um profissional no Safe Training Monitor ative sua assinatura usando uma chave STM-XXXX."""
    res = validar_licenca(chave, "safe_training_monitor")
    if not res["valida"]:
        return False, res["motivo"]

    lic = res["licenca"]
    max_cli = int(lic.get("max_clientes", 50) or 50)

    # Atualiza a licença com o e-mail do profissional ativado
    if user_email and not lic.get("is_master"):
        lic["email"] = user_email
        salvar_licenca(lic)

    # Tenta ativar no banco via SQLAlchemy (DATABASE_URL) ou via Supabase RPC/Table
    engine = _obter_engine_licencas()
    ativou_db = False
    if engine and user_id:
        try:
            with engine.begin() as conn:
                conn.execute(
                    text("""
                        UPDATE public.profiles
                        SET subscription_status = 'active',
                            role = 'professional',
                            max_clients = :mc
                        WHERE id = CAST(:uid AS uuid)
                    """),
                    {"mc": max_cli, "uid": str(user_id)},
                )
            ativou_db = True
        except Exception:
            pass

    if not ativou_db and sb_client and user_id:
        try:
            sb_client.table("profiles").update({
                "subscription_status": "active",
                "role": "professional",
                "max_clients": max_cli,
            }).eq("id", user_id).execute()
            ativou_db = True
        except Exception:
            pass

    st.session_state["stm_licenca_ativa"] = lic["chave"]
    st.session_state["stm_max_clientes_override"] = max_cli
    return True, f"Licença {lic['chave']} ativada com sucesso! Validade: {lic.get('expira_em')} ({res['dias_restantes']} dias restantes)."


def renderizar_painel_admin_licencas(app_base_padrao: str = "distribuidora_bebidas", chave_prefixo_ui: str = "adm"):
    """Renderiza o Painel Gerador e Gerenciador de Licenças Comerciais para os 4 apps."""
    st.markdown("""
        <div style="background:linear-gradient(135deg,#0f172a,#1e1b4b);border:1px solid #6366f1;border-radius:12px;padding:14px 18px;margin-bottom:14px;color:#f8fafc;">
            <div style="font-size:1.05rem;font-weight:800;color:#a5b4fc;">💼 Central SaaS de Licenças & Assinaturas (Multi-Cliente)</div>
            <div style="font-size:0.82rem;color:#cbd5e1;margin-top:4px;">
                Cada chave gerada cria automaticamente um <b>banco de dados 100% isolado</b> para o cliente, com validade automática e bloqueio/renovação em 1 clique.
            </div>
        </div>
    """, unsafe_allow_html=True)

    sess_key = f"_master_admin_unlocked_{chave_prefixo_ui}"
    if not st.session_state.get(sess_key, False):
        col_p, col_b = st.columns([3, 1])
        with col_p:
            pin_digitado = st.text_input(
                "🔐 Senha Mestre do Proprietário (Padrão: 2026 ou MASTER_ADMIN_PIN):",
                type="password",
                key=f"input_master_pin_{chave_prefixo_ui}",
            )
        with col_b:
            st.write("")
            st.write("")
            if st.button("Acessar Painel", type="primary", use_container_width=True, key=f"btn_unlock_{chave_prefixo_ui}"):
                if hmac.compare_digest(pin_digitado.strip(), _obter_master_pin()):
                    st.session_state[sess_key] = True
                    st.rerun()
                else:
                    st.error("Senha Mestre incorreta.")
        return

    aba_gerar, aba_gerenciar = st.tabs([
        "➕ Gerar Nova Licença para Cliente",
        "📋 Gerenciar Clientes, Renovações e Bloqueios",
    ])

    with aba_gerar:
        opcoes_apps = list(CATALOGO_APPS.keys())
        idx_padrao = opcoes_apps.index(app_base_padrao) if app_base_padrao in opcoes_apps else 0

        c1, c2 = st.columns(2)
        with c1:
            app_escolhido = st.selectbox(
                "Aplicativo a Licenciar:",
                options=opcoes_apps,
                index=idx_padrao,
                format_func=lambda k: f"{CATALOGO_APPS[k]['nome']} ({CATALOGO_APPS[k]['preco_sugerido']})",
                key=f"sel_app_{chave_prefixo_ui}",
            )
            cliente_nome = st.text_input(
                "Nome da Empresa / Cliente:",
                placeholder="Ex: Adega do João / Barbearia Imperial / Clínica Fit",
                key=f"cli_nome_{chave_prefixo_ui}",
            )
            documento = st.text_input(
                "CPF ou CNPJ (opcional):",
                placeholder="00.000.000/0001-00",
                key=f"cli_doc_{chave_prefixo_ui}",
            )
            whatsapp = st.text_input(
                "WhatsApp do Cliente:",
                placeholder="5511999999999",
                key=f"cli_whats_{chave_prefixo_ui}",
            )
        with c2:
            plano = st.selectbox(
                "Plano / Período de Validade:",
                options=list(PLANOS_DIAS.keys()),
                index=1,
                key=f"sel_plano_{chave_prefixo_ui}",
            )
            c_pin1, c_pin2, c_pin3 = st.columns(3)
            with c_pin1:
                pin_ceo = st.text_input("PIN Dono/CEO:", value="1234", max_chars=12, key=f"p_ceo_{chave_prefixo_ui}")
            with c_pin2:
                pin_ger = st.text_input("PIN Gerente:", value="2222", max_chars=12, key=f"p_ger_{chave_prefixo_ui}")
            with c_pin3:
                pin_op = st.text_input("PIN Caixa/Oper.:", value="1111", max_chars=12, key=f"p_op_{chave_prefixo_ui}")
            max_cli_stm = st.number_input(
                "Limite de Alunos (para Safe Training Monitor):",
                min_value=1,
                max_value=9999,
                value=30,
                key=f"max_cli_{chave_prefixo_ui}",
            )
            chave_custom = st.text_input(
                "Chave Personalizada (deixe em branco para gerar automática):",
                placeholder=f"Ex: {CATALOGO_APPS[app_escolhido]['prefixo']}-2026-VIP1",
                key=f"chave_cust_{chave_prefixo_ui}",
            )

        if st.button("🚀 Gerar Chave de Licença Agora", type="primary", use_container_width=True, key=f"btn_criar_lic_{chave_prefixo_ui}"):
            if not cliente_nome.strip():
                st.warning("Informe o nome da empresa ou cliente para registrar a licença.")
            else:
                nova_chave = chave_custom.strip().upper() if chave_custom.strip() else gerar_nova_chave(app_escolhido)
                dias = PLANOS_DIAS.get(plano, 30)
                hoje = _hoje_br()
                expira = (hoje + datetime.timedelta(days=dias)).isoformat()

                dados_nova = {
                    "chave": nova_chave,
                    "app_base": app_escolhido,
                    "cliente_nome": cliente_nome.strip(),
                    "documento": documento.strip(),
                    "whatsapp": whatsapp.strip(),
                    "email": "",
                    "plano": plano,
                    "status": "ativa",
                    "criada_em": hoje.isoformat(),
                    "expira_em": expira,
                    "pin_ceo": pin_ceo.strip() or "1234",
                    "pin_gerente": pin_ger.strip() or "2222",
                    "pin_operador": pin_op.strip() or "1111",
                    "max_clientes": int(max_cli_stm),
                    "is_master": False,
                    "observacoes": f"Plano {plano} gerado pelo painel.",
                }
                salvar_licenca(dados_nova)
                st.session_state[f"ultima_licenca_criada_{chave_prefixo_ui}"] = dados_nova
                st.success(f"✅ Licença **{nova_chave}** criada com sucesso para **{cliente_nome}**!")

        ult = st.session_state.get(f"ultima_licenca_criada_{chave_prefixo_ui}")
        if ult:
            nome_sistema = CATALOGO_APPS.get(ult["app_base"], {}).get("nome", ult["app_base"])
            msg_whatsapp = (
                f"🎉 *LICENÇA ATIVADA — {nome_sistema}*\n\n"
                f"Olá, *{ult['cliente_nome']}*! Seu sistema já está liberado com banco de dados exclusivo.\n\n"
                f"🔑 *Chave de Licença:* `{ult['chave']}`\n"
                f"📅 *Plano:* {ult['plano']} (Válido até {ult['expira_em']})\n"
                f"👑 *PIN Proprietário (CEO):* `{ult['pin_ceo']}`\n"
                f"👔 *PIN Gerente:* `{ult['pin_gerente']}`\n"
                f"🛒 *PIN Operador / Balcão:* `{ult['pin_operador']}`\n\n"
                f"Basta inserir a Chave de Licença e o seu PIN na tela de entrada!"
            )
            st.markdown("##### 📲 Mensagem Pronta para Enviar no WhatsApp do Cliente:")
            st.code(msg_whatsapp, language=None)

    with aba_gerenciar:
        licencas = carregar_todas_licencas()
        filtro_app = st.selectbox(
            "Filtrar por Aplicativo:",
            options=["TODOS"] + list(CATALOGO_APPS.keys()),
            format_func=lambda k: "Todos os 4 Aplicativos" if k == "TODOS" else CATALOGO_APPS[k]["nome"],
            key=f"filtro_ger_{chave_prefixo_ui}",
        )

        lista = [
            v for v in licencas.values()
            if filtro_app == "TODOS" or v.get("app_base") == filtro_app
        ]
        lista.sort(key=lambda x: (not x.get("is_master", False), x.get("expira_em", "")))

        hoje = _hoje_br()
        ativas = sum(1 for x in lista if x.get("status") == "ativa")
        bloqueadas = sum(1 for x in lista if x.get("status") != "ativa")

        m1, m2, m3 = st.columns(3)
        m1.metric("Total de Licenças", len(lista))
        m2.metric("Licenças Ativas", ativas)
        m3.metric("Bloqueadas / Suspensas", bloqueadas)

        for item in lista:
            ch = item["chave"]
            app_nome = CATALOGO_APPS.get(item.get("app_base", ""), {}).get("nome", item.get("app_base", ""))
            status = item.get("status", "ativa")
            try:
                exp_dt = datetime.date.fromisoformat(str(item.get("expira_em", "2099-12-31"))[:10])
                dias_rest = (exp_dt - hoje).days
            except Exception:
                dias_rest = 999

            cor_borda = "#22c55e" if (status == "ativa" and dias_rest >= 0) else "#ef4444"
            badge_status = "🟢 ATIVA" if (status == "ativa" and dias_rest >= 0) else ("🔴 EXPIRADA" if dias_rest < 0 else "⛔ BLOQUEADA")

            with st.container():
                st.markdown(
                    f"""<div style="border-left:4px solid {cor_borda};background:#1e293b;padding:10px 14px;border-radius:8px;margin-bottom:8px;color:#f8fafc;">
                        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;">
                            <span><b>{item.get('cliente_nome', 'Cliente')}</b> — <code style="color:#fbbf24;">{ch}</code></span>
                            <span><b>{badge_status}</b> | Vence: <b>{item.get('expira_em')}</b> ({dias_rest} dias)</span>
                        </div>
                        <div style="font-size:0.78rem;color:#94a3b8;margin-top:4px;">
                            App: <b>{app_nome}</b> | Plano: {item.get('plano')} | PINs (CEO/Ger/Op): <code>{item.get('pin_ceo','1234')}</code> / <code>{item.get('pin_gerente','2222')}</code> / <code>{item.get('pin_operador','1111')}</code>
                        </div>
                    </div>""",
                    unsafe_allow_html=True,
                )
                b1, b2, b3, b4 = st.columns(4)
                with b1:
                    if st.button("➕ Renovar +30 Dias", key=f"ren30_{ch}_{chave_prefixo_ui}", use_container_width=True):
                        base_dt = max(hoje, exp_dt) if dias_rest < 3650 else hoje
                        item["expira_em"] = (base_dt + datetime.timedelta(days=30)).isoformat()
                        item["status"] = "ativa"
                        salvar_licenca(item)
                        st.rerun()
                with b2:
                    if st.button("📅 Renovar +1 Ano", key=f"ren365_{ch}_{chave_prefixo_ui}", use_container_width=True):
                        base_dt = max(hoje, exp_dt) if dias_rest < 3650 else hoje
                        item["expira_em"] = (base_dt + datetime.timedelta(days=365)).isoformat()
                        item["status"] = "ativa"
                        salvar_licenca(item)
                        st.rerun()
                with b3:
                    if item.get("is_master"):
                        st.button("👑 Licença Mestre", disabled=True, key=f"mst_{ch}_{chave_prefixo_ui}", use_container_width=True)
                    elif status == "ativa":
                        if st.button("⛔ Bloquear Acesso", key=f"blk_{ch}_{chave_prefixo_ui}", use_container_width=True):
                            item["status"] = "bloqueada"
                            salvar_licenca(item)
                            st.rerun()
                    else:
                        if st.button("✅ Desbloquear", key=f"unblk_{ch}_{chave_prefixo_ui}", use_container_width=True):
                            item["status"] = "ativa"
                            salvar_licenca(item)
                            st.rerun()
                with b4:
                    if not item.get("is_master"):
                        if st.button("🗑️ Excluir", key=f"del_{ch}_{chave_prefixo_ui}", use_container_width=True):
                            excluir_licenca(ch)
                            st.rerun()
                    else:
                        if st.button("🔒 Fechar Painel", key=f"lock_{ch}_{chave_prefixo_ui}", use_container_width=True):
                            st.session_state[sess_key] = False
                            st.rerun()
