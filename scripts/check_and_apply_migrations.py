#!/usr/bin/env python3
"""Check existing RPCs in live Supabase DB and apply missing migrations."""
import psycopg2
import sys

DB_HOST = "db.ewlkdrwrespnxyddwtgo.supabase.co"
DB_PORT = 5432
DB_NAME = "postgres"
DB_USER = "postgres"
DB_PASS = "OperaOmnia#89"

def connect():
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASS,
        sslmode="require", connect_timeout=15,
        options="-c address_family=ipv4"
    )

def check_rpcs(conn):
    """Check which RPCs already exist."""
    cur = conn.cursor()
    cur.execute("""
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = 'public'
          AND routine_type = 'FUNCTION'
          AND routine_name IN (
            'get_my_pending_invitations',
            'get_invitation_for_accept',
            'accept_invitation',
            'transfer_ownership',
            'get_invitation_by_token'
          )
        ORDER BY routine_name;
    """)
    rows = cur.fetchall()
    existing = [r[0] for r in rows]
    cur.close()
    return existing

def check_columns(conn):
    """Check if token column exists on organization_invitations."""
    cur = conn.cursor()
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'organization_invitations'
          AND column_name = 'token';
    """)
    rows = cur.fetchall()
    cur.close()
    return len(rows) > 0

def apply_sql_file(conn, filepath, label):
    """Read and execute a SQL file."""
    with open(filepath, 'r') as f:
        sql = f.read()
    cur = conn.cursor()
    try:
        cur.execute(sql)
        conn.commit()
        print(f"  [OK] {label} aplicado com sucesso")
    except Exception as e:
        conn.rollback()
        print(f"  [ERRO] {label} falhou: {e}")
        return False
    finally:
        cur.close()
    return True

def main():
    print("=== Conectando ao Supabase DB ===")
    try:
        conn = connect()
        print("  Conexão OK")
    except Exception as e:
        print(f"  FALHA: {e}")
        sys.exit(1)

    print("\n=== Verificando estado da DB ===")
    existing_rpcs = check_rpcs(conn)
    print(f"  RPCs existentes: {existing_rpcs if existing_rpcs else 'nenhum'}")

    has_token_col = check_columns(conn)
    print(f"  Coluna 'token' em organization_invitations: {'SIM' if has_token_col else 'NAO'}")

    # Determine what needs to be applied
    base = "/home/z/my-project/proposal-swift-main/supabase/migrations"
    applied = []

    # 1. invite_token.sql (token column + get_invitation_by_token RPC)
    needs_token_sql = False
    if not has_token_col:
        needs_token_sql = True
        print("\n  -> Precisa aplicar: invite_token.sql (coluna token ausente)")
    elif 'get_invitation_by_token' not in existing_rpcs:
        needs_token_sql = True
        print("\n  -> Precisa aplicar: invite_token.sql (RPC get_invitation_by_token ausente)")

    if needs_token_sql:
        print("\n=== Aplicando invite_token.sql ===")
        ok = apply_sql_file(conn, f"{base}/invite_token.sql", "invite_token.sql")
        if ok:
            applied.append("invite_token.sql")

    # 2. fix_invitee_select_rpc.sql (4 RPCs)
    needed_rpcs = [
        'get_my_pending_invitations',
        'get_invitation_for_accept',
        'accept_invitation',
        'transfer_ownership'
    ]
    missing_rpcs = [r for r in needed_rpcs if r not in existing_rpcs]

    if missing_rpcs:
        print(f"\n=== Aplicando fix_invitee_select_rpc.sql (RPCs em falta: {missing_rpcs}) ===")
        ok = apply_sql_file(conn, f"{base}/fix_invitee_select_rpc.sql", "fix_invitee_select_rpc.sql")
        if ok:
            applied.append("fix_invitee_select_rpc.sql")

    # Re-check after applying
    if applied:
        print("\n=== Verificacao pos-aplicacao ===")
        existing_rpcs = check_rpcs(conn)
        print(f"  RPCs agora existentes: {existing_rpcs}")
        has_token_col = check_columns(conn)
        print(f"  Coluna 'token': {'SIM' if has_token_col else 'NAO'}")

    if not applied:
        print("\n=== Tudo ja esta aplicado. Nenhuma migracao necessaria. ===")

    conn.close()
    print("\n=== Concluido ===")

if __name__ == "__main__":
    main()